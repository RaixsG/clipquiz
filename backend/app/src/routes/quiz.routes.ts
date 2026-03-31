import { Elysia } from "elysia";
import { z } from "zod";
import {
  createQuizJob,
  evaluateQuizSubmission,
  getQuizJob,
  getQuizJobResult,
} from "../services/job.service";

const createJobSchema = z.object({
  youtubeUrl: z.string().url("Debes enviar una URL valida."),
  questionCount: z.number().int().min(5).max(15).optional(),
  questionTypes: z
    .array(z.enum(["multiple_choice", "true_false"]))
    .min(1)
    .max(2)
    .optional(),
});

const submissionSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      optionId: z.string().min(1),
    })
  ),
});

const questionTypeSchema = z.enum(["multiple_choice", "true_false"]);
const jobStatusSchema = z.enum([
  "queued",
  "validating",
  "extracting",
  "analyzing",
  "generating",
  "ready",
  "failed",
]);

const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

const jobStateResponseSchema = z.object({
  jobId: z.string(),
  status: jobStatusSchema,
  progressMessage: z.string(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  updatedAt: z.string(),
});

const createJobResponseSchema = z.object({
  jobId: z.string(),
  status: jobStatusSchema,
  progressMessage: z.string(),
});

const quizOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
});

const quizQuestionPreviewSchema = z.object({
  id: z.string(),
  type: questionTypeSchema,
  prompt: z.string(),
  options: z.array(quizOptionSchema),
  correctOptionId: z.string(),
});

const quizSummarySchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyConcepts: z.array(z.string()),
  providerUsed: z.string(),
  questions: z.array(quizQuestionPreviewSchema),
});

const quizResultResponseSchema = z.object({
  jobId: z.string(),
  status: z.literal("ready"),
  videoTitle: z.string().optional(),
  quiz: quizSummarySchema,
});

const quizEvaluationDetailSchema = z.object({
  questionId: z.string(),
  correct: z.boolean(),
  correctOptionId: z.string(),
  selectedOptionId: z.string().nullable(),
  explanation: z.string(),
});

const quizEvaluationResponseSchema = z.object({
  jobId: z.string(),
  totalQuestions: z.number().int(),
  correctAnswers: z.number().int(),
  score: z.number().int(),
  conceptReinforcement: z.array(z.string()),
  details: z.array(quizEvaluationDetailSchema),
});

const errorResponses = {
  400: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  500: errorResponseSchema,
} as const;

export const quizRoutes = new Elysia({ prefix: "/api/quiz" })
  .post(
    "/jobs",
    ({ body, set }) => {
      const job = createQuizJob(body);
      set.status = 202;

      return {
        jobId: job.id,
        status: job.status,
        progressMessage: job.progressMessage,
      };
    },
    {
      body: createJobSchema,
      detail: {
        summary: "Crear job de quiz",
        description:
          "Valida una URL de YouTube y encola el procesamiento asincrono para generar el quiz.",
        tags: ["quiz"],
      },
      response: {
        202: createJobResponseSchema,
        ...errorResponses,
      },
    }
  )
  .get(
    "/jobs/:jobId",
    ({ params }) => {
      const job = getQuizJob(params.jobId);
      return {
        jobId: job.id,
        status: job.status,
        progressMessage: job.progressMessage,
        errorCode: job.errorCode,
        errorMessage: job.errorMessage,
        updatedAt: job.updatedAt,
      };
    },
    {
      params: z.object({
        jobId: z.string().min(1),
      }),
      detail: {
        summary: "Consultar estado del job",
        description: "Devuelve el progreso actual de un job de quiz.",
        tags: ["quiz"],
      },
      response: {
        200: jobStateResponseSchema,
        ...errorResponses,
      },
    }
  )
  .get(
    "/jobs/:jobId/result",
    ({ params }) => getQuizJobResult(params.jobId),
    {
      params: z.object({
        jobId: z.string().min(1),
      }),
      detail: {
        summary: "Obtener quiz final",
        description:
          "Devuelve el quiz generado cuando el job ya termino correctamente.",
        tags: ["quiz"],
      },
      response: {
        200: quizResultResponseSchema,
        ...errorResponses,
      },
    }
  )
  .post(
    "/jobs/:jobId/submit",
    ({ params, body }) => {
      const evaluation = evaluateQuizSubmission(params.jobId, body);
      return {
        jobId: params.jobId,
        ...evaluation,
      };
    },
    {
      params: z.object({
        jobId: z.string().min(1),
      }),
      body: submissionSchema,
      detail: {
        summary: "Enviar respuestas y obtener score",
        description:
          "Compara las respuestas del usuario con el quiz generado y calcula el resultado.",
        tags: ["quiz"],
      },
      response: {
        200: quizEvaluationResponseSchema,
        ...errorResponses,
      },
    }
  );
