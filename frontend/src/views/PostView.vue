<template>
  <div class="post-page">
    <!-- Loading -->
    <div class="container skeleton-wrap" v-if="loading">
      <div class="skeleton-title"></div>
      <div class="skeleton-body glass"></div>
    </div>

    <!-- 404 -->
    <div class="container not-found" v-else-if="!post">
      <div class="glass not-found-card">
        <h1>404</h1>
        <p>Post not found.</p>
        <RouterLink to="/blog" class="btn btn-primary">← Back to Blog</RouterLink>
      </div>
    </div>

    <!-- Post content -->
    <article v-else class="container post-article">
      <!-- Cover -->
      <div class="cover-wrap" v-if="post.cover_image">
        <img :src="post.cover_image" :alt="post.title" class="cover-img" />
      </div>

      <!-- Header -->
      <header class="post-header">
        <div class="post-meta">
          <RouterLink
            v-if="post.category_name"
            :to="`/blog?category=${post.category_slug}`"
            class="tag"
          >{{ post.category_name }}</RouterLink>
          <span class="date">{{ formatDate(post.published_at || post.created_at) }}</span>
        </div>
        <h1 class="post-title">{{ post.title }}</h1>
        <p class="post-excerpt" v-if="post.excerpt">{{ post.excerpt }}</p>
      </header>

      <!-- Body -->
      <div class="glass post-body">
        <div class="prose" v-html="post.content"></div>
      </div>

      <!-- Tags -->
      <div class="post-tags" v-if="post.tags?.length">
        <span class="tags-label">Tags:</span>
        <RouterLink
          v-for="tag in post.tags"
          :key="tag"
          :to="`/blog?tag=${tag}`"
          class="pill"
        >#{{ tag }}</RouterLink>
      </div>

      <!-- Back -->
      <div class="post-footer">
        <RouterLink to="/blog" class="btn btn-outline">← All Posts</RouterLink>
      </div>
    </article>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSiteStore } from '../stores/site.js'
import api from '../api.js'

const site = useSiteStore()
const route = useRoute()
const post = ref(null)
const loading = ref(true)

async function load() {
  loading.value = true
  post.value = null
  try {
    const { data } = await api.get(`/posts/${route.params.slug}`)
    post.value = data
    // SEO
    const title = data.meta_title || data.title
    const desc  = data.meta_desc  || data.excerpt || ''
    document.title = `${title} — ${site.settings.site_name || 'Pygmy'}`
    setMeta('description', desc)
    if (data.cover_image) setMeta('og:image', data.cover_image, 'property')
    setMeta('og:title', title, 'property')
    setMeta('og:description', desc, 'property')
    setMeta('og:type', 'article', 'property')
  } catch {
    post.value = null
  }
  loading.value = false
}

function setMeta(name, content, attr = 'name') {
  let el = document.querySelector(`meta[${attr}="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

watch(() => route.params.slug, load)
onMounted(load)

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>

<style scoped>
.post-page {
  padding-top: 6rem;
  min-height: 100vh;
}

/* Skeleton */
.skeleton-wrap { padding: 2rem 1.5rem; }
.skeleton-title {
  height: 3rem;
  background: var(--surface2);
  border-radius: 0.75rem;
  width: 60%;
  margin-bottom: 1.5rem;
  animation: pulse 1.5s ease-in-out infinite;
}
.skeleton-body {
  height: 400px;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
}

/* 404 */
.not-found { padding: 4rem 1.5rem; }
.not-found-card {
  padding: 4rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}
.not-found-card h1 {
  font-size: 5rem;
  font-weight: 800;
  color: var(--accent);
}
.not-found-card p { color: var(--text-muted); }

/* Article layout */
.post-article {
  padding: 0 1.5rem 5rem;
  max-width: 800px;
}

.cover-wrap {
  width: 100%;
  max-height: 460px;
  overflow: hidden;
  border-radius: 1.5rem;
  margin-bottom: 2rem;
}
.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.post-header {
  margin-bottom: 2rem;
}
.post-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.tag {
  display: inline-block;
  padding: 0.22rem 0.7rem;
  background: hsl(355,70%,15%);
  color: var(--accent);
  border-radius: 2rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-decoration: none;
}
.tag:hover { background: hsl(355,70%,20%); text-decoration: none; }
.date { font-size: 0.82rem; color: var(--text-muted); }

.post-title {
  font-size: clamp(1.8rem, 4vw, 3rem);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.02em;
  margin-bottom: 0.75rem;
}
.post-excerpt {
  font-size: 1.1rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.post-body {
  padding: 2.5rem;
  margin-bottom: 2rem;
}

.post-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 2.5rem;
}
.tags-label {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin-right: 0.25rem;
}
.pill {
  padding: 0.22rem 0.7rem;
  border: 1px solid var(--border);
  border-radius: 2rem;
  font-size: 0.78rem;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.2s, border-color 0.2s;
}
.pill:hover {
  color: var(--accent);
  border-color: var(--accent);
  text-decoration: none;
}

.post-footer {
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}
</style>
