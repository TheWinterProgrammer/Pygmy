<template>
  <div class="search-page">
    <div class="container">
      <!-- Search bar with suggestions -->
      <div class="search-hero">
        <h1 class="search-title">Search</h1>
        <div class="search-box-wrap">
          <div class="search-box glass" :class="{ focused: inputFocused }">
            <span class="search-icon">🔍</span>
            <input
              ref="inputRef"
              v-model="query"
              type="search"
              placeholder="Search posts, pages, products, events…"
              @input="onInput"
              @focus="inputFocused = true; onInput()"
              @blur="setTimeout(() => { inputFocused = false; showSuggestions = false }, 200)"
              @keydown.enter="doSearch(); showSuggestions = false"
              @keydown.escape="showSuggestions = false"
              autocomplete="off"
            />
            <button v-if="query" class="clear-btn" @click="query = ''; results = null; showSuggestions = false" aria-label="Clear">✕</button>
          </div>
          <!-- Autocomplete suggestions -->
          <div class="suggestions-dropdown glass" v-if="showSuggestions && suggestions.length">
            <button
              v-for="s in suggestions"
              :key="s"
              class="suggestion-item"
              @click="query = s; doSearch(); showSuggestions = false"
            >
              <span class="suggestion-icon">🔍</span>{{ s }}
            </button>
          </div>
        </div>
      </div>

      <!-- Filters bar -->
      <div class="filters-bar" v-if="results || loading">
        <div class="type-filters">
          <button
            v-for="f in typeFilters"
            :key="f.value"
            class="filter-btn"
            :class="{ active: activeType === f.value }"
            @click="activeType = f.value; applyFilters()"
          >
            {{ f.icon }} {{ f.label }}
            <span class="filter-count" v-if="getCount(f.value) > 0">{{ getCount(f.value) }}</span>
          </button>
        </div>
        <div class="sort-select">
          <label class="text-muted sort-label">Sort:</label>
          <select v-model="sortBy" @change="applyFilters()" class="input sort-input">
            <option value="relevance">Relevance</option>
            <option value="date">Date</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      <!-- Loading -->
      <div class="loading-row" v-if="loading">
        <div class="spinner"></div>
        <span class="text-muted">Searching…</span>
      </div>

      <!-- Results -->
      <template v-else-if="results">
        <!-- No results -->
        <div class="empty-state glass" v-if="!results.posts.length && !results.pages.length && !results.products?.length && !results.events?.length && !results.kb_articles?.length">
          <div class="empty-icon">🔎</div>
          <p>No results found for <strong>"{{ results.query }}"</strong></p>
          <p class="text-muted">Try different keywords or check your spelling.</p>
        </div>

        <template v-else>
          <!-- Posts -->
          <section v-if="shouldShow('posts') && results.posts.length" class="result-section">
            <h2 class="section-label">📝 Posts ({{ results.posts.length }})</h2>
            <div class="results-grid">
              <RouterLink
                v-for="post in results.posts"
                :key="post.id"
                :to="`/blog/${post.slug}`"
                class="result-card glass"
                @click="trackClick(post.slug, 'post')"
              >
                <div class="result-cover" v-if="post.cover_image">
                  <img :src="post.cover_image" :alt="post.title" />
                </div>
                <div class="result-body">
                  <div class="result-type">📝 Post</div>
                  <h3 class="result-title" v-html="highlight(post.title)"></h3>
                  <p class="result-excerpt text-muted" v-if="post.excerpt" v-html="highlight(post.excerpt)"></p>
                  <div class="result-meta">
                    <span v-if="post.category_name" class="tag">{{ post.category_name }}</span>
                    <span class="date text-muted">{{ formatDate(post.published_at) }}</span>
                  </div>
                </div>
              </RouterLink>
            </div>
          </section>

          <!-- Products -->
          <section v-if="shouldShow('products') && results.products?.length" class="result-section">
            <h2 class="section-label">🛍️ Products ({{ results.products.length }})</h2>
            <div class="results-grid">
              <RouterLink
                v-for="p in results.products"
                :key="p.id"
                :to="`/shop/${p.slug}`"
                class="result-card glass"
                @click="trackClick(p.slug, 'product')"
              >
                <div class="result-cover" v-if="p.cover_image">
                  <img :src="p.cover_image" :alt="p.title" />
                </div>
                <div class="result-body">
                  <div class="result-type">🛍️ Product</div>
                  <h3 class="result-title" v-html="highlight(p.title)"></h3>
                  <p class="result-excerpt text-muted" v-if="p.excerpt" v-html="highlight(p.excerpt)"></p>
                  <div class="result-meta" v-if="p.price !== null">
                    <span class="tag accent" v-if="p.sale_price">€{{ p.sale_price }}</span>
                    <span class="date text-muted" :style="p.sale_price ? 'text-decoration:line-through' : ''">€{{ p.price }}</span>
                  </div>
                </div>
              </RouterLink>
            </div>
          </section>

          <!-- Events -->
          <section v-if="shouldShow('events') && results.events?.length" class="result-section">
            <h2 class="section-label">📆 Events ({{ results.events.length }})</h2>
            <div class="results-grid">
              <RouterLink
                v-for="ev in results.events"
                :key="ev.id"
                :to="`/events/${ev.slug}`"
                class="result-card glass"
                @click="trackClick(ev.slug, 'event')"
              >
                <div class="result-cover" v-if="ev.cover_image">
                  <img :src="ev.cover_image" :alt="ev.title" />
                </div>
                <div class="result-body">
                  <div class="result-type">📆 Event</div>
                  <h3 class="result-title" v-html="highlight(ev.title)"></h3>
                  <p class="result-excerpt text-muted" v-if="ev.excerpt" v-html="highlight(ev.excerpt)"></p>
                  <div class="result-meta">
                    <span class="date text-muted" v-if="ev.start_date">{{ new Date(ev.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</span>
                    <span class="tag" v-if="ev.location">📍 {{ ev.location }}</span>
                  </div>
                </div>
              </RouterLink>
            </div>
          </section>

          <!-- KB Articles -->
          <section v-if="shouldShow('kb_articles') && results.kb_articles?.length" class="result-section">
            <h2 class="section-label">📚 Help Articles ({{ results.kb_articles.length }})</h2>
            <div class="results-grid results-grid-pages">
              <RouterLink
                v-for="kb in results.kb_articles"
                :key="kb.id"
                :to="`/help/${kb.slug}`"
                class="result-card glass"
                @click="trackClick(kb.slug, 'kb_article')"
              >
                <div class="result-body">
                  <div class="result-type">📚 Help Article</div>
                  <h3 class="result-title" v-html="highlight(kb.title)"></h3>
                  <p class="result-excerpt text-muted" v-if="kb.excerpt" v-html="highlight(kb.excerpt)"></p>
                </div>
              </RouterLink>
            </div>
          </section>

          <!-- Pages -->
          <section v-if="shouldShow('pages') && results.pages.length" class="result-section">
            <h2 class="section-label">📄 Pages ({{ results.pages.length }})</h2>
            <div class="results-grid results-grid-pages">
              <RouterLink
                v-for="page in results.pages"
                :key="page.id"
                :to="`/${page.slug}`"
                class="result-card glass"
                @click="trackClick(page.slug, 'page')"
              >
                <div class="result-body">
                  <div class="result-type">📄 Page</div>
                  <h3 class="result-title" v-html="highlight(page.title)"></h3>
                  <p class="result-excerpt text-muted" v-if="page.meta_desc" v-html="highlight(page.meta_desc)"></p>
                </div>
              </RouterLink>
            </div>
          </section>
        </template>
      </template>

      <!-- Initial state -->
      <div class="search-hint" v-else>
        <div class="hint-grid">
          <div class="hint-card glass" v-for="h in searchHints" :key="h.label" @click="query = h.query; doSearch()">
            <span class="hint-icon">{{ h.icon }}</span>
            <span>{{ h.label }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSiteStore } from '../stores/site.js'
import api from '../api.js'

const site = useSiteStore()
const route = useRoute()
const router = useRouter()

const inputRef = ref(null)
const query = ref(route.query.q || '')
const results = ref(null)
const loading = ref(false)
const inputFocused = ref(false)
const suggestions = ref([])
const showSuggestions = ref(false)
const activeType = ref('all')
const sortBy = ref('relevance')
const sessionId = localStorage.getItem('_pygmy_sid') || (() => {
  const id = Math.random().toString(36).slice(2)
  localStorage.setItem('_pygmy_sid', id)
  return id
})()

let debounce = null
let suggestDebounce = null

const typeFilters = [
  { value: 'all', label: 'All', icon: '🔍' },
  { value: 'posts', label: 'Posts', icon: '📝' },
  { value: 'products', label: 'Products', icon: '🛍️' },
  { value: 'events', label: 'Events', icon: '📆' },
  { value: 'kb_articles', label: 'Help', icon: '📚' },
  { value: 'pages', label: 'Pages', icon: '📄' },
]

const searchHints = [
  { icon: '🛍️', label: 'Browse Products', query: 'product' },
  { icon: '📝', label: 'Read Blog Posts', query: 'blog' },
  { icon: '📆', label: 'Find Events', query: 'event' },
]

function getCount(type) {
  if (!results.value) return 0
  if (type === 'all') return (results.value.total || 0)
  if (type === 'posts') return results.value.posts?.length || 0
  if (type === 'pages') return results.value.pages?.length || 0
  if (type === 'products') return results.value.products?.length || 0
  if (type === 'events') return results.value.events?.length || 0
  if (type === 'kb_articles') return results.value.kb_articles?.length || 0
  return 0
}

function shouldShow(type) {
  return activeType.value === 'all' || activeType.value === type
}

watch(() => site.settings.site_name, (name) => {
  document.title = `Search — ${name || 'Pygmy'}`
}, { immediate: true })

onMounted(() => {
  inputRef.value?.focus()
  if (query.value) doSearch()
})

function onInput() {
  clearTimeout(debounce)
  clearTimeout(suggestDebounce)

  if (!query.value.trim() || query.value.trim().length < 2) {
    results.value = null
    showSuggestions.value = false
    return
  }

  // Fetch suggestions quickly
  suggestDebounce = setTimeout(async () => {
    try {
      const r = await api.get('/search-analytics/suggestions', { params: { q: query.value, limit: 5 } })
      suggestions.value = r.data.suggestions || []
      showSuggestions.value = suggestions.value.length > 0 && inputFocused.value
    } catch { suggestions.value = [] }
  }, 150)

  debounce = setTimeout(doSearch, 350)
}

function applyFilters() {
  if (query.value.trim().length >= 2) doSearch()
}

async function doSearch() {
  if (!query.value.trim() || query.value.trim().length < 2) return
  loading.value = true
  showSuggestions.value = false
  router.replace({ path: '/search', query: { q: query.value } })
  try {
    const params = { q: query.value, limit: 20, session_id: sessionId, sort: sortBy.value }
    if (activeType.value !== 'all') params.type = activeType.value
    const { data } = await api.get('/search', { params })
    results.value = data
  } catch {
    results.value = { posts: [], pages: [], products: [], events: [], kb_articles: [], query: query.value, total: 0 }
  }
  loading.value = false
}

function trackClick(slug, type) {
  api.post('/search-analytics/click', { query: query.value.toLowerCase(), slug, type, session_id: sessionId }).catch(() => {})
}

function highlight(text) {
  if (!text || !query.value) return text
  const escaped = query.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>')
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.search-page { padding-top: 6rem; min-height: 100vh; }
.container { max-width: 960px; padding: 0 1.5rem 5rem; }

.search-hero { margin-bottom: 1.5rem; }
.search-title { font-size: clamp(1.8rem, 4vw, 2.8rem); font-weight: 800; letter-spacing: -0.02em; margin-bottom: 1rem; }

.search-box-wrap { position: relative; }
.search-box { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1.25rem; border-radius: 2rem; transition: border-color 0.2s; }
.search-box.focused { border-color: var(--accent); }
.search-icon { font-size: 1.1rem; color: var(--text-muted); }
.search-box input { flex: 1; background: none; border: none; outline: none; font-family: var(--font); font-size: 1rem; color: var(--text); min-width: 0; }
.search-box input::placeholder { color: var(--text-muted); }
.clear-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.9rem; padding: 0.1rem 0.3rem; border-radius: 50%; transition: color 0.2s; }
.clear-btn:hover { color: var(--text); }

.suggestions-dropdown { position: absolute; top: calc(100% + 6px); left: 0; right: 0; border-radius: 1rem; z-index: 100; overflow: hidden; }
.suggestion-item { display: flex; align-items: center; gap: 0.6rem; width: 100%; padding: 0.6rem 1.25rem; background: none; border: none; cursor: pointer; color: var(--text); font-size: 0.9rem; text-align: left; transition: background 0.15s; }
.suggestion-item:hover { background: rgba(255,255,255,0.07); }
.suggestion-icon { color: var(--text-muted); font-size: 0.85rem; }

.filters-bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.type-filters { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.filter-btn { display: flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.85rem; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); font-size: 0.82rem; cursor: pointer; transition: all 0.2s; font-family: var(--font); }
.filter-btn:hover { background: rgba(255,255,255,0.1); color: var(--text); }
.filter-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.filter-count { background: rgba(255,255,255,0.25); border-radius: 999px; padding: 0 0.35rem; font-size: 0.7rem; font-weight: 700; }
.sort-label { font-size: 0.8rem; }
.sort-select { display: flex; align-items: center; gap: 0.5rem; }
.sort-input { padding: 0.3rem 0.6rem; font-size: 0.82rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; color: var(--text); }

.loading-row { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 0; color: var(--text-muted); }
.spinner { width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.text-muted { color: var(--text-muted); }

.empty-state { text-align: center; padding: 3rem; border-radius: 1.5rem; margin: 1rem 0; }
.empty-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }

.search-hint { padding: 2rem 0; }
.hint-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.75rem; }
.hint-card { display: flex; align-items: center; gap: 0.6rem; padding: 0.85rem 1.1rem; border-radius: 1rem; cursor: pointer; transition: transform 0.15s, background 0.15s; font-size: 0.9rem; }
.hint-card:hover { transform: translateY(-2px); background: rgba(255,255,255,0.07); }
.hint-icon { font-size: 1.2rem; }

.result-section { margin-bottom: 2.5rem; }
.section-label { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0.9rem; }
.results-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
.results-grid-pages { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
.result-card { display: flex; flex-direction: column; border-radius: 1rem; overflow: hidden; text-decoration: none; transition: transform 0.2s, box-shadow 0.2s; }
.result-card:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,0,0,0.35); }
.result-cover { height: 160px; overflow: hidden; }
.result-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.result-body { padding: 1.1rem 1.3rem; display: flex; flex-direction: column; gap: 0.35rem; flex: 1; }
.result-type { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
.result-title { font-size: 1rem; font-weight: 700; color: var(--text); line-height: 1.35; }
.result-excerpt { font-size: 0.83rem; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.result-meta { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem; }
.tag { font-size: 0.72rem; padding: 0.18rem 0.55rem; background: hsl(355,70%,15%); color: var(--accent); border-radius: 2rem; font-weight: 600; }
.tag.accent { background: hsl(355,70%,18%); }
.date { font-size: 0.75rem; }
:deep(mark) { background: hsl(355, 70%, 25%); color: hsl(355, 80%, 75%); border-radius: 2px; padding: 0 1px; }
</style>
