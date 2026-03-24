// Pygmy CMS — AI Content Generator API (Phase 54)
// Calls a configurable OpenAI-compatible endpoint to generate text
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

function getSetting(key, fallback = '') {
  return db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value || fallback
}

async function callAI({ prompt, maxTokens = 400, temperature = 0.7 }) {
  const apiUrl  = getSetting('ai_api_url', 'https://api.openai.com/v1/chat/completions')
  const apiKey  = getSetting('ai_api_key', '')
  const model   = getSetting('ai_model', 'gpt-3.5-turbo')

  if (!apiKey) throw new Error('AI API key not configured. Set it in Settings → AI Content.')

  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`AI API error ${resp.status}: ${err.slice(0, 200)}`)
  }

  const json = await resp.json()
  return json.choices?.[0]?.message?.content?.trim() || ''
}

// POST /api/ai/generate — generic text generation (admin)
router.post('/generate', authMiddleware, async (req, res) => {
  const { prompt, max_tokens = 400, temperature = 0.7 } = req.body
  if (!prompt) return res.status(400).json({ error: 'prompt is required' })

  try {
    const text = await callAI({ prompt, maxTokens: max_tokens, temperature })
    res.json({ text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ai/product-description — generate product description from product data
router.post('/product-description', authMiddleware, async (req, res) => {
  const { product_id, name, excerpt, category, price, tags = [], tone = 'professional' } = req.body
  if (!name && !product_id) return res.status(400).json({ error: 'name or product_id required' })

  let productName = name, productExcerpt = excerpt, productCategory = category, productPrice = price, productTags = tags

  if (product_id) {
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(product_id))
    if (!p) return res.status(404).json({ error: 'Product not found' })
    productName = p.name
    productExcerpt = p.excerpt || ''
    productPrice = p.sale_price || p.price
    try { productTags = JSON.parse(p.tags || '[]') } catch {}
    const cat = db.prepare('SELECT name FROM product_categories WHERE id = ?').get(p.category_id)
    productCategory = cat?.name || ''
  }

  const siteName = getSetting('site_name', 'our store')
  const prompt = `Write a compelling product description for "${productName}" in a ${tone} tone.
Product info:
- Category: ${productCategory || 'General'}
- Price: ${productPrice ? '$' + productPrice : 'N/A'}
- Tags: ${Array.isArray(productTags) ? productTags.join(', ') : ''}
- Brief: ${productExcerpt || 'N/A'}
- Store: ${siteName}

Requirements:
- 2-4 short paragraphs
- Focus on benefits, not just features  
- Include a compelling call to action at the end
- Do NOT include HTML tags
- Keep it under 350 words`

  try {
    const text = await callAI({ prompt, maxTokens: 500, temperature: 0.8 })
    res.json({ text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ai/post-excerpt — generate blog post excerpt
router.post('/post-excerpt', authMiddleware, async (req, res) => {
  const { title, content, category } = req.body
  if (!title) return res.status(400).json({ error: 'title required' })

  // Strip HTML from content
  const plainContent = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1000)

  const prompt = `Write a compelling blog post excerpt (2-3 sentences, max 160 chars) for:
Title: "${title}"
Category: ${category || 'General'}
Content preview: ${plainContent || 'N/A'}

Return ONLY the excerpt text, no quotes, no preamble.`

  try {
    const text = await callAI({ prompt, maxTokens: 100, temperature: 0.7 })
    res.json({ text: text.slice(0, 320) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ai/title-suggestions — suggest blog post titles
router.post('/title-suggestions', authMiddleware, async (req, res) => {
  const { topic, category, count = 5 } = req.body
  if (!topic) return res.status(400).json({ error: 'topic required' })

  const prompt = `Generate ${Math.min(10, count)} creative and SEO-friendly blog post title suggestions about "${topic}" in the ${category || 'general'} category.

Return only a JSON array of strings, like: ["Title 1", "Title 2", ...]
No explanations, just the JSON array.`

  try {
    const raw = await callAI({ prompt, maxTokens: 300, temperature: 0.9 })
    let titles
    try {
      const match = raw.match(/\[[\s\S]*\]/)
      titles = JSON.parse(match ? match[0] : raw)
    } catch {
      titles = raw.split('\n').filter(l => l.trim()).map(l => l.replace(/^[\d\.\-\*]\s*/, '').replace(/^["']|["']$/g, '').trim()).filter(Boolean)
    }
    res.json({ titles })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ai/seo-meta — generate SEO meta title + description
router.post('/seo-meta', authMiddleware, async (req, res) => {
  const { title, content, entity_type = 'page' } = req.body
  if (!title) return res.status(400).json({ error: 'title required' })

  const plainContent = (content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 800)
  const siteName = getSetting('site_name', '')

  const prompt = `Generate SEO meta title and description for a ${entity_type} with:
Title: "${title}"
Content: ${plainContent || 'N/A'}
Site: ${siteName}

Rules:
- Meta title: 50-60 chars, include main keyword, optionally append site name with " | " separator
- Meta description: 140-160 chars, compelling, includes CTA

Return ONLY valid JSON: {"meta_title": "...", "meta_description": "..."}`

  try {
    const raw = await callAI({ prompt, maxTokens: 200, temperature: 0.6 })
    let result
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      result = JSON.parse(match ? match[0] : raw)
    } catch {
      result = { meta_title: title.slice(0, 60), meta_description: '' }
    }
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/ai/status — check if AI is configured
router.get('/status', authMiddleware, (req, res) => {
  const apiKey = getSetting('ai_api_key', '')
  const apiUrl = getSetting('ai_api_url', 'https://api.openai.com/v1/chat/completions')
  const model  = getSetting('ai_model', 'gpt-3.5-turbo')
  res.json({
    configured: Boolean(apiKey),
    model,
    api_url: apiUrl,
    has_key: Boolean(apiKey),
  })
})

export default router
