// Pygmy CMS — Newsletter Email Template Library (Phase 70)
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// GET /api/newsletter-templates — list all
router.get('/', authMiddleware, (req, res) => {
  const templates = db.prepare(
    'SELECT * FROM email_templates_newsletter ORDER BY updated_at DESC'
  ).all()
  templates.forEach(t => {
    try { t.html_blocks = JSON.parse(t.html_blocks) } catch { t.html_blocks = [] }
  })
  res.json(templates)
})

// GET /api/newsletter-templates/:id — single
router.get('/:id', authMiddleware, (req, res) => {
  const t = db.prepare('SELECT * FROM email_templates_newsletter WHERE id = ?').get(req.params.id)
  if (!t) return res.status(404).json({ error: 'Not found' })
  try { t.html_blocks = JSON.parse(t.html_blocks) } catch { t.html_blocks = [] }
  res.json(t)
})

// POST /api/newsletter-templates — create
router.post('/', authMiddleware, (req, res) => {
  const { name = 'New Template', subject = '', html_blocks = [], preview_text = '', category = 'general', active = 1 } = req.body
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO email_templates_newsletter (name, subject, html_blocks, preview_text, category, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, subject, JSON.stringify(html_blocks), preview_text, category, active ? 1 : 0)
  const t = db.prepare('SELECT * FROM email_templates_newsletter WHERE id = ?').get(lastInsertRowid)
  try { t.html_blocks = JSON.parse(t.html_blocks) } catch { t.html_blocks = [] }
  res.json(t)
})

// PUT /api/newsletter-templates/:id — update
router.put('/:id', authMiddleware, (req, res) => {
  const t = db.prepare('SELECT * FROM email_templates_newsletter WHERE id = ?').get(req.params.id)
  if (!t) return res.status(404).json({ error: 'Not found' })

  const { name, subject, html_blocks, preview_text, category, active } = req.body
  db.prepare(`
    UPDATE email_templates_newsletter
    SET name=COALESCE(?,name), subject=COALESCE(?,subject), html_blocks=COALESCE(?,html_blocks),
        preview_text=COALESCE(?,preview_text), category=COALESCE(?,category),
        active=COALESCE(?,active), updated_at=datetime('now')
    WHERE id=?
  `).run(
    name ?? null, subject ?? null,
    html_blocks !== undefined ? JSON.stringify(html_blocks) : null,
    preview_text ?? null, category ?? null,
    active !== undefined ? (active ? 1 : 0) : null,
    req.params.id
  )
  const updated = db.prepare('SELECT * FROM email_templates_newsletter WHERE id = ?').get(req.params.id)
  try { updated.html_blocks = JSON.parse(updated.html_blocks) } catch { updated.html_blocks = [] }
  res.json(updated)
})

