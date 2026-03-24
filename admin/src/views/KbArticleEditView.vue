<template>
  <div class="kb-edit">
    <div class="page-header">
      <button class="btn btn-ghost" @click="$router.push('/knowledge-base')">← Back</button>
      <h1>{{ isNew ? 'New Article' : 'Edit Article' }}</h1>
      <button class="btn btn-primary" @click="save" :disabled="saving">
        {{ saving ? 'Saving…' : (isNew ? 'Create' : 'Save Changes') }}
      </button>
    </div>

    <div class="edit-layout">
      <!-- Main content -->
      <div class="edit-main">
        <div class="glass section">
          <div class="form-group">
            <input v-model="form.title" class="title-input" placeholder="Article title…" @input="autoSlug" />
          </div>
          <div class="form-group">
            <label class="field-label">Slug</label>
            <input v-model="form.slug" class="input" placeholder="article-slug" />
          </div>
          <div class="form-group">
            <label class="field-label">Content</label>
            <RichEditor v-model="form.content" placeholder="Write your article…" />
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="edit-sidebar">
        <div class="glass section">
          <h3 class="section-title">Settings</h3>

          <div class="form-group">
            <label class="field-label">Category</label>
            <select v-model="form.category_id" class="select">
              <option :value="null">— No category —</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.icon }} {{ c.name }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="field-label">Status</label>
            <select v-model="form.status" class="select">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div class="form-group">
            <label class="field-label">Excerpt</label>
            <textarea v-model="form.excerpt" class="input" rows="3" placeholder="Short summary…"></textarea>
          </div>

          <div class="form-group">
            <label class="field-label">Sort Order</label>
            <input v-model.number="form.sort_order" type="number" class="input" />
          </div>

          <div class="form-group">
            <label class="field-label">Meta Title</label>
            <input v-model="form.meta_title" class="input" placeholder="SEO title…" />
          </div>

          <div class="form-group">
            <label class="field-label">Meta Description</label>
            <textarea v-model="form.meta_desc" class="input" rows="2" placeholder="SEO description…"></textarea>
          </div>

          <div v-if="!isNew" class="article-stats">
            <div class="stat-row"><span class="stat-lbl">Views</span><span>{{ form.views }}</span></div>
            <div class="stat-row"><span class="stat-lbl">👍 Helpful</span><span>{{ form.helpful_yes }}</span></div>
            <div class="stat-row"><span class="stat-lbl">👎 Not Helpful</span><span>{{ form.helpful_no }}</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api.js'
import RichEditor from '../components/RichEditor.vue'

const route = useRoute()
const router = useRouter()

const isNew = computed(() => !route.params.id)
const saving = ref(false)
const categories = ref([])

const form = ref({
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  status: 'draft',
  category_id: null,
  sort_order: 0,
  meta_title: '',
  meta_desc: '',
  views: 0,
  helpful_yes: 0,
  helpful_no: 0,
})

let slugEdited = false

function autoSlug() {
  if (slugEdited && form.value.slug) return
  form.value.slug = form.value.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function load() {
  const [catsRes] = await Promise.all([api.get('/kb/categories?all=1')])
  categories.value = catsRes.data

  if (!isNew.value) {
    const { data } = await api.get(`/kb/articles/admin/${route.params.id}`)
    form.value = {
      ...form.value,
      ...data,
      category_id: data.category_id || null,
    }
    slugEdited = true
  }
}

async function save() {
  if (!form.value.title.trim()) return alert('Title is required')
  saving.value = true
  try {
    const payload = {
      title: form.value.title,
      slug: form.value.slug || form.value.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      excerpt: form.value.excerpt,
      content: form.value.content,
      status: form.value.status,
      category_id: form.value.category_id || null,
      sort_order: form.value.sort_order,
      meta_title: form.value.meta_title || null,
      meta_desc: form.value.meta_desc || null,
    }
    if (isNew.value) {
      await api.post('/kb/articles', payload)
    } else {
      await api.put(`/kb/articles/${route.params.id}`, payload)
    }
    router.push('/knowledge-base')
  } catch (e) {
    alert(e.response?.data?.error || 'Failed to save article')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.kb-edit { padding: 1.5rem 0; }
.page-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.4rem; font-weight: 800; margin: 0; flex: 1; }

.edit-layout { display: grid; grid-template-columns: 1fr 340px; gap: 1.5rem; align-items: flex-start; }
.edit-main { min-width: 0; }
.edit-sidebar { min-width: 0; }
.section { padding: 1.5rem; border-radius: 1rem; }
.section-title { font-size: .9rem; font-weight: 700; margin: 0 0 1rem; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); }

.title-input { width: 100%; font-size: 1.5rem; font-weight: 700; background: transparent; border: none; outline: none; color: var(--text); padding: .5rem 0; margin-bottom: .75rem; border-bottom: 1px solid rgba(255,255,255,.1); }
.title-input::placeholder { color: var(--text-muted); }

.form-group { margin-bottom: 1rem; display: flex; flex-direction: column; gap: .3rem; }
.field-label { font-size: .8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; }

.article-stats { margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,.08); display: flex; flex-direction: column; gap: .5rem; }
.stat-row { display: flex; justify-content: space-between; font-size: .88rem; }
.stat-lbl { color: var(--text-muted); }

@media (max-width: 900px) {
  .edit-layout { grid-template-columns: 1fr; }
}
</style>
