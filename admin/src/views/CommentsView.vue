<template>
  <div>
    <div class="page-header">
      <div>
        <h1>Comments</h1>
        <span class="text-muted">Moderate reader comments</span>
      </div>
    </div>

    <!-- Status filter tabs -->
    <div class="filter-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-btn"
        :class="{ active: activeTab === tab.value }"
        @click="activeTab = tab.value; loadComments()"
      >
        {{ tab.label }}
        <span v-if="tab.value === 'pending' && pendingCount > 0" class="badge-count">{{ pendingCount }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div class="loading-row" v-if="loading">
      <div class="spinner"></div>
      <span class="text-muted">Loading...</span>
    </div>

    <!-- Empty state -->
    <div class="glass empty-state" v-else-if="!comments.length">
      <span class="empty-icon">💬</span>
      <p>No {{ activeTab === 'all' ? '' : activeTab }} comments yet.</p>
    </div>

    <!-- Comments list -->
    <div v-else class="comments-list">
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="comment-card glass"
        :class="`status-${comment.status}`"
      >
        <div class="comment-header">
          <div class="author-block">
            <div class="author-avatar">{{ comment.author_name[0].toUpperCase() }}</div>
            <div class="author-info">
              <span class="author-name">{{ comment.author_name }}</span>
              <span class="author-email text-muted">{{ comment.author_email }}</span>
            </div>
          </div>
          <div class="comment-meta">
            <RouterLink :to="`/posts/${getPostId(comment)}`" class="post-link" target="_blank">
              {{ comment.post_title }}
            </RouterLink>
            <span class="comment-date text-muted">{{ formatDate(comment.created_at) }}</span>
            <span class="status-badge" :class="`badge badge-${comment.status}`">{{ comment.status }}</span>
          </div>
        </div>

        <div class="comment-body">
          {{ comment.content }}
        </div>

        <div class="comment-actions">
          <button
            v-if="comment.status !== 'approved'"
            class="btn btn-sm btn-success"
            @click="updateStatus(comment, 'approved')"
            :disabled="processing === comment.id"
          >✓ Approve</button>
          <button
            v-if="comment.status !== 'pending'"
            class="btn btn-sm btn-ghost"
            @click="updateStatus(comment, 'pending')"
            :disabled="processing === comment.id"
          >↺ Pending</button>
          <button
            v-if="comment.status !== 'spam'"
            class="btn btn-sm btn-warning"
            @click="updateStatus(comment, 'spam')"
            :disabled="processing === comment.id"
          >⚠ Spam</button>
          <button
            class="btn btn-sm btn-danger"
            @click="deleteComment(comment)"
            :disabled="processing === comment.id"
          >🗑 Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'

const toast = useToastStore()
const comments = ref([])
const loading = ref(true)
const processing = ref(null)
const pendingCount = ref(0)
const activeTab = ref('pending')

const tabs = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Spam', value: 'spam' },
  { label: 'All', value: 'all' },
]

function getPostId(comment) {
  // We use post_slug for linking to admin post edit
  return comment.post_slug ? comment.post_slug : comment.post_id
}

async function loadComments() {
  loading.value = true
  try {
    const params = activeTab.value !== 'all' ? { status: activeTab.value } : { all: 1 }
    const { data } = await api.get('/comments', { params })
    comments.value = data

    // Always refresh pending count
    if (activeTab.value !== 'pending') {
      const { data: pending } = await api.get('/comments', { params: { status: 'pending' } })
      pendingCount.value = pending.length
    } else {
      pendingCount.value = data.length
    }
  } catch {
    toast.error('Failed to load comments')
  }
  loading.value = false
}

async function updateStatus(comment, status) {
  processing.value = comment.id
  try {
    await api.put(`/comments/${comment.id}`, { status })
    toast.success(`Comment marked as ${status}`)
    await loadComments()
  } catch {
    toast.error('Failed to update comment')
  }
  processing.value = null
}

async function deleteComment(comment) {
  if (!confirm('Delete this comment permanently?')) return
  processing.value = comment.id
  try {
    await api.delete(`/comments/${comment.id}`)
    toast.success('Comment deleted')
    await loadComments()
  } catch {
    toast.error('Failed to delete comment')
  }
  processing.value = null
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(loadComments)
</script>

<style scoped>
.text-muted { color: var(--text-muted); font-size: 0.85rem; }

/* Filter tabs */
.filter-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}
.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 1rem;
  border-radius: 2rem;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.tab-btn:hover { color: var(--text); border-color: rgba(255,255,255,0.15); }
.tab-btn.active {
  background: hsl(355,70%,20%);
  border-color: var(--accent);
  color: var(--accent);
}
.badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: var(--accent);
  color: #fff;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
}

/* Loading */
.loading-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  color: var(--text-muted);
}
.spinner {
  width: 20px; height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Empty */
.empty-state {
  padding: 3rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.empty-icon { font-size: 2.5rem; }
.empty-state p { color: var(--text-muted); }

/* Comments */
.comments-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.comment-card {
  padding: 1.25rem 1.5rem;
  border-left: 3px solid transparent;
  transition: border-color 0.2s;
}
.comment-card.status-pending { border-left-color: hsl(45, 80%, 55%); }
.comment-card.status-approved { border-left-color: hsl(140, 50%, 45%); }
.comment-card.status-spam { border-left-color: hsl(355, 60%, 45%); }

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}

.author-block {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}
.author-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}
.author-info {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.author-name { font-weight: 600; font-size: 0.9rem; }
.author-email { font-size: 0.78rem; }

.comment-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.post-link {
  font-size: 0.8rem;
  color: var(--accent);
  text-decoration: none;
}
.post-link:hover { text-decoration: underline; }
.comment-date { font-size: 0.78rem; }
.status-badge { font-size: 0.72rem; }

.comment-body {
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--text);
  background: rgba(0,0,0,0.2);
  padding: 0.75rem 1rem;
  border-radius: 0.6rem;
  margin-bottom: 0.9rem;
  white-space: pre-wrap;
}

.comment-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* Status badges */
.badge-pending  { background: hsl(45,80%,20%);  color: hsl(45,80%,65%); }
.badge-approved { background: hsl(140,50%,15%); color: hsl(140,50%,55%); }
.badge-spam     { background: hsl(355,60%,20%); color: hsl(355,60%,65%); }

/* Buttons */
.btn-success {
  background: hsl(140,50%,20%);
  color: hsl(140,50%,60%);
  border-color: hsl(140,50%,30%);
}
.btn-success:hover:not(:disabled) { background: hsl(140,50%,28%); }
.btn-warning {
  background: hsl(35,80%,20%);
  color: hsl(35,80%,65%);
  border-color: hsl(35,80%,30%);
}
.btn-warning:hover:not(:disabled) { background: hsl(35,80%,28%); }
.btn-danger {
  background: hsl(355,60%,20%);
  color: hsl(355,60%,65%);
  border-color: hsl(355,60%,30%);
}
.btn-danger:hover:not(:disabled) { background: hsl(355,60%,28%); }
</style>
