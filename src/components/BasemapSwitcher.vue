<script setup>
import L from 'leaflet'

const props = defineProps({
  map: { type: Object, required: true },
  currentBasemap: { type: String, default: 'osm' }
})

const emit = defineEmits(['change-basemap'])

const basemaps = [
  { id: 'osm', name: 'OpenStreetMap', icon: '🗺️' },
  { id: 'carto-light', name: 'Carto 浅色', icon: '☀️' },
  { id: 'carto-dark', name: 'Carto 深色', icon: '🌙' },
  { id: 'esri', name: 'Esri 影像', icon: '🛰️' },
  { id: 'esri-topo', name: 'Esri 地形', icon: '⛰️' }
]

const tileLayers = {
  'osm': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }),
  'carto-light': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© CartoDB',
    maxZoom: 19
  }),
  'carto-dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© CartoDB',
    maxZoom: 19
  }),
  'esri': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri',
    maxZoom: 18
  }),
  'esri-topo': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: '© Esri',
    maxZoom: 17
  })
}

const switchBasemap = (id) => {
  if (id === props.currentBasemap) return
  
  Object.values(tileLayers).forEach(layer => {
    if (props.map.hasLayer(layer)) {
      props.map.removeLayer(layer)
    }
  })
  
  tileLayers[id].addTo(props.map)
  emit('change-basemap', id)
}
</script>

<template>
  <div class="basemap-switcher">
    <div
      v-for="basemap in basemaps"
      :key="basemap.id"
      class="basemap-item"
      :class="{ active: currentBasemap === basemap.id }"
      @click="switchBasemap(basemap.id)"
      :title="basemap.name"
    >
      <span class="basemap-icon">{{ basemap.icon }}</span>
      <span class="basemap-name">{{ basemap.name }}</span>
    </div>
  </div>
</template>

<style scoped>
.basemap-switcher {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.basemap-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  color: #4a5568;
  transition: all 0.2s;
}

.basemap-item:hover {
  background: #f7fafc;
}

.basemap-item.active {
  background: #ebf4ff;
  color: #667eea;
  font-weight: 600;
}

.basemap-icon {
  font-size: 1rem;
}

.basemap-name {
  white-space: nowrap;
}
</style>
