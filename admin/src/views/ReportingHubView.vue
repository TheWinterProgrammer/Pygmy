<template>
  <div class="reporting-hub">
    <h1 class="page-title">Reporting Hub</h1>
    <p class="page-subtitle text-muted">Download all major reports and exports in one place.</p>

    <div class="report-grid">
      <!-- Revenue Reports -->
      <div class="report-card glass">
        <div class="rc-icon">💰</div>
        <h3 class="rc-title">Revenue Reports</h3>
        <p class="rc-desc text-muted">Daily revenue breakdown, totals, and trends.</p>
        <div class="rc-dates">
          <label class="label">Date range</label>
          <div class="date-row">
            <input type="date" v-model="revFrom" class="input input-sm" />
            <span class="text-muted">to</span>
            <input type="date" v-model="revTo" class="input input-sm" />
          </div>
        </div>
        <div class="rc-actions">
          <a :href="exportUrl('/api/revenue/export/csv', { from: revFrom, to: revTo })" class="btn btn-primary btn-sm">CSV</a>
          <a :href="exportUrl('/api/revenue/export/json', { from: revFrom, to: revTo })" class="btn btn-ghost btn-sm">JSON</a>
        </div>
      </div>

      <!-- Orders -->
      <div class="report-card glass">
        <div class="rc-icon">📦</div>
        <h3 class="rc-title">Orders</h3>
        <p class="rc-desc text-muted">Full order history with line items, status, and totals.</p>
        <div class="rc-dates">
          <label class="label">Date range</label>
          <div class="date-row">
            <input type="date" v-model="ordFrom" class="input input-sm" />
            <span class="text-muted">to</span>
            <input type="date" v-model="ordTo" class="input input-sm" />
          </div>
        </div>
        <div class="rc-actions">
          <a :href="exportUrl('/api/orders/export', { from: ordFrom, to: ordTo })" class="btn btn-primary btn-sm">CSV</a>
        </div>
      </div>

      <!-- Products -->
      <div class="report-card glass">
        <div class="rc-icon">🛍️</div>
        <h3 class="rc-title">Products</h3>
        <p class="rc-desc text-muted">All products with pricing, stock levels, and categories.</p>
        <div class="rc-actions">
          <a :href="exportUrl('/api/backup/products')" class="btn btn-primary btn-sm">CSV</a>
        </div>
      </div>

      <!-- Customers -->
      <div class="report-card glass">
        <div class="rc-icon">🧑‍💼</div>
        <h3 class="rc-title">Customers</h3>
        <p class="rc-desc text-muted">Customer list with order count and lifetime value.</p>
        <div class="rc-actions">
          <a :href="exportUrl('/api/backup/customers')" class="btn btn-primary btn-sm">CSV</a>
        </div>
      </div>

      <!-- Inventory -->
      <div class="report-card glass">
        <div class="rc-icon">🏭</div>
        <h3 class="rc-title">Inventory</h3>
        <p class="rc-desc text-muted">Current stock levels, SKU list, and low-stock items.</p>
        <div class="rc-actions">
          <a :href="exportUrl('/api/inventory/export')" class="btn btn-primary btn-sm">CSV</a>
        </div>
      </div>

      <!-- Tax Report -->
      <div class="report-card glass">
        <div class="rc-icon">🧮</div>
        <h3 class="rc-title">Tax Report</h3>
        <p class="rc-desc text-muted">Tax collected by rate and jurisdiction.</p>
        <div class="rc-dates">
          <label class="label">Date range</label>
          <div class="date-row">
            <input type="date" v-model="taxFrom" class="input input-sm" />
            <span class="text-muted">to</span>
            <input type="date" v-model="taxTo" class="input input-sm" />
          </div>
        </div>
        <div class="rc-actions">
          <a :href="exportUrl('/api/tax-report/export', { from: taxFrom, to: taxTo })" class="btn btn-primary btn-sm">CSV</a>
        </div>
      </div>

      <!-- Subscribers -->
      <div class="report-card glass">
        <div class="rc-icon">📨</div>
        <h3 class="rc-title">Newsletter Subscribers</h3>
        <p class="rc-desc text-muted">Email subscriber list with sign-up dates.</p>
        <div class="rc-actions">
          <a :href="exportUrl('/api/newsletter/export')" class="btn btn-primary btn-sm">CSV</a>
        </div>
      </div>

      <!-- Activity Log -->
      <div class="report-card glass">
        <div class="rc-icon">🕐</div>
        <h3 class="rc-title">Activity Log</h3>
        <p class="rc-desc text-muted">Admin activity log with timestamps and actions.</p>
        <div class="rc-actions">
          <a :href="exportUrl('/api/activity-log/export')" class="btn btn-primary btn-sm">CSV</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()

const today = new Date().toISOString().slice(0, 10)
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

const revFrom = ref(thirtyDaysAgo)
const revTo   = ref(today)
const ordFrom = ref(thirtyDaysAgo)
const ordTo   = ref(today)
const taxFrom = ref(thirtyDaysAgo)
const taxTo   = ref(today)

function exportUrl(base, params = {}) {
  const url = new URL(base, window.location.origin)
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v)
  }
  if (auth.token) url.searchParams.set('token', auth.token)
  return url.toString()
}
</script>

<style scoped>
.reporting-hub { max-width: 1100px; }
.page-title { font-size: 1.6rem; font-weight: 800; margin-bottom: .25rem; }
.page-subtitle { margin-bottom: 2rem; font-size: .92rem; }

.report-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.25rem;
}

.report-card {
  padding: 1.5rem;
  border-radius: 1rem;
  display: flex;
  flex-direction: column;
  gap: .6rem;
}

.rc-icon { font-size: 1.8rem; }
.rc-title { font-size: 1.05rem; font-weight: 700; margin: 0; }
.rc-desc { font-size: .83rem; line-height: 1.5; margin: 0; flex: 1; }

.rc-dates { display: flex; flex-direction: column; gap: .3rem; }
.rc-dates .label { font-size: .75rem; font-weight: 600; color: var(--text-muted); }
.date-row { display: flex; align-items: center; gap: .5rem; }
.date-row .input { flex: 1; font-size: .8rem; padding: .3rem .5rem; }

.rc-actions { display: flex; gap: .5rem; margin-top: .5rem; }
.rc-actions a { text-decoration: none; }
</style>
