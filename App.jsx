import { useState, useRef, useEffect, useCallback } from "react";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

// ─── System prompt ──────────────────────────────────────────────────────────
const buildSystemPrompt = (tasks, gmailConnected, gmailProfile) => `
You are APEX, a multi-agent productivity assistant. You coordinate two sub-agents:
- task_agent: manages an in-memory task list
- email_agent: reads/sends Gmail via a local proxy (${gmailConnected ? `connected as ${gmailProfile}` : "NOT connected — user must connect Gmail first"})

Current tasks: ${JSON.stringify(tasks)}
Gmail connected: ${gmailConnected}

Always respond in valid JSON only — no markdown, no backticks, no prose outside the JSON:
{
  "message": "Your conversational reply to the user",
  "agent_actions": [
    {
      "agent": "task_agent" | "email_agent",
      "action": "CREATE" | "COMPLETE" | "DELETE" | "LIST" | "FETCH_EMAILS" | "SEND_EMAIL" | "READ_EMAIL",
      "detail": "...",
      "email_params": { "to": "...", "subject": "...", "body": "...", "query": "...", "id": "..." }
    }
  ],
  "tasks": [ { "id": "t1", "title": "...", "done": false, "priority": "high"|"medium"|"low", "due_date": "YYYY-MM-DD or null" } ]
}

Rules:
- tasks field: always return FULL updated array when tasks change; omit if unchanged.
- For FETCH_EMAILS: set action "FETCH_EMAILS" and optionally email_params.query (Gmail search string, e.g. "is:unread").
- For SEND_EMAIL: set email_params { to, subject, body }.
- For READ_EMAIL: set email_params { id }.
- If Gmail is not connected and user asks about email, message should say they need to connect Gmail first (button is in the UI).
- Never make up email content — only summarize what will be fetched.
- Generate short unique IDs like "t${Date.now()}" for new tasks.
- Priority defaults to "medium".
- Be concise and action-oriented.
`.trim();

// ─── Helpers ────────────────────────────────────────────────────────────────
const PRIORITY_COLOR = { high: "#E24B4A", medium: "#EF9F27", low: "#639922" };

