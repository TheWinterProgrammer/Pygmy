<template>
  <div class="kb-page">
    <div class="page-header">
      <h1>📚 Knowledge Base</h1>
      <button class="btn btn-primary" @click="$router.push('/knowledge-base/new')">➕ New Article</button>
    </div>

    <!-- Stats Strip -->
    <div class="stats-strip" v-if="stats">
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.total_articles }}</div>
        <div class="stat-label">Total Articles</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.published_articles }}</div>
        <div class="stat-label">Published</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.total_categories }}</div>
        <div class="stat-label">Categories</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-num">{{ stats.total_views }}</div>
        <div class="stat-label">Total Views</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button :class="['tab', activeTab === 'articles' && 'active']" @click="activeTab = 'articles'">📄 Articles</button>
      <button :class="['tab', activeTab === 'categories' && 'active']" @click="activeTab = 'categories'">🗂️ Categories</button>
    </div>

    <!-- Articles Tab -->
    <div v-if="activeTab === 'articles'" class="glass section">
      <div class="filters">
        <input v-model="articleQ" class="input" placeholder="Search articles…" style="max-width:260px;" />
        <select v-model="articleStatus" class="select" style="max-width:160px;">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
        <select v-model="articleCat" class="select" style="max-width:200px;">
          <option value="">All Categories</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.icon }} {{ c.name }}</option>
        </select>
      </div>

      <table class="table" v-if="filteredArticles.length">
        <thead>
          <tr>
            <th>Title</th>
            <th>Category</th>
            <th>Status</th>
            <th>Views</th>
            <th>Helpful</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in filteredArticles" :key="a.id">
            <td><span class="article-title">{{ a.title }}</span></td>
            <td>
              <span v-if="a.category_name" class="category-badge">{{ a.category_name }}</span>
              <span v-else class="text-muted">—</span>
            </td>
            <td>
              <span :class="['status-pill', `status-${a.status}`]">{{ a.status }}</span>
            </td>
            <td class="text-muted">{{ a.views }}</td>
            <td class="helpful-col">👍{{ a.helpful_yes }} 👎{{ a.helpful_no }}</td>
            <td class="actions">
              <button class="btn-icon" title="Edit" @click="$router.push(`/knowledge-base/${a.id}/edit`)">✏️</button>
              <button class="btn-icon danger" title="Delete" @click="deleteArticle(a)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty-msg text-muted">No articles found.</p>
    </div>

    <!-- Categories Tab -->
    <div v-if="activeTab === 'categories'">
      <div style="display:flex;justify-content:flex-end;margin-bottom:1rem;">
        <button class="btn btn-primary" @click="openCatModal()">➕ New Category</button>
      </div>
      <div class="cat-grid" v-if="categories.length">
        <div class="cat-card glass" v-for="c in categories" :key="c.id">
          <div class="cat-icon">{{ c.icon }}</div>
          <div class="cat-info">
            <div class="cat-name">{{ c.name }}</div>
            <div class="cat-desc text-muted">{{ c.description || 'No description' }}</div>
            <div class="cat-meta">
              <span class="meta-badge">{{ c.article_count }} articles</span>
              <span class="meta-badge" style="color:var(--text-muted);">order: {{ c.sort_order }}</span>
              <span :class="['active-badge', c.active ? 'active' : 'inactive']">{{ c.active ? 'Active' : 'Inactive' }}</span>
            </div>
          </div>
          <div class="cat-actions">
            <button class="btn-icon" @click="openCatModal(c)">✏️</button>
            <button class="btn-icon danger" @click="deleteCat(c)">🗑️</button>
          </div>
        </div>
      </div>
      <p v-else class="empty-msg text-muted">No categories yet.</p>
    </div>

    <!-- Category Modal -->
    <div v-if="showCatModal" class="modal-overlay" @click.self="showCatModal = false">
      <div class="modal glass">
        <h3>{{ catForm.id ? 'Edit Category' : 'New Category' }}</h3>
        <div class="form-group">
          <label>Name</label>
          <input v-model="catForm.name" class="input" placeholder="Category name" @input="autoSlugCat" />
        </div>
        <div class="form-group">
          <label>Slug</label>
          <input v-model="catForm.slug" class="input" placeholder="category-slug" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <input v-model="catForm.description" class="input" placeholder="Brief description" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Icon (emoji)</label>
            <input v-model="catForm.icon" class="input" placeholder="📖" style="font-size:1.5rem;max-width:80px;" />
          </div>
          <div class="form-group">
            <label>Color</label>
            <input v-model="catForm.color" class="input" placeholder="#e05562" style="max-width:120px;" />
          </div>
          <div class="form-group">
            <label>Sort Order</label>
            <input v-model.number="catForm.sort_order" type="number" class="input" style="max-width:80px;" />
          </div>
        </div>
        <div class="form-group checkbox-group">
          <label>
            <input type="checkbox" v-model="catForm.active" true-value="1" false-value="0" />
            Active
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="showCatModal = false">Cancel</button>
          <button class="btn btn-primary" @click="saveCat" :disabled="catSaving">
            {{ catSaving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api.js'

const router = useRouter()
const stats = ref(null)
const articles = ref([])
const categories = ref([])
const activeTab = ref('articles')
const articleQ = ref('')
const articleStatus = ref('')
const articleCat = ref('')

// Category modal
const showCatModal = ref(false)
const catSaving = ref(false)
const catForm = ref({ id: null, name: '', slug: '', description: '', icon: '📖', color: '#e05562', sort_order: 0, active: '1' })

const filteredArticles = computed(() => {
  return articles.value.filter(a => {
    if (articleStatus.value && a.status !== articleStatus.value) return false
    if (articleCat.value && a.category_id !== parseInt(articleCat.value)) return false
    if (articleQ.value && !a.title.toLowerCase().includes(articleQ.value.toLowerCase())) return false
    return true
  })
})

async function load() {
  const [s, art, cats] = await Promise.all([
    api.get('/kb/stats'),
    api.get('/kb/articles'),
    api.get('/kb/categories?all=1'),
  ])
  stats.value = s.data
  articles.value = art.data
  categories.value = cats.data
}

function autoSlugCat() {
  if (catForm.value.id) return
  catForm.value.slug = catForm.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function openCatModal(cat = null) {
  if (cat) {
    catForm.value = { id: cat.id, name: cat.name, slug: cat.slug, description: cat.description || '', icon: cat.icon || '📖', color: cat.color || '#e05562', sort_order: cat.sort_order || 0, active: String(cat.active ?? '1') }
  } else {
    catForm.value = { id: null, name: '', slug: '', description: '', icon: '📖', color: '#e05562', sort_order: 0, active: '1' }
  }
  showCatModal.value = true
}

async function saveCat() {
  if (!catForm.value.name.trim()) return
  catSaving.value = true
  try {
    const payload = { ...catForm.value, active: catForm.value.active === '1' ? 1 : 0 }
    if (catForm.value.id) {
      await api.put(`/kb/categories/${catForm.value.id}`, payload)
    } else {
      await api.post('/kb/categories', payload)
    }
    showCatModal.value = false
    await load()
  } catch (e) {
    alert(e.response?.data?.error || 'Failed to save category')
  } finally {
    catSaving.value = false
  }
}

async function deleteCat(cat) {
  if (!confirm(`Delete category "${cat.name}"?`)) return
  await api.delete(`/kb/categories/${cat.id}`)
  await load()
}

async function deleteArticle(a) {
  if (!confirm(`Delete article "${a.title}"?`)) return
  await api.delete(`/kb/articles/${a.id}`)
  await load()
}

onMounted(load)
</script>

<style scoped>
.kb-page { padding: 1.5rem 0; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.5rem; font-weight: 800; margin: 0; }

.stats-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card { padding: 1.25rem; border-radius: 1rem; text-align: center; }
.stat-num { font-size: 2rem; font-weight: 800; color: var(--accent); }
.stat-label { font-size: .8rem; color: var(--text-muted); margin-top: .25rem; text-transform: uppercase; letter-spacing: .06em; }

.tabs { display: flex; gap: .5rem; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,.08); padding-bottom: .5rem; }
.tab { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: .5rem 1rem; border-radius: .5rem; font-size: .9rem; font-weight: 600; transition: all .2s; }
.tab.active { background: var(--accent); color: white; }
.tab:hover:not(.active) { background: rgba(255,255,255,.06); color: var(--text); }

.section { padding: 1.5rem; border-radius: 1rem; }
.filters { display: flex; gap: .75rem; flex-wrap: wrap; margin-bottom: 1.25rem; align-items: center; }

.table { width: 100%; border-collapse: collapse; }
.table th { text-align: left; font-size: .75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; padding: .5rem .75rem; border-bottom: 1px solid rgba(255,255,255,.08); }
.table td { padding: .75rem; border-bottom: 1px solid rgba(255,255,255,.05); font-size: .88rem; vertical-align: middle; }
.article-title { font-weight: 600; }

.category-badge { background: rgba(255,255,255,.08); border-radius: 99px; padding: .15rem .6rem; font-size: .8rem; }
.status-pill { padding: .2rem .6rem; border-radius: 99px; font-size: .75rem; font-weight: 700; letter-spacing: .04em; text-transform: capitalize; }
.status-draft { background: rgba(255,255,255,.06); color: var(--text-muted); }
.status-published { background: rgba(72,187,120,.15); color: #48bb78; }
.helpful-col { font-size: .85rem; white-space: nowrap; }
.actions { display: flex; gap: .35rem; }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 1rem; padding: .25rem .4rem; border-radius: .35rem; transition: background .15s; }
.btn-icon:hover { background: rgba(255,255,255,.08); }
.btn-icon.danger:hover { background: rgba(245,101,101,.15); }
.empty-msg { text-align: center; padding: 2rem; }

/* Categories */
.cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
.cat-card { padding: 1.25rem; border-radius: 1rem; display: flex; gap: 1rem; align-items: flex-start; }
.cat-icon { font-size: 2.5rem; flex-shrink: 0; }
.cat-info { flex: 1; min-width: 0; }
.cat-name { font-weight: 700; font-size: 1rem; margin-bottom: .2rem; }
.cat-desc { font-size: .82rem; margin-bottom: .5rem; }
.cat-meta { display: flex; gap: .5rem; flex-wrap: wrap; }
.meta-badge { font-size: .75rem; background: rgba(255,255,255,.06); border-radius: 99px; padding: .1rem .5rem; }
.active-badge { font-size: .75rem; border-radius: 99px; padding: .1rem .5rem; font-weight: 600; }
.active-badge.active { background: rgba(72,187,120,.15); color: #48bb78; }
.active-badge.inactive { background: rgba(255,255,255,.06); color: var(--text-muted); }
.cat-actions { display: flex; flex-direction: column; gap: .25rem; flex-shrink: 0; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 100; display: flex; align-items: center; justify-content: center; }
.modal { padding: 2rem; border-radius: 1.5rem; width: 100%; max-width: 520px; }
.modal h3 { margin: 0 0 1.5rem; font-size: 1.2rem; }
.form-group { margin-bottom: 1rem; display: flex; flex-direction: column; gap: .3rem; }
.form-group label { font-size: .85rem; font-weight: 600; }
.form-row { display: flex; gap: 1rem; flex-wrap: wrap; }
.checkbox-group label { display: flex; align-items: center; gap: .5rem; cursor: pointer; }
.modal-actions { display: flex; gap: .5rem; justify-content: flex-end; margin-top: 1.5rem; }
</style>
