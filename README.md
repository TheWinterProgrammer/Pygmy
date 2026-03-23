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
      seo.js        ← GET /sitemap.xml, /feed.xml, /robots.txt
      pages.js      ← CRUD /api/pages
      posts.js      ← CRUD /api/posts + categories
      media.js      ← Upload /api/media
      navigation.js ← CRUD /api/navigation
      settings.js   ← GET/PUT /api/settings
      dashboard.js  ← GET /api/dashboard/stats
      analytics.js  ← POST /api/analytics/view, GET summary/daily/top
      webhooks.js   ← CRUD /api/webhooks + test delivery + fireWebhooks() helper
      api_keys.js   ← CRUD /api/api-keys + rotate; SHA-256 hashed storage
      locks.js      ← content locking GET/POST/DELETE /api/locks
      digital_downloads.js ← digital files + secure download tokens + order-link lookup
      subscriptions.js     ← subscription plans CRUD, member management, revenue reports

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
    FormsView.vue       ← custom form builder list
    FormEditView.vue    ← field builder (10 field types, reorder, options)
    FormSubmissionsView.vue ← submissions inbox with CSV export
    WebhooksView.vue    ← webhook manager (CRUD, test delivery, event selection)
    ApiKeysView.vue     ← API key manager (create/revoke/rotate, one-time reveal)
    AbandonedCartsView.vue ← abandoned cart recovery (stats, filter, bulk email, detail modal)
    EventsView.vue      ← events list (filter by status/upcoming/past)
    EventEditView.vue   ← event editor (TipTap, media picker, dates, location, SEO)
    DownloadsView.vue   ← digital downloads overview (products + file management + tokens)
    SubscriptionsView.vue ← subscription plans + member management + MRR stats
    RevenueView.vue     ← revenue analytics (daily chart, top products, order stats, CSV)
    SettingsView.vue

