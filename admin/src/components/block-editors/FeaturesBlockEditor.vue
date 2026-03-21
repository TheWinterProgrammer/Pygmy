<template>
  <div class="be-fields">
    <div class="be-row">
      <div class="form-group">
        <label>Section Title</label>
        <input class="input" v-model="local.title" @input="sync" placeholder="Why choose us" />
      </div>
      <div class="form-group">
        <label>Subtitle</label>
        <input class="input" v-model="local.subtitle" @input="sync" placeholder="Short description" />
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
        <label>Feature Items</label>
        <button class="btn btn-sm btn-ghost" @click="addItem">+ Add Item</button>
      </div>
      <div class="item-row" v-for="(item, i) in local.items" :key="i">
        <div class="item-fields">
          <input class="input item-icon-input" v-model="item.icon" @input="sync" placeholder="⚡ icon" />
          <input class="input" v-model="item.title" @input="sync" placeholder="Feature title" />
          <textarea class="input" v-model="item.text" @input="sync" rows="2" placeholder="Short description"></textarea>
        </div>
        <button class="icon-btn danger" @click="removeItem(i)">✕</button>
      </div>
    </div>
  </div>
</template>
<script setup>
import { reactive, watch } from 'vue'
const props = defineProps({ settings: Object })
const emits = defineEmits(['update'])
const local = reactive({ ...props.settings, items: Array.isArray(props.settings?.items) ? props.settings.items.map(i => ({...i})) : [] })
watch(() => props.settings, (v) => { Object.assign(local, v); local.items = Array.isArray(v?.items) ? v.items.map(i=>({...i})) : [] }, { deep: true })
function sync() { emits('update', { ...local, items: [...local.items] }) }
function addItem() { local.items.push({ icon: '', title: '', text: '' }); sync() }
function removeItem(i) { local.items.splice(i, 1); sync() }
</script>
<style scoped>
.items-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; }
.item-row { display:flex; align-items:flex-start; gap:0.5rem; margin-bottom:0.5rem; }
.item-fields { flex:1; display:flex; flex-direction:column; gap:0.35rem; }
.item-icon-input { width:80px; }
.icon-btn { background:none; border:none; cursor:pointer; color:var(--muted); padding:0.3rem; }
.icon-btn.danger:hover { color:var(--accent); }
</style>
