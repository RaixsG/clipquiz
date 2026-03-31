import { env } from "../config/env";
import { generateQuizFromTranscript } from "./llm.service";
import { getVideoTranscript } from "./transcript.service";
import type {
  JobState,
  ProcessQuizRequest,
  QuizEvaluation,
  QuizSubmission,
} from "../types/quiz";
import { AppError } from "../utils/errors";
import { parseYoutubeUrl } from "../utils/youtube";

const jobs = new Map<string, JobState>();
const ACTIVE_STATUSES: JobState["status"][] = [
  "queued",
  "validating",
  "extracting",
  "analyzing",
  "generating",
];

const logJob = (...args: unknown[]) => {
  console.log("[ClipQuiz][Job]", ...args);
};

const cleanupExpiredJobs = () => {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    const updatedAt = new Date(job.updatedAt).getTime();
    if (now - updatedAt > env.JOB_TTL_MS) {
      jobs.delete(jobId);
    }
  }
};

setInterval(cleanupExpiredJobs, 60_000).unref();

const nowIso = () => new Date().toISOString();

const toRequiredInput = (
  payload: ProcessQuizRequest,
): Required<ProcessQuizRequest> => ({
  youtubeUrl: payload.youtubeUrl,
  questionCount: payload.questionCount ?? 10,
  questionTypes: payload.questionTypes ?? ["multiple_choice", "true_false"],
});

const buildInputFingerprint = (input: Required<ProcessQuizRequest>): string => {
  const normalizedUrl = input.youtubeUrl.trim();
  const normalizedTypes = [...input.questionTypes].sort();

  return JSON.stringify({
    youtubeUrl: normalizedUrl,
    questionCount: input.questionCount,
    questionTypes: normalizedTypes,
  });
};

const findActiveJobByInput = (
  input: Required<ProcessQuizRequest>,
): JobState | undefined => {
  const targetFingerprint = buildInputFingerprint(input);

  for (const job of jobs.values()) {
    if (!ACTIVE_STATUSES.includes(job.status)) continue;
    if (buildInputFingerprint(job.input) === targetFingerprint) {
      return job;
    }
  }

  return undefined;
};

const updateJob = (jobId: string, patch: Partial<JobState>) => {
  const existing = jobs.get(jobId);
  if (!existing) return;
  jobs.set(jobId, {
    ...existing,
    ...patch,
    updatedAt: nowIso(),
  });
};

const processJob = async (jobId: string) => {
  const job = jobs.get(jobId);
  if (!job) return;

  logJob("Processing started", { jobId, youtubeUrl: job.input.youtubeUrl });

  try {
    updateJob(jobId, {
      status: "validating",
      progressMessage: "Validando enlace de YouTube...",
    });

    const { videoId } = parseYoutubeUrl(job.input.youtubeUrl);
    logJob("Video id parsed", { jobId, videoId });
    updateJob(jobId, {
      videoId,
      status: "extracting",
      progressMessage: "Leyendo subtitulos del video...",
    });

    const transcriptResult = await getVideoTranscript(videoId);
    logJob("Transcript extracted", {
      jobId,
      title: transcriptResult.title,
      transcriptLength: transcriptResult.transcript.length,
    });
    if (transcriptResult.durationSeconds > env.MAX_VIDEO_MINUTES * 60) {
      throw new AppError(
        "VIDEO_TOO_LONG",
        `El video excede el maximo permitido de ${env.MAX_VIDEO_MINUTES} minutos.`,
        422,
      );
    }

    updateJob(jobId, {
      status: "analyzing",
      progressMessage: "Analizando contenido...",
    });

    updateJob(jobId, {
      status: "generating",
      videoTitle: transcriptResult.title,
      progressMessage: "Generando preguntas...",
    });

    logJob("Starting LLM generation", {
      jobId,
      questionCount: job.input.questionCount,
      questionTypes: job.input.questionTypes,
      transcriptLength: transcriptResult.transcript.length,
      transcriptPreview: transcriptResult.transcript.slice(0, 200),
    });

    const quiz = await generateQuizFromTranscript({
      transcript: transcriptResult.transcript,
      title: transcriptResult.title,
      questionCount: job.input.questionCount,
      questionTypes: job.input.questionTypes,
    });

    logJob("Quiz generated successfully", {
      jobId,
      title: quiz.title,
      questionsCount: quiz.questions.length,
    });

    logJob("LLM generation completed", {
      jobId,
      providerUsed: quiz.providerUsed,
      questions: quiz.questions.length,
    });

    updateJob(jobId, {
      status: "ready",
      progressMessage: "Quiz listo para jugar.",
      quiz,
    });

    logJob("Job completed", { jobId, status: "ready" });
  } catch (error) {
    const appError =
      error instanceof AppError
        ? error
        : new AppError(
            "JOB_FAILED",
            "No se pudo completar el procesamiento del video.",
            500,
          );

    logJob("Job failed", {
      jobId,
      errorCode: appError.code,
      errorMessage: appError.message,
    });

    updateJob(jobId, {
      status: "failed",
      progressMessage: "No pudimos completar el quiz.",
      errorCode: appError.code,
      errorMessage: appError.message,
    });
  }
};

