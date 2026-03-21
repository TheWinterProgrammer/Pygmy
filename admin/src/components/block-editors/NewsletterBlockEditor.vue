<template>
  <div class="be-fields">
    <div class="be-row">
      <div class="form-group">
        <label>Title</label>
        <input class="input" v-model="local.title" @input="sync" placeholder="Stay in the loop" />
      </div>
      <div class="form-group">
        <label>Subtitle</label>
        <input class="input" v-model="local.subtitle" @input="sync" placeholder="Get updates straight to your inbox." />
      </div>
    </div>
    <div class="be-row">
      <div class="form-group">
        <label>Input Placeholder</label>
        <input class="input" v-model="local.placeholder" @input="sync" placeholder="Your email address" />
      </div>
      <div class="form-group">
        <label>Button Label</label>
        <input class="input" v-model="local.btn_label" @input="sync" placeholder="Subscribe" />
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
