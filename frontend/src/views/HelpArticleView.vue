<template>
  <div class="article-page">
    <div class="container">
      <!-- Breadcrumb -->
      <nav class="breadcrumb">
        <router-link to="/help">Help Center</router-link>
        <span class="sep">›</span>
        <router-link v-if="article?.category_slug" :to="`/help/category/${article.category_slug}`">
          {{ article.category_name }}
        </router-link>
        <span v-else class="sep-text">Articles</span>
        <span class="sep">›</span>
        <span class="current">{{ article?.title || 'Article' }}</span>
      </nav>

      <div v-if="loading" class="loading text-muted">Loading…</div>
      <div v-else-if="!article" class="empty text-muted">Article not found.</div>

      <div v-else class="article-layout">
        <div class="article-main">
          <div class="glass article-card">
            <h1 class="article-title">{{ article.title }}</h1>
            <div class="article-meta text-muted">
              <span>👁 {{ article.views }} views</span>
              <span>{{ formatDate(article.created_at) }}</span>
            </div>

            <!-- Content -->
            <div class="prose" v-html="article.content"></div>

            <!-- Was this helpful? -->
            <div class="helpful-box">
              <div v-if="!voted">
                <p class="helpful-q">Was this article helpful?</p>
                <div class="helpful-btns">
                  <button class="helpful-btn yes" @click="vote('yes')">
                    👍 Yes ({{ article.helpful_yes }})
                  </button>
                  <button class="helpful-btn no" @click="vote('no')">
                    👎 No ({{ article.helpful_no }})
                  </button>
                </div>
              </div>
              <div v-else class="helpful-thanks">
                ✅ Thanks for your feedback!
              </div>
            </div>
          </div>

          <!-- Related Articles -->
          <div v-if="related.length" class="related-section">
            <h3 class="related-title">Related Articles</h3>
            <div class="related-list">
              <router-link
                v-for="r in related"
                :key="r.id"
                :to="`/help/${r.slug}`"
                class="related-card glass"
              >
                <span class="related-name">{{ r.title }}</span>
                <span class="arrow">→</span>
              </router-link>
            </div>
          </div>

          <div class="back-link">
            <router-link v-if="article.category_slug" :to="`/help/category/${article.category_slug}`">
              ← Back to {{ article.category_name }}
            </router-link>
            <router-link v-else to="/help">← Back to Help Center</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../api.js'

const route = useRoute()
const loading = ref(true)
const article = ref(null)
const related = ref([])
const voted = ref(false)

async function load() {
  loading.value = true
  voted.value = !!localStorage.getItem(`kb_vote_${route.params.slug}`)
  try {
    const { data } = await api.get(`/kb/articles/${route.params.slug}`)
    article.value = data
    if (data.category_id) {
      const { data: catArticles } = await api.get(`/kb/articles/public?category_id=${data.category_id}`)
      related.value = catArticles.filter(a => a.slug !== route.params.slug).slice(0, 3)
    }
  } catch {
    article.value = null
  } finally {
    loading.value = false
  }
}

async function vote(v) {
  if (voted.value) return
  try {
    await api.post(`/kb/articles/${route.params.slug}/helpful`, { vote: v })
    localStorage.setItem(`kb_vote_${route.params.slug}`, v)
    voted.value = true
    if (article.value) {
      if (v === 'yes') article.value.helpful_yes = (article.value.helpful_yes || 0) + 1
      else article.value.helpful_no = (article.value.helpful_no || 0) + 1
    }
  } catch {}
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

watch(() => route.params.slug, load)
onMounted(load)
</script>

<style scoped>
.article-page { padding: 3rem 0 5rem; }
.breadcrumb { font-size: .85rem; color: var(--text-muted); margin-bottom: 1.5rem; display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
.breadcrumb a { color: var(--accent); text-decoration: none; }
.breadcrumb a:hover { text-decoration: underline; }
.sep { color: var(--text-muted); }
.current { font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }

.article-layout { max-width: 780px; margin: 0 auto; }
.article-card { padding: 2.5rem; border-radius: 1.5rem; margin-bottom: 1.5rem; }
.article-title { font-size: 2rem; font-weight: 800; margin: 0 0 .75rem; line-height: 1.2; }
.article-meta { display: flex; gap: 1.25rem; font-size: .85rem; margin-bottom: 2rem; padding-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,.08); }

/* Prose content */
.prose { line-height: 1.8; font-size: .95rem; }
.prose :deep(h1), .prose :deep(h2), .prose :deep(h3) { font-weight: 700; margin: 1.5em 0 .6em; }
.prose :deep(h2) { font-size: 1.35rem; }
.prose :deep(h3) { font-size: 1.1rem; }
.prose :deep(p) { margin: 0 0 1em; }
.prose :deep(ul), .prose :deep(ol) { padding-left: 1.5rem; margin: 0 0 1em; }
.prose :deep(li) { margin-bottom: .35em; }
.prose :deep(a) { color: var(--accent); }
.prose :deep(code) { background: rgba(255,255,255,.08); padding: .15em .4em; border-radius: .3em; font-size: .9em; font-family: monospace; }
.prose :deep(pre) { background: rgba(255,255,255,.06); border-radius: .75rem; padding: 1rem 1.25rem; overflow-x: auto; margin: 0 0 1em; }
.prose :deep(blockquote) { border-left: 3px solid var(--accent); padding-left: 1rem; color: var(--text-muted); margin: 0 0 1em; }
.prose :deep(img) { max-width: 100%; border-radius: .5rem; }
.prose :deep(hr) { border: none; border-top: 1px solid rgba(255,255,255,.1); margin: 1.5em 0; }

/* Helpful box */
.helpful-box {
  margin-top: 2.5rem;
  padding: 1.5rem;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 1rem;
  text-align: center;
}
.helpful-q { font-weight: 600; margin: 0 0 1rem; font-size: 1rem; }
.helpful-btns { display: flex; gap: .75rem; justify-content: center; }
.helpful-btn {
  padding: .6rem 1.5rem;
  border-radius: 99px;
  border: 1px solid rgba(255,255,255,.15);
  background: rgba(255,255,255,.06);
  color: var(--text);
  cursor: pointer;
  font-size: .95rem;
  font-weight: 600;
  transition: all .2s;
}
.helpful-btn.yes:hover { background: rgba(72,187,120,.2); border-color: rgba(72,187,120,.4); }
.helpful-btn.no:hover { background: rgba(245,101,101,.15); border-color: rgba(245,101,101,.3); }
.helpful-thanks { font-size: 1rem; font-weight: 600; color: #48bb78; }

/* Related */
.related-section { margin-bottom: 1.5rem; }
.related-title { font-size: 1rem; font-weight: 700; margin: 0 0 .75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; }
.related-list { display: flex; flex-direction: column; gap: .5rem; }
.related-card {
  padding: 1rem 1.25rem;
  border-radius: .75rem;
  text-decoration: none;
  color: var(--text);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: transform .2s;
}
.related-card:hover { transform: translateX(4px); }
.related-name { font-weight: 600; font-size: .9rem; }
.arrow { color: var(--accent); }

.back-link { margin-top: 1rem; }
.back-link a { color: var(--text-muted); text-decoration: none; font-size: .9rem; }
.back-link a:hover { color: var(--accent); }

.loading, .empty { text-align: center; padding: 3rem; font-size: 1rem; }
</style>
