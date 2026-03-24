<template>
  <div>
    <div class="page-header">
      <div>
        <h1>🤖 AI Content Helper</h1>
        <p class="subtitle">Generate product descriptions, blog excerpts, SEO meta tags, and title ideas using AI</p>
      </div>
    </div>

    <!-- AI Status Banner -->
    <div class="glass ai-status" :class="status.configured ? 'configured' : 'not-configured'">
      <div class="status-dot" :class="status.configured ? 'green' : 'red'"></div>
      <div>
        <strong>{{ status.configured ? `AI Ready — model: ${status.model}` : 'AI Not Configured' }}</strong>
        <span v-if="!status.configured" style="margin-left:.5rem;font-size:.85rem;opacity:.7">
          — Set up your API key in <RouterLink to="/settings#ai" class="link">Settings → AI Content</RouterLink>
        </span>
        <span v-else style="margin-left:.5rem;font-size:.85rem;opacity:.7">{{ status.api_url }}</span>
      </div>
    </div>

    <!-- Tool Tabs -->
    <div class="tabs-row">
      <button v-for="tab in tabs" :key="tab.id" class="tab-btn" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">
        {{ tab.icon }} {{ tab.label }}
      </button>
    </div>

    <!-- ── Product Description ───────────────────────────────────────── -->
    <div v-if="activeTab === 'product'" class="glass tool-panel">
      <h2>📦 Product Description Generator</h2>
      <p class="text-muted">Fill in product details and generate a compelling description.</p>

      <div class="form-row">
        <div class="form-group">
          <label>Product Name <span class="required">*</span></label>
          <input v-model="prod.name" class="input" placeholder="e.g. Wireless Noise-Cancelling Headphones" />
        </div>
        <div class="form-group">
          <label>Category</label>
          <input v-model="prod.category" class="input" placeholder="e.g. Electronics" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Price</label>
          <input v-model="prod.price" class="input" placeholder="e.g. 149.99" />
        </div>
        <div class="form-group">
          <label>Tone</label>
          <select v-model="prod.tone" class="input">
            <option value="professional">Professional</option>
            <option value="casual">Casual & Friendly</option>
            <option value="luxury">Luxury</option>
            <option value="technical">Technical</option>
            <option value="playful">Playful</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Tags / Key Features (comma-separated)</label>
        <input v-model="prod.tags" class="input" placeholder="e.g. wireless, 40h battery, ANC, USB-C" />
      </div>
      <div class="form-group">
        <label>Brief Description</label>
        <textarea v-model="prod.excerpt" class="input textarea-sm" placeholder="Short description of the product…" rows="2"></textarea>
      </div>

      <button class="btn btn-primary" @click="generateProductDesc" :disabled="generating || !prod.name">
        {{ generating ? '⏳ Generating…' : '✨ Generate Description' }}
      </button>

      <div v-if="prodResult" class="result-box">
        <div class="result-header">
          <span>Generated Description</span>
          <button class="btn btn-ghost btn-sm" @click="copyText(prodResult)">📋 Copy</button>
        </div>
        <div class="result-text">{{ prodResult }}</div>
        <div class="result-actions">
          <button class="btn btn-ghost btn-sm" @click="generateProductDesc">🔄 Regenerate</button>
        </div>
      </div>
      <div v-if="prodError" class="error-msg">{{ prodError }}</div>
    </div>

    <!-- ── Blog Excerpt ──────────────────────────────────────────────── -->
    <div v-if="activeTab === 'excerpt'" class="glass tool-panel">
      <h2>✍️ Blog Post Excerpt Generator</h2>
      <p class="text-muted">Generate a compelling 2-3 sentence excerpt for any blog post.</p>

      <div class="form-group">
        <label>Post Title <span class="required">*</span></label>
        <input v-model="post.title" class="input" placeholder="e.g. 10 Tips for Better Sleep in 2024" />
      </div>
      <div class="form-group">
        <label>Category</label>
        <input v-model="post.category" class="input" placeholder="e.g. Health & Wellness" />
      </div>
      <div class="form-group">
        <label>Content Preview (paste intro)</label>
        <textarea v-model="post.content" class="input" rows="4" placeholder="Paste the first few paragraphs of your post…"></textarea>
      </div>

      <button class="btn btn-primary" @click="generateExcerpt" :disabled="generating || !post.title">
        {{ generating ? '⏳ Generating…' : '✨ Generate Excerpt' }}
      </button>

      <div v-if="excerptResult" class="result-box">
        <div class="result-header">
          <span>Generated Excerpt</span>
          <button class="btn btn-ghost btn-sm" @click="copyText(excerptResult)">📋 Copy</button>
        </div>
        <div class="result-text">{{ excerptResult }}</div>
        <div class="char-count" :class="excerptResult.length > 160 ? 'over' : 'ok'">
          {{ excerptResult.length }} chars {{ excerptResult.length > 160 ? '(too long for meta)' : '(good)' }}
        </div>
        <button class="btn btn-ghost btn-sm" @click="generateExcerpt" style="margin-top:.5rem">🔄 Regenerate</button>
      </div>
      <div v-if="excerptError" class="error-msg">{{ excerptError }}</div>
    </div>

    <!-- ── Title Suggestions ─────────────────────────────────────────── -->
    <div v-if="activeTab === 'titles'" class="glass tool-panel">
      <h2>💡 Blog Title Idea Generator</h2>
      <p class="text-muted">Get a batch of creative, SEO-friendly blog post title ideas.</p>

      <div class="form-row">
        <div class="form-group">
          <label>Topic / Keyword <span class="required">*</span></label>
          <input v-model="titleTopic" class="input" placeholder="e.g. email marketing automation" />
        </div>
        <div class="form-group">
          <label>Category</label>
          <input v-model="titleCategory" class="input" placeholder="e.g. Marketing" />
        </div>
      </div>
      <div class="form-group">
        <label>Number of suggestions</label>
        <input v-model.number="titleCount" class="input" type="number" min="3" max="10" style="max-width:100px" />
      </div>

      <button class="btn btn-primary" @click="generateTitles" :disabled="generating || !titleTopic">
        {{ generating ? '⏳ Generating…' : '✨ Generate Titles' }}
      </button>

      <div v-if="titlesResult.length" class="result-box">
        <div class="result-header">
          <span>{{ titlesResult.length }} Title Ideas</span>
          <button class="btn btn-ghost btn-sm" @click="copyText(titlesResult.join('\n'))">📋 Copy All</button>
        </div>
        <ul class="titles-list">
          <li v-for="(t, i) in titlesResult" :key="i" class="title-item">
            <span class="title-num">{{ i + 1 }}</span>
            <span class="title-text">{{ t }}</span>
            <button class="btn btn-ghost btn-xs" @click="copyText(t)">📋</button>
          </li>
        </ul>
        <button class="btn btn-ghost btn-sm" @click="generateTitles" style="margin-top:.5rem">🔄 Regenerate</button>
      </div>
      <div v-if="titlesError" class="error-msg">{{ titlesError }}</div>
    </div>

    <!-- ── SEO Meta ──────────────────────────────────────────────────── -->
    <div v-if="activeTab === 'seo'" class="glass tool-panel">
      <h2>🔍 SEO Meta Generator</h2>
      <p class="text-muted">Generate optimized meta title and description for pages, posts, or products.</p>

      <div class="form-row">
        <div class="form-group">
          <label>Title <span class="required">*</span></label>
          <input v-model="seo.title" class="input" placeholder="e.g. Premium Leather Wallet — Handcrafted" />
        </div>
        <div class="form-group">
          <label>Entity Type</label>
          <select v-model="seo.entity_type" class="input">
            <option value="product">Product</option>
            <option value="page">Page</option>
            <option value="post">Blog Post</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Content (paste body text or description)</label>
        <textarea v-model="seo.content" class="input" rows="4" placeholder="Paste existing content to help AI understand the context…"></textarea>
      </div>

      <button class="btn btn-primary" @click="generateSeo" :disabled="generating || !seo.title">
        {{ generating ? '⏳ Generating…' : '✨ Generate Meta Tags' }}
      </button>

      <div v-if="seoResult" class="result-box">
        <div class="result-header"><span>Generated SEO Meta</span></div>
        <div class="seo-field">
          <div class="seo-label">Meta Title <span class="char-count" :class="(seoResult.meta_title||'').length > 60 ? 'over' : 'ok'">{{ (seoResult.meta_title||'').length }}/60</span></div>
          <div class="seo-value">{{ seoResult.meta_title }}</div>
          <button class="btn btn-ghost btn-xs" @click="copyText(seoResult.meta_title)">📋 Copy</button>
        </div>
        <div class="seo-field" style="margin-top:.75rem">
          <div class="seo-label">Meta Description <span class="char-count" :class="(seoResult.meta_description||'').length > 160 ? 'over' : 'ok'">{{ (seoResult.meta_description||'').length }}/160</span></div>
          <div class="seo-value">{{ seoResult.meta_description }}</div>
          <button class="btn btn-ghost btn-xs" @click="copyText(seoResult.meta_description)">📋 Copy</button>
        </div>
        <button class="btn btn-ghost btn-sm" @click="generateSeo" style="margin-top:.75rem">🔄 Regenerate</button>
      </div>
      <div v-if="seoError" class="error-msg">{{ seoError }}</div>
    </div>

    <!-- Copied toast -->
    <div v-if="copied" class="copy-toast">✅ Copied to clipboard!</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const status = ref({ configured: false, model: '', api_url: '' })
