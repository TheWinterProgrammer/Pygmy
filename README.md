# Pygmy CMS 🪆

A self-hosted CMS and website builder with a dark glass design system.

## Stack

| Layer | Tech |
|-------|------|
| **Backend** | Node.js + Express + SQLite (better-sqlite3) |
| **Admin Panel** | Vue 3 + Vite + TipTap rich editor |
| **Public Frontend** | Vue 3 + Vite + Pinia |

## Quick Start

```bash
# 1. Install all deps
cd backend   && npm install
cd ../admin  && npm install
cd ../frontend && npm install

# 2. Seed the default admin user
cd backend && npm run seed
# → admin@pygmy.local / pygmy123 (change immediately in Settings)

# 3. Run all three in separate terminals
cd backend   && npm run dev   # → http://localhost:3200
cd admin     && npm run dev   # → http://localhost:5173
cd frontend  && npm run dev   # → http://localhost:5174
```

## Architecture

```
backend/
  src/
    db.js           ← SQLite schema + default settings
    index.js        ← Express server
    middleware/
      auth.js       ← JWT guard
    routes/
      auth.js       ← POST /api/auth/login, GET/PUT /me
      seo.js        ← GET /sitemap.xml, /feed.xml
      pages.js      ← CRUD /api/pages
      posts.js      ← CRUD /api/posts + categories
      media.js      ← Upload /api/media
      navigation.js ← CRUD /api/navigation
      settings.js   ← GET/PUT /api/settings
      dashboard.js  ← GET /api/dashboard/stats

admin/              ← wp-admin equivalent (port 5173)
  views/
    LoginView.vue
    DashboardView.vue
    PagesView.vue / PageEditView.vue
    PostsView.vue  / PostEditView.vue
    ProductsView.vue / ProductEditView.vue
    MediaView.vue
    NavigationView.vue
    CommentsView.vue
    SettingsView.vue

frontend/           ← public website (port 5174)
  components/
    SiteNav.vue     ← floating glass navbar from CMS nav data
    SiteFooter.vue
  views/
    HomeView.vue    ← hero + recent posts grid
    BlogView.vue    ← paginated blog listing + category/tag filters
    PostView.vue    ← full post with SEO meta tags
    PageView.vue    ← dynamic CMS pages
    ProductsView.vue ← /shop listing with filters + pagination
    ProductView.vue  ← /shop/:slug detail with gallery + pricing
    SearchView.vue  ← full-text search (posts + pages + products)
```

## Features

### Phase 1 — Backend ✅
- SQLite schema: users, pages, posts, categories, media, navigation, settings
- REST API with JWT/bcrypt auth
- Media upload with multer

### Phase 2 — Admin Panel ✅
- Login screen (glass card)
- Dashboard (stats: pages, posts, media, nav items)
- Pages CRUD with TipTap rich editor + SEO fields
- Posts CRUD with categories, tags, cover image, publish toggle
- Media library (grid view + upload)
- Navigation builder (drag/reorder)
- Settings (site name, tagline, hero content, accent color, footer)

### Phase 3 — Public Frontend ✅
- Floating glass navbar with dropdown support + mobile hamburger
- Hero section (fullscreen, optional bg image, headline/subtitle from CMS)
- Blog listing with category filters, tag filters, pagination
- Post detail with cover image, tags, SEO meta + OG tags
- Dynamic CMS page renderer
- Loading skeletons + 404 states

### Phase 6 — Product Catalog ✅
- **SQLite-backed products** — `products` + `product_categories` tables; full CRUD REST API (`/api/products`)
- **Rich product fields** — name, slug, excerpt, TipTap description, price, sale price, SKU, cover image, gallery (multi-image), category, tags, status draft/published, featured flag, SEO meta
- **Admin panel** — `ProductsView` (sortable grid with thumbnails, price, status, featured star) + `ProductEditView` (two-column editor with MediaPickerModal for cover + multi-gallery, inline category creation, all fields)
- **Dashboard stat** — product count + published count card added to Dashboard
- **Public frontend** — `/shop` listing with category filter buttons + tag filter badges + pagination + sale/featured badges; `/shop/:slug` detail page with main image, gallery thumbnails, sale discount %, rich description prose
- **Search** — products included in `/api/search` results; SearchView shows a Products section
- **Sitemap** — `/shop` + all published `/shop/:slug` URLs included in `sitemap.xml`

