<template>
  <!-- ───── Hero ───── -->
  <section class="hero" :style="heroBg">
    <div class="hero-overlay"></div>
    <div class="hero-content container">
      <h1 class="hero-title">{{ site.settings.hero_title || 'Welcome' }}</h1>
      <p class="hero-subtitle" v-if="site.settings.hero_subtitle">
        {{ site.settings.hero_subtitle }}
      </p>
      <div class="hero-cta">
        <RouterLink to="/blog" class="btn btn-primary">Read the Blog</RouterLink>
      </div>
    </div>
    <!-- Scroll indicator -->
    <div class="scroll-hint" v-if="!scrolled">
      <span class="scroll-arrow">↓</span>
    </div>
  </section>

  <!-- ───── Recent Posts ───── -->
  <section class="posts-section container" v-if="posts.length">
    <h2 class="section-title">Latest Posts</h2>
    <div class="posts-grid">
      <RouterLink
        v-for="post in posts"
        :key="post.id"
        :to="`/blog/${post.slug}`"
        class="post-card glass"
      >
        <div class="card-img" v-if="post.cover_image">
          <img :src="post.cover_image" :alt="post.title" loading="lazy" />
        </div>
        <div class="card-img card-img-placeholder" v-else>
          <span>✍️</span>
        </div>
        <div class="card-body">
          <div class="card-meta">
            <span class="tag" v-if="post.category_name">{{ post.category_name }}</span>
            <span class="date">{{ formatDate(post.published_at || post.created_at) }}</span>
          </div>
          <h3 class="card-title">{{ post.title }}</h3>
          <p class="card-excerpt" v-if="post.excerpt">{{ post.excerpt }}</p>
          <span class="read-more">Read more →</span>
        </div>
      </RouterLink>
    </div>

    <div class="view-all" v-if="total > posts.length">
      <RouterLink to="/blog" class="btn btn-outline">View all posts</RouterLink>
    </div>
  </section>

  <!-- ───── Featured Products ───── -->
  <section class="featured-products-section container" v-if="featuredProducts.length">
    <h2 class="section-title">Featured Products</h2>
    <div class="featured-grid">
      <RouterLink
        v-for="product in featuredProducts"
        :key="product.id"
        :to="`/shop/${product.slug}`"
        class="product-card glass"
      >
        <div class="product-img" v-if="product.cover_image">
          <img :src="product.cover_image" :alt="product.name" loading="lazy" />
          <span class="product-badge-sale" v-if="product.sale_price">Sale</span>
        </div>
        <div class="product-img product-img-placeholder" v-else><span>🛍️</span></div>
        <div class="product-body">
          <div class="product-category text-muted" v-if="product.category_name">{{ product.category_name }}</div>
          <h3 class="product-name">{{ product.name }}</h3>
          <p class="product-excerpt text-muted" v-if="product.excerpt">{{ product.excerpt }}</p>
          <div class="product-price">
            <span v-if="product.sale_price" class="price-sale">
              {{ fmt(product.sale_price) }}
            </span>
            <span :class="product.sale_price ? 'price-original-strike' : 'price-main'">
              {{ fmt(product.price) }}
            </span>
          </div>
        </div>
      </RouterLink>
    </div>
    <div class="view-all">
      <RouterLink to="/shop" class="btn btn-outline">View all products</RouterLink>
    </div>
  </section>

  <!-- ───── Featured Bundles ───── -->
  <section class="bundles-section container" v-if="featuredBundles.length">
    <h2 class="section-title">🪄 Bundle Deals</h2>
    <p class="section-sub">Buy together and save more</p>
    <div class="bundles-grid">
      <RouterLink
        v-for="b in featuredBundles"
        :key="b.id"
        :to="`/shop/bundles/${b.slug}`"
        class="bundle-card glass"
      >
        <div class="bundle-img" v-if="b.cover_image">
          <img :src="b.cover_image" :alt="b.name" loading="lazy" />
        </div>
        <div class="bundle-img bundle-img-ph" v-else>
          <span>🛍️</span>
        </div>
        <div class="bundle-body">
          <h3 class="bundle-name">{{ b.name }}</h3>
          <p class="bundle-desc" v-if="b.description">{{ b.description }}</p>
          <div class="bundle-pricing">
            <span class="bundle-orig">{{ fmt(b.original_total) }}</span>
            <span class="bundle-arrow">→</span>
            <span class="bundle-price">{{ fmt(b.bundle_price) }}</span>
            <span class="bundle-save" v-if="bundleSavingsPct(b) > 0">Save {{ bundleSavingsPct(b) }}%</span>
          </div>
          <div class="bundle-items-preview" v-if="b.items?.length">
            <span v-for="item in b.items.slice(0, 3)" :key="item.product_id" class="bundle-item-pill">
              {{ item.name }}
            </span>
            <span v-if="b.items.length > 3" class="bundle-item-more">+{{ b.items.length - 3 }} more</span>
          </div>
        </div>
        <div class="bundle-cta">View Bundle →</div>
      </RouterLink>
    </div>
    <div class="view-all">
      <RouterLink to="/shop/bundles" class="btn btn-outline">All Bundle Deals →</RouterLink>
    </div>
  </section>

  <!-- ───── Upcoming Events ───── -->
  <section class="events-section container" v-if="upcomingEvents.length">
    <h2 class="section-title">Upcoming Events</h2>
    <div class="events-row">
      <RouterLink
        v-for="ev in upcomingEvents"
        :key="ev.id"
        :to="`/events/${ev.slug}`"
        class="event-card glass"
      >
        <div class="event-date-badge">
          <span class="em">{{ formatMonth(ev.start_date) }}</span>
          <span class="ed">{{ formatDay(ev.start_date) }}</span>
        </div>
        <div class="event-info">
          <div class="event-title">{{ ev.title }}</div>
          <div class="event-loc" v-if="ev.location || ev.venue">
            📍 {{ ev.venue || ev.location }}
          </div>
        </div>
        <span class="event-arrow">→</span>
      </RouterLink>
    </div>
    <div class="view-all">
      <RouterLink to="/events" class="btn btn-outline">All Events</RouterLink>
    </div>
  </section>

  <!-- ───── Empty state ───── -->
  <section class="empty-section container" v-else-if="loaded && !posts.length">
    <div class="empty-glass glass">
      <p>No posts yet. Check back soon!</p>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSiteStore } from '../stores/site.js'
