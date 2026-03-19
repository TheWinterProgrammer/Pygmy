<template>
  <div class="seo-analyzer">
    <!-- Score row -->
    <div class="score-row">
      <div class="score-ring" :class="scoreClass">
        <div class="score-inner">
          <span class="score-num">{{ score }}</span>
          <span class="score-denom">/100</span>
        </div>
      </div>
      <div class="score-meta">
        <div class="score-title">SEO Score</div>
        <div class="score-label" :class="scoreClass">{{ scoreLabel }}</div>
      </div>
    </div>

    <!-- SERP preview -->
    <div class="serp-box">
      <div class="serp-label">Google preview</div>
      <div class="serp-card">
        <div class="serp-favicon">🪆</div>
        <div class="serp-body">
          <div class="serp-site">{{ shortSiteUrl }}</div>
          <div class="serp-title-line">{{ displayTitle }}</div>
          <div class="serp-desc-line">{{ displayDesc }}</div>
        </div>
      </div>
    </div>

    <!-- Character counters -->
    <div class="char-rows">
      <div class="char-row">
        <span class="char-key">Meta title</span>
        <span class="char-val" :class="titleLenClass">{{ metaTitleLen }} / 60</span>
        <div class="char-bar">
          <div class="char-fill" :class="titleLenClass" :style="{ width: Math.min(100, (metaTitleLen / 60) * 100) + '%' }"></div>
        </div>
      </div>
      <div class="char-row">
        <span class="char-key">Meta description</span>
        <span class="char-val" :class="descLenClass">{{ metaDescLen }} / 160</span>
        <div class="char-bar">
          <div class="char-fill" :class="descLenClass" :style="{ width: Math.min(100, (metaDescLen / 160) * 100) + '%' }"></div>
        </div>
      </div>
    </div>

    <!-- Checklist -->
    <div class="checklist">
      <div v-for="item in checks" :key="item.label" class="check-item">
        <span class="check-icon" :class="item.pass ? 'pass' : 'fail'">{{ item.pass ? '✓' : '✗' }}</span>
        <div class="check-right">
          <span class="check-label">{{ item.label }}</span>
          <span v-if="item.tip && !item.pass" class="check-tip">{{ item.tip }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title:      { type: String, default: '' },
  slug:       { type: String, default: '' },
  excerpt:    { type: String, default: '' },
  content:    { type: String, default: '' },
  metaTitle:  { type: String, default: '' },
  metaDesc:   { type: String, default: '' },
  coverImage: { type: String, default: '' },
  type:       { type: String, default: 'post' }, // 'post' | 'page' | 'product'
})

const SITE_URL = 'localhost:5174'

const shortSiteUrl = computed(() => {
  const base = SITE_URL
  const path = props.type === 'post' ? `blog/${props.slug}` : props.slug
  return `${base} › ${path || 'your-slug'}`
})

const displayTitle = computed(() =>
  (props.metaTitle || props.title || '(no title)').slice(0, 70)
)
const displayDesc = computed(() =>
  (props.metaDesc || props.excerpt || '(no description)').slice(0, 180)
)

const metaTitleLen = computed(() => props.metaTitle.length)
const metaDescLen  = computed(() => props.metaDesc.length)

const titleLenClass = computed(() => {
  const l = metaTitleLen.value
  if (l === 0) return 'neutral'
  if (l > 0 && l <= 60) return 'good'
  return 'warn'
})
const descLenClass = computed(() => {
  const l = metaDescLen.value
  if (l === 0) return 'neutral'
  if (l >= 50 && l <= 160) return 'good'
  if (l > 0) return 'warn'
  return 'neutral'
})

