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
      <div class="stat-card glass">
        <div class="stat-icon">💬</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.comments?.total ?? 0 }}</div>
          <div class="stat-label">
            Comments
            <span v-if="stats.comments?.pending > 0" class="badge badge-draft">{{ stats.comments.pending }} pending</span>
          </div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">🛍️</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.products?.total ?? 0 }}</div>
          <div class="stat-label">Products <span class="badge badge-published">{{ stats.products?.published ?? 0 }} live</span></div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">✉️</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.contacts?.total ?? 0 }}</div>
          <div class="stat-label">
            Contact msgs
            <span v-if="(stats.contacts?.unread ?? 0) > 0" class="badge badge-draft">{{ stats.contacts.unread }} new</span>
          </div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">👥</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.users?.total ?? 0 }}</div>
          <div class="stat-label">Users</div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">⏰</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.posts?.scheduled ?? 0 }}</div>
          <div class="stat-label">Scheduled Posts</div>
        </div>
      </div>
      <div class="stat-card glass accent-card">
        <div class="stat-icon">👁️</div>
        <div class="stat-body">
          <div class="stat-num">{{ fmt(stats.analytics?.week ?? 0) }}</div>
          <div class="stat-label">
            Views (7d)
            <RouterLink to="/analytics" class="stat-link">→ Analytics</RouterLink>
          </div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">🔀</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.redirects?.total ?? 0 }}</div>
          <div class="stat-label">Redirects</div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">📨</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.newsletter?.active ?? 0 }}</div>
          <div class="stat-label">
            Subscribers
            <RouterLink to="/newsletter" class="stat-link">→ Newsletter</RouterLink>
          </div>
        </div>
      </div>
      <div class="stat-card glass" :class="{ 'accent-card': stats.forms?.unread > 0 }">
        <div class="stat-icon">📋</div>
        <div class="stat-body">
          <div class="stat-num">
            {{ stats.forms?.active ?? 0 }}
            <span v-if="stats.forms?.unread > 0" class="badge-alert">{{ stats.forms.unread }} new</span>
          </div>
          <div class="stat-label">
            Active Forms
            <RouterLink to="/forms" class="stat-link">→ Forms</RouterLink>
          </div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">📆</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.events?.total ?? 0 }}</div>
          <div class="stat-label">
            Events
            <span v-if="(stats.events?.upcoming ?? 0) > 0" class="badge badge-published">{{ stats.events.upcoming }} upcoming</span>
            <RouterLink to="/events" class="stat-link">→ Events</RouterLink>
          </div>
        </div>
      </div>
      <div class="stat-card glass" :class="{ 'accent-card': (stats.orders?.pending ?? 0) > 0 }">
        <div class="stat-icon">📦</div>
        <div class="stat-body">
          <div class="stat-num">
            {{ stats.orders?.total ?? 0 }}
            <span v-if="(stats.orders?.pending ?? 0) > 0" class="badge-alert">{{ stats.orders.pending }} new</span>
          </div>
          <div class="stat-label">
            Orders
            <RouterLink to="/orders" class="stat-link">→ Orders</RouterLink>
          </div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon">🎟️</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.coupons?.active ?? 0 }}</div>
          <div class="stat-label">
            Active Coupons
            <RouterLink to="/coupons" class="stat-link">→ Coupons</RouterLink>
          </div>
        </div>
      </div>

      <div class="stat-card glass">
        <div class="stat-icon">🧑‍💼</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.customers?.active ?? 0 }}</div>
          <div class="stat-label">
            Customers
            <RouterLink to="/customers" class="stat-link">→ Customers</RouterLink>
          </div>
        </div>
      </div>

      <div class="stat-card glass" :class="{ 'accent-card': (stats.abandoned_carts?.count ?? 0) > 0 }">
        <div class="stat-icon">🛒</div>
        <div class="stat-body">
          <div class="stat-num">
            {{ stats.abandoned_carts?.count ?? 0 }}
            <span v-if="(stats.abandoned_carts?.count ?? 0) > 0" class="badge-alert">recover</span>
          </div>
          <div class="stat-label">
            Abandoned Carts
            <RouterLink to="/abandoned-carts" class="stat-link">→ View</RouterLink>
          </div>
        </div>
      </div>

      <div class="stat-card glass">
        <div class="stat-icon">🧾</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.tax_rates?.active ?? 0 }}</div>
          <div class="stat-label">
            Active Tax Rates
            <RouterLink to="/tax-rates" class="stat-link">→ Tax Rates</RouterLink>
          </div>
        </div>
      </div>

      <div class="stat-card glass" v-if="stats.loyalty?.enabled">
        <div class="stat-icon">🏆</div>
        <div class="stat-body">
          <div class="stat-num">{{ fmt(stats.loyalty?.total_points ?? 0) }}</div>
          <div class="stat-label">
            Points in Circulation
            <RouterLink to="/customers" class="stat-link">→ Customers</RouterLink>
          </div>
        </div>
      </div>

      <div class="stat-card glass" v-if="(stats.gift_cards?.active ?? 0) > 0">
        <div class="stat-icon">🎁</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.gift_cards?.active ?? 0 }}</div>
          <div class="stat-label">
            Active Gift Cards
            <RouterLink to="/gift-cards" class="stat-link">→ Gift Cards</RouterLink>
          </div>
        </div>
      </div>
      <div class="stat-card glass" v-if="(stats.subscriptions?.active ?? 0) > 0 || (stats.subscriptions?.mrr ?? 0) > 0">
        <div class="stat-icon">💳</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.subscriptions?.active ?? 0 }}</div>
          <div class="stat-label">
            Active Members
            <span v-if="stats.subscriptions?.mrr > 0" style="color:var(--accent);font-weight:600"> · €{{ (stats.subscriptions.mrr).toFixed(2) }}/mo MRR</span>
            <RouterLink to="/subscriptions" class="stat-link">→ Subscriptions</RouterLink>
          </div>
        </div>
      </div>

      <div class="stat-card glass" v-if="(stats.affiliates?.total ?? 0) > 0">
        <div class="stat-icon">🤝</div>
        <div class="stat-body">
          <div class="stat-num">{{ stats.affiliates?.total ?? 0 }}</div>
          <div class="stat-label">
            Active Affiliates
            <span v-if="stats.affiliates?.pending_commissions > 0" style="color:var(--accent);font-weight:600"> · €{{ (stats.affiliates.pending_commissions).toFixed(2) }} pending</span>
            <RouterLink to="/affiliates" class="stat-link">→ Affiliates</RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Inventory alerts -->
    <div v-if="(stats.inventory?.out_of_stock ?? 0) > 0 || (stats.inventory?.low_stock?.length ?? 0) > 0"
         class="glass section inventory-alert">
      <h2 style="margin-bottom:.875rem;">⚠️ Inventory Alerts</h2>
      <div class="inv-alert-row" v-if="(stats.inventory?.out_of_stock ?? 0) > 0">
        <span class="inv-badge inv-badge-red">✕ Out of Stock</span>
        <span>{{ stats.inventory.out_of_stock }} published product{{ stats.inventory.out_of_stock !== 1 ? 's' : '' }} out of stock</span>
        <RouterLink to="/products" class="btn btn-ghost btn-sm">Manage</RouterLink>
      </div>
      <template v-if="stats.inventory?.low_stock?.length">
        <div class="inv-alert-row inv-low" v-for="p in stats.inventory.low_stock" :key="p.id">
          <span class="inv-badge inv-badge-yellow">⚠️ Low</span>
          <span>{{ p.name }}</span>
          <span class="text-muted" style="font-size:.82rem;">{{ p.stock_quantity }} left (threshold: {{ p.low_stock_threshold }})</span>
          <RouterLink :to="`/products/${p.id}`" class="btn btn-ghost btn-sm">Edit</RouterLink>
        </div>
      </template>
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

    <!-- Recent Activity -->
    <div class="section glass" v-if="stats?.recentActivity?.length">
      <h2 style="margin-bottom:1rem;">🕐 Recent Activity</h2>
      <ul class="activity-list">
        <li v-for="item in stats.recentActivity" :key="item.id" class="activity-item">
          <span class="activity-who">{{ item.user_name || 'system' }}</span>
          <span class="activity-action">{{ item.action }}</span>
          <span v-if="item.entity_title" class="activity-entity">{{ item.entity_title }}</span>
          <span class="activity-time text-muted">{{ timeAgo(item.created_at) }}</span>
        </li>
      </ul>
    </div>

    <div class="quick-actions">
      <RouterLink to="/pages/new" class="btn btn-ghost">+ New Page</RouterLink>
      <RouterLink to="/posts/new" class="btn btn-ghost">+ New Post</RouterLink>
      <RouterLink to="/products/new" class="btn btn-ghost">+ New Product</RouterLink>
      <RouterLink to="/media" class="btn btn-ghost">Upload Media</RouterLink>
      <RouterLink to="/analytics" class="btn btn-ghost">📈 Analytics</RouterLink>
      <RouterLink to="/redirects" class="btn btn-ghost">🔀 Redirects</RouterLink>
      <RouterLink to="/newsletter" class="btn btn-ghost">📨 Newsletter</RouterLink>
      <RouterLink to="/forms" class="btn btn-ghost">📋 Forms</RouterLink>
      <RouterLink to="/events/new" class="btn btn-ghost">📆 New Event</RouterLink>
      <RouterLink to="/webhooks" class="btn btn-ghost">🔗 Webhooks</RouterLink>
      <RouterLink to="/backup" class="btn btn-ghost">🗄️ Backup</RouterLink>
      <RouterLink to="/orders" class="btn btn-ghost">📦 Orders</RouterLink>
      <RouterLink to="/fulfillment" class="btn btn-ghost">🚢 Fulfillment</RouterLink>
      <RouterLink to="/customers" class="btn btn-ghost">🧑‍💼 Customers</RouterLink>
      <RouterLink to="/coupons" class="btn btn-ghost">🎟️ Coupons</RouterLink>
      <RouterLink to="/abandoned-carts" class="btn btn-ghost">🛒 Abandoned Carts</RouterLink>
      <RouterLink to="/gift-cards" class="btn btn-ghost">🎁 Gift Cards</RouterLink>
      <RouterLink to="/subscriptions" class="btn btn-ghost">💳 Subscriptions</RouterLink>
      <RouterLink to="/revenue" class="btn btn-ghost">💰 Revenue Report</RouterLink>
      <RouterLink to="/affiliates" class="btn btn-ghost">🤝 Affiliates</RouterLink>
      <RouterLink to="/activity-log" class="btn btn-ghost">🕐 Activity Log</RouterLink>
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

