<template>
  <div class="upload-panel">
    <div class="upload-inner">
      <div class="upload-header">
        <h3>Add Products</h3>
        <button class="btn-close" @click="$emit('close')">✕</button>
      </div>

      <!-- Drop zone -->
      <div
        class="drop-zone"
        :class="{ dragging }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
        @click="fileInput.click()"
      >
        <div class="drop-icon">🖼️</div>
        <p>Drop studio images here or <span class="link">browse</span></p>
        <p class="drop-hint">JPEG, PNG, WebP • max 20MB each</p>
        <input ref="fileInput" type="file" multiple accept="image/*" @change="onFileSelect" hidden />
      </div>

      <!-- Preview queue -->
      <div v-if="queue.length" class="preview-queue">
        <div v-for="(item, i) in queue" :key="i" class="preview-item">
          <img :src="item.preview" :alt="item.name" />
          <input
            v-model="item.name"
            class="preview-name"
            placeholder="Product name…"
            @click.stop
          />
          <button class="preview-remove" @click.stop="removeFromQueue(i)">✕</button>
        </div>
      </div>

      <!-- Upload button -->
      <button
        v-if="queue.length"
        class="btn-upload-go"
        :disabled="uploading"
        @click="uploadAll"
      >
        {{ uploading ? `Uploading ${queue.length} products…` : `Upload ${queue.length} product${queue.length > 1 ? 's' : ''}` }}
      </button>

      <div v-if="error" class="upload-error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useProductStore } from '../stores/products.js'

const emit = defineEmits(['close'])
const store = useProductStore()

const fileInput = ref(null)
const queue = ref([])
const dragging = ref(false)
const uploading = ref(false)
const error = ref(null)

function addFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    const reader = new FileReader()
    reader.onload = (e) => {
      queue.value.push({
        file,
        name: file.name.replace(/\.[^.]+$/, ''),
        preview: e.target.result
      })
    }
    reader.readAsDataURL(file)
  }
}

function onFileSelect(e) { addFiles(e.target.files) }
function onDrop(e) { dragging.value = false; addFiles(e.dataTransfer.files) }
function removeFromQueue(i) { queue.value.splice(i, 1) }

async function uploadAll() {
  if (!queue.value.length) return
  uploading.value = true
  error.value = null
  try {
    const files = queue.value.map(q => q.file)
    const names = queue.value.map(q => q.name)
    await store.bulkUpload(files, names)
    queue.value = []
    emit('close')
  } catch (e) {
    error.value = e.message
  } finally {
    uploading.value = false
  }
}
</script>
