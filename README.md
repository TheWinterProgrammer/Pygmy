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
    CharityView.vue     ← charity campaigns + donation tracking
    PreordersView.vue   ← preorder-enabled products management
    OrderShipmentsView.vue ← per-order multi-shipment tracking
    StockHistoryView.vue ← global stock change audit log
    OrderTagsView.vue   ← order tag management + filtering
    AiContentView.vue   ← AI content generation (descriptions, SEO, blog excerpts)
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

### Phase 64 — Public Survey Pages + Referral Program Page + Frontend Funnel & Heatmap Tracking ✅
- **Public Survey Pages** — new `/surveys/:slug` frontend page; fetches active survey from `GET /api/surveys/public/:slug`; renders all 8 question types natively: **text** (input), **textarea** (multi-line), **rating** (interactive 5-star selector), **NPS** (0–10 pill buttons colored detractor/passive/promoter), **radio** (option list with glass pill cards), **checkbox** (multi-select with toggleable pill cards), **dropdown** (native select), **date** (date input), **scale** (range slider 1–10 with live value display); progress bar shows current question position (when `show_progress = 1`); client-side required field validation with per-question error highlighting; stable respondent ID in localStorage for deduplication; `allow_multiple` setting respected — shows "Already submitted" screen if respondent re-visits; custom success message from CMS shown on submission; admin **SurveysView** gains a 🌐 Preview button per active survey linking to the live public URL; routes added to frontend router
- **Referral Program Public Page** (`/referral`) — full customer-facing referral dashboard: hero section with program description and reward amount from settings; "How it works" 3-step explainer (get link → share → earn); **for logged-in customers**: stats cards (friends referred, total credit earned, reward per referral), unique referral link with copy-to-clipboard button, social sharing buttons (X/Twitter, WhatsApp, Email with pre-filled templates); recent referral events table (date, event type, credit amount); **for guests**: sign-in prompt with account creation CTA; referral terms section (minimum order amount, eligibility notes); fetches referral data from `GET /api/referral/my-code` with customer JWT; "🤝 Refer a Friend" link in SiteFooter when `referral_enabled = 1`
- **Frontend Funnel Tracking** — new `composables/useTracking.js` module; `trackFunnelEvent(eventType, opts)` sends events to `POST /api/funnel/event` (fire-and-forget, errors ignored); stable per-browser session ID from localStorage (`pygmy_session_id`); **wired to 4 funnel stages**: `product_view` on `ProductView` mount (after product load), `add_to_cart` on "Add to Cart" button click in `ProductView`, `checkout_start` on `CheckoutView` mount, `order_placed` on `OrderConfirmView` mount (includes `order_number` + `value`); funnel data visible in admin 🔭 Sales Funnel Analytics view
- **Frontend Click Heatmap Tracking** — `installHeatmapTracker()` in `useTracking.js` installs a document-level click listener that records click coordinates as % of viewport width and page height to `POST /api/heatmap/click`; installed once per page load from `App.vue` when `heatmap_enabled = '1'` in site settings; includes viewport dimensions and session ID; heatmap click data visible in admin 🔥 Click Heatmaps view

### Phase 63 — Cookie Consent Manager + Sales Funnel Analytics + Click Heatmaps ✅
- **Cookie Consent Manager** — full GDPR-compliant cookie consent system; `cookie_consents` SQLite table (session_id, IP, categories JSON, timestamps); admin **CookieConsentView** — consent stats (total consents, accepted all, rejected all, partial), consent rate over time, category breakdown (analytics/marketing/preferences); `GET/POST /api/cookie-consent`; `GET /api/cookie-consent/config` returns banner settings; 15 settings keys seeded: `cookie_consent_enabled`, position (bottom/bottom-left/bottom-right), title, message, button labels (accept/reject/manage), category toggles, privacy/cookie policy URLs, expiry days; `CookieBanner.vue` frontend component (already mounted in `App.vue`) reads config from settings and renders consent banner; `CookieConsent.vue` alternate detailed component with category-level toggles; 🍪 Cookie Consent sidebar entry
- **Sales Funnel Analytics** — conversion funnel tracker from product view to order; `funnel_events` SQLite table (event_type: product_view/add_to_cart/checkout_start/order_placed, product_id, product_slug, session_id, order_number, value, timestamp); `POST /api/funnel/event` public endpoint; `GET /api/funnel/summary` returns overall funnel conversion rates (stage-by-stage counts + %, drop-off at each step); `GET /api/funnel/by-product?days=` returns per-product funnel breakdown (views/cart adds/orders, conversion rates); `GET /api/funnel/daily?days=` daily funnel event volume; admin **FunnelView** — 4-step funnel visualization (Product Views → Add to Cart → Checkout Started → Orders Placed) with stage counts, conversion rates between adjacent stages, and drop-off percentages; daily line chart (event volume by day); Top Products table with per-product view-to-cart and cart-to-order conversion rates; 🔭 Sales Funnel sidebar entry
- **Click Heatmap Tracker** — visitor click coordinate recording for UX analysis; `heatmap_clicks` SQLite table (page_path, x_pct, y_pct as % of viewport/page, viewport dimensions, session_id, timestamp); `POST /api/heatmap/click` public endpoint (fire-and-forget, no response body); configurable `heatmap_sample_rate` setting (default 100% — reduce for high-traffic sites); admin **HeatmapView** — page selector dropdown (all pages that have click data); grid-based heatmap visualization (20×20 cell grid normalized across viewport); cell intensity colored from cool (low) to hot (high) clicks; stats strip (total pages tracked, total clicks, most clicked page); top click zones list per page; period selector (7/14/30/60 days); 🔥 Click Heatmaps sidebar entry

