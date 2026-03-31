import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { zodToJsonSchema } from "zod-to-json-schema";
import { env } from "./config/env";
import { quizRoutes } from "./routes/quiz.routes";
import { toErrorPayload } from "./utils/errors";

const app = new Elysia()
  .use(
    openapi({
      provider: "swagger-ui",
      mapJsonSchema: {
        zod: zodToJsonSchema,
      },
      documentation: {
        info: {
          title: "ClipQuiz API",
          description: "API para procesar videos de YouTube y generar quizzes con IA.",
          version: "1.0.0",
        },
        tags: [
          {
            name: "quiz",
            description: "Jobs, resultados y evaluacion del quiz.",
          },
        ],
      },
      swagger: {
        version: "latest",
        deepLinking: true,
        displayRequestDuration: true,
        filter: true,
      },
    })
  )
  .use(
    cors({
      origin: [
        /.*\.raixslabs\.com$/,
        /.*\.traefik\.me$/,
        /http:\/\/localhost:\d+$/,
      ], // Permitir solo subdominios de raixslabs.com
      // origin: true, // Permitir todas las fuentes (en producción, restringir a tu frontend)
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  .get("/health", () => ({
    ok: true,
    service: "clipquiz-backend",
    timestamp: new Date().toISOString(),
  }))
  .use(quizRoutes)
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      const validationError = error as { message?: string; all?: Array<{ message?: string }> };
      set.status = 400;

      return {
        error: {
          code: "VALIDATION",
          message:
            validationError.all?.[0]?.message ??
            validationError.message ??
            "Payload invalido.",
        },
      };
    }

    const payload = toErrorPayload(error);
    set.status = payload.status;
    return payload.body;
  })
  .listen(env.PORT);

console.log(`ClipQuiz backend running on port ${app.server?.port}`);
