import { ref, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'

// Worker instance
let worker = null

export function useOptimizedMap(map, layers) {
  const isLoading = ref(false)
  const visibleFeatures = ref(new Map())
  const spatialIndex = ref(null)
  const simplifiedGeometries = ref(new Map())
  const renderQueue = ref([])
  const abortController = ref(null)

  // Initialize worker
  onMounted(() => {
    worker = new Worker(new URL('../workers/geoWorker.js', import.meta.url), { type: 'module' })
    worker.onmessage = handleWorkerMessage
  })

  onUnmounted(() => {
    if (worker) {
      worker.terminate()
      worker = null
    }
  })

  function handleWorkerMessage(e) {
    const { type, id, result } = e.data

    switch (type) {
      case 'simplified':
        simplifiedGeometries.value.set(id, result)
        break
      case 'indexBuilt':
        spatialIndex.value = result
        isLoading.value = false
        break
      case 'viewportQueried':
        updateVisibleFeatures(result)
        break
    }
  }

  // Build spatial index for all features
  function buildIndex(features) {
    if (!worker) return
    isLoading.value = true

    worker.postMessage({
      type: 'buildIndex',
      data: { features },
      id: 'main'
    })
  }

  // Query features in current viewport
  function queryViewport() {
    if (!map.value || !spatialIndex.value) return

    const bounds = map.value.getBounds()
    const viewport = {
      minX: bounds.getWest(),
      minY: bounds.getSouth(),
      maxX: bounds.getEast(),
      maxY: bounds.getNorth()
    }

    worker.postMessage({
      type: 'queryViewport',
      data: { index: spatialIndex.value, viewport },
      id: 'viewport'
    })
  }

  // Simplify geometry based on zoom
  function simplifyGeometry(geometry, featureId) {
    if (!worker || !map.value) return geometry

    const zoom = map.value.getZoom()
    const cacheKey = `${featureId}_${zoom}`

    if (simplifiedGeometries.value.has(cacheKey)) {
      return simplifiedGeometries.value.get(cacheKey)
    }

    worker.postMessage({
      type: 'simplify',
      data: { geometry, zoom },
      id: cacheKey
    })

    return geometry
  }

  // Debounced viewport update
  let viewportTimeout = null
  function debouncedViewportUpdate() {
    if (viewportTimeout) clearTimeout(viewportTimeout)
    viewportTimeout = setTimeout(() => {
      queryViewport()
    }, 100)
  }

  // Watch map movements
  watch(() => map.value, (newMap) => {
    if (!newMap) return

    newMap.on('moveend zoomend', debouncedViewportUpdate)
    debouncedViewportUpdate()
  })

  // Batch render features
  function batchRender(features, batchSize = 100) {
    return new Promise((resolve) => {
      const results = []
      let index = 0

      function renderBatch() {
        const batch = features.slice(index, index + batchSize)
        if (batch.length === 0) {
          resolve(results)
          return
        }

        results.push(...batch)
        index += batchSize

        // Use requestAnimationFrame for smooth rendering
        requestAnimationFrame(renderBatch)
      }

      renderBatch()
    })
  }

  // Progressive loading with abort support
  async function progressiveLoad(features, onProgress) {
    if (abortController.value) {
      abortController.value.abort()
    }
    abortController.value = new AbortController()
    const signal = abortController.value.signal

    const total = features.length
    const chunkSize = 500
    const results = []

    for (let i = 0; i < total; i += chunkSize) {
      if (signal.aborted) break

      const chunk = features.slice(i, i + chunkSize)
      results.push(...chunk)

      if (onProgress) {
        onProgress(Math.min(i + chunkSize, total), total)
      }

      // Yield to main thread
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    return results
  }

  return {
    isLoading,
    visibleFeatures,
    spatialIndex,
    buildIndex,
    queryViewport,
    simplifyGeometry,
    batchRender,
    progressiveLoad
  }
}
