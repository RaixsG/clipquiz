<script setup lang="ts">
import { computed } from 'vue'
import { QUIZ_FLOW_STEPS, type QuizFlowStep } from '@/constants/quizProgress'

interface Props {
  currentStep: QuizFlowStep | string
}

const props = defineProps<Props>()

const steps = QUIZ_FLOW_STEPS

const currentStepIndex = computed(() => {
  const index = steps.findIndex((s) => s.key === props.currentStep)
  return index >= 0 ? index : 0
})

const progress = computed(() => {
  return Math.min(((currentStepIndex.value + 1) / steps.length) * 100, 100)
})

const currentStepLabel = computed(() => {
  const step = steps.find((s) => s.key === props.currentStep)
  return step?.label || props.currentStep || 'Procesando...'
})

function getStepClass(index: number) {
  if (index < currentStepIndex.value) return 'completed'
  if (index === currentStepIndex.value) return 'current'
  return 'pending'
}
</script>

<template>
  <div class="w-full max-w-lg mx-auto">
    <div class="text-center mb-8">
      <div
        class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-100 mb-4"
      >
        <svg
          class="w-10 h-10 text-primary-600 animate-pulse"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h2 class="text-2xl font-semibold text-surface-800">Preparando tu Quiz</h2>
      <p class="text-surface-500 mt-2">{{ currentStepLabel }}</p>
    </div>

    <div class="space-y-3 mb-8">
      <div
        v-for="(step, index) in steps"
        :key="step.key"
        class="flex items-center gap-4 p-4 rounded-xl transition-all duration-300"
        :class="{
          'bg-green-50': getStepClass(index) === 'completed',
          'bg-primary-50': getStepClass(index) === 'current',
          'bg-surface-50': getStepClass(index) === 'pending',
        }"
      >
        <span class="text-xl">{{ step.icon }}</span>
        <span
          class="flex-1 font-medium"
          :class="{
            'text-green-700': getStepClass(index) === 'completed',
            'text-primary-700': getStepClass(index) === 'current',
            'text-surface-400': getStepClass(index) === 'pending',
          }"
        >
          {{ step.label }}
        </span>
        <svg
          v-if="getStepClass(index) === 'completed'"
          class="w-5 h-5 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
        <div v-else-if="getStepClass(index) === 'current'" class="w-5 h-5">
          <svg class="animate-spin text-primary-600" fill="none" viewBox="0 0 24 24">
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            ></path>
          </svg>
        </div>
      </div>
    </div>

    <div class="h-2 bg-surface-200 rounded-full overflow-hidden">
      <div
        class="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500 ease-out"
        :style="{ width: `${progress}%` }"
      ></div>
    </div>
  </div>
</template>
