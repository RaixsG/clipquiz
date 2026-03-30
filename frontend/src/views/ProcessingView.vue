<script setup lang="ts">
import { useQuizStore } from '@/stores/quiz'
import LoadingScreen from '@/components/LoadingScreen.vue'

const store = useQuizStore()
</script>

<template>
  <div class="min-h-[60vh] flex flex-col items-center justify-center px-4">
    <LoadingScreen :current-step="store.currentStep" />
  </div>
</template>
