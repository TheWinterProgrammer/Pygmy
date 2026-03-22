<template>
  <div>
    <div class="page-header">
      <h1>📦 Product Bundles</h1>
      <RouterLink to="/bundles/new" class="btn btn-primary">+ New Bundle</RouterLink>
    </div>

    <div class="glass table-wrap">
      <div v-if="loading" class="loading-bar"></div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>Bundle</th>
            <th>Items</th>
            <th>Discount</th>
            <th>Original</th>
            <th>Bundle Price</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!bundles.length">
            <td colspan="7" class="empty">No bundles yet. Create your first bundle!</td>
          </tr>
          <tr v-for="b in bundles" :key="b.id">
            <td>
              <div class="prod-name">{{ b.name }}</div>
              <div class="prod-slug">/shop/bundles/{{ b.slug }}</div>
            </td>
            <td>{{ b.items?.length ?? 0 }} products</td>
            <td>
              <span class="discount-pill">
                {{ b.discount_type === 'percent' ? `${b.discount_value}%` : `${currency}${b.discount_value}` }} off
              </span>
            </td>
            <td class="text-muted">{{ currency }}{{ (b.original_total ?? 0).toFixed(2) }}</td>
            <td class="accent">{{ currency }}{{ (b.bundle_price ?? 0).toFixed(2) }}</td>
            <td><span :class="['status-pill', b.status]">{{ b.status }}</span></td>
            <td>
              <RouterLink :to="`/bundles/${b.id}`" class="btn btn-ghost btn-sm">✏️</RouterLink>
              <button class="btn btn-ghost btn-sm danger" @click="confirmDelete(b)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Delete confirm -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal glass">
        <h2>Delete Bundle?</h2>
        <p>Delete <strong>{{ deleteTarget.name }}</strong>? This cannot be undone.</p>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn btn-danger" @click="doDelete">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const bundles = ref([])
const loading = ref(true)
const currency = ref('€')
const deleteTarget = ref(null)

async function load() {
  loading.value = true
  try {
    const [bundlesRes, settingsRes] = await Promise.all([
      api.get('/bundles?all=1'),
      api.get('/settings'),
    ])
    bundles.value = bundlesRes.data
    currency.value = settingsRes.data.shop_currency_symbol || '€'
  } finally {
    loading.value = false
  }
}

function confirmDelete(b) { deleteTarget.value = b }
async function doDelete() {
  await api.delete(`/bundles/${deleteTarget.value.id}`)
  deleteTarget.value = null
  await load()
}

onMounted(load)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem; }
h1 { font-size: 1.4rem; font-weight: 800; margin: 0; }
.table-wrap { border-radius: 1rem; overflow: hidden; }
.table { width: 100%; border-collapse: collapse; font-size: 0.87rem; }
.table th { padding: 0.625rem 1rem; text-align: left; color: var(--text-muted); font-size: 0.78rem; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.06); }
.table td { padding: 0.625rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
.table tr:last-child td { border-bottom: none; }
.empty { text-align: center; color: var(--text-muted); padding: 2rem; }
.prod-name { font-weight: 600; }
.prod-slug { font-size: 0.75rem; color: var(--text-muted); }
.discount-pill { background: rgba(74,222,128,.12); color: rgb(74,222,128); padding: 0.2em 0.6em; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
.accent { color: var(--accent); font-weight: 700; }
.text-muted { color: var(--text-muted); }
.status-pill { display: inline-block; padding: 0.2em 0.6em; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
.status-pill.published { background: rgba(74,222,128,.12); color: rgb(74,222,128); }
.status-pill.draft { background: rgba(255,255,255,.07); color: #aaa; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { padding: 2rem; border-radius: 1.25rem; width: min(400px, 95vw); }
.modal h2 { margin: 0 0 1rem; font-size: 1.1rem; font-weight: 700; }
.modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
.danger { color: hsl(355,70%,60%); }
.btn-danger { background: hsl(355,70%,35%); color: #fff; padding: 0.55rem 1.25rem; border-radius: 0.625rem; border: none; cursor: pointer; font-weight: 600; }
</style>
