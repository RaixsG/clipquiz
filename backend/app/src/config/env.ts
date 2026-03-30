const readNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toMs = (seconds: number) => seconds * 1000;

export const env = {
  PORT: readNumber(Bun.env.PORT, 3000),
  MAX_VIDEO_MINUTES: readNumber(Bun.env.MAX_VIDEO_MINUTES, 30),
  LLM_TIMEOUT_MS: toMs(readNumber(Bun.env.LLM_TIMEOUT_SECONDS, 20)),
  JOB_TTL_MS: toMs(readNumber(Bun.env.JOB_TTL_SECONDS, 1800)),
  OPENROUTER_API_KEY: Bun.env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: Bun.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini",
  GROQ_API_KEY: Bun.env.GROQ_API_KEY,
  GROQ_MODEL: Bun.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  GROQ_STT_MODEL: Bun.env.GROQ_STT_MODEL ?? "whisper-large-v3-turbo",
  CEREBRAS_API_KEY: Bun.env.CEREBRAS_API_KEY,
  CEREBRAS_MODEL:
    Bun.env.CEREBRAS_MODEL ?? "llama-4-scout-17b-16e-instruct",
};