### Phase 62 — Store Locator + Shared Wishlists + Media Image Editor ✅
- **Store Locator** — full physical store/location management system; `store_locations` SQLite table with name, slug, address fields, city/state/zip/country, phone, email, website, latitude/longitude, Google Maps embed HTML, opening hours (JSON key-value dict), description, cover image, type (store/warehouse/showroom/popup/partner), featured flag, active toggle, sort order; `GET/POST/PUT/DELETE /api/store-locator`; `GET /api/store-locator/stats` returns total/active/by-type breakdown; admin **StoreLocatorView** — 3-stat strip (total, active, per-type counts), search by name/city/address, type filter, active filter, locations card grid (cover image or emoji placeholder, type badge, featured star, address/phone/email, opening hours pill display, edit/delete actions); create/edit modal with all fields including a plaintext `Mon-Fri: 9:00–18:00` format hours textarea (auto-parsed to/from JSON); public `/stores` page — hero with configurable title/subtitle, search bar with type filter, responsive card grid showing cover image, type badge, full address, phone/email links, opening hours table (closed days highlighted red), "Get Directions" link (opens Google Maps with coordinates), website link, and optional embedded map iframe; 📍 Store Locator sidebar entry; `store_locator_enabled`, `store_locator_title`, `store_locator_subtitle` settings; Settings → 📍 Store Locator section with toggle + title/subtitle fields; "📍 Store Locator" link in `SiteFooter` when enabled
- **Shared Wishlists** — logged-in customers can generate a public shareable URL for their wishlist; `shared_wishlists` SQLite table (customer_id FK, share_code 16-char hex, name, public flag, created_at); `GET /api/wishlists/me/shared` returns own shared wishlist; `POST /api/wishlists/me/share` creates or updates the shared wishlist (idempotent — one share per customer); `DELETE /api/wishlists/me/shared` removes the share; `GET /api/wishlists/shared/:code` public endpoint returns the wishlist name, owner first name, and published product items for any valid public share code; **WishlistView** updated — "Share your wishlist" glass card appears for logged-in customers with items: shows "Create Public Link" button (calls POST on click), then displays the shareable URL with a "Copy Link" button and "Remove" button once created; public **SharedWishlistView** (`/wishlist/shared/:code`) — hero card with wishlist name + owner name + item count, responsive products grid (cover image, category, name, pricing with sale badge, stock status, "View Product →" CTA per card), social share + copy link buttons; `shared_wishlists_enabled` setting; Settings → 💝 Shared Wishlists section with enable toggle
- **Media Image Editor** — canvas-based inline image editor in the admin Media Library detail panel; clicking "🖊️ Edit Image" (shown only for non-SVG images) opens a full modal with the image rendered on an HTML5 `<canvas>`; tools: **Rotate** left/right 90° (updates canvas dimensions correctly for portrait↔landscape), **Flip** horizontal/vertical (uses `ctx.scale`), **Brightness** slider (0–200%, default 100), **Contrast** slider (0–200%, default 100); all transforms compose via `ctx.save`/`ctx.restore` + `ctx.filter`; "Reset" button returns all transforms to defaults; "💾 Save & Replace" exports the canvas as a JPEG/PNG blob (matching original MIME type at 92% quality), uploads it as a new media item via `POST /api/media`, prepends it to the media grid, and selects it; editor closes after save; covers image loaded with `crossOrigin="anonymous"` and cache-busting `?t=` timestamp to avoid CORS taint

### Phase 61 — Bulk Price Editor + Customer Activity Timeline + 404 Error Tracker + Order Print View ✅
- **Bulk Price Editor** — admin **BulkPriceView** at `/bulk-price`; lets admins select multiple products via checkbox and apply bulk price changes in one action; filter by search term and category; 3 update modes: **Set Price** (exact value), **Adjust by %** (positive = increase, negative = decrease), **Adjust by Amount** (€ delta); applies to regular price and/or sale price; preview table shows current prices + calculated new prices before confirming; "Apply to Selected (N)" button submits all updates in one API call; `GET /api/bulk-price/products` (paginated product list with pricing), `PUT /api/bulk-price/apply` (batch update accepting `[{id, price?, sale_price?}]`); 💰 Bulk Price Editor sidebar entry
- **Customer Activity Timeline** — admin **CustomerTimelineView** at `/customer-timeline`; search customers by email/name; select a customer to load their full chronological activity timeline; events pulled from multiple tables: registration, all orders (status + total + coupon), loyalty transactions (earn/redeem/adjust), newsletter subscription, support tickets, review submissions, booking appointments, wishlist adds, form submissions, and order timeline entries; each event has an icon, label, description, and timestamp; events sorted oldest→newest with a vertical timeline UI; click any order number to deep-link to the order; ⏱️ Customer Timeline sidebar entry
- **404 Error Log Tracker** — middleware in `index.js` logs every non-API 404 to the `error_logs` table (path, method, status_code, referrer, user_agent, IP, resolved flag, redirect_to, created_at); duplicate suppression (same path + IP within 5 min is skipped); admin **ErrorLogsView** at `/error-logs` — summary stat cards (total, unresolved, today, top path), period selector (7/30/60/90 days), table with path, method badge, referrer, IP, time-ago, resolved toggle, "Create Redirect" quick-action (pre-fills Redirect Manager with the 404 path); `GET /api/error-logs` (paginated, search, period, resolved filter), `GET /api/error-logs/summary` (stats), `PUT /api/error-logs/:id` (toggle resolved + set redirect_to), `DELETE /api/error-logs/:id`, `DELETE /api/error-logs/clear/resolved`, `DELETE /api/error-logs/clear/old` (purge 90d+); `POST /api/error-logs` (public, from frontend `NotFoundView`); 🚫 404 Error Tracker sidebar entry
- **Order Print View** — browser-printable per-order detail page; `GET /api/order-print/:orderNumber` (admin JWT via `?token=` param); renders a full-page print-optimized HTML document: site logo + site name header, order number + date + status badge, billing address + order summary table (product name, qty, unit price, line total), subtotal/shipping/discount/tax/total rows, order notes + customer notes, store contact footer; fully print-optimized CSS (`@media print` hides non-print elements); admin **OrdersView** gains a 🖨️ Print button in the order detail modal (opens in new tab with `?token=JWT`); available for all order statuses
- **Bundle Deals section on Homepage** — `HomeView` fetches `GET /api/bundles?featured=1&limit=4` and renders a "🪄 Bundle Deals" section with bundle cards (cover image/emoji, name, description, original price → bundle price with savings %, item pills); links to `/shop/bundles/:slug`; hidden when no featured bundles; "All Bundle Deals →" link to `/shop/bundles`
- **Sitemap Ping** — `POST /api/sitemap-ping` (publicly accessible) pings Google and Bing with the site's sitemap URL; returns results per search engine with HTTP status; records last ping timestamp in settings (`last_sitemap_ping`)

