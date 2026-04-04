import { useState, useRef, useEffect, useCallback } from "react";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

// ─── Design tokens ────────────────────────────────────────────────────────────
const G = {
  bg0:"#0c0c0e",bg1:"#131316",bg2:"#1a1a1f",bg3:"#222228",bg4:"#2a2a32",
  border:"#2e2e38",borderHover:"#44445a",
  amber:"#f5a623",amberDim:"#f5a62318",amberBorder:"#f5a62340",
  text0:"#f0f0f5",text1:"#a0a0b8",text2:"#606078",text3:"#404055",
  green:"#4ade80",greenDim:"#4ade8018",red:"#f87171",redDim:"#f8717118",
  blue:"#60a5fa",blueDim:"#60a5fa18",purple:"#c084fc",purpleDim:"#c084fc18",
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:${G.bg0};color:${G.text0};font-family:'DM Sans',sans-serif;font-size:14px;line-height:1.6;height:100vh;overflow:hidden}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${G.bg4};border-radius:2px}
.app{display:flex;height:100vh}
.sidebar{width:220px;min-width:220px;background:${G.bg1};border-right:1px solid ${G.border};display:flex;flex-direction:column}
.logo{padding:20px 20px 16px;border-bottom:1px solid ${G.border}}
.logo-mark{width:32px;height:32px;background:${G.amber};border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-weight:500;font-size:13px;color:${G.bg0};margin-bottom:10px}
.logo-title{font-size:15px;font-weight:500;color:${G.text0};letter-spacing:-0.3px}
.logo-sub{font-size:11px;color:${G.text2};font-family:'DM Mono',monospace;margin-top:1px}
.nav{padding:12px 10px;flex:1;overflow-y:auto}
.nav-section{margin-bottom:20px}
.nav-label{font-size:10px;font-family:'DM Mono',monospace;color:${G.text3};letter-spacing:1.5px;text-transform:uppercase;padding:0 10px;margin-bottom:4px}
.nav-item{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:7px;cursor:pointer;color:${G.text1};font-size:13.5px;font-weight:400;transition:all 0.15s;border:1px solid transparent}
.nav-item:hover{background:${G.bg3};color:${G.text0}}
.nav-item.active{background:${G.amberDim};color:${G.amber};border-color:${G.amberBorder}}
.nav-icon{font-size:14px;width:16px;text-align:center;flex-shrink:0}
.nav-badge{margin-left:auto;background:${G.amber};color:${G.bg0};font-size:10px;font-weight:500;font-family:'DM Mono',monospace;padding:1px 6px;border-radius:10px;min-width:18px;text-align:center}
.gmail-status{padding:12px 14px;border-top:1px solid ${G.border};display:flex;align-items:center;gap:8px}
.sdot{width:7px;height:7px;border-radius:50%;flex-shrink:0;transition:background 0.3s}
.stext{font-size:11px;color:${G.text2};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sbtn{font-size:10px;padding:3px 8px;border-radius:5px;cursor:pointer;font-family:'DM Mono',monospace;border:1px solid;transition:all 0.15s;white-space:nowrap;flex-shrink:0}
.sbtn-on{border-color:${G.border};color:${G.text2};background:transparent}
.sbtn-on:hover{border-color:${G.red}44;color:${G.red}}
.sbtn-off{border-color:${G.amberBorder};color:${G.amber};background:${G.amberDim}}
.sbtn-off:hover{background:${G.amber}33}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.topbar{padding:14px 24px;border-bottom:1px solid ${G.border};display:flex;align-items:center;gap:12px;background:${G.bg1}}
.topbar-title{font-size:15px;font-weight:500;color:${G.text0};flex:1}
.topbar-meta{font-size:11px;color:${G.text2};font-family:'DM Mono',monospace}
.content{flex:1;overflow:hidden;display:flex}
/* chat */
.chat-wrap{display:flex;flex-direction:column;flex:1;overflow:hidden}
.messages{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:16px}
.msg{display:flex;flex-direction:column}
.msg.user{align-items:flex-end}
.msg.assistant{align-items:flex-start}
.agent-row{display:flex;gap:5px;margin-bottom:5px;flex-wrap:wrap}
.chip{font-size:10px;font-family:'DM Mono',monospace;padding:2px 7px;border-radius:4px}
.chip-task{background:${G.greenDim};color:${G.green};border:1px solid ${G.green}30}
.chip-email{background:${G.amberDim};color:${G.amber};border:1px solid ${G.amber}30}
.chip-cal{background:${G.blueDim};color:${G.blue};border:1px solid ${G.blue}30}
.chip-note{background:${G.purpleDim};color:${G.purple};border:1px solid ${G.purple}30}
.bubble{padding:10px 14px;border-radius:10px;font-size:13.5px;line-height:1.65;border:1px solid;max-width:80%}
.bubble-user{background:${G.amber};color:${G.bg0};border-color:${G.amber};border-radius:10px 10px 3px 10px}
.bubble-ai{background:${G.bg2};color:${G.text0};border-color:${G.border};border-radius:10px 10px 10px 3px}
.msg-time{font-size:10px;color:${G.text3};font-family:'DM Mono',monospace;margin-top:4px;padding:0 2px}
.typing{display:flex;align-items:center;gap:10px;padding:10px 14px;background:${G.bg2};border:1px solid ${G.border};border-radius:10px 10px 10px 3px;width:fit-content;color:${G.text2};font-size:12px}
.dots{display:flex;gap:4px}
.dot{width:5px;height:5px;border-radius:50%;background:${G.text2};animation:blink 1.2s infinite}
.dot:nth-child(2){animation-delay:0.2s}.dot:nth-child(3){animation-delay:0.4s}
@keyframes blink{0%,100%{opacity:.2}50%{opacity:1}}
.chat-footer{padding:16px 24px;border-top:1px solid ${G.border};background:${G.bg1}}
.qps{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.qp{font-size:11px;padding:4px 10px;border-radius:5px;border:1px solid ${G.border};background:transparent;color:${G.text2};cursor:pointer;font-family:'DM Mono',monospace;transition:all 0.15s}
.qp:hover{border-color:${G.amberBorder};color:${G.amber};background:${G.amberDim}}
.input-row{display:flex;gap:8px}
.cinput{flex:1;padding:10px 14px;background:${G.bg2};border:1px solid ${G.border};border-radius:8px;color:${G.text0};font-size:13.5px;font-family:'DM Sans',sans-serif;outline:none;transition:border-color 0.15s}
.cinput::placeholder{color:${G.text3}}
.cinput:focus{border-color:${G.amberBorder}}
.send-btn{padding:10px 18px;border-radius:8px;border:none;background:${G.amber};color:${G.bg0};font-size:13px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s;white-space:nowrap}
.send-btn:disabled{background:${G.bg4};color:${G.text3};cursor:not-allowed}
.send-btn:not(:disabled):hover{background:#fbbf24}
/* panel */
.panel{flex:1;overflow-y:auto;padding:20px 24px}
.panel-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.stat-row{display:flex;gap:10px;margin-bottom:20px}
.stat-card{flex:1;background:${G.bg2};border:1px solid ${G.border};border-radius:8px;padding:12px 16px;text-align:center}
.stat-num{font-size:24px;font-weight:400;font-family:'DM Mono',monospace}
.stat-lbl{font-size:11px;color:${G.text2};margin-top:2px}
.add-btn{font-size:12px;padding:6px 14px;border-radius:6px;border:1px solid ${G.amberBorder};background:${G.amberDim};color:${G.amber};cursor:pointer;font-family:'DM Mono',monospace;transition:all 0.15s}
.add-btn:hover{background:${G.amber}33}
.task-list{display:flex;flex-direction:column;gap:6px}
.task-item{display:flex;align-items:center;gap:10px;padding:10px 14px;background:${G.bg2};border:1px solid ${G.border};border-radius:8px;transition:all 0.15s}
.task-item:hover{border-color:${G.borderHover}}
.task-item.done{opacity:0.4}
.tcb{cursor:pointer;accent-color:${G.amber};width:15px;height:15px;flex-shrink:0}
.pdot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.ttitle{flex:1;font-size:13.5px}
.task-item.done .ttitle{text-decoration:line-through}
.tdue{font-size:11px;color:${G.text2};font-family:'DM Mono',monospace;white-space:nowrap}
.pbadge{font-size:10px;padding:2px 7px;border-radius:4px;font-family:'DM Mono',monospace}
.p-high{background:${G.red}18;color:${G.red};border:1px solid ${G.red}30}
.p-medium{background:${G.amber}18;color:${G.amber};border:1px solid ${G.amber}30}
.p-low{background:${G.green}18;color:${G.green};border:1px solid ${G.green}30}
.del-btn{border:none;background:none;color:${G.text3};cursor:pointer;font-size:17px;padding:0 2px;line-height:1;transition:color 0.15s;flex-shrink:0}
.del-btn:hover{color:${G.red}}
.empty{text-align:center;padding:60px 0;color:${G.text3};font-size:13px;font-family:'DM Mono',monospace}
.empty-icon{font-size:28px;margin-bottom:10px}
/* emails */
.email-layout{display:flex;flex:1;overflow:hidden}
.email-list{width:340px;min-width:340px;border-right:1px solid ${G.border};overflow-y:auto;display:flex;flex-direction:column}
.etoolbar{padding:12px 16px;border-bottom:1px solid ${G.border};display:flex;gap:6px;align-items:center;background:${G.bg1};flex-shrink:0}
.tbtn{font-size:11px;padding:4px 10px;border-radius:5px;border:1px solid ${G.border};background:transparent;color:${G.text1};cursor:pointer;font-family:'DM Mono',monospace;transition:all 0.15s}
.tbtn:hover{border-color:${G.borderHover};color:${G.text0}}
.tbtn.danger:hover{border-color:${G.red}44;color:${G.red};background:${G.redDim}}
.eitem{padding:12px 16px;border-bottom:1px solid ${G.border};cursor:pointer;transition:background 0.12s;position:relative}
.eitem:hover{background:${G.bg2}}
.eitem.sel{background:${G.bg3};border-left:2px solid ${G.amber}}
.eitem.unread .esubj{font-weight:500;color:${G.text0}}
.ubar{position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:60%;background:${G.amber};border-radius:0 2px 2px 0}
.efrom{font-size:12px;color:${G.text1};margin-bottom:3px;display:flex;justify-content:space-between}
.edate{font-size:10px;color:${G.text3};font-family:'DM Mono',monospace}
.esubj{font-size:13px;color:${G.text1};margin-bottom:3px}
.esnip{font-size:11.5px;color:${G.text2};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.edetail{flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:16px}
.edh{padding-bottom:16px;border-bottom:1px solid ${G.border}}
.esubj-big{font-size:17px;font-weight:500;color:${G.text0};margin-bottom:10px;line-height:1.4}
.emeta{display:flex;flex-direction:column;gap:4px}
.emeta-row{display:flex;gap:8px;font-size:12px}
.emeta-lbl{color:${G.text3};font-family:'DM Mono',monospace;width:40px;flex-shrink:0}
.emeta-val{color:${G.text1}}
.ebody{font-size:13.5px;color:${G.text1};line-height:1.75;white-space:pre-wrap;word-break:break-word}
.eactions{display:flex;gap:8px;flex-wrap:wrap}
.abtn{font-size:12px;padding:6px 14px;border-radius:6px;border:1px solid ${G.border};background:transparent;color:${G.text1};cursor:pointer;font-family:'DM Mono',monospace;transition:all 0.15s}
.abtn:hover{border-color:${G.borderHover};color:${G.text0}}
.abtn.del:hover{border-color:${G.red}44;color:${G.red};background:${G.redDim}}
.abtn.rep:hover{border-color:${G.amberBorder};color:${G.amber};background:${G.amberDim}}
.no-sel{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:${G.text3};font-family:'DM Mono',monospace;font-size:13px}
/* calendar */
.cal-wrap{flex:1;overflow-y:auto;padding:20px 24px}
.cal-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.cal-filters{display:flex;gap:6px;margin-bottom:16px}
.filt-btn{font-size:11px;padding:4px 12px;border-radius:5px;border:1px solid ${G.border};background:transparent;color:${G.text1};cursor:pointer;font-family:'DM Mono',monospace;transition:all 0.15s}
.filt-btn.active{border-color:${G.blueDim};background:${G.blueDim};color:${G.blue}}
.filt-btn:hover{border-color:${G.borderHover}}
.event-list{display:flex;flex-direction:column;gap:8px}
.event-item{padding:12px 16px;background:${G.bg2};border:1px solid ${G.border};border-radius:8px;border-left:3px solid ${G.blue};transition:all 0.15s;display:flex;gap:14px;align-items:flex-start}
.event-item:hover{border-color:${G.borderHover}}
.event-time{flex-shrink:0;text-align:right;min-width:70px}
.event-time-main{font-size:12px;font-family:'DM Mono',monospace;color:${G.blue}}
.event-time-date{font-size:10px;color:${G.text3};font-family:'DM Mono',monospace;margin-top:2px}
.event-title{font-size:14px;font-weight:500;color:${G.text0};margin-bottom:3px}
.event-desc{font-size:12px;color:${G.text2};line-height:1.5}
.event-loc{font-size:11px;color:${G.text3};margin-top:4px;font-family:'DM Mono',monospace}
.event-del{margin-left:auto;border:none;background:none;color:${G.text3};cursor:pointer;font-size:16px;padding:0;line-height:1;transition:color 0.15s;flex-shrink:0}
.event-del:hover{color:${G.red}}
/* spinner */
.spin{width:14px;height:14px;border-radius:50%;border:2px solid ${G.bg4};border-top-color:${G.amber};animation:spin 0.7s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
/* key screen */
.key-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:${G.bg0}}
.key-card{width:400px;background:${G.bg1};border:1px solid ${G.border};border-radius:12px;padding:32px}
.key-logo{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.key-mark{width:40px;height:40px;background:${G.amber};border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:'DM Mono',monospace;font-weight:500;font-size:14px;color:${G.bg0}}
.key-t1{font-size:16px;font-weight:500;color:${G.text0}}
.key-t2{font-size:11px;color:${G.text2};font-family:'DM Mono',monospace;margin-top:1px}
.key-desc{font-size:13.5px;color:${G.text1};margin-bottom:20px;line-height:1.6}
.key-desc a{color:${G.amber};text-decoration:none}
.key-input{width:100%;padding:11px 14px;margin-bottom:12px;background:${G.bg2};border:1px solid ${G.border};border-radius:8px;color:${G.text0};font-size:13px;font-family:'DM Mono',monospace;outline:none;transition:border-color 0.15s}
.key-input::placeholder{color:${G.text3}}
.key-input:focus{border-color:${G.amberBorder}}
.key-btn{width:100%;padding:11px;border-radius:8px;border:none;font-size:14px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s}
.key-btn.on{background:${G.amber};color:${G.bg0}}
.key-btn.on:hover{background:#fbbf24}
.key-btn.off{background:${G.bg3};color:${G.text3};cursor:not-allowed}
.key-note{font-size:11px;color:${G.text3};text-align:center;margin-top:12px}
`;

// ─── System prompt ────────────────────────────────────────────────────────────
const buildSystem = (tasks, notes, googleOk, email) => `
You are APEX, a multi-agent productivity assistant. You coordinate 4 sub-agents:
- task_agent: manages tasks in MongoDB (persistent)
- email_agent: reads/sends/manages Gmail
- calendar_agent: reads/creates/deletes Google Calendar events
- notes_agent: manages notes in MongoDB (persistent)

Google account: ${googleOk ? `connected as ${email}` : "NOT connected"}
Current tasks (from DB): ${JSON.stringify(tasks.slice(0,10))}
Current notes (from DB): ${JSON.stringify(notes.slice(0,5))}

Respond ONLY in valid JSON — no markdown, no backticks:
{
  "message": "your reply",
  "agent_actions": [{
    "agent": "task_agent"|"email_agent"|"calendar_agent"|"notes_agent",
    "action": "CREATE"|"UPDATE"|"DELETE"|"LIST"|"FETCH_EMAILS"|"SEND_EMAIL"|"READ_EMAIL"|"MARK_READ"|"MARK_ALL_READ"|"DELETE_EMAIL"|"GET_EVENTS"|"CREATE_EVENT"|"DELETE_EVENT"|"CREATE_NOTE"|"UPDATE_NOTE"|"DELETE_NOTE",
    "params": {}
  }]
}

Rules:
TASK CREATION FLOW:
- Read the user's full message carefully before deciding anything.
- If user mentions a task with a specific date AND time already (e.g. "5th april 10am"): create the task immediately + ask "Should I add this to your Google Calendar too?" in the same response. Never ask for date/time again — you already have it.
- If user mentions a task with only a date but no time: create the task + ask "Should I add this to your calendar? If yes, what time works for you?"
- If user mentions a task with no date at all: create the task + ask "Should I add this to your calendar? If yes, when?"
- If user says "yes" to calendar and you already have both date and time: do task_agent CREATE + calendar_agent CREATE_EVENT together in one shot. Do not ask again.
- If user says "yes" to calendar but you still need date or time: ask the one missing piece. Nothing else.
- If user says "no" to calendar: just create the task. Done.
- NEVER create the same task twice. If the task was already created in a previous turn, do not call task_agent CREATE again.
- NEVER put duplicate entries in agent_actions for the same agent+action.
- If the user's message is a confirmation ("yup", "yes", "sure", "go ahead") — act on what was just discussed, don't start fresh.

CALENDAR FLOW:
- CREATE_EVENT start must be a full ISO string like "2026-04-05T10:00:00+05:30". Never use words like "tomorrow" or "next week".
- If user says "remove from calendar" or "delete from calendar": fetch current events first if needed, identify the event, confirm with user before deleting.
- Always use calendar_agent DELETE_EVENT with the specific event id.

EMAIL FLOW:
- For FETCH_EMAILS, use query param for filtering (e.g. "is:unread", "from:boss@co.com").
- For SEND_EMAIL, always confirm you have to, subject, and body before sending.
- Never make up email content.

GENERAL INTELLIGENCE:
- If the user's intent is ambiguous, make a reasonable assumption and state it. Don't ask unnecessary clarifying questions.
- Remember context from earlier in the conversation. Don't ask for info the user already gave.
- Keep responses short and action-oriented. Never be verbose.
- If Google is not connected and user asks for email/calendar: tell them to connect Google first using the button in the sidebar.
- Generate unique ids: "t"+Date.now() for tasks, "n"+Date.now() for notes.
- agent_actions must never have duplicates for the same agent+action in one response.

PARAMS REFERENCE:
- task_agent CREATE: { id, title, priority, due_date }
- task_agent UPDATE: { id, done?, title?, priority?, due_date? }
- task_agent DELETE: { id }
- email_agent FETCH_EMAILS: { query?, maxResults? }
- email_agent SEND_EMAIL: { to, subject, body }
- email_agent DELETE_EMAIL: { id }
- calendar_agent GET_EVENTS: { days? }
- calendar_agent CREATE_EVENT: { title, start, end?, description?, location? }
- calendar_agent DELETE_EVENT: { id }
- notes_agent CREATE_NOTE: { title, content }
- notes_agent UPDATE_NOTE: { id, title?, content? }
- notes_agent DELETE_NOTE: { id }
`.trim();

const PRIO_COLOR = { high: G.red, medium: G.amber, low: G.green };
const fmtTime = (d = new Date()) => d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
const fmtDate = str => {
  if (!str) return "";
  try {
    const d = new Date(str), now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    return d.toLocaleDateString([], { month:"short", day:"numeric" });
  } catch { return str.slice(0,10); }
};
const fmtEventTime = str => {
  if (!str) return "";
  try {
    const d = new Date(str);
    return d.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
  } catch { return str; }
};
const fmtEventDate = str => {
  if (!str) return "";
  try {
    const d = new Date(str);
    return d.toLocaleDateString([], { month:"short", day:"numeric", weekday:"short" });
  } catch { return str.slice(0,10); }
};

// ─── API helpers ──────────────────────────────────────────────────────────────
const api = async (method, path, body) => {
  const res = await fetch(`${BACKEND}${path}`, {
    method, headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return res.json();
};

export default function App() {
  const envKey = import.meta.env.VITE_GROQ_API_KEY || "";
  const [apiKey, setApiKey] = useState(envKey);
  const [keySet, setKeySet] = useState(!!envKey);

  const [view, setView] = useState("chat");
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [emails, setEmails] = useState([]);
  const [events, setEvents] = useState([]);
  const [selEmail, setSelEmail] = useState(null);
  const [emailBody, setEmailBody] = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleOk, setGoogleOk] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleChecking, setGoogleChecking] = useState(false);
  const [calDays, setCalDays] = useState(7);

  const [messages, setMessages] = useState([{
    role:"assistant",
    content:"Welcome to APEX. I manage your tasks, notes, Gmail, and Google Calendar — all persistent via MongoDB. Connect your Google account to get started.",
    agents:[], time: fmtTime()
  }]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const bottomRef = useRef(null);
  const scroll = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 60);

  // ── load from DB on mount ──
  const loadDB = useCallback(async () => {
    try {
      const [t, n] = await Promise.all([api("GET", "/tasks"), api("GET", "/notes")]);
      if (t.tasks) setTasks(t.tasks);
      if (n.notes) setNotes(n.notes);
    } catch {}
  }, []);

  const checkGoogle = useCallback(async () => {
    setGoogleChecking(true);
    try {
      const [s, p] = await Promise.all([
        api("GET", "/auth/status").catch(() => ({})),
        api("GET", "/profile").catch(() => ({}))
      ]);
      setGoogleOk(!!s.connected);
      if (p.email) setGoogleEmail(p.email);
    } catch { setGoogleOk(false); }
    setGoogleChecking(false);
  }, []);

  useEffect(() => {
    if (keySet) { loadDB(); checkGoogle(); }
  }, [keySet, loadDB, checkGoogle]);

  useEffect(() => {
    const h = (e) => { if (e.data === "gmail_connected") checkGoogle(); };
    window.addEventListener("message", h);
    return () => window.removeEventListener("message", h);
  }, [checkGoogle]);

  const connectGoogle = () => window.open(`${BACKEND}/auth/login`, "google_oauth", "width=520,height=640");
  const disconnectGoogle = async () => {
    await api("POST", "/auth/logout");
    setGoogleOk(false); setGoogleEmail(""); setEmails([]); setEvents([]);
    setSelEmail(null); setEmailBody(null);
  };

  const loadEvents = useCallback(async (days = calDays) => {
    if (!googleOk) return;
    try {
      const d = await api("GET", `/calendar/events?days=${days}`);
      if (d.events) setEvents(d.events);
    } catch {}
  }, [googleOk, calDays]);

  useEffect(() => {
    if (googleOk && view === "calendar") loadEvents(calDays);
  }, [googleOk, view, calDays, loadEvents]);

  // ── execute agent actions ──
  const runAction = async (agent, action, params = {}) => {
    try {
      if (agent === "task_agent") {
        if (action === "CREATE") {
          const d = await api("POST", "/tasks", { id: params.id || `t${Date.now()}`, title: params.title, priority: params.priority || "medium", due_date: params.due_date || null });
          if (d.tasks) setTasks(d.tasks);
          return d;
        }
        if (action === "UPDATE") {
          const { id, ...rest } = params;
          const d = await api("PATCH", `/tasks/${id}`, rest);
          if (d.tasks) setTasks(d.tasks);
          return d;
        }
        if (action === "DELETE") {
          const d = await api("DELETE", `/tasks/${params.id}`);
          if (d.tasks) setTasks(d.tasks);
          return d;
        }
        if (action === "LIST") {
          const d = await api("GET", "/tasks");
          if (d.tasks) setTasks(d.tasks);
          return d;
        }
      }
      if (agent === "notes_agent") {
        if (action === "CREATE_NOTE") {
          const d = await api("POST", "/notes", { id: `n${Date.now()}`, title: params.title, content: params.content || "" });
          if (d.notes) setNotes(d.notes);
          return d;
        }
        if (action === "UPDATE_NOTE") {
          const { id, ...rest } = params;
          const d = await api("PATCH", `/notes/${id}`, rest);
          if (d.notes) setNotes(d.notes);
          return d;
        }
        if (action === "DELETE_NOTE") {
          const d = await api("DELETE", `/notes/${params.id}`);
          if (d.notes) setNotes(d.notes);
          return d;
        }
      }
      if (agent === "calendar_agent") {
        if (!googleOk) return { error: "Google not connected" };
        if (action === "GET_EVENTS") {
          const d = await api("GET", `/calendar/events?days=${params.days || 7}`);
          if (d.events) setEvents(d.events);
          return d;
        }
        if (action === "CREATE_EVENT") {
          const d = await api("POST", "/calendar/events", params);
          await loadEvents(calDays);
          return d;
        }
        if (action === "DELETE_EVENT") {
          await api("DELETE", `/calendar/events/${params.id}`);
          setEvents(p => p.filter(e => e.id !== params.id));
          return { ok: true };
        }
      }
      if (agent === "email_agent") {
        if (!googleOk) return { error: "Google not connected" };
        if (action === "FETCH_EMAILS") {
          const qs = `?maxResults=${params.maxResults || 15}${params.query ? `&query=${encodeURIComponent(params.query)}` : ""}`;
          const d = await api("GET", `/emails${qs}`);
          if (d.emails) setEmails(d.emails);
          return d;
        }
        if (action === "READ_EMAIL") {
          const d = await fetch(`${BACKEND}/emails/${params.id}`).then(r => r.json());
          setEmails(p => p.map(e => e.id === d.id ? { ...e, isUnread: false } : e));
          return d;
        }
        if (action === "MARK_READ") {
          await api("POST", `/emails/${params.id}/read`);
          setEmails(p => p.map(e => e.id === params.id ? { ...e, isUnread: false } : e));
          return { ok: true };
        }
        if (action === "MARK_ALL_READ") {
          const d = await api("POST", "/emails/mark-all-read");
          setEmails(p => p.map(e => ({ ...e, isUnread: false })));
          return d;
        }
        if (action === "DELETE_EMAIL") {
          await api("POST", `/emails/${params.id}/delete`);
          setEmails(p => p.filter(e => e.id !== params.id));
          if (selEmail?.id === params.id) { setSelEmail(null); setEmailBody(null); }
          return { ok: true };
        }
        if (action === "SEND_EMAIL") {
          return await api("POST", "/emails/send", params);
        }
      }
    } catch (err) { return { error: err.message }; }
    return {};
  };

  const openEmail = async (email) => {
    setSelEmail(email); setEmailBody(null); setEmailLoading(true);
    try {
      const d = await fetch(`${BACKEND}/emails/${email.id}`).then(r => r.json());
      setEmailBody(d.body || "(no body)");
      setEmails(p => p.map(e => e.id === email.id ? { ...e, isUnread: false } : e));
    } catch { setEmailBody("Failed to load."); }
    setEmailLoading(false);
  };

  // ── send to Groq ──
  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim(); setInput(""); setLoading(true);
    setMessages(p => [...p, { role:"user", content:text, agents:[], time: fmtTime() }]);
    scroll();

    const newHistory = [...history, { role:"user", content: text }];
    try {
      const res = await fetch(GROQ_URL, {
        method:"POST",
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${apiKey}` },
        body: JSON.stringify({ model:MODEL, max_tokens:1000, temperature:0.2, messages:[{ role:"system", content: buildSystem(tasks, notes, googleOk, googleEmail) }, ...newHistory] })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

     const raw = data.choices?.[0]?.message?.content || "";
      let parsed = {};
      try {
        const clean = raw.replace(/```json|```/g, "").trim();
        const m = clean.match(/\{[\s\S]*\}/);
        if (m) {
          const fixedStr = m[0]
            .replace(/"t"\s*\+\s*Date\.now\(\)\.toString\(\)/g, `"t${Date.now()}"`)
            .replace(/"t"\s*\+\s*Date\.now\(\)/g, `"t${Date.now()}"`)
            .replace(/"n"\s*\+\s*Date\.now\(\)\.toString\(\)/g, `"n${Date.now()}"`)
            .replace(/"n"\s*\+\s*Date\.now\(\)/g, `"n${Date.now()}"`)
            .replace(/new Date\([^)]*\)\.toISOString\(\)/g, `"${new Date(Date.now() + 86400000).toISOString()}"`);
          parsed = JSON.parse(fixedStr);
          if (!parsed.message) parsed.message = "Done!";
        } else {
          parsed = { message: raw };
        }
      } catch { parsed = { message: raw }; }

      const actions = parsed.agent_actions || [];
      const agentNames = [...new Set(actions.map(a => a.agent).filter(Boolean))];
      let extraCtx = "";

      for (const action of actions) {
        const result = await runAction(action.agent, action.action, action.params || {});
        if (result?.emails?.length) extraCtx = `\n\nEmails: ${JSON.stringify(result.emails.slice(0,8))}`;
        else if (result?.body) extraCtx = `\n\nEmail body: ${result.body.substring(0,1000)}`;
        else if (result?.events?.length) extraCtx = `\n\nCalendar events: ${JSON.stringify(result.events)}`;
        else if (result?.id && action.action === "SEND_EMAIL") extraCtx = `\n\nEmail sent successfully.`;
        else if (result?.error) extraCtx = `\n\nError: ${result.error}`;
      }

      let finalMsg = parsed.message || raw;
      if (extraCtx) {
        const fu = await fetch(GROQ_URL, {
          method:"POST",
          headers:{ "Content-Type":"application/json", Authorization:`Bearer ${apiKey}` },
          body: JSON.stringify({ model:MODEL, max_tokens:500, temperature:0.2, messages:[
            { role:"system", content:"Summarize the data concisely in plain text. No JSON, no markdown." },
            { role:"user", content:`User asked: "${text}"${extraCtx}\n\nSummarize helpfully.` }
          ]})
        }).then(r => r.json());
        finalMsg = fu.choices?.[0]?.message?.content || finalMsg;
      }

      setMessages(p => [...p, { role:"assistant", content: finalMsg, agents: agentNames, time: fmtTime() }]);
      setHistory([...newHistory, { role:"assistant", content: finalMsg }]);
    } catch (err) {
      setMessages(p => [...p, { role:"assistant", content:`Error: ${err.message}`, agents:[], time: fmtTime() }]);
    }
    setLoading(false); scroll();
  };

  const toggleTask = async (task) => {
    await runAction("task_agent", "UPDATE", { id: task.id, done: !task.done });
  };
  const deleteTask = async (id) => { await runAction("task_agent", "DELETE", { id }); };
  const deleteEvent = async (id) => { await runAction("calendar_agent", "DELETE_EVENT", { id }); };

  const pending = tasks.filter(t => !t.done).length;
  const unread = emails.filter(e => e.isUnread).length;
  const QUICK = ["Show my tasks","Check unread emails","What's on my calendar this week?","Add a note: meeting summary","Add task: submit project, high priority, due 2026-04-08"];

  const NavItem = ({ id, icon, label, badge }) => (
    <div className={`nav-item${view === id ? " active" : ""}`} onClick={() => setView(id)}>
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
      {badge > 0 && <span className="nav-badge">{badge}</span>}
    </div>
  );

  const agentChip = (a) => {
    const map = { task_agent:["chip-task","task"], email_agent:["chip-email","email"], calendar_agent:["chip-cal","calendar"], notes_agent:["chip-note","notes"] };
    const [cls, lbl] = map[a] || ["",""];
    return <span key={a} className={`chip ${cls}`}>{lbl} agent</span>;
  };

  if (!keySet) return (
    <>
      <style>{css}</style>
      <div className="key-screen">
        <div className="key-card">
          <div className="key-logo">
            <div className="key-mark">AP</div>
            <div><div className="key-t1">APEX</div><div className="key-t2">gemini · mongo · gmail · calendar</div></div>
          </div>
          <p className="key-desc">Enter your Groq API key. Get one free at <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">console.groq.com</a>.</p>
          <input className="key-input" type="password" placeholder="gsk_..."
            value={apiKey} onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && apiKey.startsWith("gsk_") && setKeySet(true)} />
          <button className={`key-btn ${apiKey.startsWith("gsk_") ? "on" : "off"}`}
            onClick={() => setKeySet(true)} disabled={!apiKey.startsWith("gsk_")}>
            Launch APEX
          </button>
          <p className="key-note">Key is used only in this browser session.</p>
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
            <div className="logo-mark">AP</div>
            <div className="logo-title">APEX</div>
            <div className="logo-sub">multi-agent assistant</div>
          </div>
          <nav className="nav">
            <div className="nav-section">
              <div className="nav-label">Workspace</div>
              <NavItem id="chat"     icon="◈" label="Chat"     badge={0} />
              <NavItem id="tasks"    icon="◻" label="Tasks"    badge={pending} />
              <NavItem id="notes"    icon="◇" label="Notes"    badge={notes.length} />
              <NavItem id="emails"   icon="◉" label="Emails"   badge={unread} />
              <NavItem id="calendar" icon="▦" label="Calendar" badge={events.length} />
            </div>
          </nav>
          <div className="gmail-status">
            {googleChecking ? <div className="spin"/> : <div className="sdot" style={{ background: googleOk ? G.green : G.text3 }}/>}
            <span className="stext">{googleOk ? googleEmail || "Connected" : "Google disconnected"}</span>
            {googleOk
              ? <button className="sbtn sbtn-on" onClick={disconnectGoogle}>out</button>
              : <button className="sbtn sbtn-off" onClick={connectGoogle}>connect</button>
            }
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          <div className="topbar">
            <span className="topbar-title">{{ chat:"Chat", tasks:"Tasks", notes:"Notes", emails:"Emails", calendar:"Calendar" }[view]}</span>
            <span className="topbar-meta">
              {view === "tasks" && `${pending} pending · ${tasks.filter(t=>t.done).length} done · mongodb`}
              {view === "notes" && `${notes.length} notes · mongodb`}
              {view === "emails" && `${emails.length} loaded · ${unread} unread`}
              {view === "calendar" && `${events.length} events · ${calDays}d window`}
              {view === "chat" && "gemini · gemini-2.0-flash"}
            </span>
          </div>

          <div className="content">

            {/* ── CHAT ── */}
            {view === "chat" && (
              <div className="chat-wrap">
                <div className="messages">
                  {messages.map((m, i) => (
                    <div key={i} className={`msg ${m.role}`}>
                      {m.agents?.length > 0 && (
                        <div className="agent-row">{[...new Set(m.agents)].map(agentChip)}</div>
                      )}
                      <div className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-ai"}`}>
                        {m.content.split(/\*\*(.*?)\*\*/g).map((p,j) => j%2===1 ? <strong key={j}>{p}</strong> : p)}
                      </div>
                      <div className="msg-time">{m.time}</div>
                    </div>
                  ))}
                  {loading && (
                    <div className="msg assistant">
                      <div className="typing">
                        <div className="dots"><div className="dot"/><div className="dot"/><div className="dot"/></div>
                        <span>agents working</span>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef}/>
                </div>
                <div className="chat-footer">
                  <div className="qps">{QUICK.map((q,i) => <button key={i} className="qp" onClick={() => setInput(q)}>{q}</button>)}</div>
                  <div className="input-row">
                    <input className="cinput" value={input} onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && send()}
                      placeholder="Ask APEX — tasks, notes, emails, calendar..." />
                    <button className="send-btn" onClick={send} disabled={loading || !input.trim()}>Send →</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── TASKS ── */}
            {view === "tasks" && (
              <div className="panel">
                <div className="panel-hdr">
                  <span style={{ fontSize:13, color:G.text2, fontFamily:"'DM Mono',monospace" }}>persistent · mongodb</span>
                  <button className="add-btn" onClick={() => { setView("chat"); setInput("Add a task: "); }}>+ add via chat</button>
                </div>
                <div className="stat-row">
                  {[["pending", pending, G.amber], ["done", tasks.filter(t=>t.done).length, G.green], ["total", tasks.length, G.text1]].map(([l,n,c]) => (
                    <div className="stat-card" key={l}>
                      <div className="stat-num" style={{ color:c }}>{n}</div>
                      <div className="stat-lbl">{l}</div>
                    </div>
                  ))}
                </div>
                {tasks.length === 0
                  ? <div className="empty"><div className="empty-icon">◻</div>no tasks yet — ask APEX in chat</div>
                  : <div className="task-list">
                      {tasks.map(t => (
                        <div key={t.id} className={`task-item${t.done ? " done" : ""}`}>
                          <input type="checkbox" className="tcb" checked={t.done} onChange={() => toggleTask(t)} />
                          <div className="pdot" style={{ background: PRIO_COLOR[t.priority] || PRIO_COLOR.medium }}/>
                          <span className="ttitle">{t.title}</span>
                          {t.due_date && <span className="tdue">{t.due_date}</span>}
                          <span className={`pbadge p-${t.priority || "medium"}`}>{t.priority || "medium"}</span>
                          <button className="del-btn" onClick={() => deleteTask(t.id)}>×</button>
                        </div>
                      ))}
                    </div>
                }
              </div>
            )}

            {/* ── NOTES ── */}
            {view === "notes" && (
              <div className="panel">
                <div className="panel-hdr">
                  <span style={{ fontSize:13, color:G.text2, fontFamily:"'DM Mono',monospace" }}>persistent · mongodb</span>
                  <button className="add-btn" onClick={() => { setView("chat"); setInput("Add a note: "); }}>+ add via chat</button>
                </div>
                {notes.length === 0
                  ? <div className="empty"><div className="empty-icon">◇</div>no notes yet — ask APEX in chat</div>
                  : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:10 }}>
                      {notes.map(n => (
                        <div key={n.id} style={{ padding:"14px", background:G.bg2, border:`1px solid ${G.border}`, borderRadius:10, borderTop:`3px solid ${G.purple}`, position:"relative" }}>
                          <div style={{ fontWeight:500, fontSize:14, marginBottom:6, color:G.text0 }}>{n.title}</div>
                          <div style={{ fontSize:12, color:G.text2, lineHeight:1.6, WebkitLineClamp:5, display:"-webkit-box", WebkitBoxOrient:"vertical", overflow:"hidden" }}>{n.content}</div>
                          <button className="del-btn" style={{ position:"absolute", top:10, right:10 }} onClick={() => runAction("notes_agent","DELETE_NOTE",{id:n.id})}>×</button>
                        </div>
                      ))}
                    </div>
                }
              </div>
            )}

            {/* ── EMAILS ── */}
            {view === "emails" && (
              <div className="email-layout">
                <div className="email-list">
                  <div className="etoolbar">
                    <button className="tbtn" onClick={() => { setView("chat"); setInput("Check my emails"); }}>fetch</button>
                    <button className="tbtn" onClick={() => runAction("email_agent","MARK_ALL_READ",{})}>mark all read</button>
                    {selEmail && <button className="tbtn danger" onClick={() => runAction("email_agent","DELETE_EMAIL",{id:selEmail.id})}>delete</button>}
                  </div>
                  {!googleOk
                    ? <div className="empty" style={{ padding:"40px 20px" }}><div className="empty-icon">◉</div>Google not connected<br/><button className="add-btn" style={{ marginTop:12 }} onClick={connectGoogle}>connect google</button></div>
                    : emails.length === 0
                      ? <div className="empty" style={{ padding:"40px 20px" }}><div className="empty-icon">◉</div>no emails loaded<br/><span style={{ fontSize:11 }}>ask APEX to fetch in chat</span></div>
                      : emails.map(em => (
                          <div key={em.id} className={`eitem${em.isUnread ? " unread" : ""}${selEmail?.id === em.id ? " sel" : ""}`} onClick={() => openEmail(em)}>
                            {em.isUnread && <div className="ubar"/>}
                            <div className="efrom"><span>{em.from?.replace(/<.*>/,"").trim()}</span><span className="edate">{fmtDate(em.date)}</span></div>
                            <div className="esubj">{em.subject}</div>
                            <div className="esnip">{em.snippet}</div>
                          </div>
                        ))
                  }
                </div>
                {selEmail
                  ? <div className="edetail">
                      <div className="edh">
                        <div className="esubj-big">{selEmail.subject}</div>
                        <div className="emeta">
                          {[["from",selEmail.from],["to",selEmail.to],["date",selEmail.date]].map(([l,v]) => (
                            <div className="emeta-row" key={l}><span className="emeta-lbl">{l}</span><span className="emeta-val">{v}</span></div>
                          ))}
                        </div>
                      </div>
                      <div className="eactions">
                        <button className="abtn rep" onClick={() => { setView("chat"); setInput(`Reply to the email from ${selEmail.from}: `); }}>↩ reply via chat</button>
                        <button className="abtn" onClick={() => runAction("email_agent","MARK_READ",{id:selEmail.id})}>mark read</button>
                        <button className="abtn del" onClick={() => runAction("email_agent","DELETE_EMAIL",{id:selEmail.id})}>trash</button>
                      </div>
                      {emailLoading
                        ? <div style={{ display:"flex", gap:8, color:G.text2, fontSize:13, alignItems:"center" }}><div className="spin"/> Loading...</div>
                        : <div className="ebody">{emailBody}</div>
                      }
                    </div>
                  : <div className="no-sel"><span style={{ fontSize:24 }}>◉</span>select an email to read</div>
                }
              </div>
            )}

            {/* ── CALENDAR ── */}
            {view === "calendar" && (
              <div className="cal-wrap">
                <div className="cal-hdr">
                  <span style={{ fontSize:13, color:G.text2, fontFamily:"'DM Mono',monospace" }}>google calendar · live</span>
                  <div style={{ display:"flex", gap:8 }}>
                    <button className="add-btn" onClick={() => loadEvents(calDays)}>↻ refresh</button>
                    <button className="add-btn" onClick={() => { setView("chat"); setInput("Create a calendar event: "); }}>+ add via chat</button>
                  </div>
                </div>
                <div className="cal-filters">
                  {[["today",1],["3 days",3],["1 week",7],["2 weeks",14],["1 month",30]].map(([l,d]) => (
                    <button key={d} className={`filt-btn${calDays===d?" active":""}`} onClick={() => { setCalDays(d); loadEvents(d); }}>{l}</button>
                  ))}
                </div>
                {!googleOk
                  ? <div className="empty"><div className="empty-icon">▦</div>Google not connected<br/><button className="add-btn" style={{ marginTop:12 }} onClick={connectGoogle}>connect google</button></div>
                  : events.length === 0
                    ? <div className="empty"><div className="empty-icon">▦</div>no events in this range<br/><span style={{ fontSize:11, marginTop:6, display:"block" }}>ask APEX to create one or check your calendar</span></div>
                    : <div className="event-list">
                        {events.map(ev => (
                          <div key={ev.id} className="event-item">
                            <div className="event-time">
                              <div className="event-time-main">{ev.allDay ? "all day" : fmtEventTime(ev.start)}</div>
                              <div className="event-time-date">{fmtEventDate(ev.start)}</div>
                            </div>
                            <div style={{ flex:1 }}>
                              <div className="event-title">{ev.title}</div>
                              {ev.description && <div className="event-desc">{ev.description}</div>}
                              {ev.location && <div className="event-loc">📍 {ev.location}</div>}
                            </div>
                            <button className="event-del" onClick={() => deleteEvent(ev.id)}>×</button>
                          </div>
                        ))}
                      </div>
                }
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
