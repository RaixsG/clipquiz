const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export interface QuizOption {
  id: string
  text: string
}

export interface QuizQuestion {
  id: string
  type: 'multiple_choice' | 'true_false'
  prompt: string
  options: QuizOption[]
  correctOptionId: string
  explanation?: string
  concepts: string[]
}

export interface QuizData {
  title: string
  summary: string
  keyConcepts: string[]
  providerUsed: string
  questions: QuizQuestion[]
}

export interface QuizResponse {
  jobId: string
  status: string
  videoTitle?: string
  quiz: QuizData
}

export interface JobStatus {
  jobId: string
  status: 'queued' | 'validating' | 'extracting' | 'analyzing' | 'generating' | 'ready' | 'failed'
  progressMessage: string
  errorCode?: string
  errorMessage?: string
  updatedAt: string
}

export type QuizJobStatus = JobStatus['status']

export interface PollJobOptions {
  initialDelayMs?: number
  maxDelayMs?: number
  maxWaitMs?: number
  backoffMultiplier?: number
  onStatusChange?: (status: JobStatus) => void
}

export interface QuizSubmission {
  answers: Array<{
    questionId: string
    optionId: string
  }>
}

export interface CreateQuizJobRequest {
  youtubeUrl: string
  questionCount?: number
  questionTypes?: Array<'multiple_choice' | 'true_false'>
}

export interface QuizEvaluation {
  jobId: string
  totalQuestions: number
  correctAnswers: number
  score: number
  conceptReinforcement: string[]
  details: Array<{
    questionId: string
    correct: boolean
    correctOptionId: string
    selectedOptionId: string | null
    explanation: string
  }>
}

export interface ApiError {
  error: {
    code: string
    message: string
  }
}

export function isValidYouTubeUrl(url: string): boolean {
  const pattern =
    /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[a-zA-Z0-9_-]{11}(\S*)?$/
  return pattern.test(url)
}

export async function createQuizJob(
  payload: CreateQuizJobRequest,
): Promise<{ jobId: string }> {
  const response = await fetch(`${API_URL}/api/quiz/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error: ApiError = await response.json()
    throw new Error(error.error?.message || 'Error al crear el job')
  }

  return response.json()
}

export async function getQuizJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetch(`${API_URL}/api/quiz/jobs/${jobId}`)

  if (!response.ok) {
    const error: ApiError = await response.json()
    throw new Error(error.error?.message || 'Error al consultar el job')
  }

  return response.json()
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const applyJitter = (delayMs: number): number => {
  const jitterFactor = 0.2
  const jitter = delayMs * jitterFactor * Math.random()
  return Math.round(delayMs + jitter)
}

export async function waitForQuizJobToFinish(
  jobId: string,
  options: PollJobOptions = {},
): Promise<JobStatus> {
  const initialDelayMs = options.initialDelayMs ?? 1000
  const maxDelayMs = options.maxDelayMs ?? 8000
  const maxWaitMs = options.maxWaitMs ?? 120000
  const backoffMultiplier = options.backoffMultiplier ?? 1.5

  const startedAt = Date.now()
  let delayMs = initialDelayMs

  while (Date.now() - startedAt <= maxWaitMs) {
    const status = await getQuizJobStatus(jobId)
    options.onStatusChange?.(status)

    if (status.status === 'ready' || status.status === 'failed') {
      return status
    }

    await sleep(applyJitter(delayMs))
    delayMs = Math.min(maxDelayMs, Math.round(delayMs * backoffMultiplier))
  }

  throw new Error('Tiempo de espera agotado al procesar el quiz. Intenta nuevamente.')
}

export async function getQuizJobResult(jobId: string): Promise<QuizResponse> {
  const response = await fetch(`${API_URL}/api/quiz/jobs/${jobId}/result`)

  if (!response.ok) {
    const error: ApiError = await response.json()
    throw new Error(error.error?.message || 'Error al obtener el resultado')
  }

  return response.json()
}

export async function submitQuizAnswers(
  jobId: string,
  answers: QuizSubmission['answers'],
): Promise<QuizEvaluation> {
  const response = await fetch(`${API_URL}/api/quiz/jobs/${jobId}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ answers }),
  })

  if (!response.ok) {
    const error: ApiError = await response.json()
    throw new Error(error.error?.message || 'Error al enviar las respuestas')
  }

  return response.json()
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
    })
    return response.ok
  } catch {
    return false
  }
}