### Phase 60 — IP Blocklist + Site Audit + Media Alt Text Manager ✅
- **IP Blocklist** — admin-controlled IP banning system to block malicious IPs, bots, and scrapers; `ip_blocklist` SQLite table with pattern, type (exact/CIDR/wildcard), note, active flag, and hit counter; Express middleware (`isIpBlocked()`) checks every incoming request against active blocklist entries — exact IP match, CIDR range check (`ipInCidr()` bit masking), or wildcard pattern match (e.g. `192.168.*`); blocked requests receive HTTP 403 `{ error: 'Access denied' }`; auth/admin routes are exempt from blocking so admins can always access; hit counter incremented asynchronously for stats; admin **IpBlocklistView** — 3-stat strip (total, active, total hits), search + active filter, table with monospace pattern display, type-colored badges (exact=blue, cidr=orange, wildcard=purple), hit count, active toggle, ✏️ edit + 🗑️ delete per row; add/edit modal with pattern input, type selector, note, active checkbox; `POST /api/ip-blocklist/check` public endpoint returns whether calling IP is blocked; `GET/POST/PUT/DELETE /api/ip-blocklist`; `POST /:id/toggle`; `ip_blocklist_enabled` setting; 🛡️ IP Blocklist sidebar entry + Dashboard quick-action
- **Site Audit** — comprehensive SEO and content health scanner; admin **SiteAuditView** with 4 summary cards (total content, missing alt text, missing meta titles, missing cover images) + 3-tab view; **SEO Issues tab** scans all published posts/pages/products and reports: missing meta title, meta title too long (>60 chars), missing meta description, meta desc too long (>160 chars), missing excerpt, missing cover image, thin content (<300 words); each issue carries a severity (error/warning/info) and items are listed as expandable cards with entity type badge, title link, and colored issue pills; **Alt Text tab** shows a coverage progress bar (% of images with alt text), then a grid of all images missing alt text with filename, size/dimensions, and an inline alt text input + Save button; filling all and clicking "Save All" bulk-submits updates; **Duplicates tab** shows any duplicate slugs across posts/pages/products; `GET /api/site-audit/seo`, `/media`, `/duplicates`, `/summary` endpoints; "🔄 Run Audit" re-runs all checks simultaneously; 🔍 Site Audit sidebar entry + Dashboard quick-action
- **Media Alt Text Manager** — dedicated bulk alt text editing view for all site images; admin **MediaAltView** with stats bar (total images, % with alt text coverage progress bar), search by filename/alt text, "Missing Only" filter toggle; card grid shows each image with thumbnail, filename, size × dimensions, a textarea for alt text (character counter with warning at 125+), per-image Save button, and visual saved/missing badges; "Save All" button bulk-submits all filled-in alt values in one API call; pagination (24 per page); `GET /api/media-alt` (paginated with search/missing filter), `PUT /api/media-alt/:id`, `POST /api/media-alt/bulk` endpoints; 🖼️ Media Alt Text sidebar entry + Dashboard quick-action
- **Bug fix** — `PUT /api/orders/:id` route handler was not declared `async` but contained `await import('../email.js')` for custom order status emails (added in Phase 59); fixed by adding `async` to the route handler

### Phase 59 — NPS Surveys + Customer Tags + Custom Order Statuses ✅
- **NPS Surveys** — create/publish surveys with multiple question types (text, rating, NPS, radio, checkbox, dropdown, date, scale); survey builder admin panel (SurveysView); public survey page at /surveys/:slug; response collection with per-respondent deduplication; stats endpoint; survey_enabled setting
- **Customer Tags** — tag customers with colored labels; customer_tag_definitions + customer_tag_assignments tables; full CRUD at GET/POST/PUT/DELETE /api/customer-tags; bulk assignment via customer detail; CustomerTagsView admin panel with tag creation, color picker, usage counts, customer list per tag; CustomerTagsView sidebar entry
- **Custom Order Statuses** — define custom workflow statuses beyond the defaults; custom_order_statuses table with slug/name/color/description/sort/active/notify_customer/email templates; CRUD at GET/POST/PUT/DELETE /api/order-statuses; admin OrderStatusesView with color-coded status pills, enable/disable toggle, notify customer flag, email template per status; status changes from order detail modal now include custom statuses

### Phase 58 — Geo Analytics + Product Specs + Scheduled Reports ✅
- **Geo Analytics** — page view tracking by country/region: admin GeoAnalyticsView shows world map data, top countries by visits, sessions breakdown; GET /api/geo-analytics endpoints for summary/countries/regions/map data; IP-to-country lookup via ip-api.com; geo_analytics_enabled setting
- **Product Specifications** — key-value attribute tables per product with group support: full CRUD at GET/POST/PUT/DELETE /api/product-specs; admin ProductEditView sidebar gains Specifications section with group name, label, value, sort order; public ProductView renders grouped specs table below description
- **Scheduled Email Reports** — automated periodic summary emails: scheduled_reports SQLite table with frequency (daily/weekly/monthly), recipients, report_types (orders/revenue/inventory/customers); background processor runs every 15 min, fires sendMailTo for due reports; admin ScheduledReportsView — create/edit/toggle reports, track last/next send; GET/POST/PUT/DELETE /api/scheduled-reports

### Phase 55 — Loyalty Tier Progress + Server Wishlist Sync + Customer Order Notes + Activity CSV Export ✅
- **Loyalty Tier Progress in AccountView** — the Points tab in the customer account now shows a full loyalty tier experience: a tier card displaying the customer's current tier (icon, name, color badge), their points balance, and a list of tier perks; a progress bar shows how far along they are toward the next tier with a "X points to go" label; a tier roadmap strip shows all tiers with their minimum point thresholds and earn multipliers (grayed out if not reached); tiers are fetched from the new `GET /api/loyalty/tier` customer endpoint which resolves the customer's current tier, next tier, and progress percentage from all active loyalty tiers sorted by `min_points`; the balance card adapts to a compact horizontal layout when tiers are enabled; tiers_enabled check respects the `loyalty_tiers_enabled` setting
- **Server-side Wishlist Sync** — `WishlistView` now fetches the customer's server-side wishlist from `GET /api/wishlists/me` (customer JWT) on mount when logged in; logged-in users see their synced cloud wishlist (with a ☁️ Synced badge) instead of local-only localStorage items; removing items calls `DELETE /api/wishlists/me/:productId` on the server and removes from local store simultaneously; the existing wishlists route already had full CRUD including the delete endpoint; guests continue to use the localStorage-backed Pinia wishlist store as before
- **Customer Order Notes** — customers can now add a note to any pending/processing order directly from the Order Lookup page (`/order/lookup`); a 📝 "Add a Note to This Order" button appears below the cancel section for non-terminal orders; clicking opens a textarea form; submission calls `POST /api/orders/customer-note` with `{order_number, email, note}` — the note is appended to the order's notes field with a `[Customer, date]: text` prefix to distinguish it from admin notes; the event is also logged to the `order_timeline` table; hidden for cancelled and refunded orders; `POST /api/orders/timeline-lookup` companion endpoint returns the full timeline for a given order (by order number + email) for future customer timeline display
- **Activity Log CSV Export** — the Activity Log admin view (`/activity-log`) now has a ⬇️ Export CSV button in the header; clicking it fetches `GET /api/activity/export/csv` (admin JWT, up to 5000 rows) with the currently active search/entity_type/action filters applied; downloads as `activity-log-YYYY-MM-DD.csv` with columns: id, user_name, action, entity_type, entity_id, entity_title, created_at; from/to date filter params also supported by the backend route for custom date range exports