// ── Checks ──
const checks = computed(() => {
  const contentWords = props.content.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length
  const titleLen = metaTitleLen.value
  const descLen  = metaDescLen.value

  return [
    {
      label: 'Has a meta title',
      pass:  titleLen > 0,
      tip:   'Add a meta title for search engines',
    },
    {
      label: 'Meta title length (10–60 chars)',
      pass:  titleLen >= 10 && titleLen <= 60,
      tip:   titleLen > 60 ? 'Too long — trim to 60 chars' : 'Meta title is too short',
    },
    {
      label: 'Has a meta description',
      pass:  descLen > 0,
      tip:   'Add a meta description to control search snippet text',
    },
    {
      label: 'Meta description length (50–160 chars)',
      pass:  descLen >= 50 && descLen <= 160,
      tip:   descLen > 160 ? 'Too long — trim to 160 chars' : 'Expand the description (aim for 120–160 chars)',
    },
    {
      label: 'Has a URL slug',
      pass:  !!props.slug,
      tip:   'Set a slug (URL path) for this content',
    },
    {
      label: 'Has a cover / featured image',
      pass:  !!props.coverImage,
      tip:   'A cover image improves social sharing previews',
    },
    {
      label: 'Has an excerpt / summary',
      pass:  !!props.excerpt,
      tip:   'An excerpt appears in blog listings and feeds',
    },
    {
      label: 'Content is substantial (≥ 300 words)',
      pass:  contentWords >= 300,
      tip:   `Currently ${contentWords} words — aim for at least 300`,
    },
    {
      label: 'Title and meta title don\'t match exactly',
      pass:  !props.metaTitle || props.metaTitle !== props.title,
      tip:   'Differentiate the meta title slightly for better click-through',
    },
  ]
})

const score = computed(() => {
  const weights = [15, 10, 15, 10, 10, 10, 10, 15, 5]
  return checks.value.reduce((sum, c, i) => sum + (c.pass ? (weights[i] || 10) : 0), 0)
})

const scoreClass = computed(() => {
  if (score.value >= 80) return 'score-great'
  if (score.value >= 50) return 'score-ok'
  return 'score-poor'
})
const scoreLabel = computed(() => {
  if (score.value >= 80) return 'Great'
  if (score.value >= 50) return 'Needs work'
  return 'Poor'
})
</script>

<style scoped>
.seo-analyzer {
  font-size: 0.82rem;
}

/* ── Score ── */
.score-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-bottom: 1rem;
}
.score-ring {
  width: 56px; height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid;
  flex-shrink: 0;
}
.score-ring.score-great { border-color: #4ade80; }
.score-ring.score-ok    { border-color: #facc15; }
.score-ring.score-poor  { border-color: var(--accent); }

.score-inner { text-align: center; }
.score-num   { font-size: 1.15rem; font-weight: 700; line-height: 1; }
.score-denom { font-size: 0.6rem; color: var(--muted); }

.score-title { font-weight: 600; font-size: 0.85rem; }
.score-label { font-size: 0.75rem; margin-top: 0.1rem; }
.score-label.score-great { color: #4ade80; }
.score-label.score-ok    { color: #facc15; }
.score-label.score-poor  { color: var(--accent); }

/* ── SERP ── */
.serp-box { margin-bottom: 1rem; }
.serp-label { font-size: 0.7rem; color: var(--muted); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em; }
.serp-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 0.6rem;
  padding: 0.75rem;
  display: flex;
  gap: 0.6rem;
}
.serp-favicon { font-size: 1rem; flex-shrink: 0; }
.serp-site    { font-size: 0.7rem; color: #9aa0a6; margin-bottom: 0.1rem; }
.serp-title-line {
  color: #8ab4f8;
  font-size: 0.85rem;
  font-weight: 500;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0.15rem;
}
.serp-desc-line {
  color: #bdc1c6;
  font-size: 0.75rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Char counts ── */
.char-rows { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.char-row  { display: flex; align-items: center; flex-wrap: wrap; gap: 0.3rem; }
.char-key  { flex: 1; color: var(--muted); }
.char-val  { font-size: 0.75rem; font-weight: 600; }
.char-val.good    { color: #4ade80; }
.char-val.warn    { color: #facc15; }
.char-val.neutral { color: var(--muted); }
.char-bar  { width: 100%; height: 3px; background: rgba(255,255,255,0.06); border-radius: 99px; overflow: hidden; }
.char-fill { height: 100%; border-radius: 99px; transition: width 0.3s; }
.char-fill.good    { background: #4ade80; }
.char-fill.warn    { background: #facc15; }
.char-fill.neutral { background: rgba(255,255,255,0.2); }

/* ── Checklist ── */
.checklist { display: flex; flex-direction: column; gap: 0.35rem; }
.check-item {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
}
.check-icon {
  font-size: 0.75rem;
  font-weight: 700;
  width: 14px;
  flex-shrink: 0;
  padding-top: 0.05rem;
}
.check-icon.pass { color: #4ade80; }
.check-icon.fail { color: var(--accent); }
.check-right { display: flex; flex-direction: column; }
.check-label { font-size: 0.8rem; color: var(--text); }
.check-tip   { font-size: 0.72rem; color: var(--muted); margin-top: 0.05rem; }
</style>
