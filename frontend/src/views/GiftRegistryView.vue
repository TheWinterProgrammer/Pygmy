<template>
  <div class="registry-page">
    <SiteNav />
    <main>
      <!-- Header -->
      <section class="registry-hero">
        <h1>🎁 Gift Registries</h1>
        <p>Find and gift from a loved one's registry</p>

        <!-- Search -->
        <div class="search-bar">
          <input v-model="searchQ" @input="debounceSearch" placeholder="Search by registry name…" class="search-input" />
          <button @click="doSearch" class="btn-accent">Search</button>
        </div>
      </section>

      <!-- Results -->
      <section class="results-section" v-if="results.length">
        <h2>Registries Found</h2>
        <div class="registry-grid">
          <RouterLink v-for="reg in results" :key="reg.id" :to="`/gift-registry/${reg.slug}`" class="reg-card">
            <div class="reg-type">{{ typeEmoji(reg.event_type) }} {{ reg.event_type }}</div>
            <div class="reg-title">{{ reg.title }}</div>
            <div class="reg-date" v-if="reg.event_date">📅 {{ reg.event_date }}</div>
            <div class="reg-desc" v-if="reg.description">{{ reg.description?.substring(0, 100) }}</div>
            <div class="reg-footer">
              <span>{{ reg.item_count }} items</span>
              <span class="view-link">View Registry →</span>
            </div>
          </RouterLink>
        </div>
      </section>

      <section v-else-if="searched && !results.length" class="no-results">
        <p>No registries found matching "{{ searchQ }}"</p>
      </section>
    </main>
    <SiteFooter />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SiteNav from '../components/SiteNav.vue'
import SiteFooter from '../components/SiteFooter.vue'

const searchQ = ref('')
const results = ref([])
const searched = ref(false)
let debounceTimer = null

function typeEmoji (t) { return { wedding: '💍', baby: '👶', birthday: '🎂', other: '🎁' }[t] || '🎁' }
function debounceSearch () { clearTimeout(debounceTimer); debounceTimer = setTimeout(doSearch, 400) }

async function doSearch () {
  if (!searchQ.value.trim()) { results.value = []; searched.value = false; return }
  searched.value = true
  const res = await fetch(`/api/gift-registry/search?q=${encodeURIComponent(searchQ.value)}`)
  results.value = await res.json()
}
</script>

<style scoped>
.registry-page { min-height: 100vh; background: hsl(228,4%,10%); color: #fff; }
main { max-width: 960px; margin: 0 auto; padding: 6rem 1.5rem 4rem; }
.registry-hero { text-align: center; margin-bottom: 3rem; }
.registry-hero h1 { font-size: 2.5rem; font-weight: 800; margin-bottom: 0.5rem; }
.registry-hero p { color: rgba(255,255,255,0.5); margin-bottom: 2rem; }
.search-bar { display: flex; gap: 0.75rem; max-width: 480px; margin: 0 auto; }
.search-input { flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 0.75rem; padding: 0.75rem 1rem; color: #fff; font-family: inherit; font-size: 1rem; }
.btn-accent { background: var(--accent,#e03c3c); color: #fff; border: none; border-radius: 0.75rem; padding: 0.75rem 1.5rem; cursor: pointer; font-weight: 600; }

.results-section h2 { margin-bottom: 1.5rem; }
.registry-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
.reg-card { background: rgba(255,255,255,0.05); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.1); border-radius: 1.25rem; padding: 1.5rem; text-decoration: none; color: #fff; display: flex; flex-direction: column; gap: 0.5rem; transition: border-color 0.2s, transform 0.2s; }
.reg-card:hover { border-color: var(--accent,#e03c3c); transform: translateY(-2px); }
.reg-type { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.5); }
.reg-title { font-size: 1.1rem; font-weight: 700; }
.reg-date { font-size: 0.8rem; color: rgba(255,255,255,0.5); }
.reg-desc { font-size: 0.83rem; color: rgba(255,255,255,0.6); flex: 1; }
.reg-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; font-size: 0.78rem; color: rgba(255,255,255,0.5); }
.view-link { color: var(--accent,#e03c3c); font-weight: 600; }

.no-results { text-align: center; color: rgba(255,255,255,0.5); padding: 3rem 0; }
</style>