### Phase 54 — AI Content Helper + Preorders + Order Multi-Shipments + Stock History + Charity Campaigns + Order Tags ✅
- **AI Content Helper** — admin **AiContentView** at `/ai-content`; integrates with any OpenAI-compatible API (configurable URL, key, model in Settings → 🤖 AI Content); status banner shows configured model or prompts admin to configure; 5 tool tabs: **Product Description** (product name + keywords + tone → full HTML description), **Blog Excerpt** (title + topic → 2–3 sentence excerpt), **SEO Meta Tags** (page title + description → optimized meta title + description pair), **Title Ideas** (topic + count → numbered idea list), **Custom Prompt** (freeform textarea → AI response); all tools have a generate button, loading state, error handling, and a copy-to-clipboard button on results; `POST /api/ai/generate` generic endpoint + 5 purpose-built shortcuts: `POST /api/ai/product-description`, `POST /api/ai/blog-excerpt`, `POST /api/ai/seo-meta`, `POST /api/ai/title-ideas`, `POST /api/ai/custom`; `GET /api/ai/status` returns configured status; settings seeded: `ai_api_url`, `ai_api_key`, `ai_model`; 🤖 AI Content sidebar entry
- **Preorders** — products can be pre-order enabled via `preorder_enabled`, `preorder_message`, `preorder_release_date`, `preorder_limit`, and `preorder_count` columns on the `products` table; admin **PreordersView** lists all preorder-enabled products with status (Open/Full based on limit), preorder count vs limit, release date, stock quantity; admin can toggle preorder off per product and see counts; `GET/PUT /api/preorders` endpoints; public `ProductView` already shows a 🛒 Pre-Order Now CTA when `preorder_enabled` and `preorder_available` (enforces limit client-side); `preorder_count` increments on order placement for preorder items; 🛒 Preorders sidebar entry
- **Order Multi-Shipments** — orders can have multiple shipment records; `order_shipments` SQLite table (carrier, tracking_number, tracking_url, items JSON array, status: pending/shipped/delivered, shipped_at, delivered_at, notes); full CRUD at `GET/POST/PUT/DELETE /api/order-shipments?order_id=`; admin **OrderShipmentsView** — search orders by number/email, click to view all shipments for that order, add new shipment with carrier + tracking + items + status, edit/delete; shipment confirmation emails can be sent per shipment; 📬 Multi-Shipments sidebar entry
- **Stock Change History** — every admin product stock update and order fulfillment is logged to the `stock_history` table (product_id, old_qty, new_qty, change_amt, reason, order_id, admin_id/name, note, timestamp); `logStockChange()` export called from products route on every stock field change; admin **StockHistoryView** — global recent changes feed (search, product filter, reason filter); click any product to see its full change history with old→new arrows, change amount badges (green for increases, red for decreases), reason labels, admin attribution, and order links; 📋 Stock History sidebar entry
- **Charity Campaigns** — full charity/fundraising system: `charity_campaigns` + `charity_donations` SQLite tables; campaigns have name, description, logo, mode (roundup / fixed amounts / custom), active toggle; `GET /api/charity/active` public endpoint returns the active campaign for checkout integration; admin CRUD at `GET/POST/PUT/DELETE /api/charity`; `GET /api/charity/stats` returns total raised, donation count, monthly breakdown; admin **CharityView** — stats strip (campaigns, total raised, total donations), campaign table with mode badge, active toggle, edit/delete; per-campaign donations modal with donor list (email masked), amounts, dates; `POST /api/charity/donate` public endpoint records donations and increments campaign totals; `charity_enabled` setting; frontend `CheckoutView` already fetches `/api/charity/active` and shows a donation section with 3 modes: roundup (nearest €), fixed amount buttons (e.g. €1/€2/€5), or custom amount input; donation amount added to order total and sent as `charity_amount`; 💝 Charity Campaigns sidebar entry
- **Order Tags** — admin can tag orders with custom labels for filtering and workflow organization; `order_tags` table (order_id, tag, color); `GET/POST/DELETE /api/order-tags`; `GET /api/order-tags/stats` returns tag usage counts; admin **OrderTagsView** — stats strip showing top 6 tags with usage counts, search+status filter for orders, per-order tag pills with colored dots, inline tag management (add/remove tags with autocomplete from existing tags, color picker); admin `OrdersView` order detail modal updated to show tag pills; 🏷️ Order Tags sidebar entry

### Phase 53 — Public Vendor Storefront + Vendor Portal + Shop Filters + Order Status Timeline ✅
- **Public Vendor Storefront** — two new public frontend pages for the marketplace: `/vendors` listing page (glass card grid with banner/logo, product count, total sales badge, search bar, pagination) and `/vendors/:slug` detail page (hero with banner image + vendor logo/profile, product grid with sort + search filter, pagination); data served by two new backend endpoints: `GET /api/vendors/public` (active vendors only, sorted by sales, requires `marketplace_enabled=1`) and `GET /api/vendors/public/:slug` (vendor detail + paginated products by that vendor); routes added to frontend router
- **Vendor Self-Service Portal** — new `/vendor-portal` public frontend page; a fully self-contained vendor management app with JWT auth (separate `vendorToken` in localStorage); features a glass login card with **Sign In** tab (existing vendors) and **Apply** tab (new vendor registration — shows "Application submitted" message for pending-approval stores); authenticated dashboard shows **5 tabs**: 📊 Dashboard (stat cards: total sales, net earnings, pending payout, orders, products; recent orders table), 🛍️ Products (product table with cover thumbnail, price, status pill, stock; full create/edit modal with name/price/sale price/cover image/excerpt/SKU/status), 📦 Orders (full paginated order items table showing revenue + commission split), 💰 Payouts (payout history with status badges), ⚙️ Profile (store name, description, logo URL, banner URL, payout info, store URL display); sticky sidebar with vendor logo/status badge + navigation + sign-out; all data from existing `/api/vendors/me/*` self-service endpoints
- **Advanced Shop Filters (backend + frontend)** — `GET /api/products` now accepts three new query params: `vendor` (filter by vendor slug — joins vendors table), `price_min` / `price_max` / `min_price` / `max_price` (all accepted as aliases; filters on effective price = sale_price if set, otherwise price); `sort` param extended with new values `price_asc`, `price_desc`, `name_asc`, `name_desc`, `featured`, `oldest` (in addition to existing `newest`); frontend `ProductsView` already had `filterMinPrice`, `filterMaxPrice`, and `filterSort` wired — now fully functional end-to-end with correct param names resolved; Footer quick links updated with 🏪 Marketplace and "Sell on [site]" links pointing to `/vendors` and `/vendor-portal`
- **Order Status Timeline Component** — new `OrderTimeline.vue` frontend component; renders a 4-step horizontal stepper (Order Placed → Processing → Shipped → Delivered); completed steps show a filled accent-colored dot with ✓ checkmark and filled connector line; the active step shows a pulsing dot animation; integrated into `OrderConfirmView` (below order number after checkout) and `OrderLookupView` (below the status pill in order tracking results); fully responsive with overflow-x scroll on narrow screens; accepts a `status` prop mapped to the existing order status values (`pending`, `processing`, `shipped`, `completed`)
- **Bug fixes** — `admin/VendorsView.vue` imported from non-existent `../stores/api.js`; fixed to `../api.js`; `admin/SmsView.vue` had two occurrences of `{{'{{'}}key{{'}}'}}` template expressions causing Vite/rolldown parse errors; fixed to `{{ fmtVar('key') }}` helper pattern

