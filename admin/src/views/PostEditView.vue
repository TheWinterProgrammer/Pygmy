<template>
  <div>
    <MediaPickerModal
      v-if="showPicker"
      @select="url => { form.cover_image = url }"
      @close="showPicker = false"
    />
    <RevisionsModal
      v-if="showRevisions"
      entity-type="post"
      :entity-id="route.params.id"
      @close="showRevisions = false"
      @restore="applyRevision"
    />
    <LockBanner v-if="!isNew" :conflict="lock.conflict.value" />
    <!-- Auto-save restore banner -->
    <div v-if="showDraftBanner" class="autosave-banner">
      <span>📝 You have an unsaved draft from {{ draftBannerTime ? new Date(draftBannerTime).toLocaleTimeString() : '' }}.</span>
      <button class="btn btn-sm btn-primary" @click="restoreDraft">Restore</button>
      <button class="btn btn-sm btn-ghost" @click="discardDraft">Discard</button>
    </div>
    <div class="page-header">
      <h1>{{ isNew ? 'New Post' : 'Edit Post' }}</h1>
      <div class="header-actions">
        <RouterLink to="/posts" class="btn btn-ghost">← Back</RouterLink>
        <button v-if="!isNew" class="btn btn-ghost" @click="showRevisions = true">🕓 History</button>
        <button v-if="!isNew && form.slug" class="btn btn-ghost" @click="openPreview" title="Preview this post in the public frontend">👁 Preview</button>
        <button class="btn btn-ghost" @click="saveDraft" :disabled="saving">Save Draft</button>
        <button
          v-if="form.status === 'scheduled'"
          class="btn btn-secondary"
          @click="saveScheduled"
          :disabled="saving"
        >⏰ Schedule</button>
        <button v-else class="btn btn-primary" @click="publish" :disabled="saving">
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
              <option value="scheduled">⏰ Scheduled</option>
            </select>
          </div>
          <div class="form-group" v-if="form.status === 'scheduled' || form.status === 'published'">
            <label>{{ form.status === 'scheduled' ? 'Publish at (future date)' : 'Published at' }}</label>
            <input
              v-model="form.published_at"
              type="datetime-local"
              class="input"
            />
            <small style="color:var(--muted);font-size:0.75rem" v-if="form.status === 'scheduled'">
              The post will auto-publish at the scheduled time.
            </small>
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
            <div class="cover-row">
              <input v-model="form.cover_image" class="input" placeholder="/uploads/media/image.jpg" />
              <button type="button" class="btn btn-ghost btn-sm" @click="showPicker = true">🖼️ Pick</button>
            </div>
          </div>
          <img v-if="form.cover_image" :src="form.cover_image" class="cover-preview" alt="cover" />
        </div>

        <!-- Gallery -->
        <div class="glass section">
          <h3 style="margin-bottom:1rem;">Post Gallery</h3>
          <div class="gallery-grid" v-if="form.gallery && form.gallery.length">
            <div class="gallery-thumb" v-for="(img, i) in form.gallery" :key="i">
              <img :src="img" :alt="`Gallery ${i+1}`" />
              <button type="button" class="gallery-remove" @click="form.gallery.splice(i,1)" title="Remove">✕</button>
            </div>
          </div>
          <p v-else style="color:var(--muted);font-size:0.875rem;margin-bottom:0.75rem;">No gallery images yet.</p>
          <button type="button" class="btn btn-ghost btn-sm" @click="showGalleryPicker = true">🖼️ Add Images</button>
          <MediaPickerModal
            :open="showGalleryPicker"
            @close="showGalleryPicker = false"
            @select="url => { if (!form.gallery.includes(url)) form.gallery.push(url) }"
          />
        </div>

        <div class="glass section">
          <h3 style="margin-bottom:1rem;">URL</h3>
          <div class="form-group">
            <label>Slug</label>
            <input v-model="form.slug" class="input" />
          </div>
        </div>

        <div class="glass section">
          <h3 style="margin-bottom:1rem;">Access Control</h3>
          <div class="form-group">
            <label>Visibility</label>
            <select v-model="form.access_level" class="input">
              <option value="public">🌐 Public — anyone can read</option>
              <option value="members">💳 Members only — requires active subscription</option>
            </select>
            <p v-if="form.access_level === 'members'" class="hint" style="margin-top:.4rem;color:var(--accent)">
              ⚠️ Only customers with an active subscription can view this post's content.
            </p>
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

        <div class="glass section">
          <h3 style="margin-bottom:1rem;">SEO Analyzer</h3>
          <SeoAnalyzer
            :title="form.title"
            :slug="form.slug"
            :excerpt="form.excerpt"
            :content="form.content"
            :meta-title="form.meta_title"
            :meta-desc="form.meta_desc"
            :cover-image="form.cover_image"
            type="post"
          />
        </div>

        <div class="glass section" v-if="!isNew">
          <TranslationEditor
            entity-type="post"
            :entity-id="Number(route.params.id)"
            :default-values="{ title: form.title, excerpt: form.excerpt, content: form.content, meta_title: form.meta_title, meta_description: form.meta_desc }"
          />
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
import MediaPickerModal from '../components/MediaPickerModal.vue'
import RevisionsModal from '../components/RevisionsModal.vue'
import SeoAnalyzer from '../components/SeoAnalyzer.vue'
import LockBanner from '../components/LockBanner.vue'
import TranslationEditor from '../components/TranslationEditor.vue'
import { useContentLock } from '../composables/useContentLock.js'
import { useAutoSave } from '../composables/useAutoSave.js'

