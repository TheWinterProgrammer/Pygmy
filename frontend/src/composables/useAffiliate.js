// useAffiliate.js — Affiliate referral tracking composable
// Reads ?ref= from URL, validates code, stores in localStorage for cookie_days

const STORAGE_KEY = 'pygmy_affiliate_ref'
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3200'

export function useAffiliate() {
  /**
   * Call on app mount (App.vue or router guard).
   * If ?ref=CODE is in the URL, validate it and persist.
   */
  async function captureReferral() {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('ref')
    if (!code) return

    try {
      const res = await fetch(`${API_BASE}/api/affiliates/public/validate/${code}`)
      if (!res.ok) return
      const data = await res.json()
      if (!data.valid) return

      // Check settings for cookie_days
      let cookieDays = 30
      try {
        const sres = await fetch(`${API_BASE}/api/settings`)
        const s = await sres.json()
        cookieDays = parseInt(s.affiliate_cookie_days) || 30
      } catch {}

      const expires = Date.now() + cookieDays * 24 * 60 * 60 * 1000
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        code: data.affiliate.code,
        name: data.affiliate.name,
        expires,
      }))
    } catch (e) {
      // Silently ignore (non-critical)
    }
  }

  /**
   * Returns the active affiliate code if not expired, else null.
   */
  function getActiveCode() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
      if (!stored) return null
      if (stored.expires && Date.now() > stored.expires) {
        localStorage.removeItem(STORAGE_KEY)
        return null
      }
      return stored.code
    } catch {
      return null
    }
  }

  /**
   * Clear referral (e.g. after successful order).
   */
  function clearReferral() {
    localStorage.removeItem(STORAGE_KEY)
  }

  return { captureReferral, getActiveCode, clearReferral }
}
