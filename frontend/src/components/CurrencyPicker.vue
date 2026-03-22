<template>
  <div v-if="hasAlternatives" class="currency-picker" ref="pickerEl">
    <button class="currency-trigger" @click="open = !open" :title="`Currency: ${activeCurrency}`">
      {{ activeSymbol }} {{ activeCurrency }}
      <span class="chevron" :class="{ up: open }">▾</span>
    </button>

    <transition name="fade-down">
      <div v-if="open" class="currency-dropdown glass">
        <button
          class="currency-option"
          :class="{ active: activeCurrency === baseCurrency }"
          @click="pick(null)"
        >
          {{ baseSymbol }} {{ baseCurrency }}
          <span class="base-badge">base</span>
        </button>
        <button
          v-for="r in availableCurrencies"
          :key="r.code"
          class="currency-option"
          :class="{ active: activeCurrency === r.code }"
          @click="pick(r.code)"
        >
          {{ r.symbol || r.code }} {{ r.code }}
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useCurrency } from '../composables/useCurrency.js'

const { baseCurrency, baseSymbol, activeCurrency, activeSymbol, availableCurrencies, hasAlternatives, selectCurrency, ensureLoaded } = useCurrency()
const open = ref(false)
const pickerEl = ref(null)

onMounted(async () => {
  await ensureLoaded()
  document.addEventListener('click', onDocClick)
})
onUnmounted(() => document.removeEventListener('click', onDocClick))

function pick(code) {
  selectCurrency(code)
  open.value = false
}

function onDocClick(e) {
  if (pickerEl.value && !pickerEl.value.contains(e.target)) {
    open.value = false
  }
}
</script>

<style scoped>
.currency-picker {
  position: relative;
  display: inline-flex;
}

.currency-trigger {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.7rem;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 0.5rem;
  color: var(--text-muted, #aaa);
  font-size: 0.78rem;
  font-family: inherit;
  cursor: pointer;
  transition: color .2s, background .2s;
  white-space: nowrap;
}
.currency-trigger:hover { color: var(--text); background: rgba(255,255,255,0.1); }

.chevron { font-size: 0.7rem; transition: transform .2s; display: inline-block; }
.chevron.up { transform: rotate(180deg); }

.currency-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 140px;
  z-index: 200;
  border-radius: 0.75rem;
  padding: 0.4rem;
  background: rgba(20,20,28,0.9);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 8px 32px rgba(0,0,0,.5);
}

.currency-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.7rem;
  background: none;
  border: none;
  border-radius: 0.5rem;
  color: var(--text-muted, #aaa);
  font-family: inherit;
  font-size: 0.82rem;
  cursor: pointer;
  transition: background .15s, color .15s;
  text-align: left;
}
.currency-option:hover { background: rgba(255,255,255,0.08); color: var(--text); }
.currency-option.active { color: var(--accent); background: rgba(255,255,255,0.05); }

.base-badge {
  margin-left: auto;
  font-size: 0.65rem;
  opacity: .5;
  background: rgba(255,255,255,0.08);
  border-radius: 4px;
  padding: 1px 5px;
}

/* transitions */
.fade-down-enter-active, .fade-down-leave-active { transition: opacity .15s, transform .15s; }
.fade-down-enter-from, .fade-down-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
