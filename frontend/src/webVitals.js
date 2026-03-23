// Pygmy CMS — Web Vitals RUM beacon (Phase 36)
// Collects Core Web Vitals and reports them to /api/web-vitals

const API_URL = 'http://localhost:3200/api/web-vitals'

let sessionId = null
try {
  sessionId = localStorage.getItem('pygmy_vid') || Math.random().toString(36).slice(2)
  localStorage.setItem('pygmy_vid', sessionId)
} catch {}

function detectDevice() {
  const ua = navigator.userAgent
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile'
  if (/Tablet|iPad/i.test(ua)) return 'tablet'
  return 'desktop'
}

const vitals = {}
let reportTimer = null

function scheduleReport() {
  if (reportTimer) clearTimeout(reportTimer)
  reportTimer = setTimeout(sendReport, 3000)
}

async function sendReport() {
  if (!Object.keys(vitals).length) return
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: window.location.pathname,
        device: detectDevice(),
        session_id: sessionId,
        ...vitals,
      }),
      keepalive: true,
    })
  } catch {
    // Silently fail — non-blocking
  }
}

function observeLCP() {
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1]
      vitals.lcp = Math.round(last.startTime)
      scheduleReport()
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {}
}

function observeCLS() {
  let clsValue = 0
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) clsValue += entry.value
      }
      vitals.cls = Math.round(clsValue * 10000) / 10000
      scheduleReport()
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {}
}

function observeFID() {
  try {
    new PerformanceObserver((list) => {
      const entry = list.getEntries()[0]
      if (entry) {
        vitals.fid = Math.round(entry.processingStart - entry.startTime)
        scheduleReport()
      }
    }).observe({ type: 'first-input', buffered: true })
  } catch {}
}

function observeINP() {
  // INP = max interaction delay (simplified)
  try {
    let maxInp = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > maxInp) {
          maxInp = entry.duration
          vitals.inp = Math.round(maxInp)
          scheduleReport()
        }
      }
    }).observe({ type: 'event', durationThreshold: 40, buffered: true })
  } catch {}
}

function collectNavigationTiming() {
  window.addEventListener('load', () => {
    const nav = performance.getEntriesByType('navigation')[0]
    if (!nav) return

    // TTFB = Time to First Byte
    if (nav.responseStart && nav.fetchStart) {
      vitals.ttfb = Math.round(nav.responseStart - nav.fetchStart)
    }

    // FCP from paint entries
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]
    if (fcp) vitals.fcp = Math.round(fcp.startTime)

    scheduleReport()
  })
}

export function initWebVitals() {
  if (typeof window === 'undefined') return

  observeLCP()
  observeCLS()
  observeFID()
  observeINP()
  collectNavigationTiming()

  // Also send on page unload / visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendReport()
  })
}
