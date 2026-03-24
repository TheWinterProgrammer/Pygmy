<template>
  <div class="changelog-page">
    <!-- Hero -->
    <section class="changelog-hero">
      <div class="container">
        <h1 class="hero-title">{{ settings.changelog_title || "What's New" }}</h1>
        <p class="hero-subtitle" v-if="settings.changelog_subtitle">{{ settings.changelog_subtitle }}</p>
        <!-- Type filter pills -->
        <div class="type-filters" v-if="availableTypes.length > 1">
          <button
            v-for="type in ['all', ...availableTypes]"
            :key="type"
            :class="['type-pill', { active: activeType === type }]"
            @click="activeType = type"
          >
            <span v-if="type !== 'all'">{{ typeIcon(type) }}</span>
            {{ type === 'all' ? 'All' : typeLabel(type) }}
          </button>
        </div>
      </div>
    </section>

    <!-- Loading -->
    <div class="loading-bar" v-if="loading"></div>

    <!-- Empty -->
    <div v-else-if="filtered.length === 0" class="empty-state container">
      <div class="glass empty-card">
        <div class="empty-icon">📋</div>
        <h2>Nothing here yet</h2>
        <p>Check back soon for updates.</p>
      </div>
    </div>

    <!-- Changelog entries -->
    <section class="changelog-entries container" v-else>
      <div
        v-for="entry in filtered"
        :key="entry.id"
        class="changelog-entry glass"
      >
        <div class="entry-sidebar">
          <div class="entry-version">{{ entry.version }}</div>
          <div class="entry-date text-muted" v-if="entry.published_at">
            {{ formatDate(entry.published_at) }}
          </div>
          <span class="entry-type-badge" :class="`type-${entry.type}`">
            {{ typeIcon(entry.type) }} {{ typeLabel(entry.type) }}
          </span>
        </div>
        <div class="entry-main">
          <h2 class="entry-title">{{ entry.title }}</h2>
          <div
            v-if="entry.content"
            class="entry-content prose"
            v-html="entry.content"
          ></div>
        </div>
      </div>
    </section>

    <!-- NPS Survey (shown after visiting a few times) -->
    <NpsWidget v-if="showNps" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSiteStore } from '../stores/site.js'
import { useHead } from '@vueuse/head'
import api from '../api.js'
import NpsWidget from '../components/NpsWidget.vue'

const site = useSiteStore()
const settings = computed(() => site.settings)

const entries = ref([])
const loading = ref(true)
const activeType = ref('all')
const showNps = ref(false)

const availableTypes = computed(() => {
  const set = new Set(entries.value.map(e => e.type))
  return [...set]
})

const filtered = computed(() =>
  activeType.value === 'all'
    ? entries.value
    : entries.value.filter(e => e.type === activeType.value)
)

useHead(computed(() => ({
  title: (settings.value.changelog_title || "What's New") + ' — ' + (settings.value.site_name || 'Site'),
  meta: [
    { name: 'description', content: settings.value.changelog_subtitle || 'Latest updates and improvements.' }
  ]
})))

async function load() {
  try {
    await site.load()
    const { data } = await api.get('/changelog', { params: { limit: 100 } })
    entries.value = data.entries || []
  } finally {
    loading.value = false
  }
}

