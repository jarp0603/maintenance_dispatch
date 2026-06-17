import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  LayoutDashboard, Inbox, Wrench, Route as RouteIcon, Sparkles,
  Mail, Phone, MapPin, Clock, Calendar, CheckCircle2, AlertTriangle,
  ChevronRight, RefreshCw, Send, TrendingUp, Building2, User, X,
  Loader2, Navigation, ArrowRight, Play, MessageSquare, AlertCircle,
  Truck, Zap, LogOut, Settings, KeyRound,
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

/* ─── Constants ───────────────────────────────────────────────────── */

const INK   = "#181b22";
const AMBER = "#e08a00";
const API   = import.meta.env.VITE_API_URL || "/api";

const NAV = [
  { id: "dashboard", label: "Dashboard",   icon: LayoutDashboard },
  { id: "inbox",     label: "Inbox",       icon: Inbox           },
  { id: "orders",    label: "Work Orders", icon: Wrench          },
  { id: "routes",    label: "Routes",      icon: RouteIcon       },
  { id: "analyst",   label: "Analyst",     icon: Sparkles        },
];

// Map backend issue_type → display category
const CATEGORY_MAP = {
  plumbing: "Plumbing", electrical: "Electrical", hvac: "HVAC",
  appliances: "Appliance", general: "General", pest: "Pest",
  smoke_alarm: "Smoke Alarm", welding: "Welding", painting: "Painting",
  door_repair: "Locks/Security",
};
const CATEGORIES = Object.values(CATEGORY_MAP);
const ISSUE_TYPES = Object.keys(CATEGORY_MAP);

const PRIORITY = {
  emergency: { label: "Emergency", text: "text-red-700",    bg: "bg-red-50",    dot: "#dc2626", rank: 0 },
  high:      { label: "High",      text: "text-orange-700", bg: "bg-orange-50", dot: "#ea580c", rank: 1 },
  medium:    { label: "Medium",    text: "text-amber-700",  bg: "bg-amber-50",  dot: "#d97706", rank: 2 },
  low:       { label: "Low",       text: "text-slate-600",  bg: "bg-slate-100", dot: "#64748b", rank: 3 },
};

const STATUS = {
  pending:     { label: "New",         text: "text-violet-700",  bg: "bg-violet-50",  dot: "#7c3aed" },
  scheduled:   { label: "Scheduled",   text: "text-blue-700",    bg: "bg-blue-50",    dot: "#2563eb" },
  in_progress: { label: "In progress", text: "text-cyan-700",    bg: "bg-cyan-50",    dot: "#0891b2" },
  completed:   { label: "Completed",   text: "text-emerald-700", bg: "bg-emerald-50", dot: "#059669" },
  cancelled:   { label: "Cancelled",   text: "text-slate-500",   bg: "bg-slate-100",  dot: "#94a3b8" },
};

const DEPOT = { name: "Dispatch HQ", address: "500 Central Pkwy", lat: 30.2701, lng: -97.7404 };

const DEFAULT_SETTINGS = {
  workdayStart: 480, avgSpeedMph: 24, bufferMin: 15,
  durations: { Plumbing: 75, Electrical: 60, HVAC: 90, Appliance: 60, General: 45, Pest: 45, "Locks/Security": 30, "Smoke Alarm": 20, Welding: 90, Painting: 120 },
};

/* ─── Utils ──────────────────────────────────────────────────────── */

const cx = (...a) => a.filter(Boolean).join(" ");
const isoDate = (d) => d.toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();

function fmtTime(min) {
  let h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  const ap = h < 12 ? "AM" : "PM";
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}

function fmtDateShort(d) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function haversineMi(a, b) {
  const R = 3958.8;
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function roundUp(min, step = 5) { return Math.ceil(min / step) * step; }

function woToUi(wo) {
  // Normalize backend work order to UI shape
  const coordBase = 30.27;
  const coordHash = (str) => {
    let h = 0;
    for (const c of (str || "")) h = (h * 31 + c.charCodeAt(0)) | 0;
    return h;
  };
  const h = coordHash(wo.address);
  return {
    id: wo.id,
    createdAt: wo.created_at,
    updatedAt: wo.updated_at,
    status: wo.status,
    priority: PRIORITY[wo.priority] ? wo.priority : "medium",
    tenant: {
      name: wo.tenant_name,
      unit: wo.unit_number,
      phone: wo.tenant_phone || "",
      email: wo.tenant_email || "",
    },
    property: {
      name: wo.address,
      address: wo.address,
      lat: coordBase + ((h & 0xFFF) / 0xFFF - 0.5) * 0.06,
      lng: -97.74 + (((h >> 12) & 0xFFF) / 0xFFF - 0.5) * 0.06,
    },
    category: CATEGORY_MAP[wo.issue_type] || wo.issue_type || "General",
    description: wo.notes || `${wo.issue_type} issue`,
    source: { from: wo.tenant_email || "", subject: wo.notes || "" },
    schedule: wo.scheduled_date ? {
      date: wo.scheduled_date,
      startMin: wo.scheduled_time ? timeStrToMin(wo.scheduled_time) : 540,
      durationMin: DEFAULT_SETTINGS.durations[CATEGORY_MAP[wo.issue_type] || "General"] || 60,
    } : null,
    assignedTech: wo.assigned_tech || null,
    scheduledAt: wo.scheduled_at || null,
    completedAt: wo.completed_at || null,
    history: [],
  };
}

function timeStrToMin(str) {
  if (!str) return 480;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + (m || 0);
}

/* ─── API helpers ────────────────────────────────────────────────── */

function getToken() { return localStorage.getItem("dispatch_token"); }

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers };
  const res = await fetch(API + path, { ...opts, headers });
  if (res.status === 401) { localStorage.removeItem("dispatch_token"); window.location.reload(); }
  if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error(err.error || res.statusText); }
  return res.json();
}

