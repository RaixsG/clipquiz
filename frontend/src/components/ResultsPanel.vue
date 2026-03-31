<script setup lang="ts">
import { computed } from 'vue'
import { useQuizStore } from '@/stores/quiz'
import { useRouter } from 'vue-router'

const store = useQuizStore()
const router = useRouter()

const emoji = computed(() => {
  const pct = store.percentage
  if (pct >= 90) return '🏆'
  if (pct >= 70) return '🎉'
  if (pct >= 50) return '👍'
  return '📚'
})

const message = computed(() => {
  const pct = store.percentage
  if (pct >= 90) return '¡Excelente! Dominas el tema'
  if (pct >= 70) return '¡Muy bien! Vas por buen camino'
  if (pct >= 50) return 'Bien, pero hay espacio para mejorar'
  return 'Sigue estudiando el material'
})

const encouragement = computed(() => {
  const pct = store.percentage
  if (pct >= 70) return 'Repasa los conceptos para consolidar tu conocimiento'
  return 'Te recomendamos volver a ver las secciones relacionadas'
})

function handleNewQuiz() {
  store.resetQuiz()
  router.push('/')
}
</script>

<template>
  <div class="w-full max-w-2xl mx-auto text-center">
    <div class="mb-8">
      <span class="text-6xl mb-4 block">{{ emoji }}</span>
      <h2 class="text-3xl font-bold text-surface-800 mb-2">Resultados</h2>
      <p class="text-surface-600">{{ message }}</p>
    </div>

    <div class="card p-8 mb-8">
      <div class="text-6xl font-bold text-gradient mb-2">
        {{ store.score }}/{{ store.totalQuestions }}
      </div>
      <p class="text-surface-500">{{ store.percentage }}% de respuestas correctas</p>

      <div class="mt-6 h-3 bg-surface-200 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-1000"
          :class="{
            'bg-green-500': store.percentage >= 70,
            'bg-amber-500': store.percentage >= 50 && store.percentage < 70,
            'bg-red-400': store.percentage < 50,
          }"
          :style="{ width: `${store.percentage}%` }"
        ></div>
      </div>
    </div>

    <div v-if="store.weakConcepts.length > 0" class="card p-6 text-left mb-8">
      <h3 class="font-semibold text-surface-800 mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        Conceptos a reforzar
      </h3>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="concept in store.weakConcepts"
          :key="concept"
          class="px-3 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium border border-amber-200"
        >
          {{ concept }}
        </span>
      </div>
    </div>

    <div v-if="store.quizData?.keyConcepts" class="card p-6 text-left mb-8">
      <h3 class="font-semibold text-surface-800 mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        Conceptos Clave del Video
      </h3>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="concept in store.quizData.keyConcepts"
          :key="concept"
          class="px-3 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium border border-primary-200"
        >
          {{ concept }}
        </span>
      </div>
    </div>

    <div class="p-4 bg-surface-50 rounded-xl mb-8">
      <h4 class="font-medium text-surface-700 mb-2">Resumen del video</h4>
      <p class="text-surface-600 text-sm leading-relaxed">
        {{ store.quizData?.summary || 'No hay resumen disponible' }}
      </p>
    </div>

    <div class="flex gap-4">
      <button class="btn-secondary flex-1" @click="handleNewQuiz">Nuevo Quiz</button>
    </div>
  </div>
</template>
