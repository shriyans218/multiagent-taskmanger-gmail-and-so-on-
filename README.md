# APEX — Multi-Agent Productivity Assistant

Groq (Llama 3.3 70B) + Gmail OAuth2 proxy backend + React frontend.

---

## Architecture

```
Browser (React)
  │
  ├── Groq API  ──────────────────  Task Agent (in-memory)
  │                                 Email Agent (via proxy)
  └── localhost:3001 (Express)
        └── Gmail API (OAuth2)
```

---

## 1. Google Cloud setup (one-time)

1. Go to https://console.cloud.google.com/apis/credentials
2. Create a project → Enable **Gmail API**
3. Create **OAuth 2.0 Client ID** (Web application)
4. Add authorized redirect URI: `http://localhost:3001/auth/callback`
5. Copy **Client ID** and **Client Secret**

---

## 2. Backend setup

```bash
cd backend
npm install
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env
node server.js
```

Backend runs at **http://localhost:3001**

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /auth/login | Redirect to Google OAuth consent |
| GET | /auth/callback | OAuth callback (set automatically) |
| GET | /auth/status | `{ connected: true/false }` |
| POST | /auth/logout | Revoke token |
| GET | /profile | Logged-in Gmail address |
| GET | /emails | List emails (`?query=is:unread&maxResults=10`) |
| GET | /emails/:id | Full email body |
| POST | /emails/send | Send email `{ to, subject, body }` |
| POST | /emails/:id/read | Mark email as read |

---

## 3. Frontend setup

```bash
cd frontend
npm create vite@latest . -- --template react
# Replace src/App.jsx with the provided App.jsx
npm install
npm run dev
```

Frontend runs at **http://localhost:5173**

Make sure `FRONTEND_ORIGIN=http://localhost:5173` is set in backend `.env`.

---

## 4. Usage

1. Start the backend: `node backend/server.js`
2. Start the frontend: `npm run dev` in the frontend folder
3. Open http://localhost:5173
4. Enter your Groq API key (`gsk_...`)
5. Click **Connect Gmail** → complete OAuth in the popup
6. Start chatting with APEX!

### Example prompts

- *"Add a high priority task: deploy the app by Friday"*
- *"Check my unread emails"*
- *"What emails did I get from my team this week?"*
- *"Mark all tasks done"*
- *"Draft and send an email to alice@example.com about the project update"*

---

## Production notes

- **Token storage**: currently in-memory — restarts clear the session. Use a database or encrypted file to persist tokens.
- **HTTPS**: required for production OAuth. Use a reverse proxy (nginx) with Let's Encrypt.
- **Rate limits**: Groq free tier is 30 req/min. Gmail API quota is 250 units/second.
