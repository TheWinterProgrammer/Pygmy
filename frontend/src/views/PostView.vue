<template>
  <div class="post-page">
    <!-- Preview banner -->
    <div class="preview-banner" v-if="isPreview">
      👁 <strong>Preview mode</strong> — this content is not yet published. Only you can see it.
    </div>

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
          <span class="reading-time">{{ readingTime }} min read</span>
        </div>
        <h1 class="post-title">{{ post.title }}</h1>
        <p class="post-excerpt" v-if="post.excerpt">{{ post.excerpt }}</p>
      </header>

      <!-- Body -->
      <div class="glass post-body">
        <div class="prose" v-html="post.content"></div>
      </div>

      <!-- Tags + Share -->
      <div class="post-bottom-row">
        <div class="post-tags" v-if="post.tags?.length">
          <span class="tags-label">Tags:</span>
          <RouterLink
            v-for="tag in post.tags"
            :key="tag"
            :to="`/blog?tag=${tag}`"
            class="pill"
          >#{{ tag }}</RouterLink>
        </div>
        <div class="share-row">
          <span class="share-label">Share:</span>
          <a :href="shareTwitter" target="_blank" rel="noopener" class="share-btn share-x" title="Share on X / Twitter">𝕏</a>
          <a :href="shareLinkedIn" target="_blank" rel="noopener" class="share-btn share-li" title="Share on LinkedIn">in</a>
          <button class="share-btn share-copy" @click="copyLink" :title="copied ? 'Copied!' : 'Copy link'">
            {{ copied ? '✓' : '🔗' }}
          </button>
        </div>
      </div>

      <!-- Back -->
      <div class="post-footer">
        <RouterLink to="/blog" class="btn btn-outline">← All Posts</RouterLink>
      </div>

      <!-- Related Posts -->
      <section class="related-section" v-if="related.length">
        <h2 class="related-heading">You might also like</h2>
        <div class="related-grid">
          <RouterLink
            v-for="r in related"
            :key="r.id"
            :to="`/blog/${r.slug}`"
            class="related-card glass"
          >
            <div class="related-cover" v-if="r.cover_image">
              <img :src="r.cover_image" :alt="r.title" />
            </div>
            <div class="related-cover related-cover-placeholder" v-else></div>
            <div class="related-body">
              <div class="related-meta">
                <span class="tag" v-if="r.category_name">{{ r.category_name }}</span>
                <span class="date">{{ formatDate(r.published_at || r.created_at) }}</span>
              </div>
              <h3 class="related-title">{{ r.title }}</h3>
              <p class="related-excerpt" v-if="r.excerpt">{{ r.excerpt }}</p>
            </div>
          </RouterLink>
        </div>
      </section>

      <!-- Comments section -->
      <section class="comments-section" v-if="post">
        <h2 class="comments-heading">
          <span>💬 Comments</span>
          <span class="comment-count" v-if="comments.length">({{ comments.length }})</span>
        </h2>

        <!-- Approved comments -->
        <div class="comments-list" v-if="comments.length">
          <div class="comment glass" v-for="c in comments" :key="c.id">
            <div class="comment-avatar">{{ c.author_name[0].toUpperCase() }}</div>
            <div class="comment-inner">
              <div class="comment-header">
                <span class="comment-author">{{ c.author_name }}</span>
                <span class="comment-date">{{ formatDate(c.created_at) }}</span>
              </div>
              <p class="comment-text">{{ c.content }}</p>
            </div>
          </div>
        </div>
        <p class="no-comments text-muted" v-else>No comments yet. Be the first!</p>

        <!-- Submit form -->
        <div class="comment-form glass">
          <h3 class="form-heading">Leave a comment</h3>
          <form @submit.prevent="submitComment" v-if="!submitSuccess">
            <div class="form-row">
              <div class="form-group">
                <label>Name *</label>
                <input v-model="form.author_name" type="text" placeholder="Your name" required maxlength="80" />
              </div>
              <div class="form-group">
                <label>Email *</label>
                <input v-model="form.author_email" type="email" placeholder="your@email.com" required maxlength="120" />
                <span class="field-hint">Not displayed publicly</span>
              </div>
            </div>
            <div class="form-group">
              <label>Comment *</label>
              <textarea
                v-model="form.content"
                rows="4"
                placeholder="Write your comment..."
                required
                maxlength="2000"
              ></textarea>
            </div>
            <div class="form-footer">
              <button class="btn btn-primary" type="submit" :disabled="submitting">
                {{ submitting ? 'Sending…' : 'Post Comment' }}
              </button>
              <span class="submit-error text-error" v-if="submitError">{{ submitError }}</span>
            </div>
          </form>
          <div class="submit-success" v-else>
            <span class="success-icon">✅</span>
            <p>Your comment is awaiting moderation. Thank you!</p>
            <button class="btn btn-ghost btn-sm" @click="submitSuccess = false; form.content = ''">Post another</button>
          </div>
        </div>
      </section>
    </article>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSiteStore } from '../stores/site.js'
import api from '../api.js'

const site = useSiteStore()
const route = useRoute()
const post = ref(null)
const loading = ref(true)
const comments = ref([])
const related = ref([])
const copied = ref(false)
const isPreview = ref(false)

// Comment form state
const form = ref({ author_name: '', author_email: '', content: '' })
const submitting = ref(false)
const submitSuccess = ref(false)
const submitError = ref('')

// Reading time (avg 200 wpm)
const readingTime = computed(() => {
  if (!post.value?.content) return 1
  const plain = post.value.content.replace(/<[^>]*>/g, ' ')
  const words = plain.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
})

