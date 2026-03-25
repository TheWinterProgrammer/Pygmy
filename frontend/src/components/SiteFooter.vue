<template>
  <footer class="site-footer">
    <!-- Newsletter subscribe box (shown when enabled in Settings) -->
    <NewsletterForm />

    <div class="container footer-inner">
      <div class="footer-brand">
        <img v-if="site.settings.site_logo" :src="site.settings.site_logo" alt="logo" class="footer-logo" />
        <span v-else class="footer-name">{{ site.settings.site_name }}</span>
        <p class="footer-tagline" v-if="site.settings.site_tagline">{{ site.settings.site_tagline }}</p>
      </div>

      <nav class="footer-nav" v-if="site.navigation.length">
        <ul>
          <li v-for="item in topNav" :key="item.id">
            <a :href="item.url" :target="item.target">{{ item.label }}</a>
          </li>
        </ul>
      </nav>

      <nav class="footer-nav">
        <ul>
          <li><a href="/order/lookup">📦 Track Order</a></li>
          <li v-if="site.settings.quote_requests_enabled !== '0'"><a href="/quote-request">📋 Request a Quote</a></li>
          <li><a href="/support">🎫 Support</a></li>
          <li><a href="/contact">Contact</a></li>
          <li><a href="/search">Search</a></li>
          <li><a href="/blog/authors">✍️ Authors</a></li>
          <li><a href="/changelog">📋 What's New</a></li>
          <li v-if="site.settings.store_locator_enabled === '1'"><a href="/stores">📍 Store Locator</a></li>
          <li><a href="/vendors">🏪 Marketplace</a></li>
          <li><a href="/vendor-portal">Sell on {{ site.settings.site_name || 'our store' }}</a></li>
          <li v-if="site.settings.referral_enabled === '1'"><a href="/referral">🤝 Refer a Friend</a></li>
          <li v-if="site.settings.kb_enabled === '1'"><a href="/help">❓ Help Center</a></li>
          <li><a href="/affiliate-portal">💼 Affiliate Program</a></li>
          <li><a href="/disputes">⚖️ Open a Dispute</a></li>
          <li><a href="/feedback">💡 Feedback Board</a></li>
          <li v-if="site.settings.team_page_enabled === '1'"><a href="/team">👥 Our Team</a></li>
        </ul>
      </nav>
    </div>
    <div class="footer-bottom container">
      <span class="text-muted">{{ site.settings.footer_text || `© ${year} ${site.settings.site_name}` }}</span>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue'
import { useSiteStore } from '../stores/site.js'
import NewsletterForm from './NewsletterForm.vue'

const site = useSiteStore()
const year = new Date().getFullYear()

const topNav = computed(() => site.navigation.filter(n => !n.parent_id))
</script>

<style scoped>
.site-footer {
  margin-top: 6rem;
  border-top: 1px solid var(--border);
  padding: 3rem 0 1.5rem;
}

.footer-inner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
  flex-wrap: wrap;
  margin-bottom: 2.5rem;
}

.footer-logo { height: 32px; }
.footer-name {
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  display: block;
}
.footer-tagline {
  color: var(--text-muted);
  font-size: 0.85rem;
  margin-top: 0.35rem;
}

.footer-nav ul {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.5rem;
}
.footer-nav a {
  color: var(--text-muted);
  font-size: 0.88rem;
  text-decoration: none;
  transition: color 0.2s;
}
.footer-nav a:hover { color: var(--text); }

.footer-bottom {
  border-top: 1px solid var(--border);
  padding-top: 1.25rem;
  font-size: 0.82rem;
}
.text-muted { color: var(--text-muted); }
</style>
