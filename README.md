# Faij AI Backend

## Render settings
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Root directory: blank if files are in repository root; otherwise set the backend folder.

## Render Environment variables
- `AI_API_KEY`: secret key from your provider
- `AI_BASE_URL`: OpenAI-compatible API base URL (default `https://api.openai.com/v1`)
- `AI_MODEL`: a model available to your provider account
- `ALLOWED_ORIGINS`: `https://faijraja786.github.io` (adjust if your Pages origin differs)
- `RATE_LIMIT_PER_MINUTE`: optional, default `15`

Never put a real API key in frontend code, GitHub commits, screenshots, or chat messages.

## Endpoints
- `GET /` status
- `GET /health` health and key configured status (does not reveal the key)
- `POST /api/chat` JSON body example:
`{"messages":[{"role":"user","content":"Explain photosynthesis in Hindi"}]}`

Response: `{"reply":"...","model":"..."}`

This provides model chat after a valid provider key, base URL, and model are configured. API usage may cost money. It does not yet implement accounts, persistent history, document parsing, web search, image generation, or file uploads.
