// src/StudyDesk.jsx
/* eslint-disable no-restricted-globals, react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient";

/* ─────────────────────────────────────────────────────────────────────────────
   GLOBAL CSS
───────────────────────────────────────────────────────────────────────────── */
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lora:ital,wght@0,600;1,400&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html, body, #root { height:100%; }
  body { font-family:'Inter',sans-serif; background:#EEF2F7; color:#0F1C2E; }
  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-thumb{background:#C4CFDE;border-radius:99px;}
  input,select,textarea,button{font-family:inherit;}
  [contenteditable]:empty:before{content:attr(data-placeholder);color:#94a3b8;pointer-events:none;}
  .fi{animation:fi .26s ease;}
  @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  .hl{transition:transform .18s,box-shadow .18s;}
  .hl:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(15,28,46,.10);}
  @keyframes spin{to{transform:rotate(360deg)}}
  .sp{animation:spin .75s linear infinite;}
  @keyframes shim{0%{background-position:100% 0}100%{background-position:-100% 0}}
`;

/* ─────────────────────────────────────────────────────────────────────────────
   BRAND COLOURS
───────────────────────────────────────────────────────────────────────────── */
const BRAND = {
  navy:"#0F2D52", navyMid:"#1A4173", navyLt:"#EBF1F8",
  gold:"#C9930C", goldLt:"#FDF3DC",
  slate:"#4A5568", muted:"#718096", line:"#DCE5EF",
  bg:"#EEF2F7", white:"#FFFFFF",
  success:"#0F7B4F", successBg:"#E6F5EF",
  danger:"#C0392B", dangerBg:"#FBEAE9",
  warn:"#B7620A", warnBg:"#FEF3E2",
};

const PAL = {
  Blue:  {bg:"#EBF4FF",border:"#B3D4F5",accent:"#1A6DBF",text:"#0D4A8A",dot:"#5BA3E0",soft:"#D6EBFF"},
  Green: {bg:"#E8F6EF",border:"#A8DCC0",accent:"#1A7A48",text:"#0D5230",dot:"#5ABF8A",soft:"#D0F0E0"},
  Purple:{bg:"#F2EDFB",border:"#C9B3F0",accent:"#5B2D9E",text:"#3B1A6E",dot:"#9B72DB",soft:"#E4D8F8"},
  Teal:  {bg:"#E6F7F8",border:"#A0D8DC",accent:"#0E7C86",text:"#095660",dot:"#4DB8C0",soft:"#CCF0F3"},
  Gold:  {bg:"#FDF3DC",border:"#F0D085",accent:"#B8860B",text:"#7A5700",dot:"#D4A520",soft:"#FAE8B0"},
};
const COLORS = ["Blue","Green","Purple","Teal","Gold"];

const PRIO_C = {
  High:  {c:"#C0392B",b:"#FBEAE9"},
  Medium:{c:"#B7620A",b:"#FEF3E2"},
  Low:   {c:"#0F7B4F",b:"#E6F5EF"},
};
const STAT_C = {
  Pending:      {c:"#B7620A",b:"#FEF3E2"},
  Done:         {c:"#0F7B4F",b:"#E6F5EF"},
  "Not Started":{c:"#718096",b:"#F4F6F9"},
  "In Progress":{c:"#1A6DBF",b:"#EBF4FF"},
  Submitted:    {c:"#5B2D9E",b:"#F2EDFB"},
  Graded:       {c:"#0F7B4F",b:"#E6F5EF"},
  Upcoming:     {c:"#1A6DBF",b:"#EBF4FF"},
  Completed:    {c:"#0F7B4F",b:"#E6F5EF"},
};

const TT_DAYS  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const TT_SLOTS = [];
for (let h = 6.5; h < 21.5; h += 0.5) {
  const hh = Math.floor(h);
  const mm = h % 1 === 0 ? "00" : "30";
  TT_SLOTS.push(`${String(hh).padStart(2,"0")}:${mm}`);
}

/* ─────────────────────────────────────────────────────────────────────────────
   UTILS
───────────────────────────────────────────────────────────────────────────── */
const NOW     = () => new Date();
const isOD    = d => d && new Date(d) < NOW();
const isSoon  = (d, days=7) => { if(!d) return false; const t=new Date(d); return t>=NOW()&&t<=new Date(+NOW()+days*864e5); };
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const fmtDT   = d => d ? new Date(d).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";
const fmtTime = d => d ? new Date(d).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}) : "";
const toInpDT = d => { if(!d) return ""; return new Date(d).toISOString().slice(0,16); };

/* ─────────────────────────────────────────────────────────────────────────────
   SUPABASE DATA LAYER
   KEY FIX: every insert now includes user_id explicitly.
   Supabase RLS policy checks auth.uid() = user_id — if user_id is missing
   the row is rejected silently. We grab the uid from the session and attach
   it to every insert payload.
───────────────────────────────────────────────────────────────────────────── */

// Returns the current user's ID — used to stamp every insert
async function getUid() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

function useTable(table, orderCol="created_at") {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setDbError(null);
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderCol, { ascending: true });

    if (error) {
      // Make errors visible instead of silently failing
      console.error(`[StudyDesk] useTable error on "${table}":`, error);
      setDbError(error.message);
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }, [table, orderCol]);

  useEffect(() => { load(); }, [load]);
  return { rows, loading, reload: load, dbError };
}

const db = {
  ins: async (t, p) => {
    const uid = await getUid();
    // Always stamp user_id on inserts so RLS policy is satisfied
    const payload = uid ? { ...p, user_id: uid } : p;
    const { data, error } = await supabase.from(t).insert(payload).select().single();
    if (error) {
      console.error(`[StudyDesk] insert error on "${t}":`, error);
      throw error;
    }
    return data;
  },
  upd: async (t, id, p) => {
    const { data, error } = await supabase.from(t).update(p).eq("id", id).select().single();
    if (error) {
      console.error(`[StudyDesk] update error on "${t}":`, error);
      throw error;
    }
    return data;
  },
  del: async (t, id) => {
    const { error } = await supabase.from(t).delete().eq("id", id);
    if (error) {
      console.error(`[StudyDesk] delete error on "${t}":`, error);
      throw error;
    }
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   DB STATUS BANNER  — shows if tables don't exist or RLS is blocking
───────────────────────────────────────────────────────────────────────────── */
function DbBanner({ error }) {
  if (!error) return null;
  const needsSetup = error.includes("does not exist") || error.includes("relation") || error.includes("42P01");
  return (
    <div style={{
      margin: "0 0 20px 0", padding: "14px 18px", borderRadius: 12,
      background: needsSetup ? BRAND.warnBg : BRAND.dangerBg,
      border: `1px solid ${needsSetup ? "#F0D085" : "#F5C0BC"}`,
      color: needsSetup ? BRAND.warn : BRAND.danger,
    }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>
        {needsSetup ? "⚠️ Database tables not set up yet" : "❌ Database error"}
      </div>
      {needsSetup ? (
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          The Supabase tables don't exist yet. Go to your <strong>Supabase Dashboard → SQL Editor</strong>,
          paste and run the SQL from <code>src/supabaseClient.js</code>, then refresh this page.
        </div>
      ) : (
        <div style={{ fontSize: 12, fontFamily: "monospace", wordBreak: "break-all" }}>{error}</div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ICONS
───────────────────────────────────────────────────────────────────────────── */
const IC = {
  home:"M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  book:"M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  note:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  cal:"M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  tbl:"M3 10h18M3 14h18M10 4v16M3 4h18a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1z",
  user:"M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  plus:"M12 4v16m8-8H4",
  edit:"M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  trash:"M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  cL:"M15 19l-7-7 7-7", cR:"M9 5l7 7-7 7",
  x:"M6 18L18 6M6 6l12 12", ok:"M5 13l4 4L19 7",
  alert:"M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  clock:"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  srch:"M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  star:"M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
  doc:"M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  out:"M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
};
function Ic({ n, size=16, style={} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={IC[n] || IC.home}/>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ATOMS
───────────────────────────────────────────────────────────────────────────── */
function Pill({ children, color, bg, border, style={} }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 10px",
      borderRadius:99, fontSize:11, fontWeight:700,
      color:color||BRAND.slate, background:bg||BRAND.navyLt,
      border:border?`1px solid ${border}`:undefined, ...style }}>
      {children}
    </span>
  );
}
function PPill({ p }) { const c=PRIO_C[p]||PRIO_C.Medium; return <Pill color={c.c} bg={c.b}>{p}</Pill>; }
function SPill({ s }) { const c=STAT_C[s]||{c:BRAND.slate,b:BRAND.navyLt}; return <Pill color={c.c} bg={c.b}>{s}</Pill>; }
function CPill({ course }) {
  if (!course) return null;
  const col = PAL[course.color_tag]||PAL.Blue;
  return <Pill color={col.text} bg={col.soft} border={col.border}>{course.course_code}</Pill>;
}
function OD() {
  return (
    <span style={{ fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:99,
      background:BRAND.dangerBg, color:BRAND.danger, border:"1px solid #F5C0BC" }}>
      OVERDUE
    </span>
  );
}

function Btn({ children, variant="primary", size="md", onClick, disabled, style={}, type="button", loading }) {
  const sz = { sm:{fs:12,p:"5px 14px"}, md:{fs:13,p:"9px 20px"}, lg:{fs:14,p:"12px 26px"} }[size] || {fs:13,p:"9px 20px"};
  const base = { display:"inline-flex", alignItems:"center", gap:6, border:"none", borderRadius:9,
    cursor:disabled||loading?"not-allowed":"pointer", fontWeight:600, fontFamily:"inherit",
    transition:"all .17s", opacity:disabled||loading?.55:1, fontSize:sz.fs, padding:sz.p };
  const V = {
    primary:  { background:BRAND.navy,    color:"#fff",      boxShadow:"0 2px 10px rgba(15,45,82,.30)" },
    secondary:{ background:BRAND.navyLt,  color:BRAND.navy,  border:`1px solid ${BRAND.line}` },
    danger:   { background:BRAND.dangerBg,color:BRAND.danger, border:"1px solid #F5C0BC" },
    ghost:    { background:"transparent", color:BRAND.muted },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled||loading}
      style={{ ...base, ...(V[variant]||V.primary), ...style }}
      onMouseEnter={e=>{ if(!disabled&&!loading) e.currentTarget.style.filter="brightness(.91)"; }}
      onMouseLeave={e=>{ e.currentTarget.style.filter=""; }}>
      {loading && (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="sp">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
        </svg>
      )}
      {children}
    </button>
  );
}

function Inp({ label, type="text", value, onChange, placeholder, required, min, max, style={} }) {
  const [f, sF] = useState(false);
  return (
    <div style={{ marginBottom:14 }}>
      {label && (
        <label style={{ fontSize:11, fontWeight:700, color:BRAND.slate, display:"block",
          marginBottom:5, textTransform:"uppercase", letterSpacing:".06em" }}>
          {label}{required && <span style={{ color:BRAND.danger }}> *</span>}
        </label>
      )}
      <input type={type} value={value??""} onChange={onChange} placeholder={placeholder} min={min} max={max}
        onFocus={()=>sF(true)} onBlur={()=>sF(false)}
        style={{ width:"100%", padding:"10px 13px", borderRadius:9,
          border:`1.5px solid ${f ? BRAND.navyMid : BRAND.line}`,
          fontSize:13, color:BRAND.navy, background:BRAND.white,
          outline:"none", fontFamily:"inherit", transition:"border .15s", ...style }}/>
    </div>
  );
}
function Sel({ label, value, onChange, options, required }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && (
        <label style={{ fontSize:11, fontWeight:700, color:BRAND.slate, display:"block",
          marginBottom:5, textTransform:"uppercase", letterSpacing:".06em" }}>
          {label}{required && <span style={{ color:BRAND.danger }}> *</span>}
        </label>
      )}
      <select value={value??""} onChange={onChange}
        style={{ width:"100%", padding:"10px 13px", borderRadius:9,
          border:`1.5px solid ${BRAND.line}`, fontSize:13, color:BRAND.navy,
          background:BRAND.white, outline:"none", fontFamily:"inherit", cursor:"pointer" }}>
        {options.map(o => typeof o==="string"
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.v} value={o.v}>{o.l}</option>
        )}
      </select>
    </div>
  );
}
function TA({ label, value, onChange, placeholder, rows=3 }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && (
        <label style={{ fontSize:11, fontWeight:700, color:BRAND.slate, display:"block",
          marginBottom:5, textTransform:"uppercase", letterSpacing:".06em" }}>
          {label}
        </label>
      )}
      <textarea value={value??""} onChange={onChange} placeholder={placeholder} rows={rows}
        style={{ width:"100%", padding:"10px 13px", borderRadius:9,
          border:`1.5px solid ${BRAND.line}`, fontSize:13, color:BRAND.navy,
          background:BRAND.white, outline:"none", fontFamily:"inherit", resize:"vertical" }}/>
    </div>
  );
}
function ErrBox({ msg }) {
  return msg ? (
    <div style={{ padding:"12px 15px", borderRadius:10, background:BRAND.dangerBg,
      border:"1px solid #F5C0BC", color:BRAND.danger, fontSize:13, marginBottom:15,
      lineHeight:1.5 }}>
      ❌ {msg}
    </div>
  ) : null;
}
function Modal({ title, onClose, children, wide=false }) {
  useEffect(() => {
    const h = e => { if(e.key==="Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(8,18,32,.50)", display:"flex",
      alignItems:"center", justifyContent:"center", zIndex:1000, padding:16, backdropFilter:"blur(5px)" }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div className="fi" style={{ background:BRAND.white, borderRadius:18,
        width:wide?"min(720px,96vw)":"min(540px,96vw)", maxHeight:"92vh", overflowY:"auto",
        boxShadow:"0 32px 80px rgba(8,18,32,.25)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"22px 26px 16px", borderBottom:`1px solid ${BRAND.line}` }}>
          <h2 style={{ fontSize:17, fontWeight:800, color:BRAND.navy }}>{title}</h2>
          <Btn variant="ghost" onClick={onClose} style={{ padding:6, borderRadius:8 }}><Ic n="x" size={18}/></Btn>
        </div>
        <div style={{ padding:"20px 26px 26px" }}>{children}</div>
      </div>
    </div>
  );
}
function Empty({ icon="note", title, sub, action, onAction }) {
  return (
    <div style={{ textAlign:"center", padding:"56px 24px", color:BRAND.muted }}>
      <div style={{ width:64, height:64, borderRadius:18, background:BRAND.navyLt,
        display:"flex", alignItems:"center", justifyContent:"center",
        margin:"0 auto 16px", color:BRAND.navy }}>
        <Ic n={icon} size={28}/>
      </div>
      <div style={{ fontSize:15, fontWeight:700, color:BRAND.slate, marginBottom:6 }}>{title}</div>
      {sub && <div style={{ fontSize:13, marginBottom:18, color:BRAND.muted }}>{sub}</div>}
      {action && <Btn onClick={onAction}><Ic n="plus" size={14}/> {action}</Btn>}
    </div>
  );
}
function ColorPicker({ value, onChange }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ fontSize:11, fontWeight:700, color:BRAND.slate, display:"block",
        marginBottom:10, textTransform:"uppercase", letterSpacing:".06em" }}>Colour Tag</label>
      <div style={{ display:"flex", gap:12 }}>
        {COLORS.map(c => {
          const col = PAL[c];
          return (
            <button key={c} type="button" onClick={()=>onChange(c)} title={c}
              style={{ width:36, height:36, borderRadius:"50%", background:col.accent,
                border:value===c?`3px solid ${BRAND.navy}`:"3px solid transparent",
                cursor:"pointer",
                boxShadow:value===c?`0 0 0 2px #fff inset,0 0 0 4px ${col.accent}`:"none",
                transition:"all .15s" }}/>
          );
        })}
      </div>
    </div>
  );
}
function StatCard({ icon, label, value, accent, sub }) {
  const a = accent || BRAND.navy;
  return (
    <div className="hl" style={{ background:BRAND.white, borderRadius:16, padding:"20px 18px",
      border:`1px solid ${BRAND.line}`, display:"flex", alignItems:"flex-start", gap:14 }}>
      <div style={{ width:48, height:48, borderRadius:13, background:a+"1A",
        display:"flex", alignItems:"center", justifyContent:"center", color:a, flexShrink:0 }}>
        <Ic n={icon} size={22}/>
      </div>
      <div>
        <div style={{ fontSize:30, fontWeight:800, color:BRAND.navy, lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:12, color:BRAND.muted, marginTop:5, fontWeight:500 }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:a, fontWeight:700, marginTop:3 }}>{sub}</div>}
      </div>
    </div>
  );
}
function RichEd({ value, onChange, placeholder="Write your notes here..." }) {
  const ref = useRef(); const init = useRef(false);
  useEffect(() => { if(!init.current&&ref.current){ ref.current.innerHTML=value||""; init.current=true; }}, []);
  const cmd = (c, v) => { document.execCommand(c, false, v||null); ref.current.focus(); onChange(ref.current.innerHTML); };
  const tools = [
    {l:"B", c:()=>cmd("bold"),                   s:{fontWeight:800}},
    {l:"I", c:()=>cmd("italic"),                  s:{fontStyle:"italic"}},
    {l:"U", c:()=>cmd("underline"),               s:{textDecoration:"underline"}},
    {l:"H1",c:()=>cmd("formatBlock","h2"),         s:{fontWeight:800,fontSize:11}},
    {l:"H2",c:()=>cmd("formatBlock","h3"),         s:{fontWeight:800,fontSize:10}},
    {l:"•", c:()=>cmd("insertUnorderedList"),      s:{fontSize:18,lineHeight:"1"}},
    {l:"1.",c:()=>cmd("insertOrderedList"),        s:{fontSize:11}},
    {l:"—", c:()=>{cmd("removeFormat");cmd("formatBlock","p");}, s:{color:"#94a3b8"}},
  ];
  return (
    <div style={{ border:`1.5px solid ${BRAND.line}`, borderRadius:10, overflow:"hidden" }}>
      <div style={{ display:"flex", gap:2, padding:"6px 8px", background:BRAND.bg,
        borderBottom:`1px solid ${BRAND.line}`, flexWrap:"wrap" }}>
        {tools.map(t => (
          <button key={t.l} onMouseDown={e=>{ e.preventDefault(); t.c(); }}
            style={{ ...t.s, minWidth:28, height:28, border:`1px solid ${BRAND.line}`,
              borderRadius:6, cursor:"pointer", background:BRAND.white, color:BRAND.navy, padding:"0 4px" }}>
            {t.l}
          </button>
        ))}
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning data-placeholder={placeholder}
        onInput={e=>onChange(e.currentTarget.innerHTML)}
        style={{ padding:"13px 15px", minHeight:160, outline:"none", fontSize:14, lineHeight:1.75, color:BRAND.navy }}/>
    </div>
  );
}
function Skeleton() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14, padding:"28px 0" }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ height:76, borderRadius:13,
          background:"linear-gradient(90deg,#E8EEF5 25%,#D8E2EC 50%,#E8EEF5 75%)",
          backgroundSize:"400% 100%", animation:"shim 1.5s infinite" }}/>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────────────────────────────────────────── */
