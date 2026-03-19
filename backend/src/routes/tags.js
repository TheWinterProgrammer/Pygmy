// Pygmy CMS — Tag Manager
import { Router } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

/** Gather all unique tags from posts and products with per-entity counts. */
function aggregateTags() {
  // Collect all tags arrays from both tables
  const postRows    = db.prepare("SELECT id, tags FROM posts    WHERE tags IS NOT NULL AND tags != '[]'").all()
  const productRows = db.prepare("SELECT id, tags FROM products WHERE tags IS NOT NULL AND tags != '[]'").all()

  const map = new Map() // tag → { posts: Set<id>, products: Set<id> }

  for (const row of postRows) {
    let tags
    try { tags = JSON.parse(row.tags) } catch { continue }
    for (const t of tags) {
      if (!t) continue
      if (!map.has(t)) map.set(t, { posts: new Set(), products: new Set() })
      map.get(t).posts.add(row.id)
    }
  }

  for (const row of productRows) {
    let tags
    try { tags = JSON.parse(row.tags) } catch { continue }
    for (const t of tags) {
      if (!t) continue
      if (!map.has(t)) map.set(t, { posts: new Set(), products: new Set() })
      map.get(t).products.add(row.id)
    }
  }

  const result = []
  for (const [tag, counts] of map.entries()) {
    result.push({
      tag,
      post_count:    counts.posts.size,
      product_count: counts.products.size,
      total:         counts.posts.size + counts.products.size,
    })
  }

  return result.sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag))
}

// GET /api/tags — list all tags with counts (auth)
router.get('/', authMiddleware, (req, res) => {
  res.json(aggregateTags())
})

// PUT /api/tags/rename — rename a tag across all posts + products (auth)
// Body: { from: 'old-tag', to: 'new-tag' }
router.put('/rename', authMiddleware, (req, res) => {
  const { from: oldTag, to: newTag } = req.body
  if (!oldTag || !newTag) return res.status(400).json({ error: '"from" and "to" required' })
  if (oldTag === newTag) return res.json({ updated: 0 })

  const renameInTable = (table) => {
    const rows = db.prepare(`SELECT id, tags FROM ${table} WHERE tags LIKE ?`).all(`%${oldTag}%`)
    let changed = 0
    for (const row of rows) {
      let tags
      try { tags = JSON.parse(row.tags) } catch { continue }
      if (!tags.includes(oldTag)) continue
      const newTags = tags.map(t => t === oldTag ? newTag : t)
      // Remove duplicates that might occur if newTag already present
      const deduped = [...new Set(newTags)]
      db.prepare(`UPDATE ${table} SET tags = ?, updated_at = datetime('now') WHERE id = ?`).run(
        JSON.stringify(deduped), row.id
      )
      changed++
    }
    return changed
  }

  const posts    = renameInTable('posts')
  const products = renameInTable('products')
  res.json({ updated: posts + products, posts, products })
})

// DELETE /api/tags — remove a tag from all posts + products (auth)
// Body: { tag: 'tag-to-delete' }
router.delete('/', authMiddleware, (req, res) => {
  const tag = req.body.tag || req.query.tag
  if (!tag) return res.status(400).json({ error: '"tag" required' })

  const removeFromTable = (table) => {
    const rows = db.prepare(`SELECT id, tags FROM ${table} WHERE tags LIKE ?`).all(`%${tag}%`)
    let changed = 0
    for (const row of rows) {
      let tags
      try { tags = JSON.parse(row.tags) } catch { continue }
      if (!tags.includes(tag)) continue
      const newTags = tags.filter(t => t !== tag)
      db.prepare(`UPDATE ${table} SET tags = ?, updated_at = datetime('now') WHERE id = ?`).run(
        JSON.stringify(newTags), row.id
      )
      changed++
    }
    return changed
  }

  const posts    = removeFromTable('posts')
  const products = removeFromTable('products')
  res.json({ removed: posts + products, posts, products })
})

export default router
