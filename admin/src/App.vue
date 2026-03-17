<template>
  <RouterView />
  <ToastContainer />
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth.js'
import ToastContainer from './components/ToastContainer.vue'

const auth = useAuthStore()
onMounted(() => auth.fetchMe())
</script>