function Dashboard({ courses, deadlines, quizzes, assessments, assignments, notes, user, onNav, dbError }) {
  const d = NOW();
  const upcoming = [
    ...deadlines.filter(x=>x.status!=="Done"&&isSoon(x.due_date)).map(x=>({...x,_t:"Deadline",_d:x.due_date,_c:"#C0392B"})),
    ...assignments.filter(x=>x.status!=="Submitted"&&x.status!=="Graded"&&isSoon(x.due_date)).map(x=>({...x,_t:"Assignment",_d:x.due_date,_c:"#B7620A"})),
    ...quizzes.filter(x=>x.status!=="Completed"&&isSoon(x.date_time)).map(x=>({...x,_t:"Quiz",_d:x.date_time,_c:"#5B2D9E"})),
    ...assessments.filter(x=>x.status!=="Graded"&&x.status!=="Submitted"&&isSoon(x.due_date)).map(x=>({...x,_t:"Assessment",_d:x.due_date,_c:"#1A6DBF"})),
  ].sort((a,b) => new Date(a._d)-new Date(b._d));

  const overdue = [
    ...deadlines.filter(x=>x.status!=="Done"&&isOD(x.due_date)),
    ...assignments.filter(x=>x.status!=="Submitted"&&x.status!=="Graded"&&isOD(x.due_date)),
    ...assessments.filter(x=>x.status!=="Graded"&&x.status!=="Submitted"&&isOD(x.due_date)),
  ];

  const gc = id => courses.find(c=>c.id===id);
  const todayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()];
  const todayCourses = courses.filter(c=>c.schedule&&c.schedule.toLowerCase().includes(todayName.toLowerCase()));

  const meta = user?.user_metadata || {};
  const greeting = meta.first_name
    ? `${meta.first_name}${meta.last_name?" "+meta.last_name:""}`
    : meta.student_id || user?.email?.split("@")[0] || "Student";
  const programme = meta.programme || "";
  const studentId = meta.student_id || "";

  return (
    <div className="fi">
      <DbBanner error={dbError}/>

      {/* Header banner */}
      <div style={{ marginBottom:24, padding:"24px 28px", borderRadius:20, color:"#fff",
        background:"linear-gradient(135deg,#0F2D52 0%,#1A4173 60%,#0E3A6E 100%)" }}>
        <div style={{ fontSize:12, color:"rgba(255,255,255,.65)", fontWeight:500, marginBottom:6, letterSpacing:".04em" }}>
          {d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
        </div>
        <h1 style={{ fontSize:24, fontWeight:800, lineHeight:1.3, fontFamily:"'Lora',serif" }}>
          Good {d.getHours()<12?"morning":d.getHours()<17?"afternoon":"evening"},<br/>{greeting} 👋
        </h1>
        {(studentId||programme) && (
          <p style={{ fontSize:12, color:"rgba(255,255,255,.70)", marginTop:8, fontWeight:500 }}>
            {[studentId, programme, programme?"2025/2026 Semester 2":""].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
        <StatCard icon="doc"   label="Pending Tasks"    value={assignments.filter(a=>a.status==="Not Started"||a.status==="In Progress").length} accent="#B7620A"/>
        <StatCard icon="clock" label="Due This Week"    value={upcoming.length} accent="#1A6DBF"/>
        <StatCard icon="star"  label="Upcoming Quizzes" value={quizzes.filter(q=>q.status==="Upcoming").length} accent="#5B2D9E"/>
        <StatCard icon="alert" label="Overdue"          value={overdue.length} accent={BRAND.danger} sub={overdue.length>0?"Needs attention!":"All clear ✓"}/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:20 }}>
        {/* Upcoming */}
        <div style={{ background:BRAND.white, borderRadius:16, border:`1px solid ${BRAND.line}`, padding:"20px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h2 style={{ fontSize:14, fontWeight:800, color:BRAND.navy }}>📅 Next 7 Days</h2>
            <Btn variant="ghost" size="sm" onClick={()=>onNav("calendar")}><Ic n="cR" size={13}/>Calendar</Btn>
          </div>
          {upcoming.length===0
            ? <Empty icon="cal" title="Nothing due this week" sub="You're all caught up!"/>
            : upcoming.map(item => {
                const c = gc(item.course_id);
                const col = c ? PAL[c.color_tag] : PAL.Blue;
                const od = isOD(item._d);
                return (
                  <div key={item.id} style={{ display:"flex", gap:10, padding:"10px 13px", borderRadius:11,
                    marginBottom:8, background:od?BRAND.dangerBg:col.bg,
                    border:`1px solid ${od?"#F5C0BC":col.border}`, alignItems:"flex-start" }}>
                    <div style={{ width:4, borderRadius:2, alignSelf:"stretch", background:item._c, minHeight:34, flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:BRAND.navy, marginBottom:3,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</div>
                      <div style={{ fontSize:11, color:BRAND.muted, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                        {c && <CPill course={c}/>}
                        <span style={{ color:item._c, fontWeight:600 }}>{item._t}</span>
                        <span>· {fmtDT(item._d)}</span>
                        {od && <OD/>}
                      </div>
                    </div>
                    {item.priority && <PPill p={item.priority}/>}
                  </div>
                );
              })
          }
        </div>

        {/* Right col */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ background:"linear-gradient(135deg,#0F2D52,#1A6DBF)", borderRadius:16, padding:"20px", color:"#fff" }}>
            <div style={{ fontSize:11, fontWeight:700, opacity:.75, marginBottom:12, letterSpacing:".08em" }}>
              TODAY · {todayName.toUpperCase()}
            </div>
            {todayCourses.length===0
              ? <div style={{ fontSize:13, opacity:.7, fontStyle:"italic" }}>No classes today</div>
              : todayCourses.map(c => (
                  <div key={c.id} style={{ display:"flex", gap:10, marginBottom:10, alignItems:"center" }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:PAL[c.color_tag]?.dot||"#fff", flexShrink:0 }}/>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700 }}>{c.course_code}</div>
                      <div style={{ fontSize:11, opacity:.75 }}>{c.schedule}{c.room&&` · ${c.room}`}</div>
                    </div>
                  </div>
                ))
            }
          </div>
          <div style={{ background:BRAND.white, borderRadius:16, border:`1px solid ${BRAND.line}`, padding:"20px", flex:1 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <h2 style={{ fontSize:13, fontWeight:800, color:BRAND.navy }}>📝 Recent Notes</h2>
              <Btn variant="ghost" size="sm" onClick={()=>onNav("notes")}><Ic n="cR" size={12}/></Btn>
            </div>
            {notes.length===0
              ? <div style={{ fontSize:12, color:BRAND.muted }}>No notes yet</div>
              : [...notes].sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at)).slice(0,5).map(note => {
                  const c = gc(note.course_id); const col = c ? PAL[c.color_tag] : PAL.Blue;
                  return (
                    <div key={note.id} style={{ padding:"8px 10px", borderRadius:9, marginBottom:6,
                      background:col.bg, border:`1px solid ${col.border}` }}>
                      <div style={{ fontSize:12, fontWeight:700, color:BRAND.navy,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{note.title}</div>
                      {c && <div style={{ fontSize:10, color:col.text, marginTop:1 }}>{c.course_code}</div>}
                    </div>
                  );
                })
            }
          </div>
        </div>
      </div>

      {courses.length > 0 && (
        <div style={{ marginTop:24 }}>
          <h2 style={{ fontSize:14, fontWeight:800, color:BRAND.navy, marginBottom:14 }}>📚 My Courses</h2>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
            {courses.map(c => {
              const col = PAL[c.color_tag]||PAL.Blue;
              return (
                <div key={c.id} className="hl" onClick={()=>onNav("courses")}
                  style={{ background:col.bg, border:`1px solid ${col.border}`, borderRadius:13, padding:"15px", cursor:"pointer" }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", background:col.accent, marginBottom:9 }}/>
                  <div style={{ fontSize:13, fontWeight:800, color:BRAND.navy }}>{c.course_code}</div>
                  <div style={{ fontSize:11, color:BRAND.muted, marginTop:3, lineHeight:1.45,
                    overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
                    {c.course_name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   COURSES PAGE
───────────────────────────────────────────────────────────────────────────── */
function CoursesPage({ courses, reload, onSelect, dbError }) {
  const [modal,  setModal]  = useState(null);
  const [form,   setForm]   = useState({});
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.course_code || !form.course_name) { setErr("Course code and name are required."); return; }
    setSaving(true); setErr("");
    try {
      const p = {
        course_code:      form.course_code,
        course_name:      form.course_name,
        instructor_name:  form.instructor_name  || null,
        instructor_email: form.instructor_email || null,
        room:             form.room             || null,
        schedule:         form.schedule         || null,
        color_tag:        form.color_tag        || "Blue",
      };
      if (modal === "add") await db.ins("courses", p);
      else                 await db.upd("courses", form.id, p);
      await reload();
      setModal(null);
    } catch(e) {
      // Show the real Supabase error message so user knows exactly what's wrong
      setErr(e.message);
    }
    setSaving(false);
  };

  const del = async c => {
    if (!window.confirm(`Delete "${c.course_code}"? All related data will also be deleted.`)) return;
    try {
      for (const t of ["notes","deadlines","quizzes","assessments","assignments"])
        await supabase.from(t).delete().eq("course_id", c.id);
      await db.del("courses", c.id);
      await reload();
    } catch(e) { window.alert(e.message); }
  };

  return (
    <div className="fi">
      <DbBanner error={dbError}/>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:26 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:BRAND.navy }}>My Courses</h1>
          <p style={{ fontSize:13, color:BRAND.muted, marginTop:3 }}>
            2025/2026 Second Semester · {courses.length}/8 courses added
          </p>
        </div>
        <Btn onClick={()=>{ setForm({color_tag:"Blue"}); setModal("add"); setErr(""); }} disabled={courses.length>=8}>
          <Ic n="plus" size={14}/> Add Course
        </Btn>
      </div>

      {courses.length===0 ? (
        <Empty icon="book" title="No courses yet"
          sub="Click '+ Add Course' to add your first course. You can add up to 8 courses."
          action="Add Course" onAction={()=>{ setForm({color_tag:"Blue"}); setModal("add"); }}/>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:18 }}>
          {courses.map(c => {
            const col = PAL[c.color_tag]||PAL.Blue;
            return (
              <div key={c.id} className="hl" style={{ background:BRAND.white, borderRadius:16,
                border:`1.5px solid ${col.border}`, overflow:"hidden" }}>
                <div style={{ height:5, background:col.accent }}/>
                <div style={{ padding:"18px 20px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ flex:1, cursor:"pointer" }} onClick={()=>onSelect(c)}>
                      <div style={{ marginBottom:9 }}>
                        <span style={{ fontSize:12, fontWeight:800, padding:"3px 12px", borderRadius:99,
                          background:col.soft, color:col.text, border:`1px solid ${col.border}` }}>
                          {c.course_code}
                        </span>
                      </div>
                      <div style={{ fontSize:15, fontWeight:800, color:BRAND.navy, lineHeight:1.4, marginBottom:10 }}>
                        {c.course_name}
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                        {c.instructor_name && <div style={{ fontSize:12, color:BRAND.muted }}>👤 {c.instructor_name}</div>}
                        {c.schedule        && <div style={{ fontSize:12, color:BRAND.muted }}>🕐 {c.schedule}</div>}
                        {c.room            && <div style={{ fontSize:12, color:BRAND.muted }}>📍 {c.room}</div>}
                        {!c.instructor_name&&!c.schedule&&!c.room && (
                          <div style={{ fontSize:12, color:"#A0AEC0", fontStyle:"italic" }}>Tap Edit to add details</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <Btn variant="secondary" size="sm" onClick={()=>{ setForm({...c}); setModal("edit"); setErr(""); }}><Ic n="edit" size={12}/></Btn>
                      <Btn variant="danger"    size="sm" onClick={()=>del(c)}><Ic n="trash" size={12}/></Btn>
                    </div>
                  </div>
                  <div style={{ marginTop:13, paddingTop:13, borderTop:`1px solid ${col.border}` }}>
                    <Btn variant="secondary" size="sm" onClick={()=>onSelect(c)}
                      style={{ width:"100%", justifyContent:"center", background:col.soft, color:col.text, border:`1px solid ${col.border}` }}>
                      View Details <Ic n="cR" size={12}/>
                    </Btn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal title={modal==="add"?"Add Course":"Edit Course"} onClose={()=>setModal(null)} wide>
          <ErrBox msg={err}/>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 18px" }}>
            <Inp label="Course Code"      value={form.course_code||""}      onChange={f("course_code")}     placeholder="e.g. EGS102" required/>
            <Inp label="Course Name"      value={form.course_name||""}      onChange={f("course_name")}     placeholder="Full course name" required/>
            <Inp label="Instructor Name"  value={form.instructor_name||""}  onChange={f("instructor_name")} placeholder="Dr. / Mr. / Ms."/>
            <Inp label="Instructor Email" value={form.instructor_email||""} onChange={f("instructor_email")} placeholder="lecturer@ucc.edu.gh" type="email"/>
            <Inp label="Room / Location"  value={form.room||""}             onChange={f("room")}            placeholder="e.g. Lecture Hall B"/>
            <Inp label="Schedule"         value={form.schedule||""}         onChange={f("schedule")}        placeholder="e.g. Mon & Wed 9–11am"/>
          </div>
          <ColorPicker value={form.color_tag||"Blue"} onChange={v=>setForm(p=>({...p,color_tag:v}))}/>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:4 }}>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn onClick={save} loading={saving}><Ic n="ok" size={14}/> Save Course</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   COURSE DETAIL
───────────────────────────────────────────────────────────────────────────── */
function CourseDetail({ course, notes, deadlines, quizzes, assessments, assignments, reloadAll, onBack }) {
  const [tab,    setTab]    = useState("notes");
  const [modal,  setModal]  = useState(null);
  const [form,   setForm]   = useState({});
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");
  const col = PAL[course.color_tag]||PAL.Blue;
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const cN = notes.filter(n=>n.course_id===course.id);
  const cD = deadlines.filter(d=>d.course_id===course.id);
  const cQ = quizzes.filter(q=>q.course_id===course.id);
  const cA = assessments.filter(a=>a.course_id===course.id);
  const cX = assignments.filter(a=>a.course_id===course.id);

  const TBL = { note:"notes", deadline:"deadlines", quiz:"quizzes", assessment:"assessments", assignment:"assignments" };
  const open  = (type, item) => { setModal({type,mode:item?"edit":"add",item}); setForm(item?{...item}:{}); setErr(""); };
  const close = () => setModal(null);

  const save = async () => {
    if (!form.title) { setErr("Title is required."); return; }
    setSaving(true); setErr("");
    try {
      let p = { ...form, course_id: course.id };
      delete p.id; delete p.created_at; delete p.updated_at; delete p.user_id;
      if (modal.mode==="add") await db.ins(TBL[modal.type], p);
      else                    await db.upd(TBL[modal.type], modal.item.id, p);
      await reloadAll(); close();
    } catch(e) { setErr(e.message); }
    setSaving(false);
  };

  const del = async (type, id) => {
    if (!window.confirm("Delete this item?")) return;
    try { await db.del(TBL[type], id); await reloadAll(); }
    catch(e) { window.alert(e.message); }
  };

  const Row = ({ item, type, meta }) => {
    const od = isOD(item.due_date||item.date_time);
    return (
      <div style={{ display:"flex", gap:12, padding:"12px 15px", borderRadius:11, marginBottom:9,
        background:od?BRAND.dangerBg:BRAND.bg, border:`1px solid ${od?"#F5C0BC":BRAND.line}`, alignItems:"center" }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:14, color:BRAND.navy, marginBottom:5,
            display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            {item.title}{od && <OD/>}
          </div>
          <div style={{ fontSize:11, color:BRAND.muted, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            {meta}
          </div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <Btn variant="secondary" size="sm" onClick={()=>open(type,item)}><Ic n="edit" size={12}/></Btn>
          <Btn variant="danger"    size="sm" onClick={()=>del(type,item.id)}><Ic n="trash" size={12}/></Btn>
        </div>
      </div>
    );
  };

  const TABS = [
    {k:"notes",       l:`📝 Notes (${cN.length})`},
    {k:"deadlines",   l:`⏰ Deadlines (${cD.length})`},
    {k:"quizzes",     l:`📋 Quizzes (${cQ.length})`},
    {k:"assessments", l:`🏆 Assessments (${cA.length})`},
    {k:"assignments", l:`📌 Assignments (${cX.length})`},
  ];

  return (
    <div className="fi">
      <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:6, background:"none",
        border:"none", cursor:"pointer", color:BRAND.muted, fontSize:13, fontWeight:600,
        marginBottom:18, padding:0 }}>
        <Ic n="cL" size={14}/> Back to Courses
      </button>

      <div style={{ background:BRAND.white, borderRadius:18, border:`1.5px solid ${col.border}`,
        overflow:"hidden", marginBottom:24 }}>
        <div style={{ height:6, background:`linear-gradient(90deg,${col.accent},${col.dot})` }}/>
        <div style={{ padding:"22px 26px" }}>
          <span style={{ fontSize:12, fontWeight:800, padding:"3px 14px", borderRadius:99,
            background:col.soft, color:col.text, border:`1px solid ${col.border}` }}>
            {course.course_code}
          </span>
          <h1 style={{ fontSize:20, fontWeight:800, color:BRAND.navy, marginTop:12, marginBottom:16,
            fontFamily:"'Lora',serif" }}>
            {course.course_name}
          </h1>
          <div style={{ display:"flex", gap:26, flexWrap:"wrap" }}>
            {[["👤 Instructor",course.instructor_name||"—"],["📍 Room",course.room||"—"],
              ["🕐 Schedule",course.schedule||"—"],["📧 Email",course.instructor_email||"—"]].map(([l,v])=>(
              <div key={l}>
                <div style={{ fontSize:10, color:"#A0AEC0", fontWeight:700, textTransform:"uppercase", letterSpacing:".05em" }}>{l}</div>
                <div style={{ fontSize:13, color:BRAND.slate, fontWeight:600, marginTop:2 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display:"flex", gap:4, borderBottom:`2px solid ${BRAND.line}`, marginBottom:22, overflowX:"auto" }}>
        {TABS.map(t => (
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{ padding:"10px 16px", border:"none", background:"none", cursor:"pointer", fontSize:13,
              fontWeight:tab===t.k?800:500, color:tab===t.k?BRAND.navy:BRAND.muted,
              borderBottom:`2px solid ${tab===t.k?col.accent:"transparent"}`,
              marginBottom:-2, whiteSpace:"nowrap", fontFamily:"inherit", transition:"all .15s" }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==="notes" && (
        <div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
            <Btn onClick={()=>open("note",null)}><Ic n="plus" size={14}/> Add Note</Btn>
          </div>
          {cN.length===0
            ? <Empty icon="note" title="No notes yet" sub="Add your first note" action="Add Note" onAction={()=>open("note",null)}/>
            : cN.map(note => (
                <div key={note.id} style={{ background:BRAND.white, borderRadius:13,
                  border:`1px solid ${BRAND.line}`, padding:"18px 22px", marginBottom:13 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                    <div>
                      <div style={{ fontWeight:800, fontSize:15, color:BRAND.navy, fontFamily:"'Lora',serif" }}>{note.title}</div>
                      <div style={{ fontSize:11, color:BRAND.muted, marginTop:3 }}>Updated {fmtDate(note.updated_at)}</div>
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <Btn variant="secondary" size="sm" onClick={()=>open("note",note)}><Ic n="edit" size={12}/> Edit</Btn>
                      <Btn variant="danger"    size="sm" onClick={()=>del("note",note.id)}><Ic n="trash" size={12}/></Btn>
                    </div>
                  </div>
                  {note.content
                    ? <div style={{ fontSize:14, color:BRAND.slate, lineHeight:1.75,
                          borderTop:`1px solid ${BRAND.line}`, paddingTop:13 }}
                          dangerouslySetInnerHTML={{ __html:note.content }}/>
                    : <div style={{ fontSize:13, color:BRAND.muted, fontStyle:"italic",
                          borderTop:`1px solid ${BRAND.line}`, paddingTop:13 }}>
                        No content yet — tap Edit to write your notes.
                      </div>
                  }
                </div>
              ))
          }
        </div>
      )}

      {tab==="deadlines" && (
        <div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
            <Btn onClick={()=>open("deadline",null)}><Ic n="plus" size={14}/> Add Deadline</Btn>
          </div>
          {cD.length===0
            ? <Empty icon="clock" title="No deadlines" sub="Track submission deadlines here" action="Add Deadline" onAction={()=>open("deadline",null)}/>
            : cD.map(d => <Row key={d.id} item={d} type="deadline"
                meta={<><span>📅 {fmtDT(d.due_date)}</span><PPill p={d.priority}/><SPill s={d.status}/>{d.reminder&&d.reminder!=="None"&&<Pill>{d.reminder}</Pill>}</>}/>)
          }
        </div>
      )}

      {tab==="quizzes" && (
        <div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
            <Btn onClick={()=>open("quiz",null)}><Ic n="plus" size={14}/> Add Quiz</Btn>
          </div>
          {cQ.length===0
            ? <Empty icon="doc" title="No quizzes" sub="Track upcoming quizzes" action="Add Quiz" onAction={()=>open("quiz",null)}/>
            : cQ.map(q => <Row key={q.id} item={{...q,due_date:q.date_time}} type="quiz"
                meta={<><span>📅 {fmtDT(q.date_time)}</span>{q.weight?<Pill>{q.weight}% weight</Pill>:null}{q.score!=null&&q.score!==""?<Pill color={BRAND.success} bg={BRAND.successBg}>Score: {q.score}%</Pill>:null}<SPill s={q.status}/></>}/>)
          }
        </div>
      )}

      {tab==="assessments" && (
        <div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
            <Btn onClick={()=>open("assessment",null)}><Ic n="plus" size={14}/> Add Assessment</Btn>
          </div>
          {cA.length===0
            ? <Empty icon="star" title="No assessments" sub="Track midterms, finals & projects" action="Add Assessment" onAction={()=>open("assessment",null)}/>
            : cA.map(a => <Row key={a.id} item={a} type="assessment"
                meta={<><Pill>{a.type}</Pill><span>📅 {fmtDT(a.due_date)}</span><Pill>{a.weight||0}%</Pill><Pill>{a.submission_type}</Pill><SPill s={a.status}/></>}/>)
          }
        </div>
      )}

      {tab==="assignments" && (
        <div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
            <Btn onClick={()=>open("assignment",null)}><Ic n="plus" size={14}/> Add Assignment</Btn>
          </div>
          {cX.length===0
            ? <Empty icon="doc" title="No assignments" sub="Track your assignments" action="Add Assignment" onAction={()=>open("assignment",null)}/>
            : cX.map(a => <Row key={a.id} item={a} type="assignment"
                meta={<><span>📅 {fmtDT(a.due_date)}</span><PPill p={a.priority}/><SPill s={a.status}/><Pill>{a.submission_type}</Pill>{a.points?<Pill>{a.points} pts</Pill>:null}</>}/>)
          }
        </div>
      )}

      {modal && (
        <Modal title={`${modal.mode==="add"?"Add":"Edit"} ${modal.type.charAt(0).toUpperCase()+modal.type.slice(1)}`}
          onClose={close} wide={modal.type==="note"}>
          <ErrBox msg={err}/>
          {modal.type==="note" && (
            <>
              <Inp label="Title" value={form.title||""} onChange={f("title")} placeholder="Note title / topic" required/>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, fontWeight:700, color:BRAND.slate, display:"block",
                  marginBottom:8, textTransform:"uppercase", letterSpacing:".06em" }}>Content</label>
                <RichEd value={form.content||""} onChange={v=>setForm(p=>({...p,content:v}))}/>
              </div>
            </>
          )}
          {modal.type==="deadline" && (
            <>
              <Inp label="Title" value={form.title||""} onChange={f("title")} placeholder="e.g. Submit Research Proposal" required/>
              <TA label="Description" value={form.description||""} onChange={f("description")} rows={2}/>
              <Inp label="Due Date & Time" type="datetime-local" value={toInpDT(form.due_date)} onChange={f("due_date")} required/>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <Sel label="Priority" value={form.priority||"Medium"} onChange={f("priority")} options={["High","Medium","Low"]}/>
                <Sel label="Status"   value={form.status||"Pending"}  onChange={f("status")}   options={["Pending","Done"]}/>
              </div>
              <Sel label="Reminder" value={form.reminder||"None"} onChange={f("reminder")} options={["None","1 day before","2 hours before"]}/>
            </>
          )}
          {modal.type==="quiz" && (
            <>
              <Inp label="Title" value={form.title||""} onChange={f("title")} placeholder="e.g. Mid-term Quiz 1" required/>
              <Inp label="Date & Time" type="datetime-local" value={toInpDT(form.date_time)} onChange={f("date_time")} required/>
              <TA label="Topics Covered" value={form.topics_covered||""} onChange={f("topics_covered")} rows={2}/>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
                <Inp label="Weight (%)" type="number" value={form.weight||""} onChange={f("weight")} min={0} max={100}/>
                <Inp label="Score (after)" type="number" value={form.score||""} onChange={f("score")} min={0} max={100}/>
                <Sel label="Status" value={form.status||"Upcoming"} onChange={f("status")} options={["Upcoming","Completed"]}/>
              </div>
            </>
          )}
          {modal.type==="assessment" && (
            <>
              <Inp label="Title" value={form.title||""} onChange={f("title")} placeholder="e.g. Final Capstone Project" required/>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <Sel label="Type" value={form.type||"Midterm"} onChange={f("type")} options={["Midterm","Final","Project"]}/>
                <Inp label="Weight (%)" type="number" value={form.weight||""} onChange={f("weight")} min={0} max={100} required/>
              </div>
              <Inp label="Due Date" type="datetime-local" value={toInpDT(form.due_date)} onChange={f("due_date")} required/>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <Sel label="Submission Type" value={form.submission_type||"Online"} onChange={f("submission_type")} options={["Online","In-person","File upload"]}/>
                <Sel label="Status" value={form.status||"Not Started"} onChange={f("status")} options={["Not Started","In Progress","Submitted","Graded"]}/>
              </div>
            </>
          )}
          {modal.type==="assignment" && (
            <>
              <Inp label="Title" value={form.title||""} onChange={f("title")} placeholder="e.g. Week 3 Problem Set" required/>
              <TA label="Description" value={form.description||""} onChange={f("description")} rows={2}/>
              <Inp label="Due Date & Time" type="datetime-local" value={toInpDT(form.due_date)} onChange={f("due_date")} required/>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
                <Sel label="Priority" value={form.priority||"Medium"} onChange={f("priority")} options={["High","Medium","Low"]}/>
                <Sel label="Status" value={form.status||"Not Started"} onChange={f("status")} options={["Not Started","In Progress","Submitted","Graded"]}/>
                <Inp label="Points" type="number" value={form.points||""} onChange={f("points")} min={0}/>
              </div>
              <Sel label="Submission Type" value={form.submission_type||"Text entry"} onChange={f("submission_type")} options={["Link","File upload","Text entry"]}/>
            </>
          )}
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
            <Btn variant="secondary" onClick={close}>Cancel</Btn>
            <Btn onClick={save} loading={saving}><Ic n="ok" size={14}/> Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   NOTES PAGE
───────────────────────────────────────────────────────────────────────────── */
function NotesPage({ notes, courses, reload }) {
  const [search, setSearch] = useState(""); const [cf, setCf] = useState("");
  const [modal,  setModal]  = useState(null); const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false); const [err, setErr] = useState("");
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const gc = id => courses.find(c => c.id===id);
  const filtered = notes.filter(n => {
    if (cf && n.course_id!==cf) return false;
    if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const save = async () => {
    if (!form.title||!form.course_id) { setErr("Title and course are required."); return; }
    setSaving(true); setErr("");
    try {
      const p = { title:form.title, course_id:form.course_id, content:form.content||"" };
      if (modal.mode==="add") await db.ins("notes", p);
      else                    await db.upd("notes", modal.item.id, p);
      await reload(); setModal(null);
    } catch(e) { setErr(e.message); }
    setSaving(false);
  };
  const del = async id => {
    if (!window.confirm("Delete this note?")) return;
    try { await db.del("notes", id); await reload(); } catch(e) { window.alert(e.message); }
  };
  return (
    <div className="fi">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:800, color:BRAND.navy }}>Notes</h1>
          <p style={{ fontSize:13, color:BRAND.muted, marginTop:3 }}>All lecture notes across your courses</p>
        </div>
        <Btn onClick={()=>{ setModal({mode:"add"}); setForm({course_id:cf||""}); setErr(""); }}>
          <Ic n="plus" size={14}/> New Note
        </Btn>
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:200 }}>
          <Ic n="srch" size={15} style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:BRAND.muted, pointerEvents:"none" }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notes..."
            style={{ width:"100%", padding:"10px 13px 10px 36px", borderRadius:9,
              border:`1.5px solid ${BRAND.line}`, fontSize:13, background:BRAND.white,
              outline:"none", boxSizing:"border-box", color:BRAND.navy }}/>
        </div>
        <select value={cf} onChange={e=>setCf(e.target.value)}
          style={{ padding:"10px 14px", borderRadius:9, border:`1.5px solid ${BRAND.line}`,
            fontSize:13, background:BRAND.white, outline:"none", minWidth:180, color:BRAND.navy }}>
          <option value="">All Courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.course_code}</option>)}
        </select>
      </div>
      {filtered.length===0
        ? <Empty icon="note" title="No notes found" sub={search?"Try a different term":"Add your first note"} action="New Note" onAction={()=>{ setModal({mode:"add"}); setForm({}); }}/>
        : <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:15 }}>
            {filtered.map(note => {
              const c = gc(note.course_id); const col = c ? PAL[c.color_tag] : PAL.Blue;
              return (
                <div key={note.id} style={{ background:BRAND.white, borderRadius:14,
                  border:`1px solid ${BRAND.line}`, padding:"18px", position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:0, left:0, bottom:0, width:4, background:col.accent }}/>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:800, fontSize:14, color:BRAND.navy, marginBottom:6, fontFamily:"'Lora',serif" }}>{note.title}</div>
                      {c && <CPill course={c}/>}
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <Btn variant="secondary" size="sm" onClick={()=>{ setModal({mode:"edit",item:note}); setForm({...note}); setErr(""); }}><Ic n="edit" size={12}/></Btn>
                      <Btn variant="danger"    size="sm" onClick={()=>del(note.id)}><Ic n="trash" size={12}/></Btn>
                    </div>
                  </div>
                  {note.content
                    ? <div style={{ fontSize:12, color:BRAND.slate, lineHeight:1.65, maxHeight:80, overflow:"hidden" }} dangerouslySetInnerHTML={{ __html:note.content }}/>
                    : <div style={{ fontSize:12, color:BRAND.muted, fontStyle:"italic" }}>No content yet</div>
                  }
                  <div style={{ fontSize:10, color:BRAND.muted, marginTop:10 }}>Updated {fmtDate(note.updated_at)}</div>
                </div>
              );
            })}
          </div>
      }
      {modal && (
        <Modal title={modal.mode==="add"?"New Note":"Edit Note"} onClose={()=>setModal(null)} wide>
          <ErrBox msg={err}/>
          <Inp label="Title" value={form.title||""} onChange={f("title")} placeholder="Note title / topic" required/>
          <Sel label="Course" value={form.course_id||""} onChange={f("course_id")}
            options={[{v:"",l:"— Select Course —"},...courses.map(c=>({v:c.id,l:`${c.course_code} — ${c.course_name.slice(0,40)}`}))]} required/>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, fontWeight:700, color:BRAND.slate, display:"block",
              marginBottom:8, textTransform:"uppercase", letterSpacing:".06em" }}>Content</label>
            <RichEd value={form.content||""} onChange={v=>setForm(p=>({...p,content:v}))}/>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:4 }}>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn onClick={save} loading={saving}><Ic n="ok" size={14}/> Save Note</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CALENDAR PAGE
───────────────────────────────────────────────────────────────────────────── */
function CalendarPage({ courses, deadlines, quizzes, assessments, assignments, reloadAll }) {
  const [date,setDate]=useState(new Date()); const [sel,setSel]=useState(null);
  const [modal,setModal]=useState(null); const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false); const [err,setErr]=useState("");
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const yr=date.getFullYear(), mo=date.getMonth();
  const first=new Date(yr,mo,1).getDay(), dim=new Date(yr,mo+1,0).getDate();
  const MN=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const TC={deadline:"#C0392B",quiz:"#5B2D9E",assessment:"#1A6DBF",assignment:"#B7620A"};
  const allEvts=[...deadlines.map(d=>({...d,_t:"deadline",_d:d.due_date})),...quizzes.map(q=>({...q,_t:"quiz",_d:q.date_time})),...assessments.map(a=>({...a,_t:"assessment",_d:a.due_date})),...assignments.map(a=>({...a,_t:"assignment",_d:a.due_date}))];
  const dayEvts=day=>{const dt=new Date(yr,mo,day);return allEvts.filter(e=>{const ed=new Date(e._d);return ed.getFullYear()===dt.getFullYear()&&ed.getMonth()===dt.getMonth()&&ed.getDate()===dt.getDate();});};
  const gc=id=>courses.find(c=>c.id===id);
  const TBL={deadline:"deadlines",quiz:"quizzes",assessment:"assessments",assignment:"assignments"};
  const openAdd=()=>{const pre=sel?new Date(yr,mo,sel).toISOString().slice(0,16):"";setForm({_t:"deadline",course_id:"",due_date:pre,priority:"Medium",status:"Pending"});setModal({mode:"add"});setErr("");};
  const openEdit=ev=>{setModal({mode:"edit",ev});setForm({...ev,due_date:ev.due_date||ev.date_time});setErr("");};
  const saveEvt=async()=>{
    if(!form.title||!form.due_date){setErr("Title and date required.");return;}
    setSaving(true);setErr("");const tbl=TBL[form._t];
    try{
      let p={title:form.title,course_id:form.course_id||null};
      if(form._t==="deadline")p={...p,due_date:form.due_date,priority:form.priority||"Medium",status:form.status||"Pending"};
      if(form._t==="quiz")p={...p,date_time:form.due_date,status:form.status||"Upcoming",weight:Number(form.weight)||0};
      if(form._t==="assessment")p={...p,due_date:form.due_date,type:form.atype||"Midterm",weight:Number(form.weight)||0,submission_type:"Online",status:form.status||"Not Started"};
      if(form._t==="assignment")p={...p,due_date:form.due_date,priority:form.priority||"Medium",status:form.status||"Not Started",submission_type:"Text entry"};
      if(modal.mode==="add")await db.ins(tbl,p);else await db.upd(tbl,modal.ev.id,p);
      await reloadAll();setModal(null);
    }catch(e){setErr(e.message);}
    setSaving(false);
  };
  const delEvt=async ev=>{if(!window.confirm("Delete?"))return;try{await db.del(TBL[ev._t],ev.id);await reloadAll();}catch(e){window.alert(e.message);}};
  const selEvts=sel?dayEvts(sel):[];
  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div><h1 style={{fontSize:24,fontWeight:800,color:BRAND.navy}}>Calendar</h1><p style={{fontSize:13,color:BRAND.muted,marginTop:3}}>Tap a day to view or add events</p></div>
        <Btn onClick={openAdd}><Ic n="plus" size={14}/> Add Event</Btn>
      </div>
      <div style={{display:"flex",gap:16,marginBottom:14,flexWrap:"wrap"}}>
        {Object.entries(TC).map(([t,c])=>(
          <div key={t} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:BRAND.slate,fontWeight:500}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:c}}/>{t.charAt(0).toUpperCase()+t.slice(1)}
          </div>
        ))}
      </div>
      <div style={{background:BRAND.white,borderRadius:18,border:`1px solid ${BRAND.line}`,overflow:"hidden",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 22px",background:`linear-gradient(90deg,${BRAND.navy},${BRAND.navyMid})`}}>
          <Btn variant="ghost" size="sm" onClick={()=>setDate(new Date(yr,mo-1,1))} style={{color:"#fff"}}><Ic n="cL" size={14}/></Btn>
          <span style={{fontSize:17,fontWeight:800,color:"#fff",fontFamily:"'Lora',serif"}}>{MN[mo]} {yr}</span>
          <Btn variant="ghost" size="sm" onClick={()=>setDate(new Date(yr,mo+1,1))} style={{color:"#fff"}}><Ic n="cR" size={14}/></Btn>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:BRAND.navyLt,borderBottom:`1px solid ${BRAND.line}`}}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>(
            <div key={d} style={{textAlign:"center",padding:"8px",fontSize:11,fontWeight:800,color:BRAND.navy,letterSpacing:".05em"}}>{d}</div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {Array(first).fill(null).map((_,i)=><div key={`e${i}`} style={{minHeight:88,borderRight:`1px solid ${BRAND.bg}`,borderBottom:`1px solid ${BRAND.bg}`}}/>)}
          {Array(dim).fill(null).map((_,i)=>{
            const day=i+1, evts=dayEvts(day);
            const isToday=NOW().getDate()===day&&NOW().getMonth()===mo&&NOW().getFullYear()===yr;
            const isSel=sel===day;
            return(
              <div key={day} onClick={()=>setSel(isSel?null:day)}
                style={{minHeight:88,padding:"6px 7px",borderRight:`1px solid ${BRAND.bg}`,borderBottom:`1px solid ${BRAND.bg}`,background:isSel?BRAND.navyLt:isToday?"#F0F7FF":BRAND.white,cursor:"pointer",transition:"background .15s"}}>
                <div style={{fontSize:13,fontWeight:isToday?800:500,width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:isToday?BRAND.navy:"transparent",color:isToday?"#fff":BRAND.slate,marginBottom:4}}>{day}</div>
                {evts.slice(0,3).map(ev=>(
                  <div key={ev.id} style={{fontSize:10,fontWeight:600,padding:"2px 5px",borderRadius:5,background:TC[ev._t]+"20",color:TC[ev._t],marginBottom:2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",border:`1px solid ${TC[ev._t]}40`}}>{ev.title}</div>
                ))}
                {evts.length>3&&<div style={{fontSize:10,color:BRAND.muted}}>+{evts.length-3}</div>}
              </div>
            );
          })}
        </div>
      </div>
      {sel&&(
        <div style={{background:BRAND.white,borderRadius:16,border:`1px solid ${BRAND.line}`,padding:"20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <h2 style={{fontSize:15,fontWeight:800,color:BRAND.navy}}>{MN[mo]} {sel}, {yr}</h2>
            <Btn onClick={openAdd} size="sm"><Ic n="plus" size={12}/> Add</Btn>
          </div>
          {selEvts.length===0?<Empty icon="cal" title="No events" sub="Tap '+ Add' to schedule something"/>:
            selEvts.map(ev=>{const c=gc(ev.course_id);const col=c?PAL[c.color_tag]:PAL.Blue;return(
              <div key={ev.id} style={{display:"flex",gap:10,padding:"12px 15px",borderRadius:11,marginBottom:9,background:col.bg,border:`1px solid ${col.border}`,alignItems:"center"}}>
                <div style={{width:4,alignSelf:"stretch",borderRadius:2,background:TC[ev._t],flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:BRAND.navy}}>{ev.title}</div>
                  <div style={{fontSize:11,color:BRAND.muted,display:"flex",gap:8,marginTop:3}}>
                    {c&&<CPill course={c}/>}<span style={{color:TC[ev._t],fontWeight:600}}>{ev._t}</span><span>· {fmtTime(ev._d)}</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <Btn variant="secondary" size="sm" onClick={()=>openEdit(ev)}><Ic n="edit" size={12}/></Btn>
                  <Btn variant="danger"    size="sm" onClick={()=>delEvt(ev)}><Ic n="trash" size={12}/></Btn>
                </div>
              </div>
            );}
          )}
        </div>
      )}
      {modal&&(
        <Modal title={`${modal.mode==="add"?"Add":"Edit"} Event`} onClose={()=>setModal(null)}>
          <ErrBox msg={err}/>
          <Sel label="Type" value={form._t||"deadline"} onChange={f("_t")} options={[{v:"deadline",l:"Deadline"},{v:"quiz",l:"Quiz"},{v:"assessment",l:"Assessment"},{v:"assignment",l:"Assignment"}]}/>
          <Inp label="Title" value={form.title||""} onChange={f("title")} placeholder="Event title" required/>
          <Sel label="Course" value={form.course_id||""} onChange={f("course_id")} options={[{v:"",l:"— Select Course —"},...courses.map(c=>({v:c.id,l:`${c.course_code} – ${c.course_name.slice(0,30)}`}))]}/>
          <Inp label="Date & Time" type="datetime-local" value={toInpDT(form.due_date)} onChange={f("due_date")} required/>
          {(form._t==="deadline"||form._t==="assignment")&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <Sel label="Priority" value={form.priority||"Medium"} onChange={f("priority")} options={["High","Medium","Low"]}/>
              <Sel label="Status" value={form.status||"Pending"} onChange={f("status")} options={form._t==="deadline"?["Pending","Done"]:["Not Started","In Progress","Submitted","Graded"]}/>
            </div>
          )}
          {(form._t==="quiz"||form._t==="assessment")&&<Inp label="Weight (%)" type="number" value={form.weight||""} onChange={f("weight")} min={0} max={100}/>}
          {form._t==="assessment"&&<Sel label="Assessment Type" value={form.atype||"Midterm"} onChange={f("atype")} options={["Midterm","Final","Project"]}/>}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn onClick={saveEvt} loading={saving}><Ic n="ok" size={14}/> Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TIMETABLE PAGE
───────────────────────────────────────────────────────────────────────────── */
function TimetablePage({ courses, slots, reloadSlots }) {
  const [modal,setModal]=useState(null); const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false); const [err,setErr]=useState("");
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const gc=id=>courses.find(c=>c.id===id);
  const slotAt=(day,time)=>slots.find(s=>s.day===day&&s.start_time===time);
  const openCell=(day,time)=>{
    const ex=slotAt(day,time);
    if(ex){setForm({...ex});setModal({mode:"edit",day,time});}
    else{setForm({day,start_time:time,end_time:"",course_id:"",label:"",color_tag:"Blue"});setModal({mode:"add",day,time});}
    setErr("");
  };
  const save=async()=>{
    setSaving(true);setErr("");
    try{
      const p={day:form.day,start_time:form.start_time,end_time:form.end_time||form.start_time,course_id:form.course_id||null,label:form.label||null,color_tag:form.color_tag||"Blue"};
      if(modal.mode==="add")await db.ins("timetable_slots",p);
      else await db.upd("timetable_slots",form.id,p);
      await reloadSlots();setModal(null);
    }catch(e){setErr(e.message);}
    setSaving(false);
  };
  const del=async()=>{
    if(!form.id)return;
    if(!window.confirm("Remove this slot?"))return;
    try{await db.del("timetable_slots",form.id);await reloadSlots();setModal(null);}catch(e){window.alert(e.message);}
  };
  return(
    <div className="fi">
      <div style={{marginBottom:22}}>
        <h1 style={{fontSize:24,fontWeight:800,color:BRAND.navy}}>Timetable</h1>
        <p style={{fontSize:13,color:BRAND.muted,marginTop:3}}>06:30 – 21:30 · Tap any cell to add or edit a class</p>
      </div>
      <div style={{background:BRAND.white,borderRadius:18,border:`1px solid ${BRAND.line}`,overflow:"auto"}}>
        <table style={{borderCollapse:"collapse",width:"100%",minWidth:64+120*7}}>
          <thead>
            <tr>
              <th style={{width:64,background:BRAND.navy,color:"#fff",fontSize:11,fontWeight:700,padding:"14px 10px",textAlign:"center",borderRight:"1px solid rgba(255,255,255,.12)",position:"sticky",left:0,zIndex:2}}>Time</th>
              {TT_DAYS.map(day=>(
                <th key={day} style={{width:120,background:BRAND.navy,color:"#fff",fontSize:11,fontWeight:700,padding:"14px 8px",textAlign:"center",borderRight:"1px solid rgba(255,255,255,.10)"}}>{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TT_SLOTS.map(time=>{
              const isHour=time.endsWith(":00");
              return(
                <tr key={time}>
                  <td style={{width:64,fontSize:isHour?12:10,fontWeight:isHour?700:400,color:isHour?BRAND.navy:BRAND.muted,padding:"0 10px",textAlign:"right",borderRight:`1px solid ${BRAND.line}`,borderBottom:`1px solid ${BRAND.bg}`,height:44,verticalAlign:"middle",background:isHour?BRAND.navyLt:BRAND.white,position:"sticky",left:0,zIndex:1}}>
                    {time}
                  </td>
                  {TT_DAYS.map(day=>{
                    const slot=slotAt(day,time);
                    const col=slot?(PAL[slot.color_tag]||PAL.Blue):{};
                    const course=slot&&slot.course_id?gc(slot.course_id):null;
                    return(
                      <td key={day} onClick={()=>openCell(day,time)}
                        style={{width:120,height:44,padding:"3px 5px",borderRight:`1px solid ${BRAND.bg}`,borderBottom:`1px solid ${BRAND.bg}`,verticalAlign:"top",cursor:"pointer",transition:"background .12s"}}
                        onMouseEnter={e=>{if(!slot)e.currentTarget.style.background=BRAND.navyLt;}}
                        onMouseLeave={e=>{if(!slot)e.currentTarget.style.background="";}}>
                        {slot&&(
                          <div style={{background:col.soft,border:`1px solid ${col.border}`,borderRadius:7,padding:"3px 7px",height:"100%",boxSizing:"border-box",overflow:"hidden"}}>
                            <div style={{fontSize:11,fontWeight:800,color:col.text,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
                              {course?course.course_code:slot.label||"Class"}
                            </div>
                            {(slot.label&&course)&&<div style={{fontSize:9,color:col.text,opacity:.7,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{slot.label}</div>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {modal&&(
        <Modal title={`${modal.mode==="add"?"Add":"Edit"} Slot — ${modal.day} ${modal.time}`} onClose={()=>setModal(null)}>
          <ErrBox msg={err}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Inp label="Start Time" value={form.start_time||""} onChange={f("start_time")} placeholder="08:30"/>
            <Inp label="End Time"   value={form.end_time||""}   onChange={f("end_time")}   placeholder="10:00"/>
          </div>
          <Sel label="Course (optional)" value={form.course_id||""} onChange={f("course_id")}
            options={[{v:"",l:"— Free slot / custom label —"},...courses.map(c=>({v:c.id,l:`${c.course_code} — ${c.course_name.slice(0,35)}`}))]}/>
          <Inp label="Label (optional)" value={form.label||""} onChange={f("label")} placeholder="e.g. Lab, Tutorial…"/>
          <ColorPicker value={form.color_tag||"Blue"} onChange={v=>setForm(p=>({...p,color_tag:v}))}/>
          <div style={{display:"flex",gap:10,justifyContent:"space-between",marginTop:8}}>
            <div>{modal.mode==="edit"&&<Btn variant="danger" onClick={del}>Remove</Btn>}</div>
            <div style={{display:"flex",gap:10}}>
              <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
              <Btn onClick={save} loading={saving}><Ic n="ok" size={14}/> Save Slot</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROFILE PAGE
───────────────────────────────────────────────────────────────────────────── */
function ProfilePage({ session, onSignOut }) {
  const meta = session?.user?.user_metadata || {};
  const [form, setForm] = useState({
    first_name: meta.first_name || "",
    last_name:  meta.last_name  || "",
    student_id: meta.student_id || "",
    programme:  meta.programme  || "",
    level:      meta.level      || "",
    email:      session?.user?.email || "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    setSaving(true); setMsg("");
    const { error } = await supabase.auth.updateUser({
      data: {
        first_name: form.first_name,
        last_name:  form.last_name,
        student_id: form.student_id,
        programme:  form.programme,
        level:      form.level,
      }
    });
    setSaving(false);
    setMsg(error ? `Error: ${error.message}` : "✓ Profile saved!");
    setTimeout(() => setMsg(""), 3000);
  };

  const initials = `${(form.first_name?.[0]||"?").toUpperCase()}${(form.last_name?.[0]||"").toUpperCase()}`;

  return (
    <div className="fi">
      <h1 style={{ fontSize:24, fontWeight:800, color:BRAND.navy, marginBottom:4 }}>Profile & Settings</h1>
      <p style={{ fontSize:13, color:BRAND.muted, marginBottom:26 }}>University of Cape Coast</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:24 }}>
        <div style={{ background:BRAND.white, borderRadius:18, border:`1px solid ${BRAND.line}`,
          padding:"32px 24px", textAlign:"center" }}>
          <div style={{ width:84, height:84, borderRadius:"50%",
            background:`linear-gradient(135deg,${BRAND.navy},${BRAND.navyMid})`,
            display:"flex", alignItems:"center", justifyContent:"center",
            color:"#fff", fontWeight:800, fontSize:30, margin:"0 auto 16px",
            fontFamily:"'Lora',serif", boxShadow:"0 6px 20px rgba(15,45,82,.30)" }}>
            {initials}
          </div>
          <div style={{ fontWeight:800, fontSize:17, color:BRAND.navy, fontFamily:"'Lora',serif" }}>
            {form.first_name} {form.last_name}
          </div>
          {form.student_id && <div style={{ fontSize:12, color:BRAND.muted, marginTop:5 }}>{form.student_id}</div>}
          {form.programme   && <div style={{ fontSize:11, color:BRAND.muted, marginTop:3, lineHeight:1.5 }}>{form.programme}</div>}
          {form.level       && <div style={{ marginTop:10 }}><Pill color={BRAND.navy} bg={BRAND.navyLt}>Level {form.level}</Pill></div>}
          <div style={{ fontSize:12, color:BRAND.muted, marginTop:6 }}>{form.email}</div>
          <div style={{ marginTop:22 }}>
            <Btn variant="danger" onClick={onSignOut} style={{ width:"100%", justifyContent:"center" }}>
              <Ic n="out" size={14}/> Sign Out
            </Btn>
          </div>
        </div>
        <div style={{ background:BRAND.white, borderRadius:18, border:`1px solid ${BRAND.line}`, padding:"28px" }}>
          <h2 style={{ fontSize:16, fontWeight:800, color:BRAND.navy, marginBottom:22 }}>Edit Profile</h2>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 20px" }}>
            <Inp label="First Name"   value={form.first_name} onChange={f("first_name")} placeholder="Ama"/>
            <Inp label="Last Name"    value={form.last_name}  onChange={f("last_name")}  placeholder="Mensah"/>
            <Inp label="Student ID"   value={form.student_id} onChange={f("student_id")} placeholder="e.g. EH/GOV/25/0014"/>
            <Inp label="Level / Year" value={form.level}      onChange={f("level")}       placeholder="e.g. 100"/>
          </div>
          <Inp label="Programme" value={form.programme} onChange={f("programme")} placeholder="e.g. Bachelor of Education (Government)"/>
          <Inp label="Email (read-only)" value={form.email} onChange={()=>{}} style={{ background:BRAND.bg, color:BRAND.muted }}/>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:12, alignItems:"center", marginTop:6 }}>
            {msg && <span style={{ fontSize:13, color:msg.startsWith("✓")?BRAND.success:BRAND.danger, fontWeight:600 }}>{msg}</span>}
            <Btn onClick={save} loading={saving}><Ic n="ok" size={14}/> Save Changes</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────────────────────────────────────────── */
function Sidebar({ active, onNav, courses, onSelect, collapsed, setCollapsed }) {
  const NAV = [
    {k:"dashboard", i:"home", l:"Dashboard"},
    {k:"courses",   i:"book", l:"Courses"},
    {k:"notes",     i:"note", l:"Notes"},
    {k:"calendar",  i:"cal",  l:"Calendar"},
    {k:"timetable", i:"tbl",  l:"Timetable"},
    {k:"profile",   i:"user", l:"Profile"},
  ];
  return (
    <div style={{ width:collapsed?64:248, minWidth:collapsed?64:248, height:"100vh",
      background:BRAND.white, borderRight:`1px solid ${BRAND.line}`,
      display:"flex", flexDirection:"column", position:"sticky", top:0,
      transition:"width .25s,min-width .25s", overflow:"hidden", zIndex:10 }}>
      <div style={{ padding:collapsed?"18px 0":"22px 20px 18px",
        borderBottom:`1px solid ${BRAND.line}`,
        display:"flex", alignItems:"center", justifyContent:collapsed?"center":"flex-start" }}>
        {collapsed
          ? <div style={{ width:34, height:34, borderRadius:10, background:BRAND.navy,
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ color:"#fff", fontWeight:800, fontSize:15, fontFamily:"'Lora',serif" }}>S</span>
            </div>
          : <div>
              <div style={{ fontSize:19, fontWeight:800, color:BRAND.navy,
                fontFamily:"'Lora',serif", letterSpacing:"-.4px" }}>StudyDesk</div>
              <div style={{ fontSize:10, color:BRAND.muted, fontWeight:600, marginTop:2, letterSpacing:".04em" }}>
                UCC · 2025/2026
              </div>
            </div>
        }
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"14px 8px" }}>
        {!collapsed && (
          <div style={{ fontSize:10, fontWeight:700, color:"#B0BFCF", textTransform:"uppercase",
            letterSpacing:".08em", padding:"6px 10px 8px" }}>Menu</div>
        )}
        {NAV.map(({ k, i, l }) => {
          const isA = active===k || (k==="courses"&&active==="course-detail");
          return (
            <button key={k} onClick={()=>onNav(k)}
              style={{ display:"flex", alignItems:"center", gap:10, width:"100%",
                padding:collapsed?"11px 0":"10px 12px",
                justifyContent:collapsed?"center":"flex-start",
                borderRadius:10, border:"none", cursor:"pointer",
                background:isA?BRAND.navyLt:"transparent",
                color:isA?BRAND.navy:BRAND.muted,
                fontWeight:isA?700:500, fontSize:13, marginBottom:3,
                fontFamily:"inherit", transition:"all .15s" }}>
              <Ic n={i} size={17}/>{!collapsed && <span>{l}</span>}
            </button>
          );
        })}
        {!collapsed && courses.length>0 && (
          <>
            <div style={{ fontSize:10, fontWeight:700, color:"#B0BFCF", textTransform:"uppercase",
              letterSpacing:".08em", padding:"16px 10px 8px" }}>My Courses</div>
            {courses.map(c => {
              const col = PAL[c.color_tag]||PAL.Blue;
              return (
                <button key={c.id} onClick={()=>onSelect(c)}
                  style={{ display:"flex", alignItems:"center", gap:9, width:"100%",
                    padding:"7px 10px", borderRadius:9, border:"none", cursor:"pointer",
                    background:"transparent", color:BRAND.muted, fontSize:12, fontWeight:500,
                    marginBottom:2, fontFamily:"inherit", textAlign:"left" }}
                  onMouseEnter={e=>e.currentTarget.style.background=BRAND.bg}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:col.accent, flexShrink:0 }}/>
                  <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.course_code}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
      <div style={{ padding:"10px 8px", borderTop:`1px solid ${BRAND.line}` }}>
        <button onClick={()=>setCollapsed(p=>!p)}
          style={{ display:"flex", alignItems:"center", gap:8, width:"100%",
            padding:"8px 10px", justifyContent:collapsed?"center":"flex-start",
            borderRadius:9, border:"none", cursor:"pointer",
            background:"transparent", color:BRAND.muted, fontSize:12, fontFamily:"inherit" }}>
          <Ic n={collapsed?"cR":"cL"} size={14}/>{!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ROOT EXPORT
───────────────────────────────────────────────────────────────────────────── */
export default function StudyDesk({ session, onSignOut }) {
  const [view,       setView]       = useState("dashboard");
  const [selCourse,  setSelCourse]  = useState(null);
  const [collapsed,  setCollapsed]  = useState(false);

  const { rows:courses,     loading:lC, reload:rC, dbError:errC } = useTable("courses");
  const { rows:notes,       loading:lN, reload:rN                } = useTable("notes","updated_at");
  const { rows:deadlines,   loading:lD, reload:rD                } = useTable("deadlines");
  const { rows:quizzes,     loading:lQ, reload:rQ                } = useTable("quizzes","date_time");
  const { rows:assessments, loading:lA, reload:rA                } = useTable("assessments");
  const { rows:assignments, loading:lX, reload:rX                } = useTable("assignments");
  const { rows:slots,       loading:lS, reload:rS                } = useTable("timetable_slots","start_time");

  const loading = lC||lN||lD||lQ||lA||lX||lS;

  const reloadAll = useCallback(async () => {
    await Promise.all([rC(), rN(), rD(), rQ(), rA(), rX(), rS()]);
  }, []);

  const nav          = v => { setView(v); if(v!=="course-detail") setSelCourse(null); };
  const selectCourse = c => { setSelCourse(c); setView("course-detail"); };

  const renderMain = () => {
    if (loading) return <Skeleton/>;
    switch (view) {
      case "dashboard":
        return <Dashboard courses={courses} deadlines={deadlines} quizzes={quizzes}
          assessments={assessments} assignments={assignments} notes={notes}
          user={session?.user} onNav={nav} dbError={errC}/>;
      case "courses":
        return <CoursesPage courses={courses} reload={rC} onSelect={selectCourse} dbError={errC}/>;
      case "course-detail":
        if (!selCourse) { nav("courses"); return null; }
        const fresh = courses.find(c=>c.id===selCourse.id) || selCourse;
        return <CourseDetail course={fresh} notes={notes} deadlines={deadlines}
          quizzes={quizzes} assessments={assessments} assignments={assignments}
          reloadAll={reloadAll} onBack={()=>nav("courses")}/>;
      case "notes":
        return <NotesPage notes={notes} courses={courses} reload={rN}/>;
      case "calendar":
        return <CalendarPage courses={courses} deadlines={deadlines} quizzes={quizzes}
          assessments={assessments} assignments={assignments} reloadAll={reloadAll}/>;
      case "timetable":
        return <TimetablePage courses={courses} slots={slots} reloadSlots={rS}/>;
      case "profile":
        return <ProfilePage session={session} onSignOut={onSignOut}/>;
      default: return null;
    }
  };

  return (
    <>
      <style>{G}</style>
      <div style={{ display:"flex", height:"100vh", overflow:"hidden" }}>
        <Sidebar active={view} onNav={nav} courses={courses} onSelect={selectCourse}
          collapsed={collapsed} setCollapsed={setCollapsed}/>
        <main style={{ flex:1, overflowY:"auto", padding:"28px 32px 48px", background:BRAND.bg }}>
          {renderMain()}
        </main>
      </div>
    </>
  );
}
