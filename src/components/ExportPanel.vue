<script setup>
import { ref } from 'vue'
import { exportGeoJSON, exportKML, exportShapefile } from '../utils/export'

const props = defineProps({
  layer: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

const isExporting = ref(false)
const exportFormat = ref('geojson')

const formats = [
  { value: 'geojson', label: 'GeoJSON', icon: '📄', desc: '通用地理数据格式' },
  { value: 'kml', label: 'KML', icon: '🌐', desc: 'Google Earth 格式' },
  { value: 'shp', label: 'Shapefile', icon: '📦', desc: 'ESRI Shapefile (zip)' }
]

const handleExport = async () => {
  if (!props.layer) return

  isExporting.value = true
  try {
    const fileName = props.layer.name

    switch (exportFormat.value) {
      case 'geojson':
        exportGeoJSON(props.layer.geojson, fileName)
        break
      case 'kml':
        exportKML(props.layer.geojson, fileName)
        break
      case 'shp':
        await exportShapefile(props.layer.geojson, fileName)
        break
    }
  } catch (error) {
    console.error('导出失败:', error)
    alert('导出失败: ' + error.message)
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <div class="export-panel">
    <div class="export-header">
      <h3>📥 导出图层</h3>
      <button class="btn-close" @click="emit('close')">✕</button>
    </div>

    <div class="export-body">
      <div class="layer-name">
        <span>当前图层：</span>
        <strong>{{ layer?.name || '未选择' }}</strong>
      </div>

      <div class="format-grid">
        <label
          v-for="format in formats"
          :key="format.value"
          class="format-option"
          :class="{ active: exportFormat === format.value }"
        >
          <input
            type="radio"
            :value="format.value"
            v-model="exportFormat"
            hidden
          />
          <span class="format-icon">{{ format.icon }}</span>
          <span class="format-label">{{ format.label }}</span>
          <span class="format-desc">{{ format.desc }}</span>
        </label>
      </div>

      <button
        class="btn-export"
        :disabled="isExporting || !layer"
        @click="handleExport"
      >
        <span v-if="isExporting">导出中...</span>
        <span v-else>导出 {{ formats.find(f => f.value === exportFormat)?.label }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.export-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.export-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  background: #fafafa;
}

.export-header h3 {
  font-size: 1rem;
  color: #444;
}

.btn-close {
  width: 28px;
  height: 28px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-close:hover {
  background: #fff5f5;
  border-color: #fc8181;
  color: #e53e3e;
}

.export-body {
  padding: 20px;
}

.layer-name {
  font-size: 0.85rem;
  color: #718096;
  margin-bottom: 20px;
  padding: 10px;
  background: #f7fafc;
  border-radius: 8px;
}

.layer-name strong {
  color: #4a5568;
}

.format-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.format-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 15px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.format-option:hover {
  border-color: #cbd5e0;
  background: #f7fafc;
}

.format-option.active {
  border-color: #667eea;
  background: #ebf4ff;
}

.format-icon {
  font-size: 1.3rem;
}

.format-label {
  font-weight: 600;
  color: #4a5568;
  min-width: 80px;
}

.format-desc {
  font-size: 0.8rem;
  color: #a0aec0;
}

.btn-export {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.btn-export:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.btn-export:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