### Phase 52 — Multi-Vendor Marketplace + Product Comparison ✅
- **Multi-Vendor Marketplace** — full vendor platform built on top of the existing product/order system: `vendors` table (id, name, slug, email, password, description, logo, banner, status, commission_rate, total_sales, total_commission, payout_info, timestamps); `vendor_payouts` table (payout records with status paid/pending, note, paid_at); `vendor_order_items` table (per-item revenue split tracking with commission_rate, commission_amount, vendor_amount, payout_id); `vendor_id` column added to `products` table; 6 new settings keys: marketplace_enabled, marketplace_name, marketplace_commission, marketplace_auto_approve, product_comparison_enabled, product_comparison_max; vendor JWT auth system with separate `VENDOR_JWT_SECRET` env var (`vendorAuthMiddleware`); public endpoints: `POST /api/vendors/register` (auto-approve via setting), `POST /api/vendors/login`; vendor self-service API: `GET/PUT /api/vendors/me` (profile), `GET/POST/PUT/DELETE /api/vendors/me/products` (manage own products), `GET /api/vendors/me/orders` (paginated order items), `GET /api/vendors/me/stats` (sales/commission/payout breakdown), `GET /api/vendors/me/payouts` (payout history); admin API: `GET /api/vendors` (list with search/status filter), `GET /api/vendors/stats` (total/active/pending/suspended/GMV/commissions), `GET/PUT/DELETE /api/vendors/:id`, `GET /api/vendors/:id/products`, `GET /api/vendors/:id/orders`, `POST/GET /api/vendors/:id/payouts`; `recordVendorSale(orderId, orderNumber, items)` helper called automatically after every successful order — looks up vendor per product, calculates commission, inserts vendor_order_items, updates vendor totals; admin **VendorsView** — marketplace ON/OFF toggle pill, 5-stat strip (total/active/pending/GMV/commissions), search+status filter bar, vendor table with logo/avatar, status pills, commission rate, total sales, product count, joined date; per-vendor actions: ✅ Approve (for pending), ✏️ Edit (name/email/status/commission slider), 💰 Payouts modal (net earnings/paid out/pending breakdown, mark-as-paid form, payout history table), 📦 Products modal (product grid with cover/price/status/stock), 🗑️ Delete confirm; 🏪 Vendors sidebar entry added near Orders
- **Product Comparison** — side-by-side product comparison page (builds on existing Phase 37 `useCompareStore` and `CompareDrawer`): new `/compare` frontend route; **CompareView** — full-width comparison grid with 4 product slots; row-based layout (price, category, SKU, availability, tags, description) with highlighted cells when values differ between products; product header cards show cover image/placeholder, name, "View Product →" link, "🛒 Add to Cart" button, "✕ Remove" button; empty slots show dashed "+ Add Product" link to /shop; compare button (⚖️) added to **ProductView** — imports `useCompareStore`, uses existing `toggle`/`isAdded`/`remove`/`isFull` API, styled `.compare-toggle-btn` with active/hover states; backend: `GET /api/products/compare?ids=1,2,3,4` endpoint added to products.js for server-side product lookup by ID array (up to 4)

