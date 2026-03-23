<template>
  <!-- Floating compare bar -->
  <Teleport to="body">
    <div class="compare-bar glass" v-if="compare.count > 0" :class="{ open: compare.isOpen }">
      <div class="compare-bar-inner">
        <div class="compare-header">
          <button class="compare-toggle" @click="compare.isOpen = !compare.isOpen">
            <span>⚖️ Compare ({{ compare.count }}/{{ MAX }})</span>
            <span class="toggle-arrow">{{ compare.isOpen ? '▼' : '▲' }}</span>
          </button>
          <button class="btn-clear" @click="compare.clear()">Clear all</button>
        </div>

        <div class="compare-content" v-if="compare.isOpen">
          <!-- Product cards in bar -->
          <div class="compare-products">
            <div v-for="p in compare.items" :key="p.id" class="cmp-product">
              <div class="cmp-img">
                <img v-if="p.cover_image" :src="p.cover_image" :alt="p.name" />
                <div v-else class="cmp-img-placeholder">🛍️</div>
              </div>
              <div class="cmp-name">{{ p.name }}</div>
              <div class="cmp-price">{{ fmt(p.sale_price || p.price) }}</div>
              <button class="cmp-remove" @click="compare.remove(p.id)" title="Remove from compare">✕</button>
            </div>
            <!-- Empty slots -->
            <div v-for="i in MAX - compare.count" :key="'slot-' + i" class="cmp-slot">
              <div class="cmp-slot-icon">+</div>
              <div class="cmp-slot-label">Add product</div>
            </div>
          </div>

          <!-- Compare table (shown when 2+) -->
          <div class="compare-table-wrap" v-if="compare.count >= 2">
            <table class="compare-table">
              <thead>
                <tr>
                  <th class="attr-col">Feature</th>
                  <th v-for="p in compare.items" :key="p.id">{{ p.name }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="attr-col">Price</td>
                  <td v-for="p in compare.items" :key="p.id">
                    <span v-if="p.sale_price" class="price-sale">{{ fmt(p.sale_price) }}</span>
                    <span :class="p.sale_price ? 'price-orig' : ''">{{ fmt(p.price) }}</span>
                  </td>
                </tr>
                <tr>
                  <td class="attr-col">Category</td>
                  <td v-for="p in compare.items" :key="p.id">{{ p.category || '—' }}</td>
                </tr>
                <tr>
                  <td class="attr-col">SKU</td>
                  <td v-for="p in compare.items" :key="p.id">{{ p.sku || '—' }}</td>
                </tr>
                <tr>
                  <td class="attr-col">Stock</td>
                  <td v-for="p in compare.items" :key="p.id">
                    <span v-if="!p.track_stock" class="badge-ok">In stock</span>
                    <span v-else-if="p.stock_quantity > 0" class="badge-ok">{{ p.stock_quantity }} left</span>
                    <span v-else class="badge-out">Out of stock</span>
                  </td>
                </tr>
                <tr>
                  <td class="attr-col">Featured</td>
                  <td v-for="p in compare.items" :key="p.id">{{ p.featured ? '⭐' : '—' }}</td>
                </tr>
                <tr>
                  <td class="attr-col">View</td>
                  <td v-for="p in compare.items" :key="p.id">
                    <RouterLink :to="`/shop/${p.slug}`" class="btn btn-primary btn-sm">View →</RouterLink>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="compare-hint">Add {{ 2 - compare.count }} more product{{ compare.count === 1 ? '' : 's' }} to start comparing.</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { useCompareStore } from '../stores/compare.js'
import { useSiteStore } from '../stores/site.js'

const compare = useCompareStore()
const site    = useSiteStore()
const MAX     = 4

function fmt(v) {
  const sym      = site.settings?.shop_currency_symbol || '€'
  const currency = site.settings?.shop_currency || 'EUR'
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(v || 0)
  } catch { return `${sym}${Number(v || 0).toFixed(2)}` }
}
</script>

<style scoped>
.compare-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 900;
  border-top: 1px solid rgba(255,255,255,.12);
  border-radius: 1.25rem 1.25rem 0 0;
  transition: transform .3s ease;
  max-height: 70vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.compare-bar-inner { overflow-y: auto; max-height: 70vh; }

/* Header */
.compare-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: .75rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,.08);
  position: sticky; top: 0;
  background: hsl(228,4%,14%);
  backdrop-filter: blur(16px);
  z-index: 1;
}
.compare-toggle {
  background: none; border: none; color: var(--text);
  font-size: .95rem; font-weight: 700;
  cursor: pointer; display: flex; align-items: center; gap: .5rem;
}
.toggle-arrow { font-size: .7rem; color: var(--muted); }
.btn-clear {
  background: none; border: none; color: var(--muted);
  font-size: .78rem; cursor: pointer; text-decoration: underline;
}

/* Products row */
.compare-content { padding: 1rem 1.5rem; }
.compare-products {
  display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;
}
.cmp-product {
  position: relative;
  display: flex; flex-direction: column; align-items: center;
  gap: .3rem; text-align: center;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: .75rem; padding: .75rem;
  width: 120px; flex-shrink: 0;
}
.cmp-img {
  width: 64px; height: 64px; border-radius: .5rem; overflow: hidden;
  background: rgba(255,255,255,.06);
  display: flex; align-items: center; justify-content: center;
}
.cmp-img img { width: 100%; height: 100%; object-fit: cover; }
.cmp-img-placeholder { font-size: 1.5rem; }
.cmp-name { font-size: .75rem; font-weight: 600; line-height: 1.3; max-width: 100%; word-break: break-word; }
.cmp-price { font-size: .78rem; color: var(--accent); font-weight: 700; }
.cmp-remove {
  position: absolute; top: .3rem; right: .3rem;
  background: rgba(255,255,255,.1); border: none; border-radius: 50%;
  width: 18px; height: 18px; font-size: .65rem;
  cursor: pointer; color: var(--muted); line-height: 18px; text-align: center;
}
.cmp-slot {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 120px; height: 120px; border-radius: .75rem;
  border: 2px dashed rgba(255,255,255,.15); gap: .4rem;
}
.cmp-slot-icon { font-size: 1.5rem; color: var(--muted); }
.cmp-slot-label { font-size: .72rem; color: var(--muted); }

/* Comparison table */
.compare-table-wrap { overflow-x: auto; margin-top: .5rem; }
.compare-table {
  width: 100%; border-collapse: collapse; font-size: .85rem;
}
.compare-table th, .compare-table td {
  padding: .6rem .875rem;
  border-bottom: 1px solid rgba(255,255,255,.07);
  text-align: center; min-width: 120px;
}
.compare-table th {
  font-weight: 700; background: rgba(255,255,255,.05);
  color: var(--text-muted);
}
.attr-col { text-align: left; color: var(--muted); font-size: .8rem; min-width: 100px; }
.price-sale { color: var(--accent); font-weight: 700; margin-right: .25rem; }
.price-orig { text-decoration: line-through; color: var(--muted); font-size: .78rem; }
.badge-ok { color: hsl(140,60%,60%); font-size: .8rem; }
.badge-out { color: var(--accent); font-size: .8rem; }
.compare-hint { font-size: .85rem; color: var(--muted); text-align: center; padding: .5rem 0 .25rem; }
</style>