/* ─── AI helpers (via backend proxy) ────────────────────────────── */

async function parseEmailViaBackend(email) {
  return apiFetch("/ai/parse-email", {
    method: "POST",
    body: JSON.stringify({ from: email.from, subject: email.subject, body: email.body }),
  });
}

async function analyzeViaBackend(summary, question) {
  const data = await apiFetch("/ai/analyze", {
    method: "POST",
    body: JSON.stringify({ summary, question }),
  });
  return data.result;
}

/* ─── Route optimizer (same as reference) ───────────────────────── */

function optimizeRoute(stops, settings) {
  if (stops.length === 0) return null;
  const remaining = stops.map(wo => ({ wo, p: wo.property }));
  const ordered = [];
  let cur = DEPOT;
  while (remaining.length) {
    let bi = 0, bd = Infinity;
    remaining.forEach((s, i) => { const d = haversineMi(cur, s.p); if (d < bd) { bd = d; bi = i; } });
    const next = remaining.splice(bi, 1)[0];
    ordered.push(next); cur = next.p;
  }
  const speed = settings.avgSpeedMph;
  const minsFor = mi => (mi / speed) * 60;
  let t = settings.workdayStart, totalDrive = 0, totalDist = 0;
  let prev = DEPOT;
  const legs = ordered.map((s, i) => {
    const inDist = haversineMi(prev, s.p);
    const inDrive = minsFor(inDist);
    totalDist += inDist; totalDrive += inDrive;
    const arrival = roundUp(t + (i === 0 ? inDrive : 0), 5);
    const dur = settings.durations[s.wo.category] || 60;
    const end = arrival + dur;
    const next = ordered[i + 1];
    const outDist = next ? haversineMi(s.p, next.p) : haversineMi(s.p, DEPOT);
    const outDrive = minsFor(outDist);
    t = end + outDrive + settings.bufferMin;
    prev = s.p;
    return { wo: s.wo, p: s.p, arrival, end, dur, driveIn: inDrive, distIn: inDist, driveOut: outDrive, distOut: outDist };
  });
  const back = haversineMi(prev, DEPOT);
  totalDist += back; totalDrive += minsFor(back);
  const finishMin = legs.length ? legs[legs.length - 1].end + minsFor(back) : settings.workdayStart;
  return { legs, totalDist, totalDrive, startMin: settings.workdayStart, finishMin, buffer: settings.bufferMin };
}

/* ─── Small UI components ────────────────────────────────────────── */

function Dot({ color }) { return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color }} />; }

function StatusBadge({ s }) {
  const m = STATUS[s] || STATUS.pending;
  return <span className={cx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", m.bg, m.text)}><Dot color={m.dot} />{m.label}</span>;
}

function PriorityBadge({ p }) {
  const m = PRIORITY[p] || PRIORITY.low;
  return <span className={cx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", m.bg, m.text)}><Dot color={m.dot} />{m.label}</span>;
}

function Spinner({ className }) { return <Loader2 className={cx("animate-spin", className)} />; }

function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: "#f1efe9" }}>
        <Icon className="w-6 h-6 text-stone-400" />
      </div>
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      {hint && <div className="text-xs text-slate-500 mt-1 max-w-xs">{hint}</div>}
    </div>
  );
}

function MiniMarkdown({ text }) {
  const lines = (text || "").split("\n").map(l => l.trim()).filter(Boolean);
  const renderInline = s => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
  return (
    <div className="space-y-2">
      {lines.map((l, i) => {
        const bullet = /^[-*•]\s+/.test(l);
        const clean = l.replace(/^[-*•]\s+/, "");
        return bullet ? (
          <div key={i} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
            <span className="mt-1.5"><Dot color={AMBER} /></span>
            <span>{renderInline(clean)}</span>
          </div>
        ) : (
          <p key={i} className="text-sm text-slate-700 leading-relaxed">{renderInline(clean)}</p>
        );
      })}
    </div>
  );
}

