<template>
  <div class="be-fields">
    <div class="be-row">
      <div class="form-group">
        <label>Title</label>
        <input class="input" v-model="local.title" @input="sync" placeholder="Section headline" />
      </div>
      <div class="form-group">
        <label>Image Side</label>
        <select class="select" v-model="local.image_side" @change="sync">
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Text</label>
      <textarea class="input" v-model="local.text" @input="sync" rows="4" placeholder="Supporting text…"></textarea>
    </div>
    <div class="form-group">
      <label>Image URL</label>
      <input class="input" v-model="local.image" @input="sync" placeholder="https://…" />
    </div>
    <div class="be-row">
      <div class="form-group">
        <label>CTA Button Label</label>
        <input class="input" v-model="local.cta_label" @input="sync" placeholder="Learn More" />
      </div>
      <div class="form-group">
        <label>CTA Button URL</label>
        <input class="input" v-model="local.cta_url" @input="sync" placeholder="/about" />
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
