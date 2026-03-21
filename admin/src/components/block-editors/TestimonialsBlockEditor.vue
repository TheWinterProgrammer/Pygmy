<template>
  <div class="be-fields">
    <div class="form-group">
      <label>Section Title</label>
      <input class="input" v-model="local.title" @input="sync" placeholder="What our clients say" />
    </div>
    <div class="items-section">
      <div class="items-header">
        <label>Testimonials</label>
        <button class="btn btn-sm btn-ghost" @click="addItem">+ Add</button>
      </div>
      <div class="item-card glass" v-for="(item, i) in local.items" :key="i">
        <div class="item-head">
          <span class="item-num">#{{ i + 1 }}</span>
          <button class="icon-btn danger" @click="removeItem(i)">✕</button>
        </div>
        <textarea class="input" v-model="item.quote" @input="sync" rows="3" placeholder="The quote text…"></textarea>
        <div class="be-row" style="margin-top:0.4rem">
          <input class="input" v-model="item.author" @input="sync" placeholder="Author name" />
          <input class="input" v-model="item.role" @input="sync" placeholder="Role / Company" />
          <input class="input" v-model="item.avatar" @input="sync" placeholder="Avatar URL (optional)" />
        </div>
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
function addItem() { local.items.push({ quote: '', author: '', role: '', avatar: '' }); sync() }
function removeItem(i) { local.items.splice(i, 1); sync() }
</script>
<style scoped>
.items-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; }
.item-card { padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:0.5rem; }
.item-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem; }
.item-num { font-size:0.8rem; color:var(--muted); }
.icon-btn { background:none; border:none; cursor:pointer; color:var(--muted); }
.icon-btn.danger:hover { color:var(--accent); }
</style>
