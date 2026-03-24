<template>
  <div>
    <div class="page-header">
      <h1>📦 Orders</h1>
      <div class="header-actions">
        <span class="text-muted" v-if="stats" style="margin-right:.75rem;">
          {{ stats.total }} orders · Revenue {{ fmtCurrency(stats.revenue) }}
        </span>
        <button class="btn btn-ghost" @click="exportCsv" title="Export orders as CSV">
          ⬇️ Export CSV
        </button>
      </div>
    </div>

    <!-- Stats strip -->
    <div class="orders-stats" v-if="stats">
      <div class="ostat glass" v-for="s in statCards" :key="s.label">
        <div class="ostat-num">{{ s.value }}</div>
        <div class="ostat-label">{{ s.label }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="glass filter-bar" style="margin-bottom:1.25rem;display:flex;gap:.75rem;flex-wrap:wrap;align-items:center;padding:.75rem 1rem;">
      <input class="input" style="flex:1;min-width:180px;" placeholder="Search order#, name, email…" v-model="q" @input="debouncedLoad" />
      <select class="input" style="width:160px;" v-model="filterStatus" @change="load">
        <option value="">All statuses</option>
        <option v-for="s in STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
      <div style="display:flex;align-items:center;gap:.4rem;">
        <label style="font-size:.8rem;color:var(--text-muted);white-space:nowrap;">From</label>
        <input type="date" class="input" style="width:140px;" v-model="filterFrom" @change="load" />
      </div>
      <div style="display:flex;align-items:center;gap:.4rem;">
        <label style="font-size:.8rem;color:var(--text-muted);white-space:nowrap;">To</label>
        <input type="date" class="input" style="width:140px;" v-model="filterTo" @change="load" />
      </div>
      <button v-if="filterFrom || filterTo" class="btn btn-ghost btn-sm" @click="filterFrom=''; filterTo=''; load()">✕ Clear dates</button>
    </div>

    <!-- Bulk action bar -->
    <div v-if="selectedOrders.size > 0" class="glass bulk-bar">
      <span class="bulk-count">{{ selectedOrders.size }} selected</span>
      <select class="input input-sm" v-model="bulkStatus" style="width:160px;">
        <option value="">Set status…</option>
        <option v-for="s in STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
      <button class="btn btn-primary btn-sm" @click="applyBulkStatus" :disabled="!bulkStatus || bulkLoading">
        {{ bulkLoading ? 'Updating…' : 'Apply' }}
      </button>
      <button class="btn btn-ghost btn-sm" @click="exportSelectedCsv">⬇️ Export Selected</button>
      <button class="btn btn-ghost btn-sm" @click="selectedOrders.clear()">✕ Clear</button>
    </div>

    <!-- Table -->
    <div class="glass table-wrap">
      <div class="loading-bar" v-if="loading"></div>
      <table class="data-table" v-if="orders.length">
        <thead>
          <tr>
            <th style="width:36px;">
              <input type="checkbox" :checked="allSelected" @change="toggleAll" />
            </th>
            <th>Order #</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Total</th>
            <th>Status</th>
            <th>Date</th>
            <th>Tags</th>
            <th style="width:80px;"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id" @click="openOrder(order)" style="cursor:pointer;">
            <td @click.stop>
              <input type="checkbox" :checked="selectedOrders.has(order.id)" @change="toggleSelect(order.id)" />
            </td>
            <td><strong>{{ order.order_number }}</strong></td>
            <td>
              <div>{{ order.customer_name }}</div>
              <div class="text-muted" style="font-size:.8rem;">{{ order.customer_email }}</div>
            </td>
            <td>{{ order.items.length }} item{{ order.items.length !== 1 ? 's' : '' }}</td>
            <td><strong>{{ fmtCurrency(order.total) }}</strong></td>
            <td>
              <span :class="['badge', statusBadge(order.status)]">{{ order.status }}</span>
              <span v-if="order.payment_status && order.payment_status !== 'unpaid'"
                :class="['badge', order.payment_status === 'paid' ? 'badge-green' : order.payment_status === 'refunded' ? 'badge-red' : 'badge-yellow']"
                style="margin-left:4px;font-size:0.7rem;">
                {{ order.payment_status }}
              </span>
            </td>
            <td class="text-muted" style="font-size:.82rem;">{{ fmtDate(order.created_at) }}</td>
            <td @click.stop>
              <div style="display:flex;flex-wrap:wrap;gap:3px;max-width:160px;">
                <span v-for="tag in parseTags(order.tags)" :key="tag"
                  :style="tagStyle(tag)"
                  style="display:inline-block;padding:1px 6px;border-radius:999px;font-size:0.68rem;font-weight:600;border:1px solid;">
                  {{ tag }}
                </span>
              </div>
            </td>
            <td @click.stop>
              <button class="btn btn-ghost btn-sm" @click="openOrder(order)">View</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="empty-state" v-else-if="!loading">
        <div class="empty-icon">📦</div>
        <p>No orders yet.</p>
        <p class="text-muted">Orders will appear here once customers check out.</p>
      </div>
    </div>

    <!-- Order detail modal -->
    <div class="modal-overlay" v-if="selected" @click.self="selected = null">
      <div class="modal glass" style="max-width:680px;width:95%;">
        <div class="modal-header">
          <h2>Order {{ selected.order_number }}</h2>
          <button class="btn-close" @click="selected = null">✕</button>
        </div>
        <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
          <!-- Status update -->
          <div class="field-row" style="display:flex;gap:.75rem;align-items:center;margin-bottom:1rem;">
            <label class="label" style="white-space:nowrap;">Status:</label>
            <select class="input" v-model="editStatus" style="flex:1;">
              <option v-for="s in STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
            <button class="btn btn-primary btn-sm" @click="saveStatus" :disabled="saving">
              {{ saving ? 'Saving…' : 'Update' }}
            </button>
          </div>

          <!-- Customer info -->
          <div class="section-card glass" style="margin-bottom:1rem;">
            <h3 style="margin:0 0 .5rem;font-size:.95rem;color:var(--accent);">👤 Customer</h3>
            <div class="info-grid">
              <div><span class="label">Name</span><span>{{ selected.customer_name }}</span></div>
              <div><span class="label">Email</span><span>{{ selected.customer_email }}</span></div>
              <div v-if="selected.customer_phone"><span class="label">Phone</span><span>{{ selected.customer_phone }}</span></div>
            </div>
            <div v-if="selected.shipping_address" style="margin-top:.5rem;">
              <span class="label">Shipping address</span>
              <pre style="white-space:pre-wrap;margin:.25rem 0 0;font-size:.85rem;font-family:inherit;">{{ selected.shipping_address }}</pre>
            </div>
            <div v-if="selected.billing_address && !selected.billing_same_as_shipping" style="margin-top:.5rem;">
              <span class="label">Billing address</span>
              <pre style="white-space:pre-wrap;margin:.25rem 0 0;font-size:.85rem;font-family:inherit;">{{ selected.billing_address }}</pre>
            </div>
            <div v-else-if="selected.shipping_address" style="margin-top:.35rem;font-size:.82rem;color:var(--muted);">Billing same as shipping</div>
          </div>

          <!-- Items -->
          <div class="section-card glass" style="margin-bottom:1rem;">
            <h3 style="margin:0 0 .75rem;font-size:.95rem;color:var(--accent);">🛒 Items</h3>
            <table class="data-table" style="font-size:.88rem;">
              <thead><tr><th>Product</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
              <tbody>
                <tr v-for="item in selected.items" :key="item.product_id">
                  <td>
                    <div style="display:flex;align-items:center;gap:.5rem;">
                      <img v-if="item.cover_image" :src="item.cover_image" style="width:32px;height:32px;object-fit:cover;border-radius:.25rem;" />
                      <span>{{ item.name }}</span>
                    </div>
                  </td>
                  <td>{{ item.quantity }}</td>
                  <td>{{ fmtCurrency(item.unit_price) }}</td>
                  <td><strong>{{ fmtCurrency(item.line_total) }}</strong></td>
                </tr>
              </tbody>
            </table>
            <div class="order-subtotal-row" style="display:flex;justify-content:space-between;font-size:.88rem;padding:.3rem 0;color:var(--text-muted);">
              <span>Subtotal</span>
              <span>{{ fmtCurrency(selected.subtotal) }}</span>
            </div>
            <div v-if="selected.coupon_code" class="order-subtotal-row"
                 style="display:flex;justify-content:space-between;font-size:.88rem;padding:.3rem 0;color:hsl(140,60%,60%);">
              <span>🎟️ Coupon ({{ selected.coupon_code }})</span>
              <span>−{{ fmtCurrency(selected.discount_amount) }}</span>
            </div>
            <div v-if="selected.gift_card_code" class="order-subtotal-row"
                 style="display:flex;justify-content:space-between;font-size:.88rem;padding:.3rem 0;color:hsl(140,60%,60%);">
              <span>🎁 Gift Card ({{ selected.gift_card_code }})</span>
              <span>−{{ fmtCurrency(selected.gift_card_discount) }}</span>
            </div>
            <div v-if="selected.shipping_cost > 0" class="order-subtotal-row"
                 style="display:flex;justify-content:space-between;font-size:.88rem;padding:.3rem 0;color:var(--text-muted);">
              <span>🚚 Shipping{{ selected.shipping_rate_name ? ` (${selected.shipping_rate_name})` : '' }}{{ selected.shipping_country ? ` — ${selected.shipping_country}` : '' }}</span>
              <span>{{ fmtCurrency(selected.shipping_cost) }}</span>
            </div>
            <div v-else-if="selected.shipping_country" class="order-subtotal-row"
                 style="display:flex;justify-content:space-between;font-size:.88rem;padding:.3rem 0;color:hsl(140,60%,55%);">
              <span>🚚 Shipping{{ selected.shipping_rate_name ? ` (${selected.shipping_rate_name})` : '' }} — {{ selected.shipping_country }}</span>
              <span>Free</span>
            </div>
            <div class="order-total-row">
              <span>Total</span>
              <strong style="color:var(--accent);">{{ fmtCurrency(selected.total) }}</strong>
            </div>
          </div>

          <!-- Fulfillment / Tracking -->
          <div class="section-card glass" style="margin-bottom:1rem;">
            <h3 style="margin:0 0 .75rem;font-size:.95rem;color:var(--accent);">📦 Fulfillment & Tracking</h3>
            <div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;">
              <div>
                <label class="label" style="display:block;font-size:.78rem;color:var(--text-muted);margin-bottom:.25rem;">Carrier</label>
                <input class="input" type="text" v-model="editTrackingCarrier" placeholder="e.g. DHL, FedEx, UPS" style="width:100%;box-sizing:border-box;" />
              </div>
              <div>
                <label class="label" style="display:block;font-size:.78rem;color:var(--text-muted);margin-bottom:.25rem;">Tracking Number</label>
                <input class="input" type="text" v-model="editTrackingNumber" placeholder="1Z999AA1012345678" style="width:100%;box-sizing:border-box;" />
              </div>
            </div>
            <div style="margin-top:.6rem;">
              <label class="label" style="display:block;font-size:.78rem;color:var(--text-muted);margin-bottom:.25rem;">Tracking URL <span style="opacity:.6">(optional)</span></label>
              <input class="input" type="url" v-model="editTrackingUrl" placeholder="https://track.carrier.com/..." style="width:100%;box-sizing:border-box;" />
            </div>
            <div style="margin-top:.6rem;">
              <label class="label" style="display:block;font-size:.78rem;color:var(--text-muted);margin-bottom:.25rem;">Fulfillment Notes <span style="opacity:.6">(sent to customer)</span></label>
              <input class="input" type="text" v-model="editFulfillmentNotes" placeholder="e.g. Left at front door, requires signature…" style="width:100%;box-sizing:border-box;" />
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:.75rem;flex-wrap:wrap;gap:.5rem;">
              <div v-if="selected.shipped_at" style="font-size:.78rem;color:var(--text-muted);">
                📅 Shipped: {{ fmtDateLong(selected.shipped_at) }}
              </div>
              <div v-else style="font-size:.78rem;color:var(--text-muted);">Not yet shipped</div>
              <button class="btn btn-primary btn-sm" @click="saveFulfillment" :disabled="saving">
                {{ saving ? 'Saving…' : '💾 Save Fulfillment' }}
              </button>
            </div>
            <p v-if="selected.tracking_number || selected.tracking_url" style="font-size:.78rem;margin-top:.4rem;color:hsl(140,55%,55%);">
              ✓ Tracking info on file. Customer will receive shipment email when status → Shipped.
            </p>
          </div>

          <!-- Payment -->
          <div class="section-card glass" style="margin-bottom:1rem;">
            <h3 style="margin:0 0 .75rem;font-size:.95rem;color:var(--accent);">💳 Payment</h3>
            <div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;align-items:end;">
              <div>
                <label class="label" style="display:block;font-size:.78rem;color:var(--text-muted);margin-bottom:.25rem;">Method</label>
                <select class="input" v-model="editPaymentMethod" style="width:100%;">
                  <option value="manual">Manual</option>
                  <option value="stripe">Stripe</option>
                  <option value="paypal">PayPal</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash_on_delivery">Cash on Delivery</option>
                  <option value="crypto">Crypto</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label class="label" style="display:block;font-size:.78rem;color:var(--text-muted);margin-bottom:.25rem;">Status</label>
                <select class="input" v-model="editPaymentStatus" style="width:100%;"
                  :style="{ color: editPaymentStatus === 'paid' ? 'hsl(140,60%,60%)' : editPaymentStatus === 'refunded' ? 'hsl(355,70%,65%)' : '' }">
                  <option value="unpaid">Unpaid</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid ✓</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
            </div>
            <div style="margin-top:.6rem;">
              <label class="label" style="display:block;font-size:.78rem;color:var(--text-muted);margin-bottom:.25rem;">Reference / Transaction ID <span style="opacity:.6">(optional)</span></label>
              <input class="input" type="text" v-model="editPaymentReference" placeholder="txn_1234, pi_xxx, etc." style="width:100%;box-sizing:border-box;" />
            </div>
            <div style="display:flex;justify-content:flex-end;margin-top:.75rem;gap:.5rem;">
              <button class="btn btn-ghost btn-sm"
                v-if="editPaymentStatus !== 'paid'"
                @click="editPaymentStatus = 'paid'; savePayment()"
                :disabled="saving">
                ✓ Mark as Paid
              </button>
              <button class="btn btn-ghost btn-sm" @click="savePayment" :disabled="saving">
                {{ saving ? 'Saving…' : '💾 Save Payment' }}
              </button>
            </div>
          </div>

          <!-- Notes -->
          <div class="section-card glass" style="margin-bottom:1rem;">
            <h3 style="margin:0 0 .5rem;font-size:.95rem;color:var(--accent);">📝 Internal Notes</h3>
            <textarea class="input" rows="3" v-model="editNotes" placeholder="Internal notes (not sent to customer)…" style="width:100%;box-sizing:border-box;"></textarea>
            <button class="btn btn-ghost btn-sm" style="margin-top:.5rem;" @click="saveNotes" :disabled="saving">Save notes</button>
          </div>

          <!-- Order Timeline -->
          <div class="section-card glass" style="margin-bottom:1rem;">
            <OrderTimeline :order-id="selected?.id" />
          </div>

          <!-- Meta -->
          <div class="text-muted" style="font-size:.8rem;">
            Placed: {{ fmtDateLong(selected.created_at) }} · Updated: {{ fmtDate(selected.updated_at) }}
            <span v-if="selected.shipped_at"> · Shipped: {{ fmtDate(selected.shipped_at) }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="selected = null">Close</button>
          <button class="btn btn-ghost" @click="printInvoice(selected)" title="Open print-ready invoice">🖨️ Invoice</button>
          <button class="btn btn-ghost" @click="printPackingSlip(selected)" title="Open packing slip">📋 Packing Slip</button>
          <button class="btn btn-ghost" @click="openMessageModal(selected)" title="Send message to customer">📩 Message Customer</button>
          <button class="btn btn-ghost" @click="openTagsModal(selected)" title="Manage order tags">🏷️ Tags</button>
          <button class="btn btn-danger" @click="confirmDelete(selected)">Delete order</button>
        </div>
      </div>
    </div>

    <!-- Delete confirm -->
    <div class="modal-overlay" v-if="deleteTarget" @click.self="deleteTarget = null">
      <div class="modal glass" style="max-width:420px;text-align:center;">
        <div class="modal-body" style="padding:2rem;">
          <div style="font-size:2.5rem;margin-bottom:.75rem;">🗑️</div>
          <h3>Delete order {{ deleteTarget.order_number }}?</h3>
          <p class="text-muted">This cannot be undone.</p>
          <div style="display:flex;gap:.75rem;justify-content:center;margin-top:1.25rem;">
            <button class="btn btn-ghost" @click="deleteTarget = null">Cancel</button>
            <button class="btn btn-danger" @click="doDelete" :disabled="deleting">
              {{ deleting ? 'Deleting…' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Message Customer Modal -->
    <div class="modal-overlay" v-if="messageTarget" @click.self="messageTarget = null">
      <div class="modal glass" style="max-width:520px;width:95%;">
        <div class="modal-header">
          <h2>📩 Message Customer</h2>
          <button class="btn-close" @click="messageTarget = null">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="messageSentOk" style="text-align:center;padding:1.5rem;color:#5cb85c;font-size:1.1rem;">✓ Message sent successfully!</div>
          <div v-else>
            <p style="color:var(--muted);font-size:.875rem;margin-bottom:1rem;">
              Send an email to <strong>{{ messageTarget.customer_name }}</strong>
              (<em>{{ messageTarget.customer_email }}</em>) about order
              <strong>#{{ messageTarget.order_number }}</strong>.
            </p>
            <div class="form-group">
              <label>Subject</label>
              <input v-model="messageSubject" class="input" placeholder="Email subject…" />
            </div>
            <div class="form-group">
              <label>Message</label>
              <textarea v-model="messageText" class="input" rows="5" placeholder="Write your message to the customer…"></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer" v-if="!messageSentOk">
          <button class="btn btn-ghost" @click="messageTarget = null">Cancel</button>
          <button class="btn btn-primary" @click="sendOrderMessage" :disabled="sendingMessage || !messageText.trim()">
            {{ sendingMessage ? 'Sending…' : '📩 Send Message' }}
          </button>
        </div>
      </div>
    <!-- Order Tags Modal -->
    <div class="modal-overlay" v-if="tagsOrder" @click.self="tagsOrder = null">
      <div class="modal glass" style="max-width:480px;width:95%;">
        <div class="modal-header">
          <h2>🏷️ Tags for {{ tagsOrder.order_number }}</h2>
          <button class="modal-close" @click="tagsOrder = null">✕</button>
        </div>
        <div class="modal-body">
          <div style="display:flex;flex-wrap:wrap;gap:6px;min-height:36px;margin-bottom:1rem;padding:0.5rem;background:rgba(255,255,255,0.03);border-radius:0.5rem;">
            <span v-for="tag in editingTags" :key="tag"
              :style="tagStyle(tag)"
              style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;font-size:0.78rem;font-weight:600;border:1px solid;cursor:default;">
              {{ tag }}
              <button @click="editingTags = editingTags.filter(t => t !== tag)"
                style="background:none;border:none;cursor:pointer;opacity:0.6;font-size:0.7rem;color:inherit;" title="Remove">✕</button>
            </span>
            <span v-if="!editingTags.length" style="color:var(--text-muted,#aaa);font-size:0.875rem;align-self:center;">No tags yet</span>
          </div>

          <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;">
            <input v-model="newTagInput" placeholder="Add tag..." style="flex:1;background:var(--surface);border:1px solid rgba(255,255,255,0.1);border-radius:0.5rem;color:inherit;padding:0.4rem 0.75rem;font-size:0.875rem;" @keydown.enter="addTagToEditing(newTagInput)" />
            <button class="btn btn-ghost" @click="addTagToEditing(newTagInput)" :disabled="!newTagInput.trim()">Add</button>
          </div>

          <div v-if="allTagsList.length" style="display:flex;flex-wrap:wrap;gap:4px;">
            <span style="font-size:0.75rem;color:var(--text-muted,#aaa);width:100%;margin-bottom:4px;">Existing tags:</span>
            <button v-for="t in allTagsList" :key="t.tag"
              @click="addTagToEditing(t.tag)" :disabled="editingTags.includes(t.tag)"
              style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:999px;padding:2px 10px;cursor:pointer;font-size:0.75rem;color:inherit;">
              {{ t.tag }} ({{ t.usage_count }})
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="tagsOrder = null">Cancel</button>
          <button class="btn btn-accent" @click="saveTags">💾 Save</button>
        </div>
      </div>
    </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import OrderTimeline from '../components/OrderTimeline.vue'

const auth = useAuthStore()

const orders     = ref([])
const stats      = ref(null)
const loading    = ref(false)
const saving     = ref(false)
const deleting   = ref(false)
const q          = ref('')
const filterStatus = ref('')
const filterFrom   = ref('')
const filterTo     = ref('')
const selected           = ref(null)
// Bulk selection
const selectedOrders = ref(new Set())
const bulkStatus     = ref('')
const bulkLoading    = ref(false)
const allSelected    = computed(() => orders.value.length > 0 && orders.value.every(o => selectedOrders.value.has(o.id)))
function toggleSelect(id) {
  const s = new Set(selectedOrders.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedOrders.value = s
}
function toggleAll() {
  if (allSelected.value) {
    selectedOrders.value = new Set()
  } else {
    selectedOrders.value = new Set(orders.value.map(o => o.id))
  }
}
async function applyBulkStatus() {
  if (!bulkStatus.value || selectedOrders.value.size === 0) return
  bulkLoading.value = true
  try {
    const ids = [...selectedOrders.value]
    await Promise.all(ids.map(id => apiFetch(`/orders/${id}`, { method: 'PUT', body: JSON.stringify({ status: bulkStatus.value }) })))
    await load()
    selectedOrders.value = new Set()
    bulkStatus.value = ''
  } catch (e) {
    alert(e.message)
  } finally {
    bulkLoading.value = false
  }
}
function exportSelectedCsv() {
  const selected = orders.value.filter(o => selectedOrders.value.has(o.id))
  const header = ['Order #', 'Customer', 'Email', 'Total', 'Status', 'Payment Status', 'Date']
  const rows = selected.map(o => [
    o.order_number,
    o.customer_name,
    o.customer_email,
    o.total,
    o.status,
    o.payment_status || 'unpaid',
    o.created_at,
  ])
  const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `orders-selected-${Date.now()}.csv`
  a.click()
}
const editStatus         = ref('')
const editNotes          = ref('')
const editTrackingNumber = ref('')
const editTrackingCarrier= ref('')
const editTrackingUrl    = ref('')
const editFulfillmentNotes = ref('')
const editPaymentMethod    = ref('manual')
const editPaymentStatus    = ref('unpaid')
const editPaymentReference = ref('')
const deleteTarget = ref(null)
const messageTarget = ref(null)
const messageText = ref('')
const messageSubject = ref('')
const sendingMessage = ref(false)
const messageSentOk = ref(false)

const STATUSES = [
  { value: 'pending',    label: '⏳ Pending' },
  { value: 'processing', label: '⚙️ Processing' },
  { value: 'shipped',    label: '🚚 Shipped' },
  { value: 'completed',  label: '✅ Completed' },
  { value: 'cancelled',  label: '❌ Cancelled' },
  { value: 'refunded',   label: '💸 Refunded' },
]

const statCards = computed(() => [
  { label: 'Total Orders',   value: stats.value?.total ?? 0 },
  { label: 'Pending',        value: stats.value?.pending ?? 0 },
  { label: 'Processing',     value: stats.value?.processing ?? 0 },
  { label: 'Completed',      value: stats.value?.completed ?? 0 },
])

function statusBadge(s) {
  const map = { pending: 'badge-draft', processing: 'badge-scheduled', shipped: 'badge-scheduled', completed: 'badge-published', cancelled: 'badge-draft', refunded: 'badge-draft' }
  return map[s] || 'badge-draft'
}

function parseTags(raw) {
  try { return JSON.parse(raw || '[]') } catch { return [] }
}

const TAG_COLORS = ['#e05a6e','#5a9ee0','#5ae07e','#e0c45a','#9e5ae0','#5ae0d4','#e07a5a','#a0a0a0']
function tagStyle(tag) {
  const idx = [...tag].reduce((n, c) => n + c.charCodeAt(0), 0) % TAG_COLORS.length
  const c = TAG_COLORS[idx]
  return { backgroundColor: c + '22', color: c, borderColor: c + '66' }
}

function fmtCurrency(v) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v || 0)
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateLong(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}`, ...(opts.headers || {}) }
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams({ limit: 100 })
    if (q.value) params.set('q', q.value)
    if (filterStatus.value) params.set('status', filterStatus.value)
    if (filterFrom.value) params.set('from', filterFrom.value)
    if (filterTo.value) params.set('to', filterTo.value)
    const data = await apiFetch(`/orders?${params}`)
    orders.value = data.orders
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    stats.value = await apiFetch('/orders/stats/summary')
  } catch {}
}

let debounceTimer = null
function debouncedLoad() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(load, 300)
}

function openOrder(order) {
  selected.value = order
  editStatus.value           = order.status
  editNotes.value            = order.notes || ''
  editTrackingNumber.value   = order.tracking_number || ''
  editTrackingCarrier.value  = order.tracking_carrier || ''
  editTrackingUrl.value      = order.tracking_url || ''
  editFulfillmentNotes.value = order.fulfillment_notes || ''
  editPaymentMethod.value    = order.payment_method || 'manual'
  editPaymentStatus.value    = order.payment_status || 'unpaid'
  editPaymentReference.value = order.payment_reference || ''
}

async function saveStatus() {
  if (!selected.value) return
  saving.value = true
  try {
    const updated = await apiFetch(`/orders/${selected.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: editStatus.value })
    })
    Object.assign(selected.value, updated)
    const idx = orders.value.findIndex(o => o.id === updated.id)
    if (idx !== -1) orders.value[idx] = { ...updated }
    await loadStats()
  } catch (e) {
    alert(e.message)
  } finally {
    saving.value = false
  }
}

