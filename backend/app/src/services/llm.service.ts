import OpenAI from "openai";
import Cerebras from "@cerebras/cerebras_cloud_sdk";
import { env } from "../config/env";
import type {
  GeneratedQuiz,
  QuestionType,
  QuizOption,
  QuizQuestion,
} from "../types/quiz";
import { AppError } from "../utils/errors";

interface ProviderConfig {
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
  client: OpenAI | Cerebras;
}

interface LlmOutputQuestion {
  type: QuestionType;
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  concepts: string[];
}

interface LlmOutput {
  title: string;
  summary: string;
  keyConcepts: string[];
  questions: LlmOutputQuestion[];
}

const logLlm = (...args: unknown[]) => {
  console.log("[ClipQuiz][LLM]", ...args);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withJitter = (baseMs: number): number => {
  const jitter = Math.floor(baseMs * 0.25 * Math.random());
  return baseMs + jitter;
};

let providerCursor = 0;

const createOpenAIClient = (apiKey: string, baseURL: string) =>
  new OpenAI({ apiKey, baseURL });

const createCerebrasClient = (apiKey: string) => new Cerebras({ apiKey });

const buildProvider = (
  name: "openrouter" | "groq" | "cerebras",
  apiKey: string,
  model: string,
  baseURL?: string,
): ProviderConfig | null => {
  if (!apiKey) return null;

  let client: OpenAI | Cerebras;
  let actualBaseURL = baseURL;

  if (name === "cerebras") {
    client = createCerebrasClient(apiKey);
  } else {
    client = createOpenAIClient(
      apiKey,
      baseURL ||
        (name === "groq"
          ? "https://api.groq.com/openai/v1"
          : "https://openrouter.ai/api/v1"),
    );
    actualBaseURL =
      baseURL ||
      (name === "groq"
        ? "https://api.groq.com/openai/v1"
        : "https://openrouter.ai/api/v1");
  }

  return {
    name,
    baseURL: actualBaseURL || "",
    apiKey,
    model,
    client,
  };
};

const providers: ProviderConfig[] = [
  buildProvider(
    "openrouter",
    env.OPENROUTER_API_KEY ?? "",
    env.OPENROUTER_MODEL,
  ),
  buildProvider("groq", env.GROQ_API_KEY ?? "", env.GROQ_MODEL),
  buildProvider("cerebras", env.CEREBRAS_API_KEY ?? "", env.CEREBRAS_MODEL),
].filter((p): p is ProviderConfig => p !== null);

if (providers.length === 0) {
  throw new Error(
    "No hay proveedores IA configurados. Define al menos una API key en el entorno.",
  );
}

const clampQuestionCount = (value: number): number => {
  if (!Number.isFinite(value)) return 10;
  if (value < 5) return 5;
  if (value > 15) return 15;
  return Math.round(value);
};

const stripCodeFences = (text: string): string =>
  text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

const extractJsonFromText = (text: string): string => {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  return text;
};

const parseLlmJson = (raw: string): LlmOutput => {
  let candidate = stripCodeFences(raw);

  logLlm("Raw LLM response (first 500 chars):", candidate.slice(0, 500));

  try {
    return JSON.parse(candidate) as LlmOutput;
  } catch (firstError) {
    candidate = extractJsonFromText(candidate);
    logLlm(
      "After extractJsonFromText (first 500 chars):",
      candidate.slice(0, 500),
    );
    try {
      return JSON.parse(candidate) as LlmOutput;
    } catch (secondError) {
      logLlm("JSON parse failed. Final candidate:", candidate.slice(0, 1000));
      throw new AppError(
        "LLM_JSON_INVALID",
        "La IA devolvio una respuesta invalida para construir el quiz.",
        502,
      );
    }
  }
};

const normalizeOptions = (
  question: LlmOutputQuestion,
  questionIndex: number,
): { options: QuizOption[]; correctOptionId: string } => {
  const rawOptions = Array.isArray(question.options)
    ? question.options
    : question.type === "true_false"
      ? ["Verdadero", "Falso"]
      : [];

  const cleaned = rawOptions
    .map((item) => item.trim())
    .filter((item, idx, arr) => item.length > 0 && arr.indexOf(item) === idx);

  const fallback =
    question.type === "true_false" ? ["Verdadero", "Falso"] : cleaned;

  const finalOptions = fallback.map((text, idx) => ({
    id: `q${questionIndex + 1}_o${idx + 1}`,
    text,
  }));

  const correctIdx = finalOptions.findIndex(
    (option) =>
      option.text.toLowerCase() === question.correctAnswer.toLowerCase(),
  );

  if (correctIdx < 0) {
    throw new AppError(
      "LLM_QUIZ_INVALID",
      "No se pudo validar la respuesta correcta de una pregunta.",
      502,
    );
  }

  return {
    options: finalOptions,
    correctOptionId: finalOptions[correctIdx].id,
  };
};

const buildPrompt = (params: {
  transcript: string;
  title: string;
  questionCount: number;
  questionTypes: QuestionType[];
}) => {
  const mixHint =
    params.questionTypes.length === 1
      ? params.questionTypes[0]
      : params.questionTypes.join(", ");

  const transcriptSnippet = params.transcript.slice(0, 10000);

  return [
    "Eres un generador experto de quizzes educativos basado en una transcripcion de YouTube.",
    "Responde SOLO JSON valido (sin markdown, sin explicaciones externas).",
    "",
    "Reglas:",
    `- Genera exactamente ${params.questionCount} preguntas.`,
    `- Tipos permitidos: ${mixHint}.`,
    "- Incluye preguntas de nivel practico, no triviales.",
    "- Cada pregunta debe tener una unica respuesta correcta.",
    "- true_false debe usar opciones ['Verdadero','Falso'].",
    "- Incluye entre 5 y 10 conceptos clave del tutorial.",
    "",
    "JSON esperado:",
    "{",
    '  "title": "string",',
    '  "summary": "string",',
    '  "keyConcepts": ["string"],',
    '  "questions": [',
    "    {",
    '      "type": "multiple_choice|true_false",',
    '      "prompt": "string",',
    '      "options": ["string"],',
    '      "correctAnswer": "string",',
    '      "explanation": "string",',
    '      "concepts": ["string"]',
    "    }",
    "  ]",
    "}",
    "",
    `Titulo del video: ${params.title}`,
    "Transcripcion:",
    transcriptSnippet,
  ].join("\n");
};

const askProvider = async (
  provider: ProviderConfig,
  prompt: string,
): Promise<string> => {
  const startedAt = Date.now();
  logLlm("Calling provider", {
    provider: provider.name,
    model: provider.model,
    promptLength: prompt.length,
  });

  const abortController = new AbortController();
  const timeoutId = setTimeout(
    () => abortController.abort(),
    env.LLM_TIMEOUT_MS,
  );

  try {
    let content = "";

    if (provider.name === "cerebras") {
      const cerebrasClient = provider.client as Cerebras;
      const completion = (await cerebrasClient.chat.completions.create(
        {
          model: provider.model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "Responde unicamente en JSON valido.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        },
        {
          signal: abortController.signal,
        },
      )) as { choices: Array<{ message: { content: string | null } }> };
      content = completion?.choices?.[0]?.message?.content ?? "";
    } else {
      const openAIClient = provider.client as OpenAI;
      const completion = await openAIClient.chat.completions.create(
        {
          model: provider.model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "Responde unicamente en JSON valido.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        },
        {
          signal: abortController.signal,
        },
      );
      content = completion?.choices?.[0]?.message?.content ?? "";
    }

    if (!content.trim()) {
      throw new AppError(
        "LLM_EMPTY_RESPONSE",
        "El proveedor de IA no devolvio contenido.",
        502,
      );
    }

    logLlm("Provider response received", {
      provider: provider.name,
      elapsedMs: Date.now() - startedAt,
      contentLength: content.length,
      contentPreview: content.slice(0, 200),
    });

    return content;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const isRetryable =
      message.toLowerCase().includes("limit") ||
      message.toLowerCase().includes("rate") ||
      message.toLowerCase().includes("timeout") ||
      message.toLowerCase().includes("aborted") ||
      message.toLowerCase().includes("429") ||
      message.toLowerCase().includes("503") ||
      message.toLowerCase().includes("500");

    logLlm("Provider request failed", {
      provider: provider.name,
      elapsedMs: Date.now() - startedAt,
      message,
      isRetryable,
    });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const sanitizeAndValidate = (
  llmOutput: LlmOutput,
  providerName: string,
  requestedCount: number,
): GeneratedQuiz => {
  const rawQuestions = Array.isArray(llmOutput.questions)
    ? llmOutput.questions
    : [];

  const concepts = Array.isArray(llmOutput.keyConcepts)
    ? llmOutput.keyConcepts.map((item) => item.trim()).filter(Boolean)
    : [];

  const derivedConcepts = rawQuestions
    .flatMap((question) => (Array.isArray(question?.concepts) ? question.concepts : []))
    .map((concept) => String(concept).trim())
    .filter(Boolean);

  const uniqueConcepts = Array.from(new Set([...concepts, ...derivedConcepts])).slice(0, 10);
  if (uniqueConcepts.length < 3) {
    throw new AppError(
      "LLM_CONCEPTS_INVALID",
      "La IA no genero suficientes conceptos clave (minimo 3).",
      502,
    );
  }
  const minRequiredQuestions = Math.min(5, requestedCount);

  if (rawQuestions.length < minRequiredQuestions) {
    throw new AppError(
      "LLM_QUESTIONS_INVALID",
      `La IA devolvio muy pocas preguntas (${rawQuestions.length}). Minimo requerido: ${minRequiredQuestions}.`,
      502,
    );
  }

  if (rawQuestions.length < requestedCount) {
    logLlm("Provider returned fewer questions than requested; using partial quiz", {
      provider: providerName,
      requestedCount,
      returnedCount: rawQuestions.length,
    });
  }

  const finalQuestionCount = Math.min(requestedCount, rawQuestions.length);

  const questions: QuizQuestion[] = rawQuestions
    .slice(0, finalQuestionCount)
    .map((question, index) => {
      const type: QuestionType =
        question.type === "true_false" ? "true_false" : "multiple_choice";

      const { options, correctOptionId } = normalizeOptions(
        {
          ...question,
          type,
        },
        index,
      );

      if (type === "multiple_choice" && options.length < 3) {
        throw new AppError(
          "LLM_QUIZ_INVALID",
          "Una pregunta de opcion multiple no tiene suficientes opciones.",
          502,
        );
      }

      return {
        id: `q${index + 1}`,
        type,
        prompt: question.prompt?.trim() ?? `Pregunta ${index + 1}`,
        options,
        correctOptionId,
        explanation: question.explanation?.trim() ?? "",
        concepts: Array.isArray(question.concepts)
          ? question.concepts.map((item) => item.trim()).filter(Boolean)
          : [],
      };
    });

  return {
    title: llmOutput.title?.trim() || "Quiz del video",
    summary: llmOutput.summary?.trim() || "Resumen no disponible.",
    keyConcepts: uniqueConcepts,
    questions,
    providerUsed: providerName,
  };
};

export const generateQuizFromTranscript = async (params: {
  transcript: string;
  title: string;
  questionCount: number;
  questionTypes: QuestionType[];
}): Promise<GeneratedQuiz> => {
  const questionCount = clampQuestionCount(params.questionCount);
  const prompt = buildPrompt({
    transcript: params.transcript,
    title: params.title,
    questionCount,
    questionTypes: params.questionTypes,
  });

  const start = providerCursor;
  providerCursor = (providerCursor + 1) % providers.length;

  logLlm("Starting quiz generation", {
    providers: providers.map((provider) => provider.name),
    providerStartIndex: start,
    transcriptLength: params.transcript.length,
    questionCount,
    promptLength: prompt.length,
    promptPreview: prompt.slice(0, 300),
  });

  const providerErrors: string[] = [];

  for (let i = 0; i < providers.length; i += 1) {
    const provider = providers[(start + i) % providers.length];
    try {
      logLlm("Trying provider", { provider: provider.name, attempt: i + 1 });
      const raw = await askProvider(provider, prompt);
      const parsed = parseLlmJson(raw);
      const quiz = sanitizeAndValidate(parsed, provider.name, questionCount);
      logLlm("Provider succeeded", {
        provider: provider.name,
        questions: quiz.questions.length,
      });
      return quiz;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "error desconocido";
      const isLimitError =
        message.toLowerCase().includes("limit") ||
        message.toLowerCase().includes("rate") ||
        message.toLowerCase().includes("quota") ||
        message.toLowerCase().includes("rate_limit") ||
        message.toLowerCase().includes("429") ||
        message.toLowerCase().includes("insufficient") ||
        message.toLowerCase().includes("token") ||
        message.toLowerCase().includes("context");

      logLlm("Provider failed", {
        provider: provider.name,
        message,
        isLimitError,
        willRetry: i < providers.length - 1,
      });
      providerErrors.push(`${provider.name}: ${message}`);

      if (isLimitError && i < providers.length - 1) {
        const baseDelay = Math.min(2000, 300 * 2 ** i);
        const delayMs = withJitter(baseDelay);
        logLlm("Limit error detected, retrying with next provider after delay", {
          delayMs,
        });
        await sleep(delayMs);
      }
    }
  }

  logLlm("All providers failed", { providerErrors });

  throw new AppError(
    "LLM_ALL_PROVIDERS_FAILED",
    `No fue posible generar el quiz con ningun proveedor IA. ${providerErrors.join(" | ")}`,
    503,
  );
};
