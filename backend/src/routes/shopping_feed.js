// Pygmy CMS — Google Shopping Feed (Phase 41)
// Generates a Google Merchant Center compatible XML product feed
import { Router } from 'express'
import db from '../db.js'

const router = Router()

function escapeXml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000)
}

router.get('/shopping-feed.xml', (req, res) => {
  const enabled = db.prepare("SELECT value FROM settings WHERE key = 'google_shopping_feed_enabled'").get()
  if (!enabled || enabled.value !== '1') {
    return res.status(404).send('Shopping feed disabled')
  }

  const settings = {}
  db.prepare(`SELECT key, value FROM settings WHERE key IN
    ('site_name','site_url','shop_currency','shop_currency_symbol','google_merchant_id')
  `).all().forEach(r => (settings[r.key] = r.value))

  const siteUrl  = (settings.site_url || 'http://localhost:5174').replace(/\/$/, '')
  const siteName = escapeXml(settings.site_name || 'Pygmy Store')
  const currency = settings.shop_currency || 'USD'

  const products = db.prepare(`
    SELECT p.*, pc.name AS category_name
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    WHERE p.status = 'published'
      AND (p.track_stock = 0 OR p.stock_quantity > 0 OR p.allow_backorder = 1)
    ORDER BY p.created_at DESC
    LIMIT 5000
  `).all()

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>${siteName}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${siteName} product feed</description>\n`

  for (const p of products) {
    const price   = p.sale_price ?? p.price
    const gallery = (() => { try { return JSON.parse(p.gallery || '[]') } catch { return [] } })()
    const images  = p.cover_image ? [p.cover_image, ...gallery] : gallery
    const mainImg = images[0] ? (images[0].startsWith('http') ? images[0] : `${siteUrl}${images[0]}`) : ''
    const productUrl = `${siteUrl}/shop/${escapeXml(p.slug)}`
    const inStock = !p.track_stock || p.stock_quantity > 0 || p.allow_backorder
    const condition = 'new'
    const gtin = p.sku ? '' : ''  // Could add GTIN field in future

    xml += `    <item>
      <g:id>${p.id}</g:id>
      <g:title>${escapeXml(p.name)}</g:title>
      <g:description>${escapeXml(stripHtml(p.content || p.excerpt || p.name))}</g:description>
      <g:link>${productUrl}</g:link>
${mainImg ? `      <g:image_link>${escapeXml(mainImg)}</g:image_link>\n` : ''}${images.slice(1, 10).map(img => {
  const u = img.startsWith('http') ? img : `${siteUrl}${img}`
  return `      <g:additional_image_link>${escapeXml(u)}</g:additional_image_link>`
}).join('\n')}
      <g:condition>${condition}</g:condition>
      <g:availability>${inStock ? 'in_stock' : 'out_of_stock'}</g:availability>
      <g:price>${Number(p.price).toFixed(2)} ${currency}</g:price>
${p.sale_price ? `      <g:sale_price>${Number(p.sale_price).toFixed(2)} ${currency}</g:sale_price>\n` : ''}${p.category_name ? `      <g:product_type>${escapeXml(p.category_name)}</g:product_type>\n` : ''}${p.sku ? `      <g:mpn>${escapeXml(p.sku)}</g:mpn>\n` : ''}${p.brand ? `      <g:brand>${escapeXml(p.brand)}</g:brand>\n` : ''}${p.meta_title ? `      <g:title>${escapeXml(p.meta_title)}</g:title>\n` : ''}
      <g:identifier_exists>no</g:identifier_exists>
    </item>\n`
  }

  xml += `  </channel>
</rss>`

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.send(xml)
})

export default router
