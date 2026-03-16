// Products API
// GET /api/products        → list all products with image URLs
// POST /api/products       → add product (name + image upload)
// DELETE /api/products/:id → remove product

import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const router = express.Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOAD_DIR = path.join(__dirname, '../../uploads/products')
const DB_PATH = path.join(__dirname, '../../uploads/products.json')

// Ensure upload directory exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

// Initialize products DB (simple JSON file)
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify([]))
}

const readProducts = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
const writeProducts = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))

// Multer storage: keep original filename, save to /uploads/products/
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
    cb(null, `${unique}${path.extname(file.originalname)}`)
  }
})
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|avif/
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()))
  },
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
})

// GET /api/products
router.get('/', (req, res) => {
  const products = readProducts()
  res.json(products)
})

// POST /api/products — upload a product image
router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' })

  const products = readProducts()
  const product = {
    id: `${Date.now()}`,
    name: req.body.name || path.basename(req.file.originalname, path.extname(req.file.originalname)),
    description: req.body.description || '',
    filename: req.file.filename,
    imageUrl: `/uploads/products/${req.file.filename}`,
    createdAt: new Date().toISOString()
  }
  products.push(product)
  writeProducts(products)
  res.status(201).json(product)
})

// POST /api/products/bulk — upload an array of images at once
router.post('/bulk', upload.array('images', 100), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No images uploaded' })

  const products = readProducts()
  const names = req.body.names ? JSON.parse(req.body.names) : []

  const newProducts = req.files.map((file, i) => ({
    id: `${Date.now()}-${i}`,
    name: names[i] || path.basename(file.originalname, path.extname(file.originalname)),
    description: '',
    filename: file.filename,
    imageUrl: `/uploads/products/${file.filename}`,
    createdAt: new Date().toISOString()
  }))

  products.push(...newProducts)
  writeProducts(products)
  res.status(201).json(newProducts)
})

// DELETE /api/products/:id
router.delete('/:id', (req, res) => {
  const products = readProducts()
  const product = products.find(p => p.id === req.params.id)
  if (!product) return res.status(404).json({ error: 'Not found' })

  // Delete image file
  const filePath = path.join(UPLOAD_DIR, product.filename)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

  const updated = products.filter(p => p.id !== req.params.id)
  writeProducts(updated)
  res.json({ success: true })
})

export default router
