<template>
  <div class="be-fields">
    <div class="be-row">
      <div class="form-group">
        <label>Section Title</label>
        <input class="input" v-model="local.title" @input="sync" placeholder="Gallery" />
      </div>
      <div class="form-group" style="max-width:120px">
        <label>Columns</label>
        <select class="select" v-model.number="local.columns" @change="sync">
          <option :value="2">2</option>
          <option :value="3">3</option>
          <option :value="4">4</option>
        </select>
      </div>
    </div>
    <div class="items-section">
      <div class="items-header">
        <label>Images</label>
        <button class="btn btn-sm btn-ghost" @click="addItem">+ Add Image</button>
      </div>
      <div class="item-row" v-for="(img, i) in local.images" :key="i">
        <input class="input" v-model="img.url" @input="sync" placeholder="Image URL" style="flex:2" />
        <input class="input" v-model="img.alt" @input="sync" placeholder="Alt text" style="flex:1" />
        <button class="icon-btn danger" @click="removeItem(i)">✕</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { reactive, watch } from 'vue'
const props = defineProps({ settings: Object })
const emits = defineEmits(['update'])
const local = reactive({ ...props.settings, images: Array.isArray(props.settings?.images) ? props.settings.images.map(i=>({...i})) : [] })
watch(() => props.settings, (v) => { Object.assign(local, v); local.images = Array.isArray(v?.images) ? v.images.map(i=>({...i})) : [] }, { deep: true })
function sync() { emits('update', { ...local, images: [...local.images] }) }
function addItem() { local.images.push({ url: '', alt: '' }); sync() }
function removeItem(i) { local.images.splice(i, 1); sync() }
</script>
<style scoped>
.items-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; }
.item-row { display:flex; gap:0.5rem; margin-bottom:0.35rem; align-items:center; }
.icon-btn { background:none; border:none; cursor:pointer; color:var(--muted); padding:0.3rem; }
.icon-btn.danger:hover { color:var(--accent); }
</style>
