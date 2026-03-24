<template>
  <div class="not-found-view" :style="bgStyle">
    <div class="overlay">
      <div class="nf-card glass-card">
        <div class="nf-emoji">{{ cfg.custom_404_emoji || '🔍' }}</div>
        <div class="nf-code">404</div>
        <h1 class="nf-title">{{ cfg.custom_404_title || 'Page Not Found' }}</h1>
        <p class="nf-subtitle">{{ cfg.custom_404_subtitle || "Sorry, the page you're looking for doesn't exist." }}</p>

        <!-- Search bar -->
        <div v-if="cfg.custom_404_show_search === '1'" class="nf-search">
          <form @submit.prevent="doSearch">
            <div class="search-row">
              <input v-model="query" placeholder="Search the site…" class="search-input" />
              <button type="submit" class="search-btn">🔍</button>
            </div>
          </form>
        </div>

        <!-- CTAs -->
        <div class="nf-btns">
          <a :href="cfg.custom_404_cta_url || '/'" class="btn-primary">
            {{ cfg.custom_404_cta_label || 'Go Back Home' }}
          </a>
          <a
            v-if="cfg.custom_404_secondary_cta_label"
            :href="cfg.custom_404_secondary_cta_url || '/shop'"
            class="btn-secondary"
          >
            {{ cfg.custom_404_secondary_cta_label }}
          </a>
          <button @click="$router.go(-1)" class="btn-ghost">← Go Back</button>
        </div>

        <!-- Popular pages -->
        <div v-if="cfg.custom_404_show_popular === '1' && popular.length" class="nf-popular">
          <p class="popular-label">You might be looking for…</p>
          <div class="popular-grid">
            <a
              v-for="p in popular"
              :key="p.slug"
              :href="p.type === 'post' ? `/blog/${p.slug}` : `/${p.slug}`"
              class="popular-card glass-card"
            >
              <div class="popular-img" v-if="p.cover_image" :style="`background-image:url(${p.cover_image})`"></div>
              <div class="popular-img placeholder" v-else>{{ p.type === 'post' ? '📝' : '📄' }}</div>
              <div class="popular-info">
                <span class="popular-type">{{ p.type }}</span>
                <span class="popular-title">{{ p.title }}</span>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api.js'

const router = useRouter()
const cfg = ref({
  custom_404_emoji: '🔍',
  custom_404_title: 'Page Not Found',
  custom_404_subtitle: "Sorry, the page you're looking for doesn't exist.",
  custom_404_cta_label: 'Go Back Home',
  custom_404_cta_url: '/',
  custom_404_secondary_cta_label: 'Browse Shop',
  custom_404_secondary_cta_url: '/shop',
  custom_404_show_search: '1',
  custom_404_show_popular: '1',
})
const popular = ref([])
const query = ref('')

const bgStyle = computed(() => {
  if (!cfg.value.custom_404_bg_image) return {}
  return {
    backgroundImage: `url(${cfg.value.custom_404_bg_image})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
})

onMounted(async () => {
  try {
    // Log this 404 to the error log
    api.post('/error-logs', {
      path: window.location.pathname,
      method: 'GET',
      status_code: 404,
      referrer: document.referrer || '',
    }).catch(() => {})

    const res = await api.get('/custom-404')
    if (res.data.custom_404_enabled !== '0') {
      Object.assign(cfg.value, res.data)
      popular.value = res.data.popular || []
    }
  } catch {}
})

function doSearch() {
  if (query.value.trim()) {
    router.push({ path: '/search', query: { q: query.value.trim() } })
  }
}
</script>

<style scoped>
.not-found-view {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg, hsl(228,4%,10%));
}
.overlay {
  min-height: 100vh;
  width: 100%;
  background: rgba(10,10,18,.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}
.nf-card {
  max-width: 540px;
  width: 100%;
  padding: 3rem 2rem;
  border-radius: 2rem;
  text-align: center;
  background: rgba(20,20,30,.8);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,.1);
}
.nf-emoji { font-size: 4rem; margin-bottom: .25rem; }
.nf-code {
  font-size: 7rem;
  font-weight: 900;
  line-height: 1;
  color: var(--accent, hsl(355,70%,58%));
  opacity: .25;
  margin-bottom: -.5rem;
}
.nf-title { font-size: 1.75rem; margin: .5rem 0 .75rem; }
.nf-subtitle { color: #aaa; margin: 0 0 2rem; font-size: 1rem; }
.nf-search { margin-bottom: 1.5rem; }
.search-row { display: flex; gap: .5rem; }
.search-input {
  flex: 1;
  padding: .6rem 1rem;
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.15);
  border-radius: .75rem;
  color: inherit;
  font-size: .95rem;
}
.search-btn {
  padding: .6rem 1rem;
  background: var(--accent, hsl(355,70%,58%));
  border: none;
  border-radius: .75rem;
  cursor: pointer;
  font-size: .95rem;
}
.nf-btns {
  display: flex;
  gap: .75rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}
.btn-primary {
  padding: .65rem 1.5rem;
  background: var(--accent, hsl(355,70%,58%));
  color: #fff;
  border-radius: .75rem;
  text-decoration: none;
  font-weight: 600;
  font-size: .95rem;
}
.btn-secondary {
  padding: .65rem 1.25rem;
  background: rgba(255,255,255,.1);
  border: 1px solid rgba(255,255,255,.2);
  color: inherit;
  border-radius: .75rem;
  text-decoration: none;
  font-size: .95rem;
}
.btn-ghost {
  padding: .65rem 1.25rem;
  background: none;
  border: 1px solid rgba(255,255,255,.12);
  color: #aaa;
  border-radius: .75rem;
  font-size: .9rem;
  cursor: pointer;
}
.btn-ghost:hover { color: inherit; border-color: rgba(255,255,255,.3); }
.nf-popular { text-align: left; }
.popular-label { font-size: .82rem; color: #888; margin: 0 0 .75rem; text-align: center; text-transform: uppercase; letter-spacing: .05em; }
.popular-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: .75rem; }
.popular-card {
  display: flex;
  gap: .6rem;
  align-items: center;
  padding: .6rem .75rem;
  border-radius: .75rem;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.08);
  text-decoration: none;
  color: inherit;
  transition: background .2s;
}
.popular-card:hover { background: rgba(255,255,255,.09); }
.popular-img {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: .5rem;
  background: rgba(255,255,255,.06) center/cover no-repeat;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.popular-img.placeholder { font-size: 1.2rem; }
.popular-info { display: flex; flex-direction: column; gap: .1rem; min-width: 0; }
.popular-type { font-size: .65rem; color: #888; text-transform: uppercase; }
.popular-title { font-size: .82rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.glass-card { background: var(--surface, hsl(228,4%,15%)); border: 1px solid rgba(255,255,255,.1); }
@media(max-width: 480px) { .popular-grid { grid-template-columns: 1fr; } .nf-code { font-size: 5rem; } }
</style>
