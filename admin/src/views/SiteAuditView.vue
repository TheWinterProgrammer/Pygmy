<template>
  <div class="site-audit-view">
    <div class="page-header">
      <div>
        <h1>🔍 Site Audit</h1>
        <p class="page-desc">SEO health check, missing content, and image alt text coverage.</p>
      </div>
      <button class="btn btn-primary" @click="runAudit" :disabled="loading">
        {{ loading ? '⏳ Scanning…' : '🔄 Run Audit' }}
      </button>
    </div>

    <!-- Summary cards -->
    <div v-if="summary" class="summary-grid">
      <div class="summary-card glass">
        <div class="sc-icon">📝</div>
        <div class="sc-body">
          <div class="sc-title">Published Content</div>
          <div class="sc-val">{{ summary.total_content.posts + summary.total_content.pages + summary.total_content.products }}</div>
          <div class="sc-sub">{{ summary.total_content.posts }} posts · {{ summary.total_content.pages }} pages · {{ summary.total_content.products }} products</div>
        </div>
      </div>
      <div class="summary-card glass" :class="summary.missing_alt_text > 0 ? 'warn' : 'ok'">
        <div class="sc-icon">🖼️</div>
        <div class="sc-body">
          <div class="sc-title">Missing Alt Text</div>
          <div class="sc-val">{{ summary.missing_alt_text }}</div>
          <div class="sc-sub">images without alt text</div>
        </div>
      </div>
      <div class="summary-card glass" :class="totalNoMeta > 0 ? 'warn' : 'ok'">
        <div class="sc-icon">🏷️</div>
        <div class="sc-body">
          <div class="sc-title">Missing Meta Titles</div>
          <div class="sc-val">{{ totalNoMeta }}</div>
          <div class="sc-sub">{{ summary.no_meta_title.posts }} posts · {{ summary.no_meta_title.pages }} pages · {{ summary.no_meta_title.products }} products</div>
        </div>
      </div>
      <div class="summary-card glass" :class="totalNoCover > 0 ? 'warn' : 'ok'">
        <div class="sc-icon">📸</div>
        <div class="sc-body">
          <div class="sc-title">Missing Cover Images</div>
          <div class="sc-val">{{ totalNoCover }}</div>
          <div class="sc-sub">{{ summary.no_cover_image.posts }} posts · {{ summary.no_cover_image.products }} products</div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs glass">
      <button v-for="t in tabs" :key="t.id" class="tab-btn" :class="{ active: tab === t.id }" @click="tab = t.id">
        {{ t.label }} <span v-if="t.count" class="tab-count" :class="t.count > 0 ? 'warn' : ''">{{ t.count }}</span>
      </button>
    </div>

    <!-- SEO Issues Tab -->
    <div v-if="tab === 'seo' && seoData">
      <div v-if="seoData.issues.length === 0" class="empty-state glass">
        <span>✅</span>
        <p>No SEO issues found! All published content has proper meta tags.</p>
      </div>
      <div v-else class="issues-list">
        <div v-for="item in seoData.issues" :key="`${item.entity_type}-${item.id}`" class="issue-card glass">
          <div class="issue-header">
            <span class="entity-badge" :class="`ent-${item.entity_type}`">{{ item.entity_type }}</span>
            <a :href="editUrl(item)" target="_blank" class="issue-title">{{ item.title }}</a>
            <span class="issue-count">{{ item.issues.length }} issue{{ item.issues.length > 1 ? 's' : '' }}</span>
          </div>
          <div class="issue-pills">
            <span v-for="iss in item.issues" :key="iss.type" class="issue-pill" :class="`sev-${iss.severity}`">
              {{ issueLabel(iss) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Alt Text Tab -->
    <div v-if="tab === 'media' && mediaData">
      <div class="alt-progress glass">
        <div class="alt-bar-wrap">
          <div class="alt-bar-fill" :style="`width:${mediaData.summary.coverage_pct}%`"></div>
        </div>
        <span class="alt-label">{{ mediaData.summary.coverage_pct }}% coverage — {{ mediaData.summary.with_alt }}/{{ mediaData.summary.total_images }} images have alt text</span>
      </div>
      <div v-if="mediaData.missing_alt.length === 0" class="empty-state glass">
        <span>✅</span>
        <p>All images have alt text!</p>
      </div>
      <div v-else class="alt-grid">
        <div v-for="img in mediaData.missing_alt" :key="img.id" class="alt-item glass">
          <img :src="`http://localhost:3200${img.url}`" :alt="img.original" class="alt-thumb" loading="lazy" />
          <div class="alt-body">
            <div class="alt-filename">{{ img.original }}</div>
            <div class="alt-input-row">
              <input
                v-model="altValues[img.id]"
                class="input input-sm"
                placeholder="Describe this image…"
                @keydown.enter="saveAlt(img.id)"
              />
              <button class="btn btn-primary btn-sm" @click="saveAlt(img.id)" :disabled="savedAlts[img.id]">
                {{ savedAlts[img.id] ? '✓' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="mediaData.missing_alt.length > 0" class="bulk-save-bar">
        <span>{{ pendingAltCount }} alt texts filled in</span>
        <button class="btn btn-primary" @click="bulkSaveAlt" :disabled="pendingAltCount === 0 || bulkSaving">
          {{ bulkSaving ? 'Saving…' : '💾 Save All' }}
        </button>
      </div>
    </div>

    <!-- Duplicates Tab -->
    <div v-if="tab === 'duplicates' && dupData">
      <div v-if="dupData.total === 0" class="empty-state glass">
        <span>✅</span>
        <p>No duplicate slugs found.</p>
      </div>
      <div v-else class="table-wrap glass">
        <table class="table">
          <thead>
            <tr><th>Type</th><th>Slug</th><th>Count</th></tr>
          </thead>
          <tbody>
            <tr v-for="d in dupData.duplicate_slugs" :key="`${d.entity_type}-${d.slug}`">
              <td><span class="entity-badge" :class="`ent-${d.entity_type}`">{{ d.entity_type }}</span></td>
              <td class="mono">{{ d.slug }}</td>
              <td><span class="badge badge-red">{{ d.count }} duplicates</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'

const loading = ref(false)
const tab = ref('seo')
const summary = ref(null)
const seoData = ref(null)
const mediaData = ref(null)
const dupData = ref(null)
const altValues = ref({})
const savedAlts = ref({})
const bulkSaving = ref(false)

const tabs = computed(() => [
  { id: 'seo', label: '🏷️ SEO Issues', count: seoData.value?.summary?.total_issues ?? 0 },
  { id: 'media', label: '🖼️ Alt Text', count: mediaData.value?.summary?.missing_alt ?? 0 },
  { id: 'duplicates', label: '🔁 Duplicates', count: dupData.value?.total ?? 0 },
])

const totalNoMeta = computed(() => {
  if (!summary.value) return 0
  return summary.value.no_meta_title.posts + summary.value.no_meta_title.pages + summary.value.no_meta_title.products
})

const totalNoCover = computed(() => {
  if (!summary.value) return 0
  return summary.value.no_cover_image.posts + summary.value.no_cover_image.products
})

const pendingAltCount = computed(() => Object.values(altValues.value).filter(v => v && v.trim()).length)

async function runAudit() {
  loading.value = true
  try {
    const [s, seo, med, dup] = await Promise.all([
      api.get('/site-audit/summary'),
      api.get('/site-audit/seo'),
      api.get('/site-audit/media'),
      api.get('/site-audit/duplicates'),
    ])
    summary.value = s.data
    seoData.value = seo.data
    mediaData.value = med.data
    dupData.value = dup.data
    // Initialize alt values
    altValues.value = {}
    savedAlts.value = {}
    for (const img of med.data.missing_alt) altValues.value[img.id] = ''
  } finally {
    loading.value = false
  }
}

async function saveAlt(id) {
  const alt = altValues.value[id]
  if (!alt?.trim()) return
  await api.put(`/media-alt/${id}`, { alt })
  savedAlts.value[id] = true
}

async function bulkSaveAlt() {
  bulkSaving.value = true
  const updates = Object.entries(altValues.value)
    .filter(([, alt]) => alt && alt.trim())
    .map(([id, alt]) => ({ id: Number(id), alt }))
  if (updates.length === 0) { bulkSaving.value = false; return }
  await api.post('/media-alt/bulk', { updates })
  for (const { id } of updates) savedAlts.value[id] = true
  bulkSaving.value = false
  await runAudit()
}

function editUrl(item) {
  if (item.entity_type === 'post') return `/posts/${item.id}`
  if (item.entity_type === 'page') return `/pages/${item.id}`
  if (item.entity_type === 'product') return `/products/${item.id}`
  return '#'
}

function issueLabel(iss) {
  const map = {
    missing_meta_title: '⚠ No meta title',
    meta_title_too_long: `⚠ Meta title too long (${iss.value} chars)`,
    missing_meta_description: '⚠ No meta description',
    meta_description_too_long: `ℹ Meta description too long (${iss.value} chars)`,
    missing_excerpt: 'ℹ No excerpt',
    missing_cover_image: '⚠ No cover image',
    thin_content: `⚠ Thin content (${iss.value} words)`,
  }
  return map[iss.type] || iss.type
}

onMounted(runAudit)
</script>

<style scoped>
.site-audit-view { max-width: 1000px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.page-desc { color: rgba(255,255,255,0.5); font-size: 0.85rem; margin-top: 0.25rem; }

.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
.summary-card { border-radius: 1rem; padding: 1.25rem; display: flex; gap: 1rem; align-items: flex-start; border: 1px solid rgba(255,255,255,0.08); }
.summary-card.warn { border-color: hsl(38,90%,55%); }
.summary-card.ok { border-color: rgba(74,222,128,0.3); }
.sc-icon { font-size: 1.75rem; flex-shrink: 0; }
.sc-title { font-size: 0.75rem; color: rgba(255,255,255,0.5); font-weight: 600; margin-bottom: 0.2rem; }
.sc-val { font-size: 1.75rem; font-weight: 700; line-height: 1; }
.sc-sub { font-size: 0.72rem; color: rgba(255,255,255,0.4); margin-top: 0.3rem; }

.tabs { display: flex; gap: 0.5rem; padding: 0.5rem; border-radius: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
.tab-btn { background: none; border: none; color: rgba(255,255,255,0.6); padding: 0.5rem 1rem; border-radius: 0.75rem; cursor: pointer; font-size: 0.875rem; transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem; }
.tab-btn.active { background: rgba(255,255,255,0.1); color: #fff; }
.tab-count { padding: 0.1rem 0.5rem; border-radius: 100px; background: rgba(255,255,255,0.12); font-size: 0.72rem; }
.tab-count.warn { background: rgba(249,115,22,0.25); color: #fb923c; }

.issues-list { display: flex; flex-direction: column; gap: 0.75rem; }
.issue-card { border-radius: 1rem; padding: 1rem 1.25rem; }
.issue-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.6rem; flex-wrap: wrap; }
.issue-title { font-size: 0.9rem; font-weight: 600; color: #fff; text-decoration: none; flex: 1; }
.issue-title:hover { color: var(--accent); }
.issue-count { font-size: 0.75rem; color: rgba(255,255,255,0.4); }
.issue-pills { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.issue-pill { padding: 0.2rem 0.6rem; border-radius: 100px; font-size: 0.72rem; font-weight: 600; }
.sev-error { background: rgba(239,68,68,0.2); color: #f87171; }
.sev-warning { background: rgba(249,115,22,0.2); color: #fb923c; }
.sev-info { background: rgba(99,102,241,0.15); color: #a5b4fc; }

.entity-badge { padding: 0.2rem 0.6rem; border-radius: 100px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
.ent-post { background: rgba(99,102,241,0.2); color: #818cf8; }
.ent-page { background: rgba(34,197,94,0.15); color: #4ade80; }
.ent-product { background: rgba(249,115,22,0.2); color: #fb923c; }

.alt-progress { border-radius: 1rem; padding: 1rem 1.5rem; margin-bottom: 1rem; }
.alt-bar-wrap { height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; margin-bottom: 0.5rem; }
.alt-bar-fill { height: 100%; background: var(--accent); border-radius: 4px; transition: width 0.5s; }
.alt-label { font-size: 0.8rem; color: rgba(255,255,255,0.6); }

.alt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
.alt-item { border-radius: 1rem; padding: 0.75rem; display: flex; gap: 0.75rem; align-items: flex-start; }
.alt-thumb { width: 64px; height: 64px; object-fit: cover; border-radius: 0.5rem; flex-shrink: 0; }
.alt-body { flex: 1; min-width: 0; }
.alt-filename { font-size: 0.75rem; color: rgba(255,255,255,0.5); margin-bottom: 0.5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.alt-input-row { display: flex; gap: 0.5rem; }
.alt-input-row .input { flex: 1; }

.bulk-save-bar { display: flex; justify-content: flex-end; align-items: center; gap: 1rem; margin-top: 1rem; padding: 0.75rem 0; border-top: 1px solid rgba(255,255,255,0.07); }
.bulk-save-bar span { color: rgba(255,255,255,0.5); font-size: 0.875rem; }

.empty-state { text-align: center; padding: 3rem; border-radius: 1rem; }
.empty-state span { font-size: 3rem; display: block; margin-bottom: 1rem; }
.empty-state p { color: rgba(255,255,255,0.5); }

.table-wrap { border-radius: 1rem; overflow: hidden; }
.table { width: 100%; border-collapse: collapse; }
.table th { padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; color: rgba(255,255,255,0.4); border-bottom: 1px solid rgba(255,255,255,0.07); }
.table td { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.875rem; }
.mono { font-family: monospace; }
.badge { padding: 0.2rem 0.6rem; border-radius: 100px; font-size: 0.7rem; font-weight: 600; }
.badge-red { background: rgba(239,68,68,0.2); color: #f87171; }
</style>
