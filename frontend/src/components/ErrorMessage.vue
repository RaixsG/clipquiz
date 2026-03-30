<script setup lang="ts">
import { useQuizStore } from '@/stores/quiz'
import { useRouter } from 'vue-router'

const store = useQuizStore()
const router = useRouter()

function handleRetry() {
  store.resetQuiz()
  router.push('/')
}

function getErrorIcon() {
  const msg = store.errorMessage.toLowerCase()
  if (msg.includes('subtítulo') || msg.includes('transcripci')) return '📝'
  if (msg.includes('url') || msg.includes('enlace') || msg.includes('video')) return '🔗'
  if (msg.includes('tiempo') || msg.includes('timeout')) return '⏱️'
  if (msg.includes('límite') || msg.includes('largo')) return '📹'
  return '⚠️'
}

function getErrorDescription() {
  const msg = store.errorMessage.toLowerCase()
  if (msg.includes('subtítulo') || msg.includes('transcripci')) {
    return 'Este video no tiene subtítulos disponibles o no podemos acceder a ellos.'
  }
  if (msg.includes('url') || msg.includes('enlace')) {
    return 'El enlace proporcionado no es válido o no se puede acceder al video.'
  }
  if (msg.includes('tiempo') || msg.includes('timeout')) {
    return 'El procesamiento está tomando más tiempo de lo esperado. Intenta con un video más corto.'
  }
  if (msg.includes('límite') || msg.includes('largo')) {
    return 'El video excede el límite de tiempo permitido. Prueba con uno más corto.'
  }
  return 'Ocurrió un error inesperado. Por favor, intenta de nuevo.'
}
</script>

<template>
  <div class="w-full max-w-lg mx-auto">
    <div class="card p-8 text-center">
      <span class="text-5xl mb-4 block">{{ getErrorIcon() }}</span>
      <h2 class="text-xl font-semibold text-surface-800 mb-2">Ups, algo salió mal</h2>
      <p class="text-surface-600 mb-6">{{ getErrorDescription() }}</p>

      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p class="text-red-700 text-sm">{{ store.errorMessage }}</p>
      </div>

      <button class="btn-primary w-full" @click="handleRetry">Intentar de Nuevo</button>
    </div>
  </div>
</template>
