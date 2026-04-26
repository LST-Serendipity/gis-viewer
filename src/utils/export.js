import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import tokml from 'tokml'

export function exportGeoJSON(geojson, fileName) {
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' })
  const baseName = fileName.replace(/\.[^.]+$/, '')
  saveAs(blob, `${baseName}.geojson`)
}

export function exportKML(geojson, fileName) {
  const kmlString = tokml(geojson)
  const blob = new Blob([kmlString], { type: 'application/vnd.google-earth.kml+xml' })
  const baseName = fileName.replace(/\.[^.]+$/, '')
  saveAs(blob, `${baseName}.kml`)
}

export async function exportShapefile(geojson, fileName) {
  const baseName = fileName.replace(/\.[^.]+$/, '')
  
  try {
    const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson]
    const pointFeatures = features.filter(f => f.geometry?.type === 'Point')
    const lineFeatures = features.filter(f => f.geometry?.type === 'LineString')
    const polygonFeatures = features.filter(f => f.geometry?.type === 'Polygon')

    if (!features.length) {
      throw new Error('没有可导出的要素')
    }

    const zip = new JSZip()

    const processLayer = async (layerFeatures, layerName, shapeType) => {
      if (!layerFeatures.length) return
      const shpBuffer = buildShp(layerFeatures, shapeType)
      const shxBuffer = buildShx(layerFeatures.length)
      const dbfBuffer = buildDbf(layerFeatures)
      const prjContent = buildPrj()

      zip.file(`${layerName}.shp`, shpBuffer)
      zip.file(`${layerName}.shx`, shxBuffer)
      zip.file(`${layerName}.dbf`, dbfBuffer)
      zip.file(`${layerName}.prj`, prjContent)
    }

    await processLayer(pointFeatures, 'points', 1)
    await processLayer(lineFeatures, 'lines', 3)
    await processLayer(polygonFeatures, 'polygons', 5)

    if (!zip.files['points.shp'] && !zip.files['lines.shp'] && !zip.files['polygons.shp']) {
      throw new Error('不支持的几何类型')
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    saveAs(blob, `${baseName}.zip`)
  } catch (error) {
    console.error('Shapefile 导出失败:', error)
    throw new Error('Shapefile 导出失败: ' + error.message)
  }
}

function buildPrj() {
  return 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]'
}

function calcBounds(features) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  features.forEach(f => {
    const coords = f.geometry.coordinates
    if (f.geometry.type === 'Point') {
      minX = Math.min(minX, coords[0])
      minY = Math.min(minY, coords[1])
      maxX = Math.max(maxX, coords[0])
      maxY = Math.max(maxY, coords[1])
    } else {
      flattenCoords(coords).forEach(([x, y]) => {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      })
    }
  })
  return { minX, minY, maxX, maxY }
}

function flattenCoords(coords, result = []) {
  if (typeof coords[0] === 'number') {
    result.push(coords)
  } else {
    coords.forEach(c => flattenCoords(c, result))
  }
  return result
}

