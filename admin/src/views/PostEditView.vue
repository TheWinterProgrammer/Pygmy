<template>
  <div>
    <div class="page-header">
      <h1>{{ isNew ? 'New Post' : 'Edit Post' }}</h1>
      <div class="header-actions">
        <RouterLink to="/posts" class="btn btn-ghost">← Back</RouterLink>
        <button class="btn btn-ghost" @click="saveDraft" :disabled="saving">Save Draft</button>
        <button class="btn btn-primary" @click="publish" :disabled="saving">
          {{ form.status === 'published' ? 'Update' : 'Publish' }}
        </button>
      </div>
    </div>

    <div class="edit-layout">
      <div class="edit-main">
        <div class="glass section">
          <div class="form-group">
            <label>Post Title</label>
            <input v-model="form.title" class="input" placeholder="Post title" @input="autoSlug" />
          </div>
          <div class="form-group">
            <label>Excerpt</label>
            <textarea v-model="form.excerpt" class="input" rows="2" placeholder="Short summary shown in listings…"></textarea>
          </div>
          <div class="form-group">
            <label>Content</label>
            <RichEditor v-model="form.content" placeholder="Write your post…" />
          </div>
        </div>
      </div>

      <div class="edit-sidebar">
        <div class="glass section">
          <h3 style="margin-bottom:1rem;">Status</h3>
          <div class="form-group">
            <label>Status</label>
            <select v-model="form.status" class="select">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        <div class="glass section">
          <h3 style="margin-bottom:1rem;">Category & Tags</h3>
          <div class="form-group">
            <label>Category</label>
            <select v-model="form.category_id" class="select">
              <option :value="null">— None —</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Tags <small style="color:var(--text-muted)">(comma separated)</small></label>
            <input v-model="tagsInput" class="input" placeholder="tag1, tag2, tag3" />
          </div>

          <div class="new-cat">
            <input v-model="newCatName" class="input" placeholder="New category…" />
            <button type="button" class="btn btn-ghost btn-sm" @click="addCategory">Add</button>
          </div>
        </div>

        <div class="glass section">
          <h3 style="margin-bottom:1rem;">Cover Image</h3>
          <div class="form-group">
            <label>Image URL or /uploads path</label>
            <input v-model="form.cover_image" class="input" placeholder="/uploads/media/image.jpg" />
          </div>
          <img v-if="form.cover_image" :src="form.cover_image" class="cover-preview" alt="cover" />
        </div>

        <div class="glass section">
          <h3 style="margin-bottom:1rem;">URL</h3>
          <div class="form-group">
            <label>Slug</label>
            <input v-model="form.slug" class="input" />
          </div>
        </div>

        <div class="glass section">
          <h3 style="margin-bottom:1rem;">SEO</h3>
          <div class="form-group">
            <label>Meta Title</label>
            <input v-model="form.meta_title" class="input" />
          </div>
          <div class="form-group">
            <label>Meta Description</label>
            <textarea v-model="form.meta_desc" class="input" rows="3"></textarea>
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

const route  = useRoute()
const router = useRouter()
const toast  = useToastStore()

const isNew = computed(() => route.params.id === undefined)
const saving = ref(false)
const slugManual = ref(false)
const categories = ref([])
const newCatName = ref('')
const tagsInput = ref('')

const form = ref({
  title: '', slug: '', excerpt: '', content: '',
  cover_image: '', category_id: null,
  tags: [], status: 'draft',
  meta_title: '', meta_desc: ''
})

onMounted(async () => {
  const { data: cats } = await api.get('/posts/categories')
  categories.value = cats

  if (!isNew.value) {
    const { data: all } = await api.get('/posts?all=1&limit=500')
    const post = all.posts.find(p => p.id == route.params.id)
    if (!post) { router.push('/posts'); return }
    Object.assign(form.value, post)
    tagsInput.value = post.tags.join(', ')
    slugManual.value = true
  }
})

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function autoSlug() {
  if (!slugManual.value) form.value.slug = slugify(form.value.title)
}

async function addCategory() {
  if (!newCatName.value.trim()) return
  const { data } = await api.post('/posts/categories', { name: newCatName.value.trim() })
  categories.value.push(data)
  form.value.category_id = data.id
  newCatName.value = ''
  toast.success('Category added')
}

async function savePost(status) {
  if (!form.value.title) { toast.error('Title is required'); return }
  saving.value = true
  try {
    const payload = {
      ...form.value,
      status,
      tags: tagsInput.value.split(',').map(t => t.trim()).filter(Boolean)
    }
    if (isNew.value) {
      await api.post('/posts', payload)
      toast.success('Post created')
    } else {
      await api.put(`/posts/${route.params.id}`, payload)
      toast.success('Post saved')
    }
    router.push('/posts')
  } catch (e) {
    toast.error(e.response?.data?.error || 'Save failed')
  } finally {
    saving.value = false
  }
}

const saveDraft = () => savePost('draft')
const publish   = () => savePost('published')
</script>

<style scoped>
.header-actions { display: flex; gap: 0.5rem; align-items: center; }
.edit-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 1rem;
  align-items: start;
}
.section { padding: 1.25rem; margin-bottom: 1rem; }
.new-cat { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
.cover-preview { width: 100%; border-radius: var(--radius-sm); margin-top: 0.5rem; max-height: 160px; object-fit: cover; }
@media (max-width: 768px) {
  .edit-layout { grid-template-columns: 1fr; }
}
</style>