frontend/           ← public website (port 5174)
  components/
    SiteNav.vue     ← floating glass navbar from CMS nav data
    SiteFooter.vue
  views/
    HomeView.vue    ← hero + recent posts grid
    BlogView.vue    ← paginated blog listing + category/tag filters
    PostView.vue    ← full post with SEO meta tags + paywall for members-only content
    PageView.vue    ← dynamic CMS pages
    ProductsView.vue ← /shop listing with filters + pagination
    ProductView.vue  ← /shop/:slug detail with gallery + pricing
    SearchView.vue  ← full-text search (posts + pages + products + events)
    EventsView.vue  ← /events listing with Upcoming/Past/All tabs
    EventView.vue   ← /events/:slug detail with date, location, ticket, SEO
    MembershipView.vue ← /membership pricing page (plans grid, current status, FAQ)
    OrderDownloadsView.vue ← /order/downloads self-serve file access (order # + email)
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

### Phase 41 — Customer Groups + Group Pricing + Google Shopping Feed + Stock Forecasting ✅
- **Customer Groups** — `customer_groups` + `customer_group_members` + `customer_group_pricing` SQLite tables; REST API at `GET/POST/PUT/DELETE /api/customer-groups`; groups have name, slug, description, flat `discount_pct` (applied to all products for the group), color badge, active flag; `POST /:id/members` bulk-adds customers; `DELETE /:id/members/:customerId` removes individual; `PUT /:id/pricing/:productId` sets an explicit price override per product per group; `DELETE /:id/pricing/:productId` removes override; `GET /me/price/:productId` customer JWT endpoint returns the best applicable group price (explicit override wins, falls back to discount%); `GET /customer/:customerId` returns all groups a customer belongs to; admin **CustomerGroupsView** — stats strip (total groups, active, total members, price overrides), searchable table with color dot, member/override badge counts, status pill; 👥 Members modal — search customers by email/name, add to group, remove from group; 💰 Price Overrides modal — search products, set per-product group price, delete override, shows savings %; create/edit modal with color picker, discount %, active toggle; 🏷️ Customer Groups sidebar entry
- **Google Shopping Feed** — `GET /shopping-feed.xml` public endpoint generates a Google Merchant Center-compatible RSS/Atom XML product feed; includes all published, in-stock products; each `<item>` emits `g:id`, `g:title`, `g:description` (stripped HTML), `g:link`, `g:image_link` + up to 9 `g:additional_image_link`, `g:condition`, `g:availability`, `g:price`, optional `g:sale_price`, `g:product_type`, `g:mpn` (SKU); 1-hour cache header; feed disabled until `google_shopping_feed_enabled = 1` in Settings; `google_merchant_id` setting for future verification meta tag
- **Stock Forecasting** — `GET /api/stock-forecast` analyzes all stock-tracked products against historical order data to predict stockouts; configurable lookback window (7–365 days); computes `daily_velocity` (units/day), `days_until_stockout`, `stockout_date`, and `reorder_suggestion` (45 days of velocity = 30 days demand + 50% safety stock); 5 risk tiers: out_of_stock, critical (≤7 days), warning (≤30 days), low (under threshold), healthy; summary stats strip (counts per tier); results sortable by risk then urgency; filter by risk tier; `GET /api/stock-forecast/:productId` returns day-by-day sales history + 60-day stock projection (sampled every 5 days); admin **StockForecastView** — stats strip with color-coded tier counts, risk filter + lookback period selector, product table with stock badge, velocity, sold count, days-until-stockout badge (color-coded), reorder suggestion pill, risk badge; 📊 Detail modal with 4 stat cards, filled bar chart of daily sales history, projected stock chart with color-coded bars (green→orange→red as stock depletes); 📈 Stock Forecast sidebar entry
- **Bug fixes** — Phase 40 routes (`waitlist`, `volume_pricing`, `product_options`, `inventory_locations`, `order_bumps`, `review_requests`) imported `auth` as default export from `middleware/auth.js` which has no default export; fixed all to use named import `{ authMiddleware as auth }`

### Phase 40 — Volume Pricing + Product Custom Options + Back-in-Stock Waitlist + Packing Slips ✅
- **Volume Pricing** — quantity-based tiered pricing per product: `volume_pricing` SQLite table; `GET/POST/PUT/DELETE /api/volume-pricing?product_id=`; each tier has `min_qty`, `max_qty` (null = unlimited), and `price`; tiers displayed as a table in `ProductEditView` sidebar; public `ProductView` shows a volume pricing table when tiers exist; cart uses the lowest-applicable tier price automatically
- **Product Custom Options** — free-text, dropdown, and checkbox add-on options: `product_options` table; `GET/POST/PUT/DELETE /api/product-options?product_id=`; options have label, type (text/select/checkbox), required flag, additional price (adds to base price), and options list for selects; rendered in `ProductView` above the ATC button; selected options included in cart item data
- **Back-in-Stock Waitlist** — customers submit email + product_id to join a waitlist: `product_waitlist` table; `POST /api/waitlist` (public); `GET /api/waitlist?product_id=` (admin); `POST /api/waitlist/notify/:productId` sends a notification email to all pending waitlist entries (uses SMTP settings); automatically marks as notified; admin **WaitlistView** — stats strip (total pending, notified, products watched), table with product filter and bulk "Notify All" button per product; 📋 Waitlist sidebar entry
- **Packing Slips** — print-ready HTML packing slips for fulfillment: `GET /api/packing-slips/:orderNumber` (admin); renders order details with items table (SKU, name, qty, notes), shipping address, order notes, and a box-count / handled-by footer; fully print-optimized CSS; Orders panel gains a 📦 Packing Slip button per order

### Phase 39 — Product Collections + Post-Purchase Upsell + Supplier Management + Invoice Download ✅
- **Product Collections** — admins can group products into named collections (like Shopify Collections): `collections` + `collection_products` SQLite tables; full CRUD at `GET/POST/PUT/DELETE /api/collections`; `GET /api/collections/:slug` returns collection + all published products in sort order; `PUT /api/collections/:id/products` replaces the entire product list for a collection; admin **CollectionsView** — stats strip (total, active, products count), table with slug, product count, status badge, ✏️ Edit and 📦 Products actions; **Products modal** lets admins search products to add, reorder with ↑↓ buttons, and remove; cover image, SEO title/desc, sort order; 🗂️ Collections sidebar entry; public `/collections` listing page (card grid with cover image, description, count) + `/collections/:slug` detail page (hero with overlay, product grid with sale badges); routes added to frontend router
- **Post-Purchase Upsell** — `upsell_offers` + `upsell_conversions` SQLite tables; `GET/POST/PUT/DELETE /api/upsell`; `GET /api/upsell/active?order_number=&product_ids=` public endpoint returns the first matching active offer not yet converted for that order (respects `upsell_enabled` setting, deduplicates per order); 3 trigger types: any order, specific product in cart; configurable discount % auto-applied to upsell price; `POST /api/upsell/:id/convert` records conversion + revenue; `GET /api/upsell/stats` summary; admin **UpsellView** — stats strip (offers, active, conversions, revenue), product search picker, offer table with conversion rates, create/edit modal with product picker, trigger type, discount, headline, subtext, sort order; 🎯 Post-Purchase Upsell sidebar entry; **OrderConfirmView** updated: upsell overlay fades in 1.8s after page load — shows product image, discounted price, discount badge, yes/no buttons; converts silently and auto-dismisses; also adds 🧾 Invoice button to CTAs
- **Supplier Management** — `suppliers` + `purchase_orders` SQLite tables; `supplier_id` FK added to products; REST API at `GET/POST/PUT/DELETE /api/suppliers`; per-supplier purchase order CRUD at `GET/POST /api/suppliers/:id/purchase-orders`; global PO listing at `GET /api/suppliers/purchase-orders/all` with status + search filters; `PUT /api/suppliers/purchase-orders/:id` — updating a PO to `status=received` auto-increments `stock_quantity` for all linked products in the PO items; admin **SuppliersView** — stats strip (suppliers, active, POs, linked products), searchable table, supplier create/edit modal with full contact info; 📋 Purchase Orders modal per supplier (list all POs with status badges); global PO list modal with status filter; PO create/edit modal with line-item builder (name, qty, unit cost, live total, product_id link), status selector, expected/received dates; 🏭 Suppliers sidebar entry
- **Invoice Download** — `GET /api/invoices/:orderNumber?email=` public endpoint renders a print-ready HTML invoice (validates email match for security); `GET /api/invoices/:orderNumber/admin` admin-only endpoint (JWT); invoice includes: site logo (or name), order number + date + status badge, bill-to / sold-by columns (with tax registration number when configured), line items table, subtotal/discount/shipping/tax/total rows, order notes, footer with site URL; fully print-optimized CSS (`@media print`); **OrderConfirmView** adds 🧾 Invoice button in CTAs; **AccountView** order detail modal adds 🧾 Download Invoice button (pre-fills customer email); **OrdersView** admin invoice button now routes to the new `/api/invoices/` endpoint
- **Backend** — `upsell_enabled`, `upsell_button_text`, `upsell_decline_text`, `suppliers_enabled` settings seeded on startup

### Phase 38 — Price Drop Alerts + Product Badges + Social Proof Admin + Saved Carts ✅
- **Price Drop Alerts admin panel** — `PriceAlertsView` wired into admin router at `/price-alerts`; sidebar entry 📉 Price Alerts added; stats strip (pending alerts, products watched, already notified); "Most Watched Products" card grid with watcher count, current price, and "Send Alerts" button per product; filterable alerts table (by email/product, notified/pending status); delete alert; `POST /api/price-alerts/notify/:productId` sends price drop emails to all watchers of a product; admin triggers notify from the UI; frontend `PriceAlertButton.vue` already shown on product detail pages — customers can subscribe for any price drop or set a target price
- **Product Badges admin panel** — `ProductBadgesView` wired into admin router at `/product-badges`; sidebar entry 🏷️ Product Badges added; admins create/edit/delete badge labels per product with 7 color styles (default, red, green, blue, orange, purple, gold) and sort order; badges are already rendered on product cards (`ProductsView`) and product detail pages (`ProductView`) via the products API which includes `badges[]` in every product response
- **Social Proof admin view** — new `SocialProofView` at `/social-proof`; sidebar entry 👥 Social Proof; stats strip (live visitors, purchase events in 48h, active pages); live viewer table by page path with animated live dot; recent purchase activity feed (product name, masked customer, city, amount, time ago); how-it-works explanation section; data from `GET /api/social-proof/admin` + `GET /api/social-proof/recent`; `SocialProof.vue` public component already mounted on product pages (live viewer badge + recent purchase toast popup)
- **Saved Carts (cross-device persistence)** — cart store (`stores/cart.js`) now auto-syncs to server for logged-in customers: `scheduleSave()` debounces 3s and calls `PUT /api/saved-carts/me` after every `addItem`, `removeItem`, `updateQuantity`; uses dynamic `import('./customer.js')` to avoid circular dep; `loadSavedCart()` fetches the server-side cart; `restoreSavedCart(mode)` merges or replaces local cart; **AccountView** gains a 5th tab 🛒 Saved Cart — lists saved items with thumbnail, variant label, price, per-item total, and subtotal; "Load into Cart" button merges the saved cart into the local cart and opens the drawer; items are refreshed against current product prices and availability on the server side (discontinued or out-of-stock items are filtered out)
- **Bug fixes** — `RecentlyViewed.vue` had an invalid `export function` inside `<script setup>`; converted to `defineExpose({ trackView })`; `EmailTemplatesView.vue` had `{{ '{{' + v.key + '}}' }}` template expressions which caused Vite/rolldown parse errors; replaced with `{{ fmtVar(v.key) }}` helper function

### Phase 35 — Email Sequences + Customer Segments + Comment Reply Threading ✅
- **Email Sequences (Drip Campaigns)** — full multi-step email automation: `email_sequences`, `email_sequence_steps`, `email_sequence_enrollments` SQLite tables (pre-created in Phase 35 DB schema); REST API at `GET/POST/PUT/DELETE /api/email-sequences` + `PUT /:id/status` (draft/active/paused); per-sequence step CRUD (`GET/POST/PUT/DELETE /api/email-sequences/:id/steps`) with auto-assigned `step_number`, `delay_days`, `delay_hours` for drip pacing; enrollment management (`GET/POST /api/email-sequences/:id/enrollments`, `DELETE /:id/enrollments/:eid`, bulk enroll via array of `{email, name}` objects); each enrollment tracks `next_step` + `next_send_at` for precise delivery; **background processor** runs every 5 minutes in `index.js` — picks up all due active enrollments, sends via SMTP (using `sendMailTo`), advances to next step or marks completed; `{{name}}` and `{{email}}` placeholder substitution in subject + body; `POST /api/email-sequences/process` manual trigger (admin); `GET /api/email-sequences/stats` returns total/active/enrollment counts; admin **EmailSequencesView** — stats strip, sequence table with trigger type + step count + enrollment counts + status pills, ▶/⏸ status control buttons, ✏️ edit modal, 📝 Steps modal (per-step editor with subject/HTML body/delay fields, add/delete steps, auto-save on blur), 👥 Enrollments modal (enroll textarea for bulk email entry, live enrollment table with status + next-send time + remove button); 📧 Email Sequences sidebar entry + Dashboard quick-action
- **Customer Segments** — dynamic rule-based customer grouping: `customer_segments` SQLite table with JSON `conditions` array; REST API at `GET/POST/PUT/DELETE /api/customer-segments`; `POST /:id/evaluate` re-runs conditions and updates `member_count`; `POST /:id/enroll` bulk-enrolls all matching customers into an email sequence; **7 condition fields**: `total_orders` (≥/>/≤/=), `total_spent` (€, ≥/>/ ≤), `last_order_days` (within/older_than N days), `has_subscription` (yes/no), `points_balance` (≥/≤), `active` (yes/no), `country` (ISO code, address match); all conditions are AND-combined; segment membership calculated live via SQL subqueries; dynamic flag auto-recalculates count on every update; admin **CustomerSegmentsView** — segment table with condition badge pills + member count + dynamic badge, 🔄 re-evaluate button, 👁️ View modal (member preview up to 100 rows), ✏️ Edit modal (condition builder with field/operator/value selectors, + Add Condition), 📧 Enroll modal (pick email sequence → bulk-enroll all segment members); 🎯 Customer Segments sidebar entry + Dashboard quick-action
- **Comment Reply Threading** — `parent_id` column added to `comments` table via safe ALTER TABLE migration; public `POST /api/comments` now accepts optional `parent_id` (validated: parent must be approved + same post); public `GET /api/comments?post_id=` returns threaded structure — top-level comments each include a `replies` array of child comments; admin listing unaffected (flat list); public `PostView` updated: each approved comment shows a "↩ Reply" button that opens an inline reply form directly below the comment (hides the main bottom form while replying); reply form has same name/email/content fields; replies are displayed as indented cards with a left border accent; Escape/Cancel button dismisses the reply form; submission sends `parent_id` to backend; moderators approve replies just like regular comments in the admin Comments view

### Phase 34 — A/B Testing + Search Analytics + Advanced Search ✅
- **A/B Testing system** — full experiment framework: `ab_tests`, `ab_variants`, `ab_impressions` SQLite tables; CRUD REST API at `GET/POST/PUT/DELETE /api/ab-tests`; tests are scoped to an entity type (page, post, product, custom) and optional entity ID; configurable traffic split (10–90% to variant B via slider); 4 goal types: click, conversion, bounce reduction, time on page; optional CSS selector / event name per goal; status lifecycle: draft → running → paused → completed with automatic `started_at` / `ended_at` timestamps; `POST /api/ab-tests/:id/assign` assigns a session to a variant using the configured split ratio, remembers assignment so the same visitor always sees the same variant; `POST /api/ab-tests/:id/convert` records a conversion for that session; per-variant impression + conversion counts + conversion rate calculated live; admin can declare a winner per test (stored as `winner` field); admin **AbTestingView** — stats strip (total / running / completed / draft), status filter, full test table with impression/conversion counts + status pills + winner badge, ▶ Start / ⏸ Pause / ✅ End quick-action buttons, create/edit modal with all fields + traffic split slider + variant name + JSON changes editor; 📊 Stats modal shows variant cards with conversion rate bars + winner declaration buttons; 🧪 A/B Testing sidebar entry + Dashboard quick-action
- **Search Analytics** — every search request to `GET /api/search` is auto-tracked into the new `search_queries` SQLite table (query, results count, session ID, clicked slug/type, timestamp); `POST /api/search-analytics/track` (public) for manual tracking; `POST /api/search-analytics/click` records which result was clicked for a query; admin analytics endpoints: `GET /summary` (total searches, unique queries, CTR%, zero-result rate), `GET /top` (top queries by search volume with click count and avg result count), `GET /zero-results` (zero-result queries grouped and sorted — content creation hints), `GET /daily` (day-by-day volume with zero-result overlay, gaps filled), `GET /clicks` (most clicked search results); `GET /api/search-analytics/suggestions` (public) returns autocomplete suggestions from historical queries that had results; admin **SearchAnalyticsView** — period selector (7/30/60/90 days), 5 summary stat cards (total searches, unique queries, CTR%, zero-result rate, zero-result count), filled bar chart (daily volume + zero-result overlay), Top Queries table (searches / clicks / CTR / avg results), Zero-Result Queries table with count badges (content creation hints), Most Clicked Results table; 🔍 Search Analytics sidebar entry + Dashboard quick-action
- **Advanced Search (public frontend)** — `SearchView` enhanced with: **type filter pills** (All / Posts / Products / Events / Pages — each shows result count badge; clicking re-runs search scoped to that type); **sort selector** (Relevance / Date / Name); **autocomplete suggestions dropdown** (appears after 150ms debounce, fetched from `/api/search-analytics/suggestions`, uses historical popular searches with results); click-through tracking via `POST /api/search-analytics/click`; session ID generated and stored in localStorage for consistent analytics; backend search route updated with `?type=` and `?sort=` query params (relevance uses title-match weighting, date uses entity's date field, name uses alphabetical); search response includes `total` count; improved empty state with icon + tips; clickable search hint cards on the initial page for discovery

### Phase 33 — Support Tickets + Content Calendar + Site Health + Quick Notes ✅
- **Support Tickets system** — `support_tickets` + `ticket_messages` SQLite tables; full REST API at `GET/POST/PUT/DELETE /api/support`; tickets can be created by customers via the public `SupportWidget` or by admins directly; ticket lifecycle: open → in_progress → resolved → closed; admin reply flow with internal notes (not visible to customers); auto-reply on new ticket when configured in Settings; email notifications for new tickets and customer replies; admin **SupportView** — stats strip (unread / open / in-progress / resolved), searchable table with status filter, message thread modal with reply composer and internal note toggle, create ticket modal; 🎫 Support Tickets sidebar entry; **SupportWidget.vue** — floating chat bubble on public frontend with configurable greeting and offline message, live message thread, creates or resumes ticket by session, uses `/api/support/chat` endpoints; Settings → 🎫 Support section (enable, widget enable, greeting, offline message, online hours, auto-reply)
- **Content Calendar** — admin **ContentCalendarView** with month-view grid + list-view toggle; monthly navigation (prev/next); pulls scheduled/draft/published posts, pages, products, and events into a unified calendar; each entry shows entity type emoji, title, and status badge; click to navigate to that entity's edit page; month/year label header; `GET /api/content-calendar?year=&month=` backend endpoint returns all content with a publish/scheduled date in the given month
- **Site Health Dashboard** — admin **SiteHealthView** fetches `GET /api/site-health` which runs a comprehensive health check: database file size, total rows per table, uploads directory size and file count, settings completeness (SMTP, site name, etc.), backend Node/npm version, last backup time estimate; displays a clean health report with color-coded status indicators, file size stats, table row counts, and recommendations
- **Quick Notes widget** — `QuickNotes.vue` component embedded on admin Dashboard; stores sticky notes per user in `quick_notes` SQLite table; 5 color themes (yellow/green/blue/pink/purple); pin to top; CRUD via `/api/quick-notes`; masonry-style grid; click to edit inline; pin/unpin toggle

### Phase 30 — Flash Sales + Countdown Timers + Announcement Bar + Pop-up Builder ✅
- **Flash Sales** — time-limited promotional discounts with full CRUD admin panel; `flash_sales` SQLite table; discount types: percentage off, fixed amount, or free shipping; scope per sale: all products, specific categories, or specific product IDs; optional min purchase threshold, max-use limit (auto-disables when hit), schedule (starts_at / ends_at); `GET /api/flash-sales/current` public endpoint returns the single currently-active sale; `POST /api/flash-sales/:id/apply` validates cart items against the sale scope and returns `{discount_amount, free_shipping}`; admin **FlashSalesView** with live status badges (🟢 Active / 🕐 Scheduled / ⚫ Expired), discount pill, time-remaining display, stats strip (total / active / upcoming / expired), full create/edit modal with discount type selector, scope picker, schedule datetime pickers; ⚡ Flash Sales sidebar entry + Dashboard quick-action
- **Countdown Timer Component** — `FlashSaleBanner.vue` frontend component fetches the active flash sale on mount and renders a live HH:MM:SS countdown (updating every second) with the sale's badge label and description; auto-hides when the sale ends; mounted on `/shop` listing and `/shop/:slug` product detail pages; styled with the red accent gradient glass card
- **Announcement Bar** — sticky configurable banner: `announcement_bars` SQLite table; full CRUD at `GET/POST/PUT/DELETE /api/announcement-bars`; `/live` public endpoint returns the currently-live bar; `PUT /:id/activate` quick-activates one bar and deactivates all others (only one live at a time); per-bar settings: message, optional link (URL + label), background/text color pickers, position (top header or fixed bottom), dismissable toggle, schedule (starts_at / ends_at); admin **AnnouncementBarsView** with live WYSIWYG preview strip, position badge, schedule display, and a ✅ activate button; `AnnouncementBar.vue` frontend component mounts at top of every page (above nav), reads `/announcement-bars/live` on load, renders with inline style from CMS colors, shows ✕ dismiss button when dismissable, remembers dismissal in sessionStorage per bar ID; smooth slide-in/out CSS transition
- **Pop-up Builder** — fully configurable pop-up system: `popups` SQLite table; CRUD at `GET/POST/PUT/DELETE /api/popups`; `POST /api/popups/:id/track` records display and conversion events; 4 pop-up types: **Newsletter** (email capture form wired to `/api/newsletter/subscribe`), **Promo** (title + body + CTA button), **Announcement**, **Custom** (raw HTML); 3 trigger modes: **Timed** (configurable delay in seconds), **Exit Intent** (fires on `mouseleave` above viewport), **Scroll Depth** (fires at configurable % scroll); page targeting: all pages, home, blog, shop, product pages, or custom path list; show-once cookie with configurable expiry days; display/conversion stats per popup with CTR% in table; admin **PopupsView** with stats strip (total / active / total displays / total conversions), type badges, trigger info, status toggles, full create/edit modal with trigger selector, visibility selector, style background color picker; `SitePopup.vue` frontend component mounted app-wide in `App.vue`; route-aware matching runs on mount; tracks display on show, conversion on CTA click or newsletter submit; respects cookie to avoid reshowing

### Phase 27 — Digital Downloads + Subscription Memberships + Revenue Reports + Product CSV Import/Export ✅
- **Digital Downloads** — products can be marked as `is_digital`; admins upload downloadable files per product (up to 500 MB each) from a new **Digital Files** section in `ProductEditView`; each file has a label, download limit (0 = unlimited), and expiry days (0 = never); `digital_files` + `download_tokens` SQLite tables; when an order containing digital products is placed, `issueDownloadTokensForOrder()` auto-generates secure per-file tokens scoped to the order/email; token links sent in the order confirmation email with a download section; **`GET /api/digital-downloads/:token`** serves the file (verifies expiry, checks download limit, streams file with Content-Disposition); **`POST /api/digital-downloads/order-links`** public endpoint lets customers retrieve their file links by order number + email; admin **DownloadsView.vue** lists all digital products with file counts, expandable file management per product, and token history; **OrderDownloadsView** (`/order/downloads`) public self-serve page — enter order number + email to access all files with expiry/limit indicators; **OrderConfirmView** shows a styled download notice when `has_digital=true`; **AccountView** order detail modal links to downloads; download links in confirmation email include a `{{SITE_URL}}` placeholder resolved at runtime
- **Subscription Memberships** — `subscription_plans` + `member_subscriptions` SQLite tables; full plans CRUD (`GET/POST/PUT/DELETE /api/subscriptions/plans`) with name, slug, description, price, interval (month/year), trial days, feature list (JSON array), active toggle, sort order; member management (`GET /api/subscriptions/members`, `POST /api/subscriptions/members` grant, `PUT /api/subscriptions/members/:id`, `DELETE /api/subscriptions/members/:id`); customer endpoints `GET /api/subscriptions/me`, `POST /api/subscriptions/cancel`, `POST /api/subscriptions/reactivate`; `GET /api/subscriptions/stats` returns active, trialing, cancelled counts + MRR; **content gating** — `access_level` column added to `posts` and `pages` (`public` | `members`); admin post/page editors gain an **Access Control** section with a dropdown; backend checks customer JWT for an active/trialing `member_subscriptions` row before serving gated content — returns `{ _gated: true, content: '' }` teaser on failure; **PostView** shows a glass paywall card with "View Plans" CTA when `_gated`; **plan_id** migration column added to `customers` table; admin **SubscriptionsView.vue** — plans grid (price, interval, feature list, member count, active badge), add/edit plan modal, members table (search, status filter, sortable), grant subscription modal (search customer by email, assign plan, set trial days/notes), member detail modal with cancel/reactivate and period dates, MRR stat strip; **Settings → 💳 Memberships** section (enable toggle, pricing page title + intro text); **Dashboard** stat card for active members + MRR (shown when non-zero); **MembershipView** (`/membership`) public pricing page — hero, plans grid with trial badge + features checklist, current plan display for logged-in members with cancel/reactivate, FAQ section
- **Revenue Reports** — `GET /api/subscriptions/revenue?days=N` returns: daily revenue time series (filled for zero-revenue days), top products by revenue, top customers by revenue, order status breakdown with counts + revenue, summary (total/today/week/month/avg order value/refunded), tax revenue, shipping revenue; `GET /api/subscriptions/revenue/export?days=N` streams CSV; admin **RevenueView.vue** — period selector (7/30/60/90/365 days), summary stat cards (total revenue, orders, avg order value, refunded), filled bar chart (daily totals), top products table, top customers table, order status breakdown, ⬇️ Export CSV button; link from Dashboard quick-actions
- **Product CSV Import/Export** — `GET /api/products/export/csv` generates a properly escaped CSV of all products (20 columns including stock, variants, SEO fields); `POST /api/products/import/csv` (multipart) parses CSV with a manual quoted-field parser, supports `mode=merge` (upsert by slug, default) or `mode=replace` (truncate first); reports `{ created, updated, skipped, errors[] }`; **ProductsView** header gains **⬇️ Export CSV** and **⬆️ Import CSV** buttons (import uses a hidden file input); import result banner shows outcome with error count

### Phase 25 — Tax/VAT Manager + Loyalty Points System ✅
- **Tax/VAT Manager** — full tax calculation system: `tax_rates` table with country (ISO-3166 or `*` wildcard), state, rate%, inclusive/exclusive mode, priority, and active toggle; `POST /api/tax-rates/calculate` computes tax at checkout (exclusive = added on top; inclusive = extracted from price); tax rows added to orders table (`tax_amount`, `tax_rate_name`); invoice HTML updated with tax line + Tax Registration Number in header; admin **TaxRatesView.vue** with stats strip, sortable table with flag emojis + country codes, active toggle, and full add/edit modal with 25-country dropdown; Tax Rates sidebar entry + route added; Settings page gains 🧾 Tax/VAT section (enable, inclusive mode, registration number); `POST /api/orders` accepts and validates `tax_amount` + `tax_rate_name` from frontend; frontend `CheckoutView.vue` auto-calculates tax when shipping country is selected and shows a "VAT (X%): €X.XX" line in the order summary; tax included in order total
- **Loyalty Points System** — full earn/redeem/adjust points flow: `loyalty_transactions` table (earn, redeem, adjust, expire types); `points_balance` column added to `customers`; order placement auto-earns points (floor of `order_total × points_per_unit`) and supports optional `redeem_points` in the order body (deducted from `discount_amount`); `GET /api/loyalty/balance` and `GET /api/loyalty/transactions` for customers; `POST /api/loyalty/redeem` validates points before checkout; admin endpoints for listing customers by points + manual adjustments; **CustomersView.vue** gains a 🏆 Pts column in the table + a Loyalty Points section in the detail modal (current balance, last 10 transactions, manual +/− adjustment form with note); **AccountView.vue** gains a 4th tab 🏆 Points showing balance card, "Worth €X.XX", transaction history, and a "Redeem at checkout" CTA when eligible; **CheckoutView.vue** shows loyalty redemption section for logged-in customers with sufficient points (enter points, apply button → discount line); **SettingsView.vue** gains 🏆 Loyalty Program section (enable, points per unit, redemption rate, minimum points, expiry days); **DashboardView.vue** gains two new stat cards: "🧾 Tax Rates" (active count → /tax-rates) and "🏆 Loyalty" (total points in circulation, shown only when loyalty is enabled); `GET /api/dashboard/stats` extended with `tax_rates.active` and `loyalty.{enabled, total_points}`

### Phase 24 — Page Content Blocks Builder ✅
- **Visual block-based page builder** — every page in the CMS now has a **Content Blocks** section below the classic TipTap editor; blocks let admins build rich visual layouts without writing HTML; 14 block types supported: **Hero** (fullscreen banner with bg image/color, overlay, CTA button, text-align), **Features** (icon + title + text grid, 2/3/4 columns), **Text** (raw HTML/prose, max-width + alignment), **Image + Text** (side-by-side with optional CTA, left/right image toggle), **Gallery** (image grid with built-in lightbox, 2/3/4 columns), **Testimonials** (quote cards with avatar/author/role), **Call to Action** (headline + subtitle + button, optional bg color), **FAQ** (accordion with question/answer pairs), **Team** (member cards with photo/bio/role), **Pricing** (plan cards with feature lists, "Most Popular" highlight badge, CTA button), **Newsletter** (subscribe form wired to existing newsletter API), **Divider** (line, dots, or whitespace, 3 spacing sizes), **Spacer** (configurable height), **Embed** (raw HTML / iframes / scripts)
- **Admin block builder UI** — collapsible block rows with type icon + preview text + ↑↓ move buttons + delete; block type picker grid (click to add); each block expands to reveal a dedicated settings editor with all relevant fields; "Save Block" button per block; lives inside `PageEditView` below the rich text editor; only shown for saved pages (new pages prompt to save first); `PageBlocksBuilder.vue` component + 14 `block-editors/` sub-components
- **Frontend block renderer** — `BlockRenderer.vue` component loaded into `PageView`; fetches blocks via `GET /api/page-blocks?page_id=`; renders blocks in sequence; auto-hides page title when first block is a Hero; still renders classic TipTap content beneath blocks if both exist; Gallery has a built-in lightbox with prev/next navigation; FAQ items open/close with accordion; Newsletter block uses existing `/api/newsletter/subscribe`; fully responsive (all grids collapse to single column on mobile); Pricing plans show "Most Popular" badge with accent border
- **Backend** — `page_blocks` SQLite table (id, page_id FK → cascade delete, type, sort_order, settings JSON, timestamps); REST API at `GET/POST/PUT/DELETE /api/page-blocks` + `POST /api/page-blocks/reorder`; 14 block type defaults with full `settings` schema seeded on creation; `GET /api/page-blocks/types` convenience endpoint

### Phase 23 — Product Quick-View Modal + Low Stock Email Alerts ✅
- **Product Quick-View modal** — on the `/shop` listing page, every product card now has a 👁️ Quick View button (appears in the card footer alongside Wishlist and Quick-Add buttons); clicking it opens a full-featured overlay modal without leaving the page: displays the main product image + gallery thumbnails (clickable to swap main image), category, name, pricing (sale + original), excerpt, full variant picker (all groups with pill-style buttons, sold-out options disabled with strikethrough, price adjustments shown), stock status badge, quantity stepper, and an "Add to Cart" button with added feedback; pressing Escape or clicking the backdrop closes the modal; `document.body.scroll` is locked while open; "View full product page →" link takes to full `/shop/:slug` page; full mobile responsive (columns stack on narrow screens); smooth fade + scale transition animations; all using the same Pinia cart store and variant logic as the full product page
- **Low stock email alerts** — when an admin updates a product via `PUT /api/products/:id`, the backend checks if the stock quantity crosses a meaningful threshold and fires a non-blocking email alert to the configured `notify_email`: an **out-of-stock alert** (🚨) fires when stock transitions from above 0 to ≤ 0 (and backorders are not allowed); a **low-stock alert** (⚠️) fires when stock crosses below the product's `low_stock_threshold` for the first time; alerts only fire on state transitions (not repeatedly while already low/OOS); emails include the product name, current stock count, threshold, and a direct link to the admin edit page; `notifyLowStock()` helper added to `email.js`; requires SMTP to be configured in Settings

### Phase 22 — Abandoned Cart Recovery ✅
- **Abandoned cart tracking** — the frontend cart store (Pinia) automatically tracks every cart to the backend via a debounced `POST /api/abandoned-carts/track` (2s delay after each cart change); the session ID is a stable per-browser localStorage key; the record is enriched with the customer's email + name when they start typing on the checkout page (`updateContactInfo()`); on successful order placement the cart is marked recovered via `POST /api/abandoned-carts/recover`
- **Recovery email** — `POST /api/abandoned-carts/notify` (admin-only) sends a branded HTML email to one or many cart holders; email includes an item table, subtotal, and a direct "Complete My Order →" CTA button back to `/checkout`; each notification is timestamped (`notified_at`) and the `notified` flag is set to prevent accidental double-sends; uses existing SMTP settings from Settings panel; gracefully skips carts without an email address
- **Admin Abandoned Carts panel** (`/abandoned-carts`) — stats strip (total abandoned, emailed, recovered, lost revenue); filter bar (search by email/name, recovered/not recovered, notified/not notified, minimum idle age: 30 min / 1h / 3h / 24h); checkbox bulk-select with "Select All" and bulk "Send Recovery Email" button; per-row actions: 👁️ view cart items (detail modal), 📤 send single email, 🗑️ delete record; status pills (Recovered ✓, Emailed, Pending, No email); cart detail modal shows customer info, session ID, IP, timestamps, full item table with quantities and line totals; tooltips explain why email button is disabled (no address or already recovered); pagination (20 per page)
- **Dashboard integration** — new 🛒 Abandoned Carts stat card (highlights accent when any carts need attention); quick-action "🛒 Abandoned Carts" button; `GET /api/dashboard/stats` now returns `abandoned_carts: { count, revenue }`
- **Backend stats** — `GET /api/abandoned-carts/stats` returns total abandoned (1h+ idle), notified, recovered, and lost revenue totals; all lazy-purge of recovered carts is handled by checking `recovered = 0` in queries

### Phase 21 — Customer Accounts ✅
- **Customer registration & login** — dedicated `/api/customers/register` and `/api/customers/login` endpoints using a separate CUSTOMER_JWT_SECRET; 30-day JWTs; bcrypt password hashing; returns safe customer object + token on success
- **Customer profile management** — `GET/PUT /api/customers/me` lets customers view and update their name, phone, and password (current password required to change); email is read-only
- **Saved addresses** — full CRUD at `/api/customers/me/addresses`; unlimited addresses per customer; `is_default` flag (toggling default un-sets all others); label (Home/Work/etc.), full name, address lines, city, state, ZIP, country, phone
- **Order history** — `GET /api/customers/me/orders` returns all orders linked to the customer's account with parsed items JSON; `GET /api/customers/me/orders/:orderNumber` returns full detail; orders automatically linked at checkout when a customer JWT is present (`customer_id` FK added to `orders` table)
- **Auto-fill checkout** — `CheckoutView` detects a logged-in customer and pre-fills name, email, and phone; sends customer JWT with order so it's linked to their account
- **Account icon in SiteNav** — person icon added next to wishlist; links to `/account` if logged in (shows accent dot badge) or `/account/login` if not
- **Public frontend pages** — `AccountLoginView` (`/account/login`) — togglable sign-in / create account card with glass morphism; `AccountView` (`/account`) — full account dashboard with 3 tabs: **Orders** (card grid with status, items preview, total; click to open detail modal), **Addresses** (card grid with add/edit/delete and default badge; full address form modal), **Profile** (name/phone update + optional password change); redirects to login if not authenticated
- **My Account link on order confirmation** — "👤 My Account" button added to `OrderConfirmView` CTAs
- **Pinia customer store** — `stores/customer.js` with localStorage persistence; `isLoggedIn` computed; all API helpers; auto-logout on 401
- **Admin Customers panel** — `CustomersView.vue` — searchable table of all customers (name, email, order count, total spent, active status, join date); click any row for detail modal (profile info, saved addresses, order history); Disable/Enable toggle; Delete (detaches orders, keeps them); 🧑‍💼 Customers sidebar entry + Dashboard stat card
- **Backend** — `customers` + `customer_addresses` SQLite tables; `customer_id` migration column on `orders`; admin endpoints `GET/GET/:id/PUT/:id/DELETE/:id /api/customers` (admin-only via JWT); `customerAuthMiddleware` for customer-scoped routes; dashboard stats include `customers.total` + `customers.active`

### Phase 20 — Product Variants + Wishlist ✅
- **Product Variants** — admins can define unlimited variant groups per product (e.g. Size, Color) each with multiple options; each option has a label, optional price adjustment (±), SKU suffix, and per-option stock level (-1 = unlimited); variants are managed from the `ProductEditView` sidebar in a dedicated 🎛️ Variants section (appears after saving a new product); save/delete per group with instant feedback; backend `product_variants` + `product_variant_options` SQLite tables with full REST API at `GET /api/variants?product_id=`, `POST /api/variants`, `PUT /api/variants/:id`, `DELETE /api/variants/:id`; variants cascade-delete when the parent product is deleted
- **Variant picker on public product page** — `ProductView` loads variants via `/api/variants` on mount; renders each group as a row of pill-style buttons; selected option highlighted in accent; sold-out options disabled with strikethrough; price adjustments shown inline on buttons; if variants exist, user must select one per group before adding to cart (validation error shown otherwise); selected variant key + label + price adjustment stored on cart item
- **Cart variant support** — `cart.js` store updated: `addItem()` now accepts optional `variantInfo` param `{ key, label, price_adj }`; each cart item carries `cart_key` (e.g. `42:Size:Large|Color:Red`), `variant_label`, and variant-adjusted `unit_price`; `removeItem`/`updateQuantity` key on `cart_key`; `CartDrawer` displays variant label under item name and uses `cart_key` for quantity/remove ops; old single-variant carts gracefully fall back to product_id key
- **Wishlist** — Pinia `wishlist.js` store with localStorage persistence; `toggle(product)`, `isWishlisted(id)`, `remove(id)`, `clear()`, reactive `count`; `WishlistView` at `/wishlist` — responsive card grid of saved products with cover image, name, excerpt, price, "View Product" link, and "Add to Cart" button; filled ♥ button in top-right of each card removes from wishlist; empty state with shop link; `SiteNav` gains a heart icon with live badge count (turns accent red when active); heart ♡/♥ toggle buttons added to every product card in `ProductsView` and inline with the ATC row in `ProductView`

### Phase 19 — Product Reviews + Shipping at Checkout + Order Lookup ✅
- **Product Reviews on public frontend** — `ProductView` shows star-rating aggregate (avg score + 5-bar histogram by star count), a scrollable review list (author, date, star row, title, body), and a full "Write a Review" form with interactive star picker, name/email/title/body fields, and a post-submission confirmation; calls `GET /api/reviews?product_id=` for approved reviews with stats, and `POST /api/reviews` to submit (held pending until admin approves); review list and form loaded alongside product data on route mount
- **Shipping calculator at checkout** — `CheckoutView` now features a country dropdown (40 countries alphabetically sorted), fires `POST /api/shipping/calculate` when a country is chosen, and renders the returned zone rates as radio buttons (name + cost; threshold/free rates are resolved server-side); the selected rate's cost is added to `orderTotal`; if only one rate exists it is auto-selected; if no rates exist for the country a "contact us" notice is shown; `shipping_country`, `shipping_rate_name`, and `shipping_cost` are all included in the order payload; backend `orders.js` and `db.js` updated to accept + store the two new columns
- **Order Lookup page (`/order/lookup`)** — new public page with a glass card form (order number + email); calls `POST /api/orders/lookup` and displays a full order summary: status pill (color-coded per status), customer name, shipping address, order date, items table with thumbnail/qty/line-total, subtotal, discount, shipping cost, and grand total; "Track another order" button to reset; link added to `OrderConfirmView` CTAs and `SiteFooter` quick-links column
- **Admin Orders modal** — shipping country, rate name, and cost now displayed in the order detail panel (shows "Free" when cost = 0 and a country was selected)
- **Admin ShippingView bugfix** — removed broken `useSiteStore` import (admin panel has no site store); currency symbol is now loaded lazily via `GET /api/settings` on mount

### Phase 18 — E-Commerce Settings + Orders CSV Export + Inventory API ✅
- **E-Commerce settings section in admin Settings** — new 🛒 E-Commerce section with: currency code + symbol (used across checkout, order confirmation, admin panels), checkout intro text (displayed at top of `/checkout`), thank-you message (shown on order confirmation page), order confirmation email subject (`#{order_number}` placeholder), order status update email subject, and toggle checkboxes for "email admin on new order" and "email customer on status change"; all settings persisted via existing `PUT /api/settings` batch endpoint
- **Orders CSV export** — `GET /api/orders/export/csv` endpoint (admin, JWT-authenticated); supports `?status=`, `?from=` and `?to=` date filters; generates a properly escaped CSV with columns: order_number, status, customer_name, customer_email, customer_phone, shipping_address, subtotal, discount_amount, coupon_code, total, notes, created_at; admin Orders panel header gets an ⬇️ Export CSV button (respects current status filter, blob-downloads via fetch with auth header)
- **Inventory API** — `GET /api/products/inventory` endpoint (admin); returns `{ items, outOfStock, lowStock, healthy }` arrays for all products with `track_stock = 1`; items sorted by stock ascending; outOfStock = stock ≤ 0 + backorders disallowed; lowStock = stock within threshold; useful for integrations, webhooks, external inventory tooling
- **Backup enhancements** — `orders` and `coupons` tables now included in the full JSON backup export; stats endpoint now returns `orders` and `coupons` counts; BackupView labels updated to display all content types including events, orders, and coupons

### Phase 17 — Shopping Cart + Orders (E-commerce Checkout) ✅
- **Cart store** — Pinia store (`stores/cart.js`) with full localStorage persistence; `addItem`, `removeItem`, `updateQuantity`, `clear`; reactive `count` + `subtotal` computed; `isOpen` drawer state
- **CartDrawer** — slide-in drawer with glass morphism styling; per-item quantity stepper; remove button; subtotal + Checkout CTA; animated backdrop + panel transitions; empty state with shop link
- **Cart icon in SiteNav** — 🛒 button with live badge showing item count; opens/closes CartDrawer
- **Add to Cart on ProductView** — quantity selector (−/+, number input) + "Add to Cart" button; opens drawer on add; 2-second "✓ Added!" flash feedback
- **Quick-Add on ProductsView** — 🛒 button on every product card; green flash on add; does not navigate away
- **CheckoutView** (`/checkout`) — two-column layout (form + sticky order summary); customer name + email (validated) + phone + shipping address + notes; order summary panel with item thumbnails, qty, line totals, subtotal; calls `POST /api/orders` with server-side price validation; redirects to confirmation on success
- **OrderConfirmView** (`/order/:orderNumber`) — glassmorphism thank-you card; shows order number, items list, total, customizable thank-you message from CMS Settings; continue shopping CTA
- **Backend orders API** — `orders` SQLite table; `POST /api/orders` validates every item price against DB (fraud guard), generates `ORD-YYMMDD-XXXX` order number; `GET /api/orders` (admin, filterable by status/search); `GET /api/orders/:id` (admin); `GET /api/orders/confirm/:orderNumber` (public, limited fields); `PUT /api/orders/:id` (status + notes); `DELETE /api/orders/:id`; `GET /api/orders/stats/summary` (totals + revenue); rate-limited at 10 checkout attempts/hour
- **Admin Orders panel** — stats strip (total/pending/processing/completed); searchable + status-filtered table; click-row order detail modal (customer info grid, items table with thumbnails, status update dropdown, notes textarea, delete confirm); revenue display
- **Dashboard integration** — Orders stat card (highlights red when pending orders exist); Orders quick-action button; `orders.total/pending/revenue` in `/api/dashboard/stats`
- **Webhooks** — `order.created` and `order.status_changed` events registered
- **E-commerce settings** — `shop_currency`, `shop_currency_symbol`, `shop_checkout_intro`, `shop_thankyou_message`, `notify_new_order` seeded in default settings

### Phase 16 — Rate Limiting + API Keys + Content Locking ✅
- **Rate Limiting** — `express-rate-limit` added as a dependency; six purpose-built limiters applied to all public-facing mutation endpoints: auth/login (20/15 min, brute-force protection), contact form (5/hour), newsletter subscribe (3/hour), comments (10/hour), search (60/min), custom form submissions (5/hour); all limiters emit `RateLimit-*` standard headers (RFC 6585) and return structured JSON `{ error, message }` on 429; admin/API-key traffic bypasses public limits via `Authorization` header skip predicate
- **API Keys** — `api_keys` SQLite table (id, name, key_hash SHA-256, key_prefix for display, scopes JSON, created_by, last_used_at, active, created_at); full REST API at `GET/POST/PUT/DELETE /api/api-keys` + `POST /api/api-keys/:id/rotate`; two scopes: `read` (GET-only) and `write` (all methods); auth middleware updated to accept `X-Api-Key` header as an alternative to JWT Bearer — looks up + verifies hash, updates `last_used_at`, enforces scope per HTTP method; raw key shown **once** at creation (like GitHub PATs) — stored only as SHA-256 hash; key rotation generates a new raw key and invalidates the old one in one step; admin `ApiKeysView.vue` — table with prefix, scopes, last-used, active status pill; create modal with name + scope checkboxes; one-time reveal modal with click-to-copy; revoke toggle; rotate confirm modal; delete confirm; 🔑 API Keys sidebar entry; usage docs section (header syntax, scope definitions, rate limit note, security note)
- **Content Locking** — `content_locks` SQLite table (entity_type + entity_id composite PK, user_id, user_name, locked_at, expires_at); `GET/POST/DELETE /api/locks` REST API: `POST` acquires or refreshes a lock (5-minute TTL), returns `{ ok, conflict }` — if another user holds it, conflict includes their name + timestamp; `GET /:type/:id` checks current lock status; `DELETE /:type/:id` releases a lock (owner or admin only); stale locks are purged lazily on every request; `useContentLock.js` Vue composable — acquires lock on mount, refreshes every 4 minutes, releases on unmount (route-leave); `LockBanner.vue` component — amber glass banner showing "🔒 UserName is currently editing this content · since HH:MM"; banner wired into `PostEditView`, `PageEditView`, and `ProductEditView` for all existing-record edits

### Phase 15 — Events Calendar + Media Folders ✅
- **Events system** — full event content type: `events` SQLite table with title, slug, excerpt, TipTap description, cover image, start/end date, all-day toggle, location, venue, ticket URL, tags, status (draft/published), featured flag, SEO meta; `GET/POST/PUT/DELETE /api/events`; public `GET /api/events/upcoming` convenience endpoint; events integrated into sitemap.xml, search API, backup export/import, dashboard stats, webhook event types (`event.created/updated/published/deleted`), activity log, and analytics page-view tracking
- **Admin Events panel** — `EventsView` with filterable table (search, status, upcoming/past time filter), status toggle, delete confirm modal; `EventEditView` two-column editor (TipTap description, cover image via MediaPickerModal, start/end datetime pickers, all-day toggle, location/venue/ticket URL, tag pills, featured checkbox, SEO fields); 📆 Events entry in admin sidebar; Events stat card + "New Event" quick-action button in Dashboard
- **Public Events frontend** — `/events` listing page with Upcoming/Past/All tab filter, card grid with floating date badge (month/day), location, tags, and pagination; `/events/:slug` detail page with cover hero, date/time/location/ticket info cards, full TipTap rendered content, tags, social share buttons (X, LinkedIn, copy-link), SEO meta + OG tags via `useHead()`; Upcoming Events widget on homepage homepage (up to 3 events as a compact card row with date badge); Events included in `/search` results with 📆 label and start date/location; Events listed in sitemap
- **Media Folders** — new `media_folders` SQLite table (id, name, slug, parent_id, created_at); `folder_id` migration column added to `media` table; REST API at `GET/POST/PUT/DELETE /api/media-folders` + `POST /api/media-folders/move-media` (batch move items); `GET /api/media` supports `?folder_id=` filter for scoped queries; upload accepts `folder_id` in form data; `MediaView` admin panel redesigned with a collapsible **folder sidebar** (All Media + named folders with item counts, + button to create, right-click context menu to rename/delete), media items filtered by active folder, drag-and-drop move via detail panel folder selector; folders stat in dashboard
- **`@vueuse/head` bootstrap fix** — `createHead()` now properly installed in `frontend/src/main.js` so all `useHead()` composable calls (ProductView, EventView, EventsView) correctly update `<head>` meta tags; EventsView + EventView migrated from invalid template `<useHead>` component syntax to the composable API

### Phase 14 — Two-Factor Authentication + Notification Center + Bulk Operations ✅
- **Two-Factor Authentication (TOTP)** — `speakeasy` + `qrcode` libraries added; `totp_secret` + `totp_enabled` columns on `users` table; full API: `GET /api/auth/2fa/setup` generates a secret + QR code data URL, `POST /api/auth/2fa/enable` verifies the OTP and activates 2FA, `POST /api/auth/2fa/disable` deactivates (accepts current OTP or account password); login flow updated: if `totp_enabled` the backend returns HTTP 206 `{ requires_2fa: true }` after correct credentials; LoginView presents a second step with a large OTP input field and a back button; `SettingsView` → 🔑 Two-Factor Authentication section with QR code display + verification field + activate/disable flow; auth store `login()` accepts optional `otp` param
- **Admin Notification Center** — new `GET /api/notifications/count` (badge totals: pending comments, unread contact messages, unread form submissions) and `GET /api/notifications` (merged feed of up to 15 newest items across all three sources); `NotificationBell.vue` component in the new AdminLayout top bar shows a live badge that re-polls every 60 s, opens a glass dropdown with grouped item list (icon, title, excerpt, time-ago) plus per-type summary links; `NotificationsView.vue` full-page notifications center (3 summary cards + full feed) accessible via sidebar 🔔 Notifications entry; sidebar entry also shows a live unread badge (re-polls every 90 s)
- **Admin top bar** — AdminLayout now has a persistent header strip with current-page label, the notification bell, and a 🌐 "View site" shortcut button
- **Bulk operations backend** — `POST /api/posts/bulk`, `POST /api/pages/bulk`, `POST /api/products/bulk` endpoints (each accepts `{ ids[], action: publish|unpublish|delete }`); run in a single SQLite transaction; fire webhooks + log activity per item; admin list views (Posts, Pages, Products) already shipped checkboxes + bulk-action bar, now wired to real backend endpoints

### Phase 13 — SEO Analyzer + Webhook Manager ✅
- **SEO Analyzer** — live analysis panel in every post and page editor; shows a real-time Google SERP preview (title, URL, description formatted as Google would display them), character count progress bars for meta title (optimal 10–60 chars) and meta description (optimal 50–160 chars), a 9-point weighted checklist (meta title/desc present & right length, has slug, cover image, excerpt, ≥ 300 words of content, differentiated meta title), and a 0–100 score with Great / Needs work / Poor rating
- **Webhook Manager** — full webhook system: `webhooks` SQLite table; REST API at `GET/POST/PUT/DELETE /api/webhooks`; webhooks fire on 17 event types (`post.created`, `post.published`, `post.updated`, `post.deleted`, `page.*`, `product.*`, `comment.approved`, `form.submitted`, `subscriber.new`, `media.uploaded`, plus wildcard `*`); each delivery is signed with HMAC-SHA256 (`X-Pygmy-Signature: sha256=…`) when a secret is configured; 10-second timeout per delivery; last delivery timestamp + HTTP status + error stored per webhook; admin `WebhooksView` with active/inactive toggle, event badges, URL display, ✅ one-click test delivery button, add/edit modal with event multi-select checkboxes, delete confirm; 🔗 Webhooks sidebar entry added
- **Backend event wiring** — `fireWebhooks()` helper called from posts, pages, forms, and newsletter routes; runs asynchronously (non-blocking, fire-and-forget); scheduler auto-publishes scheduled content every 60s (already live since previous session)
- **Analytics dashboard** (previously code-complete, now fully documented) — `page_views` table tracks daily view counts per entity; `POST /api/analytics/view` (public, fire-and-forget); admin `AnalyticsView` shows summary cards (total/today/week/month), bar chart (filled zero-view days), top-10 pages table, content-type breakdown; PostView/PageView/ProductView auto-track on load; `/api/analytics/daily`, `/api/analytics/top`, `/api/analytics/summary` endpoints
- **Scheduled publishing** (previously code-complete, now fully documented) — `status = 'scheduled'` + `publish_at` / `published_at` on posts/pages/products; backend scheduler runs every 60s and auto-publishes due items; admin editors show a ⏰ Scheduled option + datetime picker; preview mode lets admins view drafts via `?preview_token=JWT` without publishing
- **Dashboard** — Webhooks quick-action button added; dashboard stats API now includes webhook count

### Phase 12 — Custom Form Builder + Maintenance Mode UI ✅
- **Custom Form Builder** — admins can create unlimited forms with 10 field types (text, email, phone, number, textarea, dropdown, radio buttons, checkbox, date, file upload); each field has label, name, placeholder, required toggle, and type-specific options (options list for select/radio, rows for textarea, checkbox text); fields are reordered with ↑/↓ arrows; form has name, slug, description, success message, email notification address, and active/inactive status
- **Form Submissions inbox** — every public submission is stored in `custom_form_submissions`; admin submissions view shows a paginated table with status cycling (unread → read → archived), a detail modal with all field values, and one-click CSV export per form; unread count badge on Dashboard and sidebar
- **Public form renderer** — `/forms/:slug` renders any active form on the public frontend with full client-side validation, server-side error handling, all 10 field types rendered natively, and a branded success screen using the form's custom success message
- **Embed code** — each form in the admin shows an embed modal with the direct URL and an `<iframe>` snippet for embedding on external pages
- **Maintenance Mode UI** — fixed the missing maintenance screen in the public frontend; `App.vue` now shows a full-page glassmorphism card with the CMS-configured maintenance message when `maintenance_mode = 1` in Settings (previously the backend returned 503 but the frontend had no visual)
- **Backend** — `custom_forms` + `custom_form_submissions` SQLite tables; `routes/forms.js` (GET list/single, POST create, PUT update, DELETE, POST submit, GET/PUT/DELETE submissions); mounted at `/api/forms`; active forms included in `sitemap.xml`; forms count/unread in dashboard stats; custom_forms included in JSON backup export
- **Dashboard** — 📋 Forms stat card with active count + unread submissions badge; Forms quick-action button

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

### Custom Forms
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/forms` | — | List active forms (public) |
| GET | `/api/forms?all=1` | ✓ | All forms with submission counts (admin) |
| GET | `/api/forms/:slug` | — | Single active form by slug |
| POST | `/api/forms` | ✓ | Create form |
| PUT | `/api/forms/:id` | ✓ | Update form |
| DELETE | `/api/forms/:id` | ✓ | Delete form (cascades submissions) |
| POST | `/api/forms/:slug/submit` | — | Submit a form (public) |
| GET | `/api/forms/:id/submissions` | ✓ | List submissions (`?status=&limit=&offset=`) |
| PUT | `/api/forms/:id/submissions/:subId` | ✓ | Update submission status |
| DELETE | `/api/forms/:id/submissions/:subId` | ✓ | Delete submission |

### Webhooks
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/webhooks` | ✓ | List all webhooks |
| GET | `/api/webhooks/events` | ✓ | List supported event names |
| POST | `/api/webhooks` | ✓ | Create webhook `{name, url, events[], secret?, active?}` |
| PUT | `/api/webhooks/:id` | ✓ | Update webhook |
| DELETE | `/api/webhooks/:id` | ✓ | Delete webhook |
| POST | `/api/webhooks/:id/test` | ✓ | Send a test delivery |

### Two-Factor Authentication
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/api/auth/2fa/setup` | ✓ | Generate TOTP secret + QR code data URL |
| POST | `/api/auth/2fa/enable` | ✓ | Verify OTP `{token}` and activate 2FA |
| POST | `/api/auth/2fa/disable` | ✓ | Disable 2FA `{token}` or `{password}` |

### Notifications
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications/count` | ✓ | Badge counts `{total, comments, contact, forms}` |
| GET | `/api/notifications` | ✓ | Merged feed of up to 15 unread items |

### Bulk Operations
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/posts/bulk` | ✓ | `{ids[], action: publish\|unpublish\|delete}` |
| POST | `/api/pages/bulk` | ✓ | `{ids[], action: publish\|unpublish\|delete}` |
| POST | `/api/products/bulk` | ✓ | `{ids[], action: publish\|unpublish\|delete}` |

### Events
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/events` | — | Published events (`?upcoming=1`, `?past=1`, `?tag=`, `?limit=`, `?offset=`) |
| GET | `/api/events?all=1` | ✓ | All events (admin) |
| GET | `/api/events/upcoming` | — | Up to N upcoming events (`?limit=3`) |
| GET | `/api/events/:slug` | — | Single event by slug |
| POST | `/api/events` | ✓ | Create event |
| PUT | `/api/events/:id` | ✓ | Update event |
| DELETE | `/api/events/:id` | ✓ | Delete event |

### Media Folders
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/media-folders` | ✓ | List all folders with `media_count` |
| POST | `/api/media-folders` | ✓ | Create folder `{name, parent_id?}` |
| PUT | `/api/media-folders/:id` | ✓ | Rename folder `{name}` |
| DELETE | `/api/media-folders/:id` | ✓ | Delete folder (media moved to root) |
| POST | `/api/media-folders/move-media` | ✓ | Move items `{media_ids[], folder_id}` |

### API Keys (admin only)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/api-keys` | admin | List all API keys (no raw key in response) |
| POST | `/api/api-keys` | admin | Create key `{name, scopes[]}` → returns raw key once |
| PUT | `/api/api-keys/:id` | admin | Update name/scopes/active |
| POST | `/api/api-keys/:id/rotate` | admin | Generate new raw key, invalidate old |
| DELETE | `/api/api-keys/:id` | admin | Delete key permanently |

### Content Locks
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/locks` | ✓ | List all active locks |
| GET | `/api/locks/:type/:id` | ✓ | Check if entity is locked by someone else |
| POST | `/api/locks` | ✓ | Acquire/refresh lock `{entity_type, entity_id}` |
| DELETE | `/api/locks/:type/:id` | ✓ | Release a lock |

### Page Blocks
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/page-blocks?page_id=` | — | List blocks for a page (ordered by sort_order) |
| GET | `/api/page-blocks/types` | — | List supported block type names |
| POST | `/api/page-blocks` | ✓ | Create block `{page_id, type, sort_order?, settings?}` |
| PUT | `/api/page-blocks/:id` | ✓ | Update block settings (merged patch) |
| POST | `/api/page-blocks/reorder` | ✓ | Reorder blocks `{page_id, order: [id…]}` |
| DELETE | `/api/page-blocks/:id` | ✓ | Delete a single block |
| DELETE | `/api/page-blocks?page_id=` | ✓ | Delete all blocks for a page |

### Orders
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/orders` | — | Place order (checkout, validates prices server-side; accepts `shipping_country`, `shipping_rate_name`, `shipping_cost`) |
| GET  | `/api/orders` | ✓ | List orders (`?status=`, `?q=`, `?limit=`, `?offset=`) |
| GET  | `/api/orders/stats/summary` | ✓ | Revenue + status counts |
| GET  | `/api/orders/export/csv` | ✓ | CSV export (`?status=`, `?from=`, `?to=` filters) |
| GET  | `/api/orders/:id` | ✓ | Single order detail (admin) |
| GET  | `/api/orders/confirm/:orderNumber` | — | Public order confirmation (limited fields) |
| POST | `/api/orders/lookup` | — | Public order tracking `{order_number, email}` |
| PUT  | `/api/orders/:id` | ✓ | Update status / notes |
| DELETE | `/api/orders/:id` | ✓ | Delete order |

### Inventory
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/products/inventory` | ✓ | Stock report: `{ items, outOfStock, lowStock, healthy }` for all tracked products |

### Product Variants
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/variants?product_id=` | — | List variant groups + options for a product |
| POST | `/api/variants` | ✓ | Create variant group `{product_id, name, options[]}` |
| PUT | `/api/variants/:id` | ✓ | Update variant group (full replace of options) |
| DELETE | `/api/variants/:id` | ✓ | Delete variant group (cascades options) |

### Customer Accounts
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/customers/register` | — | Register `{email, password, first_name?, last_name?, phone?}` → `{token, customer}` |
| POST | `/api/customers/login` | — | Login `{email, password}` → `{token, customer}` |
| GET  | `/api/customers/me` | customer JWT | Get own profile |
| PUT  | `/api/customers/me` | customer JWT | Update profile (name, phone, password) |
| GET  | `/api/customers/me/orders` | customer JWT | Own order history |
| GET  | `/api/customers/me/orders/:orderNumber` | customer JWT | Single order detail |
| GET  | `/api/customers/me/addresses` | customer JWT | List saved addresses |
| POST | `/api/customers/me/addresses` | customer JWT | Add address |
| PUT  | `/api/customers/me/addresses/:id` | customer JWT | Update address |
| DELETE | `/api/customers/me/addresses/:id` | customer JWT | Delete address |
| GET | `/api/customers` | admin | List all customers with order stats |
| GET | `/api/customers/:id` | admin | Customer detail + addresses + orders |
| PUT | `/api/customers/:id` | admin | Toggle `active` status |
| DELETE | `/api/customers/:id` | admin | Delete customer (orders unlinked) |

### Abandoned Carts
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/abandoned-carts/track` | — | Track/update cart `{session_id, email?, name?, items[], subtotal}` |
| POST | `/api/abandoned-carts/recover` | — | Mark cart recovered `{session_id}` |
| GET  | `/api/abandoned-carts` | ✓ | List abandoned carts (`?q=`, `?recovered=`, `?notified=`, `?hours_old=`, `?limit=`, `?offset=`) |
| GET  | `/api/abandoned-carts/stats` | ✓ | Stats: `{total, notified, recovered, revenue}` |
| POST | `/api/abandoned-carts/notify` | ✓ | Send recovery emails `{ids[]}` → `{sent, skipped}` |
| DELETE | `/api/abandoned-carts/:id` | ✓ | Delete cart record |

### SEO (public)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/sitemap.xml` | XML sitemap of all published pages + posts + active forms |
| GET | `/feed.xml` | RSS 2.0 feed of latest 20 posts |
| GET | `/robots.txt` | Robots exclusion file (managed via Settings) |

### Tax Rates (Phase 25)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET    | `/api/tax-rates` | ✓ | List all tax rates (admin) |
| POST   | `/api/tax-rates` | ✓ | Create rate `{name, country, state?, rate, inclusive?, priority?, active?}` |
| PUT    | `/api/tax-rates/:id` | ✓ | Update rate |
| DELETE | `/api/tax-rates/:id` | ✓ | Delete rate |
| POST   | `/api/tax-rates/calculate` | — | Calculate tax `{country, subtotal}` → `{tax_amount, rate, name, applicable_rate}` |

### Loyalty Points (Phase 25)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/api/loyalty/balance` | customer JWT | Balance + worth + settings |
| GET  | `/api/loyalty/transactions` | customer JWT | Transaction history (last 50) |
| POST | `/api/loyalty/redeem` | customer JWT | Validate redemption `{points}` → `{discount, points_used}` |
| GET  | `/api/loyalty/admin/customers` | ✓ | Customers with points balances |
| POST | `/api/loyalty/admin/adjust` | ✓ | Manual adjustment `{customer_id, points, note}` |
| GET  | `/api/loyalty/admin/transactions/:customer_id` | ✓ | Last 10 transactions for a customer |

### Digital Downloads (Phase 27)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET    | `/api/digital-downloads/files?product_id=` | ✓ | List files for a product |
| POST   | `/api/digital-downloads/files` | ✓ | Upload file (multipart, `product_id`, `label`, `download_limit?`, `expires_days?`) |
| PUT    | `/api/digital-downloads/files/:id` | ✓ | Update file metadata |
| DELETE | `/api/digital-downloads/files/:id` | ✓ | Delete file + disk entry |
| GET    | `/api/digital-downloads/tokens?product_id=` | ✓ | List download tokens |
| GET    | `/api/digital-downloads/admin/overview` | ✓ | Stats: digital products, files, active tokens, total downloads |
| POST   | `/api/digital-downloads/issue` | ✓ | Manually issue tokens `{order_id, customer_email}` |
| POST   | `/api/digital-downloads/order-links` | — | Get file links by `{order_number, email}` |
| GET    | `/api/digital-downloads/:token` | — | Stream download file (verifies expiry + limit) |

### Product CSV (Phase 27)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/api/products/export/csv` | ✓ | Export all products as CSV |
| POST | `/api/products/import/csv` | ✓ | Import products from CSV (multipart `file`; `mode=merge\|replace`) |

### Subscriptions & Memberships (Phase 27)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET  | `/api/subscriptions/plans` | — / ✓ | List plans (public shows active only; auth shows all) |
| POST | `/api/subscriptions/plans` | ✓ | Create plan |
| PUT  | `/api/subscriptions/plans/:id` | ✓ | Update plan |
| DELETE | `/api/subscriptions/plans/:id` | ✓ | Delete plan (blocked if active members) |
| GET  | `/api/subscriptions/members` | ✓ | List members (`?q=`, `?status=`, `?plan_id=`, `?limit=`, `?offset=`) |
| POST | `/api/subscriptions/members` | ✓ | Grant subscription `{customer_id, plan_id, trial_days?, notes?}` |
| PUT  | `/api/subscriptions/members/:id` | ✓ | Update member `{status, cancel_at_end, notes, current_period_end}` |
| DELETE | `/api/subscriptions/members/:id` | ✓ | Delete member subscription |
| GET  | `/api/subscriptions/stats` | ✓ | Active, trialing, cancelled counts + MRR |
| GET  | `/api/subscriptions/me` | customer JWT | Own subscription info |
| POST | `/api/subscriptions/cancel` | customer JWT | Schedule cancellation at period end |
| POST | `/api/subscriptions/reactivate` | customer JWT | Remove cancel-at-end flag |
| GET  | `/api/subscriptions/revenue?days=N` | ✓ | Revenue report (daily series, top products/customers, summary) |
| GET  | `/api/subscriptions/revenue/export?days=N` | ✓ | Revenue report as CSV |

### A/B Testing (Phase 34)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET    | `/api/ab-tests` | ✓ | List all tests with impression/conversion counts (`?status=`) |
| GET    | `/api/ab-tests/:id` | ✓ | Test detail with per-variant stats |
| POST   | `/api/ab-tests` | ✓ | Create test `{name, entity_type, entity_id?, split, goal, goal_selector?, variants[]}` |
| PUT    | `/api/ab-tests/:id` | ✓ | Update test (name, split, status, winner, …) |
| DELETE | `/api/ab-tests/:id` | ✓ | Delete test and all impression data |
| PUT    | `/api/ab-tests/:id/variants/:vid` | ✓ | Update variant name/changes |
| GET    | `/api/ab-tests/active` | — | Running tests for entity (`?entity_type=&entity_id=`) |
| POST   | `/api/ab-tests/:id/assign` | — | Assign session to variant `{session_id}` → `{variant_id, label, changes}` |
| POST   | `/api/ab-tests/:id/convert` | — | Record conversion `{session_id}` |

### Email Sequences (Phase 35)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET    | `/api/email-sequences` | ✓ | List all sequences with counts |
| POST   | `/api/email-sequences` | ✓ | Create sequence |
| GET    | `/api/email-sequences/stats` | ✓ | Overview stats |
| GET    | `/api/email-sequences/:id` | ✓ | Sequence detail + steps |
| PUT    | `/api/email-sequences/:id` | ✓ | Update sequence |
| PUT    | `/api/email-sequences/:id/status` | ✓ | Change status `{status: draft|active|paused}` |
| DELETE | `/api/email-sequences/:id` | ✓ | Delete sequence |
| GET    | `/api/email-sequences/:id/steps` | ✓ | List steps |
| POST   | `/api/email-sequences/:id/steps` | ✓ | Add step `{subject, body, delay_days, delay_hours}` |
| PUT    | `/api/email-sequences/:id/steps/:sid` | ✓ | Update step |
| DELETE | `/api/email-sequences/:id/steps/:sid` | ✓ | Delete step (auto-renumbers) |
| POST   | `/api/email-sequences/:id/steps/reorder` | ✓ | Reorder steps `{order: [id…]}` |
| GET    | `/api/email-sequences/:id/enrollments` | ✓ | List enrollments (`?status=`, `?limit=`, `?offset=`) |
| POST   | `/api/email-sequences/:id/enroll` | ✓ | Enroll `{emails: [{email, name?}]}` |
| DELETE | `/api/email-sequences/:id/enrollments/:eid` | ✓ | Remove enrollment |
| POST   | `/api/email-sequences/process` | ✓ | Manually trigger due email processing |

### Customer Segments (Phase 35)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET    | `/api/customer-segments` | ✓ | List all segments |
| POST   | `/api/customer-segments` | ✓ | Create segment `{name, conditions[], dynamic?}` |
| GET    | `/api/customer-segments/:id` | ✓ | Segment + conditions + member preview |
| PUT    | `/api/customer-segments/:id` | ✓ | Update segment |
| DELETE | `/api/customer-segments/:id` | ✓ | Delete segment |
| POST   | `/api/customer-segments/:id/evaluate` | ✓ | Re-evaluate dynamic membership |
| POST   | `/api/customer-segments/:id/enroll` | ✓ | Enroll all members into sequence `{sequence_id}` |

### Search Analytics (Phase 34)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/search-analytics/track` | — | Track a search `{query, results_count, session_id?}` |
| POST | `/api/search-analytics/click` | — | Record result click `{query, slug, type, session_id?}` |
| GET  | `/api/search-analytics/suggestions?q=` | — | Autocomplete suggestions from historical queries with results |
| GET  | `/api/search-analytics/summary?days=` | ✓ | Summary: total, unique, CTR%, zero-result rate |
| GET  | `/api/search-analytics/top?days=&limit=` | ✓ | Top queries by search frequency |
| GET  | `/api/search-analytics/zero-results?days=` | ✓ | Queries with zero results (content creation hints) |
| GET  | `/api/search-analytics/daily?days=` | ✓ | Daily search volume (gap-filled) |
| GET  | `/api/search-analytics/clicks?days=` | ✓ | Most clicked search results |
