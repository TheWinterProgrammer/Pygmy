<template>
  <div>
    <div class="page-header">
      <h1>📥 Import Wizard</h1>
    </div>

    <!-- Current content stats -->
    <div class="stats-row" style="margin-bottom:2rem">
      <div class="stat-card glass">
        <div class="stat-label">Posts</div>
        <div class="stat-value">{{ siteStats.posts }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Pages</div>
        <div class="stat-value">{{ siteStats.pages }}</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-label">Products</div>
        <div class="stat-value">{{ siteStats.products }}</div>
      </div>
    </div>

    <!-- Import Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1.5rem">

      <!-- WordPress XML Import -->
      <div class="glass card-section">
        <div style="font-size:2rem;margin-bottom:.5rem">🟦</div>
        <h2 style="margin:0 0 .5rem">WordPress Import</h2>
        <p style="opacity:.7;font-size:.9rem;margin-bottom:1.5rem">
          Import posts, pages, and categories from a WordPress export file (.xml / WXR format).
          Go to <strong>WordPress Admin → Tools → Export</strong> and export "All Content".
        </p>

        <div v-if="!wpResult" class="upload-area glass" @dragover.prevent @drop.prevent="onDropWp" @click="$refs.wpInput.click()">
          <div v-if="!wpFile">
            <div style="font-size:2rem">📄</div>
            <div style="margin:.5rem 0">Drop WordPress .xml file here or click to browse</div>
            <div style="opacity:.5;font-size:.8rem">.xml only</div>
          </div>
          <div v-else style="color:var(--accent)">
            ✓ {{ wpFile.name }} ({{ fmtSize(wpFile.size) }})
          </div>
          <input ref="wpInput" type="file" accept=".xml" style="display:none" @change="onWpFileChange" />
        </div>

        <div v-if="wpResult" class="import-result glass" :class="wpResult.ok ? 'result-ok' : 'result-err'">
          <div v-if="wpResult.ok">
            <strong>✅ Import complete!</strong>
            <ul style="margin:.5rem 0 0">
              <li>Posts imported: <strong>{{ wpResult.stats.posts }}</strong></li>
              <li>Pages imported: <strong>{{ wpResult.stats.pages }}</strong></li>
              <li>Categories created: <strong>{{ wpResult.stats.categories }}</strong></li>
              <li>Skipped (duplicates): <strong>{{ wpResult.stats.skipped }}</strong></li>
            </ul>
            <div v-if="wpResult.stats.errors?.length" style="margin-top:.5rem;color:#f87171;font-size:.85rem">
              {{ wpResult.stats.errors.length }} error(s). First: {{ wpResult.stats.errors[0] }}
            </div>
          </div>
          <div v-else style="color:#f87171">❌ {{ wpResult.error }}</div>
          <button class="btn btn-ghost btn-sm" style="margin-top:1rem" @click="resetWp">Import another</button>
        </div>

        <div v-if="!wpResult" style="margin-top:1rem;display:flex;gap:.75rem">
          <button class="btn btn-primary" @click="runWpImport" :disabled="!wpFile || wpLoading">
            {{ wpLoading ? 'Importing…' : 'Import' }}
          </button>
          <button v-if="wpFile" class="btn btn-ghost" @click="wpFile = null">Clear</button>
        </div>
      </div>

      <!-- Markdown Import -->
      <div class="glass card-section">
        <div style="font-size:2rem;margin-bottom:.5rem">📝</div>
        <h2 style="margin:0 0 .5rem">Markdown Import</h2>
        <p style="opacity:.7;font-size:.9rem;margin-bottom:1.5rem">
          Import posts or pages from Markdown files. Upload a single <strong>.md</strong> file or a
          <strong>.zip</strong> containing multiple Markdown files. Supports YAML frontmatter
          (<code>title</code>, <code>slug</code>, <code>excerpt</code>, <code>tags</code>, <code>status</code>).
        </p>

        <div v-if="!mdResult" class="upload-area glass" @dragover.prevent @drop.prevent="onDropMd" @click="$refs.mdInput.click()">
          <div v-if="!mdFile">
            <div style="font-size:2rem">📦</div>
            <div style="margin:.5rem 0">Drop .md or .zip file here or click to browse</div>
            <div style="opacity:.5;font-size:.8rem">.md or .zip</div>
          </div>
          <div v-else style="color:var(--accent)">
            ✓ {{ mdFile.name }} ({{ fmtSize(mdFile.size) }})
          </div>
          <input ref="mdInput" type="file" accept=".md,.zip" style="display:none" @change="onMdFileChange" />
        </div>

        <div v-if="!mdResult" style="margin-top:1rem">
          <label class="label">Import as</label>
          <div style="display:flex;gap:.75rem">
            <label style="cursor:pointer;display:flex;align-items:center;gap:.4rem">
              <input type="radio" v-model="mdType" value="post" /> Posts (Blog)
            </label>
            <label style="cursor:pointer;display:flex;align-items:center;gap:.4rem">
              <input type="radio" v-model="mdType" value="page" /> Pages
            </label>
          </div>
        </div>

        <div v-if="mdResult" class="import-result glass" :class="mdResult.ok ? 'result-ok' : 'result-err'">
          <div v-if="mdResult.ok">
            <strong>✅ Import complete!</strong>
            <ul style="margin:.5rem 0 0">
              <li>Imported: <strong>{{ mdResult.stats.imported }}</strong> {{ mdResult.type }}(s)</li>
              <li>Skipped (duplicates): <strong>{{ mdResult.stats.skipped }}</strong></li>
            </ul>
            <div v-if="mdResult.stats.errors?.length" style="margin-top:.5rem;color:#f87171;font-size:.85rem">
              {{ mdResult.stats.errors.length }} error(s). First: {{ mdResult.stats.errors[0] }}
            </div>
          </div>
          <div v-else style="color:#f87171">❌ {{ mdResult.error }}</div>
          <button class="btn btn-ghost btn-sm" style="margin-top:1rem" @click="resetMd">Import another</button>
        </div>

        <div v-if="!mdResult" style="margin-top:1rem;display:flex;gap:.75rem">
          <button class="btn btn-primary" @click="runMdImport" :disabled="!mdFile || mdLoading">
            {{ mdLoading ? 'Importing…' : 'Import' }}
          </button>
          <button v-if="mdFile" class="btn btn-ghost" @click="mdFile = null">Clear</button>
        </div>
      </div>

    </div>

    <!-- Tips Section -->
    <div class="glass card-section" style="margin-top:2rem">
      <h3 style="margin:0 0 1rem">💡 Import Tips</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem">
        <div>
          <strong>WordPress XML</strong>
          <p style="opacity:.7;font-size:.85rem;margin:.5rem 0 0">The importer reads posts, pages, and categories.
          Images from your old WordPress site are <em>not</em> transferred — you'll need to re-upload them to the Media Library.</p>
        </div>
        <div>
          <strong>Markdown Frontmatter</strong>
          <p style="opacity:.7;font-size:.85rem;margin:.5rem 0 0">Supported YAML keys: <code>title</code>, <code>slug</code>,
          <code>excerpt</code>, <code>tags: [a, b]</code>, <code>status: draft</code>. All other frontmatter is ignored.</p>
        </div>
        <div>
          <strong>Duplicates</strong>
          <p style="opacity:.7;font-size:.85rem;margin:.5rem 0 0">Content with an existing slug is skipped. Run the import as many times as needed — it won't create duplicates.</p>
        </div>
        <div>
          <strong>After Import</strong>
          <p style="opacity:.7;font-size:.85rem;margin:.5rem 0 0">Review imported content in Posts and Pages. Set cover images, adjust categories, and publish when ready.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const siteStats = ref({ posts: 0, pages: 0, products: 0 })

// WordPress
const wpFile = ref(null)
const wpLoading = ref(false)
const wpResult = ref(null)
const wpInput = ref(null)

// Markdown
const mdFile = ref(null)
const mdLoading = ref(false)
const mdResult = ref(null)
const mdType = ref('post')
const mdInput = ref(null)

async function loadStats() {
  try {
    const res = await fetch('/api/import/status', { headers: { Authorization: `Bearer ${auth.token}` } })
    siteStats.value = await res.json()
  } catch {}
}

function onWpFileChange(e) { wpFile.value = e.target.files[0] || null }
function onDropWp(e) { wpFile.value = e.dataTransfer.files[0] || null }
function onMdFileChange(e) { mdFile.value = e.target.files[0] || null }
function onDropMd(e) { mdFile.value = e.dataTransfer.files[0] || null }

async function runWpImport() {
  if (!wpFile.value) return
  wpLoading.value = true
  try {
    const fd = new FormData()
    fd.append('file', wpFile.value)
    const res = await fetch('/api/import/wordpress', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
      body: fd,
    })
    wpResult.value = await res.json()
    await loadStats()
  } catch (err) {
    wpResult.value = { error: err.message }
  }
  wpLoading.value = false
}

