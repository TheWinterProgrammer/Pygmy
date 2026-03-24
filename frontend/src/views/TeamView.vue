<template>
  <div class="team-page">
    <!-- Hero -->
    <section class="hero-section">
      <div class="hero-content">
        <h1>{{ settings.team_page_title || 'Meet the Team' }}</h1>
        <p class="hero-sub">{{ settings.team_page_subtitle || 'The people behind the magic' }}</p>
      </div>
    </section>

    <!-- Department filter -->
    <div class="container" v-if="departments.length > 1">
      <div class="dept-filter">
        <button :class="['dept-btn', {active: activeDept===''}]" @click="activeDept=''">All</button>
        <button
          v-for="d in departments"
          :key="d"
          :class="['dept-btn', {active: activeDept===d}]"
          @click="activeDept=d"
        >{{ d }}</button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div class="container" v-if="loading">
      <div class="team-grid">
        <div class="member-skeleton" v-for="i in 6" :key="i">
          <div class="skel photo"></div>
          <div class="skel line short"></div>
          <div class="skel line"></div>
          <div class="skel line half"></div>
        </div>
      </div>
    </div>

    <!-- Team grid -->
    <div class="container" v-else>
      <div class="team-grid" v-if="filteredMembers.length > 0">
        <div class="member-card" v-for="m in filteredMembers" :key="m.id" :class="{featured: m.featured}">
          <div class="member-photo">
            <img v-if="m.photo" :src="m.photo" :alt="m.name" loading="lazy" />
            <div v-else class="photo-placeholder">{{ initials(m.name) }}</div>
          </div>
          <div class="member-body">
            <h3 class="member-name">{{ m.name }}</h3>
            <div class="member-role">{{ m.role }}</div>
            <div class="member-dept" v-if="m.department">{{ m.department }}</div>
            <p class="member-bio" v-if="m.bio">{{ m.bio }}</p>
            <div class="member-socials">
              <a v-if="m.linkedin" :href="m.linkedin" target="_blank" rel="noopener" class="social-btn" title="LinkedIn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
              </a>
              <a v-if="m.twitter" :href="m.twitter" target="_blank" rel="noopener" class="social-btn" title="Twitter/X">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a v-if="m.github" :href="m.github" target="_blank" rel="noopener" class="social-btn" title="GitHub">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/></svg>
              </a>
              <a v-if="m.website" :href="m.website" target="_blank" rel="noopener" class="social-btn" title="Website">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
              </a>
              <a v-if="m.email" :href="'mailto:'+m.email" class="social-btn" title="Email">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="empty-state" v-else>
        <p>No team members to show.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3200/api'

const members = ref([])
const departments = ref([])
const settings = ref({})
const loading = ref(true)
const activeDept = ref('')

async function fetchSettings() {
  try {
    const r = await fetch(`${BASE}/settings`)
    settings.value = await r.json()
  } catch {}
}

async function fetchTeam() {
  loading.value = true
  try {
    const r = await fetch(`${BASE}/team`)
    members.value = await r.json()
    const depts = [...new Set(members.value.map(m => m.department).filter(Boolean))]
    departments.value = depts
  } catch {}
  loading.value = false
}

const filteredMembers = computed(() => {
  if (!activeDept.value) return members.value
  return members.value.filter(m => m.department === activeDept.value)
})

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

onMounted(() => Promise.all([fetchSettings(), fetchTeam()]))
</script>

<style scoped>
.team-page { min-height: 100vh; }

/* Hero */
.hero-section {
  padding: 6rem 2rem 3rem;
  text-align: center;
  background: radial-gradient(ellipse at top, rgba(224,85,98,.15) 0%, transparent 60%);
}
.hero-content h1 { font-size: clamp(2rem, 5vw, 3.5rem); margin: 0 0 .75rem; }
.hero-sub { font-size: 1.1rem; color: var(--text-muted, #9ca3af); margin: 0; }

/* Container */
.container { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }

/* Dept filter */
.dept-filter { display: flex; flex-wrap: wrap; gap: .5rem; justify-content: center; margin-bottom: .5rem; }
.dept-btn {
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  color: var(--text-muted, #9ca3af);
  padding: .4rem 1rem;
  border-radius: 999px;
  cursor: pointer;
  font-size: .85rem;
  font-family: inherit;
  transition: all .2s;
}
.dept-btn:hover { background: rgba(255,255,255,.1); }
.dept-btn.active {
  background: var(--accent, hsl(355,70%,58%));
  color: #fff;
  border-color: var(--accent, hsl(355,70%,58%));
}

/* Grid */
.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.5rem;
}

.member-card {
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 1.5rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform .2s, border-color .2s;
  backdrop-filter: blur(8px);
}
.member-card:hover { transform: translateY(-4px); border-color: rgba(255,255,255,.18); }
.member-card.featured { border-color: rgba(224,85,98,.4); }

.member-photo img {
  width: 100%;
  height: 220px;
  object-fit: cover;
  display: block;
}
.photo-placeholder {
  width: 100%;
  height: 220px;
  background: linear-gradient(135deg, rgba(224,85,98,.2), rgba(255,255,255,.05));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  font-weight: 800;
  color: var(--accent, hsl(355,70%,58%));
}

.member-body { padding: 1.25rem; flex: 1; display: flex; flex-direction: column; gap: .4rem; }
.member-name { font-size: 1.1rem; font-weight: 700; margin: 0; }
.member-role { color: var(--accent, hsl(355,70%,58%)); font-size: .9rem; font-weight: 500; }
.member-dept { color: var(--text-muted, #9ca3af); font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; }
.member-bio { color: var(--text-muted, #9ca3af); font-size: .85rem; line-height: 1.5; margin: .25rem 0 0; flex: 1; }

.member-socials { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: .75rem; }
.social-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255,255,255,.07);
  color: var(--text-muted, #9ca3af);
  text-decoration: none;
  transition: background .2s, color .2s;
}
.social-btn:hover { background: var(--accent, hsl(355,70%,58%)); color: #fff; }

/* Skeletons */
.member-skeleton {
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 1.5rem;
  overflow: hidden;
  padding-bottom: 1.25rem;
}
.skel {
  background: linear-gradient(90deg, rgba(255,255,255,.05) 25%, rgba(255,255,255,.1) 50%, rgba(255,255,255,.05) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: .4rem;
  margin: 0 1.25rem .6rem;
}
.skel.photo { height: 220px; margin: 0 0 1rem; border-radius: 0; }
.skel.line { height: 14px; }
.skel.short { height: 18px; width: 60%; }
.skel.half { width: 40%; }
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* Empty state */
.empty-state { text-align: center; padding: 4rem 1rem; color: var(--text-muted, #9ca3af); }
</style>
