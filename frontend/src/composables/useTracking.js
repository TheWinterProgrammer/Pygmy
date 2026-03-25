/**
 * Pygmy CMS — Frontend Tracking Composable (Phase 64)
 * Provides funnel event tracking and click heatmap recording.
 * All calls are fire-and-forget (non-blocking, fail silently).
 */
import api from '../api.js'

// Stable per-session ID
let _sessionId = null
function getSessionId () {
  if (!_sessionId) {
    _sessionId = localStorage.getItem('pygmy_session_id')
    if (!_sessionId) {
      _sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem('pygmy_session_id', _sessionId)
    }
  }
  return _sessionId
}

// ─── Funnel Tracking ──────────────────────────────────────────────────────────
export function trackFunnelEvent (eventType, { productId, productSlug, orderNumber, value } = {}) {
  try {
    api.post('/funnel/event', {
      event_type: eventType,
      product_id: productId,
      product_slug: productSlug || '',
      session_id: getSessionId(),
      order_number: orderNumber,
      value,
    }).catch(() => {}) // ignore errors
  } catch {}
}

// ─── Heatmap Tracking ─────────────────────────────────────────────────────────
// Install a document-level click listener that sends coordinates to the backend.
let _heatmapInstalled = false
export function installHeatmapTracker () {
  if (_heatmapInstalled || typeof document === 'undefined') return
  _heatmapInstalled = true

  document.addEventListener('click', (e) => {
    try {
      const xPct = (e.clientX / window.innerWidth) * 100
      const yPct = ((e.pageY) / document.body.scrollHeight) * 100
      api.post('/heatmap/click', {
        page_path: window.location.pathname,
        x_pct: Math.round(xPct * 10) / 10,
        y_pct: Math.round(yPct * 10) / 10,
        viewport_w: window.innerWidth,
        viewport_h: window.innerHeight,
        session_id: getSessionId(),
      }).catch(() => {})
    } catch {}
  }, { passive: true, capture: true })
}

// ─── Customer Journey Tracking ───────────────────────────────────────────────
// Tracks page views and key events to the customer journey backend
// Call on page mounts with entity data
export function trackJourneyEvent (eventType, {
  pagePath = window.location.pathname,
  entityType = '',
  entityId = null,
  entitySlug = '',
  customerId = null,
} = {}) {
  try {
    // Get UTM params from URL
    const params = new URLSearchParams(window.location.search)
    const referrer = typeof document !== 'undefined' ? document.referrer : ''

    api.post('/customer-journey/track', {
      session_id: getSessionId(),
      customer_id: customerId,
      event_type: eventType,
      page_path: pagePath,
      entity_type: entityType,
      entity_id: entityId,
      entity_slug: entitySlug,
      referrer,
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
    }).catch(() => {})
  } catch {}
}

export function useTracking () {
  return {
    trackFunnelEvent,
    trackJourneyEvent,
    getSessionId,
  }
}
