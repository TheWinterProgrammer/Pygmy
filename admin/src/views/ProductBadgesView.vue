<template>
  <div>
    <div class="page-header">
      <div class="header-left">
        <h1>🏷️ Product Badges</h1>
        <p class="subtitle">Custom labels shown on product cards (New, Hot, Staff Pick, etc.)</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">+ Add Badge</button>
    </div>

    <!-- Quick search -->
    <div class="filter-bar glass">
      <input v-model="search" class="input" placeholder="Search by product or label…" style="flex:1" />
      <select v-model="styleFilter" class="input" style="width:160px">
        <option value="">All styles</option>
        <option v-for="s in STYLES" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>

    <!-- Badges grid grouped by product -->
    <div v-if="loading" class="muted text-center" style="padding:40px;">Loading…</div>
    <div v-else-if="!filtered.length" class="muted text-center" style="padding:40px;">No badges found.</div>
    <div v-else>
      <div v-for="group in grouped" :key="group.product_id" class="product-group glass" style="margin-bottom:16px;">
        <div class="group-header">
          <span class="group-name">{{ group.product_name }}</span>
          <RouterLink :to="`/products/${group.product_id}`" class="link-muted" style="font-size:.78rem;">Edit product →</RouterLink>
        </div>
        <div class="badges-row">
          <div v-for="badge in group.badges" :key="badge.id" class="badge-item">
            <span class="badge-pill" :style="badgeStyle(badge.style)">{{ badge.label }}</span>
            <button class="btn btn-xs btn-ghost" @click="openEdit(badge)">✏️</button>
            <button class="btn btn-xs btn-ghost btn-danger" @click="deleteBadge(badge.id)">✕</button>
          </div>
          <button class="btn btn-xs btn-outline" @click="openCreateFor(group.product_id, group.product_name)">+ Add</button>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="modal" class="modal-backdrop" @click.self="modal = null">
      <div class="modal glass">
        <h2>{{ editing ? 'Edit Badge' : 'Add Badge' }}</h2>

        <div class="field" v-if="!editing && !preselectedProductId">
          <label class="label">Product</label>
          <select v-model="form.product_id" class="input">
            <option value="">— Select product —</option>
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div v-else-if="!editing" class="field">
          <label class="label">Product</label>
          <input class="input" :value="preselectedProductName" disabled />
        </div>

        <div class="field">
          <label class="label">Label <span class="req">*</span></label>
          <input class="input" v-model="form.label" placeholder="e.g. New Arrival, Staff Pick, Hot…" maxlength="32" />
          <span class="field-hint">Max 32 characters</span>
        </div>

        <div class="field">
          <label class="label">Style</label>
          <div class="style-grid">
            <button
              v-for="s in STYLES" :key="s"
              class="style-btn"
              :class="{ selected: form.style === s }"
              :style="badgeStyle(s)"
              @click="form.style = s"
            >{{ form.label || 'Preview' }}</button>
          </div>
        </div>

        <div class="field">
          <label class="label">Sort Order</label>
          <input class="input" type="number" v-model.number="form.sort_order" placeholder="0" style="width:80px" />
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="modal = null">Cancel</button>
          <button class="btn btn-primary" @click="saveBadge" :disabled="saving">
            {{ saving ? 'Saving…' : (editing ? 'Save Changes' : 'Add Badge') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const STYLES = ['default', 'red', 'green', 'blue', 'orange', 'purple', 'gold']

const badges = ref([])
const products = ref([])
const loading = ref(true)
const search = ref('')
const styleFilter = ref('')
const modal = ref(false)
const editing = ref(null)
const saving = ref(false)
const preselectedProductId = ref(null)
const preselectedProductName = ref('')

const form = ref({ product_id: '', label: '', style: 'default', sort_order: 0 })

async function load() {
  loading.value = true
  try {
    const [badgesRes, productsRes] = await Promise.all([
      api.get('/product-badges/all'),
      api.get('/products?all=1&limit=500'),
    ])
    badges.value = badgesRes.data
    products.value = productsRes.data.items || productsRes.data
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  let list = badges.value
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(b => b.label.toLowerCase().includes(q) || b.product_name?.toLowerCase().includes(q))
  }
  if (styleFilter.value) {
    list = list.filter(b => b.style === styleFilter.value)
  }
  return list
})

const grouped = computed(() => {
  const map = {}
  for (const b of filtered.value) {
    if (!map[b.product_id]) {
      map[b.product_id] = { product_id: b.product_id, product_name: b.product_name, badges: [] }
    }
    map[b.product_id].badges.push(b)
  }
  return Object.values(map)
})

function openCreate() {
  editing.value = null
  preselectedProductId.value = null
  preselectedProductName.value = ''
  form.value = { product_id: '', label: '', style: 'default', sort_order: 0 }
  modal.value = true
}

function openCreateFor(productId, productName) {
  editing.value = null
  preselectedProductId.value = productId
  preselectedProductName.value = productName
  form.value = { product_id: productId, label: '', style: 'default', sort_order: 0 }
  modal.value = true
}

function openEdit(badge) {
  editing.value = badge.id
  preselectedProductId.value = null
  form.value = { product_id: badge.product_id, label: badge.label, style: badge.style, sort_order: badge.sort_order }
  modal.value = true
}

async function saveBadge() {
  if (!form.value.label?.trim()) return alert('Label is required')
  if (!editing.value && !form.value.product_id) return alert('Select a product')

  saving.value = true
  try {
    if (editing.value) {
      await api.put(`/product-badges/${editing.value}`, form.value)
    } else {
      const pid = preselectedProductId.value || form.value.product_id
      await api.post('/product-badges', { ...form.value, product_id: pid })
    }
    modal.value = false
    load()
  } catch (e) {
    alert(e.response?.data?.error || 'Save failed')
  } finally {
    saving.value = false
  }
}

async function deleteBadge(id) {
  if (!confirm('Delete this badge?')) return
  await api.delete(`/product-badges/${id}`)
  badges.value = badges.value.filter(b => b.id !== id)
}

function badgeStyle(style) {
  const styles = {
    default: 'background:rgba(150,150,150,.2);color:#bbb;',
    red:     'background:rgba(220,50,50,.2);color:#ff6b6b;',
    green:   'background:rgba(50,200,80,.2);color:#4ce88a;',
    blue:    'background:rgba(50,120,220,.2);color:#6fb3f5;',
    orange:  'background:rgba(255,140,0,.2);color:#ffa030;',
    purple:  'background:rgba(150,80,220,.2);color:#c084fc;',
    gold:    'background:rgba(200,160,0,.2);color:#ffd700;',
  }
  return styles[style] || styles.default
}

onMounted(load)
</script>

<style scoped>
.page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
.header-left h1 { margin:0 0 4px; }
.subtitle { margin:0; color:var(--text-muted); font-size:.85rem; }

.filter-bar { display:flex; gap:12px; padding:14px 16px; margin-bottom:20px; }
.product-group { padding:16px 20px; }
.group-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
.group-name { font-weight:700; font-size:.95rem; }
.link-muted { color:var(--text-muted); text-decoration:none; }
.link-muted:hover { color:var(--accent); }
.badges-row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
.badge-item { display:flex; align-items:center; gap:4px; }
.badge-pill { display:inline-block; padding:3px 10px; border-radius:99px; font-size:.78rem; font-weight:700; letter-spacing:.03em; }

.style-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.style-btn { padding:5px 10px; border-radius:99px; font-size:.78rem; font-weight:700; cursor:pointer; border:2px solid transparent; transition:.15s; }
.style-btn:hover { opacity:.8; }
.style-btn.selected { border-color:white !important; }

.modal-backdrop { position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000; }
.modal { padding:28px; min-width:420px; max-width:560px; width:90%; border-radius:1.25rem; }
.modal h2 { margin:0 0 20px; font-size:1.15rem; }
.field { margin-bottom:16px; }
.label { display:block; margin-bottom:6px; font-size:.82rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; }
.field-hint { font-size:.72rem; color:var(--text-muted); margin-top:4px; }
.req { color:var(--accent); }
.modal-actions { display:flex; justify-content:flex-end; gap:12px; margin-top:24px; }

.btn { display:inline-flex; align-items:center; justify-content:center; padding:8px 16px; border-radius:8px; font-size:.85rem; font-weight:600; cursor:pointer; border:1px solid transparent; transition:.15s; }
.btn:disabled { opacity:.5; cursor:not-allowed; }
.btn-xs { padding:3px 7px; font-size:.72rem; }
.btn-primary { background:var(--accent); color:#fff; border-color:var(--accent); }
.btn-primary:hover:not(:disabled) { opacity:.85; }
.btn-ghost { background:transparent; border-color:var(--border); color:var(--text); }
.btn-ghost:hover { border-color:var(--accent); color:var(--accent); }
.btn-outline { background:transparent; border-color:var(--accent); color:var(--accent); font-size:.78rem; padding:4px 10px; border-radius:8px; }
.btn-outline:hover { background:rgba(var(--accent-rgb),.1); }
.btn-danger:hover { border-color:#ff6b6b; color:#ff6b6b; }

.muted { color:var(--text-muted); }
.text-center { text-align:center; }
.glass { background:var(--surface); border:1px solid rgba(255,255,255,.08); border-radius:1rem; }
.input { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); border-radius:.5rem; padding:8px 12px; color:var(--text); font-family:inherit; font-size:.85rem; width:100%; box-sizing:border-box; }
.input:focus { outline:none; border-color:var(--accent); }
</style>
