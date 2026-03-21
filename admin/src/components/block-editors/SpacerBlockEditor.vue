<template>
  <div class="be-fields">
    <div class="form-group" style="max-width:200px">
      <label>Height (CSS value)</label>
      <input class="input" v-model="local.height" @input="sync" placeholder="60px" />
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
