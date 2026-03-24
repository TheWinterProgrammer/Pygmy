<template>
  <div class="category-page">
    <div class="container">
      <!-- Breadcrumb -->
      <nav class="breadcrumb">
        <router-link to="/help">Help Center</router-link>
        <span class="sep">›</span>
        <span>{{ category?.name || 'Category' }}</span>
      </nav>

      <!-- Category Header -->
      <div class="cat-header glass" v-if="category">
        <div class="cat-icon">{{ category.icon }}</div>
        <div>
          <h1 class="cat-name">{{ category.name }}</h1>
          <p class="cat-desc text-muted" v-if="category.description">{{ category.description }}</p>
        </div>
      </div>

      <div v-if="loading" class="loading text-muted">Loading…</div>
      <div v-else-if="!category" class="empty text-muted">Category not found.</div>

      <!-- Articles List -->
      <div v-else>
        <h2 class="articles-title">Articles ({{ articles.length }})</h2>
        <div v-if="articles.length" class="articles-list">
          <router-link
            v-for="a in articles"
            :key="a.id"
            :to="`/help/${a.slug}`"
            class="article-card glass"
          >
            <div class="article-main">
              <div class="article-title">{{ a.title }}</div>
              <p class="article-excerpt text-muted" v-if="a.excerpt">{{ a.excerpt }}</p>
            </div>
            <div class="article-meta text-muted">
              <span>👁 {{ a.views }}</span>
              <span>👍 {{ a.helpful_yes }}</span>
              <span class="arrow">→</span>
            </div>
          </router-link>
        </div>
        <p v-else class="empty text-muted">No articles in this category yet.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api.js'

const route = useRoute()
const loading = ref(true)
const category = ref(null)
const articles = ref([])

async function load() {
  loading.value = true
  try {
    const { data: cats } = await api.get('/kb/categories')
    category.value = cats.find(c => c.slug === route.params.slug) || null
    if (category.value) {
      const { data } = await api.get(`/kb/articles/public?category_id=${category.value.id}`)
      articles.value = data
    }
  } catch {
    category.value = null
  } finally {
    loading.value = false
  }
}

watch(() => route.params.slug, load)
onMounted(load)
</script>

<style scoped>
.category-page { padding: 3rem 0 5rem; }
.breadcrumb { font-size: .85rem; color: var(--text-muted); margin-bottom: 1.5rem; display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
.breadcrumb a { color: var(--accent); text-decoration: none; }
.breadcrumb a:hover { text-decoration: underline; }
.sep { color: var(--text-muted); }

.cat-header {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
  padding: 1.75rem;
  border-radius: 1.25rem;
  margin-bottom: 2.5rem;
}
.cat-icon { font-size: 3rem; }
.cat-name { font-size: 1.75rem; font-weight: 800; margin: 0 0 .4rem; }
.cat-desc { margin: 0; font-size: .95rem; line-height: 1.6; }

.articles-title { font-size: 1.1rem; font-weight: 600; margin: 0 0 1rem; color: var(--text-muted); }
.articles-list { display: flex; flex-direction: column; gap: .75rem; }
.article-card {
  padding: 1.25rem 1.5rem;
  border-radius: 1rem;
  text-decoration: none;
  color: var(--text);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  transition: transform .2s;
}
.article-card:hover { transform: translateX(4px); }
.article-main { flex: 1; min-width: 0; }
.article-title { font-weight: 700; font-size: .95rem; margin-bottom: .3rem; }
.article-excerpt { font-size: .83rem; margin: 0; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.article-meta { display: flex; align-items: center; gap: .75rem; font-size: .8rem; flex-shrink: 0; }
.arrow { font-size: 1rem; color: var(--accent); }
.loading, .empty { text-align: center; padding: 3rem; font-size: 1rem; }
</style>