### Phase 50 — Gift Registry + Auto Discounts (BOGO) + Customer LTV Analytics + Orders Date Filter ✅
- **Gift Registry** — full gift/wish-list system for weddings, baby showers, birthdays, and other events: `gift_registries` + `gift_registry_items` + `gift_registry_purchases` SQLite tables; admins can view all registries with search/filter by type and status; registry detail modal shows item grid with per-item progress bars (purchased vs. remaining), giver names, and a status toggle (active/archived); `GET /api/gift-registry/stats/summary` — total, active, items, purchased count, breakdown by event type; customer-facing REST API: `GET/POST/PUT/DELETE /api/gift-registry/me` (CRUD own registries), `POST /api/gift-registry/me/:id/items` (add product), `PUT/DELETE /api/gift-registry/me/:id/items/:itemId` (update/remove); public endpoints: `GET /api/gift-registry/public/:slug` (view a public registry with item progress), `GET /api/gift-registry/search?q=` (search public registries), `POST /api/gift-registry/purchase` (record a gift with giver name/email/quantity/message and validates remaining count); admin **GiftRegistryView** — stats strip with type breakdown emoji cards, searchable/filterable table, detail modal with full item grid and purchase history per item; 🎁 Gift Registries sidebar entry + Dashboard stat card + quick-action; public `/gift-registry` search page (search bar, registry card grid) + `/gift-registry/:slug` detail page (hero with type/date/description, progress summary card with fulfillment %, items grid with per-item progress bars and "Gift This" buttons, gift modal with name/email/qty/message form, thank-you message section); routes added to frontend router
- **Auto Discounts — BOGO / Buy X Get Y / Spend X Get Y / Every Nth Free** — cart-level automatic promotions that apply without coupon codes: `auto_discounts` SQLite table; 4 rule types: **BOGO** (buy 1 get 1 free, scoped to product or any item), **Buy X Get Y** (configurable buy/get quantities + discount %, optional product-specific targeting), **Spend X Get Y** (minimum cart subtotal → free/discounted product or order discount), **Every Nth Free** (every Nth item in cart gets N% off, sorted by lowest price first); each rule has schedule (starts_at/ends_at), max total uses with auto-deactivation, active toggle; admin CRUD at `GET/POST/PUT/DELETE /api/auto-discounts`; `GET /api/auto-discounts/stats` summary; `POST /api/auto-discounts/evaluate` public endpoint — accepts cart items + subtotal JSON, returns `{ applied: [{ rule_id, name, description, type, discount_amount, free_items[] }], total_discount }`; `POST /api/auto-discounts/record-use` increments `uses_count` for applied rules post-checkout; admin **AutoDiscountsView** — stats strip (total/active/uses/by-type), sortable rule table with type-colored badges (BOGO=gold, BuyXGetY=blue, SpendXGetY=green, NthFree=purple), rule details summary, schedule info, active toggle button, create/edit modal with type-adaptive form (shows relevant fields per type); ⚡ Auto Discounts sidebar entry + Dashboard stat card; public `CheckoutView` calls `evaluate` on mount and on cart change (debounced watch), shows "⚡ Auto Discount (rule names): −€X.XX" line in order summary, sends `auto_discount_amount` in order payload, records rule uses after successful checkout; `auto_discount_amount REAL DEFAULT 0` column added to `orders` table; Settings → 🎁 Gift Registries & Auto Discounts section with enable/disable toggles for both systems
- **Customer LTV Analytics** — lifetime value computation and reporting: `customer_ltv` SQLite cache table (customer_id PK, total_orders, total_spent, avg_order_value, first/last order dates, days_as_customer, order_frequency orders/month, predicted_ltv 12-month projection, ltv_tier); 5 tiers: **New** (0–1 small orders), **Occasional** (1–2 orders or <€100), **Regular** (3–5 orders or <€500), **Loyal** (6–15 orders or <€2000), **VIP** (15+ orders or €2000+); `computeAndStoreLtv(customerId)` function recalculates and upserts one customer's LTV on demand; called automatically after every successful order placement; admin endpoints: `POST /api/customer-ltv/refresh` recomputes all customers, `POST /api/customer-ltv/refresh/:id` single customer, `GET /api/customer-ltv` paginated list with tier/search/sort filters, `GET /api/customer-ltv/summary` full analytics report, `GET /api/customer-ltv/:id` single customer with monthly spend chart + top products; admin **CustomerLtvView** — summary stat cards (total customers, avg LTV, avg order value, avg order frequency, avg predicted LTV 12m, total predicted revenue 12m), Tier Breakdown section with tier cards (emoji, count, avg spent, avg predicted, "View →" filter button), Monthly Revenue bar chart (last 12 months), Cohort Analysis table (customers by join month + their revenue + avg per customer), 🏆 Top VIP Customers grid (top 10 by spend with rank, name, email, tier pill), paginated customer table with tier/sort/search filters + sortable by spent/predicted/orders/frequency/days; click any customer to open LTV Detail modal (tier pill, 6 stat cards, monthly spending bar chart, top 5 purchased products); 🔄 "Refresh LTV" button triggers full recompute; 📊 Customer LTV sidebar entry + Dashboard quick-action
- **Orders Date Filter** — admin `OrdersView` gains date range filter inputs ("From" / "To" date pickers) next to the status filter; applies to both the orders table fetch and the CSV export; backend `GET /api/orders` and `GET /api/orders/export/csv` both accept `?from=` and `?to=` query params that filter by `date(created_at)`; "✕ Clear dates" button resets the filter

### Phase 47 — Post Gallery + Order Customer Messaging + Booking Settings + Dashboard Improvements ✅
- **Post Gallery** — posts can now have a multi-image gallery in addition to the cover image; `gallery TEXT DEFAULT '[]'` column added to `posts` table via safe migration; `POST /api/posts` and `PUT /api/posts/:id` accept and persist `gallery` (JSON array of URLs); `parsePost()` parses the gallery array; admin `PostEditView` gains a **Post Gallery** section below the cover image: shows thumbnail grid (3-column) with ✕ remove buttons per image, a "Add Images" button that opens the existing `MediaPickerModal`; public `PostView` renders a responsive gallery grid (3 columns desktop, 2 mobile) below the post body with a built-in lightbox (prev/next navigation, Escape to close, click outside to close, animated overlay); gallery hidden when empty
- **Order Customer Messaging** — admins can send a direct email message to any customer from the order detail modal; `POST /api/orders/:id/message` endpoint validates the order has an email, sends a branded HTML email via SMTP with the order reference highlighted, logs the message to the `order_timeline` table (`message_sent` event), and records in the activity log; admin `OrdersView` order detail modal gains a **📩 Message Customer** button in the footer; opens a dedicated modal with subject (pre-filled with order number) and message textarea; sends immediately; shows "✓ Message sent" confirmation and auto-closes
- **Bookings Settings in Admin** — `SettingsView` gains a full **📅 Bookings & Appointments** section (below Maintenance Mode): enable/disable toggle, booking page title and intro text, confirmation email subject (with `#{reference}` placeholder), confirmation message, reminder email hours before appointment, and reminder enable toggle; new settings seeded: `bookings_confirmation_subject`, `bookings_confirmation_message`, `bookings_cancellation_subject`, `bookings_reminder_hours`, `bookings_reminder_enabled`
- **Dashboard Improvements** — `GET /api/dashboard/stats` extended with `bookings` (total/pending/today/enabled), `automation` (total/active/runs_today), and `coupon_campaigns` (total/active) stats; `recentBookings` array (last 5 bookings with service name) added to response; `DashboardView` shows **📅 Bookings** stat card (only when bookings enabled, highlights accent when pending), **⚡ Automation** stat card (shows active rule count + runs today); **Recent Bookings** table widget appears when bookings exist; quick-action buttons added for Bookings, Automation, Coupon Campaigns, and Referral
- **Booking icon in SiteNav** — public `SiteNav` shows a 📅 calendar icon button linking to `/booking` when `bookings_enabled = '1'` in settings; appears between the Search and Account icons

