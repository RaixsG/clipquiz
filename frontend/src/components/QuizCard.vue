<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quiz'
import { submitQuizAnswers } from '@/services/api'
import type { QuizOption } from '@/services/api'

const store = useQuizStore()
const router = useRouter()

const shuffledOptions = computed(() => {
  if (!store.currentQuestion) return []
  return [...store.currentQuestion.options].sort(() => Math.random() - 0.5)
})

function getOptionClass(option: QuizOption) {
  const base = 'quiz-option'

  if (!store.showFeedback) {
    return {
      [base]: true,
      selected: store.selectedOption === option.id,
    }
  }

  const currentResult = store.results.find((r) => r.questionId === store.currentQuestion?.id)
  const isCorrectOption = currentResult?.isCorrect
    ? option.id !== store.selectedOption
    : store.quizData?.questions.find((q) => q.id === store.currentQuestion?.id)?.options[0]?.id ===
      option.id

  if (isCorrectOption && !currentResult?.isCorrect) {
    return { [base]: true, correct: true }
  }

  if (store.selectedOption === option.id && !currentResult?.isCorrect) {
    return { [base]: true, incorrect: true }
  }

  return { [base]: true }
}

function isOptionCorrect(option: QuizOption): boolean {
  const currentResult = store.results.find((r) => r.questionId === store.currentQuestion?.id)
  if (currentResult?.isCorrect) {
    return option.id === currentResult.selectedOptionId
  }
  return (
    store.quizData?.questions.find((q) => q.id === store.currentQuestion?.id)?.options[0]?.id ===
    option.id
  )
}

function isOptionSelected(option: QuizOption): boolean {
  return store.selectedOption === option.id
}

function handleSelect(optionId: string) {
  if (!store.showFeedback) {
    store.selectAnswer(optionId)
  }
}

async function handleSubmit() {
  store.submitAnswer()
}

async function handleNext() {
  if (store.isLastQuestion) {
    const answers = store.results.map((r) => ({
      questionId: r.questionId,
      optionId: r.selectedOptionId || '',
    }))

    try {
      const evaluation = await submitQuizAnswers(store.jobId, answers)
      store.setEvaluation(evaluation)
      router.push('/results')
    } catch (error) {
      console.error('Error submitting quiz:', error)
      router.push('/results')
    }
  } else {
    store.nextQuestion()
  }
}
</script>

<template>
  <div v-if="store.currentQuestion" class="w-full max-w-2xl mx-auto">
    <div class="mb-6 flex items-center justify-between">
      <span class="text-surface-500 font-medium">
        Pregunta {{ store.currentQuestionIndex + 1 }} de {{ store.totalQuestions }}
      </span>
      <span class="text-primary-600 font-semibold"> {{ store.score }} correctas </span>
    </div>

    <div class="h-2 bg-surface-200 rounded-full mb-8 overflow-hidden">
      <div
        class="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-300"
        :style="{ width: `${((store.currentQuestionIndex + 1) / store.totalQuestions) * 100}%` }"
      ></div>
    </div>

    <div class="card p-6 mb-6">
      <span
        class="inline-block px-3 py-1 text-xs font-medium text-primary-700 bg-primary-100 rounded-full mb-4"
      >
        {{ store.currentQuestion.concepts?.[0] || 'Concepto' }}
      </span>
      <h2 class="text-xl font-semibold text-surface-800 leading-relaxed">
        {{ store.currentQuestion.prompt }}
      </h2>
    </div>

    <div class="space-y-3 mb-8">
      <button
        v-for="option in shuffledOptions"
        :key="option.id"
        :class="getOptionClass(option)"
        :disabled="store.showFeedback && !isOptionCorrect(option) && !isOptionSelected(option)"
        @click="handleSelect(option.id)"
      >
        <span class="flex items-center gap-3">
          <span
            class="flex-shrink-0 w-6 h-6 rounded-full border-2 border-surface-300 flex items-center justify-center text-sm font-medium"
            :class="{
              'border-primary-500 bg-primary-500 text-white':
                isOptionSelected(option) && !store.showFeedback,
              'border-green-500 bg-green-500 text-white':
                store.showFeedback && isOptionCorrect(option),
              'border-red-500 bg-red-500 text-white':
                store.showFeedback && isOptionSelected(option) && !isOptionCorrect(option),
              'border-surface-300':
                (!store.showFeedback && !isOptionSelected(option)) ||
                (store.showFeedback && !isOptionCorrect(option) && !isOptionSelected(option)),
            }"
          >
            <svg
              v-if="store.showFeedback && isOptionCorrect(option)"
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="3"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <svg
              v-else-if="store.showFeedback && isOptionSelected(option) && !isOptionCorrect(option)"
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="3"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </span>
          <span class="text-surface-700">{{ option.text }}</span>
        </span>
      </button>
    </div>

    <div
      v-if="store.showFeedback"
      class="mb-6 p-4 rounded-xl"
      :class="
        store.isAnswerCorrect
          ? 'bg-green-50 border border-green-200'
          : 'bg-amber-50 border border-amber-200'
      "
    >
      <div class="flex items-start gap-3">
        <span class="text-2xl">{{ store.isAnswerCorrect ? '✅' : '💡' }}</span>
        <div>
          <p
            class="font-semibold"
            :class="store.isAnswerCorrect ? 'text-green-800' : 'text-amber-800'"
          >
            {{ store.isAnswerCorrect ? '¡Correcto!' : '¡Incorrecto!' }}
          </p>
          <p
            v-if="store.currentQuestion?.explanation"
            class="text-sm mt-1"
            :class="store.isAnswerCorrect ? 'text-green-700' : 'text-amber-700'"
          >
            {{ store.currentQuestion.explanation }}
          </p>
        </div>
      </div>
    </div>

    <div class="flex gap-4">
      <button
        v-if="!store.showFeedback"
        class="btn-primary flex-1"
        :disabled="!store.selectedOption"
        @click="handleSubmit"
      >
        Verificar Respuesta
      </button>
      <button v-else class="btn-primary flex-1" @click="handleNext">
        {{ store.isLastQuestion ? 'Ver Resultados' : 'Siguiente Pregunta' }}
      </button>
    </div>
  </div>
</template>