function AgentPill({ name }) {
  const meta = {
    task_agent: { label: "Task Agent", bg: "#3B6D1118", color: "#3B6D11" },
    email_agent: { label: "Email Agent", bg: "#99355618", color: "#993556" },
  }[name] || { label: name, bg: "#88878018", color: "#888780" };
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}28`, whiteSpace: "nowrap" }}>
      {meta.label}
    </span>
  );
}

function StatusDot({ on }) {
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: on ? "#639922" : "#888780", display: "inline-block", flexShrink: 0 }} />;
}

// ─── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [keySet, setKeySet] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [emails, setEmails] = useState([]);
  const [activeTab, setActiveTab] = useState("chat");
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailProfile, setGmailProfile] = useState("");
  const [gmailChecking, setGmailChecking] = useState(false);
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "Hi, I'm **APEX** — your multi-agent assistant powered by Groq + Llama 3.3. I manage tasks and Gmail. Connect Gmail below to get started.",
    agents: []
  }]);
  const [history, setHistory] = useState([]);
  const bottomRef = useRef(null);

  const scroll = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);

  // ── Gmail status check ──
  const checkGmail = useCallback(async () => {
    setGmailChecking(true);
    try {
      const [statusRes, profileRes] = await Promise.all([
        fetch(`${BACKEND}/auth/status`).then(r => r.json()),
        fetch(`${BACKEND}/profile`).then(r => r.json()).catch(() => ({}))
      ]);
      setGmailConnected(!!statusRes.connected);
      if (profileRes.email) setGmailProfile(profileRes.email);
    } catch {
      setGmailConnected(false);
    }
    setGmailChecking(false);
  }, []);

  useEffect(() => { if (keySet) checkGmail(); }, [keySet, checkGmail]);

  // Listen for OAuth popup completing
  useEffect(() => {
    const handler = (e) => { if (e.data === "gmail_connected") checkGmail(); };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [checkGmail]);

  const connectGmail = () => {
    window.open(`${BACKEND}/auth/login`, "gmail_oauth", "width=500,height=600");
  };

  const disconnectGmail = async () => {
    await fetch(`${BACKEND}/auth/logout`, { method: "POST" });
    setGmailConnected(false);
    setGmailProfile("");
    setEmails([]);
  };

  // ── Execute email_agent actions against the proxy ──
  const runEmailAction = async (action, params = {}) => {
    if (!gmailConnected) return { error: "Gmail not connected" };
    try {
      if (action === "FETCH_EMAILS") {
        const qs = params.query ? `?query=${encodeURIComponent(params.query)}&maxResults=10` : "?maxResults=10";
        const data = await fetch(`${BACKEND}/emails${qs}`).then(r => r.json());
        if (data.emails) setEmails(data.emails);
        return data;
      }
      if (action === "READ_EMAIL") {
        return await fetch(`${BACKEND}/emails/${params.id}`).then(r => r.json());
      }
      if (action === "SEND_EMAIL") {
        const res = await fetch(`${BACKEND}/emails/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: params.to, subject: params.subject, body: params.body })
        }).then(r => r.json());
        return res;
      }
    } catch (err) {
      return { error: err.message };
    }
    return {};
  };

  // ── Main send ──
  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setLoading(true);
    setMessages(p => [...p, { role: "user", content: text, agents: [] }]);
    scroll();

    const newHistory = [...history, { role: "user", content: text }];

    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL, max_tokens: 1000, temperature: 0.2,
          messages: [
            { role: "system", content: buildSystemPrompt(tasks, gmailConnected, gmailProfile) },
            ...newHistory
          ]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const raw = data.choices?.[0]?.message?.content || "";
      let parsed = {};
      try {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]);
      } catch { parsed = { message: raw }; }

      if (parsed.tasks !== undefined) setTasks(parsed.tasks);

      // Execute any email_agent actions
      let emailContext = "";
      const actions = parsed.agent_actions || [];
      const agentNames = [...new Set(actions.map(a => a.agent).filter(Boolean))];

      for (const action of actions) {
        if (action.agent === "email_agent") {
          const result = await runEmailAction(action.action, action.email_params || {});
          if (result?.emails) {
            emailContext = `\n\nGmail results: ${JSON.stringify(result.emails.slice(0, 5))}`;
          } else if (result?.body) {
            emailContext = `\n\nEmail body: ${result.body.substring(0, 800)}`;
          } else if (result?.id) {
            emailContext = `\n\nEmail sent successfully (id: ${result.id})`;
          } else if (result?.error) {
            emailContext = `\n\nEmail error: ${result.error}`;
          }
        }
      }

      // If we got email data back, do a follow-up Groq call to summarize it
      let finalMessage = parsed.message || raw;
      if (emailContext) {
        const followUp = await fetch(GROQ_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: MODEL, max_tokens: 600, temperature: 0.2,
            messages: [
              { role: "system", content: "You are a helpful assistant. Summarize the email data in a friendly, concise way. Respond with plain text only, no JSON." },
              { role: "user", content: `User asked: "${text}"${emailContext}\n\nProvide a helpful summary.` }
            ]
          })
        }).then(r => r.json());
        finalMessage = followUp.choices?.[0]?.message?.content || finalMessage;
      }

      setMessages(p => [...p, { role: "assistant", content: finalMessage, agents: agentNames }]);
      setHistory([...newHistory, { role: "assistant", content: finalMessage }]);
    } catch (err) {
      setMessages(p => [...p, { role: "assistant", content: `Error: ${err.message}`, agents: [] }]);
    }
    setLoading(false);
    scroll();
  };

  const toggleTask = id => setTasks(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const deleteTask = id => setTasks(p => p.filter(t => t.id !== id));

  // ── Tab component ──
  const Tab = ({ id, label, badge }) => (
    <button onClick={() => setActiveTab(id)} style={{
      padding: "6px 16px", border: "none", borderRadius: 20, cursor: "pointer",
      background: activeTab === id ? "var(--color-text-primary)" : "transparent",
      color: activeTab === id ? "var(--color-background-primary)" : "var(--color-text-secondary)",
      fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6
    }}>
      {label}
      {badge > 0 && <span style={{
        fontSize: 11, borderRadius: 10, padding: "1px 6px", fontWeight: 600,
        background: activeTab === id ? "rgba(255,255,255,0.22)" : "var(--color-background-tertiary)",
        color: activeTab === id ? "white" : "var(--color-text-secondary)"
      }}>{badge}</span>}
    </button>
  );

  // ── API key screen ──
  if (!keySet) {
    return (
      <div style={{ maxWidth: 460, margin: "40px auto", padding: "0 1rem", fontFamily: "var(--font-sans)" }}>
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "28px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--color-text-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-background-primary)", fontWeight: 700, fontSize: 15 }}>A</div>
            <div>
              <div style={{ fontWeight: 500 }}>APEX</div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Groq · Llama 3.3 70B · Gmail proxy</div>
            </div>
          </div>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
            Enter your Groq API key. Get one free at{" "}
            <a href="https://console.groq.com/keys" style={{ color: "var(--color-text-info)" }}>console.groq.com</a>.
          </p>
          <input
            type="password"
            placeholder="gsk_..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && apiKey.startsWith("gsk_") && setKeySet(true)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", color: "var(--color-text-primary)", fontSize: 14, boxSizing: "border-box", marginBottom: 12 }}
          />
          <button onClick={() => setKeySet(true)} disabled={!apiKey.startsWith("gsk_")} style={{
            width: "100%", padding: 10, borderRadius: 8, border: "none", fontWeight: 500, fontSize: 14,
            cursor: apiKey.startsWith("gsk_") ? "pointer" : "not-allowed",
            background: apiKey.startsWith("gsk_") ? "var(--color-text-primary)" : "var(--color-background-tertiary)",
            color: apiKey.startsWith("gsk_") ? "var(--color-background-primary)" : "var(--color-text-tertiary)"
          }}>Launch APEX</button>
          <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>
            Your key is used only in this browser session and sent only to Groq's API.
          </p>
        </div>
      </div>
    );
  }

  const pending = tasks.filter(t => !t.done).length;
  const unread = emails.filter(e => e.isUnread).length;
  const quickPrompts = ["Show my tasks", "Add task: review PR by tomorrow, high priority", "Check unread emails", "Add task: prepare meeting agenda"];

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", fontFamily: "var(--font-sans)", padding: "1rem 0" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--color-text-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-background-primary)", fontWeight: 700, fontSize: 15 }}>A</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, fontSize: 15 }}>APEX</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Groq · Llama 3.3 70B</div>
        </div>

        {/* Gmail connection status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusDot on={gmailConnected} />
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            {gmailChecking ? "Checking..." : gmailConnected ? gmailProfile || "Gmail connected" : "Gmail disconnected"}
          </span>
          {gmailConnected
            ? <button onClick={disconnectGmail} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-tertiary)", cursor: "pointer" }}>Disconnect</button>
            : <button onClick={connectGmail} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "0.5px solid var(--color-border-info)", background: "var(--color-background-info)", color: "var(--color-text-info)", cursor: "pointer", fontWeight: 500 }}>Connect Gmail</button>
          }
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--color-background-secondary)", borderRadius: 24, marginBottom: 16, width: "fit-content" }}>
        <Tab id="chat" label="Chat" badge={0} />
        <Tab id="tasks" label="Tasks" badge={pending} />
        <Tab id="emails" label="Emails" badge={unread} />
      </div>

      {/* ── Chat tab ── */}
      {activeTab === "chat" && (
        <>
          <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, height: 380, overflowY: "auto", padding: 16, marginBottom: 10, background: "var(--color-background-primary)" }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 14, display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                {m.agents?.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginBottom: 4, flexWrap: "wrap" }}>
                    {[...new Set(m.agents)].map((a, j) => <AgentPill key={j} name={a} />)}
                  </div>
                )}
                <div style={{
                  maxWidth: "85%", padding: "9px 14px", fontSize: 14, lineHeight: 1.6,
                  borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                  background: m.role === "user" ? "var(--color-text-primary)" : "var(--color-background-secondary)",
                  color: m.role === "user" ? "var(--color-background-primary)" : "var(--color-text-primary)"
                }}>
                  {m.content.split(/\*\*(.*?)\*\*/g).map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-text-tertiary)", fontSize: 13 }}>
                {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block", animation: `blink 1.2s ${i * 0.2}s infinite` }} />)}
                <span style={{ marginLeft: 4 }}>Agents working...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {quickPrompts.map((p, i) => (
              <button key={i} onClick={() => setInput(p)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}>
                {p}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Manage tasks, check Gmail, draft emails..."
              style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", fontSize: 14 }}
            />
            <button onClick={send} disabled={loading || !input.trim()} style={{
              padding: "10px 20px", borderRadius: 8, border: "none", fontWeight: 500, fontSize: 14,
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              background: loading || !input.trim() ? "var(--color-background-tertiary)" : "var(--color-text-primary)",
              color: loading || !input.trim() ? "var(--color-text-tertiary)" : "var(--color-background-primary)"
            }}>Send</button>
          </div>
        </>
      )}

      {/* ── Tasks tab ── */}
      {activeTab === "tasks" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 10 }}>
              {[["Pending", pending, "#EF9F27"], ["Done", tasks.filter(t => t.done).length, "#639922"]].map(([l, c, color]) => (
                <div key={l} style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 500, color }}>{c}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{l}</div>
                </div>
              ))}
            </div>
            <button onClick={() => { setActiveTab("chat"); setInput("Add a task: "); }} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 20, border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}>
              + Add via chat
            </button>
          </div>
          {tasks.length === 0
            ? <div style={{ textAlign: "center", padding: "50px 0", color: "var(--color-text-tertiary)", fontSize: 14 }}>No tasks yet — ask APEX in the chat tab.</div>
            : tasks.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 6, border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, background: "var(--color-background-primary)", opacity: t.done ? 0.5 : 1, transition: "opacity 0.2s" }}>
                <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} style={{ cursor: "pointer", flexShrink: 0 }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_COLOR[t.priority] || PRIORITY_COLOR.medium, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</span>
                {t.due_date && <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{t.due_date}</span>}
                <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 20, background: (PRIORITY_COLOR[t.priority] || PRIORITY_COLOR.medium) + "18", color: PRIORITY_COLOR[t.priority] || PRIORITY_COLOR.medium }}>{t.priority || "medium"}</span>
                <button onClick={() => deleteTask(t.id)} style={{ border: "none", background: "none", color: "var(--color-text-tertiary)", cursor: "pointer", fontSize: 17, padding: "0 2px", lineHeight: 1 }}>×</button>
              </div>
            ))
          }
        </div>
      )}

      {/* ── Emails tab ── */}
      {activeTab === "emails" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              {gmailConnected ? `${emails.length} loaded · ${unread} unread` : "Gmail not connected"}
            </div>
            <button onClick={() => { setActiveTab("chat"); setInput("Check my unread emails"); }} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 20, border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}>
              Fetch via chat
            </button>
          </div>
          {!gmailConnected ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 12 }}>Connect Gmail to read and send emails.</div>
              <button onClick={connectGmail} style={{ fontSize: 13, padding: "8px 20px", borderRadius: 8, border: "0.5px solid var(--color-border-info)", background: "var(--color-background-info)", color: "var(--color-text-info)", cursor: "pointer", fontWeight: 500 }}>Connect Gmail</button>
            </div>
          ) : emails.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 0", color: "var(--color-text-tertiary)", fontSize: 14 }}>No emails loaded. Ask APEX to "check my emails" in chat.</div>
          ) : (
            emails.map((em, i) => (
              <div key={i} style={{ padding: "10px 14px", marginBottom: 6, border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, background: "var(--color-background-primary)", borderLeft: em.isUnread ? "3px solid #185FA5" : "0.5px solid var(--color-border-tertiary)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontWeight: em.isUnread ? 500 : 400, fontSize: 14 }}>{em.subject}</span>
                  <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", whiteSpace: "nowrap", marginLeft: 12 }}>{em.date?.slice(0, 16)}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>{em.from}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", lineHeight: 1.4 }}>{em.snippet}</div>
              </div>
            ))
          )}
        </div>
      )}

      <style>{`@keyframes blink{0%,100%{opacity:.2}50%{opacity:1}}`}</style>
    </div>
  );
}