### Phase 5 — Comments & Search ✅
- **Comments system** — readers submit comments (name, email, content) → held as `pending`; admins approve/spam/delete from new 💬 Comments view in admin panel; approved comments rendered below each post
- **Full-text search** — `GET /api/search?q=` searches published posts + pages (title, excerpt, content) with title-match priority; `/search` page in frontend with debounced input, result grid (posts + pages), keyword highlight; search icon in floating nav
- **Dashboard comment stats** — total + pending count in Dashboard stat card with badge alert

### Phase 4 — Polish & SEO ✅
- **`/sitemap.xml`** — auto-generated XML sitemap of all published pages + posts
- **`/feed.xml`** — RSS 2.0 feed of the latest 20 published posts
- **MediaPickerModal** — inline media library picker in PostEditView cover image field + Settings logo/hero bg fields (browse + search + double-click to insert)
- **User Profile** — change display name, email, and password from Settings panel (`PUT /api/auth/me`)

## Design System (Lunexo-inspired dark glass)

```css
--bg:      hsl(228, 4%, 10%)   /* page background */
--surface: hsl(228, 4%, 15%)   /* cards/panels */
--accent:  hsl(355, 70%, 58%)  /* red highlight (overridable per-site) */
/* Glass: backdrop-filter:blur(16px) + rgba(255,255,255,0.1) border */
```

Font: **Poppins** via Google Fonts

## API Reference

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | — | `{email, password}` → `{token, user}` |
| GET  | `/api/auth/me` | ✓ | Current user |
| PUT  | `/api/auth/me` | ✓ | Update name/email/password |

### Pages
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/pages` | — | Published pages list |
| GET | `/api/pages?all=1` | ✓ | All pages |
| GET | `/api/pages/:slug` | — | Single page |
| POST | `/api/pages` | ✓ | Create page |
| PUT | `/api/pages/:id` | ✓ | Update page |
| DELETE | `/api/pages/:id` | ✓ | Delete page |

### Posts
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/posts` | — | Published posts (supports `?category=`, `?tag=`, `?limit=`, `?offset=`) |
| GET | `/api/posts/:slug` | — | Single post |
| POST | `/api/posts` | ✓ | Create |
| PUT | `/api/posts/:id` | ✓ | Update |
| DELETE | `/api/posts/:id` | ✓ | Delete |
| GET | `/api/posts/categories` | — | Category list |
| POST | `/api/posts/categories` | ✓ | Add category |

### Media
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/media` | — | All media |
| POST | `/api/media` | ✓ | Upload file(s) |
| DELETE | `/api/media/:id` | ✓ | Delete |

### Navigation
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/navigation` | — | Nav tree |
| POST | `/api/navigation` | ✓ | Add item |
| PUT | `/api/navigation/:id` | ✓ | Update item |
| DELETE | `/api/navigation/:id` | ✓ | Delete |

### Settings
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/settings` | — | All settings as `{key: value}` |
| PUT | `/api/settings` | ✓ | Batch update |

### Dashboard
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/stats` | ✓ | Count stats + recent posts + comment counts |

### Comments
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/comments?post_id=<id>` | — | Approved comments for a post |
| GET | `/api/comments?status=pending` | ✓ | Admin: filter by status |
| POST | `/api/comments` | — | Submit comment (creates as pending) |
| PUT | `/api/comments/:id` | ✓ | Update status (pending/approved/spam) |
| DELETE | `/api/comments/:id` | ✓ | Delete comment |

### Products
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/products` | — | Published products (`?category=`, `?tag=`, `?featured=1`, `?limit=`, `?offset=`) |
| GET | `/api/products?all=1` | ✓ | All products |
| GET | `/api/products/:slug` | — | Single product by slug |
| GET | `/api/products/id/:id` | ✓ | Single product by id (admin) |
| POST | `/api/products` | ✓ | Create product |
| PUT | `/api/products/:id` | ✓ | Update product |
| DELETE | `/api/products/:id` | ✓ | Delete product |
| GET | `/api/products/categories` | — | Product category list |
| POST | `/api/products/categories` | ✓ | Add product category |
| DELETE | `/api/products/categories/:id` | ✓ | Delete product category |

### Search
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/search?q=<term>` | — | Search published posts + pages + products |

### SEO (public)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/sitemap.xml` | XML sitemap of all published pages + posts |
| GET | `/feed.xml` | RSS 2.0 feed of latest 20 posts |
