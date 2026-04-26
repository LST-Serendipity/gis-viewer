<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  layer: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['style-change', 'close'])

const color = ref('#667eea')
const pointRadius = ref(7)
const lineWidth = ref(2)
const fillColor = ref('#667eea')
const fillOpacity = ref(30)
const strokeOpacity = ref(100)

watch(() => props.layer?.id, () => {
  if (props.layer) {
    color.value = props.layer.color || '#667eea'
    fillColor.value = props.layer.color || '#667eea'
  }
})

const emitStyleChange = () => {
  if (!props.layer) return
  emit('style-change', props.layer.id, {
    color: color.value,
    pointRadius: pointRadius.value,
    lineWidth: lineWidth.value,
    fillColor: fillColor.value,
    fillOpacity: fillOpacity.value / 100,
    strokeOpacity: strokeOpacity.value / 100
  })
}

const presets = [
  { name: '蓝色', color: '#3182ce', fill: '#3182ce' },
  { name: '紫色', color: '#667eea', fill: '#667eea' },
  { name: '红色', color: '#e53e3e', fill: '#e53e3e' },
  { name: '绿色', color: '#38a169', fill: '#38a169' },
  { name: '橙色', color: '#dd6b20', fill: '#dd6b20' },
  { name: '深蓝', color: '#2c5282', fill: '#2c5282' }
]

const applyPreset = (preset) => {
  color.value = preset.color
  fillColor.value = preset.fill
  emitStyleChange()
}
</script>

<template>
  <div v-if="layer" class="style-panel">
    <div class="panel-header">
      <h3>🎨 图层样式</h3>
      <button class="btn-close" @click="emit('close')">✕</button>
    </div>

    <div class="panel-body">
      <div class="style-section">
        <label>预设配色</label>
        <div class="preset-grid">
          <button
            v-for="preset in presets"
            :key="preset.name"
            class="preset-btn"
            :class="{ active: color === preset.color }"
            @click="applyPreset(preset)"
          >
            <span class="preset-dot" :style="{ background: preset.color }"></span>
            <span>{{ preset.name }}</span>
          </button>
        </div>
      </div>

      <div class="style-section">
        <label>边框颜色</label>
        <div class="color-input">
          <input type="color" v-model="color" @change="emitStyleChange" />
          <input type="text" v-model="color" @change="emitStyleChange" />
        </div>
      </div>

      <div class="style-section">
        <label>填充颜色</label>
        <div class="color-input">
          <input type="color" v-model="fillColor" @change="emitStyleChange" />
          <input type="text" v-model="fillColor" @change="emitStyleChange" />
        </div>
      </div>

      <div class="style-section">
        <label>点半径: {{ pointRadius }}px</label>
        <input type="range" min="3" max="20" v-model.number="pointRadius" @input="emitStyleChange" />
      </div>

      <div class="style-section">
        <label>线宽度: {{ lineWidth }}px</label>
        <input type="range" min="1" max="10" v-model.number="lineWidth" @input="emitStyleChange" />
      </div>

      <div class="style-section">
        <label>填充透明度: {{ fillOpacity }}%</label>
        <input type="range" min="0" max="100" v-model.number="fillOpacity" @input="emitStyleChange" />
      </div>

      <div class="style-section">
        <label>边框透明度: {{ strokeOpacity }}%</label>
        <input type="range" min="0" max="100" v-model.number="strokeOpacity" @input="emitStyleChange" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.style-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.panel-header {
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  background: #fafafa;
}

.panel-header h3 {
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

.panel-body {
  padding: 15px 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-height: 500px;
  overflow-y: auto;
}

.style-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.style-section label {
  font-size: 0.85rem;
  color: #4a5568;
  font-weight: 500;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.preset-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border: 2px solid #e2e8f0;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.75rem;
  color: #718096;
  transition: all 0.2s;
}

.preset-btn:hover {
  border-color: #cbd5e0;
}

.preset-btn.active {
  border-color: #667eea;
  background: #ebf4ff;
  color: #667eea;
}

.preset-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.color-input {
  display: flex;
  gap: 10px;
  align-items: center;
}

.color-input input[type="color"] {
  width: 40px;
  height: 32px;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  padding: 2px;
}

.color-input input[type="text"] {
  flex: 1;
  padding: 6px 10px;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.85rem;
  font-family: monospace;
}

input[type="range"] {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  background: #e2e8f0;
  border-radius: 3px;
  outline: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #667eea;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
</style>
