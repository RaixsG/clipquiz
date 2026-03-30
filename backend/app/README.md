# ClipQuiz Backend (Bun + Elysia)

Backend API para procesar videos de YouTube y generar quizzes con IA.

## Requisitos

- Bun instalado
- Al menos una API key de proveedor IA:
	- OpenRouter
	- Groq
	- Cerebras

## Instalacion

```bash
bun install
```

## Variables de entorno

Crea un archivo `.env` en `backend/app`.

```bash
PORT=3000
MAX_VIDEO_MINUTES=30
LLM_TIMEOUT_SECONDS=20
JOB_TTL_SECONDS=1800

OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4.1-mini

GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

CEREBRAS_API_KEY=
CEREBRAS_MODEL=llama-4-scout-17b-16e-instruct
```

## Desarrollo

```bash
bun run dev
```

## Endpoints

### Health

- `GET /health`

### Crear job de quiz

- `POST /api/quiz/jobs`

Body:

```json
{
	"youtubeUrl": "https://www.youtube.com/watch?v=...",
	"questionCount": 10,
	"questionTypes": ["multiple_choice", "true_false"]
}
```

Respuesta:

```json
{
	"jobId": "uuid",
	"status": "queued",
	"progressMessage": "Trabajo en cola..."
}
```

### Consultar estado

- `GET /api/quiz/jobs/:jobId`

Estados posibles: `queued`, `validating`, `extracting`, `analyzing`, `generating`, `ready`, `failed`.

### Obtener quiz final

- `GET /api/quiz/jobs/:jobId/result`

Disponible cuando el job este en `ready`.

### Enviar respuestas y obtener score

- `POST /api/quiz/jobs/:jobId/submit`

Body:

```json
{
	"answers": [
		{ "questionId": "q1", "optionId": "q1_o2" },
		{ "questionId": "q2", "optionId": "q2_o1" }
	]
}
```

Respuesta:

```json
{
	"jobId": "uuid",
	"totalQuestions": 10,
	"correctAnswers": 8,
	"score": 80,
	"conceptReinforcement": ["Concepto A", "Concepto B"],
	"details": []
}
```

## Notas

- Estrategia IA: round-robin entre los proveedores configurados, con fallback automatico si uno falla.
- Si un video no tiene subtitulos o excede `MAX_VIDEO_MINUTES`, el job termina en `failed` con mensaje amigable.