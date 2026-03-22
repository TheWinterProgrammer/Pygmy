<template>
  <div>
    <div class="page-header">
      <h1>Settings</h1>
      <button class="btn btn-primary" @click="save" :disabled="saving">
        {{ saving ? 'Saving…' : 'Save Settings' }}
      </button>
    </div>

    <div class="settings-grid" v-if="loaded">
      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">🌐 Site Identity</h2>
        <div class="form-group">
          <label>Site Name</label>
          <input v-model="form.site_name" class="input" placeholder="My Pygmy Site" />
        </div>
        <div class="form-group">
          <label>Tagline</label>
          <input v-model="form.site_tagline" class="input" placeholder="A short description of your site" />
        </div>
        <div class="form-group">
          <label>Logo URL</label>
          <div class="pick-row">
            <input v-model="form.site_logo" class="input" placeholder="/uploads/media/logo.png" />
            <button type="button" class="btn btn-ghost btn-sm" @click="pickerTarget = 'site_logo'">🖼️</button>
          </div>
        </div>
        <div class="form-group">
          <label>Footer Text</label>
          <input v-model="form.footer_text" class="input" placeholder="© 2026 My Site" />
        </div>
      </div>

      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">🎨 Appearance</h2>
        <div class="form-group">
          <label>Accent Color</label>
          <div class="color-row">
            <input v-model="form.accent_color" class="input" placeholder="hsl(355, 70%, 58%)" />
            <input type="color" :value="hslToHex(form.accent_color)" class="color-swatch" @input="e => form.accent_color = e.target.value" />
          </div>
        </div>
        <div class="form-group">
          <label>Posts Per Page</label>
          <input v-model.number="form.posts_per_page" type="number" class="input" min="1" max="100" />
        </div>
      </div>

      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">🦸 Hero Section</h2>
        <div class="form-group">
          <label>Hero Title</label>
          <input v-model="form.hero_title" class="input" placeholder="Welcome to My Site" />
        </div>
        <div class="form-group">
          <label>Hero Subtitle</label>
          <input v-model="form.hero_subtitle" class="input" placeholder="A warm intro line" />
        </div>
        <div class="form-group">
          <label>Hero Background URL (image or video)</label>
          <div class="pick-row">
            <input v-model="form.hero_bg_url" class="input" placeholder="/uploads/media/hero.jpg" />
            <button type="button" class="btn btn-ghost btn-sm" @click="pickerTarget = 'hero_bg_url'">🖼️</button>
          </div>
        </div>
        <div v-if="form.hero_bg_url" class="hero-preview" :style="{ backgroundImage: `url(${form.hero_bg_url})` }">
          <div class="hero-overlay">
            <strong>{{ form.hero_title }}</strong>
            <span>{{ form.hero_subtitle }}</span>
          </div>
        </div>
      </div>

      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">✉️ Contact Page</h2>
        <div class="form-group">
          <label>Intro Text</label>
          <textarea v-model="form.contact_intro" class="input textarea" rows="3"
            placeholder="Have a question? Drop us a message…" />
        </div>
      </div>

      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">📊 Analytics</h2>
        <div class="form-group">
          <label>Google Analytics ID <small style="color:var(--text-muted)">(e.g. G-XXXXXXXXXX)</small></label>
          <input v-model="form.google_analytics" class="input" placeholder="G-XXXXXXXXXX" />
        </div>
      </div>

      <!-- Email / Notifications -->
      <div class="glass section email-section">
        <h2 style="margin-bottom:1.25rem;">📧 Email &amp; Notifications</h2>
        <p style="color:var(--muted);font-size:0.85rem;margin-bottom:1.25rem;">
          Configure SMTP to receive email alerts for new comments and contact form submissions.
        </p>
        <div class="email-grid">
          <div class="form-group">
            <label>SMTP Host</label>
            <input v-model="form.smtp_host" class="input" placeholder="smtp.gmail.com" />
          </div>
          <div class="form-group">
            <label>SMTP Port</label>
            <input v-model="form.smtp_port" class="input" placeholder="587" type="number" />
          </div>
          <div class="form-group">
            <label>SMTP Username</label>
            <input v-model="form.smtp_user" class="input" placeholder="you@gmail.com" />
          </div>
          <div class="form-group">
            <label>SMTP Password</label>
            <input v-model="form.smtp_pass" class="input" type="password" placeholder="App password" autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label>From Address <small style="color:var(--muted)">(optional, defaults to username)</small></label>
            <input v-model="form.smtp_from" class="input" placeholder="Pygmy CMS &lt;noreply@example.com&gt;" />
          </div>
          <div class="form-group">
            <label>Notify Email <small style="color:var(--muted)">(where alerts are sent)</small></label>
            <input v-model="form.notify_email" class="input" type="email" placeholder="admin@example.com" />
          </div>
        </div>
        <div class="notify-toggles">
          <label class="toggle-label">
            <input type="checkbox" v-model="notifyComment" />
            <span>Email me on new comment</span>
          </label>
          <label class="toggle-label">
            <input type="checkbox" v-model="notifyContact" />
            <span>Email me on new contact message</span>
          </label>
        </div>
        <div style="margin-top:1rem;display:flex;gap:0.75rem;align-items:center">
          <button class="btn btn-ghost" @click="sendTestEmail" :disabled="testingEmail">
            {{ testingEmail ? 'Sending…' : '📤 Send test email' }}
          </button>
          <span v-if="testEmailMsg" :style="{ color: testEmailOk ? 'hsl(142,70%,60%)' : 'var(--accent)', fontSize: '0.85rem' }">
            {{ testEmailMsg }}
          </span>
        </div>
      </div>

      <!-- Newsletter -->
      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">📨 Newsletter</h2>
        <p style="color:var(--muted);font-size:0.85rem;margin-bottom:1.25rem;">
          Enable the newsletter subscribe box on the public frontend. Requires SMTP to be configured above.
        </p>
        <label class="toggle-label" style="margin-bottom:1.25rem">
          <input type="checkbox" v-model="newsletterEnabled" />
          <span>Enable newsletter subscribe form on public site</span>
        </label>
        <div class="form-group" style="margin-top:1rem">
          <label>Subscribe Form Intro Text</label>
          <textarea v-model="form.newsletter_intro" class="input textarea" rows="2"
            placeholder="Get the latest updates delivered straight to your inbox." />
        </div>
        <div style="margin-top:0.5rem">
          <RouterLink to="/newsletter" class="btn btn-ghost btn-sm">📨 Manage Subscribers →</RouterLink>
        </div>
      </div>

      <!-- Custom Code Injection -->
      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">💻 Custom Code Injection</h2>
        <p style="color:var(--muted);font-size:0.85rem;margin-bottom:1.25rem;">
          Inject custom scripts or tracking pixels into every public page. Header scripts go inside
          <code style="background:rgba(255,255,255,0.08);padding:0.1em 0.35em;border-radius:0.3em;">&lt;head&gt;</code>
          (e.g. fonts, meta tags); footer scripts go just before
          <code style="background:rgba(255,255,255,0.08);padding:0.1em 0.35em;border-radius:0.3em;">&lt;/body&gt;</code>
          (e.g. chat widgets, pixels, analytics).
        </p>
        <div class="form-group">
          <label>Header Scripts</label>
          <textarea v-model="form.header_scripts" class="input textarea code-area" rows="5"
            placeholder="<!-- e.g. custom fonts, meta tags, structured data -->" />
        </div>
        <div class="form-group">
          <label>Footer Scripts</label>
          <textarea v-model="form.footer_scripts" class="input textarea code-area" rows="5"
            placeholder="<!-- e.g. analytics pixels, chat widgets, cookie scripts -->" />
        </div>
      </div>

      <!-- robots.txt -->
      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">🤖 robots.txt</h2>
        <p style="color:var(--muted);font-size:0.85rem;margin-bottom:1.25rem;">
          Control how search engine bots crawl your site. Served at
          <code style="background:rgba(255,255,255,0.08);padding:0.1em 0.35em;border-radius:0.3em;">/robots.txt</code>.
        </p>
        <div class="form-group">
          <label>robots.txt content</label>
          <textarea v-model="form.robots_txt" class="input textarea code-area" rows="6"
            placeholder="User-agent: *&#10;Allow: /" />
        </div>
      </div>

      <!-- E-Commerce -->
      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">🛒 E-Commerce</h2>
        <p style="color:var(--muted);font-size:0.85rem;margin-bottom:1.25rem;">
          Configure your shop currency, checkout experience, and order notification preferences.
        </p>
        <div class="form-group">
          <label>Currency Code <small style="color:var(--text-muted)">(e.g. EUR, USD, GBP)</small></label>
          <input v-model="form.shop_currency" class="input" placeholder="EUR" style="max-width:120px;" />
        </div>
        <div class="form-group">
          <label>Currency Symbol <small style="color:var(--text-muted)">(e.g. €, $, £)</small></label>
          <input v-model="form.shop_currency_symbol" class="input" placeholder="€" style="max-width:80px;" />
        </div>
        <div class="form-group">
          <label>Checkout Intro Text</label>
          <textarea v-model="form.shop_checkout_intro" class="input textarea" rows="2"
            placeholder="Complete your order below." />
        </div>
        <div class="form-group">
          <label>Thank-You Message <small style="color:var(--text-muted)">(shown on order confirmation)</small></label>
          <textarea v-model="form.shop_thankyou_message" class="input textarea" rows="2"
            placeholder="Thank you for your order! We'll be in touch shortly." />
        </div>
        <div class="form-group">
          <label>Order Confirmation Email Subject <small style="color:var(--text-muted)">(use <code style="background:rgba(255,255,255,0.08);padding:0.1em 0.3em;border-radius:3px">#{order_number}</code>)</small></label>
          <input v-model="form.order_confirmation_subject" class="input"
            placeholder="Your order has been received — #{order_number}" />
        </div>
        <div class="form-group">
          <label>Order Status Update Email Subject <small style="color:var(--text-muted)">(use <code style="background:rgba(255,255,255,0.08);padding:0.1em 0.3em;border-radius:3px">#{order_number}</code>)</small></label>
          <input v-model="form.order_status_subject" class="input"
            placeholder="Order #{order_number} status update" />
        </div>
        <div class="notify-toggles" style="margin-top:0.5rem;">
          <label class="toggle-label">
            <input type="checkbox" v-model="notifyNewOrder" />
            <span>Email admin on new order</span>
          </label>
          <label class="toggle-label">
            <input type="checkbox" v-model="notifyOrderStatus" />
            <span>Email customer on status change</span>
          </label>
        </div>
      </div>

      <!-- Tax / VAT Settings -->
      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">🧾 Tax / VAT</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1.25rem;">
          Configure tax/VAT calculation for your shop. Tax rates are managed in
          <RouterLink to="/tax-rates" style="color:var(--accent);">Tax Rates</RouterLink>.
        </p>
        <label class="toggle-label" style="margin-bottom:1rem;">
          <input type="checkbox" v-model="taxEnabled" />
          <span>Enable tax/VAT calculation at checkout</span>
        </label>
        <label class="toggle-label" style="margin-bottom:1.25rem;">
          <input type="checkbox" v-model="taxInclusive" />
          <span>Prices include tax (inclusive mode — tax extracted from price, not added on top)</span>
        </label>
        <div class="form-group">
          <label>Tax Registration Number <small style="color:var(--text-muted)">(shown on invoices)</small></label>
          <input v-model="form.tax_registration_number" class="input" placeholder="e.g. DE123456789" style="max-width:280px;" />
        </div>
      </div>

      <!-- Loyalty Program -->
      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">🏆 Loyalty Program</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1.25rem;">
          Reward customers with points for every purchase. Points can be redeemed for discounts at checkout.
        </p>
        <label class="toggle-label" style="margin-bottom:1.25rem;">
          <input type="checkbox" v-model="loyaltyEnabled" />
          <span>Enable loyalty program</span>
        </label>
        <div class="form-group">
          <label>Points Per Unit of Currency <small style="color:var(--text-muted)">(e.g. 1 = 1 point per €1 spent)</small></label>
          <input v-model.number="form.loyalty_points_per_unit" type="number" step="0.1" min="0" class="input" style="max-width:120px;" />
        </div>
        <div class="form-group">
          <label>Redemption Rate <small style="color:var(--text-muted)">(points needed per 1 unit of currency, e.g. 100 pts = €1 off)</small></label>
          <input v-model.number="form.loyalty_redemption_rate" type="number" min="1" class="input" style="max-width:120px;" />
        </div>
        <div class="form-group">
          <label>Minimum Points to Redeem</label>
          <input v-model.number="form.loyalty_min_redeem" type="number" min="1" class="input" style="max-width:120px;" />
        </div>
        <div class="form-group">
          <label>Points Expiry (days) <small style="color:var(--text-muted)">(0 = never expire)</small></label>
          <input v-model.number="form.loyalty_expiry_days" type="number" min="0" class="input" style="max-width:120px;" />
        </div>
      </div>

      <!-- Gift Cards -->
      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">🎁 Gift Cards</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1.25rem;">
          Allow customers to apply gift card codes at checkout.
        </p>
        <label class="toggle-label" style="margin-bottom:1rem">
          <span class="toggle-track">
            <input type="checkbox" v-model="giftCardsEnabled" />
            <span class="toggle-thumb"></span>
          </span>
          <span>Enable Gift Cards at checkout</span>
        </label>
        <div v-if="giftCardsEnabled">
          <div class="form-group" style="margin-bottom:.75rem">
            <label>Purchasable Denominations (JSON array)</label>
            <input v-model="form.gift_card_denominations" class="input" placeholder='[25, 50, 100]' />
            <small style="color:var(--text-muted);font-size:.78rem">Shown on the public gift card purchase page. Example: [10, 25, 50, 100]</small>
          </div>
          <p style="font-size:0.83rem;color:var(--text-muted)">
            Manage and issue gift cards from the <RouterLink to="/gift-cards" style="color:var(--accent)">🎁 Gift Cards</RouterLink> panel.
          </p>
        </div>
      </div>

      <!-- Email Branding -->
      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">📧 Email Branding</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1.25rem;">
          Customize how your transactional emails look (order confirmations, status updates, etc.)
        </p>
        <div class="form-group" style="margin-bottom:1rem">
          <label>Header Accent Color</label>
          <div style="display:flex;gap:.5rem;align-items:center">
            <input v-model="form.email_accent_color" class="input" placeholder="hsl(355, 70%, 30%)" style="flex:1" />
            <input type="color" :value="emailAccentHex" @input="onEmailAccentColorInput($event)" style="width:38px;height:38px;border:none;background:none;padding:0;cursor:pointer;border-radius:6px" title="Pick a color" />
          </div>
          <small style="color:var(--text-muted);font-size:.78rem">Used as the email header background. Supports hex (#ff0000), hsl(), rgb() or named CSS colors.</small>
        </div>
        <div class="form-group" style="margin-bottom:1rem">
          <label>Logo URL (optional)</label>
          <input v-model="form.email_logo_url" class="input" placeholder="https://example.com/logo.png" />
          <small style="color:var(--text-muted);font-size:.78rem">Shown at the top of the email header. Leave blank to use text only.</small>
        </div>
        <div class="form-group" style="margin-bottom:1rem">
          <label>Footer Text</label>
          <input v-model="form.email_footer_text" class="input" :placeholder="`© ${new Date().getFullYear()} ${form.site_name || 'Pygmy'}`" />
          <small style="color:var(--text-muted);font-size:.78rem">Custom text for the bottom of each email. Leave blank for default.</small>
        </div>
        <div class="form-group" style="margin-bottom:1rem">
          <label>Custom CSS (advanced)</label>
          <textarea v-model="form.email_custom_css" class="input" rows="3" placeholder="/* add extra styles */" style="font-family:monospace;font-size:.82rem" />
          <small style="color:var(--text-muted);font-size:.78rem">Injected into the email &lt;style&gt; block. Use sparingly — email clients are picky.</small>
        </div>
        <button class="btn btn-ghost" @click="previewEmail" style="margin-top:.25rem">👁️ Preview Email Template</button>
      </div>

      <!-- Memberships -->
      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">💳 Memberships</h2>
        <p style="color:var(--muted);font-size:0.85rem;margin-bottom:1.25rem;">
          Enable subscription plans and member-only content gating.
        </p>
        <label class="toggle-label" style="margin-bottom:1.25rem">
          <input type="checkbox" v-model="membershipsEnabled" />
          <span>Enable Memberships</span>
        </label>
        <div v-if="membershipsEnabled">
          <div class="form-group" style="margin-bottom:1rem">
            <label>Pricing Page Title</label>
            <input v-model="form.members_page_title" class="input" placeholder="Become a Member" />
          </div>
          <div class="form-group">
            <label>Pricing Page Intro Text</label>
            <textarea v-model="form.members_page_intro" class="input" rows="2" placeholder="Get exclusive access to premium content." />
          </div>
          <p style="font-size:0.83rem;color:var(--text-muted);margin-top:.75rem">
            Manage plans and members from the <RouterLink to="/subscriptions" style="color:var(--accent)">💳 Subscriptions</RouterLink> panel.
          </p>
        </div>
      </div>

      <!-- Affiliate Program -->
      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">🤝 Affiliate Program</h2>
        <p style="color:var(--muted);font-size:0.85rem;margin-bottom:1.25rem;">
          Enable referral tracking. Share <code>/?ref=CODE</code> links with affiliates; commissions are auto-tracked on orders.
          Manage affiliates and payouts in the <a href="/affiliates" style="color:var(--accent)">Affiliates panel</a>.
        </p>
        <label class="toggle-label" style="margin-bottom:1.25rem">
          <input type="checkbox" v-model="affiliateEnabled" />
          <span>Enable Affiliate Program</span>
        </label>
        <div v-if="affiliateEnabled" class="form-group">
          <label>Referral Cookie Duration (days)</label>
          <input v-model="form.affiliate_cookie_days" class="input" type="number" min="1" max="365" style="max-width:120px" />
          <small style="color:var(--muted);font-size:0.78rem;display:block;margin-top:0.25rem">
            How long after clicking a referral link the commission will be attributed (default: 30 days).
          </small>
        </div>
      </div>

      <!-- GDPR / Cookie Consent -->
      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">🍪 Cookie Consent (GDPR)</h2>
        <p style="color:var(--muted);font-size:0.85rem;margin-bottom:1.25rem;">
          Display a cookie consent banner on the public site. Visitors can accept, reject, or manage their preferences.
        </p>
        <label class="toggle-label" style="margin-bottom:1.25rem">
          <input type="checkbox" v-model="cookieConsentEnabled" />
          <span>Show Cookie Consent Banner</span>
        </label>
        <div v-if="cookieConsentEnabled">
          <div class="form-group">
            <label>Banner Message</label>
            <textarea v-model="form.cookie_consent_message" class="input textarea" rows="2"
              placeholder="We use cookies to improve your experience…" />
          </div>
          <div class="form-group">
            <label>Privacy Policy URL</label>
            <input v-model="form.cookie_consent_policy_url" class="input" placeholder="/privacy-policy" />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem">
            <div class="form-group">
              <label>Accept Button Text</label>
              <input v-model="form.cookie_consent_accept_label" class="input" placeholder="Accept All" />
            </div>
            <div class="form-group">
              <label>Reject Button Text</label>
              <input v-model="form.cookie_consent_reject_label" class="input" placeholder="Reject Non-Essential" />
            </div>
            <div class="form-group">
              <label>Manage Button Text</label>
              <input v-model="form.cookie_consent_manage_label" class="input" placeholder="Manage Preferences" />
            </div>
          </div>
          <div style="display:flex;gap:2rem;margin-top:0.5rem">
            <label class="toggle-label">
              <input type="checkbox" v-model="cookieAnalyticsDefault" />
              <span>Analytics cookies opt-in by default</span>
            </label>
            <label class="toggle-label">
              <input type="checkbox" v-model="cookieMarketingDefault" />
              <span>Marketing cookies opt-in by default</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Maintenance Mode -->
      <div class="glass section">
        <h2 style="margin-bottom:1.25rem;">🚧 Maintenance Mode</h2>
        <p style="color:var(--muted);font-size:0.85rem;margin-bottom:1.25rem;">
          When enabled, the public site returns a maintenance message. Admin panel access is unaffected.
        </p>
        <label class="toggle-label" style="margin-bottom:1.25rem">
          <input type="checkbox" v-model="maintenanceMode" />
          <span>Enable maintenance mode</span>
        </label>
        <div v-if="maintenanceMode" style="margin-top:0.25rem;padding:0.5rem 0.75rem;background:rgba(255,180,0,0.08);border:1px solid rgba(255,180,0,0.3);border-radius:0.5rem;font-size:0.82rem;color:hsl(40,90%,65%);margin-bottom:1rem">
          ⚠️ Maintenance mode is <strong>ON</strong> — your public site is currently inaccessible to visitors.
        </div>
        <div class="form-group">
          <label>Maintenance Message</label>
          <textarea v-model="form.maintenance_message" class="input textarea" rows="3"
            placeholder="We're currently down for maintenance. We'll be back shortly!" />
        </div>
      </div>

      <div class="glass section profile-section">
        <h2 style="margin-bottom:1.25rem;">🔐 My Profile</h2>
        <div class="form-group">
          <label>Display Name</label>
          <input v-model="profile.name" class="input" placeholder="Admin" />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input v-model="profile.email" class="input" type="email" placeholder="admin@pygmy.local" />
        </div>
        <div class="form-group">
          <label>New Password <small style="color:var(--text-muted)">(leave blank to keep current)</small></label>
          <input v-model="profile.password" class="input" type="password" placeholder="••••••••" autocomplete="new-password" />
        </div>
        <div class="form-group">
          <label>Confirm Password</label>
          <input v-model="profile.confirm" class="input" type="password" placeholder="••••••••" autocomplete="new-password" />
        </div>
        <button class="btn btn-primary" @click="saveProfile" :disabled="savingProfile">
          {{ savingProfile ? 'Saving…' : 'Update Profile' }}
        </button>
      </div>

      <!-- 2FA Section -->
      <div class="glass section tfa-section">
        <h2 style="margin-bottom:0.5rem;">🔑 Two-Factor Authentication</h2>
        <p style="color:var(--text-muted);font-size:0.88rem;margin-bottom:1.25rem;">
          Add an extra layer of security. Use an authenticator app (Google Authenticator, Authy, etc.) to scan the QR code.
        </p>

        <!-- 2FA enabled badge -->
        <div v-if="tfa.enabled" class="tfa-enabled-badge">
          <span>✅ 2FA is active on your account</span>
          <button class="btn btn-danger btn-sm" @click="showDisable2fa = true">Disable 2FA</button>
        </div>

        <!-- Setup flow -->
        <template v-else>
          <button v-if="!tfa.qr" class="btn btn-primary" @click="setup2fa" :disabled="tfa.loading">
            {{ tfa.loading ? 'Generating…' : '⚙️ Set up 2FA' }}
          </button>

          <div v-if="tfa.qr" class="tfa-setup">
            <div class="tfa-qr-wrap">
              <img :src="tfa.qr" alt="2FA QR code" class="tfa-qr" />
            </div>
            <div class="tfa-setup-info">
              <p>1. Scan this QR code with your authenticator app.</p>
              <p>2. Enter the 6-digit code shown in the app to confirm.</p>
              <div class="form-group" style="margin-top:0.75rem;">
                <label>Verification Code</label>
                <input
                  v-model="tfa.token"
                  class="input"
                  placeholder="000000"
                  maxlength="6"
                  inputmode="numeric"
                  style="letter-spacing:0.25em;font-size:1.1rem;"
                  @keydown.enter="enable2fa"
                />
              </div>
              <div v-if="tfa.error" class="tfa-error">{{ tfa.error }}</div>
              <button class="btn btn-primary" @click="enable2fa" :disabled="tfa.loading || tfa.token.length < 6">
                {{ tfa.loading ? 'Verifying…' : 'Activate 2FA' }}
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Disable 2FA modal -->
    <Teleport to="body">
      <div v-if="showDisable2fa" class="modal-overlay" @click.self="showDisable2fa = false">
        <div class="modal glass">
          <h3>Disable Two-Factor Authentication</h3>
          <p style="color:var(--text-muted);font-size:0.88rem;margin:0.75rem 0;">
            Enter your current 6-digit code or your account password to disable 2FA.
          </p>
          <div class="form-group">
            <label>Authenticator Code <small>(or leave blank to use password)</small></label>
            <input v-model="disableOtp.token" class="input" placeholder="000000" maxlength="6" />
          </div>
          <div class="form-group">
            <label>Password <small>(if not using code)</small></label>
            <input v-model="disableOtp.password" class="input" type="password" placeholder="••••••••" />
          </div>
          <div v-if="disableOtp.error" class="tfa-error">{{ disableOtp.error }}</div>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="showDisable2fa = false">Cancel</button>
            <button class="btn btn-danger" @click="disable2fa" :disabled="disableOtp.loading">
              {{ disableOtp.loading ? 'Disabling…' : 'Disable 2FA' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Media picker modal -->
    <MediaPickerModal
      v-if="pickerTarget"
      @select="url => { form[pickerTarget] = url }"
      @close="pickerTarget = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api.js'
import { useToastStore } from '../stores/toast.js'
import MediaPickerModal from '../components/MediaPickerModal.vue'

const toast = useToastStore()
const loaded = ref(false)
const saving = ref(false)
const savingProfile = ref(false)
const pickerTarget = ref(null)
const testingEmail = ref(false)
const testEmailMsg = ref('')
const testEmailOk = ref(false)

const profile = ref({ name: '', email: '', password: '', confirm: '' })

const form = ref({
  site_name: '',
  site_tagline: '',
  site_logo: '',
  accent_color: '',
  hero_title: '',
  hero_subtitle: '',
  hero_bg_url: '',
  footer_text: '',
  posts_per_page: 10,
  google_analytics: '',
  contact_intro: '',
  // email
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_pass: '',
  smtp_from: '',
  notify_email: '',
  notify_new_comment: '1',
  notify_new_contact: '1',
  // newsletter
  newsletter_enabled: '0',
  newsletter_intro: '',
  // maintenance
  maintenance_mode: '0',
  maintenance_message: '',
  // custom code
  header_scripts: '',
  footer_scripts: '',
  // robots.txt
  robots_txt: 'User-agent: *\nAllow: /',
  // e-commerce
  shop_currency: 'EUR',
  shop_currency_symbol: '€',
  shop_checkout_intro: '',
  shop_thankyou_message: '',
  order_confirmation_subject: '',
  order_status_subject: '',
  notify_new_order: '1',
  notify_order_status: '1',
  // tax
  tax_enabled: '0',
  tax_inclusive: '0',
  tax_registration_number: '',
  // loyalty
  loyalty_enabled: '0',
  loyalty_points_per_unit: '1',
  loyalty_redemption_rate: '100',
  loyalty_min_redeem: '100',
  loyalty_expiry_days: '0',
  gift_cards_enabled: '0',
  gift_card_denominations: '[25, 50, 100]',
  memberships_enabled: '0',
  members_page_title: 'Become a Member',
  members_page_intro: 'Get exclusive access to premium content.',
  email_accent_color: 'hsl(355, 70%, 30%)',
  email_logo_url: '',
  email_footer_text: '',
  email_custom_css: '',
  // Affiliate
  affiliate_enabled: '0',
  affiliate_cookie_days: '30',
  // Cookie consent
  cookie_consent_enabled: '1',
  cookie_consent_message: 'We use cookies to improve your experience. By continuing to use this site, you accept our use of cookies.',
  cookie_consent_accept_label: 'Accept All',
  cookie_consent_reject_label: 'Reject Non-Essential',
  cookie_consent_manage_label: 'Manage Preferences',
  cookie_consent_policy_url: '/privacy-policy',
  cookie_analytics_default: '0',
  cookie_marketing_default: '0',
})

// Checkbox helpers (settings stored as '1'/'0')
const notifyComment = computed({
  get: () => form.value.notify_new_comment === '1',
  set: v => { form.value.notify_new_comment = v ? '1' : '0' }
})
const notifyContact = computed({
  get: () => form.value.notify_new_contact === '1',
  set: v => { form.value.notify_new_contact = v ? '1' : '0' }
})
const newsletterEnabled = computed({
  get: () => form.value.newsletter_enabled === '1',
  set: v => { form.value.newsletter_enabled = v ? '1' : '0' }
})
const maintenanceMode = computed({
  get: () => form.value.maintenance_mode === '1',
  set: v => { form.value.maintenance_mode = v ? '1' : '0' }
})
const notifyNewOrder = computed({
  get: () => form.value.notify_new_order === '1',
  set: v => { form.value.notify_new_order = v ? '1' : '0' }
})
const notifyOrderStatus = computed({
  get: () => form.value.notify_order_status === '1',
  set: v => { form.value.notify_order_status = v ? '1' : '0' }
})
const taxEnabled = computed({
  get: () => form.value.tax_enabled === '1',
  set: v => { form.value.tax_enabled = v ? '1' : '0' }
})
const taxInclusive = computed({
  get: () => form.value.tax_inclusive === '1',
  set: v => { form.value.tax_inclusive = v ? '1' : '0' }
})
const loyaltyEnabled = computed({
  get: () => form.value.loyalty_enabled === '1',
  set: v => { form.value.loyalty_enabled = v ? '1' : '0' }
})

const giftCardsEnabled = computed({
  get: () => form.value.gift_cards_enabled === '1',
  set: v => { form.value.gift_cards_enabled = v ? '1' : '0' }
})

const membershipsEnabled = computed({
  get: () => form.value.memberships_enabled === '1',
  set: v => { form.value.memberships_enabled = v ? '1' : '0' }
})

const affiliateEnabled = computed({
  get: () => form.value.affiliate_enabled === '1',
  set: v => { form.value.affiliate_enabled = v ? '1' : '0' }
})

const cookieConsentEnabled = computed({
  get: () => form.value.cookie_consent_enabled === '1',
  set: v => { form.value.cookie_consent_enabled = v ? '1' : '0' }
})

const cookieAnalyticsDefault = computed({
  get: () => form.value.cookie_analytics_default === '1',
  set: v => { form.value.cookie_analytics_default = v ? '1' : '0' }
})

const cookieMarketingDefault = computed({
  get: () => form.value.cookie_marketing_default === '1',
  set: v => { form.value.cookie_marketing_default = v ? '1' : '0' }
})

// ─── Email branding helpers ───────────────────────────────────────────────────
const emailAccentHex = computed(() => {
  // Try to parse stored value to something a color input can use (it needs #rrggbb)
  const raw = form.value.email_accent_color || '#b32838'
  if (raw.startsWith('#') && raw.length === 7) return raw
  return '#b32838' // fallback — color picker just shows a hint color
})

function onEmailAccentColorInput(event) {
  form.value.email_accent_color = event.target.value
}

function previewEmail() {
  window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:3200'}/api/settings/email-preview`, '_blank')
}

// ─── 2FA state ────────────────────────────────────────────────────────────────
const tfa = ref({ enabled: false, loading: false, qr: null, token: '', error: '' })
const showDisable2fa = ref(false)
const disableOtp = ref({ token: '', password: '', loading: false, error: '' })

async function setup2fa() {
  tfa.value.loading = true
  tfa.value.error = ''
  try {
    const res = await api.get('/auth/2fa/setup')
    tfa.value.qr = res.data.qr
    tfa.value.token = ''
  } catch (e) {
    toast.error('Could not set up 2FA')
  } finally {
    tfa.value.loading = false
  }
}

async function enable2fa() {
  if (tfa.value.token.length < 6) return
  tfa.value.loading = true
  tfa.value.error = ''
  try {
    await api.post('/auth/2fa/enable', { token: tfa.value.token })
    tfa.value.enabled = true
    tfa.value.qr = null
    toast.success('2FA enabled!')
  } catch (e) {
    tfa.value.error = e.response?.data?.error || 'Invalid code'
  } finally {
    tfa.value.loading = false
  }
}

async function disable2fa() {
  disableOtp.value.loading = true
  disableOtp.value.error = ''
  try {
    await api.post('/auth/2fa/disable', {
      token: disableOtp.value.token || undefined,
      password: disableOtp.value.password || undefined
    })
    tfa.value.enabled = false
    showDisable2fa.value = false
    disableOtp.value = { token: '', password: '', loading: false, error: '' }
    toast.success('2FA disabled')
  } catch (e) {
    disableOtp.value.error = e.response?.data?.error || 'Failed to disable'
  } finally {
    disableOtp.value.loading = false
  }
}

onMounted(async () => {
  const [settingsRes, meRes] = await Promise.all([
    api.get('/settings'),
    api.get('/auth/me')
  ])
  Object.assign(form.value, settingsRes.data)
  profile.value.name = meRes.data.name
  profile.value.email = meRes.data.email
  tfa.value.enabled = !!meRes.data.totp_enabled
  loaded.value = true
})

async function save() {
  saving.value = true
  try {
    await api.put('/settings', form.value)
    toast.success('Settings saved')
  } catch {
    toast.error('Failed to save')
  } finally {
    saving.value = false
  }
}

async function saveProfile() {
  if (profile.value.password && profile.value.password !== profile.value.confirm) {
    toast.error('Passwords do not match')
    return
  }
  savingProfile.value = true
  try {
    const payload = { name: profile.value.name, email: profile.value.email }
    if (profile.value.password) payload.password = profile.value.password
    await api.put('/auth/me', payload)
    profile.value.password = ''
    profile.value.confirm = ''
    toast.success('Profile updated')
  } catch (e) {
    toast.error(e.response?.data?.error || 'Update failed')
  } finally {
    savingProfile.value = false
  }
}

async function sendTestEmail() {
  testingEmail.value = true
  testEmailMsg.value = ''
  try {
    await api.post('/settings/test-email')
    testEmailOk.value = true
    testEmailMsg.value = '✓ Test email sent!'
  } catch (e) {
    testEmailOk.value = false
    testEmailMsg.value = e.response?.data?.error || 'Failed to send'
  } finally {
    testingEmail.value = false
    setTimeout(() => testEmailMsg.value = '', 5000)
  }
}

function hslToHex(hsl) {
  // Quick approximation: return neutral if can't parse
  try {
    const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
    if (!match) return '#e84a5f'
    const [, h, s, l] = match.map(Number)
    const sl = s / 100, ll = l / 100
    const c = (1 - Math.abs(2 * ll - 1)) * sl
    const x = c * (1 - Math.abs((h / 60) % 2 - 1))
    const m = ll - c / 2
    let r, g, b
    if (h < 60)       { r = c; g = x; b = 0 }
    else if (h < 120) { r = x; g = c; b = 0 }
    else if (h < 180) { r = 0; g = c; b = x }
    else if (h < 240) { r = 0; g = x; b = c }
    else if (h < 300) { r = x; g = 0; b = c }
    else              { r = c; g = 0; b = x }
    return '#' + [r + m, g + m, b + m].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
  } catch { return '#e84a5f' }
}
</script>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.section { padding: 1.5rem; }
.color-row { display: flex; gap: 0.5rem; align-items: center; }
.pick-row { display: flex; gap: 0.5rem; align-items: center; }
.pick-row .input { flex: 1; }
.profile-section { grid-column: span 2; }
.email-section   { grid-column: span 2; }
.email-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.notify-toggles { display: flex; gap: 1.5rem; flex-wrap: wrap; }
.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
}
.toggle-label input[type=checkbox] { accent-color: var(--accent); width: 16px; height: 16px; }
.color-swatch {
  width: 40px; height: 38px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 0;
  background: none;
}
.hero-preview {
  margin-top: 0.75rem;
  height: 120px;
  border-radius: var(--radius-sm);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}
.hero-overlay {
  width: 100%;
  padding: 0.75rem;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
}
@media (max-width: 768px) {
  .settings-grid { grid-template-columns: 1fr; }
}
.code-area {
  font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', monospace;
  font-size: 0.82rem;
  line-height: 1.55;
  resize: vertical;
}

/* ─── 2FA ────────────────────────────────────────────────────────────── */
.tfa-section { grid-column: span 2; }
.tfa-enabled-badge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: hsl(145, 40%, 15%);
  border: 1px solid hsl(145, 40%, 25%);
  border-radius: var(--radius-sm);
  padding: 0.75rem 1rem;
  font-size: 0.88rem;
}
.tfa-setup {
  display: flex;
  gap: 1.5rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}
.tfa-qr-wrap {
  background: #fff;
  padding: 0.6rem;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.tfa-qr { width: 160px; height: 160px; display: block; }
.tfa-setup-info { flex: 1; min-width: 220px; }
.tfa-setup-info p { font-size: 0.88rem; color: var(--text-muted); margin-bottom: 0.4rem; }
.tfa-error {
  color: var(--accent);
  font-size: 0.83rem;
  margin-bottom: 0.5rem;
}

/* ─── Modal ──────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}
.modal {
  width: min(440px, 95vw);
  padding: 1.75rem;
  border-radius: var(--radius);
}
.modal h3 { margin-bottom: 0.25rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
</style>
