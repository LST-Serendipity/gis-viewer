// Web Worker for GeoJSON processing

// Douglas-Peucker simplification algorithm
function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return points

  const sqTolerance = tolerance * tolerance

  function getSqDist(p1, p2) {
    const dx = p1[0] - p2[0]
    const dy = p1[1] - p2[1]
    return dx * dx + dy * dy
  }

  function getSqSegDist(p, p1, p2) {
    let x = p1[0]
    let y = p1[1]
    let dx = p2[0] - x
    let dy = p2[1] - y

    if (dx !== 0 || dy !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)
      if (t > 1) {
        x = p2[0]
        y = p2[1]
      } else if (t > 0) {
        x += dx * t
        y += dy * t
      }
    }

    dx = p[0] - x
    dy = p[1] - y
    return dx * dx + dy * dy
  }

  function simplifyDPStep(points, first, last, sqTolerance, simplified) {
    let maxSqDist = sqTolerance
    let index

    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqSegDist(points[i], points[first], points[last])
      if (sqDist > maxSqDist) {
        index = i
        maxSqDist = sqDist
      }
    }

    if (maxSqDist > sqTolerance) {
      if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified)
      simplified.push(points[index])
      if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified)
    }
  }

  const simplified = [points[0]]
  simplifyDPStep(points, 0, points.length - 1, sqTolerance, simplified)
  simplified.push(points[points.length - 1])
  return simplified
}

// Simplify geometry based on zoom level
function simplifyGeometry(geometry, zoom) {
  const tolerance = Math.max(0.0001, 0.01 / Math.pow(2, zoom - 10))

  switch (geometry.type) {
    case 'LineString':
      return {
        ...geometry,
        coordinates: douglasPeucker(geometry.coordinates, tolerance)
      }
    case 'MultiLineString':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map(line => douglasPeucker(line, tolerance))
      }
    case 'Polygon':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map(ring => douglasPeucker(ring, tolerance))
      }
    case 'MultiPolygon':
      return {
        ...geometry,
        coordinates: geometry.coordinates.map(poly =>
          poly.map(ring => douglasPeucker(ring, tolerance))
        )
      }
    default:
      return geometry
  }
}

// Process features in chunks
function processFeaturesChunked(features, chunkSize, callback) {
  let index = 0
  const results = []

  function processChunk() {
    const chunk = features.slice(index, index + chunkSize)
    if (chunk.length === 0) {
      callback(results)
      return
    }

    results.push(...chunk)
    index += chunkSize

    // Schedule next chunk
    setTimeout(processChunk, 0)
  }

  processChunk()
}

// Calculate bounds for features
function calculateBounds(features) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  features.forEach(f => {
    const geom = f.geometry
    if (!geom) return

    const coords = geom.coordinates
    if (geom.type === 'Point') {
      minX = Math.min(minX, coords[0])
      minY = Math.min(minY, coords[1])
      maxX = Math.max(maxX, coords[0])
      maxY = Math.max(maxY, coords[1])
    } else if (geom.type === 'MultiPoint' || geom.type === 'LineString') {
      coords.forEach(([x, y]) => {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      })
    } else if (geom.type === 'Polygon') {
      coords[0].forEach(([x, y]) => {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      })
    }
  })

  return { minX, minY, maxX, maxY }
}

// Spatial index for fast querying
function buildSpatialIndex(features) {
  const gridSize = 100
  const bounds = calculateBounds(features)
  const cellWidth = (bounds.maxX - bounds.minX) / gridSize || 1
  const cellHeight = (bounds.maxY - bounds.minY) / gridSize || 1
  const grid = new Map()

  features.forEach((f, idx) => {
    const geom = f.geometry
    if (!geom) return

    let coords
    if (geom.type === 'Point') coords = [geom.coordinates]
    else if (geom.type === 'LineString' || geom.type === 'MultiPoint') coords = geom.coordinates
    else if (geom.type === 'Polygon') coords = geom.coordinates[0]
    else return

    const seenCells = new Set()
    coords.forEach(([x, y]) => {
      const cellX = Math.floor((x - bounds.minX) / cellWidth)
      const cellY = Math.floor((y - bounds.minY) / cellHeight)
      const key = `${cellX},${cellY}`

      if (!seenCells.has(key)) {
        seenCells.add(key)
        if (!grid.has(key)) grid.set(key, [])
        grid.get(key).push(idx)
      }
    })
  })

  return { grid, bounds, cellWidth, cellHeight }
}

// Query features in viewport
function queryViewport(index, viewport) {
  const { grid, bounds, cellWidth, cellHeight } = index
  const { minX, minY, maxX, maxY } = viewport

  const startX = Math.floor((minX - bounds.minX) / cellWidth)
  const endX = Math.floor((maxX - bounds.minX) / cellWidth)
  const startY = Math.floor((minY - bounds.minY) / cellHeight)
  const endY = Math.floor((maxY - bounds.minY) / cellHeight)

  const results = new Set()
  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      const key = `${x},${y}`
      const cell = grid.get(key)
      if (cell) cell.forEach(idx => results.add(idx))
    }
  }

  return Array.from(results)
}

// Main message handler
self.onmessage = function(e) {
  const { type, data, id } = e.data

  switch (type) {
    case 'simplify': {
      const { geometry, zoom } = data
      const simplified = simplifyGeometry(geometry, zoom)
      self.postMessage({ type: 'simplified', id, result: simplified })
      break
    }

    case 'buildIndex': {
      const { features } = data
      const index = buildSpatialIndex(features)
      self.postMessage({ type: 'indexBuilt', id, result: index })
      break
    }

    case 'queryViewport': {
      const { index, viewport } = data
      const indices = queryViewport(index, viewport)
      self.postMessage({ type: 'viewportQueried', id, result: indices })
      break
    }

    case 'processChunked': {
      const { features, chunkSize } = data
      processFeaturesChunked(features, chunkSize, (results) => {
        self.postMessage({ type: 'chunkedComplete', id, result: results })
      })
      break
    }

    case 'calculateStats': {
      const { features } = data
      const stats = {
        count: features.length,
        byType: {},
        bounds: calculateBounds(features)
      }

      features.forEach(f => {
        const type = f.geometry?.type || 'unknown'
        stats.byType[type] = (stats.byType[type] || 0) + 1
      })

      self.postMessage({ type: 'statsCalculated', id, result: stats })
      break
    }
  }
}