export const createQuizJob = (payload: ProcessQuizRequest): JobState => {
  const input = toRequiredInput(payload);
  const existingJob = findActiveJobByInput(input);

  if (existingJob) {
    logJob("Reusing active job for same input", {
      jobId: existingJob.id,
      status: existingJob.status,
    });
    return existingJob;
  }

  const id = crypto.randomUUID();
  const now = nowIso();

  const job: JobState = {
    id,
    status: "queued",
    progressMessage: "Trabajo en cola...",
    createdAt: now,
    updatedAt: now,
    input,
  };

  jobs.set(id, job);

  queueMicrotask(() => {
    processJob(id);
  });

  return job;
};

export const getQuizJob = (jobId: string): JobState => {
  const job = jobs.get(jobId);
  if (!job) {
    throw new AppError(
      "JOB_NOT_FOUND",
      "No existe un trabajo con ese id.",
      404,
    );
  }
  return job;
};

export const getQuizJobResult = (jobId: string) => {
  const job = getQuizJob(jobId);
  if (job.status !== "ready" || !job.quiz) {
    throw new AppError(
      "JOB_NOT_READY",
      "El quiz aun no esta listo. Consulta el estado del job.",
      409,
    );
  }

  return {
    jobId: job.id,
    status: job.status,
    videoTitle: job.videoTitle,
    quiz: {
      title: job.quiz.title,
      summary: job.quiz.summary,
      keyConcepts: job.quiz.keyConcepts,
      providerUsed: job.quiz.providerUsed,
      questions: job.quiz.questions.map((question) => ({
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        options: question.options,
        correctOptionId: question.correctOptionId,
      })),
    },
  };
};

export const evaluateQuizSubmission = (
  jobId: string,
  submission: QuizSubmission,
): QuizEvaluation => {
  const job = getQuizJob(jobId);
  if (!job.quiz) {
    throw new AppError("JOB_NOT_READY", "El quiz aun no esta listo.", 409);
  }

  const answersByQuestion = new Map(
    submission.answers.map((answer) => [answer.questionId, answer.optionId]),
  );

  const conceptMisses = new Map<string, number>();
  let correctAnswers = 0;

  const details = job.quiz.questions.map((question) => {
    const selectedOptionId = answersByQuestion.get(question.id) ?? null;
    const correct = selectedOptionId === question.correctOptionId;

    if (correct) {
      correctAnswers += 1;
    } else {
      for (const concept of question.concepts) {
        conceptMisses.set(concept, (conceptMisses.get(concept) ?? 0) + 1);
      }
    }

    return {
      questionId: question.id,
      correct,
      correctOptionId: question.correctOptionId,
      selectedOptionId,
      explanation: question.explanation,
    };
  });

  const sortedConcepts = Array.from(conceptMisses.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([concept]) => concept)
    .slice(0, 5);

  return {
    totalQuestions: job.quiz.questions.length,
    correctAnswers,
    score:
      job.quiz.questions.length === 0
        ? 0
        : Math.round((correctAnswers / job.quiz.questions.length) * 100),
    conceptReinforcement: sortedConcepts,
    details,
  };
};