function typeLabel(t) {
  return { feature: 'Feature', improvement: 'Improvement', bugfix: 'Bug Fix',
    breaking: 'Breaking', security: 'Security', deprecation: 'Deprecation' }[t] || t
}
function typeIcon(t) {
  return { feature: '✨', improvement: '🔧', bugfix: '🐛',
    breaking: '⚠️', security: '🔒', deprecation: '🗑️' }[t] || '•'
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

onMounted(load)
</script>

<style scoped>
.changelog-page { min-height: 100vh; padding-bottom: 5rem; }

.changelog-hero {
  padding: 4rem 0 2.5rem;
  text-align: center;
  background: linear-gradient(180deg, rgba(255,255,255,.04) 0%, transparent 100%);
  border-bottom: 1px solid rgba(255,255,255,.06);
  margin-bottom: 2.5rem;
}
.container { max-width: 900px; margin: 0 auto; padding-inline: 1.5rem; }
.hero-title { font-size: clamp(1.8rem, 4vw, 2.5rem); font-weight: 900; margin: 0 0 .75rem; }
.hero-subtitle { color: rgba(255,255,255,.6); font-size: 1.05rem; margin: 0 0 1.5rem; }

.type-filters { display: flex; gap: .5rem; justify-content: center; flex-wrap: wrap; margin-top: 1.25rem; }
.type-pill {
  border: 1px solid rgba(255,255,255,.15);
  background: rgba(255,255,255,.06);
  color: rgba(255,255,255,.7);
  padding: .35rem .85rem;
  border-radius: 2rem;
  font-size: .82rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all .2s;
  display: inline-flex; align-items: center; gap: .3rem;
}
.type-pill:hover { background: rgba(255,255,255,.1); }
.type-pill.active { background: var(--accent); border-color: var(--accent); color: #fff; }

.loading-bar { height: 3px; background: linear-gradient(90deg, transparent, var(--accent), transparent); animation: load 1s ease-in-out infinite; border-radius: 2px; }
@keyframes load { 0%,100%{opacity:.4} 50%{opacity:1} }

.empty-card { text-align: center; padding: 3rem 2rem; border-radius: 1rem; max-width: 400px; margin: 3rem auto; }
.empty-icon { font-size: 2.5rem; margin-bottom: .75rem; }

.changelog-entries { display: flex; flex-direction: column; gap: 1.5rem; }

.changelog-entry {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: 2rem;
  border-radius: 1.25rem;
  padding: 1.75rem 2rem;
  position: relative;
  transition: transform .2s;
}
.changelog-entry:hover { transform: translateY(-2px); }

@media (max-width: 680px) {
  .changelog-entry { grid-template-columns: 1fr; gap: 1rem; padding: 1.25rem; }
}

.entry-sidebar {
  display: flex;
  flex-direction: column;
  gap: .4rem;
  padding-top: .15rem;
}

.entry-version {
  font-size: 1rem;
  font-weight: 800;
  color: var(--accent);
  font-family: monospace;
  letter-spacing: .02em;
}
.entry-date { font-size: .8rem; }
.entry-type-badge {
  display: inline-flex;
  align-items: center;
  gap: .25rem;
  font-size: .72rem;
  font-weight: 600;
  padding: .2rem .55rem;
  border-radius: .4rem;
  width: fit-content;
}
.type-feature    { background: rgba(34,197,94,.12);  color: #4ade80; }
.type-improvement{ background: rgba(59,130,246,.12); color: #60a5fa; }
.type-bugfix     { background: rgba(239,68,68,.12);  color: #f87171; }
.type-breaking   { background: rgba(245,158,11,.12); color: #fbbf24; }
.type-security   { background: rgba(168,85,247,.12); color: #c084fc; }
.type-deprecation{ background: rgba(107,114,128,.12);color: #9ca3af; }

.entry-main { min-width: 0; }
.entry-title { font-size: 1.2rem; font-weight: 700; margin: 0 0 .75rem; line-height: 1.3; }

.entry-content.prose { font-size: .9rem; line-height: 1.7; color: rgba(255,255,255,.8); }
.entry-content.prose :deep(ul) { padding-left: 1.5rem; margin: .5rem 0; }
.entry-content.prose :deep(li) { margin: .35rem 0; }
.entry-content.prose :deep(p) { margin: .5rem 0; }
.entry-content.prose :deep(strong) { color: #fff; }
.entry-content.prose :deep(a) { color: var(--accent); }
.entry-content.prose :deep(code) { background: rgba(255,255,255,.1); padding: .1em .35em; border-radius: .3em; font-size: .85em; }
.entry-content.prose :deep(h3), .entry-content.prose :deep(h4) { font-size: .95rem; font-weight: 700; margin: .75rem 0 .25rem; color: #fff; }

.text-muted { color: rgba(255,255,255,.5); }

.glass {
  background: rgba(255,255,255,.06);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,.1);
}
</style>
