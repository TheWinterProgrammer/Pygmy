<!--
  BlockRenderer — renders a list of page_blocks as visual sections.
  Used by PageView when a page has blocks defined.
-->
<template>
  <div class="block-renderer">
    <template v-for="block in blocks" :key="block.id">

      <!-- ── HERO ─────────────────────────────────────────────── -->
      <section v-if="block.type === 'hero'"
        class="br-hero"
        :style="heroStyle(block.settings)"
      >
        <div class="br-hero-overlay" :style="{ opacity: block.settings.overlay_opacity ?? 0.5 }"></div>
        <div class="br-hero-content container" :style="{ textAlign: block.settings.text_align || 'center' }">
          <h1 class="br-hero-title" v-if="block.settings.title">{{ block.settings.title }}</h1>
          <p class="br-hero-subtitle" v-if="block.settings.subtitle">{{ block.settings.subtitle }}</p>
          <a v-if="block.settings.cta_label && block.settings.cta_url"
            :href="block.settings.cta_url" class="btn btn-primary br-cta">
            {{ block.settings.cta_label }}
          </a>
        </div>
      </section>

      <!-- ── FEATURES ───────────────────────────────────────────── -->
      <section v-else-if="block.type === 'features'" class="br-section container">
        <div class="br-section-header" v-if="block.settings.title || block.settings.subtitle">
          <h2 v-if="block.settings.title">{{ block.settings.title }}</h2>
          <p class="br-subtitle" v-if="block.settings.subtitle">{{ block.settings.subtitle }}</p>
        </div>
        <div class="br-features-grid"
          :style="{ '--cols': block.settings.columns || 3 }">
          <div class="br-feature-card glass" v-for="(item, i) in block.settings.items || []" :key="i">
            <div class="br-feature-icon" v-if="item.icon">{{ item.icon }}</div>
            <h3 class="br-feature-title" v-if="item.title">{{ item.title }}</h3>
            <p class="br-feature-text" v-if="item.text">{{ item.text }}</p>
          </div>
        </div>
      </section>

      <!-- ── TEXT ───────────────────────────────────────────────── -->
      <section v-else-if="block.type === 'text'" class="br-section container">
        <div class="br-text-block prose"
          :style="{ maxWidth: block.settings.max_width || '760px', textAlign: block.settings.text_align || 'left', margin: '0 auto' }"
          v-html="block.settings.content"></div>
      </section>

      <!-- ── IMAGE + TEXT ───────────────────────────────────────── -->
      <section v-else-if="block.type === 'image_text'" class="br-section container">
        <div class="br-image-text" :class="{ 'br-image-right': block.settings.image_side !== 'left' }">
          <div class="br-it-image" v-if="block.settings.image">
            <img :src="block.settings.image" :alt="block.settings.title || ''" loading="lazy" />
          </div>
          <div class="br-it-content">
            <h2 v-if="block.settings.title">{{ block.settings.title }}</h2>
            <p v-if="block.settings.text">{{ block.settings.text }}</p>
            <a v-if="block.settings.cta_label && block.settings.cta_url"
              :href="block.settings.cta_url" class="btn btn-primary" style="margin-top:1.25rem;display:inline-block">
              {{ block.settings.cta_label }}
            </a>
          </div>
        </div>
      </section>

      <!-- ── GALLERY ────────────────────────────────────────────── -->
      <section v-else-if="block.type === 'gallery'" class="br-section container">
        <h2 class="br-section-title" v-if="block.settings.title">{{ block.settings.title }}</h2>
        <div class="br-gallery" :style="{ '--cols': block.settings.columns || 3 }">
          <div class="br-gallery-item"
            v-for="(img, i) in block.settings.images || []" :key="i"
            @click="lightboxIdx = i; lightboxImages = block.settings.images"
          >
            <img :src="img.url" :alt="img.alt || ''" loading="lazy" />
          </div>
        </div>
      </section>

      <!-- ── TESTIMONIALS ───────────────────────────────────────── -->
      <section v-else-if="block.type === 'testimonials'" class="br-section container">
        <h2 class="br-section-title" v-if="block.settings.title">{{ block.settings.title }}</h2>
        <div class="br-testimonials">
          <div class="br-testimonial glass" v-for="(item, i) in block.settings.items || []" :key="i">
            <blockquote class="br-quote">"{{ item.quote }}"</blockquote>
            <div class="br-author">
              <img v-if="item.avatar" :src="item.avatar" class="br-avatar" :alt="item.author" />
              <div>
                <div class="br-author-name">{{ item.author }}</div>
                <div class="br-author-role" v-if="item.role">{{ item.role }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── CTA ────────────────────────────────────────────────── -->
      <section v-else-if="block.type === 'cta'" class="br-cta-section"
        :style="block.settings.bg_color ? { background: block.settings.bg_color } : {}">
        <div class="container" :style="{ textAlign: block.settings.centered ? 'center' : 'left' }">
          <h2 v-if="block.settings.title">{{ block.settings.title }}</h2>
          <p class="br-subtitle" v-if="block.settings.subtitle">{{ block.settings.subtitle }}</p>
          <a v-if="block.settings.btn_label && block.settings.btn_url"
            :href="block.settings.btn_url" class="btn btn-primary" style="margin-top:1.25rem;display:inline-block">
            {{ block.settings.btn_label }}
          </a>
        </div>
      </section>

      <!-- ── FAQ ────────────────────────────────────────────────── -->
      <section v-else-if="block.type === 'faq'" class="br-section container">
        <h2 class="br-section-title" v-if="block.settings.title">{{ block.settings.title }}</h2>
        <div class="br-faq">
          <div class="br-faq-item glass" v-for="(item, i) in block.settings.items || []" :key="i">
            <button class="br-faq-q" @click="toggleFaq(block.id, i)">
              <span>{{ item.question }}</span>
              <span class="br-faq-arrow">{{ openFaqs[`${block.id}-${i}`] ? '▲' : '▼' }}</span>
            </button>
            <div class="br-faq-a" v-if="openFaqs[`${block.id}-${i}`]">
              {{ item.answer }}
            </div>
          </div>
        </div>
      </section>

      <!-- ── TEAM ───────────────────────────────────────────────── -->
      <section v-else-if="block.type === 'team'" class="br-section container">
        <div class="br-section-header" v-if="block.settings.title || block.settings.subtitle">
          <h2 v-if="block.settings.title">{{ block.settings.title }}</h2>
          <p class="br-subtitle" v-if="block.settings.subtitle">{{ block.settings.subtitle }}</p>
        </div>
        <div class="br-team">
          <div class="br-team-card glass" v-for="(member, i) in block.settings.items || []" :key="i">
            <div class="br-team-photo" v-if="member.photo">
              <img :src="member.photo" :alt="member.name" />
            </div>
            <div class="br-team-info">
              <div class="br-team-name">{{ member.name }}</div>
              <div class="br-team-role" v-if="member.role">{{ member.role }}</div>
              <p class="br-team-bio" v-if="member.bio">{{ member.bio }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ── PRICING ────────────────────────────────────────────── -->
      <section v-else-if="block.type === 'pricing'" class="br-section container">
        <div class="br-section-header" v-if="block.settings.title || block.settings.subtitle">
          <h2 v-if="block.settings.title">{{ block.settings.title }}</h2>
          <p class="br-subtitle" v-if="block.settings.subtitle">{{ block.settings.subtitle }}</p>
        </div>
        <div class="br-pricing">
          <div
            v-for="(plan, i) in block.settings.items || []" :key="i"
            class="br-plan glass"
            :class="{ 'br-plan-highlight': plan.highlight }"
          >
            <div class="br-plan-badge" v-if="plan.highlight">Most Popular</div>
            <div class="br-plan-name">{{ plan.name }}</div>
            <div class="br-plan-price">
              <span class="br-price-amount">{{ plan.price }}</span>
              <span class="br-price-period" v-if="plan.period">{{ plan.period }}</span>
            </div>
            <ul class="br-plan-features">
              <li v-for="(feat, fi) in (plan.features || [])" :key="fi">
                <span class="br-check">✓</span> {{ feat }}
              </li>
            </ul>
            <a v-if="plan.cta_label && plan.cta_url"
              :href="plan.cta_url"
              class="btn"
              :class="plan.highlight ? 'btn-primary' : 'btn-outline'"
              style="width:100%;text-align:center;margin-top:1.5rem;display:block"
            >{{ plan.cta_label }}</a>
          </div>
        </div>
      </section>

      <!-- ── NEWSLETTER ─────────────────────────────────────────── -->
      <section v-else-if="block.type === 'newsletter'" class="br-section container">
        <div class="br-newsletter glass">
          <h2 v-if="block.settings.title">{{ block.settings.title }}</h2>
          <p class="br-subtitle" v-if="block.settings.subtitle">{{ block.settings.subtitle }}</p>
          <form class="br-nl-form" @submit.prevent="subscribeBlock(block)">
            <input class="input br-nl-input" type="email" v-model="nlEmail"
              :placeholder="block.settings.placeholder || 'Your email address'" required />
            <button class="btn btn-primary" type="submit" :disabled="nlBusy">
              {{ nlBusy ? '…' : (block.settings.btn_label || 'Subscribe') }}
            </button>
          </form>
          <p class="br-nl-success" v-if="nlSuccess">✓ {{ nlSuccess }}</p>
          <p class="br-nl-error" v-if="nlError">{{ nlError }}</p>
        </div>
      </section>

      <!-- ── DIVIDER ─────────────────────────────────────────────── -->
      <div v-else-if="block.type === 'divider'" class="br-divider"
        :class="`br-divider-${block.settings.spacing || 'md'}`">
        <hr v-if="block.settings.style === 'line'" class="br-divider-line" />
        <div v-else-if="block.settings.style === 'dots'" class="br-divider-dots">···</div>
      </div>

      <!-- ── SPACER ──────────────────────────────────────────────── -->
      <div v-else-if="block.type === 'spacer'"
        :style="{ height: block.settings.height || '60px' }"></div>

      <!-- ── EMBED ───────────────────────────────────────────────── -->
      <section v-else-if="block.type === 'embed'" class="br-section container">
        <h2 class="br-section-title" v-if="block.settings.title">{{ block.settings.title }}</h2>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-html="block.settings.html" class="br-embed"></div>
      </section>

    </template>

    <!-- Lightbox (gallery) -->
    <div class="br-lightbox" v-if="lightboxIdx !== null" @click.self="lightboxIdx = null">
      <button class="br-lb-close" @click="lightboxIdx = null">✕</button>
      <button class="br-lb-nav br-lb-prev" @click="lbPrev" v-if="lightboxImages.length > 1">‹</button>
      <img :src="lightboxImages[lightboxIdx]?.url" :alt="lightboxImages[lightboxIdx]?.alt || ''" class="br-lb-img" />
      <button class="br-lb-nav br-lb-next" @click="lbNext" v-if="lightboxImages.length > 1">›</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import api from '../api.js'

defineProps({ blocks: { type: Array, default: () => [] } })

// FAQ accordion
const openFaqs = reactive({})
function toggleFaq(blockId, idx) {
  const key = `${blockId}-${idx}`
  openFaqs[key] = !openFaqs[key]
}

// Gallery lightbox
const lightboxIdx    = ref(null)
const lightboxImages = ref([])
function lbPrev() { lightboxIdx.value = (lightboxIdx.value - 1 + lightboxImages.value.length) % lightboxImages.value.length }
function lbNext() { lightboxIdx.value = (lightboxIdx.value + 1) % lightboxImages.value.length }

// Newsletter subscription
const nlEmail   = ref('')
const nlBusy    = ref(false)
const nlSuccess = ref('')
const nlError   = ref('')

async function subscribeBlock(block) {
  nlBusy.value   = true
  nlSuccess.value = ''
  nlError.value  = ''
  try {
    await api.post('/newsletter/subscribe', { email: nlEmail.value })
    nlSuccess.value = 'You\'re subscribed!'
    nlEmail.value  = ''
  } catch (e) {
    nlError.value = e.response?.data?.error || 'Subscription failed. Please try again.'
  } finally {
    nlBusy.value = false
  }
}

// Hero style builder
function heroStyle(s) {
  const styles = {
    minHeight: s.min_height || '60vh',
    position: 'relative',
  }
  if (s.bg_image) {
    styles.backgroundImage = `url(${s.bg_image})`
    styles.backgroundSize = 'cover'
    styles.backgroundPosition = 'center'
  } else if (s.bg_color) {
    styles.backgroundColor = s.bg_color
  }
  return styles
}
</script>

<style scoped>
/* ── Shared section layout ─────────────────────────────────────────── */
.br-section {
  padding: 4rem 1.5rem;
}
.br-section-header {
  text-align: center;
  margin-bottom: 2.5rem;
}
.br-section-title {
  text-align: center;
  margin-bottom: 2rem;
}
.br-subtitle {
  color: var(--text-muted, #8a8fa8);
  font-size: 1.05rem;
  margin-top: 0.5rem;
}

/* ── Hero ─────────────────────────────────────────────────────────── */
.br-hero {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.br-hero-overlay {
  position: absolute; inset: 0;
  background: hsl(228, 4%, 5%);
  pointer-events: none;
}
.br-hero-content {
  position: relative;
  z-index: 1;
  padding: 5rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}
[style*="text-align: left"] .br-hero-content { align-items: flex-start; }
[style*="text-align: right"] .br-hero-content { align-items: flex-end; }
.br-hero-title {
  font-size: clamp(2rem, 5vw, 4rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.03em;
}
.br-hero-subtitle {
  font-size: clamp(1rem, 2vw, 1.3rem);
  color: rgba(255,255,255,0.75);
  max-width: 600px;
}
.br-cta { margin-top: 0.5rem; font-size: 1.1rem; padding: 0.75rem 2rem; }

/* ── Features ─────────────────────────────────────────────────────── */
.br-features-grid {
  display: grid;
  grid-template-columns: repeat(var(--cols, 3), 1fr);
  gap: 1.5rem;
}
.br-feature-card {
  padding: 1.75rem;
  border-radius: 1.25rem;
  text-align: center;
}
.br-feature-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
.br-feature-title { font-size: 1.05rem; font-weight: 700; margin-bottom: 0.5rem; }
.br-feature-text { color: var(--text-muted, #8a8fa8); font-size: 0.9rem; line-height: 1.6; }

/* ── Image + Text ─────────────────────────────────────────────────── */
.br-image-text {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
}
.br-image-right { direction: rtl; }
.br-image-right > * { direction: ltr; }
.br-it-image img {
  width: 100%;
  border-radius: 1.25rem;
  object-fit: cover;
}
.br-it-content h2 { margin-bottom: 1rem; }
.br-it-content p { color: var(--text-muted, #8a8fa8); line-height: 1.7; }

/* ── Gallery ──────────────────────────────────────────────────────── */
.br-gallery {
  display: grid;
  grid-template-columns: repeat(var(--cols, 3), 1fr);
  gap: 0.75rem;
}
.br-gallery-item {
  border-radius: 0.75rem;
  overflow: hidden;
  cursor: pointer;
  aspect-ratio: 4/3;
}
.br-gallery-item img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s; }
.br-gallery-item:hover img { transform: scale(1.04); }

/* Lightbox */
.br-lightbox {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.92); display: flex;
  align-items: center; justify-content: center;
}
.br-lb-img { max-height: 90vh; max-width: 90vw; border-radius: 0.75rem; }
.br-lb-close {
  position: absolute; top: 1.5rem; right: 1.5rem;
  background: rgba(255,255,255,0.1); border: none; color: #fff;
  font-size: 1.5rem; width: 2.5rem; height: 2.5rem; border-radius: 50%; cursor: pointer;
}
.br-lb-nav {
  position: absolute; top: 50%; transform: translateY(-50%);
  background: rgba(255,255,255,0.1); border: none; color: #fff;
  font-size: 2rem; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;
}
.br-lb-prev { left: 1.5rem; }
.br-lb-next { right: 1.5rem; }

/* ── Testimonials ─────────────────────────────────────────────────── */
.br-testimonials {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}
.br-testimonial { padding: 1.75rem; border-radius: 1.25rem; }
.br-quote {
  font-size: 1rem; line-height: 1.7; font-style: italic;
  color: rgba(255,255,255,0.85); margin-bottom: 1.25rem;
}
.br-author { display: flex; align-items: center; gap: 0.75rem; }
.br-avatar { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; }
.br-author-name { font-weight: 700; font-size: 0.9rem; }
.br-author-role { font-size: 0.8rem; color: var(--text-muted, #8a8fa8); }

/* ── CTA ──────────────────────────────────────────────────────────── */
.br-cta-section {
  padding: 4.5rem 1.5rem;
  background: rgba(255,255,255,0.03);
  border-top: 1px solid rgba(255,255,255,0.06);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.br-cta-section h2 { font-size: clamp(1.5rem, 3vw, 2.5rem); font-weight: 800; }

/* ── FAQ ──────────────────────────────────────────────────────────── */
.br-faq { display: flex; flex-direction: column; gap: 0.75rem; max-width: 760px; margin: 0 auto; }
.br-faq-item { border-radius: 0.75rem; overflow: hidden; }
.br-faq-q {
  width: 100%; display: flex; justify-content: space-between; align-items: center;
  padding: 1.1rem 1.25rem; background: none; border: none; color: var(--text, #fff);
  font-size: 0.95rem; font-weight: 600; cursor: pointer; text-align: left; gap: 1rem;
}
.br-faq-arrow { color: var(--accent); flex-shrink: 0; font-size: 0.8rem; }
.br-faq-a {
  padding: 0 1.25rem 1.25rem;
  color: var(--text-muted, #8a8fa8);
  font-size: 0.9rem; line-height: 1.7;
}

/* ── Team ─────────────────────────────────────────────────────────── */
.br-team {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.5rem;
}
.br-team-card { padding: 1.75rem; border-radius: 1.25rem; text-align: center; }
.br-team-photo img { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; margin: 0 auto 1rem; display: block; }
.br-team-name { font-weight: 700; font-size: 1rem; }
.br-team-role { font-size: 0.82rem; color: var(--accent); margin-top: 0.25rem; }
.br-team-bio { font-size: 0.85rem; color: var(--text-muted, #8a8fa8); margin-top: 0.75rem; line-height: 1.6; }

/* ── Pricing ──────────────────────────────────────────────────────── */
.br-pricing {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.5rem;
  align-items: start;
}
.br-plan {
  padding: 2rem;
  border-radius: 1.5rem;
  position: relative;
  border: 1px solid rgba(255,255,255,0.08);
}
.br-plan-highlight {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
.br-plan-badge {
  position: absolute; top: -0.75rem; left: 50%; transform: translateX(-50%);
  background: var(--accent); color: #fff; font-size: 0.72rem; font-weight: 700;
  padding: 0.2rem 0.75rem; border-radius: 9999px; white-space: nowrap;
}
.br-plan-name { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.75rem; }
.br-plan-price { display: flex; align-items: baseline; gap: 0.35rem; margin-bottom: 1.5rem; }
.br-price-amount { font-size: 2.25rem; font-weight: 800; }
.br-price-period { font-size: 0.85rem; color: var(--text-muted, #8a8fa8); }
.br-plan-features { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.br-plan-features li { font-size: 0.9rem; }
.br-check { color: hsl(140,60%,55%); margin-right: 0.4rem; }

/* ── Newsletter block ─────────────────────────────────────────────── */
.br-newsletter {
  padding: 3rem 2.5rem;
  border-radius: 1.5rem;
  text-align: center;
  max-width: 580px;
  margin: 0 auto;
}
.br-newsletter h2 { margin-bottom: 0.5rem; }
.br-nl-form { display: flex; gap: 0.75rem; margin-top: 1.5rem; }
.br-nl-input { flex: 1; }
.br-nl-success { color: hsl(140,60%,55%); margin-top: 0.75rem; font-size: 0.9rem; }
.br-nl-error   { color: var(--accent); margin-top: 0.75rem; font-size: 0.9rem; }

/* ── Divider ──────────────────────────────────────────────────────── */
.br-divider { padding: 0 1.5rem; }
.br-divider-sm { padding-block: 1rem; }
.br-divider-md { padding-block: 2rem; }
.br-divider-lg { padding-block: 3.5rem; }
.br-divider-line { border: none; border-top: 1px solid rgba(255,255,255,0.1); }
.br-divider-dots { text-align: center; color: var(--text-muted, #8a8fa8); letter-spacing: 0.5em; }

/* ── Embed ────────────────────────────────────────────────────────── */
.br-embed iframe, .br-embed video { max-width: 100%; border-radius: 0.75rem; }

/* ── Responsive ───────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .br-features-grid { grid-template-columns: 1fr; }
  .br-image-text { grid-template-columns: 1fr; direction: ltr !important; }
  .br-gallery { grid-template-columns: repeat(2, 1fr); }
  .br-nl-form { flex-direction: column; }
  .br-pricing { grid-template-columns: 1fr; }
}
</style>
