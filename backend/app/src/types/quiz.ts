export type QuestionType = "multiple_choice" | "true_false";

export type JobStatus =
  | "queued"
  | "validating"
  | "extracting"
  | "analyzing"
  | "generating"
  | "ready"
  | "failed";

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
  concepts: string[];
}

export interface GeneratedQuiz {
  title: string;
  summary: string;
  keyConcepts: string[];
  questions: QuizQuestion[];
  providerUsed: string;
}

export interface ProcessQuizRequest {
  youtubeUrl: string;
  questionCount?: number;
  questionTypes?: QuestionType[];
}

export interface JobState {
  id: string;
  status: JobStatus;
  progressMessage: string;
  createdAt: string;
  updatedAt: string;
  input: Required<ProcessQuizRequest>;
  videoId?: string;
  videoTitle?: string;
  errorCode?: string;
  errorMessage?: string;
  quiz?: GeneratedQuiz;
}

export interface UserAnswer {
  questionId: string;
  optionId: string;
}

export interface QuizSubmission {
  answers: UserAnswer[];
}

export interface QuizEvaluation {
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  conceptReinforcement: string[];
  details: Array<{
    questionId: string;
    correct: boolean;
    correctOptionId: string;
    selectedOptionId: string | null;
    explanation: string;
  }>;
}