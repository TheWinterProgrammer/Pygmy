<template>
  <div class="page-view">
    <!-- Preview banner -->
    <div class="preview-banner" v-if="isPreview">
      👁 <strong>Preview mode</strong> — this page is not yet published. Only you can see it.
    </div>

    <!-- Loading -->
    <div class="container" v-if="loading" style="padding:8rem 1.5rem;">
      <div class="skeleton-title"></div>
      <div class="skeleton-body glass"></div>
    </div>

    <!-- 404 -->
    <div class="container not-found" v-else-if="!page">
      <div class="glass not-found-card">
        <h1>404</h1>
        <p>Page not found.</p>
        <RouterLink to="/" class="btn btn-primary">Go Home</RouterLink>
      </div>
    </div>

    <!-- Page content -->
    <template v-else>
      <!-- If blocks exist, render them full-width; show title if no hero block at top -->
      <div v-if="blocks.length">
        <div class="page-title-bar container" v-if="blocks[0]?.type !== 'hero'">
          <h1 class="page-title">{{ page.title }}</h1>
        </div>
        <BlockRenderer :blocks="blocks" />
        <!-- Classic content below blocks, if both exist -->
        <article v-if="page.content" class="container page-article" style="padding-top:0">
          <div class="glass page-body">
            <div class="prose" v-html="page.content"></div>
          </div>
        </article>
      </div>
      <!-- No blocks: classic layout -->
      <article v-else class="container page-article">
        <header class="page-header">
          <h1 class="page-title">{{ page.title }}</h1>
        </header>
        <div class="glass page-body">
          <div class="prose" v-html="page.content"></div>
        </div>
      </article>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSiteStore } from '../stores/site.js'
import api from '../api.js'
import BlockRenderer from '../components/BlockRenderer.vue'

const site = useSiteStore()
const route = useRoute()
const page    = ref(null)
const blocks  = ref([])
const loading = ref(true)
const isPreview = ref(false)

async function load() {
  loading.value = true
  page.value  = null
  blocks.value = []
  try {
    const previewToken = route.query.preview_token || ''
    const config = previewToken ? { headers: { Authorization: `Bearer ${previewToken}` } } : {}
    const { data } = await api.get(`/pages/${route.params.slug}`, config)
    isPreview.value = !!data._preview
    page.value = data

    // Load content blocks
    try {
      const { data: bData } = await api.get(`/page-blocks?page_id=${data.id}`)
      blocks.value = bData
    } catch { blocks.value = [] }
    // SEO
    const title = data.meta_title || data.title
    const desc  = data.meta_desc || ''
    document.title = `${title} — ${site.settings.site_name || 'Pygmy'}`
    setMeta('description', desc)
    setMeta('og:title', title, 'property')
    setMeta('og:description', desc, 'property')
    // Track page view
    api.post('/analytics/view', {
      entity_type: 'page',
      entity_id: data.id,
      entity_slug: data.slug,
      entity_title: data.title
    }).catch(() => {})
  } catch {
    page.value = null
    // Track 404
    api.post('/error-logs', {
      path: window.location.pathname,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
      status_code: 404
    }).catch(() => {})
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
</script>

<style scoped>
.preview-banner {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 9999;
  background: hsl(45, 90%, 40%);
  color: #000;
  text-align: center;
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
}
.page-view {
  padding-top: 6rem;
  min-height: 100vh;
}

.skeleton-title {
  height: 3rem;
  background: var(--surface2);
  border-radius: 0.75rem;
  width: 50%;
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

.page-title-bar {
  padding: 3rem 1.5rem 1rem;
}
.page-article {
  padding: 2rem 1.5rem 5rem;
  max-width: 800px;
}

.page-header {
  margin-bottom: 2rem;
}
.page-title {
  font-size: clamp(1.8rem, 4vw, 3rem);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.page-body {
  padding: 2.5rem;
}
</style>
