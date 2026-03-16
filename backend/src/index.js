// Pygmy Backend — Express API
// Products are stored as static images in /uploads/products/
// The frontend fetches the product list and displays them as a Vue slideshow.

import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import productRoutes from './routes/products.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3200

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

// Serve product images as static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// API routes
app.use('/api/products', productRoutes)

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', version: '1.0.0' }))

app.listen(PORT, () => {
  console.log(`🪆 Pygmy backend running on http://localhost:${PORT}`)
})
