<template>
  <div class="event-page">
    <!-- Loading skeleton -->
    <div class="container skeleton-wrap" v-if="loading">
      <div class="skeleton-title"></div>
      <div class="skeleton-body glass"></div>
    </div>

    <!-- 404 -->
    <div class="container" v-else-if="!event">
      <div class="glass not-found-card">
        <h1>404</h1>
        <p>Event not found.</p>
        <RouterLink to="/events" class="btn btn-primary">← Back to Events</RouterLink>
      </div>
    </div>

    <!-- Event content -->
    <article v-else class="container event-article">
      <!-- Cover -->
      <div class="cover-wrap" v-if="event.cover_image">
        <img :src="event.cover_image" :alt="event.title" class="cover-img" />
      </div>

      <!-- Header -->
      <header class="event-header">
        <RouterLink to="/events" class="back-link">← All Events</RouterLink>
        <h1 class="event-title">{{ event.title }}</h1>
        <p class="event-excerpt" v-if="event.excerpt">{{ event.excerpt }}</p>
      </header>

      <!-- Info cards -->
      <div class="event-info-row">
        <!-- Date/Time card -->
        <div class="info-card glass">
          <div class="info-icon">📅</div>
          <div class="info-content">
            <div class="info-label">{{ event.end_date ? 'Starts' : 'Date' }}</div>
            <div class="info-value">{{ formatDateTime(event.start_date, event.all_day) }}</div>
            <div v-if="event.end_date" class="info-sub">
              <span class="info-label-sm">Ends</span>
              {{ formatDateTime(event.end_date, event.all_day) }}
            </div>
          </div>
        </div>

        <!-- Location card -->
        <div class="info-card glass" v-if="event.location || event.venue">
          <div class="info-icon">📍</div>
          <div class="info-content">
            <div class="info-label">Location</div>
            <div class="info-value" v-if="event.venue">{{ event.venue }}</div>
            <div class="info-sub" v-if="event.location">{{ event.location }}</div>
          </div>
        </div>

        <!-- Ticket / Status card -->
        <div class="info-card glass" v-if="event.ticket_url || isUpcoming">
          <div class="info-icon">🎟️</div>
          <div class="info-content">
            <div class="info-label">Attendance</div>
            <div class="info-value">
              <span v-if="isUpcoming" class="upcoming-badge">Upcoming</span>
              <span v-else class="past-badge">Past Event</span>
            </div>
            <a
              v-if="event.ticket_url && isUpcoming"
              :href="event.ticket_url"
              target="_blank"
              rel="noopener"
              class="btn btn-primary btn-sm"
              style="margin-top:0.5rem;display:inline-flex;"
            >
              Get Tickets →
            </a>
          </div>
        </div>
      </div>

      <!-- Tags -->
      <div class="event-tags" v-if="event.tags?.length">
        <span class="pill" v-for="tag in event.tags" :key="tag">#{{ tag }}</span>
      </div>

      <!-- Body content -->
      <div class="glass event-body" v-if="event.description">
        <div class="prose" v-html="event.description"></div>
      </div>

      <!-- CTA if ticket url -->
      <div class="glass event-cta" v-if="event.ticket_url && isUpcoming">
        <div>
          <strong>Don't miss it!</strong>
          <p style="margin:0.25rem 0 0;color:var(--text-muted);font-size:0.9rem">Secure your spot before it sells out.</p>
        </div>
        <a :href="event.ticket_url" target="_blank" rel="noopener" class="btn btn-primary">
          🎟️ Get Tickets
        </a>
      </div>

      <!-- Social share -->
      <div class="share-row">
        <span class="share-label">Share:</span>
        <a :href="`https://twitter.com/intent/tweet?text=${encodeURIComponent(event.title)}&url=${encodeURIComponent(pageUrl)}`" target="_blank" rel="noopener" class="share-btn">𝕏</a>
        <a :href="`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`" target="_blank" rel="noopener" class="share-btn">in</a>
        <button class="share-btn" @click="copyLink">{{ copied ? '✓' : '🔗' }}</button>
      </div>

      <!-- Back link -->
      <div style="margin-top:2rem;">
        <RouterLink to="/events" class="btn btn-ghost">← Back to Events</RouterLink>
      </div>
    </article>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@vueuse/head'
import api from '../api.js'
import { useSiteStore } from '../stores/site.js'

const route = useRoute()
const site = useSiteStore()
const event = ref(null)
const loading = ref(true)
const copied = ref(false)

const pageUrl = computed(() => window.location.href)
const isUpcoming = computed(() => event.value ? new Date(event.value.start_date) >= new Date() : false)

useHead(computed(() => {
  if (!event.value) return {}
  const siteName = site.settings.site_name || 'Pygmy'
  return {
    title: `${event.value.meta_title || event.value.title} — ${siteName}`,
    meta: [
      { name: 'description', content: event.value.meta_desc || event.value.excerpt || '' },
      { property: 'og:title', content: event.value.meta_title || event.value.title },
      { property: 'og:description', content: event.value.meta_desc || event.value.excerpt || '' },
      { property: 'og:image', content: event.value.cover_image || '' },
      { property: 'og:type', content: 'article' },
    ]
  }
}))

