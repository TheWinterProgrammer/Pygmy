<template>
  <div class="glass section">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
      <h3 style="margin:0">🔗 Related Products & Recommendations</h3>
    </div>
    <p class="text-muted" style="font-size:.85rem;margin-bottom:1rem;">
      Manually curate related products shown on the product page. If empty, smart auto-recommendations are used (based on co-purchases + category).
    </p>

    <!-- Type tabs -->
    <div class="rec-tabs" style="margin-bottom:12px;">
      <button
        v-for="t in types"
        :key="t.value"
        class="btn btn-sm"
        :class="activeType === t.value ? 'btn-primary' : 'btn-ghost'"
        @click="activeType = t.value"
      >
        {{ t.label }} <span class="badge-count" v-if="grouped[t.value]?.length">{{ grouped[t.value].length }}</span>
      </button>
    </div>

    <!-- Current recommendations for active type -->
    <div class="rec-list" v-if="grouped[activeType]?.length">
      <div class="rec-item glass" v-for="(rec, idx) in grouped[activeType]" :key="rec.id">
        <img v-if="rec.cover_image" :src="rec.cover_image" class="rec-thumb" />
        <div class="rec-thumb-placeholder" v-else>📦</div>
        <div class="rec-info">
          <div class="rec-name">{{ rec.name }}</div>
          <div class="rec-price text-muted">€{{ Number(rec.price).toFixed(2) }}</div>
        </div>
        <div class="rec-actions">
          <button class="btn-icon" @click="moveUp(activeType, idx)" :disabled="idx === 0" title="Move up">↑</button>
          <button class="btn-icon" @click="moveDown(activeType, idx)" :disabled="idx === grouped[activeType].length - 1" title="Move down">↓</button>
          <button class="btn-icon danger" @click="removeRec(rec)" title="Remove">✕</button>
        </div>
      </div>
    </div>
    <div class="empty-state-sm text-muted" v-else>
      No {{ activeType }} products set. Auto-recommendations will be used.
    </div>

    <!-- Add product search -->
    <div class="add-rec" style="margin-top:12px;">
      <div class="rec-search-row">
        <input
          v-model="searchQ"
          class="input"
          placeholder="Search products to add…"
          @input="debounceSearch"
          style="flex:1;"
        />
      </div>
      <div class="rec-search-results" v-if="searchResults.length">
        <div
          v-for="p in searchResults"
          :key="p.id"
          class="rec-search-item"
          @click="addRec(p)"
        >
          <img v-if="p.cover_image" :src="p.cover_image" class="rec-thumb-sm" />
          <div class="rec-thumb-sm-placeholder" v-else>📦</div>
          <div>
            <div style="font-size:13px;font-weight:500;">{{ p.name }}</div>
            <div class="text-muted" style="font-size:11px;">€{{ Number(p.price).toFixed(2) }}</div>
          </div>
          <span class="add-icon">+</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({ productId: Number })

const API = 'http://localhost:3200/api'
const token = localStorage.getItem('pygmy_token')

const types = [
  { value: 'related', label: '🔗 Related' },
  { value: 'upsell', label: '⬆️ Upsells' },
  { value: 'crosssell', label: '🔀 Cross-sells' },
  { value: 'bought_together', label: '🛒 Bought Together' },
]
const activeType = ref('related')
const allRecs = ref([])
const searchQ = ref('')
const searchResults = ref([])

const grouped = computed(() => {
  const g = {}
  for (const t of types) {
    g[t.value] = allRecs.value.filter(r => r.type === t.value)
  }
  return g
})

async function load() {
  if (!props.productId) return
  try {
    const res = await fetch(`${API}/recommendations?product_id=${props.productId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    allRecs.value = await res.json()
  } catch {}
}

let searchTimer = null
function debounceSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(doSearch, 350)
}

async function doSearch() {
  if (!searchQ.value.trim()) { searchResults.value = []; return }
  try {
    const res = await fetch(`${API}/products?all=1&q=${encodeURIComponent(searchQ.value)}&limit=8`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    const ids = allRecs.value.map(r => r.recommended_id)
    searchResults.value = (data.products || data).filter(p => p.id !== props.productId && !ids.includes(p.id))
  } catch {}
}

async function addRec(product) {
  try {
    const res = await fetch(`${API}/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        product_id: props.productId,
        recommended_id: product.id,
        type: activeType.value,
        sort_order: grouped.value[activeType.value]?.length || 0,
      }),
    })
    if (res.ok) {
      allRecs.value.push({
        ...product,
        recommended_id: product.id,
        type: activeType.value,
        sort_order: grouped.value[activeType.value]?.length || 0,
        id: (await res.json()).id,
      })
      searchResults.value = searchResults.value.filter(p => p.id !== product.id)
    }
  } catch {}
}

async function removeRec(rec) {
  await fetch(`${API}/recommendations/${rec.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  allRecs.value = allRecs.value.filter(r => r.id !== rec.id)
}

async function moveUp(type, idx) {
  if (idx === 0) return
  const list = grouped.value[type]
  const tmp = list[idx - 1]
  list[idx - 1] = list[idx]
  list[idx] = tmp
  await saveOrder(type)
}

async function moveDown(type, idx) {
  const list = grouped.value[type]
  if (idx >= list.length - 1) return
  const tmp = list[idx + 1]
  list[idx + 1] = list[idx]
  list[idx] = tmp
  await saveOrder(type)
}

async function saveOrder(type) {
  const ids = grouped.value[type].map(r => r.id)
  await fetch(`${API}/recommendations/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ order: ids }),
  })
  // Update local sort_order
  grouped.value[type].forEach((r, i) => { r.sort_order = i })
}

watch(() => props.productId, (id) => { if (id) load() }, { immediate: true })
</script>

<style scoped>
.rec-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.badge-count {
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--accent); color: #fff; border-radius: 999px;
  font-size: 10px; width: 16px; height: 16px; margin-left: 4px;
}
.rec-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.rec-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 10px;
}
.rec-thumb { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.rec-thumb-placeholder { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border-radius: 6px; font-size: 18px; flex-shrink: 0; }
.rec-info { flex: 1; }
.rec-name { font-size: 13px; font-weight: 500; }
.rec-price { font-size: 12px; }
.rec-actions { display: flex; gap: 4px; }
.btn-icon { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px 6px; border-radius: 4px; font-size: 14px; transition: color 0.2s, background 0.2s; }
.btn-icon:hover { color: var(--text); background: rgba(255,255,255,0.08); }
.btn-icon.danger:hover { color: var(--accent); }
.btn-icon:disabled { opacity: 0.3; cursor: not-allowed; }
.add-rec { margin-top: 12px; }
.rec-search-row { display: flex; gap: 8px; }
.rec-search-results { margin-top: 8px; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; }
.rec-search-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; transition: background 0.15s; }
.rec-search-item:hover { background: rgba(255,255,255,0.06); }
.rec-thumb-sm { width: 28px; height: 28px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
.rec-thumb-sm-placeholder { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border-radius: 4px; font-size: 14px; flex-shrink: 0; }
.add-icon { margin-left: auto; color: var(--accent); font-size: 18px; font-weight: 700; }
.empty-state-sm { font-size: 13px; padding: 8px 0; }
</style>
