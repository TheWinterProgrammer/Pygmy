// Pygmy CMS — Multi-currency composable
// Reads the active currency from the site store + localStorage preference.
// Provides fmt(amount) → formatted string and a list of available currencies.

import { ref, computed } from 'vue'
import { useSiteStore } from '../stores/site.js'
import api from '../api.js'

const STORAGE_KEY = 'pygmy_currency'
const _rates      = ref([])
const _selected   = ref(localStorage.getItem(STORAGE_KEY) || null)
let   _loaded     = false

export function useCurrency() {
  const site = useSiteStore()

  /** Ensure rates are fetched once per page load */
  async function ensureLoaded() {
    if (_loaded) return
    _loaded = true
    try {
      const { data } = await api.get('/currency')
      if (data.enabled && data.rates?.length) {
        _rates.value = data.rates
        // Validate stored selection
        if (_selected.value && !data.rates.find(r => r.code === _selected.value)) {
          _selected.value = null
          localStorage.removeItem(STORAGE_KEY)
        }
      } else {
        _rates.value = []
        _selected.value = null
      }
    } catch {
      _rates.value = []
    }
  }

  /** The base currency (from settings, e.g. EUR) */
  const baseCurrency = computed(() =>
    site.settings?.shop_currency || 'EUR'
  )
  const baseSymbol = computed(() =>
    site.settings?.shop_currency_symbol || '€'
  )

  /** Currently active currency (selected or base) */
  const activeCurrency = computed(() =>
    _selected.value || baseCurrency.value
  )

  /** Exchange rate multiplier for the active currency */
  const activeRate = computed(() => {
    if (!_selected.value) return 1
    return _rates.value.find(r => r.code === _selected.value)?.rate ?? 1
  })

  /** The symbol to display for the active currency */
  const activeSymbol = computed(() => {
    if (!_selected.value) return baseSymbol.value
    return _rates.value.find(r => r.code === _selected.value)?.symbol || _selected.value
  })

  /** Available non-base currencies */
  const availableCurrencies = computed(() => _rates.value)

  /** Whether multi-currency is enabled and has alternatives */
  const hasAlternatives = computed(() => _rates.value.length > 0)

  /** Select a currency by code (null = reset to base) */
  function selectCurrency(code) {
    if (!code || code === baseCurrency.value) {
      _selected.value = null
      localStorage.removeItem(STORAGE_KEY)
    } else {
      _selected.value = code
      localStorage.setItem(STORAGE_KEY, code)
    }
  }

  /**
   * Format a base-currency amount using the active currency.
   * fmt(9.99) → "€9.99" | "$11.24" etc.
   */
  function fmt(amount) {
    if (amount === null || amount === undefined) return ''
    const val   = Number(amount) * activeRate.value
    const code  = activeCurrency.value
    try {
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: code }).format(val)
    } catch {
      return `${activeSymbol.value}${val.toFixed(2)}`
    }
  }

  return {
    baseCurrency,
    baseSymbol,
    activeCurrency,
    activeRate,
    activeSymbol,
    availableCurrencies,
    hasAlternatives,
    selectCurrency,
    fmt,
    ensureLoaded,
  }
}
