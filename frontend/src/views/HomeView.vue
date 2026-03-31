<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import { createQuizJob, waitForQuizJobToFinish, getQuizJobResult } from '@/services/api'
import UrlInput from '@/components/UrlInput.vue'

const router = useRouter()
const store = useQuizStore()

async function handleSubmit(payload: {
  youtubeUrl: string
  questionCount?: number
  questionTypes?: Array<'multiple_choice' | 'true_false'>
}) {
  store.setLoading('validating')
  router.push('/processing')

  try {
    store.setLoading('creating')
    const { jobId } = await createQuizJob(payload)

    const jobStatus = await waitForQuizJobToFinish(jobId, {
      onStatusChange: (status) => {
        store.setLoading(status.status)
      },
    })

    if (jobStatus.status === 'failed') {
      throw new Error(jobStatus.errorMessage || 'El procesamiento del quiz falló')
    }

    store.setLoading('finalizing')
    const result = await getQuizJobResult(jobId)

    store.setQuizData(result.quiz, result.videoTitle || '', jobId)
    router.push('/quiz')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    store.setError(message)
    router.push('/error')
  }
}
</script>

<template>
  <div class="min-h-[80vh] flex flex-col items-center justify-center px-4">
    <div class="text-center mb-12">
      <img
        src="/logo.png"
        class="inline-block w-34 h-24 rounded-2xl mb-6 shadow-lg shadow-primary-500/30"
        alt="ClipQuiz Logo"
      />
      <h1 class="text-4xl font-bold text-surface-800 mb-3">
        <span class="text-gradient">Clip</span>Quiz
      </h1>
      <p class="text-surface-500 text-lg max-w-md mx-auto">
        Transforma videos de YouTube en quizzes interactivos y aprende mientras evalúas tu
        conocimiento.
      </p>
    </div>

    <UrlInput @submit="handleSubmit" />

    <div class="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl">
      <div class="text-center p-4">
        <div
          class="w-12 h-12 mx-auto mb-3 rounded-xl bg-primary-100 flex items-center justify-center"
        >
          <svg
            class="w-6 h-6 text-primary-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <h3 class="font-semibold text-surface-700 mb-1">Rápido</h3>
        <p class="text-surface-500 text-sm">En segundos tienes tu quiz listo</p>
      </div>
      <div class="text-center p-4">
        <div
          class="w-12 h-12 mx-auto mb-3 rounded-xl bg-green-100 flex items-center justify-center"
        >
          <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <h3 class="font-semibold text-surface-700 mb-1">Inteligente</h3>
        <p class="text-surface-500 text-sm">IA identifica conceptos clave</p>
      </div>
      <div class="text-center p-4">
        <div
          class="w-12 h-12 mx-auto mb-3 rounded-xl bg-amber-100 flex items-center justify-center"
        >
          <svg class="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
            />
          </svg>
        </div>
        <h3 class="font-semibold text-surface-700 mb-1">Interactivo</h3>
        <p class="text-surface-500 text-sm">Feedback inmediato en cada pregunta</p>
      </div>
    </div>
  </div>
</template>