import api from '../api.js'
import { useCurrency } from '../composables/useCurrency.js'
import { trackJourneyEvent } from '../composables/useTracking.js'

const site = useSiteStore()
const { fmt, ensureLoaded: ensureCurrency } = useCurrency()
const posts = ref([])
const total = ref(0)
const loaded = ref(false)
const scrolled = ref(false)
const upcomingEvents = ref([])
const featuredProducts = ref([])
const featuredBundles = ref([])

function bundleSavingsPct(b) {
  if (!b.original_total || b.original_total <= 0) return 0
  return Math.round(((b.original_total - b.bundle_price) / b.original_total) * 100)
}

const heroBg = computed(() => {
  const url = site.settings.hero_bg_url
  if (!url) return {}
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
})

onMounted(async () => {
  await ensureCurrency()
  trackJourneyEvent('page_view', { pagePath: '/', entityType: 'home' })
  try {
    const { data } = await api.get('/posts?limit=6')
    posts.value = data.posts
    total.value = data.total
  } catch {}
  try {
    const { data } = await api.get('/products?featured=1&limit=4')
    featuredProducts.value = data.products || []
  } catch {}
  try {
    const { data } = await api.get('/events/upcoming?limit=3')
    upcomingEvents.value = (data || []).map(e => ({
      ...e,
      tags: typeof e.tags === 'string' ? JSON.parse(e.tags) : (e.tags || [])
    }))
  } catch {}
  try {
    const { data } = await api.get('/bundles?limit=3')
    // Only show published bundles with at least 1 item that have a discount
    featuredBundles.value = (data || [])
      .filter(b => b.status === 'published' && b.bundle_price < b.original_total)
      .slice(0, 3)
  } catch {}
  loaded.value = true
  window.addEventListener('scroll', onScroll, { passive: true })
  // Update SEO
  document.title = site.settings.site_name || 'Pygmy'
})