function formatDateTime(d, allDay) {
  if (!d) return ''
  const date = new Date(d)
  if (allDay) {
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function copyLink() {
  navigator.clipboard.writeText(window.location.href)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}

onMounted(async () => {
  try {
    const { data } = await api.get(`/events/${route.params.slug}`)
    event.value = {
      ...data,
      tags: typeof data.tags === 'string' ? JSON.parse(data.tags) : (data.tags || [])
    }
  } catch {
    event.value = null
  } finally {
    loading.value = false
  }

  // Track analytics
  if (event.value) {
    try {
      api.post('/analytics/view', {
        entity_type: 'event',
        entity_id: event.value.id,
        entity_slug: event.value.slug,
        entity_title: event.value.title,
      })
    } catch {}
  }
})
</script>

<style scoped>
.event-page { padding-bottom: 4rem; }

.container {
  max-width: 860px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.cover-wrap { max-width: 860px; margin: 2rem auto 0; padding: 0 1.5rem; }
.cover-img { width: 100%; max-height: 420px; object-fit: cover; border-radius: var(--radius); display: block; }

.event-header { padding: 2rem 0 1.5rem; }
.back-link { display: inline-block; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem; text-decoration: none; }
.back-link:hover { color: var(--text); }
.event-title { font-size: clamp(1.6rem, 4vw, 2.8rem); font-weight: 800; margin: 0 0 0.6rem; line-height: 1.2; }
.event-excerpt { font-size: 1.05rem; color: var(--text-muted); line-height: 1.6; margin: 0; }

/* Info row */
.event-info-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.info-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.2rem;
  border-radius: var(--radius-sm);
}
.info-icon { font-size: 1.3rem; flex-shrink: 0; line-height: 1; margin-top: 2px; }
.info-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: 0.25rem; }
.info-label-sm { font-size: 0.68rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-right: 0.4rem; }
.info-value { font-size: 0.9rem; font-weight: 600; color: var(--text); }
.info-sub { font-size: 0.82rem; color: var(--text-muted); margin-top: 0.2rem; }

.upcoming-badge {
  background: hsl(145,60%,22%); color: hsl(145,70%,65%);
  font-size: 0.72rem; font-weight: 700; padding: 2px 8px;
  border-radius: 999px; text-transform: uppercase;
}
.past-badge {
  background: var(--surface); color: var(--text-muted);
  font-size: 0.72rem; font-weight: 700; padding: 2px 8px;
  border-radius: 999px; text-transform: uppercase;
}

/* Tags */
.event-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.5rem; }
.pill {
  background: rgba(255,255,255,0.07);
  color: var(--text-muted);
  font-size: 0.8rem;
  padding: 3px 10px;
  border-radius: 999px;
}

/* Content body */
.event-body { padding: 2rem; border-radius: var(--radius); margin-bottom: 1.5rem; }
.prose :deep(h1), .prose :deep(h2), .prose :deep(h3) { margin-top: 1.5em; }
.prose :deep(p) { line-height: 1.8; margin-bottom: 1em; }
.prose :deep(a) { color: var(--accent); }
.prose :deep(img) { max-width: 100%; border-radius: var(--radius-sm); }
.prose :deep(ul), .prose :deep(ol) { padding-left: 1.5em; margin-bottom: 1em; }
.prose :deep(blockquote) { border-left: 3px solid var(--accent); padding-left: 1rem; color: var(--text-muted); font-style: italic; }

/* CTA banner */
.event-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-radius: var(--radius-sm);
  margin-bottom: 1.5rem;
  border: 1px solid hsl(355,70%,30%);
}

/* Share row */
.share-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.5rem; }
.share-label { font-size: 0.82rem; color: var(--text-muted); }
.share-btn {
  background: rgba(255,255,255,0.08);
  border: 1px solid var(--border);
  color: var(--text);
  width: 36px; height: 36px;
  border-radius: 50%;
  font-size: 0.85rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; text-decoration: none;
  transition: background 0.2s;
}
.share-btn:hover { background: var(--accent); border-color: var(--accent); color: #fff; }

/* Skeletons */
.skeleton-wrap { padding: 2rem 1.5rem; max-width: 860px; margin: 0 auto; }
.skeleton-title { height: 2.5rem; width: 60%; border-radius: 0.5rem; background: var(--surface); margin-bottom: 1.5rem; animation: pulse 1.5s infinite; }
.skeleton-body { height: 400px; border-radius: var(--radius); animation: pulse 1.5s infinite; }
@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* 404 */
.not-found-card { padding: 3rem; text-align: center; border-radius: var(--radius); max-width: 400px; margin: 4rem auto; }
.not-found-card h1 { font-size: 4rem; font-weight: 800; color: var(--accent); margin: 0 0 0.5rem; }
</style>
