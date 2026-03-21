<template>
  <div>
    <div class="page-header">
      <h1>⭐ Product Reviews</h1>
      <div class="header-meta text-muted" v-if="stats.total">
        {{ stats.total }} total · {{ stats.pending }} pending approval
      </div>
    </div>

    <!-- Tabs -->
    <div class="review-tabs">
      <button
        v-for="tab in tabs" :key="tab.value"
        class="tab-btn" :class="{ active: activeTab === tab.value }"
        @click="activeTab = tab.value; loadReviews()">
        {{ tab.label }}
        <span v-if="tab.value === 'pending' && stats.pending" class="tab-badge">{{ stats.pending }}</span>
      </button>
    </div>

    <!-- Table -->
    <div class="glass table-wrap">
      <div class="loading-bar" v-if="loading"></div>
      <table class="data-table" v-if="reviews.length">
        <thead>
          <tr>
            <th style="width:50px;">Rating</th>
            <th>Reviewer</th>
            <th>Product</th>
            <th>Review</th>
            <th>Date</th>
            <th>Status</th>
            <th style="width:140px;"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in reviews" :key="r.id">
            <td>
              <span class="stars">{{ '★'.repeat(r.rating) }}<span class="empty-stars">{{ '★'.repeat(5 - r.rating) }}</span></span>
            </td>
            <td>
              <div class="reviewer-name">{{ r.author_name }}</div>
              <div class="reviewer-email text-muted">{{ r.author_email }}</div>
            </td>
            <td>
              <span class="product-badge">{{ r.product_name }}</span>
            </td>
            <td>
              <div class="review-title" v-if="r.title"><strong>{{ r.title }}</strong></div>
              <div class="review-body text-muted">{{ truncate(r.body) }}</div>
            </td>
            <td class="text-muted">{{ fmtDate(r.created_at) }}</td>
            <td>
              <span class="badge" :class="statusClass(r.status)">{{ r.status }}</span>
            </td>
            <td class="actions">
              <button v-if="r.status !== 'approved'" class="btn btn-xs btn-success" @click="updateStatus(r, 'approved')">Approve</button>
              <button v-if="r.status !== 'rejected'" class="btn btn-xs btn-ghost" @click="updateStatus(r, 'rejected')">Reject</button>
              <button class="btn btn-xs btn-ghost danger" @click="confirmDelete(r)" title="Delete">🗑</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" v-else-if="!loading">
        <div style="font-size:2rem;margin-bottom:.5rem;">⭐</div>
        <p>No {{ activeTab === 'all' ? '' : activeTab }} reviews yet.</p>
      </div>
    </div>

    <!-- Delete confirm modal -->
    <div class="modal-overlay" v-if="deleteTarget" @click.self="deleteTarget = null">
      <div class="modal glass">
        <h3>Delete Review</h3>
        <p>Delete review by <strong>{{ deleteTarget.author_name }}</strong>? This cannot be undone.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
          <button class="btn btn-danger" @click="deleteReview">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'

const tabs = [
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All', value: 'all' },
]

const activeTab = ref('pending')
const reviews   = ref([])
const stats     = ref({ total: 0, pending: 0 })
const loading   = ref(false)
const deleteTarget = ref(null)

async function loadReviews() {
  loading.value = true
  try {
    const params = {}
    if (activeTab.value !== 'all') params.status = activeTab.value
    const { data } = await api.get('/reviews/admin', { params })
    reviews.value = data.reviews
    stats.value   = { total: data.total, pending: data.pending }
  } finally {
    loading.value = false
  }
}

async function updateStatus(review, status) {
  await api.put(`/reviews/${review.id}`, { status })
  await loadReviews()
}

function confirmDelete(review) {
  deleteTarget.value = review
}

async function deleteReview() {
  await api.delete(`/reviews/${deleteTarget.value.id}`)
  deleteTarget.value = null
  await loadReviews()
}

function truncate(str, max = 100) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}

function fmtDate(dt) {
  return new Date(dt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusClass(s) {
  return { approved: 'badge-green', pending: 'badge-yellow', rejected: 'badge-red' }[s] || ''
}

onMounted(loadReviews)
</script>

<style scoped>
.page-header { display: flex; align-items: baseline; gap: 1rem; margin-bottom: 1.5rem; }
.header-meta { font-size: .85rem; }

.review-tabs {
  display: flex; gap: .5rem; margin-bottom: 1.25rem; flex-wrap: wrap;
}
.tab-btn {
  padding: .4rem .9rem;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: .5rem;
  color: var(--text);
  cursor: pointer;
  font-size: .88rem;
  font-family: inherit;
  transition: background .15s;
  display: flex; align-items: center; gap: .4rem;
}
.tab-btn:hover { background: rgba(255,255,255,.1); }
.tab-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.tab-badge {
  background: rgba(255,255,255,.2);
  border-radius: 999px;
  padding: 0 .4em;
  font-size: .75rem;
  font-weight: 700;
  min-width: 1.2em;
  text-align: center;
}

.stars { font-size: 1rem; color: hsl(40, 90%, 60%); white-space: nowrap; }
.empty-stars { color: rgba(255,255,255,.15); }

.reviewer-name { font-weight: 600; font-size: .9rem; }
.reviewer-email { font-size: .78rem; }

.product-badge {
  background: rgba(255,255,255,.07);
  border-radius: .375rem;
  padding: .2em .6em;
  font-size: .8rem;
  white-space: nowrap;
}
.review-title { font-size: .88rem; margin-bottom: .15rem; }
.review-body  { font-size: .82rem; }

.badge-green  { background: hsl(142,50%,15%); color: hsl(142,60%,60%); }
.badge-yellow { background: hsl(40,50%,15%); color: hsl(40,90%,60%); }
.badge-red    { background: hsl(355,50%,15%); color: hsl(355,70%,65%); }

.actions { display: flex; gap: .4rem; align-items: center; }
.btn-xs { padding: .25rem .55rem; font-size: .78rem; border-radius: .35rem; }
.btn-success { background: hsl(142,50%,18%); color: hsl(142,70%,60%); border: 1px solid hsl(142,40%,25%); }
.btn-success:hover { background: hsl(142,50%,25%); }
.danger { color: var(--accent) !important; }

.empty-state { text-align: center; padding: 3rem; color: var(--text-muted); }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.6);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.modal {
  padding: 2rem; border-radius: 1rem; max-width: 400px; width: 90%;
}
.modal h3 { margin-bottom: .75rem; }
.modal p { color: var(--text-muted); margin-bottom: 1.5rem; }
.modal-actions { display: flex; gap: .75rem; justify-content: flex-end; }
.btn-danger { background: hsl(355,70%,30%); color: hsl(355,70%,80%); }
.btn-danger:hover { background: hsl(355,70%,40%); }
</style>
