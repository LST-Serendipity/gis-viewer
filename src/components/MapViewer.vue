<script setup>
import { ref, onMounted, watch, provide, shallowRef } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
})

const props = defineProps({
  layers: { type: Array, required: true },
  editMode: { type: Boolean, default: false }
})

const emit = defineEmits(['map-ready', 'features-updated', 'basemap-change'])

const CLUSTER_THRESHOLD = 50
const MAX_FEATURES_WITHOUT_CLUSTER = 500
const RENDER_BATCH_SIZE = 200
const VIEWPORT_BUFFER = 0.1

const basemaps = {
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }),
  carto_light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }),
  carto_dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }),
  esri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }),
  esri_topo: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 17 })
}

let currentBasemap = 'osm'
const mapContainer = ref(null)
let map = null
let drawControl = null
const layerRegistry = shallowRef({})
const drawnItems = new L.FeatureGroup()
const isLoading = ref(false)
const renderProgress = ref(0)

// Web Worker for geometry processing
let geoWorker = null

const getClusterRadius = (count) => {
  if (count > 5000) return 80
  if (count > 2000) return 70
  if (count > 1000) return 60
  if (count > 500) return 55
  if (count > 100) return 50
  return 45
}

// Check if feature is in viewport
const isFeatureInViewport = (feature, bounds) => {
  if (!feature.geometry) return false

  const geom = feature.geometry
  const checkCoord = (coord) => {
    return coord[0] >= bounds.getWest() - VIEWPORT_BUFFER &&
           coord[0] <= bounds.getEast() + VIEWPORT_BUFFER &&
           coord[1] >= bounds.getSouth() - VIEWPORT_BUFFER &&
           coord[1] <= bounds.getNorth() + VIEWPORT_BUFFER
  }

  switch (geom.type) {
    case 'Point':
      return checkCoord(geom.coordinates)
    case 'MultiPoint':
    case 'LineString':
      return geom.coordinates.some(checkCoord)
    case 'Polygon':
      return geom.coordinates[0].some(checkCoord)
    case 'MultiPolygon':
      return geom.coordinates.some(poly => poly[0].some(checkCoord))
    default:
      return true
  }
}

// Batch render features
const renderFeaturesBatched = async (features, createLayer, onProgress) => {
  const total = features.length
  const layers = []

  for (let i = 0; i < total; i += RENDER_BATCH_SIZE) {
    const batch = features.slice(i, Math.min(i + RENDER_BATCH_SIZE, total))

    batch.forEach(feature => {
      try {
        const layer = createLayer(feature)
        if (layer) layers.push(layer)
      } catch (e) {
        console.warn('Failed to render feature:', e)
      }
    })

    if (onProgress) {
      onProgress(Math.min(i + RENDER_BATCH_SIZE, total), total)
    }

    // Yield to main thread
    if (i + RENDER_BATCH_SIZE < total) {
      await new Promise(resolve => requestAnimationFrame(resolve))
    }
  }

  return layers
}

const removeLayerFromMap = (id) => {
  const registry = layerRegistry.value
  if (registry[id]) {
    if (registry[id].clusterGroup) map.removeLayer(registry[id].clusterGroup)
    if (registry[id].layer) map.removeLayer(registry[id].layer)
    if (registry[id].nonPointLayer) map.removeLayer(registry[id].nonPointLayer)
    delete registry[id]
  }
}

