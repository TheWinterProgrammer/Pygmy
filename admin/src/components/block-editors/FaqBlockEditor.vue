<template>
  <div class="be-fields">
    <div class="form-group">
      <label>Section Title</label>
      <input class="input" v-model="local.title" @input="sync" placeholder="Frequently Asked Questions" />
    </div>
    <div class="items-section">
      <div class="items-header">
        <label>FAQ Items</label>
        <button class="btn btn-sm btn-ghost" @click="addItem">+ Add</button>
      </div>
      <div class="item-card glass" v-for="(item, i) in local.items" :key="i">
        <div class="item-head">
          <span class="item-num">Q{{ i + 1 }}</span>
          <button class="icon-btn danger" @click="removeItem(i)">✕</button>
        </div>
        <input class="input" v-model="item.question" @input="sync" placeholder="Question" style="margin-bottom:0.4rem" />
        <textarea class="input" v-model="item.answer" @input="sync" rows="3" placeholder="Answer"></textarea>
      </div>
    </div>
  </div>
</template>
<script setup>
import { reactive, watch } from 'vue'
const props = defineProps({ settings: Object })
const emits = defineEmits(['update'])
const local = reactive({ ...props.settings, items: Array.isArray(props.settings?.items) ? props.settings.items.map(i=>({...i})) : [] })
watch(() => props.settings, (v) => { Object.assign(local, v); local.items = Array.isArray(v?.items) ? v.items.map(i=>({...i})) : [] }, { deep: true })
function sync() { emits('update', { ...local, items: [...local.items] }) }
function addItem() { local.items.push({ question: '', answer: '' }); sync() }
function removeItem(i) { local.items.splice(i, 1); sync() }
</script>
<style scoped>
.items-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; }
.item-card { padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:0.5rem; }
.item-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem; }
.item-num { font-size:0.8rem; color:var(--accent); font-weight:600; }
.icon-btn { background:none; border:none; cursor:pointer; color:var(--muted); }
.icon-btn.danger:hover { color:var(--accent); }
</style>
