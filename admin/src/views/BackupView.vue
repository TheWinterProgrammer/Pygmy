<template>
  <div class="backup-view">
    <div class="view-header">
      <div>
        <h1>🗄️ Backup &amp; Export</h1>
        <p class="subtitle">Download your content in JSON or CSV format.</p>
      </div>
    </div>

    <!-- Stats summary -->
    <div class="stats-row glass" v-if="stats">
      <div class="stat" v-for="(val, key) in stats" :key="key">
        <div class="stat-num">{{ val }}</div>
        <div class="stat-label">{{ labels[key] }}</div>
      </div>
    </div>

    <!-- Full JSON Backup -->
    <div class="glass section">
      <div class="section-header">
        <div>
          <h2>📦 Full Site Backup (JSON)</h2>
          <p class="hint">Exports all pages, posts, products, subscribers, navigation, redirects, and settings in a single JSON file. Suitable for migration or archiving.</p>
        </div>
        <button class="btn btn-primary" @click="downloadJSON" :disabled="downloading.json">
          {{ downloading.json ? 'Preparing…' : '⬇️ Download JSON' }}
        </button>
      </div>
    </div>

    <!-- CSV Exports -->
    <div class="glass section">
      <h2>📊 CSV Exports</h2>
      <p class="hint" style="margin-bottom:1.25rem">Export individual content types as CSV for spreadsheet analysis or migration.</p>

      <div class="csv-grid">
        <div class="csv-card glass" v-for="type in csvTypes" :key="type.key">
          <div class="csv-icon">{{ type.icon }}</div>
          <div class="csv-info">
            <div class="csv-title">{{ type.label }}</div>
            <div class="csv-desc">{{ type.desc }}</div>
          </div>
          <button class="btn btn-ghost btn-sm" @click="downloadCSV(type.key)" :disabled="downloading[type.key]">
            {{ downloading[type.key] ? '…' : '⬇️ CSV' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Restore note -->
    <div class="glass section info-section">
      <h2>ℹ️ About Backups</h2>
      <ul class="info-list">
        <li>JSON exports include all text content but <strong>not media files</strong>. Back up your <code>backend/uploads/</code> folder separately.</li>
        <li>Passwords and sensitive SMTP credentials are <strong>not included</strong> in exports for security.</li>
        <li>CSV exports are read-only snapshots — use the JSON export for full backup/restore workflows.</li>
        <li>Automate regular backups by scheduling <code>GET /api/backup/export</code> with your admin token.</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useToastStore } from '../stores/toast.js'

const auth = useAuthStore()
const toast = useToastStore()

const BASE = 'http://localhost:3200'
const stats = ref(null)
const downloading = ref({})

const labels = {
  pages: 'Pages',
  posts: 'Posts',
  products: 'Products',
  media: 'Media files',
  subscribers: 'Subscribers',
  redirects: 'Redirects',
}

const csvTypes = [
  { key: 'posts',       icon: '✍️',  label: 'Posts',       desc: 'Title, slug, category, status, tags, SEO fields' },
  { key: 'pages',       icon: '📄',  label: 'Pages',       desc: 'Title, slug, status, sort order, SEO fields' },
  { key: 'products',    icon: '🛍️',  label: 'Products',    desc: 'Name, price, SKU, category, status, tags' },
  { key: 'subscribers', icon: '📨',  label: 'Subscribers', desc: 'Email, name, status, subscription date' },
]

async function fetchBlob(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const disp = res.headers.get('Content-Disposition') || ''
  const match = disp.match(/filename="([^"]+)"/)
  const filename = match ? match[1] : 'download'
  const blob = await res.blob()
  return { blob, filename }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function downloadJSON() {
  downloading.value.json = true
  try {
    const { blob, filename } = await fetchBlob('/api/backup/export')
    triggerDownload(blob, filename)
    toast.success('Backup downloaded!')
  } catch (e) {
    toast.error('Export failed: ' + e.message)
  } finally {
    downloading.value.json = false
  }
}

async function downloadCSV(type) {
  downloading.value[type] = true
  try {
    const { blob, filename } = await fetchBlob(`/api/backup/export/csv?type=${type}`)
    triggerDownload(blob, filename)
    toast.success(`${type} exported!`)
  } catch (e) {
    toast.error('Export failed: ' + e.message)
  } finally {
    downloading.value[type] = false
  }
}

async function loadStats() {
  const res = await fetch(`${BASE}/api/backup/stats`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  stats.value = await res.json()
}

onMounted(loadStats)
</script>

<style scoped>
.backup-view { padding: 2rem; max-width: 860px; }

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}
.view-header h1 { margin: 0 0 0.2rem; font-size: 1.6rem; }
.subtitle { margin: 0; color: var(--muted); font-size: 0.85rem; }

/* Stats row */
.stats-row {
  display: flex;
  gap: 0;
  border-radius: 1rem;
  overflow: hidden;
  margin-bottom: 1.5rem;
}
.stat {
  flex: 1;
  padding: 1.1rem 1rem;
  text-align: center;
  border-right: 1px solid var(--border);
}
.stat:last-child { border-right: none; }
.stat-num { font-size: 1.6rem; font-weight: 700; color: var(--accent); }
.stat-label { font-size: 0.75rem; color: var(--muted); margin-top: 0.15rem; }

/* Sections */
.section {
  border-radius: 1.2rem;
  padding: 1.5rem;
  margin-bottom: 1rem;
}
.section h2 { margin: 0 0 0.5rem; font-size: 1.05rem; }
.hint { margin: 0; color: var(--muted); font-size: 0.85rem; line-height: 1.5; }

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

/* CSV grid */
.csv-grid { display: flex; flex-direction: column; gap: 0.6rem; }
.csv-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  border-radius: 0.75rem;
  padding: 0.85rem 1rem;
}
.csv-icon { font-size: 1.4rem; width: 2rem; text-align: center; }
.csv-info { flex: 1; }
.csv-title { font-weight: 600; font-size: 0.92rem; }
.csv-desc { font-size: 0.78rem; color: var(--muted); margin-top: 0.15rem; }

/* Info */
.info-section { background: rgba(255,255,255,0.03); }
.info-list {
  margin: 0.5rem 0 0;
  padding-left: 1.25rem;
  color: var(--muted);
  font-size: 0.85rem;
  line-height: 1.8;
}
.info-list strong { color: var(--text); }
.info-list code {
  background: rgba(255,255,255,0.08);
  border-radius: 0.25rem;
  padding: 0.1rem 0.35rem;
  font-size: 0.82rem;
}
</style>