// DELETE /api/newsletter-templates/:id
router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM email_templates_newsletter WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// POST /api/newsletter-templates/:id/duplicate — clone a template
router.post('/:id/duplicate', authMiddleware, (req, res) => {
  const t = db.prepare('SELECT * FROM email_templates_newsletter WHERE id = ?').get(req.params.id)
  if (!t) return res.status(404).json({ error: 'Not found' })
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO email_templates_newsletter (name, subject, html_blocks, preview_text, category, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(`${t.name} (copy)`, t.subject, t.html_blocks, t.preview_text, t.category, t.active)
  const copy = db.prepare('SELECT * FROM email_templates_newsletter WHERE id = ?').get(lastInsertRowid)
  try { copy.html_blocks = JSON.parse(copy.html_blocks) } catch { copy.html_blocks = [] }
  res.json(copy)
})

// POST /api/newsletter-templates/:id/render — render to HTML string
router.post('/:id/render', authMiddleware, (req, res) => {
  const t = db.prepare('SELECT * FROM email_templates_newsletter WHERE id = ?').get(req.params.id)
  if (!t) return res.status(404).json({ error: 'Not found' })
  let blocks = []
  try { blocks = JSON.parse(t.html_blocks) } catch {}
  const siteName = db.prepare("SELECT value FROM settings WHERE key='site_name'").get()?.value || 'Pygmy CMS'
  const siteUrl = db.prepare("SELECT value FROM settings WHERE key='site_url'").get()?.value || 'http://localhost:5174'
  const html = renderBlocksToHtml(blocks, siteName, siteUrl, t.preview_text)
  res.json({ html, subject: t.subject })
})

// ─── Block Renderer ───────────────────────────────────────────────────────────

function renderBlocksToHtml(blocks, siteName, siteUrl, previewText = '') {
  const preview = previewText ? `<div style="display:none;max-height:0;overflow:hidden">${previewText}</div>` : ''
  const body = blocks.map(renderBlock).join('\n')
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${siteName}</title>
  ${preview}
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#ffffff">
    ${body}
    <div style="background:#f9fafb;padding:1.5rem;text-align:center;font-size:0.8rem;color:#9ca3af">
      <p style="margin:0 0 .5rem">${siteName}</p>
      <p style="margin:0"><a href="${siteUrl}" style="color:#9ca3af">${siteUrl}</a></p>
      <p style="margin:.5rem 0 0"><a href="{{UNSUBSCRIBE_URL}}" style="color:#9ca3af">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`
}

function renderBlock(block) {
  const s = block.settings || {}
  switch (block.type) {
    case 'header':
      return `<div style="background:${s.bg_color||'hsl(355,70%,58%)'};color:${s.text_color||'#fff'};padding:2rem;text-align:${s.align||'center'}">
        ${s.logo_url ? `<img src="${s.logo_url}" alt="Logo" style="max-height:50px;margin-bottom:1rem;display:block;margin-left:auto;margin-right:auto">` : ''}
        <h1 style="margin:0;font-size:${s.font_size||'1.8rem'}">${s.title||''}</h1>
        ${s.subtitle ? `<p style="margin:.5rem 0 0;opacity:.85">${s.subtitle}</p>` : ''}
      </div>`
    case 'text':
      return `<div style="padding:${s.padding||'2rem'};color:${s.text_color||'#374151'};font-size:${s.font_size||'1rem'};line-height:1.6;text-align:${s.align||'left'}">
        ${s.content||''}
      </div>`
    case 'image':
      return `<div style="text-align:${s.align||'center'};padding:${s.padding||'1rem 2rem'}">
        <img src="${s.src||''}" alt="${s.alt||''}" style="max-width:100%;border-radius:${s.radius||'0'}" ${s.link?`onclick="window.location='${s.link}'"`:''}>
        ${s.caption ? `<p style="margin:.5rem 0 0;font-size:.85rem;color:#6b7280">${s.caption}</p>` : ''}
      </div>`
    case 'button':
      return `<div style="text-align:${s.align||'center'};padding:${s.padding||'1rem 2rem'}">
        <a href="${s.url||'#'}" style="background:${s.bg_color||'hsl(355,70%,58%)'};color:${s.text_color||'#fff'};padding:${s.btn_padding||'.8rem 2rem'};border-radius:${s.radius||'8px'};text-decoration:none;font-weight:700;font-size:${s.font_size||'1rem'};display:inline-block">
          ${s.label||'Click here'}
        </a>
      </div>`
    case 'divider':
      return `<div style="padding:${s.padding||'.5rem 2rem'}">
        <hr style="border:none;border-top:${s.style||'1px solid #e5e7eb'};margin:0">
      </div>`
    case 'spacer':
      return `<div style="height:${s.height||'2rem'}"></div>`
    case 'columns':
      return `<table role="presentation" style="width:100%;border-collapse:collapse">
        <tr>
          ${(s.columns||[]).map(col => `<td style="vertical-align:top;padding:${s.padding||'1rem 1.5rem'};width:${Math.floor(100/(s.columns?.length||2))}%">
            <div style="font-size:.95rem;line-height:1.5;color:#374151">${col.content||''}</div>
          </td>`).join('')}
        </tr>
      </table>`
    case 'products':
      return `<div style="padding:1.5rem 2rem">
        <h2 style="margin:0 0 1rem;font-size:1.2rem;color:${s.title_color||'#111827'}">${s.title||'Featured Products'}</h2>
        <table role="presentation" style="width:100%;border-collapse:collapse">
          <tr>
            ${(s.items||[]).slice(0,3).map(item => `<td style="vertical-align:top;padding:.5rem;width:33%">
              ${item.image ? `<img src="${item.image}" style="width:100%;border-radius:8px">` : '<div style="width:100%;padding-top:100%;background:#f3f4f6;border-radius:8px"></div>'}
              <p style="margin:.5rem 0 .25rem;font-weight:600;font-size:.9rem">${item.name||''}</p>
              <p style="margin:0 0 .5rem;color:hsl(355,70%,58%);font-weight:700">${item.price||''}</p>
              ${item.url ? `<a href="${item.url}" style="font-size:.8rem;color:hsl(355,70%,58%)">View →</a>` : ''}
            </td>`).join('')}
          </tr>
        </table>
      </div>`
    case 'social':
      return `<div style="background:${s.bg_color||'#f9fafb'};padding:1.5rem;text-align:center">
        <p style="margin:0 0 .75rem;color:#6b7280;font-size:.9rem">${s.label||'Follow us'}</p>
        <div>
          ${(s.links||[]).map(link => `<a href="${link.url||'#'}" style="display:inline-block;margin:0 .4rem;color:#374151;text-decoration:none;font-size:1.2rem">${link.icon||link.platform||'🔗'}</a>`).join('')}
        </div>
      </div>`
    default:
      return ''
  }
}

export { renderBlocksToHtml }

export default router
