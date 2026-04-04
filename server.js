require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { google } = require("googleapis");

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*", credentials: true }));

// ─── MongoDB connection ──────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✓ MongoDB connected"))
  .catch(err => console.error("✗ MongoDB error:", err.message));

// ─── Mongoose schemas ────────────────────────────────────────────────────────
const taskSchema = new mongoose.Schema({
  id:        { type: String, required: true, unique: true },
  title:     { type: String, required: true },
  done:      { type: Boolean, default: false },
  priority:  { type: String, enum: ["high", "medium", "low"], default: "medium" },
  due_date:  { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const noteSchema = new mongoose.Schema({
  id:        { type: String, required: true, unique: true },
  title:     { type: String, required: true },
  content:   { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Task = mongoose.model("Task", taskSchema);
const Note = mongoose.model("Note", noteSchema);

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
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

// ─── Google API helpers ──────────────────────────────────────────────────────
function getAuth() {
  if (!storedTokens) throw new Error("Not authenticated. Visit /auth/login first.");
  oauth2Client.setCredentials(storedTokens);
  return oauth2Client;
}
function getGmail() { return google.gmail({ version: "v1", auth: getAuth() }); }
function getCalendar() { return google.calendar({ version: "v3", auth: getAuth() }); }

function decodeBase64(data) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}
function extractBody(payload) {
  if (!payload) return "";
  if (payload.body?.data) return decodeBase64(payload.body.data);
  if (payload.parts) {
    for (const p of payload.parts) {
      if (p.mimeType === "text/plain" && p.body?.data) return decodeBase64(p.body.data);
    }
    for (const p of payload.parts) {
      if (p.mimeType === "text/html" && p.body?.data)
        return decodeBase64(p.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }
  return "";
}
function getHeader(headers, name) {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}
function makeRawEmail({ to, subject, body, replyToMessageId }) {
  const lines = [`To: ${to}`, `Subject: ${subject}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "", body];
  if (replyToMessageId) lines.splice(2, 0, `In-Reply-To: ${replyToMessageId}`, `References: ${replyToMessageId}`);
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/auth/login", (req, res) => {
  const url = oauth2Client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES });
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
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#0c0c0e;color:white">
        <h2 style="color:#f5a623">✓ Google account connected!</h2>
        <p style="color:#a0a0b8">Gmail + Calendar are now active. You can close this tab.</p>
        <script>window.opener?.postMessage('gmail_connected','*');setTimeout(()=>window.close(),2000)</script>
      </body></html>
    `);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/auth/status", (req, res) => res.json({ connected: !!storedTokens }));

app.post("/auth/logout", async (req, res) => {
  if (storedTokens?.access_token) {
    try { await oauth2Client.revokeToken(storedTokens.access_token); } catch {}
  }
  storedTokens = null;
  res.json({ ok: true });
});

app.get("/profile", async (req, res) => {
  try {
    const gmail = getGmail();
    const profile = await gmail.users.getProfile({ userId: "me" });
    res.json({ email: profile.data.emailAddress });
  } catch (err) {
    res.status(err.message.includes("Not authenticated") ? 401 : 500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TASKS — MongoDB persistent
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/tasks", async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 }).lean();
    res.json({ tasks });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/tasks", async (req, res) => {
  try {
    const { id, title, priority, due_date } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });
    const task = await Task.create({
      id: id || `t${Date.now()}`,
      title, priority: priority || "medium", due_date: due_date || null,
    });
    const all = await Task.find().sort({ createdAt: -1 }).lean();
    res.json({ task, tasks: all });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/tasks/:id", async (req, res) => {
  try {
    await Task.findOneAndUpdate({ id: req.params.id }, { ...req.body, updatedAt: new Date() });
    const tasks = await Task.find().sort({ createdAt: -1 }).lean();
    res.json({ tasks });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/tasks/:id", async (req, res) => {
  try {
    await Task.deleteOne({ id: req.params.id });
    const tasks = await Task.find().sort({ createdAt: -1 }).lean();
    res.json({ tasks });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/tasks/completed/all", async (req, res) => {
  try {
    await Task.deleteMany({ done: true });
    const tasks = await Task.find().sort({ createdAt: -1 }).lean();
    res.json({ tasks });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTES — MongoDB persistent
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/notes", async (req, res) => {
  try {
    const notes = await Note.find().sort({ updatedAt: -1 }).lean();
    res.json({ notes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/notes", async (req, res) => {
  try {
    const { id, title, content } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });
    const note = await Note.create({ id: id || `n${Date.now()}`, title, content: content || "" });
    const all = await Note.find().sort({ updatedAt: -1 }).lean();
    res.json({ note, notes: all });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch("/notes/:id", async (req, res) => {
  try {
    await Note.findOneAndUpdate({ id: req.params.id }, { ...req.body, updatedAt: new Date() });
    const notes = await Note.find().sort({ updatedAt: -1 }).lean();
    res.json({ notes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/notes/:id", async (req, res) => {
  try {
    await Note.deleteOne({ id: req.params.id });
    const notes = await Note.find().sort({ updatedAt: -1 }).lean();
    res.json({ notes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR — Google Calendar API
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/calendar/events", async (req, res) => {
  try {
    const cal = getCalendar();
    const days = parseInt(req.query.days) || 7;
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + days * 86400000).toISOString();
    const result = await cal.events.list({
      calendarId: "primary", timeMin, timeMax,
      maxResults: 20, singleEvents: true, orderBy: "startTime",
    });
    const events = (result.data.items || []).map(e => ({
      id: e.id,
      title: e.summary || "(no title)",
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      description: e.description || "",
      location: e.location || "",
      allDay: !e.start?.dateTime,
    }));
    res.json({ events });
  } catch (err) {
    res.status(err.message.includes("Not authenticated") ? 401 : 500).json({ error: err.message });
  }
});

app.post("/calendar/events", async (req, res) => {
  try {
    const cal = getCalendar();
    const { title, start, end, description, location } = req.body;
    if (!title || !start) return res.status(400).json({ error: "title and start are required" });
    const endTime = end || new Date(new Date(start).getTime() + 3600000).toISOString();
    const fixTZ = (dt) => {
      if (!dt) return dt;
      if (dt.endsWith("Z") || dt.includes("+")) return dt;
      return dt + "+05:30";
    };
    const event = await cal.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: title,
        description: description || "",
        location: location || "",
        start: { dateTime: fixTZ(start), timeZone: "Asia/Kolkata" },
        end: { dateTime: fixTZ(endTime), timeZone: "Asia/Kolkata" },
      },
    });
    res.json({ id: event.data.id, title: event.data.summary, start: event.data.start?.dateTime });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/calendar/events/:id", async (req, res) => {
  try {
    const cal = getCalendar();
    await cal.events.delete({ calendarId: "primary", eventId: req.params.id });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EMAILS — Gmail API
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/emails", async (req, res) => {
  try {
    const gmail = getGmail();
    const query = req.query.query || "";
    const maxResults = parseInt(req.query.maxResults) || 15;
    const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults });
    const ids = (list.data.messages || []).map(m => m.id);
    const emails = await Promise.all(ids.map(async id => {
      const msg = await gmail.users.messages.get({ userId: "me", id, format: "metadata", metadataHeaders: ["From","To","Subject","Date"] });
      const h = msg.data.payload?.headers || [];
      return {
        id, snippet: msg.data.snippet,
        from: getHeader(h, "From"), to: getHeader(h, "To"),
        subject: getHeader(h, "Subject"), date: getHeader(h, "Date"),
        isUnread: msg.data.labelIds?.includes("UNREAD"),
      };
    }));
    res.json({ emails });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/emails/:id", async (req, res) => {
  try {
    const gmail = getGmail();
    const msg = await gmail.users.messages.get({ userId: "me", id: req.params.id, format: "full" });
    const h = msg.data.payload?.headers || [];
    await gmail.users.messages.modify({ userId: "me", id: req.params.id, requestBody: { removeLabelIds: ["UNREAD"] } });
    res.json({
      id: req.params.id,
      from: getHeader(h, "From"), to: getHeader(h, "To"),
      subject: getHeader(h, "Subject"), date: getHeader(h, "Date"),
      body: extractBody(msg.data.payload),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/emails/:id/read", async (req, res) => {
  try {
    const gmail = getGmail();
    await gmail.users.messages.modify({ userId: "me", id: req.params.id, requestBody: { removeLabelIds: ["UNREAD"] } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/emails/:id/unread", async (req, res) => {
  try {
    const gmail = getGmail();
    await gmail.users.messages.modify({ userId: "me", id: req.params.id, requestBody: { addLabelIds: ["UNREAD"] } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/emails/mark-all-read", async (req, res) => {
  try {
    const gmail = getGmail();
    const list = await gmail.users.messages.list({ userId: "me", q: "is:unread", maxResults: 50 });
    const ids = (list.data.messages || []).map(m => m.id);
    await Promise.all(ids.map(id => gmail.users.messages.modify({ userId: "me", id, requestBody: { removeLabelIds: ["UNREAD"] } })));
    res.json({ ok: true, marked: ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/emails/:id/delete", async (req, res) => {
  try {
    const gmail = getGmail();
    await gmail.users.messages.trash({ userId: "me", id: req.params.id });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/emails/delete-bulk", async (req, res) => {
  try {
    const gmail = getGmail();
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ error: "ids array required" });
    await Promise.all(ids.map(id => gmail.users.messages.trash({ userId: "me", id })));
    res.json({ ok: true, deleted: ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/emails/send", async (req, res) => {
  try {
    const gmail = getGmail();
    const { to, subject, body, replyToMessageId } = req.body;
    const raw = makeRawEmail({ to, subject, body, replyToMessageId });
    const sent = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
    res.json({ id: sent.data.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── START ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\nAPEX backend running at http://localhost:${PORT}`);
});
