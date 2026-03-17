// Pygmy CMS — Seed default admin user
import bcrypt from 'bcryptjs'
import db from './db.js'
import 'dotenv/config'

const email = process.env.ADMIN_EMAIL || 'admin@pygmy.local'
const password = process.env.ADMIN_PASSWORD || 'pygmy123'
const name = 'Admin'

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
if (existing) {
  console.log(`✓ Admin user already exists: ${email}`)
} else {
  const hash = bcrypt.hashSync(password, 10)
  db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)').run(email, hash, name, 'admin')
  console.log(`✓ Admin user created: ${email} / ${password}`)
}

// Seed a sample home page
const homePage = db.prepare('SELECT id FROM pages WHERE slug = ?').get('home')
if (!homePage) {
  db.prepare(`
    INSERT INTO pages (title, slug, content, status, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run('Home', 'home', '<h1>Welcome to Pygmy CMS</h1><p>Edit this page in the admin panel.</p>', 'published', 0)
  console.log('✓ Sample home page created')
}

// Seed nav
const existingNav = db.prepare('SELECT id FROM navigation LIMIT 1').get()
if (!existingNav) {
  const items = [
    { label: 'Home', url: '/', sort_order: 0 },
    { label: 'Blog', url: '/blog', sort_order: 1 },
    { label: 'About', url: '/about', sort_order: 2 },
  ]
  const ins = db.prepare('INSERT INTO navigation (label, url, target, sort_order) VALUES (?, ?, ?, ?)')
  items.forEach(i => ins.run(i.label, i.url, '_self', i.sort_order))
  console.log('✓ Default navigation created')
}

console.log('🌱 Seed complete')
process.exit(0)
