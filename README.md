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
    ContactView.vue     ← contact form submissions inbox
    UsersView.vue       ← user management (admin only)
    NewsletterView.vue  ← subscriber list + campaign compose + send
    BackupView.vue      ← JSON + CSV export/backup
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

### Phase 11 — Content Revisions + Tag Manager ✅
- **Content revision history** — every `PUT` to a page or post auto-saves a snapshot into the new `revisions` table (up to 20 revisions per entity, oldest pruned automatically); new `RevisionsModal.vue` component lets editors browse the full history, preview pre-save field values, and **restore** any revision back into the editor form for review before re-saving; 🕓 History button added to `PostEditView` and `PageEditView` headers (hidden for new content)
- **Tag Manager** — new `GET /api/tags` endpoint aggregates all unique tags from posts and products with per-entity counts; `PUT /api/tags/rename` renames a tag across every post + product that uses it in one shot; `DELETE /api/tags` removes a tag from all content; admin `TagsView.vue` shows a sortable table of every tag (with posts/products badge counts), inline rename with Enter/Escape keyboard support, and a confirm-before-delete modal; 🏷️ Tags sidebar entry added between Backup and Settings
- **Backend** — `revisions` SQLite table + index added in `db.js`; `routes/revisions.js` (GET list, GET single snapshot, DELETE single, DELETE all for entity); `routes/tags.js` (GET aggregate, PUT rename, DELETE remove); both routes mounted at `/api/revisions` and `/api/tags` in `index.js`; `saveRevision()` helper called on every page + post PUT

### Phase 10 — Reading Time, Related Posts, Social Share, Custom Code Injection, robots.txt ✅
- **Reading time estimate** — computed from post word count (÷ 200 wpm) and displayed alongside the date in the post header (e.g. "5 min read")
- **Related posts** — new `GET /api/posts/:slug/related` endpoint returns up to 3 related posts (same category first, falling back to recent posts); displayed as a responsive card grid below each post on the public frontend
- **Social sharing** — X (Twitter), LinkedIn, and copy-link buttons on every post detail page; copy feedback ("✓") shown for 2 seconds after clicking
- **Custom code injection** — new `header_scripts` and `footer_scripts` settings; admin Settings panel → 💻 Custom Code Injection section with monospace textareas; scripts are injected into `<head>` / `<body>` of the public frontend once on load (idempotent, no duplicate injection); useful for analytics pixels, chat widgets, custom fonts, JSON-LD, etc.
- **robots.txt management** — new `robots_txt` setting with default `User-agent: * / Allow: /`; admin Settings panel → 🤖 robots.txt section with live editable textarea; served at `/robots.txt` by the Express backend with 1h cache header
- **Backend** — `GET /api/posts/:slug/related` route added; `/robots.txt` route added to `seo.js`; `header_scripts`, `footer_scripts`, `robots_txt` keys seeded in `defaultSettings`

### Phase 9 — Newsletter Subscribers + Content Backup/Export ✅
- **Newsletter subscriber system** — `subscribers` + `newsletter_campaigns` SQLite tables; public `POST /api/newsletter/subscribe` (with re-subscribe support); public `GET /api/newsletter/unsubscribe?token=` (branded HTML page); admin CRUD: list/filter/status-toggle/delete subscribers; `POST /api/newsletter/send` sends HTML email to all active subscribers using nodemailer (unsubscribe link auto-appended); campaign history stored and viewable; `NewsletterView` admin panel with compose modal + campaigns tab + CSV export
- **Newsletter frontend widget** — `NewsletterForm.vue` component shown in `SiteFooter.vue` when `newsletter_enabled = 1`; Settings → Newsletter section: enable/disable toggle + intro text customisation + link to subscriber management
- **Dashboard** — new Subscribers stat card with active count; quick-action buttons for Newsletter and Backup
- **Full backup/export** — `GET /api/backup/export` → full JSON snapshot of all content (pages, posts, categories, products, navigation, subscribers, redirects, settings) with site name + export date in filename; `GET /api/backup/export/csv?type=posts|pages|products|subscribers` → typed CSV exports; `BackupView` admin panel with content summary stats, one-click JSON download, four CSV export cards, and best-practice notes; 🗄️ Backup sidebar entry added
- **better-sqlite3 rebuilt** for Node v25.8.0 (prebuilt binary now resolves correctly)

