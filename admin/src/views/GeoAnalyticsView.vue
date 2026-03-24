<template>
  <div class="geo-analytics-view">
    <div class="page-header">
      <div>
        <h1>🌍 Geographic Analytics</h1>
        <p class="subtitle">Sales and revenue breakdown by country and region</p>
      </div>
      <div class="header-actions">
        <select v-model="days" @change="load()" class="form-input" style="width:140px">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="60">Last 60 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading geographic data…</div>

    <template v-else-if="data">
      <!-- Summary cards -->
      <div class="stats-strip">
        <div class="stat-card">
          <div class="stat-value">{{ data.by_country.length }}</div>
          <div class="stat-label">Countries</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-value">{{ symbol }}{{ fmt(data.totals?.total_revenue) }}</div>
          <div class="stat-label">Total Revenue</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ data.totals?.total_orders || 0 }}</div>
          <div class="stat-label">Total Orders</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ data.by_country[0]?.country || '—' }}</div>
          <div class="stat-label">Top Country</div>
        </div>
      </div>

      <!-- Country table + detail panel -->
      <div class="two-col">
        <!-- Countries table -->
        <div class="glass section">
          <h3 style="margin:0 0 16px">Countries</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>Avg Order</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in data.by_country"
                :key="row.country"
                @click="loadCountry(row)"
                :class="{ active: selected?.country === row.country }"
                style="cursor:pointer"
              >
                <td>
                  <span class="flag">{{ flag(row.country) }}</span>
                  {{ row.country }}
                </td>
                <td>{{ row.order_count }}</td>
                <td>{{ symbol }}{{ fmt(row.revenue) }}</td>
                <td>{{ symbol }}{{ fmt(row.avg_order_value) }}</td>
                <td>
                  <div class="share-bar">
                    <div class="share-fill" :style="{ width: row.revenue_pct + '%' }"></div>
                    <span>{{ row.revenue_pct }}%</span>
                  </div>
                </td>
              </tr>
              <tr v-if="!data.by_country.length">
                <td colspan="5" style="text-align:center;color:#888;padding:30px">No orders found</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Country detail panel -->
        <div v-if="selected" class="glass section">
          <h3 style="margin:0 0 16px">
            <span class="flag">{{ flag(selected.country) }}</span>
            {{ selected.country }}
          </h3>

          <div v-if="countryLoading" style="color:#888;padding:20px">Loading…</div>
          <template v-else-if="countryData">
            <div class="mini-stats">
              <div class="mini-stat">
                <div class="mini-value">{{ countryData.stats.order_count }}</div>
                <div class="mini-label">Orders</div>
              </div>
              <div class="mini-stat">
                <div class="mini-value">{{ symbol }}{{ fmt(countryData.stats.revenue) }}</div>
                <div class="mini-label">Revenue</div>
              </div>
              <div class="mini-stat">
                <div class="mini-value">{{ symbol }}{{ fmt(countryData.stats.avg_order_value) }}</div>
                <div class="mini-label">Avg Order</div>
              </div>
              <div class="mini-stat">
                <div class="mini-value">{{ countryData.stats.completed }}</div>
                <div class="mini-label">Completed</div>
              </div>
            </div>

            <!-- Daily revenue chart -->
            <h4 style="margin:20px 0 10px;font-size:0.85rem;color:#ccc">Daily Revenue</h4>
            <div v-if="countryData.daily.length" class="bar-chart">
              <div
                v-for="d in countryData.daily"
                :key="d.day"
                class="bar-col"
                :title="`${d.day}: ${symbol}${fmt(d.revenue)}`"
              >
                <div
                  class="bar"
                  :style="{ height: barH(d.revenue, countryData.daily) }"
                ></div>
                <div class="bar-label">{{ d.day.slice(5) }}</div>
              </div>
            </div>
            <div v-else style="color:#888;font-size:0.85rem">No daily data available</div>

            <!-- Top products -->
            <h4 style="margin:20px 0 10px;font-size:0.85rem;color:#ccc">Top Products</h4>
            <div v-if="countryData.top_products.length" class="top-products">
              <div v-for="p in countryData.top_products" :key="p.product_name" class="top-product-row">
                <span>{{ p.product_name }}</span>
                <span class="ml-auto">{{ symbol }}{{ fmt(p.revenue) }}</span>
              </div>
            </div>
            <div v-else style="color:#888;font-size:0.85rem">No product data</div>
          </template>
        </div>

        <div v-else class="glass section" style="display:flex;align-items:center;justify-content:center;color:#888">
          <p>Click a country to see details</p>
        </div>
      </div>

      <!-- Top Cities -->
      <div v-if="data.cities.length" class="glass section" style="margin-top:24px">
        <h3 style="margin:0 0 16px">🏙️ Top Cities</h3>
        <div class="cities-grid">
          <div v-for="city in data.cities" :key="city.city + city.country" class="city-card glass">
            <div class="city-name">{{ city.city }}</div>
            <div class="city-country">{{ flag(city.country) }} {{ city.country }}</div>
            <div class="city-stats">
              <span>{{ city.order_count }} orders</span>
              <span class="accent-text">{{ symbol }}{{ fmt(city.revenue) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="glass section" style="text-align:center;color:#888;padding:40px">
      No geographic data available for this period.
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const days = ref('30')
const loading = ref(false)
const data = ref(null)
const selected = ref(null)
const countryLoading = ref(false)
const countryData = ref(null)
const symbol = ref('€')

async function load() {
  loading.value = true
  selected.value = null
  countryData.value = null
  try {
    const settings = await api.get('/api/settings')
    symbol.value = settings.data.shop_currency_symbol || '€'
    const res = await api.get(`/api/geo-analytics/overview?days=${days.value}`)
    data.value = res.data
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadCountry(row) {
  selected.value = row
  countryLoading.value = true
  countryData.value = null
  try {
    const code = row.country === 'Unknown' ? 'Unknown' : row.country
    const res = await api.get(`/api/geo-analytics/country/${encodeURIComponent(code)}?days=${days.value}`)
    countryData.value = res.data
  } catch (e) {
    console.error(e)
  } finally {
    countryLoading.value = false
  }
}

function fmt(n) {
  return Number(n || 0).toFixed(2)
}

function flag(code) {
  if (!code || code === 'Unknown' || code.length !== 2) return '🌐'
  return code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))
  )
}

function barH(val, arr) {
  const max = Math.max(...arr.map(d => d.revenue), 1)
  return Math.max(4, (val / max) * 120) + 'px'
}

onMounted(load)
</script>

<style scoped>
.geo-analytics-view { padding: 0; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.subtitle { color: #888; margin: 4px 0 0; font-size: 0.9rem; }
.stats-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; text-align: center; }
.stat-card.accent { border-color: rgba(224,85,96,0.4); background: rgba(224,85,96,0.08); }
.stat-value { font-size: 1.8rem; font-weight: 700; color: #fff; }
.stat-card.accent .stat-value { color: #e05560; }
.stat-label { font-size: 0.78rem; color: #888; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
.two-col { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; }
.glass { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; }
.section { padding: 24px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.data-table th { padding: 8px 10px; text-align: left; color: #888; font-weight: 500; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 0.8rem; }
.data-table td { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.data-table tr:hover td { background: rgba(255,255,255,0.03); }
.data-table tr.active td { background: rgba(224,85,96,0.08); }
.flag { margin-right: 6px; font-size: 1.1rem; }
.share-bar { display: flex; align-items: center; gap: 8px; }
.share-fill { height: 6px; background: #e05560; border-radius: 3px; min-width: 2px; }
.share-bar span { font-size: 0.8rem; color: #888; }
.mini-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 10px; }
.mini-stat { background: rgba(255,255,255,0.04); border-radius: 10px; padding: 12px; text-align: center; }
.mini-value { font-size: 1.2rem; font-weight: 700; color: #fff; }
.mini-label { font-size: 0.75rem; color: #888; margin-top: 2px; }
.bar-chart { display: flex; gap: 4px; align-items: flex-end; height: 130px; overflow-x: auto; padding-bottom: 4px; }
.bar-col { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; }
.bar { width: 20px; background: linear-gradient(180deg, #e05560, #c0392b); border-radius: 3px 3px 0 0; min-height: 4px; }
.bar-label { font-size: 0.6rem; color: #666; transform: rotate(-45deg); white-space: nowrap; }
.top-products { display: flex; flex-direction: column; gap: 8px; }
.top-product-row { display: flex; align-items: center; font-size: 0.85rem; padding: 6px 8px; background: rgba(255,255,255,0.03); border-radius: 6px; }
.ml-auto { margin-left: auto; font-weight: 600; color: #e05560; }
.cities-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.city-card { padding: 14px; border-radius: 10px; }
.city-name { font-weight: 600; font-size: 0.9rem; margin-bottom: 2px; }
.city-country { font-size: 0.78rem; color: #888; margin-bottom: 8px; }
.city-stats { display: flex; justify-content: space-between; font-size: 0.8rem; color: #ccc; }
.accent-text { color: #e05560; font-weight: 600; }
.loading { text-align: center; color: #888; padding: 60px; }
.form-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; padding: 8px 12px; font-family: inherit; }
.header-actions { display: flex; gap: 12px; align-items: center; }
</style>
