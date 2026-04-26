<script setup>
defineProps({
  properties: {
    type: Array,
    required: true
  }
})
</script>

<template>
  <div class="data-table-container">
    <h3>📊 属性字段</h3>
    <div class="properties-grid">
      <div
        v-for="(prop, index) in properties"
        :key="index"
        class="property-item"
      >
        <span class="property-name">{{ prop }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.data-table-container {
  padding: 15px;
}

.data-table-container h3 {
  font-size: 1.1rem;
  color: #444;
  margin-bottom: 15px;
}

.properties-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.property-item {
  background: #f0f4ff;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
  color: #5c6bc0;
}

.property-name {
  font-weight: 500;
}
</style>