onUnmounted(() => window.removeEventListener('scroll', onScroll))

function onScroll() {
  scrolled.value = window.scrollY > 80
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatMonth(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
}
function formatDay(d) {
  return new Date(d).getDate()
}
</script>

<style scoped>
/* ─── Hero ─── */
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--bg);
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 25% 60%, hsl(355,50%,10%) 0%, transparent 55%),
    radial-gradient(ellipse at 75% 40%, hsl(228,20%,8%) 0%, transparent 60%),
    rgba(10,11,14,0.5);
  z-index: 1;
}

.hero-content {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 7rem 1.5rem 5rem;
  max-width: 780px;
  margin: 0 auto;
}

.hero-title {
  font-size: clamp(2.4rem, 6vw, 4.5rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.03em;
  margin-bottom: 1.25rem;
  background: linear-gradient(135deg, #fff 30%, hsl(355,70%,70%) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: clamp(1rem, 2.5vw, 1.25rem);
  color: var(--text-muted);
  max-width: 560px;
  margin: 0 auto 2rem;
  line-height: 1.6;
}

.hero-cta { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; }

.scroll-hint {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  animation: bounce 2s infinite;
  color: var(--text-muted);
}
.scroll-arrow { font-size: 1.4rem; }

@keyframes bounce {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50%       { transform: translateX(-50%) translateY(6px); }
}

/* ─── Posts Section ─── */
.posts-section {
  padding: 5rem 1.5rem;
}

.section-title {
  font-size: clamp(1.5rem, 3vw, 2.2rem);
  font-weight: 700;
  margin-bottom: 2.5rem;
  letter-spacing: -0.02em;
}

.posts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.post-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  overflow: hidden;
  transition: transform 0.25s, box-shadow 0.25s;
}
.post-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.35);
  text-decoration: none;
}

.card-img {
  height: 200px;
  overflow: hidden;
  background: var(--surface2);
  border-radius: 1.25rem 1.25rem 0 0;
}
.card-img img {
  width: 100%; height: 100%;
  object-fit: cover;
  transition: transform 0.4s;
}
.post-card:hover .card-img img {
  transform: scale(1.04);
}
.card-img-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
}

.card-body {
  padding: 1.25rem 1.4rem 1.5rem;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.65rem;
}

