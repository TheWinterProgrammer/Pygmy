<template>
  <div class="authors-page container">
    <div class="page-header">
      <h1>✍️ Our Authors</h1>
      <p class="subtitle">Meet the writers behind the content</p>
    </div>

    <div class="loading-grid" v-if="loading">
      <div class="skeleton-card" v-for="n in 6" :key="n"></div>
    </div>

    <div v-else-if="authors.length === 0" class="empty-state glass">
      <p>No published authors yet.</p>
      <RouterLink to="/blog" class="btn-ghost">← Back to Blog</RouterLink>
    </div>

    <div v-else class="authors-grid">
      <RouterLink
        v-for="a in authors"
        :key="a.author_name"
        :to="`/blog/author/${encodeURIComponent(a.author_name)}`"
        class="author-card glass"
      >
        <div class="author-avatar">{{ a.author_name[0]?.toUpperCase() }}</div>
        <div class="author-info">
          <div class="author-name">{{ a.author_name }}</div>
          <div class="author-stats text-muted">
            {{ a.post_count }} post{{ a.post_count !== 1 ? 's' : '' }}
          </div>
          <div class="author-last text-muted" v-if="a.last_published_at">
            Last: {{ formatDate(a.last_published_at) }}
          </div>
        </div>
        <span class="read-link">View posts →</span>
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'
import { useHead } from '@vueuse/head'

useHead({ title: 'Authors', meta: [{ name: 'description', content: 'Meet our blog authors.' }] })

const authors = ref([])
const loading = ref(true)

async function load() {
  try {
    const { data } = await api.get('/posts/authors')
    authors.value = data
  } finally {
    loading.value = false
  }
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.authors-page { padding: 3rem 0 5rem; max-width: 1100px; margin: 0 auto; padding-inline: 1.5rem; }
.page-header { margin-bottom: 2.5rem; }
.page-header h1 { font-size: 2rem; margin: 0 0 .5rem; }
.subtitle { color: rgba(255,255,255,.5); margin: 0; }

.authors-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px,1fr)); gap: 1.25rem; }

.author-card {
  border-radius: 1rem; padding: 1.5rem;
  text-decoration: none; color: inherit;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: .75rem; transition: transform .2s;
}
.author-card:hover { transform: translateY(-3px); }

.author-avatar {
  width: 64px; height: 64px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), hsl(355,70%,40%));
  display: flex; align-items: center; justify-content: center;
  font-size: 1.75rem; font-weight: 800; color: #fff;
}

.author-name { font-size: 1rem; font-weight: 700; }
.author-stats { font-size: .8rem; }
.author-last { font-size: .75rem; }
.read-link { font-size: .8rem; color: var(--accent); font-weight: 600; margin-top: auto; }

.empty-state { text-align: center; padding: 2rem; max-width: 400px; margin: 2rem auto; border-radius: 1rem; }
.loading-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap: 1.25rem; }
.skeleton-card { border-radius: 1rem; background: rgba(255,255,255,.05); height: 180px; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:.8} }
</style>
