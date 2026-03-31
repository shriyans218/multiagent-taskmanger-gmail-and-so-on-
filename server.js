require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*", credentials: true }));

// ─── OAuth2 client ──────────────────────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

let storedTokens = null;

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function getGmail() {
  if (!storedTokens) throw new Error("Not authenticated. Visit /auth/login first.");
  oauth2Client.setCredentials(storedTokens);
  return google.gmail({ version: "v1", auth: oauth2Client });
}

function decodeBase64(data) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractBody(payload) {
  if (!payload) return "";
  if (payload.body?.data) return decodeBase64(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data)
        return decodeBase64(part.body.data);
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data)
        return decodeBase64(part.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }
  return "";
}

function getHeader(headers, name) {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function makeRawEmail({ to, subject, body, replyToMessageId }) {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ];
  if (replyToMessageId) {
    lines.splice(2, 0, `In-Reply-To: ${replyToMessageId}`, `References: ${replyToMessageId}`);
  }
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

// ─── Auth routes ────────────────────────────────────────────────────────────

app.get("/auth/login", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
  res.redirect(url);
});

app.get("/auth/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).json({ error });
  try {
    const { tokens } = await oauth2Client.getToken(code);
    storedTokens = tokens;
    oauth2Client.setCredentials(tokens);
    res.send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#0f0f0f;color:white">
        <h2 style="color:#4ade80">✓ Gmail connected successfully</h2>
        <p style="color:#aaa">You can close this tab and return to APEX.</p>
        <script>window.opener?.postMessage('gmail_connected','*');setTimeout(()=>window.close(),2000)</script>
      </body></html>
    `);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/auth/status", (req, res) => {
  res.json({ connected: !!storedTokens });
});

app.post("/auth/logout", async (req, res) => {
  if (storedTokens?.access_token) {
    try { await oauth2Client.revokeToken(storedTokens.access_token); } catch { }
  }
  storedTokens = null;
  res.json({ ok: true });
});

// ─── Profile ────────────────────────────────────────────────────────────────

app.get("/profile", async (req, res) => {
  try {
    const gmail = getGmail();
    const profile = await gmail.users.getProfile({ userId: "me" });
    res.json({ email: profile.data.emailAddress, messagesTotal: profile.data.messagesTotal });
  } catch (err) {
    res.status(err.message.includes("Not authenticated") ? 401 : 500).json({ error: err.message });
  }
});

// ─── List emails ─────────────────────────────────────────────────────────────
// GET /emails?maxResults=10&query=is:unread

app.get("/emails", async (req, res) => {
  try {
    const gmail = getGmail();
    const maxResults = parseInt(req.query.maxResults) || 10;
    const q = req.query.query || "";

    const listRes = await gmail.users.messages.list({ userId: "me", maxResults, q });
    const messages = listRes.data.messages || [];
    if (messages.length === 0) return res.json({ emails: [] });

    const emails = await Promise.all(
      messages.map(async ({ id }) => {
        const msg = await gmail.users.messages.get({
          userId: "me", id, format: "metadata",
          metadataHeaders: ["From", "To", "Subject", "Date"],
        });
        const h = msg.data.payload?.headers || [];
        return {
          id,
          threadId: msg.data.threadId,
          subject: getHeader(h, "Subject") || "(no subject)",
          from: getHeader(h, "From"),
          to: getHeader(h, "To"),
          date: getHeader(h, "Date"),
          snippet: msg.data.snippet || "",
          labelIds: msg.data.labelIds || [],
          isUnread: (msg.data.labelIds || []).includes("UNREAD"),
        };
      })
    );

    res.json({ emails });
  } catch (err) {
    res.status(err.message.includes("Not authenticated") ? 401 : 500).json({ error: err.message });
  }
});

// ─── Read full email body ─────────────────────────────────────────────────────
// GET /emails/:id  (auto marks as read)

app.get("/emails/:id", async (req, res) => {
  try {
    const gmail = getGmail();
    const msg = await gmail.users.messages.get({
      userId: "me", id: req.params.id, format: "full",
    });
    const h = msg.data.payload?.headers || [];
    const body = extractBody(msg.data.payload);

    // Auto mark as read when opened
    if ((msg.data.labelIds || []).includes("UNREAD")) {
      await gmail.users.messages.modify({
        userId: "me", id: req.params.id,
        requestBody: { removeLabelIds: ["UNREAD"] },
      });
    }

    res.json({
      id: msg.data.id,
      threadId: msg.data.threadId,
      subject: getHeader(h, "Subject"),
      from: getHeader(h, "From"),
      to: getHeader(h, "To"),
      date: getHeader(h, "Date"),
      body,
      labelIds: msg.data.labelIds || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Mark single email as read ────────────────────────────────────────────────
// POST /emails/:id/read

app.post("/emails/:id/read", async (req, res) => {
  try {
    const gmail = getGmail();
    await gmail.users.messages.modify({
      userId: "me", id: req.params.id,
      requestBody: { removeLabelIds: ["UNREAD"] },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Mark single email as unread ──────────────────────────────────────────────
// POST /emails/:id/unread

app.post("/emails/:id/unread", async (req, res) => {
  try {
    const gmail = getGmail();
    await gmail.users.messages.modify({
      userId: "me", id: req.params.id,
      requestBody: { addLabelIds: ["UNREAD"] },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Mark ALL as read ─────────────────────────────────────────────────────────
// POST /emails/mark-all-read

app.post("/emails/mark-all-read", async (req, res) => {
  try {
    const gmail = getGmail();
    const listRes = await gmail.users.messages.list({
      userId: "me", q: "is:unread", maxResults: 50,
    });
    const messages = listRes.data.messages || [];
    if (messages.length === 0) return res.json({ ok: true, marked: 0 });

    await Promise.all(
      messages.map(({ id }) =>
        gmail.users.messages.modify({
          userId: "me", id,
          requestBody: { removeLabelIds: ["UNREAD"] },
        })
      )
    );
    res.json({ ok: true, marked: messages.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Trash single email ───────────────────────────────────────────────────────
// POST /emails/:id/delete

app.post("/emails/:id/delete", async (req, res) => {
  try {
    const gmail = getGmail();
    await gmail.users.messages.trash({ userId: "me", id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Trash multiple emails ────────────────────────────────────────────────────
// POST /emails/delete-bulk  body: { ids: ["id1", "id2", ...] }

app.post("/emails/delete-bulk", async (req, res) => {
  try {
    const gmail = getGmail();
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ error: "ids array required" });
    await Promise.all(ids.map(id => gmail.users.messages.trash({ userId: "me", id })));
    res.json({ ok: true, deleted: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Send email ───────────────────────────────────────────────────────────────
// POST /emails/send  body: { to, subject, body, replyToMessageId?, threadId? }

app.post("/emails/send", async (req, res) => {
  try {
    const gmail = getGmail();
    const { to, subject, body, replyToMessageId, threadId } = req.body;
    if (!to || !subject || !body)
      return res.status(400).json({ error: "to, subject, and body are required" });

    const raw = makeRawEmail({ to, subject, body, replyToMessageId });
    const sendRes = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw, ...(threadId ? { threadId } : {}) },
    });
    res.json({ id: sendRes.data.id, threadId: sendRes.data.threadId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\nAPEX Gmail proxy running at http://localhost:${PORT}`);
  console.log(`→ Connect Gmail: http://localhost:${PORT}/auth/login\n`);
  console.log("Endpoints:");
  console.log("  GET  /auth/status");
  console.log("  GET  /profile");
  console.log("  GET  /emails?query=is:unread&maxResults=10");
  console.log("  GET  /emails/:id                (full body + auto mark read)");
  console.log("  POST /emails/:id/read           mark as read");
  console.log("  POST /emails/:id/unread         mark as unread");
  console.log("  POST /emails/mark-all-read      mark all inbox as read");
  console.log("  POST /emails/:id/delete         trash one email");
  console.log("  POST /emails/delete-bulk        trash many { ids: [...] }");
  console.log("  POST /emails/send               { to, subject, body }\n");
});