async function saveNotes() {
  if (!selected.value) return
  saving.value = true
  try {
    const updated = await apiFetch(`/orders/${selected.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({ notes: editNotes.value })
    })
    Object.assign(selected.value, updated)
  } catch (e) {
    alert(e.message)
  } finally {
    saving.value = false
  }
}

async function saveFulfillment() {
  if (!selected.value) return
  saving.value = true
  try {
    const updated = await apiFetch(`/orders/${selected.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        tracking_number:   editTrackingNumber.value,
        tracking_carrier:  editTrackingCarrier.value,
        tracking_url:      editTrackingUrl.value,
        fulfillment_notes: editFulfillmentNotes.value,
      })
    })
    Object.assign(selected.value, updated)
    // Refresh local tracking refs
    editTrackingNumber.value   = updated.tracking_number || ''
    editTrackingCarrier.value  = updated.tracking_carrier || ''
    editTrackingUrl.value      = updated.tracking_url || ''
    editFulfillmentNotes.value = updated.fulfillment_notes || ''
  } catch (e) {
    alert(e.message)
  } finally {
    saving.value = false
  }
}

async function savePayment() {
  if (!selected.value) return
  saving.value = true
  try {
    const updated = await apiFetch(`/orders/${selected.value.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        payment_method:    editPaymentMethod.value,
        payment_status:    editPaymentStatus.value,
        payment_reference: editPaymentReference.value,
      })
    })
    Object.assign(selected.value, updated)
    editPaymentMethod.value    = updated.payment_method || 'manual'
    editPaymentStatus.value    = updated.payment_status || 'unpaid'
    editPaymentReference.value = updated.payment_reference || ''
  } catch (e) {
    alert(e.message)
  } finally {
    saving.value = false
  }
}

function printInvoice(order) {
  const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'
  window.open(`${API}/api/invoices/${order.order_number}/admin`, '_blank')
}

function printPackingSlip(order) {
  const token = localStorage.getItem('pygmy_token') || ''
  const API = import.meta.env.VITE_API_URL || 'http://localhost:3200'
  // Open with token in URL query since packing slip is an HTML page
  window.open(`${API}/api/packing-slips/${order.order_number}?token=${encodeURIComponent(token)}`, '_blank')
}

function openMessageModal(order) {
  messageTarget.value = order
  messageText.value = ''
  messageSubject.value = `Update on your order #${order.order_number}`
  messageSentOk.value = false
}

async function sendOrderMessage() {
  if (!messageText.value.trim()) return
  sendingMessage.value = true
  try {
    await apiFetch(`/orders/${messageTarget.value.id}/message`, {
      method: 'POST',
      body: JSON.stringify({ message: messageText.value, subject: messageSubject.value })
    })
    messageSentOk.value = true
    setTimeout(() => { messageTarget.value = null }, 1500)
  } catch (e) {
    alert(e.message || 'Failed to send message')
  } finally {
    sendingMessage.value = false
  }
}

function confirmDelete(order) {
  deleteTarget.value = order
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await apiFetch(`/orders/${deleteTarget.value.id}`, { method: 'DELETE' })
    orders.value = orders.value.filter(o => o.id !== deleteTarget.value.id)
    if (selected.value?.id === deleteTarget.value.id) selected.value = null
    deleteTarget.value = null
    await loadStats()
  } catch (e) {
    alert(e.message)
  } finally {
    deleting.value = false
  }
}

function exportCsv() {
  const params = new URLSearchParams()
  if (filterStatus.value) params.set('status', filterStatus.value)
  if (filterFrom.value) params.set('from', filterFrom.value)
  if (filterTo.value) params.set('to', filterTo.value)
  const token = auth.token
  const url = `/api/orders/export/csv?${params}`
  // Use fetch to inject auth header, then blob-download
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `orders-${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    })
}

onMounted(() => {
  load()
  loadStats()
})
</script>

<style scoped>
.orders-stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: .75rem;
  margin-bottom: 1.25rem;
}
.ostat {
  padding: .875rem 1rem;
  border-radius: .75rem;
  text-align: center;
}
.ostat-num {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--accent);
  line-height: 1;
}
.ostat-label {
  font-size: .78rem;
  color: var(--text-muted);
  margin-top: .2rem;
}
.filter-bar { border-radius: .75rem; }
.bulk-bar {
  display: flex; align-items: center; gap: .75rem; flex-wrap: wrap;
  padding: .6rem 1rem; border-radius: .75rem; margin-bottom: .75rem;
  border: 1px solid var(--accent); background: rgba(var(--accent-rgb, 210,60,60), 0.07);
}
.bulk-count { font-size: .85rem; font-weight: 600; color: var(--accent); }
.section-card { padding: .875rem 1rem; border-radius: .75rem; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .35rem; font-size: .88rem; }
.info-grid > div { display: flex; flex-direction: column; }
.info-grid .label { font-size: .75rem; color: var(--text-muted); }
.order-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: .75rem;
  padding-top: .5rem;
  border-top: 1px solid rgba(255,255,255,.08);
  font-size: 1rem;
}
.loading-bar {
  height: 2px;
  background: var(--accent);
  animation: pulse 1s infinite;
  border-radius: 2px;
}
@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
</style>
