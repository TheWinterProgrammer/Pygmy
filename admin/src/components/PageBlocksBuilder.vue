<template>
  <div class="blocks-builder">
    <div class="blocks-header">
      <h3>🧩 Content Blocks</h3>
      <button class="btn btn-primary btn-sm" @click="showAddMenu = !showAddMenu">+ Add Block</button>
    </div>

    <!-- Block type picker -->
    <div class="block-type-menu glass" v-if="showAddMenu">
      <div class="block-types-grid">
        <button
          v-for="bt in blockTypes"
          :key="bt.type"
          class="block-type-btn"
          @click="addBlock(bt.type)"
        >
          <span class="bt-icon">{{ bt.icon }}</span>
          <span class="bt-label">{{ bt.label }}</span>
        </button>
      </div>
    </div>

    <!-- Blocks list -->
    <div class="blocks-list" v-if="blocks.length">
      <div
        v-for="(block, idx) in blocks"
        :key="block.id"
        class="block-row glass"
        :class="{ 'block-expanded': expandedId === block.id }"
      >
        <!-- Block header bar -->
        <div class="block-bar" @click="toggleExpand(block.id)">
          <span class="block-drag-handle">⠿</span>
          <span class="block-type-icon">{{ getBlockMeta(block.type).icon }}</span>
          <span class="block-type-name">{{ getBlockMeta(block.type).label }}</span>
          <span class="block-preview-text">{{ blockPreview(block) }}</span>
          <div class="block-actions" @click.stop>
            <button class="icon-btn" :disabled="idx === 0" @click="moveBlock(idx, -1)" title="Move up">↑</button>
            <button class="icon-btn" :disabled="idx === blocks.length - 1" @click="moveBlock(idx, 1)" title="Move down">↓</button>
            <button class="icon-btn danger" @click="deleteBlock(block)" title="Delete block">🗑</button>
          </div>
          <span class="expand-arrow">{{ expandedId === block.id ? '▲' : '▼' }}</span>
        </div>

        <!-- Block editor -->
        <transition name="expand">
          <div class="block-editor" v-if="expandedId === block.id">
            <component
              :is="editorComponent(block.type)"
              :settings="block.settings"
              @update="(s) => patchSettings(block, s)"
            />
            <div class="block-save-row">
              <button class="btn btn-primary btn-sm" @click="saveBlock(block)" :disabled="block._saving">
                {{ block._saving ? 'Saving…' : '✓ Save Block' }}
              </button>
            </div>
          </div>
        </transition>
      </div>
    </div>

    <div class="blocks-empty" v-else-if="!loading">
      <p>No content blocks yet. Add one above to build your page visually.</p>
    </div>

    <div class="loading-bar" v-if="loading"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps, defineEmits, h, reactive } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'

// ── Block type metadata ──────────────────────────────────────────────────────
const blockTypes = [
  { type: 'hero',         icon: '🌄', label: 'Hero' },
  { type: 'features',     icon: '⚡', label: 'Features' },
  { type: 'text',         icon: '📝', label: 'Text' },
  { type: 'image_text',   icon: '🖼️', label: 'Image + Text' },
  { type: 'gallery',      icon: '🗂️', label: 'Gallery' },
  { type: 'testimonials', icon: '💬', label: 'Testimonials' },
  { type: 'cta',          icon: '📣', label: 'Call to Action' },
  { type: 'faq',          icon: '❓', label: 'FAQ' },
  { type: 'team',         icon: '👥', label: 'Team' },
  { type: 'pricing',      icon: '💰', label: 'Pricing' },
  { type: 'newsletter',   icon: '📧', label: 'Newsletter' },
  { type: 'divider',      icon: '➖', label: 'Divider' },
  { type: 'spacer',       icon: '↕️',  label: 'Spacer' },
  { type: 'embed',        icon: '🔗', label: 'Embed / HTML' },
]

function getBlockMeta(type) {
  return blockTypes.find(b => b.type === type) || { icon: '🧩', label: type }
}

function blockPreview(block) {
  const s = block.settings || {}
  return s.title || s.content?.replace(/<[^>]+>/g, '').slice(0, 60) || s.html?.slice(0, 40) || ''
}

// ── Props & Emits ────────────────────────────────────────────────────────────
const props = defineProps({ pageId: { type: [Number, String], required: true } })
const toast = useToastStore()

// ── State ────────────────────────────────────────────────────────────────────
const blocks      = ref([])
const loading     = ref(false)
const showAddMenu = ref(false)
const expandedId  = ref(null)

// ── Load blocks ──────────────────────────────────────────────────────────────
async function loadBlocks() {
  loading.value = true
  try {
    const { data } = await api.get(`/page-blocks?page_id=${props.pageId}`)
    blocks.value = data.map(b => reactive({ ...b, _saving: false }))
  } catch (e) {
    toast.error('Failed to load blocks')
  } finally {
    loading.value = false
  }
}

onMounted(loadBlocks)

// ── Add block ────────────────────────────────────────────────────────────────
async function addBlock(type) {
  showAddMenu.value = false
  try {
    const { data } = await api.post('/page-blocks', {
      page_id: props.pageId,
      type,
      sort_order: blocks.value.length,
    })
    const block = reactive({ ...data, _saving: false })
    blocks.value.push(block)
    expandedId.value = block.id
    toast.success(`${getBlockMeta(type).label} block added`)
  } catch (e) {
    toast.error('Failed to add block')
  }
}

// ── Delete block ─────────────────────────────────────────────────────────────
async function deleteBlock(block) {
  if (!confirm(`Delete this ${getBlockMeta(block.type).label} block?`)) return
  await api.delete(`/page-blocks/${block.id}`)
  blocks.value = blocks.value.filter(b => b.id !== block.id)
  toast.success('Block deleted')
}

