<script setup>
import { ref } from 'vue'
import getShapefile from 'shpjs'
import { kml } from '@tmcw/togeojson'
import { DOMParser } from '@xmldom/xmldom'

const emit = defineEmits(['file-loaded'])
const isDragging = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')

const supportedFormats = ['GeoJSON (.geojson, .json)', 'Shapefile (.zip 或 .shp+.shx+.dbf)', 'KML (.kml)']

const handleDrop = async (e) => {
  e.preventDefault()
  isDragging.value = false
  const files = e.dataTransfer.files
  if (files.length > 0) {
    await processFiles(files)
  }
}

const handleFileSelect = async (e) => {
  const files = e.target.files
  if (files.length > 0) {
    await processFiles(files)
  }
  e.target.value = ''
}

const processFiles = async (files) => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const fileArray = Array.from(files)
    const fileNames = fileArray.map(f => f.name.toLowerCase())

    // Check for ZIP (shapefile in zip format)
    if (fileNames.some(n => n.endsWith('.zip'))) {
      await processShapefileZip(fileArray.find(f => f.name.toLowerCase().endsWith('.zip')))
    }
    // Check for SHP files
    else if (fileNames.some(n => n.endsWith('.shp'))) {
      await processShapefileMultiple(fileArray)
    }
    // Check for GeoJSON
    else if (fileNames.some(n => n.endsWith('.geojson') || n.endsWith('.json'))) {
      await processGeoJSON(fileArray.find(f => {
        const name = f.name.toLowerCase()
        return name.endsWith('.geojson') || name.endsWith('.json')
      }))
    }
    // Check for KML
    else if (fileNames.some(n => n.endsWith('.kml') || n.endsWith('.xml'))) {
      const kmlFile = fileArray.find(f => {
        const name = f.name.toLowerCase()
        return name.endsWith('.kml') || name.endsWith('.xml')
      })
      await processKML(kmlFile)
    }
    else {
      errorMessage.value = '不支持的文件格式，请上传 GeoJSON、SHP 或 KML 文件'
    }
  } catch (error) {
    console.error('文件处理错误:', error)
    errorMessage.value = '文件解析失败: ' + (error.message || '未知错误')
  } finally {
    isLoading.value = false
  }
}

const processGeoJSON = async (file) => {
  const text = await file.text()
  const data = JSON.parse(text)
  validateGeoJSON(data)
  const properties = getFileProperties(data)
  emit('file-loaded', data, properties, file.name)
}

const processShapefileZip = async (file) => {
  const arrayBuffer = await file.arrayBuffer()
  const geojson = await getShapefile(arrayBuffer)
  
  const geojsonCollection = normalizeToFeatureCollection(geojson)
  const properties = getFileProperties(geojsonCollection)
  emit('file-loaded', geojsonCollection, properties, file.name)
}

const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200MB

const processShapefileMultiple = async (files) => {
  const shpFile = files.find(f => f.name.toLowerCase().endsWith('.shp'))
  const dbfFile = files.find(f => f.name.toLowerCase().endsWith('.dbf'))
  const prjFile = files.find(f => f.name.toLowerCase().endsWith('.prj'))
  
  if (!shpFile) throw new Error('未找到 .shp 文件，请同时选择 .shp、.dbf 和 .prj 文件')
 
  if (shpFile.size > MAX_FILE_SIZE) {
    throw new Error(`SHP 文件过大 (${(shpFile.size / 1024 / 1024).toFixed(1)}MB)，浏览器无法处理。建议：使用 zip 压缩后上传，或使用专业 GIS 软件处理。`)
  }
  if (dbfFile && dbfFile.size > MAX_FILE_SIZE) {
    throw new Error(`DBF 文件过大 (${(dbfFile.size / 1024 / 1024).toFixed(1)}MB)，建议压缩后上传。`)
  }
 
  console.log('Processing shapefile:', shpFile.name)
  console.log('DBF file:', dbfFile?.name || 'none')
  console.log('PRJ file:', prjFile?.name || 'none')
 
  isLoading.value = true
  const shpBuffer = await shpFile.arrayBuffer()
  const params = { shp: shpBuffer }
  if (dbfFile) params.dbf = await dbfFile.arrayBuffer()
  if (prjFile) params.prj = await prjFile.arrayBuffer()

  console.log('Calling getShapefile with params:', params)
  const geojson = await getShapefile(params)
  console.log('GeoJSON result:', geojson)
  
  const geojsonCollection = normalizeToFeatureCollection(geojson)
  const properties = getFileProperties(geojsonCollection)
  emit('file-loaded', geojsonCollection, properties, shpFile.name)
}

const processKML = async (file) => {
  const text = await file.text()
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(text, 'text/xml')
  const geojson = kml(xmlDoc)
  const properties = getFileProperties(geojson)
  emit('file-loaded', geojson, properties, file.name)
}

const validateGeoJSON = (data) => {
  if (!data.type) {
    throw new Error('无效的 GeoJSON 格式：缺少 type 字段')
  }
  if (!['Feature', 'FeatureCollection', 'Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'].includes(data.type)) {
    throw new Error('无效的 GeoJSON 格式')
  }
}

const normalizeToFeatureCollection = (geojson) => {
  if (geojson.type === 'FeatureCollection') {
    return geojson
  }
  if (geojson.type === 'Feature') {
    return {
      type: 'FeatureCollection',
      features: [geojson]
    }
  }
  // shpjs may return an array of features
  if (Array.isArray(geojson)) {
    return {
      type: 'FeatureCollection',
      features: geojson
    }
  }
  // Single geometry object
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: geojson,
      properties: {}
    }]
  }
}

const getFileProperties = (geojson) => {
  const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson]
  if (features.length === 0) return []

  const propertyKeys = new Set()
  features.forEach(feature => {
    if (feature.properties) {
      Object.keys(feature.properties).forEach(key => propertyKeys.add(key))
    }
  })

  return Array.from(propertyKeys)
}
</script>

<template>
  <div
    class="upload-area"
    :class="{ dragging: isDragging }"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop="handleDrop"
  >
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>正在解析文件...</p>
    </div>
    <div v-else>
      <div class="upload-icon">📁</div>
      <h3>拖拽文件到此处，或点击选择文件</h3>
      <p class="supported-formats">
        支持格式: {{ supportedFormats.join('、') }}
      </p>
      <label class="upload-btn">
        选择文件
        <input
          type="file"
          multiple
          accept=".geojson,.json,.shp,.shx,.dbf,.kml,.xml,.zip"
          @change="handleFileSelect"
          hidden
        />
      </label>
    </div>

    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
  </div>
</template>

<style scoped>
.upload-area {
  background: white;
  border: 3px dashed #cbd5e0;
  border-radius: 16px;
  padding: 50px 30px;
  text-align: center;
  transition: all 0.3s;
  cursor: pointer;
}

.upload-area.dragging {
  border-color: #667eea;
  background: #f0f4ff;
}

.upload-icon {
  font-size: 4rem;
  margin-bottom: 20px;
}

.upload-area h3 {
  font-size: 1.3rem;
  color: #4a5568;
  margin-bottom: 15px;
}

.supported-formats {
  color: #718096;
  margin-bottom: 25px;
  font-size: 0.95rem;
}

.upload-btn {
  display: inline-block;
  padding: 12px 35px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 30px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.upload-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #e2e8f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  color: #e53e3e;
  margin-top: 20px;
  padding: 12px;
  background: #fff5f5;
  border-radius: 8px;
}
</style>
