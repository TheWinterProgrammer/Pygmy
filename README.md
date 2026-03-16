# Pygmy 🪆

Product showcase platform — drop in studio images, get a beautiful Vue slideshow.

## Stack
- **Frontend**: Vue 3 + Vite + Pinia — animated product slideshow
- **Backend**: Node.js + Express — image upload API + JSON storage

## Quick Start

```bash
# Install deps
cd backend && npm install
cd ../frontend && npm install

# Run both
cd backend && npm run dev     # → http://localhost:3200
cd frontend && npm run dev    # → http://localhost:5173
```

## How it works

1. Drop studio product images via the **+ Add Products** panel
2. Backend stores them in `/backend/uploads/products/`
3. Frontend fetches the array and renders a full-screen slideshow
4. Navigate with arrows, keyboard (← →), dots, or thumbnails
5. Vue transitions animate between products (slide left/right)

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/products` | List all products |
| POST | `/api/products` | Upload single product image |
| POST | `/api/products/bulk` | Upload array of images |
| DELETE | `/api/products/:id` | Delete a product |
