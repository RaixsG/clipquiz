<script setup lang="ts">
import { useQuizStore } from '@/stores/quiz'
import { useRouter } from 'vue-router'

const store = useQuizStore()
const router = useRouter()

function goHome() {
  store.resetQuiz()
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen bg-surface-50">
    <header class="border-b border-surface-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <button
          class="flex items-center gap-2 text-surface-700 hover:text-primary-600 transition-colors"
          @click="goHome"
        >
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <span class="text-xl font-bold"><span class="text-primary-600">Clip</span>Quiz</span>
        </button>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-4 py-8">
      <router-view />
    </main>

    <footer class="border-t border-surface-200 mt-auto">
      <div class="max-w-4xl mx-auto px-4 py-6 text-center text-surface-400 text-sm">
        <p>Transforma videos en quizzes interactivos con IA</p>
      </div>
    </footer>
  </div>
</template>
