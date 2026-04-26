<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  layer: {
    type: Object,
    default: null
  }
})

const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = 20
const sortColumn = ref(null)
const sortOrder = ref('asc')

const features = computed(() => {
  if (!props.layer?.geojson) return []
  const data = props.layer.geojson
  return data.type === 'FeatureCollection' ? data.features : [data]
})

const filteredFeatures = computed(() => {
  if (!searchKeyword.value) return features.value
  
  const keyword = searchKeyword.value.toLowerCase()
  return features.value.filter(f => {
    if (!f.properties) return false
    return Object.values(f.properties).some(v => 
      String(v).toLowerCase().includes(keyword)
    )
  })
})

const sortedFeatures = computed(() => {
  if (!sortColumn.value) return filteredFeatures.value
  
  return [...filteredFeatures.value].sort((a, b) => {
    const valA = a.properties?.[sortColumn.value] ?? ''
    const valB = b.properties?.[sortColumn.value] ?? ''
    
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortOrder.value === 'asc' ? valA - valB : valB - valA
    }
    
    const strA = String(valA).toLowerCase()
    const strB = String(valB).toLowerCase()
    const cmp = strA.localeCompare(strB)
    return sortOrder.value === 'asc' ? cmp : -cmp
  })
})

const paginatedFeatures = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return sortedFeatures.value.slice(start, start + pageSize)
})

const totalPages = computed(() => Math.ceil(sortedFeatures.value.length / pageSize))

const propertyKeys = computed(() => {
  if (!props.layer?.geojson) return []
  return props.layer.properties || []
})

const handleSort = (key) => {
  if (sortColumn.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = key
    sortOrder.value = 'asc'
  }
}

const getSortIcon = (key) => {
  if (sortColumn.value !== key) return '↕️'
  return sortOrder.value === 'asc' ? '↑' : '↓'
}

const searchAndReset = () => {
  currentPage.value = 1
}

const getFeatureIndex = (feature) => {
  return features.value.indexOf(feature) + 1
}

const getGeometryType = (feature) => {
  return feature.geometry?.type || '-'
}
</script>

<template>
  <div v-if="layer" class="attr-table">
    <div class="table-header">
      <h3>📊 属性数据</h3>
      <span class="count-badge">{{ sortedFeatures.length }} / {{ features.length }} 条</span>
    </div>

    <div class="table-controls">
      <input
        v-model="searchKeyword"
        @input="searchAndReset"
        type="text"
        placeholder="🔍 搜索属性值..."
        class="search-input"
      />
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th class="col-index">#</th>
            <th class="col-type">类型</th>
            <th
              v-for="key in propertyKeys"
              :key="key"
              class="col-prop"
              @click="handleSort(key)"
            >
              {{ key }} <span class="sort-icon">{{ getSortIcon(key) }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(feature, idx) in paginatedFeatures" :key="idx">
            <td class="col-index">{{ (currentPage - 1) * pageSize + idx + 1 }}</td>
            <td class="col-type">{{ getGeometryType(feature) }}</td>
            <td
              v-for="key in propertyKeys"
              :key="key"
              class="col-prop"
              :title="String(feature.properties?.[key] ?? '')"
            >
              {{ feature.properties?.[key] ?? '-' }}
            </td>
          </tr>
          <tr v-if="paginatedFeatures.length === 0">
            <td :colspan="propertyKeys.length + 2" class="no-data">
              暂无数据
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="pagination">
      <button
        :disabled="currentPage <= 1"
        @click="currentPage--"
        class="page-btn"
        type="button"
      >
        上一页
      </button>
      <span class="page-info">
        第 {{ currentPage }} / {{ totalPages }} 页
      </span>
      <button
        :disabled="currentPage >= totalPages"
        @click="currentPage++"
        class="page-btn"
        type="button"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<style scoped>
.attr-table {
  margin-top: 20px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 2px solid #eee;
}

.table-header h3 {
  font-size: 1.1rem;
  color: #444;
}

.count-badge {
  background: #ebf4ff;
  color: #667eea;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.table-controls {
  margin-bottom: 12px;
}

.search-input {
  width: 100%;
  padding: 10px 15px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #667eea;
}

.table-wrapper {
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

th {
  background: #f7fafc;
  padding: 10px 12px;
  text-align: left;
  color: #4a5568;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 1;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}

th:hover {
  background: #edf2f7;
}

.sort-icon {
  font-size: 0.75rem;
  margin-left: 4px;
  opacity: 0.5;
}

td {
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

tr:hover td {
  background: #f7fafc;
}

.col-index {
  width: 50px;
  min-width: 50px;
  text-align: center;
  color: #a0aec0;
}

.col-type {
  width: 80px;
  min-width: 80px;
}

.col-type {
  text-align: center;
}

.no-data {
  text-align: center;
  color: #a0aec0;
  padding: 30px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-top: 15px;
  padding-top: 12px;
  border-top: 1px solid #eee;
}

.page-btn {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.85rem;
  color: #718096;
}
</style>