const activeTab = ref('product')
const generating = ref(false)
const copied = ref(false)

const tabs = [
  { id: 'product', icon: '📦', label: 'Product Description' },
  { id: 'excerpt', icon: '✍️', label: 'Blog Excerpt' },
  { id: 'titles',  icon: '💡', label: 'Title Ideas' },
  { id: 'seo',     icon: '🔍', label: 'SEO Meta' },
]

// Product description state
const prod = ref({ name: '', category: '', price: '', tags: '', excerpt: '', tone: 'professional' })
const prodResult = ref('')
const prodError = ref('')

// Blog excerpt state
const post = ref({ title: '', category: '', content: '' })
const excerptResult = ref('')
const excerptError = ref('')

// Title suggestions state
const titleTopic = ref('')
const titleCategory = ref('')
const titleCount = ref(5)
const titlesResult = ref([])
const titlesError = ref('')

// SEO meta state
const seo = ref({ title: '', content: '', entity_type: 'product' })
const seoResult = ref(null)
const seoError = ref('')

async function loadStatus() {
  try {
    const { data } = await api.get('/ai/status')
    status.value = data
  } catch {}
}

async function generateProductDesc() {
  if (!prod.value.name) return
  generating.value = true
  prodError.value = ''
  prodResult.value = ''
  try {
    const tags = prod.value.tags.split(',').map(t => t.trim()).filter(Boolean)
    const { data } = await api.post('/ai/product-description', {
      name: prod.value.name,
      category: prod.value.category,
      price: prod.value.price,
      excerpt: prod.value.excerpt,
      tags,
      tone: prod.value.tone,
    })
    prodResult.value = data.text
  } catch (e) {
    prodError.value = e.response?.data?.error || 'Generation failed'
  } finally {
    generating.value = false
  }
}

