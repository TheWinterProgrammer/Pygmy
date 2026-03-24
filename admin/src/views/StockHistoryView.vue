<template>
  <div>
    <div class="page-header">
      <div>
        <h1>📋 Stock History</h1>
        <p class="subtitle">Audit trail of all stock quantity changes across all products</p>
      </div>
      <button class="btn btn-ghost" @click="load">🔄 Refresh</button>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar glass">
      <input v-model="q" class="input" placeholder="🔍 Search by product name or SKU…" @input="debouncedLoad" />
      <select v-model="reasonFilter" class="input" style="width:160px" @change="load">
        <option value="">All reasons</option>
        <option value="manual">Manual</option>
        <option value="order">Order</option>
        <option value="adjustment">Adjustment</option>
        <option value="return">Return</option>
        <option value="import">Import</option>
      </select>
      <button class="btn btn-ghost btn-sm" @click="exportCsv">⬇️ Export CSV</button>
    </div>

    <!-- Table -->
    <div class="glass-card">
      <div v-if="loading" class="loading-state">Loading…</div>
      <div v-else-if="!rows.length" class="empty-state">
        <div class="empty-icon">📋</div>
        <p>No stock history yet. Stock changes will appear here as they happen.</p>
      </div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Reason</th>
            <th style="width:90px">Old Qty</th>
            <th style="width:90px">Change</th>
            <th style="width:90px">New Qty</th>
            <th>By / Note</th>
            <th style="width:140px">When</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>
              <div class="product-cell">
                <span class="product-name">{{ row.product_name }}</span>
                <span class="product-sku text-muted" v-if="row.sku">{{ row.sku }}</span>
              </div>
            </td>
            <td>
              <span class="reason-pill" :class="row.reason">{{ reasonLabel(row.reason) }}</span>
            </td>
            <td class="mono">{{ row.old_qty }}</td>
            <td>
              <span class="change-badge" :class="row.change_amt >= 0 ? 'pos' : 'neg'">
                {{ row.change_amt >= 0 ? '+' : '' }}{{ row.change_amt }}
              </span>
            </td>
            <td class="mono">{{ row.new_qty }}</td>
            <td class="note-cell">
              <span v-if="row.admin_name" class="admin-name">{{ row.admin_name }}</span>
              <span v-if="row.note" class="note-text text-muted">{{ row.note }}</span>
              <RouterLink v-if="row.order_id" :to="`/orders`" class="order-link">
                Order #{{ row.order_id }}
              </RouterLink>
            </td>
            <td class="text-muted time-cell">{{ fmtDate(row.created_at) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="pagination" v-if="total > limit">
        <button class="btn btn-ghost btn-sm" :disabled="offset === 0" @click="prev">← Prev</button>
        <span class="page-info">{{ offset + 1 }}–{{ Math.min(offset + limit, total) }} of {{ total }}</span>
        <button class="btn btn-ghost btn-sm" :disabled="offset + limit >= total" @click="next">Next →</button>
      </div>
    </div>

    <!-- Quick Adjust Panel -->
    <div class="glass-card adjust-card">
      <h3>⚡ Quick Stock Adjustment</h3>
      <p class="text-muted" style="font-size:.85rem;margin-bottom:1rem;">Manually add or remove stock for a product and log it to the audit trail.</p>
      <div class="adjust-form">
        <input v-model="adjustSearch" class="input" placeholder="Search product…" @input="searchProducts" />
        <div class="product-results" v-if="productResults.length">
          <div
            v-for="p in productResults" :key="p.id"
            class="product-result"
            @click="selectProduct(p)"
          >
            <span>{{ p.name }}</span>
            <span class="text-muted">{{ p.sku }} — qty: {{ p.stock_quantity ?? '–' }}</span>
          </div>
        </div>
        <div v-if="selectedProduct" class="selected-product glass">
          <div class="sel-info">
            <strong>{{ selectedProduct.name }}</strong>
            <span class="text-muted">Current stock: {{ selectedProduct.stock_quantity ?? 0 }}</span>
          </div>
          <div class="adj-row">
            <input v-model.number="adjustAmt" type="number" class="input" style="width:100px" placeholder="e.g. +5 or -2" />
            <input v-model="adjustNote" class="input" placeholder="Reason / note…" style="flex:1" />
            <button class="btn btn-primary" @click="doAdjust" :disabled="adjusting">
              {{ adjusting ? 'Saving…' : '💾 Adjust' }}
            </button>
          </div>
          <div v-if="adjustResult" class="adjust-result" :class="adjustResult.ok ? 'ok' : 'err'">
            {{ adjustResult.msg }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const rows   = ref([])
const total  = ref(0)
const loading = ref(false)
const q      = ref('')
const reasonFilter = ref('')
const offset = ref(0)
const limit  = 100

// Adjust panel
const adjustSearch   = ref('')
const productResults = ref([])
const selectedProduct = ref(null)
const adjustAmt      = ref('')
const adjustNote     = ref('')
const adjusting      = ref(false)
const adjustResult   = ref(null)

let debounceTimer = null
function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { offset.value = 0; load() }, 300)
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/stock-history', {
      params: { q: q.value || undefined, reason: reasonFilter.value || undefined, limit, offset: offset.value }
    })
    rows.value  = data.history || []
    total.value = data.total || 0
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function prev() { offset.value = Math.max(0, offset.value - limit); load() }
function next() { if (offset.value + limit < total.value) { offset.value += limit; load() } }

