<script setup lang="ts">
import { useQuizStore } from '@/stores/quiz'
import ResultsPanel from '@/components/ResultsPanel.vue'
import { useRouter } from 'vue-router'

const store = useQuizStore()
const router = useRouter()

if (!store.quizData || store.results.length === 0) {
  router.push('/')
}
</script>

<template>
  <div class="min-h-[60vh] flex flex-col items-center justify-center px-4 py-8">
    <ResultsPanel />
  </div>
</template>