### Phase 8 — Activity Logging + Image Optimization + Redirect Manager ✅
- **Comprehensive activity logging** — `logActivity` wired into all mutation routes: pages (create/update/delete), posts (update/delete; create already existed), products (create/update/delete), media (upload/delete), comments (status change/delete), users (create/update/delete), redirects (create/update/delete); all admin actions now appear in Dashboard → Recent Activity feed
- **Image auto-optimization** — media upload now auto-converts JPEG/PNG images above 200 KB to WebP (max 1920px, 85% quality) using the already-installed `sharp`; file size significantly reduced; original swapped for `.webp` version transparently; SVG and GIF files are left untouched
- **Redirect Manager** — full 301/302 redirect system: new `redirects` SQLite table; REST API at `GET/POST/PUT/DELETE /api/redirects`; Express middleware catches non-API paths on the backend; Vue frontend router guard checks `GET /api/redirects/check?path=` on every navigation and performs client-side redirect (supports both internal paths and external URLs); admin `RedirectsView` with add/edit/delete modals, type badges, creation date; sidebar entry 🔀 Redirects added
- **Dashboard** — new Redirects stat card; quick-action button to `/redirects`

### Phase 7 — Multi-user Management + Contact Forms ✅
- **Multi-user management** — full CRUD for user accounts at `GET/POST/PUT/DELETE /api/users` (admin-only); new `adminOnly` middleware; roles: `admin` (full access) vs `editor` (content only); can't delete yourself or change your own role; `UsersView` in admin with invite/edit/delete modals + role badges
- **Contact form** — public `POST /api/contact` endpoint stores name, email, subject, message, IP + timestamps in new `form_submissions` SQLite table; admin `ContactView` with status cycling (unread → read → archived), detail modal with reply-via-email link, delete confirm; unread badge count in sidebar; `GET /api/contact/stats` for dashboard
- **Public /contact page** — glass-card form with client-side validation, required fields, success state, `contact_intro` customisable from Settings → Contact Page section
- **Dashboard** — two new stat cards: Contact messages (unread badge alert) and Users count
- **Bug fix** — installed missing `@vueuse/head` dep that broke frontend `vite build`

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

### Users (admin only)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users` | admin | List all users |
| POST | `/api/users` | admin | Create user `{email, name, password, role}` |
| PUT | `/api/users/:id` | admin | Update user (name/email/role/password) |
| DELETE | `/api/users/:id` | admin | Delete user |

### Contact Form
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/contact` | — | Submit contact message (public) |
| GET | `/api/contact` | admin | List submissions (`?status=unread\|read\|archived`) |
| GET | `/api/contact/stats` | admin | Unread count for dashboard |
| PUT | `/api/contact/:id` | admin | Update status |
| DELETE | `/api/contact/:id` | admin | Delete submission |

### Redirects
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/redirects` | ✓ | List all redirects |
| POST | `/api/redirects` | ✓ | Create redirect `{from_path, to_path, type}` |
| PUT | `/api/redirects/:id` | ✓ | Update redirect |
| DELETE | `/api/redirects/:id` | ✓ | Delete redirect |
| GET | `/api/redirects/check?path=` | — | Check if a path has a redirect (SPA guard) |

### Newsletter
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/newsletter/subscribe` | — | Subscribe email (public) |
| GET  | `/api/newsletter/unsubscribe?token=` | — | Unsubscribe via token link (public) |
| GET  | `/api/newsletter/subscribers` | ✓ | List subscribers (`?status=active\|unsubscribed&q=`) |
| PUT  | `/api/newsletter/subscribers/:id` | ✓ | Update subscriber status |
| DELETE | `/api/newsletter/subscribers/:id` | ✓ | Remove subscriber |
| GET  | `/api/newsletter/stats` | ✓ | Total/active/unsubscribed counts |
| GET  | `/api/newsletter/campaigns` | ✓ | List sent campaigns |
| POST | `/api/newsletter/send` | ✓ | Send campaign `{subject, content}` to all active |

### Backup & Export
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/backup/export` | ✓ | Full JSON backup (all content) |
| GET | `/api/backup/export/csv?type=` | ✓ | CSV export: `posts`, `pages`, `products`, `subscribers` |
| GET | `/api/backup/stats` | ✓ | Content item counts |

### Activity Log
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/activity` | ✓ | Recent activity (last 20; `?limit=N`) |

### Related Posts
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/posts/:slug/related` | — | Up to 3 related posts (same category, then recent) |

### Content Revisions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/revisions?entity_type=&entity_id=` | ✓ | List revisions for a page or post (no snapshot body) |
| GET | `/api/revisions/:id` | ✓ | Fetch full revision with snapshot JSON |
| DELETE | `/api/revisions/:id` | ✓ | Delete a single revision |
| DELETE | `/api/revisions?entity_type=&entity_id=` | ✓ | Purge all revisions for an entity |

### Tag Manager
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tags` | ✓ | All unique tags with post_count, product_count, total |
| PUT | `/api/tags/rename` | ✓ | Rename tag across all content `{from, to}` |
| DELETE | `/api/tags` | ✓ | Remove tag from all content `{tag}` |

### SEO (public)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/sitemap.xml` | XML sitemap of all published pages + posts |
| GET | `/feed.xml` | RSS 2.0 feed of latest 20 posts |
| GET | `/robots.txt` | Robots exclusion file (managed via Settings) |