// ── Move block ───────────────────────────────────────────────────────────────
async function moveBlock(idx, dir) {
  const arr = blocks.value
  const swapIdx = idx + dir
  ;[arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]]
  blocks.value = [...arr]
  await api.post('/page-blocks/reorder', {
    page_id: props.pageId,
    order: blocks.value.map(b => b.id),
  })
}

// ── Toggle expand ────────────────────────────────────────────────────────────
function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

// ── Patch settings locally ───────────────────────────────────────────────────
function patchSettings(block, updates) {
  block.settings = { ...block.settings, ...updates }
}

// ── Save block ───────────────────────────────────────────────────────────────
async function saveBlock(block) {
  block._saving = true
  try {
    const { data } = await api.put(`/page-blocks/${block.id}`, {
      settings: block.settings,
    })
    Object.assign(block, { ...data, _saving: false })
    toast.success('Block saved')
  } catch (e) {
    toast.error('Failed to save block')
    block._saving = false
  }
}

// ── Block editor component factory (render-function approach) ────────────────
import HeroBlockEditor       from './block-editors/HeroBlockEditor.vue'
import FeaturesBlockEditor   from './block-editors/FeaturesBlockEditor.vue'
import TextBlockEditor       from './block-editors/TextBlockEditor.vue'
import ImageTextBlockEditor  from './block-editors/ImageTextBlockEditor.vue'
import GalleryBlockEditor    from './block-editors/GalleryBlockEditor.vue'
import TestimonialsBlockEditor from './block-editors/TestimonialsBlockEditor.vue'
import CtaBlockEditor        from './block-editors/CtaBlockEditor.vue'
import FaqBlockEditor        from './block-editors/FaqBlockEditor.vue'
import TeamBlockEditor       from './block-editors/TeamBlockEditor.vue'
import PricingBlockEditor    from './block-editors/PricingBlockEditor.vue'
import NewsletterBlockEditor from './block-editors/NewsletterBlockEditor.vue'
import DividerBlockEditor    from './block-editors/DividerBlockEditor.vue'
import SpacerBlockEditor     from './block-editors/SpacerBlockEditor.vue'
import EmbedBlockEditor      from './block-editors/EmbedBlockEditor.vue'

const editorMap = {
  hero:         HeroBlockEditor,
  features:     FeaturesBlockEditor,
  text:         TextBlockEditor,
  image_text:   ImageTextBlockEditor,
  gallery:      GalleryBlockEditor,
  testimonials: TestimonialsBlockEditor,
  cta:          CtaBlockEditor,
  faq:          FaqBlockEditor,
  team:         TeamBlockEditor,
  pricing:      PricingBlockEditor,
  newsletter:   NewsletterBlockEditor,
  divider:      DividerBlockEditor,
  spacer:       SpacerBlockEditor,
  embed:        EmbedBlockEditor,
}

function editorComponent(type) {
  return editorMap[type] || TextBlockEditor
}
</script>

<style scoped>
.blocks-builder { margin-top: 1rem; }
.blocks-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 0.75rem;
}
.blocks-header h3 { margin: 0; font-size: 1rem; }

.block-type-menu {
  padding: 1rem; margin-bottom: 1rem;
  border-radius: var(--radius); border: 1px solid rgba(255,255,255,0.08);
}
.block-types-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 0.5rem;
}
.block-type-btn {
  display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
  padding: 0.65rem 0.5rem; border-radius: var(--radius-sm); cursor: pointer;
  border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04);
  color: var(--text); font-size: 0.8rem; transition: background 0.15s, border-color 0.15s;
}
.block-type-btn:hover { background: rgba(255,255,255,0.1); border-color: var(--accent); }
.bt-icon { font-size: 1.4rem; }

.blocks-list { display: flex; flex-direction: column; gap: 0.5rem; }

.block-row {
  border-radius: var(--radius-sm); overflow: hidden;
  border: 1px solid rgba(255,255,255,0.07);
  transition: border-color 0.2s;
}
.block-row:hover { border-color: rgba(255,255,255,0.18); }
.block-expanded { border-color: var(--accent) !important; }

.block-bar {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.65rem 0.85rem; cursor: pointer; user-select: none;
}
.block-drag-handle { color: var(--muted); font-size: 1rem; cursor: grab; }
.block-type-icon { font-size: 1.1rem; }
.block-type-name { font-size: 0.82rem; font-weight: 600; min-width: 80px; }
.block-preview-text {
  flex: 1; font-size: 0.78rem; color: var(--muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.block-actions { display: flex; gap: 0.3rem; }
.icon-btn {
  background: none; border: none; cursor: pointer; padding: 0.2rem 0.4rem;
  color: var(--muted); font-size: 0.85rem; border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}
.icon-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: var(--text); }
.icon-btn.danger:hover { color: var(--accent); }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.expand-arrow { font-size: 0.7rem; color: var(--muted); margin-left: 0.25rem; }

.block-editor { padding: 1rem; border-top: 1px solid rgba(255,255,255,0.07); }
.block-save-row { margin-top: 1rem; display: flex; justify-content: flex-end; }

.blocks-empty {
  padding: 2rem; text-align: center; color: var(--muted); font-size: 0.9rem;
  border: 1px dashed rgba(255,255,255,0.1); border-radius: var(--radius);
}

.expand-enter-active, .expand-leave-active { transition: all 0.2s ease; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; overflow: hidden; }
.expand-enter-to, .expand-leave-from { opacity: 1; max-height: 1000px; }
</style>
