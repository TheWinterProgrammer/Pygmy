<template>
  <div class="be-fields">
    <div class="be-row">
      <div class="form-group">
        <label>Section Title</label>
        <input class="input" v-model="local.title" @input="sync" placeholder="Simple, transparent pricing" />
      </div>
      <div class="form-group">
        <label>Subtitle</label>
        <input class="input" v-model="local.subtitle" @input="sync" placeholder="No hidden fees." />
      </div>
    </div>
    <div class="items-section">
      <div class="items-header">
        <label>Pricing Plans</label>
        <button class="btn btn-sm btn-ghost" @click="addItem">+ Add Plan</button>
      </div>
      <div class="item-card glass" v-for="(item, i) in local.items" :key="i">
        <div class="item-head">
          <span class="item-name">{{ item.name || `Plan ${i+1}` }}</span>
          <button class="icon-btn danger" @click="removeItem(i)">✕</button>
        </div>
        <div class="be-row">
          <input class="input" v-model="item.name" @input="sync" placeholder="Plan name" />
          <input class="input" v-model="item.price" @input="sync" placeholder="$29" />
          <input class="input" v-model="item.period" @input="sync" placeholder="/ month" />
        </div>
        <textarea class="input" v-model="item._featuresRaw" @input="onFeaturesInput(item)"
          rows="4" placeholder="One feature per line:&#10;Unlimited projects&#10;5 GB storage&#10;Email support"
          style="margin:0.35rem 0;font-size:0.82rem;font-family:monospace"></textarea>
        <div class="be-row" style="margin-top:0.35rem">
          <input class="input" v-model="item.cta_label" @input="sync" placeholder="Get started" />
          <input class="input" v-model="item.cta_url" @input="sync" placeholder="/signup" />
          <label class="checkbox-label">
            <input type="checkbox" v-model="item.highlight" @change="sync" />
            Highlight
          </label>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { reactive, watch } from 'vue'
const props = defineProps({ settings: Object })
const emits = defineEmits(['update'])

function prepItems(items) {
  return (Array.isArray(items) ? items : []).map(i => ({
    ...i,
    _featuresRaw: Array.isArray(i.features) ? i.features.join('\n') : (i._featuresRaw || '')
  }))
}

const local = reactive({ ...props.settings, items: prepItems(props.settings?.items) })
watch(() => props.settings, (v) => { Object.assign(local, v); local.items = prepItems(v?.items) }, { deep: true })

function onFeaturesInput(item) {
  item.features = item._featuresRaw.split('\n').map(l => l.trim()).filter(Boolean)
  sync()
}
function sync() { emits('update', { ...local, items: local.items.map(({_featuresRaw, ...rest}) => rest) }) }
function addItem() { local.items.push({ name: '', price: '', period: '', features: [], highlight: false, cta_label: '', cta_url: '', _featuresRaw: '' }); sync() }
function removeItem(i) { local.items.splice(i, 1); sync() }
</script>
<style scoped>
.items-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; }
.item-card { padding:0.75rem; border-radius:var(--radius-sm); margin-bottom:0.5rem; }
.item-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem; }
.item-name { font-weight:600; font-size:0.88rem; }
.checkbox-label { display:flex; align-items:center; gap:0.4rem; font-size:0.84rem; cursor:pointer; white-space:nowrap; }
.icon-btn { background:none; border:none; cursor:pointer; color:var(--muted); }
.icon-btn.danger:hover { color:var(--accent); }
</style>