function Header({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function Modal({ children, onClose, title, icon: Icon }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            {Icon && <Icon className="w-4 h-4" style={{ color: AMBER }} />}{title}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ─── Login ─────────────────────────────────────────────────────── */

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async e => {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      const data = await apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      localStorage.setItem("dispatch_token", data.token);
      onLogin(data.user || data);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="h-screen flex items-center justify-center" style={{ background: "#f5f3ee" }}>
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm w-full max-w-sm p-8">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: INK }}>
            <Truck className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">Dispatch Console</div>
            <div className="text-xs text-slate-400">Property Maintenance Ops</div>
          </div>
        </div>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-400" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white mt-2 disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: INK }}>
            {loading ? <Spinner className="w-4 h-4" /> : null} Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Main App ──────────────────────────────────────────────────── */

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [orders, setOrders] = useState([]);
  const [inboxEmails, setInboxEmails] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const flash = msg => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  // Check token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    apiFetch("/auth/me").then(u => { setUser(u); }).catch(() => { localStorage.removeItem("dispatch_token"); }).finally(() => setLoading(false));
  }, []);

  // Load orders when logged in
  useEffect(() => {
    if (!user) return;
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    try {
      const data = await apiFetch("/workorders?limit=100");
      setOrders((data.data || []).map(woToUi));
    } catch (err) { console.error(err); }
  };

  const updateOrder = useCallback(async (id, patch) => {
    // patch is {status?, priority?, scheduled_date?, scheduled_time?, notes?}
    const backendPatch = {};
    if (patch.status !== undefined) backendPatch.status = patch.status;
    if (patch.priority !== undefined) backendPatch.priority = patch.priority;
    if (patch.notes !== undefined) backendPatch.notes = patch.notes;
    if (patch.scheduledDate !== undefined) backendPatch.scheduled_date = patch.scheduledDate;
    if (patch.scheduledTime !== undefined) backendPatch.scheduled_time = patch.scheduledTime;
    if (patch.assignedTech !== undefined) backendPatch.assigned_tech = patch.assignedTech;
    try {
      const updated = await apiFetch(`/workorders/${id}`, { method: "PUT", body: JSON.stringify(backendPatch) });
      setOrders(prev => prev.map(o => o.id === updated.id ? woToUi(updated) : o));
    } catch (err) { flash("Update failed: " + err.message); }
  }, []);

  const addOrder = useCallback(async (payload) => {
    // payload: {tenant_name, unit_number, address, issue_type, priority, notes, tenant_email}
    try {
      const created = await apiFetch("/workorders", { method: "POST", body: JSON.stringify(payload) });
      setOrders(prev => [woToUi(created), ...prev]);
      flash("Work order created");
      return woToUi(created);
    } catch (err) { flash("Failed to create: " + err.message); }
  }, []);

  const logout = () => {
    localStorage.removeItem("dispatch_token");
    setUser(null); setOrders([]);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center" style={{ background: "#f5f3ee" }}>
        <div className="flex items-center gap-2 text-slate-500 text-sm"><Spinner className="w-4 h-4" /> Loading…</div>
      </div>
    );
  }

  if (!user) return <Login onLogin={u => { setUser(u); }} />;

  const shared = { orders, inboxEmails, setInboxEmails, settings, setSettings, updateOrder, addOrder, fetchOrders, flash };

  return (
    <div className="h-screen w-full flex flex-col md:flex-row font-sans text-slate-800" style={{ background: "#f5f3ee" }}>
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 text-stone-300" style={{ background: INK }}>
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: AMBER }}>
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">Dispatch</div>
            <div className="text-[10px] text-stone-400 font-mono tracking-wide">MAINTENANCE OPS</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(n => {
            const active = view === n.id;
            return (
              <button key={n.id} onClick={() => setView(n.id)}
                className={cx("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  active ? "text-white" : "text-stone-300 hover:text-white hover:bg-white/5")}
                style={active ? { background: "rgba(224,138,0,0.16)" } : undefined}>
                <n.icon className="w-4 h-4" style={active ? { color: AMBER } : undefined} />
                <span className="flex-1 text-left">{n.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-1 text-[11px] text-stone-500 truncate">{user.email}</div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-stone-400 hover:text-white hover:bg-white/5 mt-1">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden flex items-center gap-1 px-2 py-2 overflow-x-auto" style={{ background: INK }}>
        {NAV.map(n => {
          const active = view === n.id;
          return (
            <button key={n.id} onClick={() => setView(n.id)}
              className={cx("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap", active ? "text-white" : "text-stone-400")}
              style={active ? { background: "rgba(224,138,0,0.2)" } : undefined}>
              <n.icon className="w-3.5 h-3.5" style={active ? { color: AMBER } : undefined} />{n.label}
            </button>
          );
        })}
      </div>

      <main className="flex-1 overflow-y-auto">
        {view === "dashboard" && <Dashboard {...shared} go={setView} />}
        {view === "inbox"     && <InboxView {...shared} />}
        {view === "orders"    && <Orders {...shared} />}
        {view === "routes"    && <Routes {...shared} />}
        {view === "analyst"   && <Analyst {...shared} />}
      </main>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm text-white shadow-lg flex items-center gap-2" style={{ background: INK }}>
          <CheckCircle2 className="w-4 h-4" style={{ color: "#34d399" }} />{toast}
        </div>
      )}
    </div>
  );
}

/* ─── Dashboard ─────────────────────────────────────────────────── */

function Dashboard({ orders, go, settings, flash, fetchOrders }) {
  const open = orders.filter(o => !["completed", "cancelled"].includes(o.status));
  const todayStr = isoDate(new Date());
  const scheduledToday = orders.filter(o => o.schedule?.date === todayStr && ["scheduled", "in_progress"].includes(o.status));
  const weekAgo = Date.now() - 7 * 864e5;
  const completedWeek = orders.filter(o => o.status === "completed" && o.completedAt && new Date(o.completedAt).getTime() > weekAgo);

  const attention = [];
  open.forEach(o => {
    if (o.priority === "emergency" && o.status === "pending") attention.push({ o, kind: "emergency", text: "Unassigned emergency" });
    if (o.schedule?.date && o.schedule.date < todayStr && o.status === "scheduled") attention.push({ o, kind: "overdue", text: "Scheduled date passed" });
  });

  const statusData = Object.keys(STATUS).map(k => ({
    name: STATUS[k].label, value: orders.filter(o => o.status === k).length, color: STATUS[k].dot,
  })).filter(d => d.value > 0);

  const catCounts = {};
  orders.forEach(o => { catCounts[o.category] = (catCounts[o.category] || 0) + 1; });
  const catData = Object.entries(catCounts).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    const key = isoDate(d);
    days.push({ label: d.toLocaleDateString(undefined, { weekday: "short" }), count: orders.filter(o => o.createdAt && isoDate(new Date(o.createdAt)) === key).length });
  }

  const stat = (label, value, sub, Icon, color) => (
    <div className="bg-white rounded-2xl border border-stone-200 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900 font-mono">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div className="p-5 md:p-7 max-w-6xl mx-auto">
      <Header title="Dashboard" subtitle="Live view of the dispatch pipeline"
        right={
          <button onClick={fetchOrders} className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white shadow-sm" style={{ background: INK }}>
            <RefreshCw className="w-4 h-4" style={{ color: AMBER }} /> Refresh
          </button>
        } />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {stat("Open work orders",  open.length,            `${orders.length} total`,     Wrench,        "#2563eb")}
        {stat("Scheduled today",   scheduledToday.length,  "ready to route",             Calendar,      "#0891b2")}
        {stat("Completed (7d)",    completedWeek.length,   "this week",                  CheckCircle2,  "#059669")}
        {stat("Open emergencies",  open.filter(o => o.priority === "emergency").length, "needs dispatch", AlertTriangle, "#dc2626")}
      </div>

      {/* Needs attention */}
      <div className="bg-white rounded-2xl border border-stone-200 mb-6">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-slate-800">Needs attention</span>
          <span className="text-xs text-slate-400">{attention.length}</span>
        </div>
        {attention.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-400">Nothing urgent. Pipeline is clear.</div>
        ) : (
          <div className="divide-y divide-stone-100">
            {attention.slice(0, 6).map(({ o, kind, text }, i) => (
              <button key={i} onClick={() => go("orders")} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 text-left">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: kind === "emergency" || kind === "overdue" ? "#fef2f2" : "#fffbeb" }}>
                  {kind === "followup" ? <Send className="w-3.5 h-3.5 text-amber-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-600" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{o.tenant.name} · {o.property.name} #{o.tenant.unit}</div>
                  <div className="text-xs text-slate-500 truncate">{text} — {o.description}</div>
                </div>
                <PriorityBadge p={o.priority} />
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <div className="text-sm font-semibold text-slate-800 mb-3">New work orders · 7 days</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={days} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1efe9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e7e5e4", fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke={AMBER} strokeWidth={2.5} dot={{ r: 3, fill: AMBER }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <div className="text-sm font-semibold text-slate-800 mb-3">By status</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e7e5e4", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
            {statusData.map((d, i) => <span key={i} className="flex items-center gap-1 text-[11px] text-slate-500"><Dot color={d.color} />{d.name}</span>)}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-4">
          <div className="text-sm font-semibold text-slate-800 mb-3">By category</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={catData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1efe9" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e7e5e4", fontSize: 12 }} />
              <Bar dataKey="value" fill={INK} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ─── Inbox ─────────────────────────────────────────────────────── */

function InboxView({ addOrder, flash }) {
  const [syncing, setSyncing] = useState(false);
  const [gmailStatus, setGmailStatus] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [parsingId, setParsingId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [emails, setEmails] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/gmail/status").then(s => setGmailStatus(s)).catch(() => {});
  }, []);

  const syncGmail = async () => {
    setSyncing(true); setError(null);
    try {
      const res = await apiFetch("/gmail/sync", { method: "POST" });
      setSyncResult(res);
      if (res.emails) setEmails(res.emails || []);
      flash(`Synced — ${res.created || 0} new work orders created`);
    } catch (err) {
      setError(err.message || "Sync failed");
    } finally { setSyncing(false); }
  };

  const connectGmail = async () => {
    try {
      const { url } = await apiFetch("/gmail/auth-url");
      window.location.href = url;
    } catch (err) { setError(err.message); }
  };

  const handleParse = async (email) => {
    setError(null); setParsingId(email.id);
    try {
      const data = await parseEmailViaBackend(email);
      setPreview({ email, data });
    } catch {
      setError("AI parsing is not configured on the backend yet. Add ANTHROPIC_API_KEY to your Railway environment variables.");
    } finally { setParsingId(null); }
  };

  const confirmCreate = async () => {
    const { email, data } = preview;
    const issueType = Object.entries(CATEGORY_MAP).find(([, v]) => v.toLowerCase() === (data.category || "").toLowerCase())?.[0] || "general";
    await addOrder({
      tenant_name: data.tenant_name || email.name,
      unit_number: data.unit || "—",
      address: data.address || "Unknown address",
      issue_type: issueType,
      priority: PRIORITY[data.priority] ? data.priority : "medium",
      notes: data.description || email.subject,
      tenant_email: email.from,
      source: "gmail",
    });
    setPreview(null);
    setEmails(prev => prev.filter(e => e.id !== email.id));
  };

  return (
    <div className="p-5 md:p-7 max-w-5xl mx-auto">
      <Header title="Inbox" subtitle="Maintenance emails from Gmail · sync to create work orders"
        right={
          <div className="flex items-center gap-2">
            {gmailStatus?.connected
              ? <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-stone-200 px-3 py-1.5 rounded-full">
                  <Mail className="w-3.5 h-3.5 text-emerald-600" /> {gmailStatus.email}
                </span>
              : <button onClick={connectGmail} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: INK }}>
                  <Mail className="w-3.5 h-3.5" /> Connect Gmail
                </button>
            }
            {gmailStatus?.connected && (
              <button onClick={syncGmail} disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: INK }}>
                {syncing ? <Spinner className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            )}
          </div>
        } />

      {error && <div className="mb-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>}

      {syncResult && (
        <div className="mb-4 flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          Synced {syncResult.checked || 0} emails · {syncResult.created || 0} work orders created
        </div>
      )}

      {emails.length === 0 ? (
        <EmptyState icon={Inbox} title={gmailStatus?.connected ? "Sync to check for new emails" : "Connect Gmail to get started"}
          hint={gmailStatus?.connected ? "Click 'Sync now' to fetch the latest maintenance emails from your inbox." : "Connect your Gmail account to pull in tenant maintenance requests automatically."} />
      ) : (
        <div className="space-y-3">
          {emails.map(email => (
            <div key={email.id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-xs font-semibold text-slate-500 shrink-0">
                      {(email.name || "?").split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{email.subject}</div>
                      <div className="text-xs text-slate-500 font-mono">{email.from}</div>
                    </div>
                  </div>
                  <button onClick={() => handleParse(email)} disabled={parsingId === email.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white shrink-0 disabled:opacity-60" style={{ background: INK }}>
                    {parsingId === email.id ? <Spinner className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" style={{ color: AMBER }} />}
                    {parsingId === email.id ? "Parsing…" : "Parse"}
                  </button>
                </div>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">{email.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <Modal onClose={() => setPreview(null)} title="Review extracted work order" icon={Sparkles}>
          <p className="text-xs text-slate-500 mb-4">AI parsed this from the email. Confirm to create the work order.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tenant"   value={preview.data.tenant_name} />
            <Field label="Unit"     value={preview.data.unit} mono />
            <Field label="Phone"    value={preview.data.phone || "—"} mono />
            <Field label="Property" value={preview.data.property_name} />
            <Field label="Address"  value={preview.data.address} full />
            <div>
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1">Category</div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{preview.data.category}</span>
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1">Priority</div>
              <PriorityBadge p={PRIORITY[preview.data.priority] ? preview.data.priority : "medium"} />
            </div>
            <Field label="Description" value={preview.data.description} full />
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={() => setPreview(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-stone-100 hover:bg-stone-200">Discard</button>
            <button onClick={confirmCreate} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: INK }}>Create work order</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, value, mono, full }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={cx("text-sm text-slate-800", mono && "font-mono")}>{value || "—"}</div>
    </div>
  );
}

/* ─── Work Orders ───────────────────────────────────────────────── */

function Orders({ orders, updateOrder, settings, flash, fetchOrders, addOrder }) {
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const filters = [
    { id: "all",         label: "All"         },
    { id: "pending",     label: "New"         },
    { id: "scheduled",   label: "Scheduled"   },
    { id: "in_progress", label: "In progress" },
    { id: "completed",   label: "Completed"   },
  ];

  let list = [...orders].sort((a, b) => {
    const pr = PRIORITY[a.priority]?.rank - PRIORITY[b.priority]?.rank;
    if (pr !== 0 && (a.status === "pending" || b.status === "pending")) return pr;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  if (filter !== "all") list = list.filter(o => o.status === filter);

  const current = orders.find(o => o.id === openId);

  return (
    <div className="p-5 md:p-7 max-w-6xl mx-auto">
      <Header title="Work Orders" subtitle="Track every request from intake to close-out"
        right={
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: INK }}>
            <Wrench className="w-4 h-4" style={{ color: AMBER }} /> New order
          </button>
        } />

      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {filters.map(f => {
          const n = f.id === "all" ? orders.length : orders.filter(o => o.status === f.id).length;
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={cx("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors",
                active ? "text-white border-transparent" : "text-slate-600 bg-white border-stone-200 hover:border-stone-300")}
              style={active ? { background: INK } : undefined}>
              {f.label}<span className={cx("text-xs", active ? "text-stone-300" : "text-slate-400")}>{n}</span>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Wrench} title="No work orders here" hint="Try a different filter or create a new work order." />
      ) : (
        <div className="space-y-2">
          {list.map(o => (
            <button key={o.id} onClick={() => setOpenId(o.id)}
              className="w-full bg-white rounded-xl border border-stone-200 hover:border-stone-300 p-3.5 text-left flex items-center gap-3 transition-colors">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: PRIORITY[o.priority]?.bg }}>
                <Dot color={PRIORITY[o.priority]?.dot} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 truncate">{o.tenant.name}</span>
                  <span className="text-xs text-slate-400 font-mono shrink-0">{o.property.name} #{o.tenant.unit}</span>
                </div>
                <div className="text-xs text-slate-500 truncate mt-0.5">{o.category} · {o.description}</div>
              </div>
              <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                <StatusBadge s={o.status} />
                {o.schedule && <span className="text-[11px] text-slate-400 font-mono">{fmtDateShort(o.schedule.date)} · {fmtTime(o.schedule.startMin)}</span>}
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {current && <OrderDrawer o={current} onClose={() => { setOpenId(null); fetchOrders(); }} updateOrder={updateOrder} settings={settings} flash={flash} />}
      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} addOrder={addOrder} />}
    </div>
  );
}

function CreateOrderModal({ onClose, addOrder }) {
  const [form, setForm] = useState({ tenant_name: "", unit_number: "", address: "", issue_type: "general", priority: "medium", notes: "", tenant_email: "" });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setLoading(true);
    await addOrder(form);
    setLoading(false); onClose();
  };

  return (
    <Modal onClose={onClose} title="New work order" icon={Wrench}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tenant name *</label>
            <input value={form.tenant_name} onChange={set("tenant_name")} required className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Unit #</label>
            <input value={form.unit_number} onChange={set("unit_number")} className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Address *</label>
          <input value={form.address} onChange={set("address")} required className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Issue type</label>
            <select value={form.issue_type} onChange={set("issue_type")} className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm">
              {ISSUE_TYPES.map(t => <option key={t} value={t}>{CATEGORY_MAP[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
            <select value={form.priority} onChange={set("priority")} className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm">
              {Object.keys(PRIORITY).map(p => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Tenant email</label>
          <input type="email" value={form.tenant_email} onChange={set("tenant_email")} className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Description / notes</label>
          <textarea value={form.notes} onChange={set("notes")} rows={3} className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm resize-none" />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-stone-100 hover:bg-stone-200">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: INK }}>
            {loading ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function OrderDrawer({ o, onClose, updateOrder, settings, flash }) {
  const [tab, setTab] = useState("detail");
  const [booking, setBooking] = useState(false);

  const advance = async (status) => {
    await updateOrder(o.id, { status });
    flash("Status updated");
  };

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} className={cx("px-3 py-1.5 text-sm rounded-lg", tab === id ? "bg-stone-100 text-slate-900 font-medium" : "text-slate-500")}>{label}</button>
  );

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-stone-100 px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5"><StatusBadge s={o.status} /><PriorityBadge p={o.priority} /></div>
            <h2 className="text-base font-semibold text-slate-900 truncate">{o.tenant.name}</h2>
            <div className="text-xs text-slate-500 font-mono">#{o.id} · {o.property.name} #{o.tenant.unit}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-stone-100 shrink-0"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        <div className="px-5 pt-3 flex gap-1"><TabBtn id="detail" label="Details" /><TabBtn id="activity" label="Activity" /></div>

        <div className="p-5 space-y-4">
          <div className="bg-stone-50 rounded-xl p-3.5 text-sm text-slate-700 leading-relaxed">{o.description}</div>

          <div className="grid grid-cols-2 gap-3">
            <InfoRow icon={User}     label="Tenant"   value={o.tenant.name} />
            <InfoRow icon={Phone}    label="Phone"    value={o.tenant.phone || "—"} mono />
            <InfoRow icon={Building2} label="Property" value={o.property.name} />
            <InfoRow icon={MapPin}   label="Address"  value={o.property.address} />
            <InfoRow icon={Wrench}   label="Category" value={o.category} />
            <InfoRow icon={Mail}     label="Email"    value={o.tenant.email || "—"} mono />
          </div>

          {o.schedule && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3.5">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-800 mb-1"><Calendar className="w-4 h-4" /> Appointment</div>
              <div className="text-sm text-blue-700 font-mono">{fmtDateShort(o.schedule.date)} · {fmtTime(o.schedule.startMin)}–{fmtTime(o.schedule.startMin + o.schedule.durationMin)}</div>
              {o.assignedTech && <div className="text-xs text-blue-600 mt-0.5">Tech: {o.assignedTech}</div>}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-1">
            {o.status === "pending" && (
              <button onClick={() => setBooking(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: INK }}>
                <Calendar className="w-4 h-4" style={{ color: AMBER }} /> Schedule appointment
              </button>
            )}
            {o.status === "scheduled" && (
              <button onClick={() => advance("in_progress")} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: "#0891b2" }}>
                <Play className="w-4 h-4" /> Start job
              </button>
            )}
            {o.status === "in_progress" && (
              <button onClick={() => advance("completed")} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: "#059669" }}>
                <CheckCircle2 className="w-4 h-4" /> Mark complete
              </button>
            )}
            {o.status === "completed" && (
              <div className="text-center text-sm text-emerald-700 bg-emerald-50 rounded-xl py-2.5 font-medium">
                Completed {o.completedAt ? new Date(o.completedAt).toLocaleDateString() : ""}
              </div>
            )}
            {!["completed", "cancelled"].includes(o.status) && (
              <button onClick={() => advance("cancelled")} className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 bg-stone-100 hover:bg-stone-200">Cancel work order</button>
            )}
          </div>
        </div>

        {booking && <BookingModal o={o} settings={settings} onClose={() => setBooking(false)}
          onBook={async (date, startMin, tech) => {
            const h = Math.floor(startMin / 60), m = startMin % 60;
            await updateOrder(o.id, { status: "scheduled", scheduledDate: date, scheduledTime: `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`, assignedTech: tech });
            setBooking(false); flash("Appointment scheduled");
          }} />}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, mono }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] text-slate-400">{label}</div>
        <div className={cx("text-sm text-slate-800 truncate", mono && "font-mono")}>{value}</div>
      </div>
    </div>
  );
}

function BookingModal({ o, settings, onClose, onBook }) {
  const [date, setDate] = useState(isoDate(new Date(Date.now() + 864e5)));
  const [time, setTime] = useState(540);
  const [tech, setTech] = useState("Carlos M.");
  const times = [];
  for (let m = settings.workdayStart; m <= 17 * 60; m += 30) times.push(m);
  return (
    <Modal onClose={onClose} title="Schedule appointment" icon={Calendar}>
      <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full mb-3 px-3 py-2 rounded-lg border border-stone-200 text-sm" />
      <label className="block text-xs font-medium text-slate-500 mb-1">Time</label>
      <select value={time} onChange={e => setTime(Number(e.target.value))} className="w-full mb-3 px-3 py-2 rounded-lg border border-stone-200 text-sm">
        {times.map(m => <option key={m} value={m}>{fmtTime(m)}</option>)}
      </select>
      <label className="block text-xs font-medium text-slate-500 mb-1">Technician</label>
      <select value={tech} onChange={e => setTech(e.target.value)} className="w-full mb-4 px-3 py-2 rounded-lg border border-stone-200 text-sm">
        {["Carlos M.", "Dee R.", "Priya K.", "James T."].map(t => <option key={t}>{t}</option>)}
      </select>
      <button onClick={() => onBook(date, time, tech)} className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: "#2563eb" }}>Confirm appointment</button>
    </Modal>
  );
}

/* ─── Routes ─────────────────────────────────────────────────────── */

function Routes({ orders, settings, setSettings, updateOrder, flash }) {
  const [date, setDate] = useState(isoDate(new Date()));
  const stops = orders.filter(o => o.schedule?.date === date && ["scheduled", "in_progress"].includes(o.status));
  const plan = useMemo(() => optimizeRoute(stops, settings), [stops, settings]);
  const datesWithJobs = [...new Set(orders.filter(o => o.schedule && ["scheduled", "in_progress"].includes(o.status)).map(o => o.schedule.date))].sort();

  const applyTimes = async () => {
    if (!plan) return;
    for (const leg of plan.legs) {
      const h = Math.floor(leg.arrival / 60), m = leg.arrival % 60;
      await updateOrder(leg.wo.id, { scheduledTime: `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}` });
    }
    flash("Optimized times applied");
  };

  const map = useMemo(() => {
    if (!plan) return null;
    const pts = [DEPOT, ...plan.legs.map(l => l.p)];
    const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const W = 560, H = 320, pad = 36;
    const sx = lng => maxLng === minLng ? W / 2 : pad + ((lng - minLng) / (maxLng - minLng)) * (W - 2 * pad);
    const sy = lat => maxLat === minLat ? H / 2 : H - pad - ((lat - minLat) / (maxLat - minLat)) * (H - 2 * pad);
    return { W, H, depot: { x: sx(DEPOT.lng), y: sy(DEPOT.lat) }, stops: plan.legs.map(l => ({ x: sx(l.p.lng), y: sy(l.p.lat), wo: l.wo })) };
  }, [plan]);

  return (
    <div className="p-5 md:p-7 max-w-5xl mx-auto">
      <Header title="Routes" subtitle="Optimized run for same-day jobs, with clean gaps between stops" />

      <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Day</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 rounded-lg border border-stone-200 text-sm" />
            {datesWithJobs.length > 0 && (
              <div className="flex gap-1 mt-2">
                {datesWithJobs.slice(0, 4).map(d => (
                  <button key={d} onClick={() => setDate(d)} className={cx("text-[11px] px-2 py-1 rounded-full border", d === date ? "text-white border-transparent" : "text-slate-500 border-stone-200")} style={d === date ? { background: INK } : undefined}>{fmtDateShort(d)}</button>
                ))}
              </div>
            )}
          </div>
          <NumControl label="Start" value={settings.workdayStart} onChange={v => setSettings({ ...settings, workdayStart: v })} render={fmtTime} step={30} min={360} max={720} />
          <NumControl label="Gap (min)" value={settings.bufferMin} onChange={v => setSettings({ ...settings, bufferMin: v })} step={5} min={0} max={60} />
          <NumControl label="Avg mph" value={settings.avgSpeedMph} onChange={v => setSettings({ ...settings, avgSpeedMph: v })} step={1} min={8} max={60} />
          {plan && <button onClick={applyTimes} className="ml-auto flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: AMBER }}><CheckCircle2 className="w-4 h-4" /> Apply times</button>}
        </div>
      </div>

      {!plan ? (
        <EmptyState icon={RouteIcon} title="No jobs scheduled this day" hint="Schedule work orders first, then come back to optimize the route." />
      ) : (
        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Navigation className="w-4 h-4" style={{ color: AMBER }} /> Optimized run</div>
                <div className="text-xs text-slate-500 font-mono">{plan.totalDist.toFixed(1)} mi · {Math.round(plan.totalDrive)} min drive</div>
              </div>
              <svg viewBox={`0 0 ${map.W} ${map.H}`} className="w-full rounded-xl" style={{ background: "#fafaf8" }}>
                <defs><pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="#eee9e0" strokeWidth="1" /></pattern></defs>
                <rect width={map.W} height={map.H} fill="url(#grid)" />
                <polyline points={[map.depot, ...map.stops, map.depot].map(p => `${p.x},${p.y}`).join(" ")}
                  fill="none" stroke={AMBER} strokeWidth="2.5" strokeDasharray="2 0" opacity="0.55" strokeLinejoin="round" />
                <g>
                  <rect x={map.depot.x - 7} y={map.depot.y - 7} width="14" height="14" rx="3" fill={INK} transform={`rotate(45 ${map.depot.x} ${map.depot.y})`} />
                  <text x={map.depot.x} y={map.depot.y - 14} textAnchor="middle" fontSize="9" fill="#64748b" fontFamily="monospace">HQ</text>
                </g>
                {map.stops.map((s, i) => (
                  <g key={i}>
                    <circle cx={s.x} cy={s.y} r="12" fill="#fff" stroke={PRIORITY[s.wo.priority]?.dot || "#64748b"} strokeWidth="2.5" />
                    <text x={s.x} y={s.y + 3.5} textAnchor="middle" fontSize="11" fontWeight="700" fill={INK}>{i + 1}</text>
                  </g>
                ))}
              </svg>
              <div className="flex items-center justify-between mt-3 text-xs">
                <span className="text-slate-500 font-mono">Depart {fmtTime(plan.startMin)}</span>
                <span className="text-slate-500 font-mono">Back at HQ ~{fmtTime(plan.finishMin)}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Stops"      value={plan.legs.length} />
              <MiniStat label="Drive time" value={Math.round(plan.totalDrive) + "m"} />
              <MiniStat label="Gap"        value={plan.buffer + "m"} />
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100 text-sm font-semibold text-slate-800">Run sheet</div>
              <div className="divide-y divide-stone-100">
                {plan.legs.map((leg, i) => (
                  <div key={i} className="p-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: PRIORITY[leg.wo.priority]?.bg, color: PRIORITY[leg.wo.priority]?.dot }}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{leg.wo.property.name} #{leg.wo.tenant.unit}</div>
                        <div className="text-xs text-slate-500 truncate">{leg.wo.category} · {leg.wo.tenant.name}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono font-semibold text-slate-900">{fmtTime(leg.arrival)}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{leg.dur}m job</div>
                      </div>
                    </div>
                    {i < plan.legs.length - 1 && (
                      <div className="flex items-center gap-1.5 mt-2 ml-8 text-[11px] text-slate-400 font-mono">
                        <ArrowRight className="w-3 h-3" /> {leg.distOut.toFixed(1)}mi · {Math.round(leg.driveOut)}m drive + {plan.buffer}m gap
                      </div>
                    )}
                  </div>
                ))}
                <div className="p-3.5 flex items-center gap-2.5 bg-stone-50">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: INK }}><Truck className="w-3 h-3 text-white" /></span>
                  <span className="text-sm text-slate-600">Return to HQ</span>
                  <span className="ml-auto text-sm font-mono text-slate-500">~{fmtTime(plan.finishMin)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NumControl({ label, value, onChange, render, step = 1, min = 0, max = 999 }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
        <button onClick={() => onChange(Math.max(min, value - step))} className="px-2.5 py-2 text-slate-400 hover:bg-stone-50">–</button>
        <span className="px-2 text-sm font-mono text-slate-800 min-w-[64px] text-center">{render ? render(value) : value}</span>
        <button onClick={() => onChange(Math.min(max, value + step))} className="px-2.5 py-2 text-slate-400 hover:bg-stone-50">+</button>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-3 text-center">
      <div className="text-lg font-semibold font-mono text-slate-900">{value}</div>
      <div className="text-[11px] text-slate-400">{label}</div>
    </div>
  );
}

/* ─── Analyst ───────────────────────────────────────────────────── */

function Analyst({ orders, settings }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");

  const summary = useMemo(() => {
    const byStatus = {}; Object.keys(STATUS).forEach(k => byStatus[k] = orders.filter(o => o.status === k).length);
    const byCat = {}; orders.forEach(o => { byCat[o.category] = (byCat[o.category] || 0) + 1; });
    const byProp = {}; orders.forEach(o => { byProp[o.property.name] = (byProp[o.property.name] || 0) + 1; });
    const weekAgo = Date.now() - 7 * 864e5;
    const completedWeek = orders.filter(o => o.status === "completed" && o.completedAt && new Date(o.completedAt).getTime() > weekAgo).length;
    return { total: orders.length, by_status: byStatus, by_category: byCat, by_property: byProp, completed_this_week: completedWeek, open_emergencies: orders.filter(o => o.priority === "emergency" && !["completed","cancelled"].includes(o.status)).length };
  }, [orders, settings]);

  const ask = async (question) => {
    setError(null); setLoading(true); setResult(null);
    try { setResult(await analyzeViaBackend(summary, question)); }
    catch (e) { setError("AI analyst requires ANTHROPIC_API_KEY on the Railway backend. Add it in your Railway environment variables."); }
    finally { setLoading(false); }
  };

  const suggestions = [
    "What's the biggest bottleneck right now?",
    "Which properties generate the most work?",
    "Where am I losing time in scheduling?",
    "What should I prioritize today?",
  ];

  return (
    <div className="p-5 md:p-7 max-w-4xl mx-auto">
      <Header title="Work-order analyst" subtitle="AI insights over your live pipeline data" />

      <div className="grid sm:grid-cols-4 gap-3 mb-5">
        <SumCard label="Total orders"       value={summary.total} />
        <SumCard label="Completed (7d)"     value={summary.completed_this_week} />
        <SumCard label="Open emergencies"   value={summary.open_emergencies} alert={summary.open_emergencies > 0} />
        <SumCard label="Pending"            value={summary.by_status.pending || 0} />
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-4">
        <div className="flex gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && q.trim() && ask(q)}
            placeholder="Ask about your work orders…" className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-400" />
          <button onClick={() => ask(q.trim() || undefined)} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: INK }}>
            {loading ? <Spinner className="w-4 h-4" /> : <Sparkles className="w-4 h-4" style={{ color: AMBER }} />} Analyze
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {suggestions.map(s => (
            <button key={s} onClick={() => { setQ(s); ask(s); }} className="text-xs text-slate-600 bg-stone-100 hover:bg-stone-200 px-2.5 py-1.5 rounded-full">{s}</button>
          ))}
        </div>
      </div>

      {error && <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>}
      {loading && <div className="bg-white rounded-2xl border border-stone-200 p-6 flex items-center gap-2 text-sm text-slate-500"><Spinner className="w-4 h-4" /> Reading your pipeline…</div>}
      {result && !loading && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-800"><TrendingUp className="w-4 h-4" style={{ color: AMBER }} /> Analysis</div>
          <MiniMarkdown text={result} />
        </div>
      )}
      {!result && !loading && !error && (
        <EmptyState icon={Sparkles} title="Ask the analyst anything" hint="It reads your live work orders and surfaces bottlenecks, risks, and next actions." />
      )}
    </div>
  );
}

function SumCard({ label, value, alert }) {
  return (
    <div className={cx("rounded-2xl border p-4", alert ? "border-red-200 bg-red-50" : "border-stone-200 bg-white")}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={cx("text-2xl font-semibold font-mono mt-1", alert ? "text-red-700" : "text-slate-900")}>{value}</div>
    </div>
  );
}
