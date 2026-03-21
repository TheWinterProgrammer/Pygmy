<template>
  <div class="be-fields">
    <div class="be-row">
      <div class="form-group">
        <label>Style</label>
        <select class="select" v-model="local.style" @change="sync">
          <option value="line">Line</option>
          <option value="dots">Dots</option>
          <option value="none">None (whitespace only)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Spacing</label>
        <select class="select" v-model="local.spacing" @change="sync">
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
        </select>
      </div>
    </div>
  </div>
</template>
<script setup>
import { reactive, watch } from 'vue'
const props = defineProps({ settings: Object })
const emits = defineEmits(['update'])
const local = reactive({ ...props.settings })
watch(() => props.settings, (v) => Object.assign(local, v), { deep: true })
function sync() { emits('update', { ...local }) }
</script>