// Social share URLs
const shareTwitter = computed(() => {
  const url = encodeURIComponent(window.location.href)
  const text = encodeURIComponent(post.value?.title || '')
  return `https://twitter.com/intent/tweet?text=${text}&url=${url}`
})
const shareLinkedIn = computed(() => {
  const url = encodeURIComponent(window.location.href)
  return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
})

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {}
}

async function load() {
  loading.value = true
  post.value = null
  comments.value = []
  related.value = []
  submitSuccess.value = false
  try {
    const previewToken = route.query.preview_token || ''
    const config = previewToken ? { headers: { Authorization: `Bearer ${previewToken}` } } : {}
    const { data } = await api.get(`/posts/${route.params.slug}`, config)
    isPreview.value = !!data._preview
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
    // Load approved comments + related posts in parallel
    await Promise.all([
      loadComments(data.id),
      loadRelated(data.slug)
    ])
    // Track page view (fire-and-forget)
    api.post('/analytics/view', {
      entity_type: 'post',
      entity_id: data.id,
      entity_slug: data.slug,
      entity_title: data.title
    }).catch(() => {})
  } catch {
    post.value = null
  }
  loading.value = false
}

async function loadRelated(slug) {
  try {
    const { data } = await api.get(`/posts/${slug}/related`)
    related.value = data
  } catch {
    related.value = []
  }
}

async function loadComments(postId) {
  try {
    const { data } = await api.get('/comments', { params: { post_id: postId } })
    comments.value = data
  } catch {
    comments.value = []
  }
}

async function submitComment() {
  submitError.value = ''
  submitting.value = true
  try {
    await api.post('/comments', {
      post_id: post.value.id,
      author_name: form.value.author_name,
      author_email: form.value.author_email,
      content: form.value.content,
    })
    submitSuccess.value = true
    form.value = { author_name: form.value.author_name, author_email: form.value.author_email, content: '' }
  } catch (err) {
    submitError.value = err?.response?.data?.error || 'Failed to post comment. Please try again.'
  }
  submitting.value = false
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

.reading-time {
  font-size: 0.78rem;
  color: var(--text-muted);
  opacity: 0.8;
}
.reading-time::before { content: '·'; margin-right: 0.5rem; }

/* Tags + share row */
.post-bottom-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 2.5rem;
}
.post-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  flex: 1;
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

/* Social share */
.share-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}
.share-label {
  font-size: 0.82rem;
  color: var(--text-muted);
}
.share-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px; height: 34px;
  border-radius: 50%;
  font-size: 0.78rem;
  font-weight: 700;
  text-decoration: none;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05);
  color: var(--text);
  cursor: pointer;
  font-family: inherit;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.share-btn:hover { background: rgba(255,255,255,0.12); color: #fff; text-decoration: none; }
.share-x:hover { background: #000; border-color: #555; }
.share-li:hover { background: #0a66c2; border-color: #0a66c2; }
.share-copy:hover { background: var(--accent); border-color: var(--accent); }

.post-footer {
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  margin-bottom: 3rem;
}

/* Related posts */
.related-section { margin-top: 3.5rem; }
.related-heading {
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}
.related-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.25rem;
  margin-bottom: 3rem;
}
.related-card {
  border-radius: 1.25rem;
  overflow: hidden;
  text-decoration: none;
  color: var(--text);
  display: block;
  transition: transform 0.2s, box-shadow 0.2s;
}
.related-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 32px rgba(0,0,0,0.35);
  text-decoration: none;
  color: var(--text);
}
.related-cover {
  width: 100%;
  height: 140px;
  overflow: hidden;
  background: var(--surface2);
}
.related-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.related-cover-placeholder { background: linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%); }
.related-body { padding: 1rem; }
.related-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}
.related-title {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.35;
  margin-bottom: 0.4rem;
}
.related-excerpt {
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ─── Comments ─────────────────────────────────────────────────────────── */
.comments-section {
  margin-top: 3rem;
}

.comments-heading {
  font-size: 1.3rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}
.comment-count {
  font-size: 1rem;
  color: var(--text-muted);
  font-weight: 400;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.comment {
  display: flex;
  gap: 1rem;
  padding: 1.1rem 1.4rem;
  align-items: flex-start;
}
.comment-avatar {
  width: 38px; height: 38px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.comment-inner { flex: 1; }
.comment-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
}
.comment-author {
  font-weight: 600;
  font-size: 0.9rem;
}
.comment-date {
  font-size: 0.78rem;
  color: var(--text-muted);
}
.comment-text {
  font-size: 0.9rem;
  line-height: 1.65;
  white-space: pre-wrap;
}

.no-comments {
  margin-bottom: 2rem;
  font-size: 0.9rem;
}

/* Form */
.comment-form {
  padding: 2rem;
}
.form-heading {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1.25rem;
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
@media (max-width: 560px) {
  .form-row { grid-template-columns: 1fr; }
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
}
.form-group label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.form-group input,
.form-group textarea {
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--border);
  border-radius: 0.6rem;
  padding: 0.6rem 0.9rem;
  color: var(--text);
  font-family: var(--font);
  font-size: 0.9rem;
  transition: border-color 0.2s;
  width: 100%;
}
.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--accent);
}
.form-group textarea { resize: vertical; min-height: 100px; }
.field-hint { font-size: 0.73rem; color: var(--text-muted); }

.form-footer {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.text-error { font-size: 0.85rem; color: var(--accent); }

.submit-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 0;
  text-align: center;
}
.success-icon { font-size: 2rem; }
.submit-success p { color: var(--text-muted); }
</style>
