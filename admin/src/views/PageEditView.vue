<template>
  <div>
    <RevisionsModal
      v-if="showRevisions"
      entity-type="page"
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
      <h1>{{ isNew ? 'New Page' : 'Edit Page' }}</h1>
      <div class="header-actions">
        <RouterLink to="/pages" class="btn btn-ghost">← Back</RouterLink>
        <button v-if="!isNew" class="btn btn-ghost" @click="showRevisions = true">🕓 History</button>
        <button v-if="!isNew && form.slug" class="btn btn-ghost" @click="openPreview" title="Preview this page in the public frontend">👁 Preview</button>
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
        <div v-if="form.status === 'scheduled'" class="glass section scheduled-banner">
          ⏰ This page is scheduled to publish at <strong>{{ form.publish_at ? new Date(form.publish_at).toLocaleString() : '(no time set)' }}</strong>
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
              <option value="scheduled">⏰ Scheduled</option>
            </select>
          </div>
          <div class="form-group" v-if="form.status === 'scheduled' || form.status === 'published'">
            <label>{{ form.status === 'scheduled' ? 'Publish at (future date/time)' : 'Published at' }}</label>
            <input v-model="form.publish_at" type="datetime-local" class="input" />
            <small style="color:var(--muted);font-size:0.75rem" v-if="form.status === 'scheduled'">
              The page will auto-publish at the scheduled time.
            </small>
          </div>
          <div class="form-group">
            <label>Sort Order</label>
            <input v-model.number="form.sort_order" type="number" class="input" />
          </div>
          <div class="btn-group" style="display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="btn btn-primary" @click="save('published')" :disabled="saving" style="flex:1">
              {{ saving ? 'Saving…' : 'Publish' }}
            </button>
            <button class="btn btn-ghost" @click="save('draft')" :disabled="saving" style="flex:1">
              Save Draft
            </button>
            <button v-if="form.status !== 'scheduled'" class="btn btn-ghost" @click="saveScheduled" :disabled="saving" style="flex:1;font-size:0.8rem">
              ⏰ Schedule
            </button>
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

        <div class="glass section">
          <h3 style="margin-bottom:1rem;">SEO Analyzer</h3>
          <SeoAnalyzer
            :title="form.title"
            :slug="form.slug"
            excerpt=""
            :content="form.content"
            :meta-title="form.meta_title"
            :meta-desc="form.meta_desc"
            cover-image=""
            type="page"
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
import RevisionsModal from '../components/RevisionsModal.vue'
import SeoAnalyzer from '../components/SeoAnalyzer.vue'
import LockBanner from '../components/LockBanner.vue'
import { useContentLock } from '../composables/useContentLock.js'
import { useAutoSave } from '../composables/useAutoSave.js'

const route = useRoute()
const router = useRouter()
const toast = useToastStore()

const isNew = computed(() => route.params.id === undefined)
const lock  = useContentLock('page', computed(() => isNew.value ? null : route.params.id))
const saving = ref(false)
const showRevisions = ref(false)
const slugManual = ref(false)
const showDraftBanner = ref(false)
const draftBannerTime = ref(null)

function openPreview() {
  const token = localStorage.getItem('pygmy_token') || ''
  const url = `http://localhost:5174/${form.value.slug}?preview_token=${encodeURIComponent(token)}`
  window.open(url, '_blank', 'noopener')
}

const form = ref({
  title: '',
  slug: '',
  content: '',
  status: 'draft',
  sort_order: 0,
  publish_at: '',
  meta_title: '',
  meta_desc: ''
})

const autoSave = useAutoSave('page', computed(() => isNew.value ? 'new' : route.params.id), form)

onMounted(async () => {
  if (!isNew.value) {
    const { data } = await api.get(`/pages?all=1`)
    const page = data.find(p => p.id == route.params.id)
    if (!page) { router.push('/pages'); return }
    Object.assign(form.value, page)
    slugManual.value = true
  }

  const draft = autoSave.checkRestore()
  if (draft) {
    showDraftBanner.value = true
    draftBannerTime.value = draft.savedAt
  }
  autoSave.watchForm()
})

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function autoSlug() {
  if (!slugManual.value) form.value.slug = slugify(form.value.title)
}

async function save(statusOverride) {
  if (!form.value.title) { toast.error('Title is required'); return }
  if ((statusOverride || form.value.status) === 'scheduled' && !form.value.publish_at) {
    toast.error('Please set a publish date/time for scheduled pages')
    return
  }
  saving.value = true
  try {
    const payload = { ...form.value }
    if (statusOverride) payload.status = statusOverride

    if (isNew.value) {
      await api.post('/pages', payload)
      const s = payload.status
      toast.success(s === 'scheduled' ? 'Page scheduled ⏰' : s === 'published' ? 'Page published' : 'Page saved as draft')
    } else {
      await api.put(`/pages/${route.params.id}`, payload)
      const s = payload.status
      toast.success(s === 'scheduled' ? 'Page scheduled ⏰' : s === 'published' ? 'Page published' : 'Page saved as draft')
    }
    autoSave.clear()
    router.push('/pages')
  } catch (e) {
    toast.error(e.response?.data?.error || 'Save failed')
  } finally {
    saving.value = false
  }
}

const saveScheduled = () => save('scheduled')

function applyRevision(snapshot) {
  Object.assign(form.value, snapshot)
  toast.success('Revision restored — review and save to apply')
}

function restoreDraft() {
  autoSave.restore((data) => {
    Object.assign(form.value, data)
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
.header-actions { display: flex; gap: 0.5rem; }
.edit-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 1rem;
  align-items: start;
}
.section { padding: 1.25rem; margin-bottom: 1rem; }
.scheduled-banner {
  padding: 0.75rem 1.25rem;
  font-size: 0.9rem;
  color: var(--muted);
  border-left: 3px solid var(--accent);
}
@media (max-width: 768px) {
  .edit-layout { grid-template-columns: 1fr; }
}
</style>