function fmt(n) { return Number(n).toLocaleString() }

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
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

.accent-card .stat-num { color: var(--accent); }
.stat-link { font-size: 0.75rem; color: var(--accent); text-decoration: none; margin-left: 0.25rem; }
.stat-link:hover { text-decoration: underline; }

/* Activity list */
.activity-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.activity-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.activity-who   { font-weight: 600; color: var(--accent); min-width: 80px; }
.activity-action { color: var(--text); }
.activity-entity { color: var(--text-muted); font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
.activity-time  { margin-left: auto; color: var(--text-muted); white-space: nowrap; }

.quick-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }

/* Inventory alerts */
.inventory-alert { margin-bottom: 1.5rem; }
.inv-alert-row {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .5rem 0;
  border-bottom: 1px solid rgba(255,255,255,.05);
  font-size: .88rem;
  flex-wrap: wrap;
}
.inv-alert-row:last-child { border-bottom: none; }
.inv-badge {
  display: inline-flex; align-items: center;
  padding: .2em .6em; border-radius: 999px;
  font-size: .75rem; font-weight: 600; white-space: nowrap;
}
.inv-badge-red { background: hsl(355,70%,18%); color: hsl(355,70%,65%); }
.inv-badge-yellow { background: hsl(45,90%,15%); color: hsl(45,90%,65%); }
</style>