### Phase 46 — Appointment Booking System + Automation Rules + Coupon Campaigns ✅
- **Appointment Booking System** — full service-based booking system: `services` + `booking_availability` + `booking_blocked_dates` + `bookings` SQLite tables; services have name, slug, description, cover image, price, duration (minutes), buffer time between slots, category, max daily bookings, active status; weekly availability configured per service per day-of-week with start/end times; blocked dates for holidays/closures; slot generation computes available times dynamically accounting for existing bookings, buffer time, and blocked dates; `GET/POST/PUT/DELETE /api/bookings/services`; availability CRUD at `GET/POST/PUT/DELETE /api/bookings/availability/:serviceId`; blocked dates at `POST/DELETE /api/bookings/blocked/:serviceId`; public slot availability at `GET /api/bookings/slots?service_id=&date=`; booking CRUD: `GET/POST/PUT/DELETE /api/bookings`; booking reference in `BKG-XXXXXX` format; booking confirmation + cancellation emails sent via SMTP; admin `BookingsView` — stats strip (total/pending/confirmed/today), tabs for Bookings (searchable/filterable table with status, date, customer) and Services (cards with availability indicators + edit); service edit modal (TipTap description, gallery, pricing, duration, buffer, availability grid, blocked date picker); booking detail modal (customer info, service, date/time, status selector, admin notes, cancel flow); 📅 Bookings sidebar entry; public `BookingView` (`/booking`) — service selection grid with cover images + pricing + duration, date picker (unavailable dates grayed out), time slot picker (available slots as pill buttons), customer info form (name, email, phone, notes), booking confirmation with reference number; calendar icon in `SiteNav` when bookings enabled
- **Automation Rules** — visual no-code automation builder: `automation_rules` + `automation_runs` SQLite tables; 12 trigger types: `order.placed`, `order.completed`, `order.refunded`, `customer.registered`, `customer.birthday`, `review.submitted`, `ticket.created`, `ticket.resolved`, `subscriber.new`, `product.low_stock`, `booking.confirmed`, `booking.cancelled`; conditions: field/operator/value triples (customer country, order total, product tag, etc.); 8 action types: `send_email` (to customer or admin with template), `send_webhook` (HTTP POST to URL with payload), `add_loyalty_points`, `apply_coupon`, `update_order_status`, `add_customer_tag`, `send_push_notification`, `add_store_credit`; rules fire via `triggerAutomation(trigger, context)` called from relevant route handlers; non-blocking async execution with run history logged; admin `AutomationView` — stats strip (total/active rules, runs today, success/fail counts), rules table with trigger pill + condition/action counts + status, ▶/⏸ toggle, 🕓 history modal (recent runs with status, trigger, context summary), create/edit modal with trigger selector, condition builder (+ Add Condition), action builder (+ Add Action with type-specific fields); ⚡ Automation Rules sidebar entry; `triggerAutomation('order.placed', { order, customer })` wired into `POST /api/orders`
- **Coupon Campaigns** — bulk coupon code generators: `coupon_campaigns` SQLite table + `campaign_id` FK on `coupons`; campaigns define a template (discount type/value, expiry, min order, max uses per code) + generation settings (prefix, code count, code length); `POST /api/coupon-campaigns/:id/generate` bulk-creates up to 500 unique codes in one shot (uses `crypto.randomBytes` for entropy, retries on collision); `GET /api/coupon-campaigns/:id/codes` lists generated codes with redemption status; admin `CouponCampaignsView` — stats strip (total/active campaigns, total codes, redeemed codes), campaign table with code count + redemption rate + active badge, ✏️ Edit, ⚡ Generate (with count input + instant feedback), 📋 Codes modal (searchable, shows code + uses + created date, CSV export button); 🎟️ Coupon Campaigns sidebar entry

### Phase 45 — Subscribe & Save on Product Pages + Customer Subscription Management ✅
- **Subscribe & Save on public product pages** — `ProductView` now loads `GET /api/product-subscriptions/plans/public?product_id=` for any product with `subscription_enabled = 1`; a "🔁 Subscribe & Save" section appears above the SKU field with pill-style plan selector buttons showing the interval label and discount % badge; selecting a plan reveals a "Subscribe Now" button; logged-in customers can click to subscribe (calls `POST /api/product-subscriptions/subscribe` with their customer JWT); guests are shown a "Sign in to subscribe" link; success/error feedback inline; subscription section hidden for products without plans
- **Subscriptions tab in Customer Account** — `AccountView` gains a **🔁 Subscriptions** tab between Points and Saved Cart; loads all customer subscriptions from `GET /api/product-subscriptions/me`; each subscription shows product thumbnail, product name (links to product page), plan label, discount badge, next order date, unit price × quantity, status badge; action buttons per subscription: ⏸ Pause (active only), ▶ Resume (paused only), Cancel (any non-cancelled); cancel asks for confirmation; status updates call `PUT /api/product-subscriptions/me/:id` with customer JWT

### Phase 44 — Storefront Customizer + Dynamic Theme CSS ✅
- **Storefront Customizer** — admin **StorefrontCustomizerView** at `/storefront-customizer`; provides a visual theme editor with live in-page preview; controls: Accent Color (color picker + hex input + 8 quick presets), Background Color, Surface Color, Font Family (7 Google Fonts + system-ui), Font Size (small/medium/large), Button Border Radius (square/soft/round/pill), Card Style (glass/solid/outline/minimal), Nav Style (floating/fullwidth/sticky), Hero Layout (centered/left/split), Products Per Row (2/3/4), Show Product Excerpt toggle, Show "Add to Cart" on Cards toggle, Footer Style (minimal/wide/dark), Show Social Links toggle; Custom CSS textarea for arbitrary overrides; all settings persisted via `PUT /api/settings`; live preview panel shows a scaled storefront mockup (nav, hero, product grid, footer) that updates in real time as settings change; mobile/desktop preview toggle; 🎨 Storefront Customizer sidebar entry
- **Dynamic Theme CSS injection** — public frontend site store (`stores/site.js`) now reads theme settings from `/api/settings` on every page load and injects a `<style id="pygmy-theme-css">` element with CSS custom property overrides (`--accent`, `--bg`, `--surface`, `--btn-radius`) + optional Google Font `@import` + full custom CSS blob; font is swapped via Google Fonts CDN when not Poppins; `bg_color`, `surface_color`, `theme_button_radius`, `theme_font`, `theme_font_size`, `custom_css` settings seeded in DB defaults
- **Bug fix** — Phase 41/42 `db.js` settings block extended with 10 new keys: `bg_color`, `surface_color`, `theme_font_size`, `theme_products_per_row`, `theme_show_excerpt`, `theme_show_atc`, `theme_footer_style`, `theme_show_social`, `custom_css`

