<script setup lang="ts">
import { useQuizStore } from '@/stores/quiz'
import QuizCard from '@/components/QuizCard.vue'
import { useRouter } from 'vue-router'

const store = useQuizStore()
const router = useRouter()

if (!store.quizData || store.status !== 'ready') {
  router.push('/')
}
</script>

<template>
  <div class="min-h-[60vh] flex flex-col items-center justify-center px-4 py-8">
    <QuizCard />
  </div>
</template>
