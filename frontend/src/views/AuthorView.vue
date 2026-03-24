<template>
  <div class="author-page">
    <!-- Author Hero -->
    <section class="author-hero" v-if="author">
      <div class="container">
        <div class="author-card glass">
          <div class="author-avatar">{{ author[0]?.toUpperCase() || '?' }}</div>
          <div class="author-info">
            <h1 class="author-name">{{ author }}</h1>
            <div class="author-meta">
              <span>✍️ {{ total }} published post{{ total !== 1 ? 's' : '' }}</span>
              <span v-if="lastPublished" class="sep">·</span>
              <span v-if="lastPublished">Last post: {{ formatDate(lastPublished) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Posts Grid -->
    <section class="author-posts container">
      <div class="loading-grid" v-if="loading">
        <div class="skeleton-card" v-for="n in 6" :key="n"></div>
      </div>

      <div v-else-if="posts.length === 0" class="empty-state glass">
        <div class="empty-icon">✍️</div>
        <h2>No posts yet</h2>
        <p>This author hasn't published any posts.</p>
        <RouterLink to="/blog" class="btn-accent">← Back to Blog</RouterLink>
      </div>

      <div v-else>
        <div class="posts-grid">
          <RouterLink
            v-for="post in posts"
            :key="post.id"
            :to="`/blog/${post.slug}`"
            class="post-card glass"
          >
            <div class="card-img" v-if="post.cover_image">
              <img :src="post.cover_image" :alt="post.title" loading="lazy" />
            </div>
            <div class="card-img card-img-placeholder" v-else>
              <span>✍️</span>
            </div>
            <div class="card-body">
              <div class="card-meta">
                <span class="tag" v-if="post.category_name">{{ post.category_name }}</span>
                <span class="date">{{ formatDate(post.published_at || post.created_at) }}</span>
              </div>
              <h2 class="card-title">{{ post.title }}</h2>
              <p class="card-excerpt" v-if="post.excerpt">{{ post.excerpt }}</p>
              <div class="card-tags" v-if="post.tags?.length">
                <span class="tag-pill" v-for="t in post.tags.slice(0, 3)" :key="t">{{ t }}</span>
              </div>
              <span class="read-more">Read more →</span>
            </div>
          </RouterLink>
        </div>

        <!-- Pagination -->
        <div class="pagination" v-if="total > perPage">
          <button class="btn-ghost" :disabled="page <= 1" @click="goPage(page - 1)">← Prev</button>
          <span class="page-info">Page {{ page }} of {{ totalPages }}</span>
          <button class="btn-ghost" :disabled="page >= totalPages" @click="goPage(page + 1)">Next →</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api.js'
import { useHead } from '@vueuse/head'

const route = useRoute()
const author = ref('')
const posts = ref([])
const total = ref(0)
const loading = ref(true)
const page = ref(1)
const perPage = 12
const lastPublished = ref(null)

const totalPages = computed(() => Math.ceil(total.value / perPage))

useHead(computed(() => ({
  title: author.value ? `Posts by ${author.value}` : 'Author',
  meta: [
    { name: 'description', content: author.value ? `Read all posts written by ${author.value}.` : '' }
  ]
})))

async function load() {
  loading.value = true
  const name = decodeURIComponent(route.params.name)
  author.value = name
  try {
    const { data } = await api.get(`/posts/author/${encodeURIComponent(name)}`, {
      params: { limit: perPage, offset: (page.value - 1) * perPage }
    })
    posts.value = data.posts
    total.value = data.total
    if (data.posts.length) {
      lastPublished.value = data.posts[0].published_at || data.posts[0].created_at
    }
  } finally {
    loading.value = false
  }
}

function goPage(p) {
  page.value = p
  window.scrollTo(0, 0)
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

onMounted(load)
watch(() => route.params.name, load)
watch(page, load)
</script>

<style scoped>
.author-page { min-height: 60vh; }

.author-hero {
  padding: 4rem 0 2rem;
  background: linear-gradient(180deg, hsl(228,4%,12%) 0%, transparent 100%);
}
.container { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }

.author-card {
  display: flex; align-items: center; gap: 1.5rem;
  padding: 1.5rem 2rem;
  border-radius: 1.25rem;
  max-width: 600px;
}

.author-avatar {
  width: 72px; height: 72px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), hsl(355,70%,40%));
  display: flex; align-items: center; justify-content: center;
  font-size: 2rem; font-weight: 800; color: #fff;
  flex-shrink: 0;
}

.author-name { font-size: 1.75rem; font-weight: 800; margin: 0 0 .4rem; }
.author-meta { display: flex; gap: .5rem; font-size: .9rem; color: rgba(255,255,255,.6); flex-wrap: wrap; }
.sep { opacity: .4; }

.author-posts { padding: 2.5rem 0 4rem; }

.posts-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1.5rem; margin-bottom: 2rem; }
@media (max-width: 900px) { .posts-grid { grid-template-columns: repeat(2,1fr); } }
@media (max-width: 600px) { .posts-grid { grid-template-columns: 1fr; } }

.post-card {
  border-radius: 1rem; overflow: hidden;
  text-decoration: none; color: inherit;
  transition: transform .2s, box-shadow .2s;
  display: flex; flex-direction: column;
}
.post-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,.3); }

.card-img { aspect-ratio: 16/9; overflow: hidden; }
.card-img img { width: 100%; height: 100%; object-fit: cover; transition: transform .3s; }
.post-card:hover .card-img img { transform: scale(1.04); }
.card-img-placeholder {
  background: rgba(255,255,255,.05);
  display: flex; align-items: center; justify-content: center;
  font-size: 2.5rem;
}

.card-body { padding: 1.25rem; flex: 1; display: flex; flex-direction: column; gap: .5rem; }
.card-meta { display: flex; gap: .5rem; align-items: center; }
.tag { font-size: .7rem; background: rgba(192,67,78,.2); color: var(--accent); padding: .15rem .5rem; border-radius: 100px; }
.date { font-size: .75rem; color: rgba(255,255,255,.5); margin-left: auto; }
.card-title { font-size: 1rem; font-weight: 700; line-height: 1.4; margin: 0; }
.card-excerpt { font-size: .85rem; color: rgba(255,255,255,.6); line-height: 1.5; flex: 1; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.card-tags { display: flex; gap: .3rem; flex-wrap: wrap; }
.tag-pill { font-size: .68rem; background: rgba(255,255,255,.06); padding: .1rem .4rem; border-radius: 100px; }
.read-more { font-size: .8rem; color: var(--accent); font-weight: 600; margin-top: auto; }

.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.5rem; }
.page-info { font-size: .85rem; color: rgba(255,255,255,.5); }

.empty-state { max-width: 400px; margin: 2rem auto; padding: 2.5rem; text-align: center; border-radius: 1.25rem; }
.empty-icon { font-size: 2.5rem; margin-bottom: 1rem; }
.empty-state h2 { margin: 0 0 .5rem; }
.empty-state p { color: rgba(255,255,255,.5); margin-bottom: 1.5rem; }

.loading-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1.5rem; }
.skeleton-card {
  border-radius: 1rem; background: rgba(255,255,255,.05);
  aspect-ratio: 4/5;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:.8} }
</style>