function buildShp(features, shapeType) {
  const bounds = calcBounds(features)
  const numFeatures = features.length

  const header = new ArrayBuffer(100)
  const headerView = new DataView(header)
  headerView.setInt32(0, 9994, false)
  for (let i = 1; i < 24; i++) headerView.setInt32(i * 4, 0, false)

  const contentLengths = []
  let totalContentWords = 0

  features.forEach((f, i) => {
    let contentWords
    if (f.geometry.type === 'Point') {
      contentWords = 10
    } else if (f.geometry.type === 'LineString') {
      const numPoints = flattenCoords(f.geometry.coordinates).length
      contentWords = 22 + numPoints * 2
    } else if (f.geometry.type === 'Polygon') {
      const allCoords = flattenCoords(f.geometry.coordinates)
      const numPoints = allCoords.length
      const numParts = f.geometry.coordinates.length
      contentWords = 22 + numPoints * 2 + numParts * 2
    }
    contentLengths.push(contentWords)
    totalContentWords += contentWords + 4
  })

  const fileLength = 50 + totalContentWords
  headerView.setInt32(24, fileLength, false)
  headerView.setInt32(28, 1000, false)
  headerView.setInt32(32, shapeType, true)
  headerView.setFloat64(36, bounds.minX, true)
  headerView.setFloat64(44, bounds.minY, true)
  headerView.setFloat64(52, bounds.maxX, true)
  headerView.setFloat64(60, bounds.maxY, true)

  const totalBytes = 100 + totalContentWords * 4
  const shpBuffer = new ArrayBuffer(totalBytes)
  const shpView = new DataView(shpBuffer)
  const uint8 = new Uint8Array(shpBuffer)
  uint8.set(new Uint8Array(header))

  let offset = 100
  let recordNum = 1

  features.forEach((f, i) => {
    shpView.setInt32(offset, recordNum, false)
    shpView.setInt32(offset + 4, contentLengths[i], false)

    let dataOffset = offset + 8
    shpView.setInt32(dataOffset, shapeType, true)
    dataOffset += 4

    if (f.geometry.type === 'Point') {
      const [x, y] = f.geometry.coordinates
      shpView.setFloat64(dataOffset, x, true)
      shpView.setFloat64(dataOffset + 8, y, true)
      dataOffset += 16
    } else if (f.geometry.type === 'LineString') {
      const allCoords = flattenCoords(f.geometry.coordinates)
      const numPoints = allCoords.length
      const lineBounds = calcBounds([f])

      shpView.setFloat64(dataOffset, lineBounds.minX, true)
      shpView.setFloat64(dataOffset + 8, lineBounds.minY, true)
      shpView.setFloat64(dataOffset + 16, lineBounds.maxX, true)
      shpView.setFloat64(dataOffset + 24, lineBounds.maxY, true)
      dataOffset += 32

      shpView.setInt32(dataOffset, numPoints, true)
      dataOffset += 4
      shpView.setInt32(dataOffset, 1, true)
      dataOffset += 4

      allCoords.forEach(([x, y]) => {
        shpView.setFloat64(dataOffset, x, true)
        dataOffset += 8
        shpView.setFloat64(dataOffset, y, true)
        dataOffset += 8
      })
    } else if (f.geometry.type === 'Polygon') {
      const allCoords = flattenCoords(f.geometry.coordinates)
      const numPoints = allCoords.length
      const numParts = f.geometry.coordinates.length
      const polyBounds = calcBounds([f])

      shpView.setFloat64(dataOffset, polyBounds.minX, true)
      shpView.setFloat64(dataOffset + 8, polyBounds.minY, true)
      shpView.setFloat64(dataOffset + 16, polyBounds.maxX, true)
      shpView.setFloat64(dataOffset + 24, polyBounds.maxY, true)
      dataOffset += 32

      shpView.setInt32(dataOffset, numPoints, true)
      dataOffset += 4
      shpView.setInt32(dataOffset, numParts, true)
      dataOffset += 4

      let pointOffset = 0
      f.geometry.coordinates.forEach(part => {
        shpView.setInt32(dataOffset, pointOffset, true)
        dataOffset += 4
        pointOffset += part.length
      })

      allCoords.forEach(([x, y]) => {
        shpView.setFloat64(dataOffset, x, true)
        dataOffset += 8
        shpView.setFloat64(dataOffset, y, true)
        dataOffset += 8
      })
    }

    offset = dataOffset
    recordNum++
  })

  return shpBuffer
}

function buildShx(numRecords) {
  const header = new ArrayBuffer(100)
  const headerView = new DataView(header)
  headerView.setInt32(0, 9994, false)

  const contentLength = 50 + numRecords * 4
  const fileLength = contentLength
  headerView.setInt32(24, fileLength, false)
  headerView.setInt32(28, 1000, false)

  const totalBytes = 100 + numRecords * 8
  const shxBuffer = new ArrayBuffer(totalBytes)
  const shxView = new DataView(shxBuffer)
  const uint8 = new Uint8Array(shxBuffer)
  uint8.set(new Uint8Array(header))

  let offset = 100
  let shpOffset = 50
  for (let i = 0; i < numRecords; i++) {
    const contentWords = 10
    shxView.setInt32(offset, shpOffset, false)
    shxView.setInt32(offset + 4, contentWords, false)
    shpOffset += 4 + contentWords
    offset += 8
  }

  return shxBuffer
}

function buildDbf(features) {
  if (!features.length) return new ArrayBuffer(0)

  const allProps = features.map(f => f.properties || {})
  const keys = [...new Set(allProps.flatMap(f => Object.keys(f)))].slice(0, 10)

  const headers = keys.map(key => {
    const maxLen = Math.max(1, ...allProps.map(p => String(p[key] ?? '').length))
    return { name: key.slice(0, 10), length: Math.min(Math.max(maxLen, 10), 254), type: 'C' }
  })

  const headerLen = 32 + headers.length * 32 + 1
  const recordLen = headers.reduce((sum, h) => sum + h.length, 0) + 1
  const fileLen = headerLen + features.length * recordLen + 1

  const arr = new ArrayBuffer(fileLen)
  const view = new DataView(arr)

  view.setUint8(0, 0x03)
  view.setUint8(1, 26)
  view.setUint8(2, 7)
  view.setUint8(3, 26)
  view.setUint16(4, features.length, true)
  view.setUint16(8, headerLen, true)
  view.setUint16(10, recordLen, true)

  let offset = 32
  headers.forEach(h => {
    for (let i = 0; i < 11; i++) {
      view.setUint8(offset + i, i < h.name.length ? h.name.charCodeAt(i) : 0)
    }
    view.setUint8(offset + 11, h.type.charCodeAt(0))
    view.setUint8(offset + 16, h.length)
    offset += 32
  })
  view.setUint8(offset, 0x0D)
  offset++

  features.forEach(f => {
    view.setUint8(offset, 0x20)
    offset++
    headers.forEach(h => {
      const val = String(f.properties?.[h.name] ?? '')
      for (let i = 0; i < h.length; i++) {
        view.setUint8(offset + i, i < val.length ? val.charCodeAt(i) : 0x20)
      }
      offset += h.length
    })
  })

  view.setUint8(offset, 0x1A)
  return arr
}
