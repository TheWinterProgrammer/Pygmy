<template>
  <div>
    <div class="page-header">
      <h1>Posts</h1>
      <RouterLink to="/posts/new" class="btn btn-primary">+ New Post</RouterLink>
    </div>

    <div class="glass section" v-if="posts.length">
      <table class="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Category</th>
            <th>Status</th>
            <th>Published</th>
            <th style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="post in posts" :key="post.id">
            <td><strong>{{ post.title }}</strong></td>
            <td class="text-muted">{{ post.category_name || '—' }}</td>
            <td><span class="badge" :class="`badge-${post.status}`">{{ post.status }}</span></td>
            <td class="text-muted">{{ post.published_at ? formatDate(post.published_at) : '—' }}</td>
            <td style="text-align:right">
              <div class="actions">
                <RouterLink :to="`/posts/${post.id}`" class="btn btn-ghost btn-sm">Edit</RouterLink>
                <button class="btn btn-danger btn-sm" @click="deletePost(post)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="empty-state glass" v-else>
      <p>No posts yet. <RouterLink to="/posts/new">Write your first post.</RouterLink></p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'

const toast = useToastStore()
const posts = ref([])

onMounted(load)

async function load() {
  const { data } = await api.get('/posts?all=1&limit=100')
  posts.value = data.posts
}

async function deletePost(post) {
  if (!confirm(`Delete "${post.title}"?`)) return
  await api.delete(`/posts/${post.id}`)
  toast.success('Post deleted')
  await load()
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.section { padding: 0; overflow: hidden; }
.text-muted { color: var(--text-muted); font-size: 0.85rem; }
.actions { display: flex; gap: 0.4rem; justify-content: flex-end; }
.empty-state { padding: 2rem; text-align: center; color: var(--text-muted); }
</style>
