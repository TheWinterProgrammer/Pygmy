<template>
  <div>
    <MediaPickerModal
      v-if="showPicker"
      @select="url => { form.cover_image = url; showPicker = false }"
      @close="showPicker = false"
    />

    <div class="page-header">
      <h1>{{ isNew ? 'New Event' : 'Edit Event' }}</h1>
      <div class="header-actions">
        <RouterLink to="/events" class="btn btn-ghost">← Back</RouterLink>
        <button class="btn btn-ghost" @click="save('draft')" :disabled="saving">Save Draft</button>
        <button class="btn btn-primary" @click="save('published')" :disabled="saving">
          {{ form.status === 'published' ? 'Update' : 'Publish' }}
        </button>
      </div>
    </div>

    <div class="edit-layout">
      <!-- Main column -->
      <div class="edit-main">
        <div class="glass section">
          <div class="form-group">
            <label>Event Title *</label>
            <input v-model="form.title" class="input" placeholder="Event title" @input="autoSlug" />
          </div>
          <div class="form-group">
            <label>Short Description</label>
            <textarea v-model="form.excerpt" class="input" rows="2" placeholder="Brief summary shown in listings…"></textarea>
          </div>
          <div class="form-group">
            <label>Full Description</label>
            <RichEditor v-model="form.description" placeholder="Describe the event…" />
          </div>
        </div>

        <!-- SEO -->
        <div class="glass section">
          <h3 style="margin-bottom:1rem;">🔍 SEO</h3>
          <div class="form-group">
            <label>Meta Title</label>
            <input v-model="form.meta_title" class="input" placeholder="Override page title for search engines" />
          </div>
          <div class="form-group">
            <label>Meta Description</label>
            <textarea v-model="form.meta_desc" class="input" rows="2" placeholder="150–160 char summary for search results…"></textarea>
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="edit-sidebar">
        <!-- Status -->
        <div class="glass section">
          <h3 style="margin-bottom:1rem;">Status</h3>
          <div class="form-group">
            <select v-model="form.status" class="select">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.featured" />
              ⭐ Featured event
            </label>
          </div>
        </div>

        <!-- Date & Time -->
        <div class="glass section">
          <h3 style="margin-bottom:1rem;">📅 Date & Time</h3>
          <div class="form-group">
            <label>Start Date *</label>
            <input v-model="form.start_date" type="datetime-local" class="input" />
          </div>
          <div class="form-group">
            <label>End Date</label>
            <input v-model="form.end_date" type="datetime-local" class="input" />
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.all_day" />
              All-day event
            </label>
          </div>
        </div>

        <!-- Location -->
        <div class="glass section">
          <h3 style="margin-bottom:1rem;">📍 Location</h3>
          <div class="form-group">
            <label>Venue Name</label>
            <input v-model="form.venue" class="input" placeholder="e.g. The Grand Hall" />
          </div>
          <div class="form-group">
            <label>Location / Address</label>
            <input v-model="form.location" class="input" placeholder="123 Main St, City" />
          </div>
          <div class="form-group">
            <label>Ticket / Registration URL</label>
            <input v-model="form.ticket_url" class="input" type="url" placeholder="https://tickets.example.com" />
          </div>
        </div>

        <!-- Cover image -->
        <div class="glass section">
          <h3 style="margin-bottom:1rem;">Cover Image</h3>
          <div class="cover-preview" v-if="form.cover_image" style="margin-bottom:0.75rem">
            <img :src="form.cover_image" class="cover-thumb" />
            <button class="btn btn-ghost btn-sm" @click="form.cover_image = ''">Remove</button>
          </div>
          <button class="btn btn-ghost" @click="showPicker = true">📂 Pick from Media</button>
          <div class="form-group" style="margin-top:0.75rem">
            <label>Or paste URL</label>
            <input v-model="form.cover_image" class="input" placeholder="https://…" />
          </div>
        </div>

        <!-- Tags -->
        <div class="glass section">
          <h3 style="margin-bottom:1rem;">Tags</h3>
          <div class="form-group">
            <input
              v-model="tagInput"
              class="input"
              placeholder="Add tag, press Enter"
              @keydown.enter.prevent="addTag"
              @keydown.comma.prevent="addTag"
            />
          </div>
          <div class="tags-list" v-if="form.tags?.length">
            <span
              v-for="tag in form.tags" :key="tag"
              class="tag-pill"
              @click="removeTag(tag)"
            >{{ tag }} ✕</span>
          </div>
        </div>

        <!-- Slug -->
        <div class="glass section">
          <h3 style="margin-bottom:1rem;">URL Slug</h3>
          <div class="form-group">
            <label>Slug</label>
            <input v-model="form.slug" class="input" placeholder="event-slug" />
            <small class="hint">/events/{{ form.slug || 'your-slug' }}</small>
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
import MediaPickerModal from '../components/MediaPickerModal.vue'

const route = useRoute()
const router = useRouter()

const isNew = computed(() => !route.params.id || route.params.id === 'new')

const saving = ref(false)
const showPicker = ref(false)
const tagInput = ref('')

const form = ref({
  title: '',
  slug: '',
  excerpt: '',
  description: '',
  cover_image: '',
  start_date: '',
  end_date: '',
  all_day: false,
  location: '',
  venue: '',
  ticket_url: '',
  tags: [],
  status: 'draft',
  featured: false,
  meta_title: '',
  meta_desc: '',
})

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

let slugEdited = false
function autoSlug() {
  if (!slugEdited || !form.value.slug) {
    form.value.slug = slugify(form.value.title)
  }
}

function addTag() {
  const t = tagInput.value.trim().replace(/,+$/, '').trim()
  if (t && !form.value.tags.includes(t)) form.value.tags.push(t)
  tagInput.value = ''
}

function removeTag(tag) {
  form.value.tags = form.value.tags.filter(t => t !== tag)
}

function toLocalDatetime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function load() {
  if (isNew.value) return
  const { data } = await api.get(`/events/${route.params.id}`)
  form.value = {
    ...data,
    start_date: toLocalDatetime(data.start_date),
    end_date: toLocalDatetime(data.end_date),
    tags: data.tags || [],
    featured: !!data.featured,
    all_day: !!data.all_day,
  }
  slugEdited = true
}

async function save(status) {
  if (!form.value.title) return alert('Title is required')
  if (!form.value.start_date) return alert('Start date is required')
  saving.value = true
  try {
    const payload = { ...form.value, status }
    if (isNew.value) {
      const { data } = await api.post('/events', payload)
      router.replace(`/events/${data.id}`)
    } else {
      await api.put(`/events/${route.params.id}`, payload)
    }
    form.value.status = status
  } catch (e) {
    alert(e.response?.data?.error || 'Save failed')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.edit-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.25rem;
  align-items: start;
}
@media (max-width: 900px) {
  .edit-layout { grid-template-columns: 1fr; }
}

.section { padding: 1.25rem; margin-bottom: 1.25rem; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.82rem; font-weight: 500; color: var(--text-muted); margin-bottom: 0.35rem; }
.hint { font-size: 0.75rem; color: var(--text-muted); }

.checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.88rem; cursor: pointer; }

.cover-thumb { width: 100%; max-height: 120px; object-fit: cover; border-radius: 0.5rem; display: block; margin-bottom: 0.4rem; }

.tags-list { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.tag-pill {
  background: hsl(355,70%,20%);
  color: var(--accent);
  font-size: 0.75rem;
  padding: 2px 10px;
  border-radius: 999px;
  cursor: pointer;
}
.tag-pill:hover { background: hsl(355,70%,25%); }
</style>
