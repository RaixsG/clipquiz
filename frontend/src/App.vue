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
          <img src="/logo.png" class="w-10 h-8 rounded-lg shadow-sm" alt="ClipQuiz Logo" />
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
