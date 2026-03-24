<template>
  <div class="stores-page">
    <!-- Hero -->
    <section class="stores-hero">
      <div class="hero-content">
        <h1 class="hero-title">📍 {{ siteSettings.store_locator_title || 'Find a Store' }}</h1>
        <p class="hero-sub" v-if="siteSettings.store_locator_subtitle">{{ siteSettings.store_locator_subtitle }}</p>
      </div>
    </section>

    <div class="container">
      <!-- Search / Filter -->
      <div class="search-bar glass">
        <span class="search-icon">🔍</span>
        <input
          v-model="q"
          @input="debounce(load, 350)"
          class="search-input"
          placeholder="Search by city, name, address…"
        />
        <select v-model="filterType" @change="load" class="type-select">
          <option value="">All Types</option>
          <option value="store">Stores</option>
          <option value="showroom">Showrooms</option>
          <option value="warehouse">Warehouses</option>
          <option value="popup">Pop-Ups</option>
          <option value="partner">Partners</option>
        </select>
      </div>

      <!-- Loading -->
      <div class="loading-bar" v-if="loading"></div>

      <!-- Results count -->
      <p class="results-meta" v-if="!loading && locations.length">
        {{ locations.length }} location{{ locations.length === 1 ? '' : 's' }} found
      </p>

      <!-- Grid -->
      <div class="stores-grid" v-if="locations.length">
        <div v-for="loc in locations" :key="loc.id" class="store-card glass">
          <div class="card-img" v-if="loc.cover_image">
            <img :src="loc.cover_image" :alt="loc.name" loading="lazy" />
          </div>
          <div class="card-img card-img-ph" v-else>
            <span>{{ typeEmoji(loc.type) }}</span>
          </div>

          <div class="card-body">
            <div class="card-top">
              <h2 class="store-name">{{ loc.name }}</h2>
              <span class="type-badge" :class="typeColor(loc.type)">{{ capitalize(loc.type) }}</span>
            </div>

            <p class="store-addr" v-if="loc.address || loc.city">
              📍 {{ [loc.address, loc.city, loc.zip, loc.country].filter(Boolean).join(', ') }}
            </p>
            <p class="store-phone" v-if="loc.phone">
              <a :href="`tel:${loc.phone}`">📞 {{ loc.phone }}</a>
            </p>
            <p class="store-email" v-if="loc.email">
              <a :href="`mailto:${loc.email}`">✉️ {{ loc.email }}</a>
            </p>
            <p class="store-desc" v-if="loc.description">{{ loc.description }}</p>

            <!-- Hours -->
            <div class="store-hours" v-if="hasHours(loc)">
              <h4 class="hours-title">Opening Hours</h4>
              <div class="hours-grid">
                <div v-for="(val, day) in loc.hours" :key="day" class="hours-row">
                  <span class="hours-day">{{ day }}</span>
                  <span class="hours-val" :class="{ 'hours-closed': val.toLowerCase().includes('closed') }">{{ val }}</span>
                </div>
              </div>
            </div>

            <div class="card-actions">
              <a
                v-if="loc.latitude && loc.longitude"
                :href="`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`"
                target="_blank"
                class="btn btn-outline"
              >🗺️ Get Directions</a>
              <a v-if="loc.website" :href="loc.website" target="_blank" class="btn btn-ghost">🔗 Website</a>
            </div>

            <!-- Map Embed -->
            <div class="map-embed" v-if="loc.map_embed" v-html="loc.map_embed"></div>
          </div>
        </div>
      </div>

      <!-- Empty -->
      <div class="empty-state glass" v-else-if="!loading">
        <div class="empty-icon">🔍</div>
        <h3>No locations found</h3>
        <p v-if="q || filterType">Try clearing your search filters</p>
        <p v-else>Check back soon for store locations near you.</p>
        <button v-if="q || filterType" class="btn btn-primary" @click="clearFilters">Clear Filters</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useSiteStore } from '../stores/site.js'
import api from '../api.js'

const site = useSiteStore()
const siteSettings = computed(() => site.settings || {})

const locations = ref([])
const loading = ref(false)
const q = ref('')
const filterType = ref('')

let debounceTimer = null
function debounce(fn, ms) {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(fn, ms)
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/store-locator', {
      params: { q: q.value || undefined, type: filterType.value || undefined, limit: 200 }
    })
    locations.value = data.locations
  } catch (e) {
    locations.value = []
  } finally { loading.value = false }
}

function clearFilters() { q.value = ''; filterType.value = ''; load() }

function typeEmoji(t) {
  const m = { store: '🏪', warehouse: '🏭', showroom: '🖼️', popup: '⛺', partner: '🤝' }
  return m[t] || '📍'
}
function typeColor(t) {
  const m = { store: 'tb-blue', warehouse: 'tb-orange', showroom: 'tb-purple', popup: 'tb-teal', partner: 'tb-gray' }
  return m[t] || 'tb-gray'
}
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : '' }
function hasHours(loc) { return loc.hours && typeof loc.hours === 'object' && Object.keys(loc.hours).length > 0 }

