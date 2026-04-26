<script setup>
defineProps({
  layers: {
    type: Array,
    required: true
  },
  selectedId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits([
  'select-layer',
  'toggle-visibility',
  'remove-layer',
  'change-opacity',
  'move-up',
  'move-down',
  'clear-all',
  'export-layer',
  'style-layer',
  'attr-layer'
])
</script>

<template>
  <div class="layer-panel">
    <div class="panel-header">
      <h3>🗂️ 图层列表</h3>
      <button class="btn-clear" @click="emit('clear-all')">清空</button>
    </div>

    <div class="layer-list">
      <div
        v-for="layer in layers"
        :key="layer.id"
        class="layer-item"
        :class="{ active: selectedId === layer.id }"
        @click="emit('select-layer', layer.id)"
      >
        <div class="layer-info">
          <span class="layer-index">#{{ layer.displayIndex }}</span>
          <span class="layer-color-dot" :style="{ backgroundColor: layer.color }"></span>
          <div class="layer-text">
            <span class="layer-name" :title="layer.name">{{ layer.name }}</span>
            <span class="layer-count">{{ layer.featureCount }} 个要素</span>
          </div>
        </div>

        <div class="layer-actions" @click.stop>
          <button
            class="btn-icon"
            :class="{ disabled: layer.displayIndex >= layers.length }"
            :title="上移"
            @click="emit('move-up', layer.id)"
          >↑</button>
          <button
            class="btn-icon"
            :class="{ disabled: layer.displayIndex <= 1 }"
            :title="下移"
            @click="emit('move-down', layer.id)"
          >↓</button>
          <button
            class="btn-icon"
            :class="{ active: layer.visible }"
            :title="显示/隐藏"
            @click="emit('toggle-visibility', layer.id)"
          >👁️</button>
          <button
            class="btn-icon btn-style-icon"
            :title="样式"
            @click="emit('style-layer', layer.id)"
          >🎨</button>
          <button
            class="btn-icon btn-attr-icon"
            :title="属性表格"
            @click="emit('attr-layer', layer.id)"
          >📊</button>
          <button
            class="btn-icon btn-export-icon"
            :title="导出"
            @click="emit('export-layer', layer.id)"
          >📥</button>
          <button
            class="btn-icon btn-remove"
            :title="移除"
            @click="emit('remove-layer', layer.id)"
          >✕</button>
        </div>

        <div class="layer-opacity" @click.stop>
          <label>透明度</label>
          <input
            type="range"
            min="0"
            max="100"
            :value="layer.opacity * 100"
            @input="emit('change-opacity', layer.id, $event.target.value / 100)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layer-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 400px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  background: #fafafa;
}

.panel-header h3 {
  font-size: 1rem;
  color: #444;
}

.btn-clear {
  padding: 5px 12px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #718096;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clear:hover {
  background: #fff5f5;
  border-color: #fc8181;
  color: #e53e3e;
}

.layer-list {
  overflow-y: auto;
  flex: 1;
}

.layer-item {
  padding: 12px 15px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.2s;
}

.layer-item:hover {
  background: #f7fafc;
}

.layer-item.active {
  background: #ebf4ff;
  border-left: 3px solid #667eea;
}

.layer-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.layer-index {
  font-size: 0.8rem;
  color: #a0aec0;
  font-weight: 600;
  min-width: 24px;
}

.layer-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.layer-text {
  flex: 1;
  min-width: 0;
}

.layer-name {
  display: block;
  font-size: 0.9rem;
  color: #4a5568;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.layer-count {
  display: block;
  font-size: 0.75rem;
  color: #a0aec0;
}

.layer-actions {
  display: flex;
  gap: 5px;
  margin-top: 8px;
  padding-left: 34px;
}

.btn-icon {
  width: 28px;
  height: 28px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: #edf2f7;
}

.btn-icon.active {
  background: #667eea;
  border-color: #667eea;
}

.btn-icon.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-remove:hover {
  background: #fff5f5;
  border-color: #fc8181;
  color: #e53e3e;
}

.btn-export-icon:hover {
  background: #ebf4ff;
  border-color: #667eea;
}

.btn-style-icon:hover {
  background: #fef3cd;
  border-color: #d69e2e;
}

.btn-attr-icon:hover {
  background: #e6fffa;
  border-color: #38a169;
}

.layer-opacity {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-left: 34px;
  font-size: 0.8rem;
  color: #718096;
}

.layer-opacity input[type="range"] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  background: #e2e8f0;
  border-radius: 2px;
  outline: none;
}

.layer-opacity input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #667eea;
  cursor: pointer;
}
</style>
