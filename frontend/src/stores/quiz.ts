import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { QuizData, QuizEvaluation } from '@/services/api'

export type QuizStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface QuestionResult {
  questionId: string
  selectedOptionId: string | null
  isCorrect: boolean
  explanation: string
}

export const useQuizStore = defineStore('quiz', () => {
  const status = ref<QuizStatus>('idle')
  const currentStep = ref<string>('')
  const errorMessage = ref<string>('')

  const quizData = ref<QuizData | null>(null)
  const videoTitle = ref<string>('')
  const jobId = ref<string>('')
  const currentQuestionIndex = ref(0)
  const results = ref<QuestionResult[]>([])
  const selectedOption = ref<string | null>(null)
  const showFeedback = ref(false)
  const isAnswerCorrect = ref(false)
  const evaluation = ref<QuizEvaluation | null>(null)

  const currentQuestion = computed(() => {
    if (!quizData.value) return null
    return quizData.value.questions[currentQuestionIndex.value] || null
  })

  const totalQuestions = computed(() => {
    return quizData.value?.questions.length || 0
  })

  const score = computed(() => {
    return results.value.filter((r) => r.isCorrect).length
  })

  const percentage = computed(() => {
    if (totalQuestions.value === 0) return 0
    return Math.round((score.value / totalQuestions.value) * 100)
  })

  const weakConcepts = computed(() => {
    return evaluation.value?.conceptReinforcement || []
  })

  const isLastQuestion = computed(() => {
    return currentQuestionIndex.value === totalQuestions.value - 1
  })

  function setLoading(step: string) {
    status.value = 'loading'
    currentStep.value = step
    errorMessage.value = ''
  }

  function setQuizData(data: QuizData, title: string, id: string) {
    quizData.value = data
    videoTitle.value = title || ''
    jobId.value = id
    status.value = 'ready'
    currentQuestionIndex.value = 0
    results.value = []
    selectedOption.value = null
    showFeedback.value = false
    evaluation.value = null
  }

  function setEvaluation(evalData: QuizEvaluation) {
    evaluation.value = evalData
  }

  function setError(message: string) {
    status.value = 'error'
    errorMessage.value = message
  }

  function selectAnswer(optionId: string) {
    if (showFeedback.value) return
    selectedOption.value = optionId
  }

  function submitAnswer() {
    if (!selectedOption.value || !currentQuestion.value) return

    const questionEval = evaluation.value?.details.find(
      (d) => d.questionId === currentQuestion.value?.id,
    )
    const isCorrect = selectedOption.value === currentQuestion.value.correctOptionId

    results.value.push({
      questionId: currentQuestion.value.id,
      selectedOptionId: selectedOption.value,
      isCorrect,
      explanation: questionEval?.explanation || currentQuestion.value.explanation || '',
    })

    isAnswerCorrect.value = isCorrect
    showFeedback.value = true
  }

  function nextQuestion() {
    if (isLastQuestion.value) {
      return
    }
    currentQuestionIndex.value++
    selectedOption.value = null
    showFeedback.value = false
    isAnswerCorrect.value = false
  }

  function resetQuiz() {
    status.value = 'idle'
    currentStep.value = ''
    errorMessage.value = ''
    quizData.value = null
    videoTitle.value = ''
    jobId.value = ''
    currentQuestionIndex.value = 0
    results.value = []
    selectedOption.value = null
    showFeedback.value = false
    isAnswerCorrect.value = false
    evaluation.value = null
  }

  return {
    status,
    currentStep,
    errorMessage,
    quizData,
    videoTitle,
    jobId,
    currentQuestionIndex,
    results,
    selectedOption,
    showFeedback,
    isAnswerCorrect,
    currentQuestion,
    totalQuestions,
    score,
    percentage,
    weakConcepts,
    isLastQuestion,
    setLoading,
    setQuizData,
    setEvaluation,
    setError,
    selectAnswer,
    submitAnswer,
    nextQuestion,
    resetQuiz,
  }
})