async function generateExcerpt() {
  if (!post.value.title) return
  generating.value = true
  excerptError.value = ''
  excerptResult.value = ''
  try {
    const { data } = await api.post('/ai/post-excerpt', {
      title: post.value.title,
      content: post.value.content,
      category: post.value.category,
    })
    excerptResult.value = data.text
  } catch (e) {
    excerptError.value = e.response?.data?.error || 'Generation failed'
  } finally {
    generating.value = false
  }
}

async function generateTitles() {
  if (!titleTopic.value) return
  generating.value = true
  titlesError.value = ''
  titlesResult.value = []
  try {
    const { data } = await api.post('/ai/title-suggestions', {
      topic: titleTopic.value,
      category: titleCategory.value,
      count: titleCount.value,
    })
    titlesResult.value = data.titles || []
  } catch (e) {
    titlesError.value = e.response?.data?.error || 'Generation failed'
  } finally {
    generating.value = false
  }
}

async function generateSeo() {
  if (!seo.value.title) return
  generating.value = true
  seoError.value = ''
  seoResult.value = null
  try {
    const { data } = await api.post('/ai/seo-meta', {
      title: seo.value.title,
      content: seo.value.content,
      entity_type: seo.value.entity_type,
    })
    seoResult.value = data
  } catch (e) {
    seoError.value = e.response?.data?.error || 'Generation failed'
  } finally {
    generating.value = false
  }
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2500)
  })
}

onMounted(loadStatus)
</script>