const addSingleLayer = async (layerData) => {
  const { id, geojson, color, visible, opacity, style } = layerData

  removeLayerFromMap(id)
  if (!visible) {
    layerRegistry.value[id] = { clusterGroup: null, layer: null, nonPointLayer: null }
    return
  }

  isLoading.value = true
  renderProgress.value = 0

  const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson]
  const totalFeatures = features.length

  // For very large datasets, use viewport clipping
  const useViewportClipping = totalFeatures > 1000
  const bounds = map.getBounds()

  let filteredFeatures = features
  if (useViewportClipping) {
    filteredFeatures = features.filter(f => isFeatureInViewport(f, bounds))
  }

  // Separate points and non-points
  const pointFeatures = []
  const nonPointFeatures = []

  filteredFeatures.forEach(f => {
    if (!f.geometry) return
    if (f.geometry.type === 'Point' || f.geometry.type === 'MultiPoint') {
      pointFeatures.push(f)
    } else {
      nonPointFeatures.push(f)
    }
  })

  const useCluster = pointFeatures.length >= CLUSTER_THRESHOLD

  let clusterGroup = null
  let nonPointLayer = null

  // Render non-point features
  if (nonPointFeatures.length > 0) {
    const defaultStyle = {
      color: style?.color || color,
      weight: style?.lineWidth || 2,
      fillColor: style?.fillColor || color,
      fillOpacity: (style?.fillOpacity ?? 0.2) * opacity,
      opacity: (style?.strokeOpacity ?? 1) * opacity
    }

    nonPointLayer = L.geoJSON(null, {
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        if (feature.properties && Object.keys(feature.properties).length > 0) {
          const content = Object.entries(feature.properties)
            .map(([k, v]) => `<strong>${k}:</strong> ${v}`).join('<br/>')
          layer.bindPopup(content)
        }
      }
    }).addTo(map)

    await renderFeaturesBatched(
      nonPointFeatures,
      (feature) => {
        const layer = L.geoJSON(feature, {
          style: defaultStyle,
          onEachFeature: (f, l) => {
            if (f.properties && Object.keys(f.properties).length > 0) {
              const content = Object.entries(f.properties)
                .map(([k, v]) => `<strong>${k}:</strong> ${v}`).join('<br/>')
              l.bindPopup(content)
            }
          }
        })
        if (layer) {
          layer.eachLayer(l => nonPointLayer.addLayer(l))
        }
        return layer
      },
      (current, total) => {
        renderProgress.value = Math.round((current / total) * 50)
      }
    )
  }

  // Render point features
  if (pointFeatures.length > 0) {
    const defaultPointStyle = {
      radius: style?.pointRadius || 6,
      fillColor: style?.fillColor || color,
      color: style?.color || color,
      weight: style?.lineWidth || 2,
      fillOpacity: (style?.fillOpacity ?? 0.9) * opacity,
      opacity: (style?.strokeOpacity ?? 1) * opacity
    }

    if (useCluster) {
      clusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: getClusterRadius(pointFeatures.length),
        spiderfyOnMaxZoom: true,
        spiderfyDistanceMultiplier: 1.5,
        animate: pointFeatures.length < 1000,
        animateAddingMarkers: pointFeatures.length < 500,
        disableClusteringAtZoom: 16,
        chunkedLoading: true,
        chunkProgress: (processed, total) => {
          renderProgress.value = 50 + Math.round((processed / total) * 50)
        },
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount()
          const radius = getClusterRadius(count)
          return L.divIcon({
            html: `<div class="cluster-circle" style="width:${radius}px;height:${radius}px;background:${color};">
              <span class="cluster-count">${count}</span></div>`,
            className: 'cluster-wrapper',
            iconSize: L.point(radius, radius)
          })
        }
      })

      await renderFeaturesBatched(
        pointFeatures,
        (feature) => {
          const coords = feature.geometry.coordinates
          const marker = L.circleMarker([coords[1], coords[0]], defaultPointStyle)
          if (feature.properties) {
            const content = Object.entries(feature.properties)
              .map(([k, v]) => `<strong>${k}:</strong> ${v}`).join('<br/>')
            marker.bindPopup(content)
          }
          clusterGroup.addLayer(marker)
          return marker
        },
        (current, total) => {
          renderProgress.value = 50 + Math.round((current / total) * 50)
        }
      )

      clusterGroup.addTo(map)
    } else {
      const pointLayer = L.layerGroup().addTo(map)

      await renderFeaturesBatched(
        pointFeatures,
        (feature) => {
          const coords = feature.geometry.coordinates
          const marker = L.circleMarker([coords[1], coords[0]], defaultPointStyle)
          if (feature.properties) {
            const content = Object.entries(feature.properties)
              .map(([k, v]) => `<strong>${k}:</strong> ${v}`).join('<br/>')
            marker.bindPopup(content)
          }
          pointLayer.addLayer(marker)
          return marker
        },
        (current, total) => {
          renderProgress.value = 50 + Math.round((current / total) * 50)
        }
      )
    }
  }

  layerRegistry.value[id] = { clusterGroup, layer: null, nonPointLayer }
  isLoading.value = false
  renderProgress.value = 100
}

const addAllLayers = async (layers) => {
  for (const layer of layers) {
    await addSingleLayer(layer)
  }

  const allBounds = L.latLngBounds()
  layers.forEach(layer => {
    const geojson = layer.geojson
    if (geojson.type === 'FeatureCollection' && geojson.features.length > 0) {
      geojson.features.forEach(f => {
        if (f.geometry && f.geometry.type === 'Point') {
          const coords = f.geometry.coordinates
          allBounds.extend([coords[1], coords[0]])
        }
      })
    }
  })

  if (allBounds.isValid()) {
    map.fitBounds(allBounds, { padding: [50, 50], maxZoom: 10 })
  }
}

