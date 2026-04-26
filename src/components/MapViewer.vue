<script setup>
import { ref, onMounted, watch, provide } from 'vue'
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

const CLUSTER_THRESHOLD = 20

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
const layerRegistry = ref({})
const drawnItems = new L.FeatureGroup()

const countPointFeatures = (geojsonData) => {
  const features = geojsonData.type === 'FeatureCollection' ? geojsonData.features : [geojsonData]
  return features.filter(f => f.geometry && f.geometry.type === 'Point').length
}

const getClusterRadius = (count) => {
  if (count > 1000) return 60
  if (count > 500) return 55
  if (count > 100) return 50
  if (count > 50) return 45
  if (count > 10) return 40
  return 35
}

const applyStyleToLayer = (layer, style, layerData) => {
  if (layer instanceof L.CircleMarker) {
    layer.setStyle({
      radius: style?.pointRadius || layerData?.pointRadius || 7,
      fillColor: style?.fillColor || layerData?.color || '#667eea',
      color: style?.color || layerData?.color || '#667eea',
      weight: style?.lineWidth || layerData?.lineWidth || 2,
      fillOpacity: (style?.fillOpacity ?? 0.9) * (layerData?.opacity ?? 1),
      opacity: (style?.strokeOpacity ?? 1) * (layerData?.opacity ?? 1)
    })
  } else if (layer instanceof L.Path) {
    layer.setStyle({
      color: style?.color || layerData?.color || '#667eea',
      weight: style?.lineWidth || layerData?.lineWidth || 2,
      fillColor: style?.fillColor || layerData?.color || '#667eea',
      fillOpacity: (style?.fillOpacity ?? 0.2) * (layerData?.opacity ?? 1),
      opacity: (style?.strokeOpacity ?? 1) * (layerData?.opacity ?? 1)
    })
  }
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

const addSingleLayer = (layerData) => {
  const { id, geojson, color, visible, opacity, style } = layerData
  const pointCount = countPointFeatures(geojson)
  const useCluster = pointCount >= CLUSTER_THRESHOLD

  removeLayerFromMap(id)
  if (!visible) {
    layerRegistry.value[id] = { clusterGroup: null, layer: null, nonPointLayer: null }
    return
  }

  const nonPointGeoJSON = {
    type: 'FeatureCollection',
    features: (geojson.type === 'FeatureCollection' ? geojson.features : [geojson])
      .filter(f => f.geometry && f.geometry.type !== 'Point')
  }

  let geojsonLayer
  let clusterGroup = null
  let nonPointLayer = null

  const defaultPointStyle = {
    radius: style?.pointRadius || 7,
    fillColor: style?.fillColor || color,
    color: style?.color || color,
    weight: style?.lineWidth || 2,
    fillOpacity: (style?.fillOpacity ?? 0.9) * opacity,
    opacity: (style?.strokeOpacity ?? 1) * opacity
  }

  const defaultLineStyle = {
    color: style?.color || color,
    weight: style?.lineWidth || 2,
    fillColor: style?.fillColor || color,
    fillOpacity: (style?.fillOpacity ?? 0.2) * opacity,
    opacity: (style?.strokeOpacity ?? 1) * opacity
  }

  if (useCluster) {
    clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      spiderfyDistanceMultiplier: 1.5,
      animate: true,
      animateAddingMarkers: true,
      disableClusteringAtZoom: 15,
      iconCreateFunction: function(cluster) {
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

    geojsonLayer = L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, defaultPointStyle),
      style: defaultLineStyle,
      onEachFeature: (feature, layer) => {
        if (feature.properties && Object.keys(feature.properties).length > 0) {
          const content = Object.entries(feature.properties)
            .map(([k, v]) => `<strong>${k}:</strong> ${v}`).join('<br/>')
          layer.bindPopup(content)
        }
        applyStyleToLayer(layer, style, { color, opacity })
      }
    })

    geojsonLayer.eachLayer(layer => {
      if (layer instanceof L.CircleMarker) clusterGroup.addLayer(layer)
    })

    if (nonPointGeoJSON.features.length > 0) {
      nonPointLayer = L.geoJSON(nonPointGeoJSON, {
        style: defaultLineStyle,
        onEachFeature: (feature, layer) => {
          if (feature.properties && Object.keys(feature.properties).length > 0) {
            const content = Object.entries(feature.properties)
              .map(([k, v]) => `<strong>${k}:</strong> ${v}`).join('<br/>')
            layer.bindPopup(content)
          }
        }
      }).addTo(map)
    }

    clusterGroup.addTo(map)
  } else {
    geojsonLayer = L.geoJSON(geojson, {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, defaultPointStyle),
      style: defaultLineStyle,
      onEachFeature: (feature, layer) => {
        if (feature.properties && Object.keys(feature.properties).length > 0) {
          const content = Object.entries(feature.properties)
            .map(([k, v]) => `<strong>${k}:</strong> ${v}`).join('<br/>')
          layer.bindPopup(content)
        }
      }
    }).addTo(map)
  }

  layerRegistry.value[id] = { clusterGroup, layer: geojsonLayer, nonPointLayer }
}

const addAllLayers = (layers) => {
  layers.forEach(layer => addSingleLayer(layer))
  const allBounds = L.latLngBounds()
  layers.forEach(layer => {
    const reg = layerRegistry.value[layer.id]
    if (reg) {
      if (reg.clusterGroup) { const b = reg.clusterGroup.getBounds(); if (b.isValid()) allBounds.extend(b) }
      if (reg.layer && !reg.clusterGroup) { const b = reg.layer.getBounds(); if (b.isValid()) allBounds.extend(b) }
      if (reg.nonPointLayer) { const b = reg.nonPointLayer.getBounds(); if (b.isValid()) allBounds.extend(b) }
    }
  })
  if (allBounds.isValid()) map.fitBounds(allBounds, { padding: [50, 50] })
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

watch(() => props.layers, (newLayers) => {
  if (!map) return
  const oldIds = Object.keys(layerRegistry.value).map(Number)
  const newIds = newLayers.map(l => l.id)
  oldIds.forEach(id => { if (!newIds.includes(id)) removeLayerFromMap(id) })
  newLayers.forEach(layer => addSingleLayer(layer))
}, { deep: true })

watch(() => props.editMode, (newVal) => {
  toggleEditMode(newVal)
})

onMounted(() => {
  if (!mapContainer.value) return
  map = L.map(mapContainer.value).setView([35.8617, 104.1954], 3)
  basemaps[currentBasemap].addTo(map)
  addAllLayers(props.layers)
  emit('map-ready', { map, switchBasemap })
})

provide('map', map)
</script>

<template>
  <div class="map-wrapper">
    <div class="map-container">
      <div ref="mapContainer" class="map-viewer"></div>
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
