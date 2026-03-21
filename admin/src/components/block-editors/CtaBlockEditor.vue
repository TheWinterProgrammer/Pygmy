<template>
  <div class="be-fields">
    <div class="be-row">
      <div class="form-group">
        <label>Headline</label>
        <input class="input" v-model="local.title" @input="sync" placeholder="Ready to get started?" />
      </div>
      <div class="form-group">
        <label>Subtitle</label>
        <input class="input" v-model="local.subtitle" @input="sync" placeholder="No credit card required." />
      </div>
    </div>
    <div class="be-row">
      <div class="form-group">
        <label>Button Label</label>
        <input class="input" v-model="local.btn_label" @input="sync" placeholder="Get Started" />
      </div>
      <div class="form-group">
        <label>Button URL</label>
        <input class="input" v-model="local.btn_url" @input="sync" placeholder="/signup" />
      </div>
      <div class="form-group" style="max-width:140px">
        <label>Background Color</label>
        <input class="input" type="color" v-model="local.bg_color" @input="sync" style="height:38px;padding:2px 6px;" />
      </div>
    </div>
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" v-model="local.centered" @change="sync" />
        Center content
      </label>
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
.checkbox-label { display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-size:0.88rem; }
</style>
