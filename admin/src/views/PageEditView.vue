<template>
  <div>
    <div class="page-header">
      <h1>{{ isNew ? 'New Page' : 'Edit Page' }}</h1>
      <div class="header-actions">
        <RouterLink to="/pages" class="btn btn-ghost">← Back</RouterLink>
        <button class="btn btn-primary" @click="save" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>

    <div class="edit-layout">
      <!-- Main content -->
      <div class="edit-main">
        <div class="glass section">
          <div class="form-group">
            <label>Page Title</label>
            <input v-model="form.title" class="input" placeholder="Page title" @input="autoSlug" />
          </div>
          <div class="form-group">
            <label>Content</label>
            <RichEditor v-model="form.content" placeholder="Write your page content…" />
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="edit-sidebar">
        <div class="glass section">
          <h3 style="margin-bottom:1rem;">Publish</h3>
          <div class="form-group">
            <label>Status</label>
            <select v-model="form.status" class="select">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div class="form-group">
            <label>Sort Order</label>
            <input v-model.number="form.sort_order" type="number" class="input" />
          </div>
        </div>

        <div class="glass section">
          <h3 style="margin-bottom:1rem;">URL</h3>
          <div class="form-group">
            <label>Slug</label>
            <input v-model="form.slug" class="input" placeholder="page-slug" />
          </div>
        </div>

        <div class="glass section">
          <h3 style="margin-bottom:1rem;">SEO</h3>
          <div class="form-group">
            <label>Meta Title</label>
            <input v-model="form.meta_title" class="input" placeholder="Page title for search engines" />
          </div>
          <div class="form-group">
            <label>Meta Description</label>
            <textarea v-model="form.meta_desc" class="input" rows="3" placeholder="Short description for SEO"></textarea>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'
import RichEditor from '../components/RichEditor.vue'

const route = useRoute()
const router = useRouter()
const toast = useToastStore()

const isNew = computed(() => route.params.id === undefined)
const saving = ref(false)
const slugManual = ref(false)

const form = ref({
  title: '',
  slug: '',
  content: '',
  status: 'draft',
  sort_order: 0,
  meta_title: '',
  meta_desc: ''
})

onMounted(async () => {
  if (!isNew.value) {
    const { data } = await api.get(`/pages?all=1`)
    const page = data.find(p => p.id == route.params.id)
    if (!page) { router.push('/pages'); return }
    Object.assign(form.value, page)
    slugManual.value = true
  }
})

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function autoSlug() {
  if (!slugManual.value) form.value.slug = slugify(form.value.title)
}

async function save() {
  if (!form.value.title) { toast.error('Title is required'); return }
  saving.value = true
  try {
    if (isNew.value) {
      await api.post('/pages', form.value)
      toast.success('Page created')
    } else {
      await api.put(`/pages/${route.params.id}`, form.value)
      toast.success('Page saved')
    }
    router.push('/pages')
  } catch (e) {
    toast.error(e.response?.data?.error || 'Save failed')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.header-actions { display: flex; gap: 0.5rem; }
.edit-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 1rem;
  align-items: start;
}
.section { padding: 1.25rem; margin-bottom: 1rem; }
@media (max-width: 768px) {
  .edit-layout { grid-template-columns: 1fr; }
}
</style>
