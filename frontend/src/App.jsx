import { useState, useRef, useEffect, useCallback } from "react";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

// ─── Styles ──────────────────────────────────────────────────────────────────
const G = {
  bg0: "#0c0c0e",
  bg1: "#131316",
  bg2: "#1a1a1f",
  bg3: "#222228",
  bg4: "#2a2a32",
  border: "#2e2e38",
  borderHover: "#44445a",
  amber: "#f5a623",
  amberDim: "#f5a62322",
  amberBorder: "#f5a62344",
  text0: "#f0f0f5",
  text1: "#a0a0b8",
  text2: "#606078",
  text3: "#404055",
  green: "#4ade80",
  greenDim: "#4ade8022",
  red: "#f87171",
  redDim: "#f8717122",
  blue: "#60a5fa",
  blueDim: "#60a5fa22",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: ${G.bg0};
    color: ${G.text0};
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    line-height: 1.6;
    height: 100vh;
    overflow: hidden;
  }

  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${G.bg4}; border-radius: 2px; }

  .app { display: flex; height: 100vh; }

  /* Sidebar */
  .sidebar {
    width: 220px;
    min-width: 220px;
    background: ${G.bg1};
    border-right: 1px solid ${G.border};
    display: flex;
    flex-direction: column;
    padding: 0;
  }

  .logo {
    padding: 20px 20px 16px;
    border-bottom: 1px solid ${G.border};
  }
  .logo-mark {
    width: 32px; height: 32px;
    background: ${G.amber};
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'DM Mono', monospace;
    font-weight: 500; font-size: 13px;
    color: ${G.bg0};
    margin-bottom: 10px;
  }
  .logo-title { font-size: 15px; font-weight: 500; color: ${G.text0}; letter-spacing: -0.3px; }
  .logo-sub { font-size: 11px; color: ${G.text2}; font-family: 'DM Mono', monospace; margin-top: 1px; }

  .nav { padding: 12px 10px; flex: 1; overflow-y: auto; }
  .nav-section { margin-bottom: 20px; }
  .nav-label {
    font-size: 10px; font-family: 'DM Mono', monospace;
    color: ${G.text3}; letter-spacing: 1.5px; text-transform: uppercase;
    padding: 0 10px; margin-bottom: 4px;
  }
  .nav-item {
    display: flex; align-items: center; gap: 9px;
    padding: 7px 10px; border-radius: 7px;
    cursor: pointer; color: ${G.text1};
    font-size: 13.5px; font-weight: 400;
    transition: all 0.15s; border: 1px solid transparent;
    position: relative;
  }
  .nav-item:hover { background: ${G.bg3}; color: ${G.text0}; }
  .nav-item.active {
    background: ${G.amberDim}; color: ${G.amber};
    border-color: ${G.amberBorder};
  }
  .nav-item .icon { font-size: 14px; width: 16px; text-align: center; flex-shrink: 0; }
  .nav-badge {
    margin-left: auto;
    background: ${G.amber}; color: ${G.bg0};
    font-size: 10px; font-weight: 500;
    font-family: 'DM Mono', monospace;
    padding: 1px 6px; border-radius: 10px; min-width: 18px; text-align: center;
  }

  .gmail-status {
    padding: 12px 14px;
    border-top: 1px solid ${G.border};
    display: flex; align-items: center; gap: 8px;
  }
  .status-dot {
    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    transition: background 0.3s;
  }
  .status-text { font-size: 11px; color: ${G.text2}; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .status-btn {
    font-size: 10px; padding: 3px 8px; border-radius: 5px; cursor: pointer;
    font-family: 'DM Mono', monospace; border: 1px solid;
    transition: all 0.15s; white-space: nowrap; flex-shrink: 0;
  }
  .btn-connect { border-color: ${G.amberBorder}; color: ${G.amber}; background: ${G.amberDim}; }
  .btn-connect:hover { background: ${G.amber}22; }
  .btn-disconnect { border-color: ${G.border}; color: ${G.text2}; background: transparent; }
  .btn-disconnect:hover { border-color: ${G.red}44; color: ${G.red}; }

  /* Main content */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

  .topbar {
    padding: 14px 24px;
    border-bottom: 1px solid ${G.border};
    display: flex; align-items: center; gap: 12px;
    background: ${G.bg1};
  }
  .topbar-title { font-size: 15px; font-weight: 500; color: ${G.text0}; flex: 1; }
  .topbar-meta { font-size: 11px; color: ${G.text2}; font-family: 'DM Mono', monospace; }

  .content { flex: 1; overflow: hidden; display: flex; }

  /* ── Chat ── */
  .chat-wrap { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
  .messages {
    flex: 1; overflow-y: auto; padding: 20px 24px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .msg { display: flex; flex-direction: column; max-width: 75%; }
  .msg.user { align-self: flex-end; align-items: flex-end; }
  .msg.assistant { align-self: flex-start; align-items: flex-start; }

  .msg-agent-row { display: flex; gap: 5px; margin-bottom: 5px; flex-wrap: wrap; }
  .agent-chip {
    font-size: 10px; font-family: 'DM Mono', monospace;
    padding: 2px 7px; border-radius: 4px; font-weight: 400;
    letter-spacing: 0.3px;
  }
  .chip-task { background: #4ade8018; color: #4ade80; border: 1px solid #4ade8030; }
  .chip-email { background: #f5a62318; color: #f5a623; border: 1px solid #f5a62330; }

  .msg-bubble {
    padding: 10px 14px; border-radius: 10px;
    font-size: 13.5px; line-height: 1.65;
    border: 1px solid;
  }
  .msg.user .msg-bubble {
    background: ${G.amber}; color: ${G.bg0};
    border-color: ${G.amber}; font-weight: 400;
    border-radius: 10px 10px 3px 10px;
  }
  .msg.assistant .msg-bubble {
    background: ${G.bg2}; color: ${G.text0};
    border-color: ${G.border};
    border-radius: 10px 10px 10px 3px;
  }
  .msg-time { font-size: 10px; color: ${G.text3}; font-family: 'DM Mono', monospace; margin-top: 4px; padding: 0 2px; }

  .typing {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; background: ${G.bg2}; border: 1px solid ${G.border};
    border-radius: 10px 10px 10px 3px; width: fit-content;
    color: ${G.text2}; font-size: 12px;
  }
  .dots { display: flex; gap: 4px; }
  .dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: ${G.text2};
    animation: blink 1.2s infinite;
  }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes blink { 0%,100%{opacity:.2} 50%{opacity:1} }

  .chat-footer {
    padding: 16px 24px;
    border-top: 1px solid ${G.border};
    background: ${G.bg1};
  }
  .quick-prompts { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
  .qp {
    font-size: 11px; padding: 4px 10px; border-radius: 5px;
    border: 1px solid ${G.border}; background: transparent;
    color: ${G.text2}; cursor: pointer; font-family: 'DM Mono', monospace;
    transition: all 0.15s;
  }
  .qp:hover { border-color: ${G.amberBorder}; color: ${G.amber}; background: ${G.amberDim}; }

  .input-row { display: flex; gap: 8px; }
  .chat-input {
    flex: 1; padding: 10px 14px;
    background: ${G.bg2}; border: 1px solid ${G.border};
    border-radius: 8px; color: ${G.text0};
    font-size: 13.5px; font-family: 'DM Sans', sans-serif;
    outline: none; transition: border-color 0.15s;
  }
  .chat-input::placeholder { color: ${G.text3}; }
  .chat-input:focus { border-color: ${G.amberBorder}; }
  .send-btn {
    padding: 10px 18px; border-radius: 8px; border: none;
    background: ${G.amber}; color: ${G.bg0};
    font-size: 13px; font-weight: 500; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: all 0.15s; white-space: nowrap;
  }
  .send-btn:disabled { background: ${G.bg4}; color: ${G.text3}; cursor: not-allowed; }
  .send-btn:not(:disabled):hover { background: #fbbf24; }

  /* ── Tasks ── */
  .panel { flex: 1; overflow-y: auto; padding: 20px 24px; }
  .panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .stat-row { display: flex; gap: 10px; margin-bottom: 20px; }
  .stat-card {
    flex: 1; background: ${G.bg2}; border: 1px solid ${G.border};
    border-radius: 8px; padding: 12px 16px; text-align: center;
  }
  .stat-num { font-size: 24px; font-weight: 400; font-family: 'DM Mono', monospace; }
  .stat-lbl { font-size: 11px; color: ${G.text2}; margin-top: 2px; }

  .add-btn {
    font-size: 12px; padding: 6px 14px; border-radius: 6px;
    border: 1px solid ${G.amberBorder}; background: ${G.amberDim};
    color: ${G.amber}; cursor: pointer; font-family: 'DM Mono', monospace;
    transition: all 0.15s;
  }
  .add-btn:hover { background: ${G.amber}33; }

  .task-list { display: flex; flex-direction: column; gap: 6px; }
  .task-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; background: ${G.bg2};
    border: 1px solid ${G.border}; border-radius: 8px;
    transition: all 0.15s;
  }
  .task-item:hover { border-color: ${G.borderHover}; }
  .task-item.done { opacity: 0.4; }
  .task-cb { cursor: pointer; accent-color: ${G.amber}; width: 15px; height: 15px; flex-shrink: 0; }
  .prio-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .task-title { flex: 1; font-size: 13.5px; }
  .task-item.done .task-title { text-decoration: line-through; }
  .task-due { font-size: 11px; color: ${G.text2}; font-family: 'DM Mono', monospace; }
  .prio-badge {
    font-size: 10px; padding: 2px 7px; border-radius: 4px;
    font-family: 'DM Mono', monospace;
  }
  .prio-high { background: ${G.red}18; color: ${G.red}; border: 1px solid ${G.red}30; }
  .prio-medium { background: ${G.amber}18; color: ${G.amber}; border: 1px solid ${G.amber}30; }
  .prio-low { background: ${G.green}18; color: ${G.green}; border: 1px solid ${G.green}30; }
  .del-btn {
    border: none; background: none; color: ${G.text3};
    cursor: pointer; font-size: 16px; padding: 0 2px; line-height: 1;
    transition: color 0.15s;
  }
  .del-btn:hover { color: ${G.red}; }

  .empty-state {
    text-align: center; padding: 60px 0;
    color: ${G.text3}; font-size: 13px;
    font-family: 'DM Mono', monospace;
  }
  .empty-state .em-icon { font-size: 28px; margin-bottom: 10px; }

  /* ── Emails ── */
  .email-layout { display: flex; flex: 1; overflow: hidden; }
  .email-list {
    width: 360px; min-width: 360px;
    border-right: 1px solid ${G.border};
    overflow-y: auto;
    display: flex; flex-direction: column;
  }
  .email-toolbar {
    padding: 12px 16px;
    border-bottom: 1px solid ${G.border};
    display: flex; gap: 6px; align-items: center;
    background: ${G.bg1}; flex-shrink: 0;
  }
  .toolbar-btn {
    font-size: 11px; padding: 4px 10px; border-radius: 5px;
    border: 1px solid ${G.border}; background: transparent;
    color: ${G.text1}; cursor: pointer;
    font-family: 'DM Mono', monospace; transition: all 0.15s;
  }
  .toolbar-btn:hover { border-color: ${G.borderHover}; color: ${G.text0}; }
  .toolbar-btn.danger:hover { border-color: ${G.red}44; color: ${G.red}; background: ${G.redDim}; }

  .email-item {
    padding: 12px 16px; border-bottom: 1px solid ${G.border};
    cursor: pointer; transition: background 0.12s;
    position: relative;
  }
  .email-item:hover { background: ${G.bg2}; }
  .email-item.selected { background: ${G.bg3}; border-left: 2px solid ${G.amber}; }
  .email-item.unread .email-subject { font-weight: 500; color: ${G.text0}; }
  .unread-bar {
    position: absolute; left: 0; top: 50%; transform: translateY(-50%);
    width: 3px; height: 60%; background: ${G.amber}; border-radius: 0 2px 2px 0;
  }
  .email-from { font-size: 12px; color: ${G.text1}; margin-bottom: 3px; display: flex; justify-content: space-between; }
  .email-date-small { font-size: 10px; color: ${G.text3}; font-family: 'DM Mono', monospace; }
  .email-subject { font-size: 13px; color: ${G.text1}; margin-bottom: 3px; }
  .email-snippet { font-size: 11.5px; color: ${G.text2}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .email-detail {
    flex: 1; overflow-y: auto; padding: 24px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .email-detail-header {
    padding-bottom: 16px; border-bottom: 1px solid ${G.border};
  }
  .detail-subject { font-size: 17px; font-weight: 500; color: ${G.text0}; margin-bottom: 10px; line-height: 1.4; }
  .detail-meta { display: flex; flex-direction: column; gap: 4px; }
  .detail-meta-row { display: flex; gap: 8px; font-size: 12px; }
  .detail-meta-label { color: ${G.text3}; font-family: 'DM Mono', monospace; width: 40px; flex-shrink: 0; }
  .detail-meta-val { color: ${G.text1}; }
  .detail-body {
    font-size: 13.5px; color: ${G.text1}; line-height: 1.75;
    white-space: pre-wrap; word-break: break-word;
  }
  .detail-actions { display: flex; gap: 8px; }
  .action-btn {
    font-size: 12px; padding: 6px 14px; border-radius: 6px;
    border: 1px solid ${G.border}; background: transparent;
    color: ${G.text1}; cursor: pointer; font-family: 'DM Mono', monospace;
    transition: all 0.15s;
  }
  .action-btn:hover { border-color: ${G.borderHover}; color: ${G.text0}; }
  .action-btn.del:hover { border-color: ${G.red}44; color: ${G.red}; background: ${G.redDim}; }
  .action-btn.reply:hover { border-color: ${G.amberBorder}; color: ${G.amber}; background: ${G.amberDim}; }

  .no-email-selected {
    flex: 1; display: flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 10px; color: ${G.text3};
    font-family: 'DM Mono', monospace; font-size: 13px;
  }

  /* Loading spinner */
  .spin {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid ${G.bg4}; border-top-color: ${G.amber};
    animation: spin 0.7s linear infinite; flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Key screen */
  .key-screen {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: ${G.bg0};
  }
  .key-card {
    width: 400px; background: ${G.bg1};
    border: 1px solid ${G.border}; border-radius: 12px;
    padding: 32px;
  }
  .key-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .key-logo-mark {
    width: 40px; height: 40px; background: ${G.amber}; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'DM Mono', monospace; font-weight: 500; font-size: 14px; color: ${G.bg0};
  }
  .key-logo-text .t1 { font-size: 16px; font-weight: 500; color: ${G.text0}; }
  .key-logo-text .t2 { font-size: 11px; color: ${G.text2}; font-family: 'DM Mono', monospace; margin-top: 1px; }
  .key-desc { font-size: 13.5px; color: ${G.text1}; margin-bottom: 20px; line-height: 1.6; }
  .key-desc a { color: ${G.amber}; text-decoration: none; }
  .key-desc a:hover { text-decoration: underline; }
  .key-input {
    width: 100%; padding: 11px 14px; margin-bottom: 12px;
    background: ${G.bg2}; border: 1px solid ${G.border};
    border-radius: 8px; color: ${G.text0};
    font-size: 13px; font-family: 'DM Mono', monospace;
    outline: none; transition: border-color 0.15s;
  }
  .key-input::placeholder { color: ${G.text3}; }
  .key-input:focus { border-color: ${G.amberBorder}; }
  .key-launch {
    width: 100%; padding: 11px; border-radius: 8px; border: none;
    font-size: 14px; font-weight: 500; cursor: pointer;
    font-family: 'DM Sans', sans-serif; transition: all 0.15s;
  }
  .key-launch.active { background: ${G.amber}; color: ${G.bg0}; }
  .key-launch.active:hover { background: #fbbf24; }
  .key-launch.inactive { background: ${G.bg3}; color: ${G.text3}; cursor: not-allowed; }
  .key-note { font-size: 11px; color: ${G.text3}; text-align: center; margin-top: 12px; }
`;

// ─── System prompt ────────────────────────────────────────────────────────────
const buildSystem = (tasks, gmailOk, gmailEmail) => `
You are Aura, a multi-agent productivity assistant. You have two sub-agents:
- task_agent: manages in-memory tasks
- email_agent: reads/sends/deletes Gmail via local proxy (${gmailOk ? `connected as ${gmailEmail}` : "NOT connected"})

Current tasks: ${JSON.stringify(tasks)}
Gmail: ${gmailOk ? "connected" : "not connected"}

Respond in valid JSON only — no markdown, no backticks:
{
  "message": "conversational reply",
  "agent_actions": [{ "agent": "task_agent"|"email_agent", "action": "...", "email_params": { "to":"","subject":"","body":"","query":"","id":"","ids":[] } }],
  "tasks": [{ "id":"t1","title":"","done":false,"priority":"high"|"medium"|"low","due_date":"YYYY-MM-DD or null" }]
}

Task rules: return full updated tasks array when tasks change. Generate ids like "t${Date.now()}".
Email actions: FETCH_EMAILS (email_params.query), READ_EMAIL (email_params.id), SEND_EMAIL (to/subject/body), DELETE_EMAIL (id), DELETE_BULK (ids[]), MARK_READ (id), MARK_ALL_READ.
If Gmail not connected and user asks about email, say to connect Gmail.
Be concise and action-oriented.
`.trim();

const PRIORITY_COLOR = { high: G.red, medium: G.amber, low: G.green };

function fmtTime(d = new Date()) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtEmailDate(str) {
  if (!str) return "";
  try {
    const d = new Date(str);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch { return str.slice(0, 10); }
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const envKey = import.meta.env.VITE_GROQ_API_KEY || "";
  const [apiKey, setApiKey] = useState(envKey);
  const [keySet, setKeySet] = useState(!!envKey);

  const [view, setView] = useState("chat");
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [emailBody, setEmailBody] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [gmailOk, setGmailOk] = useState(false);
  const [gmailEmail, setGmailEmail] = useState("");
  const [gmailChecking, setGmailChecking] = useState(false);

  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Welcome to Aura. I manage your tasks and Gmail. Connect Gmail using the button below to get started.",
    agents: [],
    time: fmtTime()
  }]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const bottomRef = useRef(null);

  const scroll = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);

  const checkGmail = useCallback(async () => {
    setGmailChecking(true);
    try {
      const [s, p] = await Promise.all([
        fetch(`${BACKEND}/auth/status`).then(r => r.json()).catch(() => ({})),
        fetch(`${BACKEND}/profile`).then(r => r.json()).catch(() => ({}))
      ]);
      setGmailOk(!!s.connected);
      if (p.email) setGmailEmail(p.email);
    } catch { setGmailOk(false); }
    setGmailChecking(false);
  }, []);

  useEffect(() => { if (keySet) checkGmail(); }, [keySet, checkGmail]);

  useEffect(() => {
    const h = (e) => { if (e.data === "gmail_connected") checkGmail(); };
    window.addEventListener("message", h);
    return () => window.removeEventListener("message", h);
  }, [checkGmail]);

  const connectGmail = () => window.open(`${BACKEND}/auth/login`, "gmail_oauth", "width=520,height=620");
  const disconnectGmail = async () => {
    await fetch(`${BACKEND}/auth/logout`, { method: "POST" }).catch(() => { });
    setGmailOk(false); setGmailEmail(""); setEmails([]); setSelectedEmail(null); setEmailBody(null);
  };

  const runEmailAction = async (action, params = {}) => {
    if (!gmailOk) return { error: "Gmail not connected" };
    try {
      if (action === "FETCH_EMAILS") {
        const qs = `?maxResults=15${params.query ? `&query=${encodeURIComponent(params.query)}` : ""}`;
        const d = await fetch(`${BACKEND}/emails${qs}`).then(r => r.json());
        if (d.emails) setEmails(d.emails);
        return d;
      }
      if (action === "READ_EMAIL") {
        const d = await fetch(`${BACKEND}/emails/${params.id}`).then(r => r.json());
        if (d.id) {
          setEmails(p => p.map(e => e.id === d.id ? { ...e, isUnread: false } : e));
        }
        return d;
      }
      if (action === "MARK_READ") {
        await fetch(`${BACKEND}/emails/${params.id}/read`, { method: "POST" });
        setEmails(p => p.map(e => e.id === params.id ? { ...e, isUnread: false } : e));
        return { ok: true };
      }
      if (action === "MARK_ALL_READ") {
        const d = await fetch(`${BACKEND}/emails/mark-all-read`, { method: "POST" }).then(r => r.json());
        setEmails(p => p.map(e => ({ ...e, isUnread: false })));
        return d;
      }
      if (action === "DELETE_EMAIL") {
        await fetch(`${BACKEND}/emails/${params.id}/delete`, { method: "POST" });
        setEmails(p => p.filter(e => e.id !== params.id));
        if (selectedEmail?.id === params.id) { setSelectedEmail(null); setEmailBody(null); }
        return { ok: true };
      }
      if (action === "DELETE_BULK") {
        await fetch(`${BACKEND}/emails/delete-bulk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: params.ids }) });
        setEmails(p => p.filter(e => !params.ids.includes(e.id)));
        return { ok: true };
      }
      if (action === "SEND_EMAIL") {
        return await fetch(`${BACKEND}/emails/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) }).then(r => r.json());
      }
    } catch (err) { return { error: err.message }; }
    return {};
  };

  const openEmail = async (email) => {
    setSelectedEmail(email);
    setEmailBody(null);
    setEmailLoading(true);
    try {
      const d = await fetch(`${BACKEND}/emails/${email.id}`).then(r => r.json());
      setEmailBody(d.body || "(no body)");
      setEmails(p => p.map(e => e.id === email.id ? { ...e, isUnread: false } : e));
    } catch { setEmailBody("Failed to load email body."); }
    setEmailLoading(false);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setLoading(true);
    const t = fmtTime();
    setMessages(p => [...p, { role: "user", content: text, agents: [], time: t }]);
    scroll();

    const newHistory = [...history, { role: "user", content: text }];
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL, max_tokens: 1000, temperature: 0.2,
          messages: [{ role: "system", content: buildSystem(tasks, gmailOk, gmailEmail) }, ...newHistory]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const raw = data.choices?.[0]?.message?.content || "";
      let parsed = {};
      try { const m = raw.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); } catch { parsed = { message: raw }; }

      if (parsed.tasks !== undefined) setTasks(parsed.tasks);

      const actions = parsed.agent_actions || [];
      const agentNames = [...new Set(actions.map(a => a.agent).filter(Boolean))];
      let emailCtx = "";

      for (const action of actions) {
        if (action.agent === "email_agent") {
          const result = await runEmailAction(action.action, action.email_params || {});
          if (result?.emails) emailCtx = `\n\nGmail data: ${JSON.stringify(result.emails.slice(0, 8))}`;
          else if (result?.body) emailCtx = `\n\nEmail body: ${result.body.substring(0, 1000)}`;
          else if (result?.id) emailCtx = `\n\nEmail sent (id: ${result.id})`;
          else if (result?.ok) emailCtx = `\n\nAction completed successfully.`;
          else if (result?.error) emailCtx = `\n\nError: ${result.error}`;
        }
      }

      let finalMsg = parsed.message || raw;
      if (emailCtx) {
        const fu = await fetch(GROQ_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: MODEL, max_tokens: 500, temperature: 0.2,
            messages: [
              { role: "system", content: "Summarize the email data concisely in plain text. No JSON, no markdown." },
              { role: "user", content: `User asked: "${text}"${emailCtx}\n\nSummarize helpfully.` }
            ]
          })
        }).then(r => r.json());
        finalMsg = fu.choices?.[0]?.message?.content || finalMsg;
      }

      setMessages(p => [...p, { role: "assistant", content: finalMsg, agents: agentNames, time: fmtTime() }]);
      setHistory([...newHistory, { role: "assistant", content: finalMsg }]);
    } catch (err) {
      setMessages(p => [...p, { role: "assistant", content: `Error: ${err.message}`, agents: [], time: fmtTime() }]);
    }
    setLoading(false);
    scroll();
  };

  const toggleTask = id => setTasks(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const deleteTask = id => setTasks(p => p.filter(t => t.id !== id));

  const pending = tasks.filter(t => !t.done).length;
  const unread = emails.filter(e => e.isUnread).length;

  const QUICK = ["Show my tasks", "Check unread emails", "Mark all emails as read", "Add task: review PR, high priority"];

  const NavItem = ({ id, icon, label, badge }) => (
    <div className={`nav-item${view === id ? " active" : ""}`} onClick={() => setView(id)}>
      <span className="icon">{icon}</span>
      <span>{label}</span>
      {badge > 0 && <span className="nav-badge">{badge}</span>}
    </div>
  );

  if (!keySet) return (
    <>
      <style>{css}</style>
      <div className="key-screen">
        <div className="key-card">
          <div className="key-logo">
            <div className="key-logo-mark">Au</div>
            <div className="key-logo-text">
              <div className="t1">Aura</div>
              <div className="t2">gemini 2.0 flash · gmail</div>
            </div>
          </div>
          <p className="key-desc">Enter your Groq API key to launch. Get one free at <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">console.groq.com</a>.</p>
          <input className="key-input" type="password" placeholder="gsk_..."
            value={apiKey} onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && apiKey.startsWith("gsk_") && setKeySet(true)} />
          <button className={`key-launch ${apiKey.startsWith("gsk_") ? "active" : "inactive"}`}
            onClick={() => setKeySet(true)} disabled={!apiKey.startsWith("gsk_")}>
            Launch Aura
          </button>
          <p className="key-note">Key is used only in this session — sent only to Groq's API.</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-mark">Au</div>
            <div className="logo-title">Aura</div>
            <div className="logo-sub">multi-agent assistant</div>
          </div>

          <nav className="nav">
            <div className="nav-section">
              <div className="nav-label">Workspace</div>
              <NavItem id="chat" icon="◈" label="Chat" badge={0} />
              <NavItem id="tasks" icon="◻" label="Tasks" badge={pending} />
              <NavItem id="emails" icon="◉" label="Emails" badge={unread} />
            </div>
          </nav>

          <div className="gmail-status">
            {gmailChecking
              ? <div className="spin" />
              : <div className="status-dot" style={{ background: gmailOk ? G.green : G.text3 }} />
            }
            <span className="status-text">{gmailOk ? gmailEmail || "Connected" : "Gmail disconnected"}</span>
            {gmailOk
              ? <button className="status-btn btn-disconnect" onClick={disconnectGmail}>out</button>
              : <button className="status-btn btn-connect" onClick={connectGmail}>connect</button>
            }
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          <div className="topbar">
            <span className="topbar-title">
              {view === "chat" && "Chat"}
              {view === "tasks" && "Tasks"}
              {view === "emails" && "Emails"}
            </span>
            <span className="topbar-meta">
              {view === "tasks" && `${pending} pending · ${tasks.filter(t => t.done).length} done`}
              {view === "emails" && `${emails.length} loaded · ${unread} unread`}
              {view === "chat" && "gemini 2.0 flash"}
            </span>
          </div>

          <div className="content">
            {/* ── Chat ── */}
            {view === "chat" && (
              <div className="chat-wrap">
                <div className="messages">
                  {messages.map((m, i) => (
                    <div key={i} className={`msg ${m.role}`}>
                      {m.agents?.length > 0 && (
                        <div className="msg-agent-row">
                          {[...new Set(m.agents)].map((a, j) => (
                            <span key={j} className={`agent-chip ${a === "task_agent" ? "chip-task" : "chip-email"}`}>
                              {a === "task_agent" ? "task agent" : "email agent"}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="msg-bubble">
                        {m.content.split(/\*\*(.*?)\*\*/g).map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
                      </div>
                      <div className="msg-time">{m.time}</div>
                    </div>
                  ))}
                  {loading && (
                    <div className="msg assistant">
                      <div className="typing">
                        <div className="dots">
                          <div className="dot" /><div className="dot" /><div className="dot" />
                        </div>
                        <span>agents working</span>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                <div className="chat-footer">
                  <div className="quick-prompts">
                    {QUICK.map((q, i) => (
                      <button key={i} className="qp" onClick={() => setInput(q)}>{q}</button>
                    ))}
                  </div>
                  <div className="input-row">
                    <input className="chat-input" value={input} onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && send()}
                      placeholder="Ask Aura anything — tasks, emails, actions..." />
                    <button className="send-btn" onClick={send} disabled={loading || !input.trim()}>Send →</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tasks ── */}
            {view === "tasks" && (
              <div className="panel">
                <div className="panel-header">
                  <span style={{ fontSize: 13, color: G.text2, fontFamily: "'DM Mono', monospace" }}>in-memory · resets on reload</span>
                  <button className="add-btn" onClick={() => { setView("chat"); setInput("Add a task: "); }}>+ add via chat</button>
                </div>
                <div className="stat-row">
                  {[["pending", pending, G.amber], ["done", tasks.filter(t => t.done).length, G.green], ["total", tasks.length, G.text1]].map(([l, n, c]) => (
                    <div className="stat-card" key={l}>
                      <div className="stat-num" style={{ color: c }}>{n}</div>
                      <div className="stat-lbl">{l}</div>
                    </div>
                  ))}
                </div>
                {tasks.length === 0 ? (
                  <div className="empty-state">
                    <div className="em-icon">◻</div>
                    no tasks yet — ask Aura in chat
                  </div>
                ) : (
                  <div className="task-list">
                    {tasks.map(t => (
                      <div key={t.id} className={`task-item${t.done ? " done" : ""}`}>
                        <input type="checkbox" className="task-cb" checked={t.done} onChange={() => toggleTask(t.id)} />
                        <div className="prio-dot" style={{ background: PRIORITY_COLOR[t.priority] || PRIORITY_COLOR.medium }} />
                        <span className="task-title">{t.title}</span>
                        {t.due_date && <span className="task-due">{t.due_date}</span>}
                        <span className={`prio-badge prio-${t.priority || "medium"}`}>{t.priority || "medium"}</span>
                        <button className="del-btn" onClick={() => deleteTask(t.id)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Emails ── */}
            {view === "emails" && (
              <div className="email-layout">
                <div className="email-list">
                  <div className="email-toolbar">
                    <button className="toolbar-btn" onClick={() => { setView("chat"); setInput("Check my emails"); }}>fetch</button>
                    <button className="toolbar-btn" onClick={async () => { await runEmailAction("MARK_ALL_READ"); }}>mark all read</button>
                    {selectedEmail && (
                      <button className="toolbar-btn danger" onClick={async () => { await runEmailAction("DELETE_EMAIL", { id: selectedEmail.id }); }}>delete</button>
                    )}
                  </div>
                  {!gmailOk ? (
                    <div className="empty-state" style={{ padding: "40px 20px" }}>
                      <div className="em-icon">◉</div>
                      Gmail not connected
                      <button className="add-btn" style={{ marginTop: 12 }} onClick={connectGmail}>connect gmail</button>
                    </div>
                  ) : emails.length === 0 ? (
                    <div className="empty-state" style={{ padding: "40px 20px" }}>
                      <div className="em-icon">◉</div>
                      no emails loaded<br />
                      <span style={{ fontSize: 11, marginTop: 6, display: "block" }}>ask Aura to fetch emails in chat</span>
                    </div>
                  ) : (
                    emails.map(em => (
                      <div key={em.id} className={`email-item${em.isUnread ? " unread" : ""}${selectedEmail?.id === em.id ? " selected" : ""}`}
                        onClick={() => openEmail(em)}>
                        {em.isUnread && <div className="unread-bar" />}
                        <div className="email-from">
                          <span>{em.from?.replace(/<.*>/, "").trim() || em.from}</span>
                          <span className="email-date-small">{fmtEmailDate(em.date)}</span>
                        </div>
                        <div className="email-subject">{em.subject}</div>
                        <div className="email-snippet">{em.snippet}</div>
                      </div>
                    ))
                  )}
                </div>

                {selectedEmail ? (
                  <div className="email-detail">
                    <div className="email-detail-header">
                      <div className="detail-subject">{selectedEmail.subject}</div>
                      <div className="detail-meta">
                        <div className="detail-meta-row"><span className="detail-meta-label">from</span><span className="detail-meta-val">{selectedEmail.from}</span></div>
                        <div className="detail-meta-row"><span className="detail-meta-label">to</span><span className="detail-meta-val">{selectedEmail.to}</span></div>
                        <div className="detail-meta-row"><span className="detail-meta-label">date</span><span className="detail-meta-val">{selectedEmail.date}</span></div>
                      </div>
                    </div>
                    <div className="detail-actions">
                      <button className="action-btn reply" onClick={() => { setView("chat"); setInput(`Reply to the email from ${selectedEmail.from}: `); }}>↩ reply via chat</button>
                      <button className="action-btn" onClick={() => runEmailAction("MARK_READ", { id: selectedEmail.id })}>mark read</button>
                      <button className="action-btn del" onClick={() => runEmailAction("DELETE_EMAIL", { id: selectedEmail.id })}>trash</button>
                    </div>
                    {emailLoading
                      ? <div style={{ display: "flex", gap: 8, color: G.text2, fontSize: 13 }}><div className="spin" /> Loading...</div>
                      : <div className="detail-body">{emailBody}</div>
                    }
                  </div>
                ) : (
                  <div className="no-email-selected">
                    <span style={{ fontSize: 24 }}>◉</span>
                    select an email to read
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
