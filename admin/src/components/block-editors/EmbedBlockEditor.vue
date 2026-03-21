<template>
  <div class="be-fields">
    <div class="form-group">
      <label>Label (optional)</label>
      <input class="input" v-model="local.title" @input="sync" placeholder="e.g. Google Map" />
    </div>
    <div class="form-group">
      <label>HTML / Embed Code</label>
      <textarea class="input be-code" v-model="local.html" @input="sync" rows="8"
        placeholder="<iframe src=&quot;…&quot;></iframe>&#10;&#10;or any arbitrary HTML snippet"></textarea>
      <small style="color:var(--muted);font-size:0.75rem">⚠️ Only add trusted HTML. Scripts are rendered as-is.</small>
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
<style scoped>
.be-code { font-family: monospace; font-size: 0.82rem; }
</style>
