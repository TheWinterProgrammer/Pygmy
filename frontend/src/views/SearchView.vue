<template>
  <div class="search-page">
    <div class="container">
      <!-- Search bar -->
      <div class="search-hero">
        <h1 class="search-title">Search</h1>
        <div class="search-box glass">
          <span class="search-icon">🔍</span>
          <input
            ref="inputRef"
            v-model="query"
            type="search"
            placeholder="Search posts and pages…"
            @input="onInput"
            autocomplete="off"
          />
          <button v-if="query" class="clear-btn" @click="query = ''; results = null" aria-label="Clear">✕</button>
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
        <div class="empty-state" v-if="!results.posts.length && !results.pages.length && !results.products?.length">
          <p class="text-muted">No results found for <strong>"{{ results.query }}"</strong></p>
        </div>

        <template v-else>
          <!-- Posts -->
          <section v-if="results.posts.length" class="result-section">
            <h2 class="section-label">Posts ({{ results.posts.length }})</h2>
            <div class="results-grid">
              <RouterLink
                v-for="post in results.posts"
                :key="post.id"
                :to="`/blog/${post.slug}`"
                class="result-card glass"
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
          <section v-if="results.products?.length" class="result-section">
            <h2 class="section-label">Products ({{ results.products.length }})</h2>
            <div class="results-grid">
              <RouterLink
                v-for="p in results.products"
                :key="p.id"
                :to="`/shop/${p.slug}`"
                class="result-card glass"
              >
                <div class="result-cover" v-if="p.cover_image">
                  <img :src="p.cover_image" :alt="p.title" />
                </div>
                <div class="result-body">
                  <div class="result-type">🛍️ Product</div>
                  <h3 class="result-title" v-html="highlight(p.title)"></h3>
                  <p class="result-excerpt text-muted" v-if="p.excerpt" v-html="highlight(p.excerpt)"></p>
                  <div class="result-meta" v-if="p.price !== null">
                    <span class="tag" v-if="p.sale_price">${{ p.sale_price }}</span>
                    <span class="date text-muted" :style="p.sale_price ? 'text-decoration:line-through' : ''">${{ p.price }}</span>
                  </div>
                </div>
              </RouterLink>
            </div>
          </section>

          <!-- Pages -->
          <section v-if="results.pages.length" class="result-section">
            <h2 class="section-label">Pages ({{ results.pages.length }})</h2>
            <div class="results-grid results-grid-pages">
              <RouterLink
                v-for="page in results.pages"
                :key="page.id"
                :to="`/${page.slug}`"
                class="result-card glass"
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
      <div class="search-hint text-muted" v-else>
        <span>Start typing to search across all published content.</span>
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
let debounce = null

// Set page title
watch(() => site.settings.site_name, (name) => {
  document.title = `Search — ${name || 'Pygmy'}`
}, { immediate: true })

onMounted(() => {
  inputRef.value?.focus()
  if (query.value) doSearch()
})

function onInput() {
  clearTimeout(debounce)
  if (!query.value.trim() || query.value.trim().length < 2) {
    results.value = null
    return
  }
  debounce = setTimeout(doSearch, 300)
}

async function doSearch() {
  if (!query.value.trim() || query.value.trim().length < 2) return
  loading.value = true
  // Update URL
  router.replace({ path: '/search', query: { q: query.value } })
  try {
    const { data } = await api.get('/search', { params: { q: query.value, limit: 20 } })
    results.value = data
  } catch {
    results.value = { posts: [], pages: [], query: query.value }
  }
  loading.value = false
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
.search-page {
  padding-top: 6rem;
  min-height: 100vh;
}

.container {
  max-width: 900px;
  padding: 0 1.5rem 5rem;
}

.search-hero {
  margin-bottom: 2.5rem;
}
.search-title {
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: 1rem;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  border-radius: 2rem;
}
.search-icon { font-size: 1.1rem; color: var(--text-muted); }
.search-box input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-family: var(--font);
  font-size: 1rem;
  color: var(--text);
  min-width: 0;
}
.search-box input::placeholder { color: var(--text-muted); }
.clear-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.1rem 0.3rem;
  border-radius: 50%;
  transition: color 0.2s;
}
.clear-btn:hover { color: var(--text); }

/* Loading */
.loading-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 0;
  color: var(--text-muted);
}
.spinner {
  width: 20px; height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.text-muted { color: var(--text-muted); }

/* Empty / hint */
.empty-state,
.search-hint {
  padding: 1.5rem 0;
  font-size: 0.95rem;
}
.empty-state strong { color: var(--text); }

/* Section */
.result-section { margin-bottom: 2.5rem; }
.section-label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 0.9rem;
}

/* Grid */
.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}
.results-grid-pages {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

/* Card */
.result-card {
  display: flex;
  flex-direction: column;
  border-radius: 1rem;
  overflow: hidden;
  text-decoration: none;
  transition: transform 0.2s, box-shadow 0.2s;
}
.result-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.35);
  text-decoration: none;
}
.result-cover {
  height: 160px;
  overflow: hidden;
}
.result-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.result-body {
  padding: 1.1rem 1.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
}
.result-type {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}
.result-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.35;
}
.result-excerpt {
  font-size: 0.83rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.result-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}
.tag {
  font-size: 0.72rem;
  padding: 0.18rem 0.55rem;
  background: hsl(355,70%,15%);
  color: var(--accent);
  border-radius: 2rem;
  font-weight: 600;
}
.date { font-size: 0.75rem; }

/* Highlight mark */
:deep(mark) {
  background: hsl(355, 70%, 25%);
  color: hsl(355, 80%, 75%);
  border-radius: 2px;
  padding: 0 1px;
}
</style>
