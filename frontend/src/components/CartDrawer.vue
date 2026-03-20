<template>
  <!-- Backdrop -->
  <Transition name="backdrop">
    <div v-if="cart.isOpen" class="cart-backdrop" @click="cart.close()" />
  </Transition>

  <!-- Drawer -->
  <Transition name="drawer">
    <div v-if="cart.isOpen" class="cart-drawer glass">
      <!-- Header -->
      <div class="cart-header">
        <h2 class="cart-title">🛒 Cart <span class="cart-count" v-if="cart.count">{{ cart.count }}</span></h2>
        <button class="cart-close" @click="cart.close()">✕</button>
      </div>

      <!-- Empty -->
      <div class="cart-empty" v-if="!cart.items.length">
        <div class="cart-empty-icon">🛍️</div>
        <p>Your cart is empty.</p>
        <RouterLink to="/shop" @click="cart.close()" class="btn btn-primary" style="margin-top:.5rem;">Browse Shop</RouterLink>
      </div>

      <!-- Items -->
      <div class="cart-items" v-else>
        <div class="cart-item" v-for="item in cart.items" :key="item.product_id">
          <div class="item-thumb">
            <img v-if="item.cover_image" :src="item.cover_image" :alt="item.name" />
            <div v-else class="item-thumb-placeholder">🛍️</div>
          </div>
          <div class="item-info">
            <RouterLink :to="`/shop/${item.slug}`" @click="cart.close()" class="item-name">{{ item.name }}</RouterLink>
            <div class="item-price">{{ fmt(item.unit_price) }} each</div>
          </div>
          <div class="item-controls">
            <div class="qty-control">
              <button @click="cart.updateQuantity(item.product_id, item.quantity - 1)">−</button>
              <span>{{ item.quantity }}</span>
              <button @click="cart.updateQuantity(item.product_id, item.quantity + 1)">+</button>
            </div>
            <div class="item-line-total">{{ fmt(item.unit_price * item.quantity) }}</div>
            <button class="item-remove" @click="cart.removeItem(item.product_id)" title="Remove">✕</button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="cart-footer" v-if="cart.items.length">
        <div class="cart-subtotal">
          <span>Subtotal</span>
          <strong>{{ fmt(cart.subtotal) }}</strong>
        </div>
        <RouterLink to="/checkout" @click="cart.close()" class="btn btn-primary btn-lg" style="width:100%;text-align:center;display:block;">
          Checkout →
        </RouterLink>
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:.5rem;" @click="cart.clear()">Clear cart</button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { useCartStore } from '../stores/cart.js'

const cart = useCartStore()

function fmt(v) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v || 0)
}
</script>

<style scoped>
.cart-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.55);
  z-index: 900;
  backdrop-filter: blur(2px);
}

.cart-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(420px, 100vw);
  z-index: 901;
  display: flex;
  flex-direction: column;
  border-radius: 1.25rem 0 0 1.25rem;
  border: 1px solid rgba(255,255,255,.1);
  background: hsl(228, 4%, 13%);
  backdrop-filter: blur(24px);
  overflow: hidden;
}

/* Transitions */
.backdrop-enter-active, .backdrop-leave-active { transition: opacity .25s ease; }
.backdrop-enter-from, .backdrop-leave-to { opacity: 0; }

.drawer-enter-active, .drawer-leave-active { transition: transform .28s cubic-bezier(.4,0,.2,1); }
.drawer-enter-from, .drawer-leave-to { transform: translateX(100%); }

.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.25rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,.08);
  flex-shrink: 0;
}
.cart-title {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: .5rem;
}
.cart-count {
  background: var(--accent);
  color: #fff;
  border-radius: 99px;
  padding: .1em .5em;
  font-size: .75rem;
  font-weight: 600;
}
.cart-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.1rem;
  cursor: pointer;
  padding: .25rem .4rem;
  border-radius: .35rem;
  transition: color .15s;
}
.cart-close:hover { color: #fff; }

/* Empty */
.cart-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: .5rem;
  color: var(--text-muted);
  text-align: center;
  padding: 2rem;
}
.cart-empty-icon { font-size: 3rem; }

/* Items */
.cart-items {
  flex: 1;
  overflow-y: auto;
  padding: .75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: .75rem;
}
.cart-item {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: .75rem;
  align-items: start;
  padding: .75rem;
  border-radius: .75rem;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06);
}
.item-thumb {
  width: 56px;
  height: 56px;
  border-radius: .5rem;
  overflow: hidden;
  background: rgba(255,255,255,.06);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.item-thumb img { width: 100%; height: 100%; object-fit: cover; }
.item-thumb-placeholder { font-size: 1.4rem; }

.item-info { display: flex; flex-direction: column; gap: .2rem; min-width: 0; }
.item-name { font-size: .9rem; font-weight: 600; color: #fff; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-name:hover { color: var(--accent); }
.item-price { font-size: .8rem; color: var(--text-muted); }

.item-controls {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: .35rem;
}
.qty-control {
  display: flex;
  align-items: center;
  gap: .35rem;
  background: rgba(255,255,255,.07);
  border-radius: .4rem;
  padding: .15rem .35rem;
}
.qty-control button {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 1rem;
  padding: 0 .2rem;
  line-height: 1;
}
.qty-control span { font-size: .88rem; min-width: 1.5ch; text-align: center; }
.item-line-total { font-size: .88rem; font-weight: 600; color: var(--accent); }
.item-remove {
  background: none;
  border: none;
  color: rgba(255,255,255,.3);
  cursor: pointer;
  font-size: .8rem;
  padding: 0;
}
.item-remove:hover { color: var(--accent); }

/* Footer */
.cart-footer {
  padding: 1rem 1.25rem 1.25rem;
  border-top: 1px solid rgba(255,255,255,.08);
  flex-shrink: 0;
}
.cart-subtotal {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: .875rem;
  font-size: 1rem;
}
.cart-subtotal strong { color: var(--accent); font-size: 1.1rem; }
</style>
