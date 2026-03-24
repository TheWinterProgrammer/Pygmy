<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div class="install-prompt glass" v-if="showPrompt">
        <div class="prompt-content">
          <div class="prompt-icon">📲</div>
          <div class="prompt-text">
            <strong>Add to Home Screen</strong>
            <span class="prompt-sub">Install our app for a faster experience</span>
          </div>
        </div>
        <div class="prompt-actions">
          <button class="btn-dismiss" @click="dismiss">Later</button>
          <button class="btn-install" @click="install">Install</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const showPrompt = ref(false)
let deferredPrompt = null

onMounted(() => {
  // Already dismissed?
  if (localStorage.getItem('pwa-dismissed')) return

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    // Show after a 3-second delay (don't be aggressive)
    setTimeout(() => { showPrompt.value = true }, 3000)
  })
})

function dismiss() {
  showPrompt.value = false
  localStorage.setItem('pwa-dismissed', '1')
}

async function install() {
  if (!deferredPrompt) return
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  showPrompt.value = false
  if (outcome === 'accepted') {
    localStorage.setItem('pwa-installed', '1')
  }
}
</script>

<style scoped>
.install-prompt {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 2rem);
  max-width: 420px;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 1.25rem;
  background: rgba(30, 31, 37, 0.92);
  border: 1px solid rgba(255,255,255,.15);
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 32px rgba(0,0,0,.4);
}

.prompt-content {
  display: flex;
  align-items: center;
  gap: .75rem;
}

.prompt-icon { font-size: 1.75rem; }

.prompt-text {
  display: flex;
  flex-direction: column;
  gap: .1rem;
}

.prompt-text strong { font-size: .95rem; }
.prompt-sub { font-size: .78rem; color: #888; }

.prompt-actions {
  display: flex;
  gap: .5rem;
  flex-shrink: 0;
}

.btn-dismiss {
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: .6rem;
  color: #aaa;
  font-size: .85rem;
  padding: .4rem .8rem;
  cursor: pointer;
  transition: background .2s;
}
.btn-dismiss:hover { background: rgba(255,255,255,.14); }

.btn-install {
  background: var(--accent, hsl(355,70%,58%));
  border: none;
  border-radius: .6rem;
  color: white;
  font-size: .85rem;
  font-weight: 600;
  padding: .4rem 1rem;
  cursor: pointer;
  transition: filter .2s;
}
.btn-install:hover { filter: brightness(1.1); }

.slide-up-enter-active, .slide-up-leave-active { transition: transform .35s cubic-bezier(.34,1.56,.64,1), opacity .3s; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateX(-50%) translateY(120%); opacity: 0; }
</style>