<style scoped>
.page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; }
.subtitle { color:#888; font-size:.9rem; margin:.25rem 0 0; }

.ai-status { display:flex; align-items:center; gap:.75rem; padding:.875rem 1.25rem; border-radius:1rem; margin-bottom:1.5rem; }
.ai-status.configured { border-color:rgba(74,222,128,.3); }
.ai-status.not-configured { border-color:rgba(248,113,113,.3); }
.status-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.status-dot.green { background:#4ade80; box-shadow:0 0 8px #4ade80; }
.status-dot.red { background:#f87171; box-shadow:0 0 8px #f87171; }
.link { color:var(--accent); text-decoration:none; }
.link:hover { text-decoration:underline; }

.tabs-row { display:flex; gap:.5rem; margin-bottom:1.5rem; flex-wrap:wrap; }
.tab-btn { padding:.5rem 1rem; border:1px solid rgba(255,255,255,.1); border-radius:.75rem; background:rgba(255,255,255,.05); color:#ddd; cursor:pointer; font-size:.9rem; transition:all .2s; }
.tab-btn:hover { border-color:rgba(255,255,255,.2); background:rgba(255,255,255,.08); }
.tab-btn.active { border-color:var(--accent); color:var(--accent); background:rgba(var(--accent-rgb),.1); }

.tool-panel { padding:1.75rem; border-radius:1.5rem; margin-bottom:1.5rem; }
.tool-panel h2 { margin:0 0 .35rem; font-size:1.2rem; }
.text-muted { color:#888; font-size:.9rem; margin-bottom:1.25rem; }

.form-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem; }
@media(max-width:640px) { .form-row { grid-template-columns:1fr; } }
.form-group { display:flex; flex-direction:column; gap:.35rem; margin-bottom:1rem; }
.form-group label { font-size:.85rem; font-weight:500; }
.required { color:var(--accent); }
.input { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); border-radius:.75rem; padding:.6rem .875rem; color:#fff; font-size:.9rem; width:100%; box-sizing:border-box; transition:border-color .2s; }
.input:focus { outline:none; border-color:var(--accent); }
.textarea-sm { resize:vertical; min-height:60px; }

.btn { padding:.5rem 1.25rem; border-radius:.75rem; border:none; cursor:pointer; font-size:.9rem; font-weight:500; transition:all .2s; }
.btn-primary { background:var(--accent); color:#fff; }
.btn-primary:hover:not(:disabled) { opacity:.85; }
.btn-primary:disabled { opacity:.5; cursor:not-allowed; }
.btn-ghost { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1); color:#ddd; }
.btn-ghost:hover { background:rgba(255,255,255,.12); }
.btn-sm { padding:.35rem .75rem; font-size:.82rem; }
.btn-xs { padding:.2rem .5rem; font-size:.78rem; }

.result-box { margin-top:1.25rem; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:1rem; overflow:hidden; }
.result-header { display:flex; justify-content:space-between; align-items:center; padding:.75rem 1rem; border-bottom:1px solid rgba(255,255,255,.07); font-weight:500; font-size:.9rem; }
.result-text { padding:1rem; font-size:.9rem; line-height:1.7; white-space:pre-wrap; color:#ddd; }
.result-actions { padding:.5rem 1rem; border-top:1px solid rgba(255,255,255,.07); }

.char-count { font-size:.78rem; }
.char-count.ok { color:#4ade80; }
.char-count.over { color:#f87171; }

.titles-list { list-style:none; margin:0; padding:0; }
.title-item { display:flex; align-items:center; gap:.75rem; padding:.6rem 1rem; border-bottom:1px solid rgba(255,255,255,.05); }
.title-item:last-child { border-bottom:none; }
.title-num { width:22px; height:22px; border-radius:50%; background:var(--accent); color:#fff; display:flex; align-items:center; justify-content:center; font-size:.75rem; font-weight:700; flex-shrink:0; }
.title-text { flex:1; font-size:.9rem; }

.seo-field { background:rgba(255,255,255,.04); border-radius:.75rem; padding:.875rem; }
.seo-label { font-size:.8rem; color:#888; font-weight:500; margin-bottom:.4rem; display:flex; align-items:center; gap:.5rem; }
.seo-value { font-size:.9rem; color:#ddd; margin-bottom:.5rem; line-height:1.5; }

.error-msg { margin-top:.75rem; background:rgba(248,113,113,.1); border:1px solid rgba(248,113,113,.3); border-radius:.75rem; padding:.75rem 1rem; color:#f87171; font-size:.9rem; }

.copy-toast { position:fixed; bottom:2rem; right:2rem; background:rgba(74,222,128,.9); color:#000; padding:.6rem 1.25rem; border-radius:.75rem; font-weight:600; font-size:.9rem; z-index:9999; animation:fadeInOut 2.5s forwards; }
@keyframes fadeInOut { 0%,100%{opacity:0;transform:translateY(8px)} 15%,85%{opacity:1;transform:translateY(0)} }
</style>
