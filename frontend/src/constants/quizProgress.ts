import type { QuizJobStatus } from '@/services/api'

export type QuizClientStep = 'creating' | 'finalizing'
export type QuizFlowStep = QuizClientStep | QuizJobStatus

export interface QuizFlowStepDefinition {
  key: QuizFlowStep
  label: string
  icon: string
}

export const QUIZ_FLOW_STEPS: QuizFlowStepDefinition[] = [
  { key: 'creating', label: 'Creando trabajo...', icon: '📋' },
  { key: 'queued', label: 'En cola de procesamiento...', icon: '⏳' },
  { key: 'validating', label: 'Validando URL...', icon: '🔗' },
  { key: 'extracting', label: 'Extrayendo transcripción...', icon: '📝' },
  { key: 'analyzing', label: 'Analizando contenido...', icon: '🧠' },
  { key: 'generating', label: 'Generando preguntas...', icon: '❓' },
  { key: 'finalizing', label: 'Preparando quiz...', icon: '⚙️' },
  { key: 'ready', label: '¡Listo para comenzar!', icon: '🎉' },
]