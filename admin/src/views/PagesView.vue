<template>
  <div>
    <div class="page-header">
      <h1>Pages</h1>
      <RouterLink to="/pages/new" class="btn btn-primary">+ New Page</RouterLink>
    </div>

    <div class="glass section" v-if="pages.length">
      <table class="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th>Status</th>
            <th>Updated</th>
            <th style="text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="page in pages" :key="page.id">
            <td><strong>{{ page.title }}</strong></td>
            <td class="text-muted">/{{ page.slug }}</td>
            <td><span class="badge" :class="`badge-${page.status}`">{{ page.status }}</span></td>
            <td class="text-muted">{{ formatDate(page.updated_at) }}</td>
            <td style="text-align:right">
              <div class="actions">
                <RouterLink :to="`/pages/${page.id}`" class="btn btn-ghost btn-sm">Edit</RouterLink>
                <button class="btn btn-danger btn-sm" @click="deletePage(page)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="empty-state glass" v-else>
      <p>No pages yet. <RouterLink to="/pages/new">Create your first page.</RouterLink></p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'

const toast = useToastStore()
const pages = ref([])

onMounted(load)

async function load() {
  const { data } = await api.get('/pages?all=1')
  pages.value = data
}

async function deletePage(page) {
  if (!confirm(`Delete "${page.title}"?`)) return
  await api.delete(`/pages/${page.id}`)
  toast.success('Page deleted')
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
