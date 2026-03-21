<template>
  <div class="be-fields">
    <div class="be-row">
      <div class="form-group">
        <label>Headline</label>
        <input class="input" v-model="local.title" @input="sync" placeholder="Your big headline" />
      </div>
      <div class="form-group">
        <label>Subtitle</label>
        <input class="input" v-model="local.subtitle" @input="sync" placeholder="Supporting tagline" />
      </div>
    </div>
    <div class="be-row">
      <div class="form-group">
        <label>CTA Button Label</label>
        <input class="input" v-model="local.cta_label" @input="sync" placeholder="Get Started" />
      </div>
      <div class="form-group">
        <label>CTA Button URL</label>
        <input class="input" v-model="local.cta_url" @input="sync" placeholder="/contact" />
      </div>
    </div>
    <div class="be-row">
      <div class="form-group">
        <label>Background Image URL</label>
        <input class="input" v-model="local.bg_image" @input="sync" placeholder="https://… or /uploads/…" />
      </div>
      <div class="form-group">
        <label>Background Color (fallback)</label>
        <input class="input" type="color" v-model="local.bg_color" @input="sync" style="height:38px;padding:2px 6px;" />
      </div>
    </div>
    <div class="be-row">
      <div class="form-group">
        <label>Overlay Opacity (0–1)</label>
        <input class="input" type="range" min="0" max="1" step="0.05" v-model.number="local.overlay_opacity" @input="sync" />
        <small>{{ local.overlay_opacity }}</small>
      </div>
      <div class="form-group">
        <label>Text Align</label>
        <select class="select" v-model="local.text_align" @change="sync">
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div class="form-group">
        <label>Min Height</label>
        <input class="input" v-model="local.min_height" @input="sync" placeholder="60vh" />
      </div>
    </div>
  </div>
</template>
<script setup>
import { reactive, watch } from 'vue'
const props = defineProps({ settings: Object })
const emits = defineEmits(['update'])
const local = reactive({ ...props.settings })
watch(() => props.settings, (v) => Object.assign(local, v), { deep: true })
function sync() { emits('update', { ...local }) }
</script>
