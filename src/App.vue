<script setup>
import { ref, computed } from 'vue'
import FileUploader from './components/FileUploader.vue'
import MapViewer from './components/MapViewer.vue'
import LayerPanel from './components/LayerPanel.vue'
import ExportPanel from './components/ExportPanel.vue'
import AttributeTable from './components/AttributeTable.vue'
import StylePanel from './components/StylePanel.vue'

const layers = ref([])
let layerIdCounter = 0
const editMode = ref(false)

const layerList = computed(() => {
  return [...layers.value].reverse().map((layer, reversedIndex) => ({
    ...layer,
    displayIndex: layers.value.length - reversedIndex
  }))
})

const selectedLayerId = ref(null)
const selectedLayer = computed(() => {
  return layers.value.find(l => l.id === selectedLayerId.value) || null
})

const showExportPanel = ref(false)
const showStylePanel = ref(false)
const showAttrPanel = ref(false)

const handleFileLoaded = (data, properties, fileName) => {
  layerIdCounter++
  const colors = ['#667eea', '#e53e3e', '#38a169', '#d69e2e', '#805ad5', '#dd6b20', '#3182ce', '#e53e3e']
  const color = colors[layers.value.length % colors.length]
  
  const newLayer = {
    id: layerIdCounter,
    name: fileName,
    geojson: data,
    properties,
    color,
    visible: true,
    opacity: 1,
    pointCount: data.type === 'FeatureCollection' 
      ? data.features.filter(f => f.geometry && f.geometry.type === 'Point').length 
      : 0,
    featureCount: data.type === 'FeatureCollection' ? data.features.length : 1
  }
  
  layers.value.push(newLayer)
  selectedLayerId.value = newLayer.id
}

const toggleLayerVisibility = (id) => {
  const layer = layers.value.find(l => l.id === id)
  if (layer) layer.visible = !layer.visible
}

const removeLayer = (id) => {
  layers.value = layers.value.filter(l => l.id !== id)
  if (selectedLayerId.value === id) {
    selectedLayerId.value = layers.value.length > 0 ? layers.value[layers.value.length - 1].id : null
  }
}

const changeLayerOpacity = (id, opacity) => {
  const layer = layers.value.find(l => l.id === id)
  if (layer) layer.opacity = opacity
}

const moveLayerUp = (id) => {
  const index = layers.value.findIndex(l => l.id === id)
  if (index < layers.value.length - 1) {
    ;[layers.value[index], layers.value[index + 1]] = [layers.value[index + 1], layers.value[index]]
  }
}

const moveLayerDown = (id) => {
  const index = layers.value.findIndex(l => l.id === id)
  if (index > 0) {
    ;[layers.value[index], layers.value[index - 1]] = [layers.value[index - 1], layers.value[index]]
  }
}

const handleExportLayer = (id) => {
  selectedLayerId.value = id
  showExportPanel.value = true
  showStylePanel.value = false
  showAttrPanel.value = false
}

const handleStyleChange = (layerId, style) => {
  const layer = layers.value.find(l => l.id === layerId)
  if (layer) {
    layer.style = { ...layer.style, ...style }
  }
}

const handleStyleLayer = (id) => {
  selectedLayerId.value = id
  showStylePanel.value = true
  showExportPanel.value = false
  showAttrPanel.value = false
}

const handleAttrLayer = (id) => {
  selectedLayerId.value = id
  showAttrPanel.value = true
  showStylePanel.value = false
  showExportPanel.value = false
}

const toggleEditMode = () => {
  editMode.value = !editMode.value
}

const clearAllLayers = () => {
  layers.value = []
  selectedLayerId.value = null
  showExportPanel.value = false
  showStylePanel.value = false
  showAttrPanel.value = false
  layerIdCounter = 0
}
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>🗺️ GIS 数据可视化预览器</h1>
      <p class="subtitle">支持 GeoJSON / SHP / KML 文件预览、叠加与格式转换</p>
      <div class="header-actions">
        <button class="btn-action" :class="{ active: editMode }" @click="toggleEditMode">
          {{ editMode ? '✏️ 编辑中' : '✏️ 编辑模式' }}
        </button>
      </div>
    </header>

    <main class="app-main">
      <div class="top-section">
        <FileUploader @file-loaded="handleFileLoaded" />

        <div class="side-panel">
          <LayerPanel
            v-if="layers.length > 0"
            :layers="layerList"
            :selected-id="selectedLayerId"
            @select-layer="selectedLayerId = $event"
            @toggle-visibility="toggleLayerVisibility"
            @remove-layer="removeLayer"
            @change-opacity="changeLayerOpacity"
            @move-up="moveLayerUp"
            @move-down="moveLayerDown"
            @export-layer="handleExportLayer"
            @style-layer="handleStyleLayer"
            @attr-layer="handleAttrLayer"
            @clear-all="clearAllLayers"
          />

          <ExportPanel
            v-if="showExportPanel && selectedLayer"
            :layer="selectedLayer"
            @close="showExportPanel = false"
          />

          <StylePanel
            v-if="showStylePanel && selectedLayer"
            :layer="selectedLayer"
            @style-change="handleStyleChange"
            @close="showStylePanel = false"
          />
        </div>
      </div>

      <div v-if="layers.length > 0" class="viewer-section">
        <MapViewer :layers="layers" :edit-mode="editMode" />
        <AttributeTable
          v-if="showAttrPanel && selectedLayer"
          :layer="selectedLayer"
        />
      </div>
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f5f7fa;
  color: #333;
}

.app-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
}

.app-header h1 {
  font-size: 1.3rem;
  white-space: nowrap;
}

.subtitle {
  font-size: 0.85rem;
  opacity: 0.85;
  display: none;
}

.header-actions {
  position: static;
  transform: none;
  display: flex;
  gap: 8px;
}

.btn-action {
  padding: 6px 16px;
  background: white;
  color: #667eea;
  border: none;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-action:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
}

.btn-action.active {
  background: #48bb78;
  color: white;
}

.app-main {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.top-section {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

@media (max-width: 900px) {
  .top-section {
    grid-template-columns: 1fr;
  }
}

.viewer-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
</style>
