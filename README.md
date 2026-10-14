# Faij AI 🤖

**Faij AI** is an AI-powered chat website designed to help with learning, coding, creativity, and everyday questions.

## ✨ Features

- AI-powered chat using Google Gemini
- Educational explanations in Hindi and English
- Coding assistance
- Simple web interface
- Secure backend API integration
- Request rate limiting
- Basic security headers
- Cross-origin request protection

## 🛠️ Technology Stack

### Frontend
- HTML
- CSS
- JavaScript
- GitHub Pages

### Backend
- Node.js
- Express.js
- Google Gemini API
- Render

## 🚀 Backend Deployment on Render

### 1. Service Configuration

Configure your Render Web Service with these settings:

- **Runtime:** Node
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Root Directory:** Leave blank if the backend files are in the repository root. Otherwise, specify the backend folder.

### 2. Environment Variables

Add the following environment variables in your Render dashboard:

| Variable | Value |
|---|---|
| `AI_API_KEY` | Your valid Google Gemini API key |
| `AI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| `AI_MODEL` | `gemini-2.5-flash` |
| `ALLOWED_ORIGINS` | `https://faijraja786.github.io` |
| `RATE_LIMIT_PER_MINUTE` | `15` |

**Security:** Never publish your API key in GitHub files, frontend JavaScript, screenshots, or chat messages. Store it only in the backend environment variables.

## 🔗 API Endpoints

### Health Check

`GET /health`

Checks whether the backend is running and whether an API key is configured.

Example response:

```json
{
  "ok": true,
  "configured": true,
  "provider": "Gemini",
  "model": "gemini-2.5-flash"
}