const route  = useRoute()
const router = useRouter()
const toast  = useToastStore()

const isNew = computed(() => route.params.id === undefined)
const lock  = useContentLock('post', computed(() => isNew.value ? null : route.params.id))
const saving = ref(false)
const showPicker = ref(false)
const showRevisions = ref(false)

function openPreview() {
  const token = localStorage.getItem('pygmy_token') || ''
  const url = `http://localhost:5174/blog/${form.value.slug}?preview_token=${encodeURIComponent(token)}`
  window.open(url, '_blank', 'noopener')
}
const slugManual = ref(false)
const categories = ref([])
const newCatName = ref('')
const tagsInput = ref('')

const form = ref({
  title: '', slug: '', excerpt: '', content: '',
  cover_image: '', gallery: [], category_id: null,
  tags: [], status: 'draft',
  meta_title: '', meta_desc: '',
  access_level: 'public'
})
const showGalleryPicker = ref(false)

const autoSave = useAutoSave('post', computed(() => isNew.value ? 'new' : route.params.id), form)
const showDraftBanner = ref(false)
const draftBannerTime = ref(null)

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

  // Check for unsaved draft
  const draft = autoSave.checkRestore()
  if (draft) {
    showDraftBanner.value = true
    draftBannerTime.value = draft.savedAt
  }

  // Start auto-saving after form is loaded
  autoSave.watchForm()
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

async function savePost(status, keepPublishedAt = false) {
  if (!form.value.title) { toast.error('Title is required'); return }
  if (status === 'scheduled' && !form.value.published_at) {
    toast.error('Please set a publish date/time for scheduled posts')
    return
  }
  saving.value = true
  try {
    const payload = {
      ...form.value,
      status,
      tags: tagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
      // Convert local datetime-local value to ISO string if present
      published_at: form.value.published_at
        ? new Date(form.value.published_at).toISOString()
        : null
    }
    if (isNew.value) {
      await api.post('/posts', payload)
      toast.success(status === 'scheduled' ? 'Post scheduled ⏰' : 'Post created')
    } else {
      await api.put(`/posts/${route.params.id}`, payload)
      toast.success(status === 'scheduled' ? 'Post scheduled ⏰' : 'Post saved')
    }
    autoSave.clear()
    router.push('/posts')
  } catch (e) {
    toast.error(e.response?.data?.error || 'Save failed')
  } finally {
    saving.value = false
  }
}

const saveDraft     = () => savePost('draft')
const publish       = () => savePost('published')
const saveScheduled = () => savePost('scheduled')

function applyRevision(snapshot) {
  Object.assign(form.value, snapshot)
  tagsInput.value = Array.isArray(snapshot.tags) ? snapshot.tags.join(', ') : ''
  toast.success('Revision restored — review and save to apply')
}

function restoreDraft() {
  autoSave.restore((data) => {
    Object.assign(form.value, data)
    tagsInput.value = Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || '')
    toast.success('Draft restored')
  })
  showDraftBanner.value = false
}

function discardDraft() {
  autoSave.clear()
  showDraftBanner.value = false
}
</script>

<style scoped>
.autosave-banner {
  display: flex; align-items: center; gap: 0.75rem; padding: 0.65rem 1rem;
  background: rgba(255, 200, 0, 0.12); border: 1px solid rgba(255, 200, 0, 0.25);
  border-radius: var(--radius-sm); margin-bottom: 0.75rem; font-size: 0.87rem;
  color: hsl(45, 80%, 70%);
}
.autosave-banner span { flex: 1; }
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
.cover-row { display: flex; gap: 0.5rem; align-items: center; }
.cover-row .input { flex: 1; }
.gallery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 0.75rem; }
.gallery-thumb { position: relative; border-radius: var(--radius-sm); overflow: hidden; aspect-ratio: 4/3; }
.gallery-thumb img { width: 100%; height: 100%; object-fit: cover; }
.gallery-remove { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.7); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 0.7rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
@media (max-width: 768px) {
  .edit-layout { grid-template-columns: 1fr; }
}
</style>
