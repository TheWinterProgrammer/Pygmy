<template>
  <div class="be-fields">
    <div class="form-group">
      <label>Content (HTML)</label>
      <textarea class="input be-textarea" v-model="local.content" @input="emit"
        rows="8" placeholder="<p>Your text content…</p>"></textarea>
    </div>
    <div class="be-row">
      <div class="form-group">
        <label>Max Width</label>
        <input class="input" v-model="local.max_width" @input="emit" placeholder="760px" />
      </div>
      <div class="form-group">
        <label>Text Align</label>
        <select class="select" v-model="local.text_align" @change="emit">
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
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
function emit() { emits('update', { ...local }) }
</script>
<style scoped>
.be-textarea { font-family: monospace; font-size: 0.82rem; }
</style>