const switchBasemap = (id) => {
  if (id === currentBasemap) return
  Object.values(basemaps).forEach(layer => { if (map.hasLayer(layer)) map.removeLayer(layer) })
  basemaps[id].addTo(map)
  currentBasemap = id
  emit('basemap-change', id)
}

const toggleEditMode = (enable) => {
  if (drawControl) {
    map.removeControl(drawControl)
    drawControl = null
  }
  if (enable && map) {
    map.addLayer(drawnItems)
    drawControl = new L.Control.Draw({
      draw: {
        polyline: true,
        polygon: true,
        circle: false,
        rectangle: true,
        marker: true,
        circlemarker: false
      },
      edit: { featureGroup: drawnItems, remove: true }
    })
    map.addControl(drawControl)

    map.on(L.Draw.Event.CREATED, (e) => {
      drawnItems.addLayer(e.layer)
      emit('features-updated', L.geoJSON(drawnItems))
    })
    map.on(L.Draw.Event.EDITED, () => {
      emit('features-updated', L.geoJSON(drawnItems))
    })
    map.on(L.Draw.Event.DELETED, () => {
      emit('features-updated', L.geoJSON(drawnItems))
    })
  }
}

// Debounced layer update
let layerUpdateTimeout = null
watch(() => props.layers, (newLayers) => {
  if (!map) return

  if (layerUpdateTimeout) clearTimeout(layerUpdateTimeout)
  layerUpdateTimeout = setTimeout(() => {
    const oldIds = Object.keys(layerRegistry.value).map(Number)
    const newIds = newLayers.map(l => l.id)
    oldIds.forEach(id => { if (!newIds.includes(id)) removeLayerFromMap(id) })
    newLayers.forEach(layer => addSingleLayer(layer))
  }, 100)
}, { deep: true })

watch(() => props.editMode, (newVal) => {
  toggleEditMode(newVal)
})

// Viewport update on map move
let viewportTimeout = null
const updateViewport = () => {
  if (viewportTimeout) clearTimeout(viewportTimeout)
  viewportTimeout = setTimeout(() => {
    // Re-render layers with viewport clipping if needed
    props.layers.forEach(layer => {
      const features = layer.geojson.type === 'FeatureCollection'
        ? layer.geojson.features
        : [layer.geojson]

      if (features.length > 1000) {
        addSingleLayer(layer)
      }
    })
  }, 300)
}

onMounted(() => {
  if (!mapContainer.value) return

  map = L.map(mapContainer.value, {
    preferCanvas: true,
    renderer: L.canvas()
  }).setView([35.8617, 104.1954], 3)

  basemaps[currentBasemap].addTo(map)

  map.on('moveend zoomend', updateViewport)

  addAllLayers(props.layers)
  emit('map-ready', { map, switchBasemap })
})

provide('map', map)
</script>

<template>
  <div class="map-wrapper">
    <div class="map-container">
      <div ref="mapContainer" class="map-viewer"></div>

      <!-- Loading indicator -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-content">
          <div class="spinner"></div>
          <p>正在渲染数据... {{ renderProgress }}%</p>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: renderProgress + '%' }"></div>
          </div>
        </div>
      </div>

      <div class="basemap-switcher">
        <button
          v-for="bm in [
            { id: 'osm', label: '🗺️ OSM' },
            { id: 'carto_light', label: '☀️ 浅色' },
            { id: 'carto_dark', label: '🌙 深色' },
            { id: 'esri', label: '🛰️ 影像' },
            { id: 'esri_topo', label: '⛰️ 地形' }
          ]"
          :key="bm.id"
          class="basemap-btn"
          :class="{ active: currentBasemap === bm.id }"
          @click="switchBasemap(bm.id)"
        >
          {{ bm.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
}

.map-container {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
}

.map-viewer {
  height: 500px;
  width: 100%;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-content {
  text-align: center;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #e2e8f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 15px;
}

.progress-bar {
  width: 200px;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 10px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 0.3s ease;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.basemap-switcher {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: white;
  padding: 6px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.basemap-btn {
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  color: #4a5568;
  white-space: nowrap;
  transition: all 0.2s;
}

.basemap-btn:hover {
  background: #f7fafc;
}

.basemap-btn.active {
  background: #ebf4ff;
  border-color: #667eea;
  color: #667eea;
  font-weight: 600;
}
</style>

<style>
.cluster-wrapper {
  background: none !important;
  border: none !important;
}

.cluster-circle {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.3);
  position: relative;
}

.cluster-circle::before {
  content: '';
  position: absolute;
  top: 4px;
  left: 15%;
  width: 70%;
  height: 30%;
  background: linear-gradient(to bottom, rgba(255,255,255,0.4), transparent);
  border-radius: 50%;
}

.cluster-count {
  position: relative;
  z-index: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
</style>
