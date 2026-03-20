<template>
  <div>
    <MediaPickerModal
      v-if="showPicker"
      :multi="pickerMulti"
      @select="onPickerSelect"
      @close="showPicker = false"
    />

    <LockBanner v-if="!isNew" :conflict="lock.conflict.value" />
    <div class="page-header">
      <h1>{{ isNew ? 'New Product' : 'Edit Product' }}</h1>
      <div class="header-actions">
        <RouterLink to="/products" class="btn btn-ghost">← Back</RouterLink>
        <button v-if="!isNew && form.slug" class="btn btn-ghost" @click="openPreview" title="Preview in public store">👁 Preview</button>
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
            <label>Product Name</label>
            <input v-model="form.name" class="input" placeholder="Product name" @input="autoSlug" />
          </div>
          <div class="form-group">
            <label>Slug</label>
            <input v-model="form.slug" class="input" placeholder="product-slug" />
          </div>
          <div class="form-group">
            <label>Short Description / Excerpt</label>
            <textarea v-model="form.excerpt" class="input" rows="2" placeholder="One-liner shown in listing…" />
          </div>
          <div class="form-group">
            <label>Full Description</label>
            <RichEditor v-model="form.description" placeholder="Full product details…" />
          </div>
        </div>

        <!-- Gallery -->
        <div class="glass section">
          <h3 style="margin-bottom:1rem">Gallery</h3>
          <div class="gallery-grid" v-if="form.gallery.length">
            <div class="gallery-item" v-for="(url, i) in form.gallery" :key="i">
              <img :src="url" alt="" />
              <button class="remove-btn" @click="form.gallery.splice(i, 1)">✕</button>
            </div>
          </div>
          <button type="button" class="btn btn-ghost" @click="openGalleryPicker">
            🖼️ Add Gallery Images
          </button>
        </div>

        <!-- SEO -->
        <div class="glass section">
          <h3 style="margin-bottom:1rem">SEO</h3>
          <div class="form-group">
            <label>Meta Title</label>
            <input v-model="form.meta_title" class="input" placeholder="Defaults to product name" />
          </div>
          <div class="form-group">
            <label>Meta Description</label>
            <textarea v-model="form.meta_desc" class="input" rows="2" placeholder="Concise page description…" />
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="edit-sidebar">
        <!-- Status & featured -->
        <div class="glass section">
          <h3 style="margin-bottom:1rem">Status</h3>
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
              Product auto-publishes at the scheduled time.
            </small>
          </div>
          <label class="checkbox-row">
            <input type="checkbox" v-model="form.featured" />
            <span>Featured product</span>
          </label>
          <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" @click="saveScheduled" :disabled="saving">⏰ Schedule</button>
          </div>
        </div>

        <!-- Pricing -->
        <div class="glass section">
          <h3 style="margin-bottom:1rem">Pricing</h3>
          <div class="form-group">
            <label>Regular Price ($)</label>
            <input v-model.number="form.price" class="input" type="number" min="0" step="0.01" placeholder="0.00" />
          </div>
          <div class="form-group">
            <label>Sale Price ($) <small style="color:var(--text-muted)">(optional)</small></label>
            <input v-model.number="form.sale_price" class="input" type="number" min="0" step="0.01" placeholder="0.00" />
          </div>
          <div class="form-group">
            <label>SKU <small style="color:var(--text-muted)">(optional)</small></label>
            <input v-model="form.sku" class="input" placeholder="PROD-001" />
          </div>
        </div>

        <!-- Category & tags -->
        <div class="glass section">
          <h3 style="margin-bottom:1rem">Category & Tags</h3>
          <div class="form-group">
            <label>Category</label>
            <select v-model="form.category_id" class="select">
              <option :value="null">— None —</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Tags <small style="color:var(--text-muted)">(comma separated)</small></label>
            <input v-model="tagsInput" class="input" placeholder="sale, new, eco" />
          </div>
          <div class="new-cat">
            <input v-model="newCatName" class="input" placeholder="New category…" />
            <button type="button" class="btn btn-ghost btn-sm" @click="addCategory">Add</button>
          </div>
        </div>

        <!-- Cover image -->
        <div class="glass section">
          <h3 style="margin-bottom:1rem">Cover Image</h3>
          <div class="cover-row">
            <input v-model="form.cover_image" class="input" placeholder="/uploads/media/image.jpg" />
            <button type="button" class="btn btn-ghost btn-sm" @click="openCoverPicker">🖼️ Pick</button>
          </div>
          <img v-if="form.cover_image" :src="form.cover_image" class="cover-preview" alt="cover" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'
import RichEditor from '../components/RichEditor.vue'
import MediaPickerModal from '../components/MediaPickerModal.vue'
import LockBanner from '../components/LockBanner.vue'
import { useContentLock } from '../composables/useContentLock.js'

