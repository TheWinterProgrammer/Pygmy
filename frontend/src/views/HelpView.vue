<template>
  <div class="help-page">
    <!-- Hero -->
    <section class="hero">
      <div class="container hero-inner">
        <h1 class="hero-title">{{ settings.kb_title || 'Help Center' }}</h1>
        <p class="hero-sub">{{ settings.kb_subtitle || 'Find answers to your questions' }}</p>
        <form class="search-form" @submit.prevent="doSearch">
          <input
            v-model="searchQ"
            class="search-input"
            :placeholder="settings.kb_search_placeholder || 'Search for answers…'"
          />
          <button type="submit" class="search-btn">🔍 Search</button>
        </form>
      </div>
    </section>

    <div class="container">
      <!-- Search Results -->
      <div v-if="isSearching">
        <div class="section-header">
          <h2>Search results for "{{ route.query.q }}"</h2>
          <router-link to="/help" class="clear-search">✕ Clear search</router-link>
        </div>
        <div v-if="searchResults.length" class="articles-list">
          <router-link
            v-for="a in searchResults"
            :key="a.id"
            :to="`/help/${a.slug}`"
            class="article-card glass"
          >
            <div class="article-cat" v-if="a.category_name">{{ a.category_name }}</div>
            <div class="article-title">{{ a.title }}</div>
            <p class="article-excerpt text-muted" v-if="a.excerpt">{{ a.excerpt }}</p>
            <div class="article-meta text-muted">
              <span>👁 {{ a.views }}</span>
              <span>👍 {{ a.helpful_yes }}</span>
            </div>
          </router-link>
        </div>
        <p v-else class="empty text-muted">No results found for "{{ route.query.q }}"</p>
      </div>

      <!-- Normal Content -->
      <template v-else>
        <!-- Categories -->
        <div v-if="categories.length">
          <h2 class="section-title">Browse by Category</h2>
          <div class="cat-grid">
            <router-link
              v-for="c in categories"
              :key="c.id"
              :to="`/help/category/${c.slug}`"
              class="cat-card glass"
            >
              <div class="cat-icon">{{ c.icon }}</div>
              <div class="cat-name">{{ c.name }}</div>
              <p class="cat-desc text-muted">{{ c.description }}</p>
              <div class="cat-count">{{ c.article_count }} articles</div>
            </router-link>
          </div>
        </div>

        <!-- Popular Articles -->
        <div v-if="popular.length" class="popular-section">
          <h2 class="section-title">⭐ Popular Articles</h2>
          <div class="articles-list">
            <router-link
              v-for="a in popular"
              :key="a.id"
              :to="`/help/${a.slug}`"
              class="article-card glass"
            >
              <div class="article-cat" v-if="a.category_name">{{ a.category_icon }} {{ a.category_name }}</div>
              <div class="article-title">{{ a.title }}</div>
              <p class="article-excerpt text-muted" v-if="a.excerpt">{{ a.excerpt }}</p>
              <div class="article-meta text-muted">
                <span>👁 {{ a.views }}</span>
                <span>👍 {{ a.helpful_yes }}</span>
              </div>
            </router-link>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api.js'
import { useSiteStore } from '../stores/site.js'

const route = useRoute()
const router = useRouter()
const site = useSiteStore()
const settings = computed(() => site.settings || {})

const categories = ref([])
const popular = ref([])
const searchResults = ref([])
const searchQ = ref(route.query.q || '')
const isSearching = computed(() => !!route.query.q)

async function loadCategories() {
  const { data } = await api.get('/kb/categories')
  categories.value = data
}

async function loadPopular() {
  const { data } = await api.get('/kb/articles/public?limit=6')
  popular.value = data.slice(0, 6)
}

async function loadSearch(q) {
  const { data } = await api.get(`/kb/search?q=${encodeURIComponent(q)}`)
  searchResults.value = data
}

function doSearch() {
  if (!searchQ.value.trim()) return router.push('/help')
  router.push(`/help?q=${encodeURIComponent(searchQ.value.trim())}`)
}

watch(() => route.query.q, (q) => {
  searchQ.value = q || ''
  if (q) loadSearch(q)
}, { immediate: true })

onMounted(() => {
  loadCategories()
  loadPopular()
})
</script>

<style scoped>
.help-page { min-height: 100vh; padding-bottom: 5rem; }

.hero {
  background: linear-gradient(135deg, rgba(224,85,98,.15) 0%, transparent 60%);
  border-bottom: 1px solid rgba(255,255,255,.06);
  padding: 5rem 0 3.5rem;
  margin-bottom: 3rem;
}
.hero-inner { text-align: center; max-width: 700px; margin: 0 auto; }
.hero-title { font-size: 2.5rem; font-weight: 800; margin: 0 0 .75rem; }
.hero-sub { font-size: 1.1rem; color: var(--text-muted); margin: 0 0 2rem; }
.search-form { display: flex; gap: .5rem; max-width: 560px; margin: 0 auto; }
.search-input {
  flex: 1;
  padding: .75rem 1.25rem;
  border-radius: 2rem;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.15);
  color: var(--text);
  font-size: 1rem;
  outline: none;
}
.search-input:focus { border-color: var(--accent); }
.search-btn {
  padding: .75rem 1.5rem;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 2rem;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  transition: opacity .2s;
}
.search-btn:hover { opacity: .85; }

.section-title { font-size: 1.4rem; font-weight: 700; margin: 0 0 1.25rem; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
.section-header h2 { margin: 0; font-size: 1.2rem; }
.clear-search { color: var(--text-muted); font-size: .88rem; text-decoration: none; }
.clear-search:hover { color: var(--accent); }

.cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 3rem; }
.cat-card {
  padding: 1.5rem;
  border-radius: 1.25rem;
  text-decoration: none;
  color: var(--text);
  transition: transform .2s, box-shadow .2s;
  display: block;
}
.cat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 30px rgba(0,0,0,.25); }
.cat-icon { font-size: 2.5rem; margin-bottom: .75rem; }
.cat-name { font-weight: 700; font-size: 1.05rem; margin-bottom: .4rem; }
.cat-desc { font-size: .85rem; margin: 0 0 .75rem; line-height: 1.5; }
.cat-count { font-size: .8rem; color: var(--accent); font-weight: 600; }

.popular-section { margin-top: 2.5rem; }
.articles-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
.article-card {
  padding: 1.25rem;
  border-radius: 1rem;
  text-decoration: none;
  color: var(--text);
  display: block;
  transition: transform .2s;
}
.article-card:hover { transform: translateY(-2px); }
.article-cat { font-size: .75rem; color: var(--accent); font-weight: 600; text-transform: uppercase; letter-spacing: .06em; margin-bottom: .4rem; }
.article-title { font-weight: 700; font-size: .95rem; margin-bottom: .4rem; }
.article-excerpt { font-size: .83rem; margin: 0 0 .6rem; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.article-meta { display: flex; gap: .75rem; font-size: .78rem; }
.empty { text-align: center; padding: 3rem; font-size: 1rem; }
</style>