function reasonLabel(r) {
  return { manual: 'Manual', order: 'Order', adjustment: 'Adjustment', return: 'Return', import: 'Import' }[r] || r
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
}

async function searchProducts() {
  if (!adjustSearch.value.trim()) { productResults.value = []; return }
  const { data } = await api.get('/products', { params: { q: adjustSearch.value, all: 1, limit: 8 } })
  productResults.value = (data.products || data).slice(0, 8)
}

function selectProduct(p) {
  selectedProduct.value = p
  adjustSearch.value = ''
  productResults.value = []
  adjustAmt.value = ''
  adjustNote.value = ''
  adjustResult.value = null
}

async function doAdjust() {
  if (!selectedProduct.value || !adjustAmt.value) return
  adjusting.value = true
  adjustResult.value = null
  try {
    const { data } = await api.post('/stock-history/adjust', {
      product_id: selectedProduct.value.id,
      adjustment: adjustAmt.value,
      note: adjustNote.value
    })
    adjustResult.value = { ok: true, msg: `✅ Adjusted: ${data.old_qty} → ${data.new_qty}` }
    selectedProduct.value = { ...selectedProduct.value, stock_quantity: data.new_qty }
    adjustAmt.value = ''
    adjustNote.value = ''
    load()
  } catch (e) {
    adjustResult.value = { ok: false, msg: e.response?.data?.error || 'Adjustment failed' }
  } finally {
    adjusting.value = false
  }
}

function exportCsv() {
  const rows_copy = rows.value
  const headers = ['ID','Product','SKU','Reason','Old Qty','Change','New Qty','Admin','Note','Date']
  const csv = [headers.join(','), ...rows_copy.map(r => [
    r.id, `"${(r.product_name||'').replace(/"/g,'""')}"`, r.sku || '',
    r.reason, r.old_qty, r.change_amt, r.new_qty,
    `"${(r.admin_name||'').replace(/"/g,'""')}"`,
    `"${(r.note||'').replace(/"/g,'""')}"`,
    r.created_at
  ].join(','))].join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'stock-history.csv'; a.click()
  URL.revokeObjectURL(url)
}

onMounted(load)
</script>

