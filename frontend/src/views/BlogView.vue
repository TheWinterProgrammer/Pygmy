<template>
  <div class="blog-page">
    <div class="blog-hero container">
      <h1>Blog</h1>
      <p class="subtitle" v-if="site.settings.site_tagline">{{ site.settings.site_tagline }}</p>
    </div>

    <!-- Filters -->
    <div class="filters container" v-if="categories.length">
      <button
        class="filter-btn"
        :class="{ active: !activeCategory }"
        @click="setCategory(null)"
      >All</button>
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="filter-btn"
        :class="{ active: activeCategory === cat.slug }"
        @click="setCategory(cat.slug)"
      >{{ cat.name }}</button>
    </div>

    <!-- Active tag badge -->
    <div class="container" v-if="activeTag" style="padding:0 1.5rem 1.5rem;">
      <span class="tag-filter-badge">
        #{{ activeTag }}
        <button @click="activeTag = null; load()" class="tag-clear">✕</button>
      </span>
    </div>

    <!-- Grid -->
    <div class="container posts-grid" v-if="posts.length">
      <RouterLink
        v-for="post in posts"
        :key="post.id"
        :to="`/blog/${post.slug}`"
        class="post-card glass"
      >
        <div class="card-img" v-if="post.cover_image">
          <img :src="post.cover_image" :alt="post.title" loading="lazy" />
        </div>
        <div class="card-img card-img-placeholder" v-else>✍️</div>
        <div class="card-body">
          <div class="card-meta">
            <span class="tag" v-if="post.category_name">{{ post.category_name }}</span>
            <span class="date">{{ formatDate(post.published_at || post.created_at) }}</span>
          </div>
          <h2 class="card-title">{{ post.title }}</h2>
          <p class="card-excerpt" v-if="post.excerpt">{{ post.excerpt }}</p>
          <div class="card-tags" v-if="post.tags?.length">
            <span class="pill" v-for="tag in post.tags" :key="tag">{{ tag }}</span>
          </div>
        </div>
      </RouterLink>
    </div>

    <!-- Loading skeleton -->
    <div class="container posts-grid" v-else-if="loading">
      <div class="skeleton glass" v-for="i in 6" :key="i"></div>
    </div>

    <!-- Empty -->
    <div class="container empty-state" v-else>
      <div class="glass" style="padding:3rem; text-align:center; color:var(--text-muted);">
        No posts found.
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination container" v-if="totalPages > 1">
      <button class="btn btn-outline" :disabled="page <= 1" @click="goPage(page - 1)">← Prev</button>
      <span class="page-info">{{ page }} / {{ totalPages }}</span>
      <button class="btn btn-outline" :disabled="page >= totalPages" @click="goPage(page + 1)">Next →</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSiteStore } from '../stores/site.js'
import api from '../api.js'

const site = useSiteStore()
const route = useRoute()
const router = useRouter()

const posts = ref([])
const total = ref(0)
const loading = ref(true)
const categories = ref([])
const activeCategory = ref(route.query.category || null)
const activeTag = ref(route.query.tag || null)
const page = ref(Number(route.query.page) || 1)
const perPage = computed(() => Number(site.settings.posts_per_page) || 10)
const totalPages = computed(() => Math.ceil(total.value / perPage.value))

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      limit: perPage.value,
      offset: (page.value - 1) * perPage.value,
    })
    if (activeCategory.value) params.set('category', activeCategory.value)
    if (activeTag.value) params.set('tag', activeTag.value)
    const { data } = await api.get(`/posts?${params}`)
    posts.value = data.posts
    total.value = data.total
  } catch {}
  loading.value = false
}

async function loadCategories() {
  const { data } = await api.get('/posts/categories')
  categories.value = data
}

function setCategory(slug) {
  activeCategory.value = slug
  activeTag.value = null
  page.value = 1
  router.replace({ query: { ...(slug ? { category: slug } : {}), page: 1 } })
}

function goPage(n) {
  page.value = n
  const q = { page: n }
  if (activeCategory.value) q.category = activeCategory.value
  if (activeTag.value) q.tag = activeTag.value
  router.replace({ query: q })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch([page, activeCategory, activeTag], load)
watch(() => route.query, (q) => {
  activeCategory.value = q.category || null
  activeTag.value = q.tag || null
  page.value = Number(q.page) || 1
})

onMounted(() => {
  document.title = `Blog — ${site.settings.site_name || 'Pygmy'}`
  loadCategories()
  load()
})

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.blog-page { padding-top: 7rem; min-height: 100vh; }

.blog-hero {
  padding: 2rem 1.5rem 1.5rem;
}
.blog-hero h1 { margin-bottom: 0.3rem; }
.subtitle { color: var(--text-muted); font-size: 1rem; }

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0 1.5rem 2rem;
}

.filter-btn {
  padding: 0.4rem 1rem;
  border-radius: 2rem;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}
.filter-btn:hover,
.filter-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.posts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  padding: 0 1.5rem 3rem;
}

.post-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  overflow: hidden;
  transition: transform 0.25s, box-shadow 0.25s;
}
.post-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.35);
  text-decoration: none;
}

.card-img {
  height: 200px;
  overflow: hidden;
  background: var(--surface2);
  border-radius: 1.25rem 1.25rem 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
}
.card-img img {
  width: 100%; height: 100%;
  object-fit: cover;
  transition: transform 0.4s;
}
.post-card:hover .card-img img { transform: scale(1.04); }

.card-body {
  padding: 1.25rem 1.4rem 1.5rem;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.card-meta { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.6rem; }

.tag {
  padding: 0.18rem 0.65rem;
  background: hsl(355,70%,15%);
  color: var(--accent);
  border-radius: 2rem;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.date { font-size: 0.78rem; color: var(--text-muted); }

.card-title {
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.35;
  margin-bottom: 0.55rem;
  color: var(--text);
}

.card-excerpt {
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.6;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.85rem;
}
.pill {
  padding: 0.18rem 0.6rem;
  border: 1px solid var(--border);
  border-radius: 2rem;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.skeleton {
  height: 320px;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
}

.empty-state { padding: 0 1.5rem 3rem; }

.tag-filter-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.75rem 0.3rem 1rem;
  border-radius: 2rem;
  background: hsl(355,70%,15%);
  color: var(--accent);
  font-size: 0.85rem;
  font-weight: 500;
}
.tag-clear {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--accent);
  font-size: 0.8rem;
  padding: 0;
  line-height: 1;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem 1.5rem 4rem;
}
.page-info { color: var(--text-muted); font-size: 0.88rem; }
.btn[disabled] { opacity: 0.4; cursor: not-allowed; }
</style>