.tag {
  display: inline-block;
  padding: 0.2rem 0.7rem;
  background: hsl(355,70%,15%);
  color: var(--accent);
  border-radius: 2rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.date {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.card-title {
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.35;
  margin-bottom: 0.6rem;
  color: var(--text);
}

.card-excerpt {
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.6;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.read-more {
  font-size: 0.82rem;
  color: var(--accent);
  margin-top: 1rem;
  font-weight: 500;
}

.view-all { text-align: center; }

/* ─── Events widget ─── */
.featured-products-section { padding: 3rem 1.5rem 2rem; }
.featured-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}
.product-card {
  border-radius: 1rem;
  overflow: hidden;
  text-decoration: none;
  color: var(--text);
  display: flex;
  flex-direction: column;
  transition: transform .2s, box-shadow .2s;
}
.product-card:hover { transform: translateY(-3px); box-shadow: 0 12px 36px rgba(0,0,0,.35); }
.product-img {
  aspect-ratio: 4/3;
  overflow: hidden;
  background: hsl(228,4%,13%);
  position: relative;
}
.product-img img { width: 100%; height: 100%; object-fit: cover; }
.product-img-placeholder {
  display: flex; align-items: center; justify-content: center;
  font-size: 2.5rem;
}
.product-badge-sale {
  position: absolute; top: .5rem; right: .5rem;
  background: var(--accent); color: #fff;
  font-size: .7rem; font-weight: 700; text-transform: uppercase;
  padding: .15rem .5rem; border-radius: 999px;
}
.product-body { padding: 1rem 1.1rem 1.25rem; flex: 1; display: flex; flex-direction: column; }
.product-category { font-size: .73rem; text-transform: uppercase; letter-spacing: .05em; margin-bottom: .3rem; }
.product-name { font-size: 1rem; font-weight: 600; margin-bottom: .4rem; line-height: 1.3; }
.product-excerpt { font-size: .83rem; line-height: 1.5; flex: 1; margin-bottom: .6rem;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.product-price { display: flex; align-items: center; gap: .5rem; margin-top: auto; }
.price-main { font-size: 1.05rem; font-weight: 700; color: var(--accent); }
.price-sale { font-size: 1.05rem; font-weight: 700; color: var(--accent); }
.price-original-strike { font-size: .85rem; color: var(--text-muted); text-decoration: line-through; }
/* ─── Bundle Deals section ─── */
.bundles-section { padding: 3rem 1.5rem 2rem; }
.section-sub { color: var(--text-muted); margin-top: -0.5rem; margin-bottom: 1.5rem; font-size: .9rem; }
.bundles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}
.bundle-card {
  border-radius: 1rem;
  overflow: hidden;
  text-decoration: none;
  color: var(--text);
  display: flex;
  flex-direction: column;
  transition: transform .2s, box-shadow .2s;
}
.bundle-card:hover { transform: translateY(-4px); box-shadow: 0 14px 40px rgba(0,0,0,.4); }
.bundle-img { aspect-ratio: 16/9; overflow: hidden; background: hsl(228,4%,13%); }
.bundle-img img { width: 100%; height: 100%; object-fit: cover; }
.bundle-img-ph { display: flex; align-items: center; justify-content: center; font-size: 2.5rem; }
.bundle-body { padding: 1rem 1.1rem .6rem; flex: 1; }
.bundle-name { font-size: 1rem; font-weight: 600; margin: 0 0 .3rem; }
.bundle-desc { font-size: .8rem; color: var(--text-muted); margin-bottom: .6rem;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.bundle-pricing { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; margin-bottom: .5rem; }
.bundle-orig { font-size: .82rem; color: var(--text-muted); text-decoration: line-through; }
.bundle-arrow { color: var(--text-muted); font-size: .75rem; }
.bundle-price { font-size: 1.05rem; font-weight: 700; color: var(--accent); }
.bundle-save {
  background: rgba(60,200,80,.12);
  color: hsl(140,55%,55%);
  border: 1px solid rgba(60,200,80,.25);
  font-size: .7rem; font-weight: 700;
  padding: .15rem .5rem; border-radius: 999px;
}
.bundle-items-preview { display: flex; flex-wrap: wrap; gap: .35rem; }
.bundle-item-pill {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 999px;
  font-size: .68rem;
  padding: .1rem .45rem;
  color: var(--text-muted);
  max-width: 110px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.bundle-item-more { font-size: .68rem; color: var(--text-muted); padding: .1rem .3rem; }
.bundle-cta {
  display: block;
  padding: .65rem 1.1rem;
  font-size: .8rem;
  font-weight: 600;
  color: var(--accent);
  border-top: 1px solid rgba(255,255,255,.06);
  transition: background .15s;
}
.bundle-card:hover .bundle-cta { background: rgba(255,255,255,.03); }

.events-section { padding: 4rem 1.5rem 2rem; }
.events-row { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
.event-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--text);
  transition: all 0.2s;
}
.event-card:hover { transform: translateX(4px); border-color: var(--accent); }
.event-date-badge {
  background: var(--accent);
  color: #fff;
  border-radius: 0.4rem;
  padding: 0.3rem 0.6rem;
  text-align: center;
  min-width: 48px;
  flex-shrink: 0;
}
.em { display: block; font-size: 0.58rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
.ed { display: block; font-size: 1.25rem; font-weight: 800; line-height: 1; }
.event-info { flex: 1; }
.event-title { font-weight: 600; font-size: 0.95rem; }
.event-loc { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem; }
.event-arrow { color: var(--text-muted); font-size: 1rem; }

/* ─── Empty ─── */
.empty-section { padding: 6rem 1.5rem; }
.empty-glass {
  text-align: center;
  padding: 3rem;
  color: var(--text-muted);
}
</style>