<style scoped>
.page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; }
.subtitle { color:#888; font-size:.9rem; margin:.25rem 0 0; }
.filter-bar { display:flex; gap:.75rem; flex-wrap:wrap; padding:1rem 1.25rem; border-radius:1rem; margin-bottom:1.25rem; }
.filter-bar .input { flex:1; min-width:200px; }
.loading-state { text-align:center; padding:2rem; color:#888; }
.empty-state { text-align:center; padding:3rem 2rem; color:#888; }
.empty-icon { font-size:3rem; margin-bottom:.75rem; }
.glass-card { background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:1.25rem; padding:1.25rem; margin-bottom:1.25rem; overflow:auto; }
.data-table { width:100%; border-collapse:collapse; font-size:.9rem; }
.data-table th { text-align:left; padding:.6rem .75rem; border-bottom:1px solid rgba(255,255,255,.08); color:#888; font-weight:500; font-size:.8rem; text-transform:uppercase; letter-spacing:.04em; }
.data-table td { padding:.65rem .75rem; border-bottom:1px solid rgba(255,255,255,.05); vertical-align:top; }
.data-table tr:last-child td { border-bottom:none; }
.product-cell { display:flex; flex-direction:column; gap:.15rem; }
.product-name { font-weight:500; }
.product-sku { font-size:.8rem; }
.mono { font-family:monospace; }
.reason-pill { display:inline-block; padding:.2rem .6rem; border-radius:.4rem; font-size:.75rem; font-weight:600; text-transform:uppercase; }
.reason-pill.manual { background:rgba(255,255,255,.1); color:#ccc; }
.reason-pill.order { background:rgba(99,179,237,.15); color:#63b3ed; }
.reason-pill.adjustment { background:rgba(246,173,85,.15); color:#f6ad55; }
.reason-pill.return { background:rgba(252,129,74,.15); color:#fc814a; }
.reason-pill.import { background:rgba(154,230,180,.15); color:#9ae6b4; }
.change-badge { display:inline-block; padding:.2rem .5rem; border-radius:.4rem; font-family:monospace; font-weight:700; font-size:.85rem; }
.change-badge.pos { background:rgba(72,187,120,.15); color:#48bb78; }
.change-badge.neg { background:rgba(245,101,101,.15); color:#f56565; }
.note-cell { display:flex; flex-direction:column; gap:.15rem; max-width:220px; }
.admin-name { font-size:.8rem; font-weight:600; }
.note-text { font-size:.8rem; }
.order-link { font-size:.8rem; color:var(--accent); text-decoration:none; }
.time-cell { font-size:.82rem; white-space:nowrap; }
.pagination { display:flex; align-items:center; gap:.75rem; justify-content:center; padding-top:1rem; border-top:1px solid rgba(255,255,255,.08); margin-top:.5rem; }
.page-info { font-size:.85rem; color:#888; }

/* Adjust panel */
.adjust-card h3 { margin:0 0 .25rem; }
.adjust-form { display:flex; flex-direction:column; gap:.75rem; position:relative; }
.product-results { background:hsl(228,4%,12%); border:1px solid rgba(255,255,255,.1); border-radius:.75rem; overflow:hidden; }
.product-result { display:flex; justify-content:space-between; gap:1rem; padding:.6rem 1rem; cursor:pointer; font-size:.9rem; transition:background .15s; }
.product-result:hover { background:rgba(255,255,255,.06); }
.selected-product { display:flex; flex-direction:column; gap:.75rem; padding:1rem; border-radius:.75rem; }
.sel-info { display:flex; gap:.75rem; align-items:center; flex-wrap:wrap; }
.adj-row { display:flex; gap:.5rem; flex-wrap:wrap; }
.adjust-result { padding:.5rem .75rem; border-radius:.5rem; font-size:.85rem; }
.adjust-result.ok { background:rgba(72,187,120,.15); color:#48bb78; }
.adjust-result.err { background:rgba(245,101,101,.15); color:#f56565; }
</style>