onMounted(() => { site.init(); load() })
</script>

<style scoped>
.stores-page { min-height: 100vh; padding-bottom: 4rem; }

.stores-hero {
  padding: 4rem 2rem 3rem;
  text-align: center;
  background: radial-gradient(ellipse at 50% 0%, rgba(var(--accent-rgb, 196,30,58),.12) 0%, transparent 70%);
}
.hero-title { font-size: clamp(1.8rem, 4vw, 2.8rem); font-weight: 700; margin: 0 0 .5rem; }
.hero-sub { color: var(--text-muted, #aaa); font-size: 1.1rem; margin: 0; }

.container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }

.search-bar {
  display: flex; align-items: center; gap: .75rem;
  padding: .75rem 1rem; border-radius: 2rem; margin-bottom: 2rem; flex-wrap: wrap;
}
.search-icon { font-size: 1rem; opacity: .6; }
.search-input {
  flex: 1 1 200px; background: none; border: none; outline: none;
  color: inherit; font-size: .95rem; font-family: inherit;
}
.type-select {
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
  border-radius: .5rem; padding: .4rem .75rem; color: inherit; font-size: .85rem;
}

.loading-bar { height: 2px; background: var(--accent); border-radius: 1px; margin-bottom: 1.5rem; animation: pulse 1s infinite; }
@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }

.results-meta { color: var(--text-muted, #aaa); font-size: .85rem; margin-bottom: 1rem; }

.stores-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }

.store-card { border-radius: 1.5rem; overflow: hidden; display: flex; flex-direction: column; transition: transform .2s; }
.store-card:hover { transform: translateY(-4px); }

.card-img { height: 180px; overflow: hidden; }
.card-img img { width: 100%; height: 100%; object-fit: cover; transition: transform .3s; }
.store-card:hover .card-img img { transform: scale(1.04); }
.card-img-ph { display: flex; align-items: center; justify-content: center; font-size: 3rem; background: rgba(255,255,255,.04); }

.card-body { padding: 1.25rem; flex: 1; display: flex; flex-direction: column; gap: .5rem; }
.card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: .5rem; }
.store-name { font-size: 1.1rem; font-weight: 600; margin: 0; }
.type-badge { font-size: .65rem; padding: .2rem .55rem; border-radius: .3rem; font-weight: 600; white-space: nowrap; }
.tb-blue { background: #1e3a5f; color: #93c5fd; }
.tb-orange { background: #451a03; color: #fb923c; }
.tb-purple { background: #2e1065; color: #c4b5fd; }
.tb-teal { background: #042f2e; color: #5eead4; }
.tb-gray { background: rgba(255,255,255,.1); color: #999; }

.store-addr, .store-phone, .store-email { font-size: .85rem; color: var(--text-muted, #aaa); margin: 0; }
.store-phone a, .store-email a { color: inherit; text-decoration: none; }
.store-phone a:hover, .store-email a:hover { color: var(--accent); }
.store-desc { font-size: .85rem; color: var(--text-muted, #aaa); margin: .25rem 0; }

.store-hours { background: rgba(255,255,255,.03); border-radius: .75rem; padding: .75rem; margin-top: .25rem; }
.hours-title { font-size: .75rem; font-weight: 600; margin: 0 0 .5rem; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted, #aaa); }
.hours-grid { display: grid; gap: .25rem; }
.hours-row { display: flex; justify-content: space-between; font-size: .8rem; }
.hours-day { font-weight: 500; }
.hours-val { color: var(--text-muted, #aaa); }
.hours-closed { color: #f87171; }

.card-actions { display: flex; gap: .5rem; margin-top: .5rem; flex-wrap: wrap; }
.btn { display: inline-flex; align-items: center; gap: .35rem; padding: .5rem 1rem; border-radius: 2rem; font-size: .85rem; font-weight: 500; cursor: pointer; text-decoration: none; border: none; transition: all .2s; }
.btn-outline { background: transparent; border: 1px solid rgba(255,255,255,.2); color: inherit; }
.btn-outline:hover { background: rgba(255,255,255,.06); border-color: var(--accent); color: var(--accent); }
.btn-ghost { background: rgba(255,255,255,.06); color: inherit; }
.btn-ghost:hover { background: rgba(255,255,255,.12); }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { opacity: .88; }

.map-embed { margin-top: .75rem; border-radius: .75rem; overflow: hidden; }
.map-embed :deep(iframe) { width: 100%; height: 200px; border: none; border-radius: .75rem; }

.empty-state { text-align: center; padding: 4rem 2rem; border-radius: 2rem; margin: 2rem 0; }
.empty-icon { font-size: 3rem; margin-bottom: 1rem; }
.empty-state h3 { margin: 0 0 .5rem; font-size: 1.3rem; }
.empty-state p { color: var(--text-muted, #aaa); margin: 0 0 1.5rem; }
</style>