async function runMdImport() {
  if (!mdFile.value) return
  mdLoading.value = true
  try {
    const fd = new FormData()
    fd.append('file', mdFile.value)
    fd.append('type', mdType.value)
    const res = await fetch('/api/import/markdown', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
      body: fd,
    })
    mdResult.value = await res.json()
    await loadStats()
  } catch (err) {
    mdResult.value = { error: err.message }
  }
  mdLoading.value = false
}

function resetWp() { wpResult.value = null; wpFile.value = null }
function resetMd() { mdResult.value = null; mdFile.value = null }

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

onMounted(loadStats)
</script>

<style scoped>
.card-section {
  padding: 1.5rem;
  border-radius: 1rem;
}
.upload-area {
  border: 2px dashed rgba(255,255,255,0.15);
  border-radius: .75rem;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: border-color .2s, background .2s;
}
.upload-area:hover {
  border-color: var(--accent);
  background: rgba(255,255,255,0.03);
}
.import-result {
  border-radius: .75rem;
  padding: 1.25rem;
  margin-top: 1rem;
}
.result-ok {
  border: 1px solid rgba(74,222,128,.3);
  background: rgba(74,222,128,.05);
}
.result-err {
  border: 1px solid rgba(248,113,113,.3);
  background: rgba(248,113,113,.05);
}
code {
  background: rgba(255,255,255,.1);
  padding: .1em .4em;
  border-radius: .25em;
  font-size: .85em;
}
</style>
