<template>
  <div>
    <div class="page-header">
      <h1>🏠 Homepage Builder</h1>
      <div style="display:flex;gap:0.5rem">
        <a href="http://localhost:5174" target="_blank" rel="noopener" class="btn btn-ghost">
          🌐 View Site
        </a>
      </div>
    </div>

    <div class="glass section intro-card" v-if="!pageId">
      <div class="loading-bar"></div>
      <p style="color:var(--muted)">Loading homepage builder…</p>
    </div>

    <template v-else>
      <div class="glass section info-card">
        <p>
          Build your homepage visually by adding and arranging content blocks below.
          The classic hero/posts layout is always shown <em>below</em> the blocks if no blocks exist.
          Blocks replace the top of the page — start with a <strong>Hero block</strong> to take full control.
        </p>
      </div>

      <div class="glass section">
        <PageBlocksBuilder :page-id="pageId" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api.js'
import PageBlocksBuilder from '../components/PageBlocksBuilder.vue'

const pageId = ref(null)

onMounted(async () => {
  const { data } = await api.get('/page-blocks/home-id')
  pageId.value = data.page_id
})
</script>

<style scoped>
.section { padding: 1.25rem; margin-bottom: 1rem; }
.info-card p { font-size: 0.9rem; color: var(--muted); line-height: 1.6; }
.info-card strong { color: var(--text); }
</style>
