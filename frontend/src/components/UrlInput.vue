<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  submit: [url: string]
}>()

const url = ref('')
const error = ref('')
const isSubmitting = ref(false)

function validateUrl(value: string): boolean {
  const pattern =
    /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[a-zA-Z0-9_-]{11}(\S*)?$/
  return pattern.test(value)
}

function handleSubmit() {
  error.value = ''

  if (!url.value.trim()) {
    error.value = 'Por favor, ingresa una URL de YouTube'
    return
  }

  if (!validateUrl(url.value)) {
    error.value = 'La URL no parece ser un video de YouTube válido'
    return
  }

  isSubmitting.value = true
  emit('submit', url.value)
}
</script>

<template>
  <div class="w-full max-w-xl mx-auto">
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div class="relative">
        <input
          v-model="url"
          type="text"
          placeholder="Pega tu enlace de YouTube aquí"
          class="input-field text-lg"
          :disabled="isSubmitting"
          @input="error = ''"
        />
        <div class="absolute right-3 top-1/2 -translate-y-1/2">
          <svg
            class="w-6 h-6 text-surface-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </div>
      </div>

      <p v-if="error" class="text-red-500 text-sm px-2">
        {{ error }}
      </p>

      <button type="submit" class="btn-primary w-full text-lg" :disabled="isSubmitting">
        <span v-if="!isSubmitting">Crear Quiz</span>
        <span v-else class="flex items-center justify-center gap-2">
          <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Procesando...
        </span>
      </button>
    </form>

    <div class="mt-8 text-center text-surface-500 text-sm">
      <p>Videos soportados: tutoriales, conferencias, cursos</p>
    </div>
  </div>
</template>
