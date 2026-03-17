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

  <!-- ───── Empty state ───── -->
  <section class="empty-section container" v-else-if="loaded">
    <div class="empty-glass glass">
      <p>No posts yet. Check back soon!</p>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSiteStore } from '../stores/site.js'
import api from '../api.js'

const site = useSiteStore()
const posts = ref([])
const total = ref(0)
const loaded = ref(false)
const scrolled = ref(false)

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
  try {
    const { data } = await api.get('/posts?limit=6')
    posts.value = data.posts
    total.value = data.total
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

/* ─── Empty ─── */
.empty-section { padding: 6rem 1.5rem; }
.empty-glass {
  text-align: center;
  padding: 3rem;
  color: var(--text-muted);
}
</style>