### Phase 43 — Product Subscriptions + Back-in-Stock Alerts + Fulfillment Queue + Homepage Builder + Performance Dashboard ✅
- **Product Subscriptions (Subscribe & Save)** — `product_subscriptions` + `customer_subscriptions_orders` SQLite tables; admins configure recurring plans per product (interval days, interval label like "Monthly"/"Weekly", discount %, active toggle); `GET/POST/PUT/DELETE /api/product-subscriptions/plans`; `subscription_enabled` column added to `products` table; customer endpoints: `GET /me` (own subscriptions), `POST /subscribe` (subscribe with qty), `PUT /me/:id` (pause/resume/cancel); admin endpoints: `GET /orders` (all subscriber orders with search + status filter), `GET /stats` (active/paused/cancelled/due-soon counts + total revenue), `PUT /orders/:id` (update status, next order date, notes); admin **ProductSubscriptionsView** — 5 stat cards (active, paused, due soon, cancelled, revenue), tabs for Active Subscribers and Subscription Plans; subscriber table with customer info, product thumbnail, plan label, unit price, next order date (highlighted red if overdue), order count, status pill, edit/pause/resume/cancel actions; edit modal with status selector, next-order-date picker, notes; Plans tab shows product grid cards with active subscriber count, discount badge, edit/delete; Add Plan modal with product search autocomplete, interval/label/discount/active fields; 🔁 Product Subscriptions sidebar entry
- **Back-in-Stock Alerts admin panel** — `stock_alerts` SQLite table (product_id, email, name, notified flag + notified_at, unique per product+email); public `POST /api/stock-alerts/subscribe` (validates product is actually OOS); admin `GET /api/stock-alerts` with search + notified/pending filter; `GET /api/stock-alerts/stats` returns pending count, notified count, products with alerts + top 5 most-watched products with alert counts; `POST /api/stock-alerts/notify` sends branded back-in-stock HTML email to all pending watchers of a product; `DELETE /api/stock-alerts/:id`; `autoNotifyRestock(productId)` export called when product stock goes above 0; admin **StockAlertsView** — 3 stat cards (pending, notified, products watched), 🔥 Most Wanted Products strip with stock status + watcher count + "Notify All" button per product, searchable+filterable alerts table with email, product name, current stock pill, status pill, per-row notify + delete actions; 🔔 Back-in-Stock sidebar entry
- **Fulfillment Queue** — admin **FulfillmentView** at `/fulfillment`; `tracking_number`, `tracking_carrier`, `tracking_url`, `fulfillment_notes` columns added to `orders` table; orders view with status filter (pending+processing, shipped), search, "Needs tracking only" toggle; each order row expands to show items list with thumbnails + quantities, expandable fulfillment form with status selector, tracking number/carrier/URL fields, fulfillment notes, and a "Save & Mark as Shipped" button; ship action updates order status to `shipped`; stats strip (pending, processing, ready-to-ship, shipped today); 🚢 Fulfillment sidebar entry
- **Homepage Builder** — admin **HomepageBuilderView** at `/homepage` wraps the existing `PageBlocksBuilder` component but targeted at the homepage page entity; `/api/page-blocks/home-id` endpoint returns the homepage page ID so blocks can be managed without knowing the page's internal ID; admins can add/reorder/delete any of the 14 block types (Hero, Features, Text, Image+Text, Gallery, Testimonials, CTA, FAQ, Team, Pricing, Newsletter, Divider, Spacer, Embed) directly from the Homepage builder shortcut in the sidebar; 🏠 Homepage sidebar entry
- **Performance Dashboard** — admin **PerformanceView** fetches `GET /api/web-vitals/summary` + `GET /api/web-vitals/daily` from the existing Web Vitals RUM system; shows overall Good/Needs Improvement/Poor score, per-metric cards (LCP, CLS, FCP, TTFB, INP, FID) with color-coded ratings and sample counts, daily bar chart for any selected metric, URL-level breakdown of slowest pages; period selector (7/14/30/60/90 days); ⚡ Performance sidebar entry

### Phase 42 — Affiliate Program + Gift Cards + Store Credit + Returns & Refunds + Product Q&A ✅
- **Affiliate Program** — `affiliates` + `affiliate_referrals` + `affiliate_payouts` SQLite tables; full REST API at `GET/POST/PUT/DELETE /api/affiliates`; each affiliate has name, email, unique referral code (auto-generated), commission rate %, status (active/inactive/suspended); `recordReferral(orderId, code, amount)` export fires when checkout detects a `?ref=CODE` param (stores order + commission); `POST /api/affiliates/:id/payouts` records a payout; admin **AffiliatesView** — stats strip (active affiliates, total referrals, commissions earned, total paid out), search+status filter, table with referral count/revenue/earned/paid columns; detail modal with referral history + payout history; create/edit modal with commission rate, code, status; 🤝 Affiliates sidebar entry; referral code tracking in frontend via `?ref=` query param stored in localStorage and sent with order payload
- **Gift Cards** — `gift_cards` + `gift_card_transactions` SQLite tables; unique codes in `PYGM-XXXX-XXXX-XXXX` format; initial value, current balance, currency, optional expiry date, optional recipient name/email (for sending as a gift), status (active/used/expired/disabled); public `POST /api/gift-cards/validate` returns balance+expiry for any valid code; `POST /api/gift-cards/redeem` deducts balance (partial redemption supported); admin CRUD at `GET/POST/PUT/DELETE /api/gift-cards`; admin **GiftCardsView** — stats strip (total, active, total value, redeemed value), searchable table with code badge, balance vs initial value progress bar, expiry, recipient info; create modal with value, expiry, recipient details, send-by-email option; 🎁 Gift Cards sidebar entry; frontend `GiftCardsView` (`/gift-cards`) — branded page for purchasing/redeeming gift cards; `CheckoutView` gains "Apply Gift Card" field that validates + deducts from balance at checkout
- **Store Credit** — `store_credit_transactions` SQLite table; `store_credit_balance` column on `customers`; `POST /api/store-credit/adjust` (admin — add or deduct with reason note); `GET /api/store-credit` (admin — customers with non-zero balances); `GET /api/store-credit/customer/:id` (transaction history); customer `GET /api/store-credit/me`, `POST /api/store-credit/apply` at checkout; admin **StoreCreditView** — searchable table of customers with balances, click to expand transaction history, manual +/− adjustment modal; **AccountView** gains store credit balance display; `CheckoutView` gains "Use Store Credit" section for logged-in customers; 💳 Store Credit sidebar entry
- **Returns & Refunds** — `order_returns` SQLite table (order_id, reason, status: requested/approved/rejected/refunded/closed, items JSON, refund_amount, refund_method, tracking, admin notes); public `POST /api/returns` lets customers file a return request by order number + email; admin `GET/PUT /api/returns` lists + manages all returns with status filter; email notifications for status transitions (uses email template system); admin **ReturnsView** — stats strip (requested/approved/refunded/rejected counts), searchable table with status filter, detail modal (customer info, original order link, items being returned, reason, status selector, refund amount input, refund method, admin notes, timeline), approve/reject/refund quick-action buttons; **ReturnRequestView** (`/returns`) public self-serve page — enter order number + email, see return-eligible items, select items + reason, submit request; ↩️ Returns & Refunds sidebar entry
- **Product Q&A** — `product_qa` SQLite table (product_id, question, customer_name, customer_email, answer, status: pending/published/rejected, is_featured); public `POST /api/product-qa` to submit a question (held pending); public `GET /api/product-qa?product_id=` returns published Q&As (featured first); admin CRUD at `GET/PUT/DELETE /api/product-qa` with status filter; admin **ProductQAView** — pending/published/rejected tabs, searchable, answer editor inline, featured toggle, delete; Q&A section in public `ProductView` — shows published questions/answers, customer "Ask a Question" form below; ❓ Product Q&A sidebar entry

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