const route  = useRoute()
const router = useRouter()
const toast  = useToastStore()

const isNew    = computed(() => !route.params.id)
const lock     = useContentLock('product', computed(() => isNew.value ? null : route.params.id))
const saving   = ref(false)
const showPicker  = ref(false)

function openPreview() {
  const token = localStorage.getItem('pygmy_token') || ''
  const url = `http://localhost:5174/shop/${form.value.slug}?preview_token=${encodeURIComponent(token)}`
  window.open(url, '_blank', 'noopener')
}
const pickerMulti = ref(false)
const categories  = ref([])
const newCatName  = ref('')
const tagsInput   = ref('')

const form = ref({
  name: '', slug: '', excerpt: '', description: '',
  price: null, sale_price: null, sku: '',
  cover_image: '', gallery: [],
  category_id: null, tags: [], status: 'draft',
  featured: false, meta_title: '', meta_desc: '',
  publish_at: ''
})

onMounted(async () => {
  const [cRes] = await Promise.all([api.get('/products/categories')])
  categories.value = cRes.data

  if (!isNew.value) {
    try {
      const { data: product } = await api.get(`/products/id/${route.params.id}`)
      form.value = {
        name: product.name,
        slug: product.slug,
        excerpt: product.excerpt || '',
        description: product.description || '',
        price: product.price,
        sale_price: product.sale_price,
        sku: product.sku || '',
        cover_image: product.cover_image || '',
        gallery: product.gallery || [],
        category_id: product.category_id,
        tags: product.tags || [],
        status: product.status,
        featured: product.featured,
        meta_title: product.meta_title || '',
        meta_desc: product.meta_desc || '',
        publish_at: product.publish_at ? product.publish_at.slice(0, 16) : '',
      }
      tagsInput.value = (product.tags || []).join(', ')
    } catch {
      toast.error('Product not found')
      router.push('/products')
    }
  }
})

function autoSlug() {
  if (!isNew.value) return
  form.value.slug = form.value.name
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function openCoverPicker() {
  pickerMulti.value = false
  showPicker.value = true
}

function openGalleryPicker() {
  pickerMulti.value = true
  showPicker.value = true
}

function onPickerSelect(url) {
  if (pickerMulti.value) {
    if (!form.value.gallery.includes(url)) form.value.gallery.push(url)
  } else {
    form.value.cover_image = url
  }
  showPicker.value = false
}

async function addCategory() {
  const name = newCatName.value.trim()
  if (!name) return
  const { data } = await api.post('/products/categories', { name })
  categories.value.push(data)
  form.value.category_id = data.id
  newCatName.value = ''
  toast.success('Category added')
}

async function save(status) {
  if (!form.value.name.trim()) { toast.error('Name is required'); return }
  const finalStatus = status || form.value.status
  if (finalStatus === 'scheduled' && !form.value.publish_at) {
    toast.error('Please set a publish date/time for scheduled products')
    return
  }
  saving.value = true
  try {
    const payload = {
      ...form.value,
      status: finalStatus,
      tags: tagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
      price: form.value.price || null,
      sale_price: form.value.sale_price || null,
    }
    if (isNew.value) {
      const { data } = await api.post('/products', payload)
      toast.success(finalStatus === 'scheduled' ? 'Product scheduled ⏰' : 'Product created')
      router.push(`/products/${data.id}`)
    } else {
      await api.put(`/products/${route.params.id}`, payload)
      toast.success(finalStatus === 'scheduled' ? 'Product scheduled ⏰' : 'Product saved')
    }
  } catch (e) {
    toast.error(e.response?.data?.error || 'Save failed')
  } finally {
    saving.value = false
  }
}

const saveScheduled = () => save('scheduled')
</script>

<style scoped>
.edit-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1.5rem;
  align-items: start;
}
@media (max-width: 900px) {
  .edit-layout { grid-template-columns: 1fr; }
}

.section { padding: 1.5rem; margin-bottom: 1.5rem; }

.cover-row { display: flex; gap: 0.5rem; align-items: center; }
.cover-preview {
  margin-top: 0.75rem;
  width: 100%; max-height: 180px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.new-cat { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
.new-cat .input { flex: 1; }

.checkbox-row {
  display: flex; align-items: center; gap: 0.5rem;
  cursor: pointer; font-size: 0.88rem; color: var(--text-muted);
  margin-top: 0.5rem;
}
.checkbox-row input { accent-color: var(--accent); width: 16px; height: 16px; }

.gallery-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.gallery-item {
  position: relative;
  width: 80px; height: 80px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
}
.gallery-item img { width: 100%; height: 100%; object-fit: cover; }
.remove-btn {
  position: absolute;
  top: 2px; right: 2px;
  background: rgba(0,0,0,0.7);
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 20px; height: 20px;
  font-size: 0.65rem;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
</style>
