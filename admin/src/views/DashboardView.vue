<template>
  <div>
    <div class="page-header">
      <h1>Dashboard</h1>
      <span class="text-muted">Welcome back, {{ auth.user?.name || 'Admin' }} 👋</span>
    </div>

    <div class="stats-grid" v-if="stats">
      <div class="stat-card glass">
        <div class="stat-icon">📄</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.pages.total }}</div>
          <div class="stat-label">Pages <span class="badge badge-published">{{ stats.pages.published }} live</span></div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">✍️</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.posts.total }}</div>
          <div class="stat-label">Posts <span class="badge badge-published">{{ stats.posts.published }} live</span></div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">🖼️</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.media.total }}</div>
          <div class="stat-label">Media files</div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">🧭</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.navigation.total }}</div>
          <div class="stat-label">Nav items</div>
        </div>
      </div>
    </div>

    <div class="section glass" v-if="stats?.recentPosts?.length">
      <h2 style="margin-bottom:1rem;">Recent Posts</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="post in stats.recentPosts" :key="post.id">
            <td>{{ post.title }}</td>
            <td><span class="badge" :class="`badge-${post.status}`">{{ post.status }}</span></td>
            <td class="text-muted">{{ formatDate(post.created_at) }}</td>
            <td><RouterLink :to="`/posts/${post.id}`" class="btn btn-ghost btn-sm">Edit</RouterLink></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="quick-actions">
      <RouterLink to="/pages/new" class="btn btn-ghost">+ New Page</RouterLink>
      <RouterLink to="/posts/new" class="btn btn-ghost">+ New Post</RouterLink>
      <RouterLink to="/media" class="btn btn-ghost">Upload Media</RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import api from '../api.js'

const auth = useAuthStore()
const stats = ref(null)

onMounted(async () => {
  const { data } = await api.get('/dashboard/stats')
  stats.value = data
})

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.text-muted { color: var(--text-muted); font-size: 0.88rem; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
}
.stat-icon { font-size: 1.8rem; }
.stat-num  { font-size: 2rem; font-weight: 700; line-height: 1; }
.stat-label { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem; display: flex; gap: 0.4rem; align-items: center; }

.section { padding: 1.5rem; margin-bottom: 1.5rem; }

.quick-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
</style>
