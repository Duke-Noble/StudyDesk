// src/StudyDesk.jsx
/* eslint-disable no-restricted-globals, react-hooks/exhaustive-deps, no-undef */
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient";

/* ─── GLOBAL CSS ─────────────────────────────────────────────────────────── */
const G = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lora:ital,wght@0,600;1,400&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html, body, #root { height:100%; }
  body { font-family:'Inter',sans-serif; background:#0A0F1E; color:#E2E8F0; }
  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:#2D3748;border-radius:99px;}
  input,select,textarea,button{font-family:inherit;}
  [contenteditable]:empty:before{content:attr(data-placeholder);color:#4A5568;pointer-events:none;}
  .fi{animation:fi .26s ease;}
  @keyframes fi{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
  .hl{transition:all .2s;}
  .hl:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(0,0,0,.4);}
  .clk{cursor:pointer;transition:all .18s;}
  .clk:hover{filter:brightness(1.1);}
  @keyframes spin{to{transform:rotate(360deg)}}
  .sp{animation:spin .75s linear infinite;}
  @keyframes shim{0%{background-position:100% 0}100%{background-position:-100% 0}}
  @keyframes slideIn{from{transform:translateX(-100%);opacity:0}to{transform:translateX(0);opacity:1}}
  @keyframes fadeOverlay{from{opacity:0}to{opacity:1}}
`;

/* ─── DARK PREMIUM PALETTE ───────────────────────────────────────────────── */
const B = {
  /* backgrounds */
  bg:      "#0A0F1E",
  surface: "#111827",
  card:    "#1A2235",
  cardHov: "#1E2A40",
  border:  "#1F2D45",
  borderLt:"#243350",
  /* text */
  text:    "#E2E8F0",
  textMd:  "#94A3B8",
  textSm:  "#64748B",
  /* brand */
  gold:    "#F59E0B",
  goldLt:  "#FDE68A",
  goldDim: "#78350F",
  blue:    "#3B82F6",
  blueLt:  "#93C5FD",
  blueDim: "#1E3A5F",
  purple:  "#8B5CF6",
  purpleLt:"#C4B5FD",
  purpleDim:"#3B1A6E",
  green:   "#10B981",
  greenLt: "#6EE7B7",
  greenDim:"#064E3B",
  red:     "#EF4444",
  redLt:   "#FCA5A5",
  redDim:  "#450A0A",
  /* glass */
  glass:   "rgba(255,255,255,0.04)",
  glassB:  "rgba(255,255,255,0.08)",
};

const PAL = {
  Blue:  {bg:"rgba(59,130,246,.12)",border:"rgba(59,130,246,.3)",accent:"#3B82F6",text:"#93C5FD",dot:"#60A5FA",soft:"rgba(59,130,246,.15)"},
  Green: {bg:"rgba(16,185,129,.12)",border:"rgba(16,185,129,.3)",accent:"#10B981",text:"#6EE7B7",dot:"#34D399",soft:"rgba(16,185,129,.15)"},
  Purple:{bg:"rgba(139,92,246,.12)",border:"rgba(139,92,246,.3)",accent:"#8B5CF6",text:"#C4B5FD",dot:"#A78BFA",soft:"rgba(139,92,246,.15)"},
  Teal:  {bg:"rgba(20,184,166,.12)",border:"rgba(20,184,166,.3)",accent:"#14B8A6",text:"#5EEAD4",dot:"#2DD4BF",soft:"rgba(20,184,166,.15)"},
  Gold:  {bg:"rgba(245,158,11,.12)", border:"rgba(245,158,11,.3)", accent:"#F59E0B",text:"#FDE68A",dot:"#FCD34D",soft:"rgba(245,158,11,.15)"},
};
const COLORS = ["Blue","Green","Purple","Teal","Gold"];

const PRIO_C = {
  High:  {c:"#EF4444",b:"rgba(239,68,68,.15)"},
  Medium:{c:"#F59E0B",b:"rgba(245,158,11,.15)"},
  Low:   {c:"#10B981",b:"rgba(16,185,129,.15)"},
};
const STAT_C = {
  Pending:      {c:"#F59E0B",b:"rgba(245,158,11,.15)"},
  Done:         {c:"#10B981",b:"rgba(16,185,129,.15)"},
  "Not Started":{c:"#64748B",b:"rgba(100,116,139,.15)"},
  "In Progress":{c:"#3B82F6",b:"rgba(59,130,246,.15)"},
  Submitted:    {c:"#8B5CF6",b:"rgba(139,92,246,.15)"},
  Graded:       {c:"#10B981",b:"rgba(16,185,129,.15)"},
  Upcoming:     {c:"#3B82F6",b:"rgba(59,130,246,.15)"},
  Completed:    {c:"#10B981",b:"rgba(16,185,129,.15)"},
};

const TT_DAYS  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const TT_SLOTS = [];
for (let h = 6.5; h < 21.5; h += 0.5) {
  const hh = Math.floor(h);
  const mm = h % 1 === 0 ? "00" : "30";
  TT_SLOTS.push(`${String(hh).padStart(2,"0")}:${mm}`);
}
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/* ─── UTILS ──────────────────────────────────────────────────────────────── */
const NOW     = () => new Date();
const isOD    = d => d && new Date(d) < NOW();
const isSoon  = (d,days=7) => { if(!d)return false; const t=new Date(d); return t>=NOW()&&t<=new Date(+NOW()+days*864e5); };
const fmtDate = d => d?new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—";
const fmtDT   = d => d?new Date(d).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"—";
const fmtTime = d => d?new Date(d).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}):"";
const toInpDT = d => { if(!d)return""; return new Date(d).toISOString().slice(0,16); };

/* ─── SUPABASE ───────────────────────────────────────────────────────────── */
async function getUid() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id||null;
}
function useTable(table, orderCol="created_at") {
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [dbError,setDbError]=useState(null);
  const load=useCallback(async()=>{
    setLoading(true);setDbError(null);
    const{data,error}=await supabase.from(table).select("*").order(orderCol,{ascending:true});
    if(error){setDbError(error.message);setRows([]);}else{setRows(data||[]);}
    setLoading(false);
  },[table,orderCol]);
  useEffect(()=>{load();},[load]);
  return{rows,loading,reload:load,dbError};
}
const db={
  ins:async(t,p)=>{const uid=await getUid();const payload=uid?{...p,user_id:uid}:p;const{data,error}=await supabase.from(t).insert(payload).select().single();if(error)throw error;return data;},
  upd:async(t,id,p)=>{const{data,error}=await supabase.from(t).update(p).eq("id",id).select().single();if(error)throw error;return data;},
  del:async(t,id)=>{const{error}=await supabase.from(t).delete().eq("id",id);if(error)throw error;},
};

/* ─── ICONS ──────────────────────────────────────────────────────────────── */
const IC={
  home:"M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  book:"M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  note:"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  cal:"M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  tbl:"M3 10h18M3 14h18M10 4v16M3 4h18a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1z",
  user:"M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  plus:"M12 4v16m8-8H4",
  edit:"M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  trash:"M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  cL:"M15 19l-7-7 7-7",cR:"M9 5l7 7-7 7",
  x:"M6 18L18 6M6 6l12 12",ok:"M5 13l4 4L19 7",
  alert:"M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  clock:"M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  srch:"M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  star:"M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
  doc:"M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  out:"M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  menu:"M4 6h16M4 12h16M4 18h16",
};
function Ic({n,size=16,style={}}){
  return(<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={style}><path d={IC[n]||IC.home}/></svg>);
}

/* ─── ATOMS ──────────────────────────────────────────────────────────────── */
function Pill({children,color,bg,border,style={}}){
  return(<span style={{display:"inline-flex",alignItems:"center",padding:"2px 10px",borderRadius:99,fontSize:11,fontWeight:700,color:color||B.textMd,background:bg||B.glass,border:border?`1px solid ${border}`:undefined,...style}}>{children}</span>);
}
function PPill({p}){const c=PRIO_C[p]||PRIO_C.Medium;return<Pill color={c.c} bg={c.b}>{p}</Pill>;}
function SPill({s}){const c=STAT_C[s]||{c:B.textMd,b:B.glass};return<Pill color={c.c} bg={c.b}>{s}</Pill>;}
function CPill({course}){
  if(!course)return null;
  const col=PAL[course.color_tag]||PAL.Blue;
  return<Pill color={col.text} bg={col.soft} border={col.border}>{course.course_code}</Pill>;
}
function OD(){return<span style={{fontSize:10,fontWeight:800,padding:"2px 8px",borderRadius:99,background:"rgba(239,68,68,.2)",color:"#EF4444",border:"1px solid rgba(239,68,68,.4)"}}>OVERDUE</span>;}

function Btn({children,variant="primary",size="md",onClick,disabled,style={},type="button",loading}){
  const sz={sm:{fs:12,p:"5px 14px"},md:{fs:13,p:"9px 20px"},lg:{fs:14,p:"12px 26px"}}[size]||{fs:13,p:"9px 20px"};
  const base={display:"inline-flex",alignItems:"center",gap:6,border:"none",borderRadius:9,cursor:disabled||loading?"not-allowed":"pointer",fontWeight:600,fontFamily:"inherit",transition:"all .17s",opacity:disabled||loading?.5:1,fontSize:sz.fs,padding:sz.p};
  const V={
    primary:  {background:"linear-gradient(135deg,#3B82F6,#6366F1)",color:"#fff",boxShadow:"0 4px 14px rgba(99,102,241,.4)"},
    secondary:{background:B.glass,color:B.text,border:`1px solid ${B.border}`},
    danger:   {background:"rgba(239,68,68,.15)",color:"#EF4444",border:"1px solid rgba(239,68,68,.3)"},
    ghost:    {background:"transparent",color:B.textMd},
    gold:     {background:"linear-gradient(135deg,#F59E0B,#EF4444)",color:"#fff",boxShadow:"0 4px 14px rgba(245,158,11,.35)"},
  };
  return(
    <button type={type} onClick={onClick} disabled={disabled||loading} style={{...base,...(V[variant]||V.primary),...style}}
      onMouseEnter={e=>{if(!disabled&&!loading)e.currentTarget.style.filter="brightness(1.15)";}}
      onMouseLeave={e=>{e.currentTarget.style.filter="";}}>
      {loading&&<svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="sp"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/></svg>}
      {children}
    </button>
  );
}

function Inp({label,type="text",value,onChange,placeholder,required,min,max,style={}}){
  const [f,sF]=useState(false);
  return(
    <div style={{marginBottom:14}}>
      {label&&<label style={{fontSize:11,fontWeight:700,color:B.textMd,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".06em"}}>{label}{required&&<span style={{color:"#EF4444"}}> *</span>}</label>}
      <input type={type} value={value??""} onChange={onChange} placeholder={placeholder} min={min} max={max}
        onFocus={()=>sF(true)} onBlur={()=>sF(false)}
        style={{width:"100%",padding:"10px 13px",borderRadius:9,border:`1.5px solid ${f?"#3B82F6":B.border}`,fontSize:13,color:B.text,background:B.card,outline:"none",fontFamily:"inherit",transition:"border .15s",...style}}/>
    </div>
  );
}
function Sel({label,value,onChange,options,required}){
  return(
    <div style={{marginBottom:14}}>
      {label&&<label style={{fontSize:11,fontWeight:700,color:B.textMd,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".06em"}}>{label}{required&&<span style={{color:"#EF4444"}}> *</span>}</label>}
      <select value={value??""} onChange={onChange} style={{width:"100%",padding:"10px 13px",borderRadius:9,border:`1.5px solid ${B.border}`,fontSize:13,color:B.text,background:B.card,outline:"none",fontFamily:"inherit",cursor:"pointer"}}>
        {options.map(o=>typeof o==="string"?<option key={o} value={o}>{o}</option>:<option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}
function TA({label,value,onChange,placeholder,rows=3}){
  return(
    <div style={{marginBottom:14}}>
      {label&&<label style={{fontSize:11,fontWeight:700,color:B.textMd,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".06em"}}>{label}</label>}
      <textarea value={value??""} onChange={onChange} placeholder={placeholder} rows={rows}
        style={{width:"100%",padding:"10px 13px",borderRadius:9,border:`1.5px solid ${B.border}`,fontSize:13,color:B.text,background:B.card,outline:"none",fontFamily:"inherit",resize:"vertical"}}/>
    </div>
  );
}
function ErrBox({msg}){
  return msg?<div style={{padding:"12px 15px",borderRadius:10,background:"rgba(239,68,68,.15)",border:"1px solid rgba(239,68,68,.3)",color:"#EF4444",fontSize:13,marginBottom:15,lineHeight:1.5}}>❌ {msg}</div>:null;
}

function Modal({title,onClose,children,wide=false}){
  useEffect(()=>{const h=e=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[onClose]);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16,backdropFilter:"blur(8px)"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="fi" style={{background:B.surface,borderRadius:20,width:wide?"min(720px,96vw)":"min(540px,96vw)",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 40px 100px rgba(0,0,0,.7)",border:`1px solid ${B.border}`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"22px 26px 16px",borderBottom:`1px solid ${B.border}`}}>
          <h2 style={{fontSize:17,fontWeight:800,color:B.text}}>{title}</h2>
          <Btn variant="ghost" onClick={onClose} style={{padding:6,borderRadius:8}}><Ic n="x" size={18}/></Btn>
        </div>
        <div style={{padding:"20px 26px 26px"}}>{children}</div>
      </div>
    </div>
  );
}

function Empty({icon="note",title,sub,action,onAction}){
  return(
    <div style={{textAlign:"center",padding:"48px 24px",color:B.textSm}}>
      <div style={{width:56,height:56,borderRadius:16,background:B.glass,border:`1px solid ${B.border}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",color:B.textMd}}><Ic n={icon} size={26}/></div>
      <div style={{fontSize:14,fontWeight:700,color:B.textMd,marginBottom:6}}>{title}</div>
      {sub&&<div style={{fontSize:13,marginBottom:16,color:B.textSm}}>{sub}</div>}
      {action&&<Btn onClick={onAction}><Ic n="plus" size={14}/> {action}</Btn>}
    </div>
  );
}

function ColorPicker({value,onChange}){
  return(
    <div style={{marginBottom:16}}>
      <label style={{fontSize:11,fontWeight:700,color:B.textMd,display:"block",marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>Colour Tag</label>
      <div style={{display:"flex",gap:12}}>
        {COLORS.map(c=>{const col=PAL[c];return(
          <button key={c} type="button" onClick={()=>onChange(c)} title={c}
            style={{width:36,height:36,borderRadius:"50%",background:col.accent,border:value===c?`3px solid ${B.text}`:"3px solid transparent",cursor:"pointer",boxShadow:value===c?`0 0 0 2px ${B.surface} inset,0 0 0 4px ${col.accent}`:"none",transition:"all .15s"}}/>
        );})}
      </div>
    </div>
  );
}

function RichEd({value,onChange,placeholder="Write your notes here..."}){
  const ref=useRef();const init=useRef(false);
  useEffect(()=>{if(!init.current&&ref.current){ref.current.innerHTML=value||"";init.current=true;}},[]);
  const cmd=(c,v)=>{document.execCommand(c,false,v||null);ref.current.focus();onChange(ref.current.innerHTML);};
  const tools=[
    {l:"B",c:()=>cmd("bold"),s:{fontWeight:800}},{l:"I",c:()=>cmd("italic"),s:{fontStyle:"italic"}},
    {l:"U",c:()=>cmd("underline"),s:{textDecoration:"underline"}},{l:"H1",c:()=>cmd("formatBlock","h2"),s:{fontWeight:800,fontSize:11}},
    {l:"H2",c:()=>cmd("formatBlock","h3"),s:{fontWeight:800,fontSize:10}},{l:"•",c:()=>cmd("insertUnorderedList"),s:{fontSize:18,lineHeight:"1"}},
    {l:"1.",c:()=>cmd("insertOrderedList"),s:{fontSize:11}},{l:"—",c:()=>{cmd("removeFormat");cmd("formatBlock","p");},s:{color:B.textSm}},
  ];
  return(
    <div style={{border:`1.5px solid ${B.border}`,borderRadius:10,overflow:"hidden"}}>
      <div style={{display:"flex",gap:2,padding:"6px 8px",background:B.bg,borderBottom:`1px solid ${B.border}`,flexWrap:"wrap"}}>
        {tools.map(t=><button key={t.l} onMouseDown={e=>{e.preventDefault();t.c();}} style={{...t.s,minWidth:28,height:28,border:`1px solid ${B.border}`,borderRadius:6,cursor:"pointer",background:B.card,color:B.text,padding:"0 4px"}}>{t.l}</button>)}
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning data-placeholder={placeholder}
        onInput={e=>onChange(e.currentTarget.innerHTML)}
        style={{padding:"13px 15px",minHeight:160,outline:"none",fontSize:14,lineHeight:1.75,color:B.text,background:B.card}}/>
    </div>
  );
}

function Skeleton(){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,padding:"28px 0"}}>
      {[1,2,3].map(i=><div key={i} style={{height:76,borderRadius:13,background:`linear-gradient(90deg,${B.card} 25%,${B.cardHov} 50%,${B.card} 75%)`,backgroundSize:"400% 100%",animation:"shim 1.5s infinite"}}/>)}
    </div>
  );
}

function NoteForm({form,setForm,save,saving,onCancel,err,showCourseSelect,courses}){
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const BtnRow=()=>(
    <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
      <Btn variant="secondary" onClick={onCancel}>Cancel</Btn>
      <Btn onClick={save} loading={saving}><Ic n="ok" size={14}/> Save Note</Btn>
    </div>
  );
  return(
    <>
      <ErrBox msg={err}/>
      <div style={{marginBottom:18,paddingBottom:16,borderBottom:`1px solid ${B.border}`}}><BtnRow/></div>
      <Inp label="Title" value={form.title||""} onChange={f("title")} placeholder="Note title / topic" required/>
      {showCourseSelect&&<Sel label="Course" value={form.course_id||""} onChange={f("course_id")} options={[{v:"",l:"— Select Course —"},...courses.map(c=>({v:c.id,l:`${c.course_code} — ${c.course_name.slice(0,40)}`}))]} required/>}
      <div style={{marginBottom:14}}>
        <label style={{fontSize:11,fontWeight:700,color:B.textMd,display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:".06em"}}>Content</label>
        <RichEd value={form.content||""} onChange={v=>setForm(p=>({...p,content:v}))}/>
      </div>
      <div style={{paddingTop:16,borderTop:`1px solid ${B.border}`}}><BtnRow/></div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   DASHBOARD — greeting + upcoming events + today's lectures + overdue tasks
───────────────────────────────────────────────────────────────────────────── */
function Dashboard({courses,deadlines,quizzes,assessments,assignments,slots,user,onNav,onSelectCourse}){
  const d=NOW();
  const todayName=DAY_NAMES[d.getDay()];
  const meta=user?.user_metadata||{};
  const greeting=meta.first_name?`${meta.first_name}${meta.last_name?" "+meta.last_name:""}`:meta.student_id||user?.email?.split("@")[0]||"Student";
  const studentId=meta.student_id||"";
  const programme=meta.programme||"";

  const hour=d.getHours();
  const greetWord=hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";

  const gc=id=>courses.find(c=>c.id===id);

  /* Upcoming — next 7 days, all types */
  const upcoming=[
    ...deadlines.filter(x=>x.status!=="Done"&&isSoon(x.due_date)).map(x=>({...x,_t:"Deadline",_d:x.due_date,_c:B.blue})),
    ...assignments.filter(x=>x.status!=="Submitted"&&x.status!=="Graded"&&isSoon(x.due_date)).map(x=>({...x,_t:"Assignment",_d:x.due_date,_c:B.gold})),
    ...quizzes.filter(x=>x.status!=="Completed"&&isSoon(x.date_time)).map(x=>({...x,_t:"Quiz",_d:x.date_time,_c:B.purple})),
    ...assessments.filter(x=>x.status!=="Graded"&&x.status!=="Submitted"&&isSoon(x.due_date)).map(x=>({...x,_t:"Assessment",_d:x.due_date,_c:"#14B8A6"})),
  ].sort((a,b)=>new Date(a._d)-new Date(b._d));

  /* Today's lectures from timetable */
  const todaySlots=slots.filter(s=>s.day===todayName).sort((a,b)=>a.start_time.localeCompare(b.start_time));

  /* Overdue + pending assignments */
  const pendingAssignments=[
    ...assignments.filter(x=>(x.status==="Not Started"||x.status==="In Progress"||isOD(x.due_date))&&x.status!=="Submitted"&&x.status!=="Graded"),
  ].sort((a,b)=>new Date(a.due_date)-new Date(b.due_date));

  return(
    <div className="fi">
      {/* ── Greeting ── */}
      <div style={{marginBottom:32,padding:"32px 36px",borderRadius:24,background:"linear-gradient(135deg,#0F1F3D 0%,#1A1040 50%,#0F2D1F 100%)",border:`1px solid ${B.border}`,position:"relative",overflow:"hidden"}}>
        {/* decorative glow */}
        <div style={{position:"absolute",top:-60,right:-60,width:200,height:200,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,.25) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:-40,left:60,width:150,height:150,borderRadius:"50%",background:"radial-gradient(circle,rgba(16,185,129,.15) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{position:"relative"}}>
          <div style={{fontSize:12,color:"rgba(255,255,255,.5)",fontWeight:500,marginBottom:8,letterSpacing:".06em",textTransform:"uppercase"}}>
            {d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
          </div>
          <h1 style={{fontSize:30,fontWeight:800,color:"#fff",lineHeight:1.2,fontFamily:"'Lora',serif",marginBottom:6}}>
            {greetWord},<br/>
            <span style={{background:"linear-gradient(135deg,#F59E0B,#EF4444)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{greeting}</span> 👋
          </h1>
          {(studentId||programme)&&(
            <p style={{fontSize:13,color:"rgba(255,255,255,.55)",marginTop:10,fontWeight:500}}>
              {[studentId,programme].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* ── 3-column grid ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20}}>

        {/* Col 1: Upcoming Events */}
        <div style={{background:B.surface,borderRadius:18,border:`1px solid ${B.border}`,overflow:"hidden"}}>
          <div style={{padding:"18px 20px",borderBottom:`1px solid ${B.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:B.text}}>📅 Upcoming</div>
              <div style={{fontSize:11,color:B.textSm,marginTop:2}}>Next 7 days</div>
            </div>
            <Btn variant="ghost" size="sm" onClick={()=>onNav("calendar")} style={{fontSize:11}}><Ic n="cR" size={12}/>Calendar</Btn>
          </div>
          <div style={{padding:"14px 16px",maxHeight:420,overflowY:"auto"}}>
            {upcoming.length===0
              ?<Empty icon="cal" title="Nothing due soon" sub="All clear for the next 7 days!"/>
              :upcoming.map(item=>{
                const c=gc(item.course_id);
               // const col=c?PAL[c.color_tag]:PAL.Blue;
                return(
                  <div key={item.id} className="clk" onClick={()=>onNav("calendar")}
                    style={{padding:"11px 13px",borderRadius:12,marginBottom:8,background:B.card,border:`1px solid ${B.border}`,display:"flex",gap:10,alignItems:"flex-start"}}>
                    <div style={{width:3,borderRadius:2,alignSelf:"stretch",background:item._c,minHeight:30,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,color:B.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:4}}>{item.title}</div>
                      <div style={{fontSize:11,color:B.textSm,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                        {c&&<CPill course={c}/>}
                        <Pill color={item._c} bg={item._c+"25"}>{item._t}</Pill>
                        <span>{fmtDT(item._d)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>

        {/* Col 2: Today's Lectures */}
        <div style={{background:B.surface,borderRadius:18,border:`1px solid ${B.border}`,overflow:"hidden"}}>
          <div style={{padding:"18px 20px",borderBottom:`1px solid ${B.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:B.text}}>🎓 Today's Lectures</div>
              <div style={{fontSize:11,color:B.textSm,marginTop:2}}>{todayName}</div>
            </div>
            <Btn variant="ghost" size="sm" onClick={()=>onNav("timetable")} style={{fontSize:11}}><Ic n="cR" size={12}/>Timetable</Btn>
          </div>
          <div style={{padding:"14px 16px",maxHeight:420,overflowY:"auto"}}>
            {todaySlots.length===0
              ?<Empty icon="tbl" title="No classes today" sub="Enjoy your free day!"/>
              :todaySlots.map(s=>{
                const c=s.course_id?courses.find(x=>x.id===s.course_id):null;
                const col=c?PAL[c.color_tag]:PAL.Blue;
                return(
                  <div key={s.id} className="clk" onClick={()=>onNav("timetable")}
                    style={{padding:"13px 15px",borderRadius:12,marginBottom:8,background:col.bg,border:`1px solid ${col.border}`,display:"flex",gap:12,alignItems:"center"}}>
                    <div style={{width:40,height:40,borderRadius:10,background:col.soft,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:11,fontWeight:800,color:col.text}}>{s.start_time}</span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:700,fontSize:13,color:B.text,marginBottom:2}}>{c?c.course_code:s.label||"Class"}</div>
                      <div style={{fontSize:11,color:B.textSm}}>
                        {c?c.course_name.slice(0,35):""}{s.end_time&&s.end_time!==s.start_time?` · until ${s.end_time}`:""}
                      </div>
                      {s.label&&c&&<div style={{fontSize:10,color:col.text,marginTop:2,fontWeight:600}}>{s.label}</div>}
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>

        {/* Col 3: Pending / Overdue Assignments */}
        <div style={{background:B.surface,borderRadius:18,border:`1px solid ${B.border}`,overflow:"hidden"}}>
          <div style={{padding:"18px 20px",borderBottom:`1px solid ${B.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:15,fontWeight:800,color:B.text}}>📌 Assignments</div>
              <div style={{fontSize:11,color:B.textSm,marginTop:2}}>Pending & overdue</div>
            </div>
            <Btn variant="ghost" size="sm" onClick={()=>onNav("courses")} style={{fontSize:11}}><Ic n="cR" size={12}/>Courses</Btn>
          </div>
          <div style={{padding:"14px 16px",maxHeight:420,overflowY:"auto"}}>
            {pendingAssignments.length===0
              ?<Empty icon="ok" title="All done!" sub="No pending assignments right now."/>
              :pendingAssignments.map(a=>{
                const c=gc(a.course_id);
                const col=c?PAL[c.color_tag]:PAL.Blue;
                const od=isOD(a.due_date);
                return(
                  <div key={a.id} className="clk" onClick={()=>{if(c)onSelectCourse(c);else onNav("courses");}}
                    style={{padding:"11px 13px",borderRadius:12,marginBottom:8,background:od?"rgba(239,68,68,.1)":B.card,border:`1px solid ${od?"rgba(239,68,68,.3)":B.border}`,display:"flex",gap:10,alignItems:"flex-start"}}>
                    <div style={{width:3,borderRadius:2,alignSelf:"stretch",background:od?"#EF4444":col.accent,minHeight:30,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                        <span style={{fontWeight:700,fontSize:13,color:B.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.title}</span>
                        {od&&<OD/>}
                      </div>
                      <div style={{fontSize:11,color:B.textSm,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                        {c&&<CPill course={c}/>}
                        <PPill p={a.priority}/>
                        <span style={{color:od?"#EF4444":B.textSm}}>{fmtDT(a.due_date)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>

      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   COURSES PAGE
───────────────────────────────────────────────────────────────────────────── */
function CoursesPage({courses,reload,onSelect}){
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));

  const save=async()=>{
    if(!form.course_code||!form.course_name){setErr("Course code and name are required.");return;}
    setSaving(true);setErr("");
    try{
      const p={course_code:form.course_code,course_name:form.course_name,instructor_name:form.instructor_name||null,instructor_email:form.instructor_email||null,room:form.room||null,schedule:form.schedule||null,color_tag:form.color_tag||"Blue"};
      if(modal==="add")await db.ins("courses",p);else await db.upd("courses",form.id,p);
      await reload();setModal(null);
    }catch(e){setErr(e.message);}
    setSaving(false);
  };

  const del=async c=>{
    if(!window.confirm(`Delete "${c.course_code}"? All related data will also be deleted.`))return;
    try{
      for(const t of["notes","deadlines","quizzes","assessments","assignments"])
        await supabase.from(t).delete().eq("course_id",c.id);
      await db.del("courses",c.id);await reload();
    }catch(e){window.alert(e.message);}
  };

  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:26}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:800,color:B.text}}>My Courses</h1>
          <p style={{fontSize:13,color:B.textMd,marginTop:3}}>2025/2026 Second Semester · {courses.length}/8 added</p>
        </div>
        <Btn onClick={()=>{setForm({color_tag:"Blue"});setModal("add");setErr("");}} disabled={courses.length>=8}><Ic n="plus" size={14}/> Add Course</Btn>
      </div>

      {courses.length===0
        ?<Empty icon="book" title="No courses yet" sub="Click '+ Add Course' to get started. Up to 8 courses." action="Add Course" onAction={()=>{setForm({color_tag:"Blue"});setModal("add");}}/>
        :<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:18}}>
          {courses.map(c=>{const col=PAL[c.color_tag]||PAL.Blue;return(
            <div key={c.id} className="hl" style={{background:B.surface,borderRadius:18,border:`1px solid ${B.border}`,overflow:"hidden"}}>
              <div style={{height:4,background:`linear-gradient(90deg,${col.accent},${col.dot})`}}/>
              <div style={{padding:"18px 20px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1,cursor:"pointer"}} onClick={()=>onSelect(c)}>
                    <div style={{marginBottom:9}}><span style={{fontSize:12,fontWeight:800,padding:"3px 12px",borderRadius:99,background:col.soft,color:col.text,border:`1px solid ${col.border}`}}>{c.course_code}</span></div>
                    <div style={{fontSize:15,fontWeight:800,color:B.text,lineHeight:1.4,marginBottom:10}}>{c.course_name}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:5}}>
                      {c.instructor_name&&<div style={{fontSize:12,color:B.textMd}}>👤 {c.instructor_name}</div>}
                      {c.schedule&&<div style={{fontSize:12,color:B.textMd}}>🕐 {c.schedule}</div>}
                      {c.room&&<div style={{fontSize:12,color:B.textMd}}>📍 {c.room}</div>}
                      {!c.instructor_name&&!c.schedule&&!c.room&&<div style={{fontSize:12,color:B.textSm,fontStyle:"italic"}}>Tap Edit to add details</div>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <Btn variant="secondary" size="sm" onClick={()=>{setForm({...c});setModal("edit");setErr("");}}><Ic n="edit" size={12}/></Btn>
                    <Btn variant="danger"    size="sm" onClick={()=>del(c)}><Ic n="trash" size={12}/></Btn>
                  </div>
                </div>
                <div style={{marginTop:13,paddingTop:13,borderTop:`1px solid ${B.border}`}}>
                  <Btn variant="secondary" size="sm" onClick={()=>onSelect(c)} style={{width:"100%",justifyContent:"center",background:col.soft,color:col.text,border:`1px solid ${col.border}`}}>View Details <Ic n="cR" size={12}/></Btn>
                </div>
              </div>
            </div>
          );})}
        </div>
      }

      {modal&&(
        <Modal title={modal==="add"?"Add Course":"Edit Course"} onClose={()=>setModal(null)} wide>
          <ErrBox msg={err}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 18px"}}>
            <Inp label="Course Code"      value={form.course_code||""}      onChange={f("course_code")}     placeholder="e.g. EGS102" required/>
            <Inp label="Course Name"      value={form.course_name||""}      onChange={f("course_name")}     placeholder="Full course name" required/>
            <Inp label="Instructor Name"  value={form.instructor_name||""}  onChange={f("instructor_name")} placeholder="Dr. / Mr. / Ms."/>
            <Inp label="Instructor Email" value={form.instructor_email||""} onChange={f("instructor_email")} placeholder="lecturer@ucc.edu.gh" type="email"/>
            <Inp label="Room / Location"  value={form.room||""}             onChange={f("room")}            placeholder="e.g. Lecture Hall B"/>
            <Inp label="Schedule"         value={form.schedule||""}         onChange={f("schedule")}        placeholder="e.g. Mon & Wed 9–11am"/>
          </div>
          <ColorPicker value={form.color_tag||"Blue"} onChange={v=>setForm(p=>({...p,color_tag:v}))}/>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:4}}>
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
function CourseDetail({course,notes,deadlines,quizzes,assessments,assignments,reloadAll,onBack}){
  const [tab,setTab]=useState("notes");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  const col=PAL[course.color_tag]||PAL.Blue;
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));

  const cN=notes.filter(n=>n.course_id===course.id);
  const cD=deadlines.filter(d=>d.course_id===course.id);
  const cQ=quizzes.filter(q=>q.course_id===course.id);
  const cA=assessments.filter(a=>a.course_id===course.id);
  const cX=assignments.filter(a=>a.course_id===course.id);

  const TBL={note:"notes",deadline:"deadlines",quiz:"quizzes",assessment:"assessments",assignment:"assignments"};
  const open=(type,item)=>{setModal({type,mode:item?"edit":"add",item});setForm(item?{...item}:{});setErr("");};
  const close=()=>setModal(null);

  const save=async()=>{
    if(!form.title){setErr("Title is required.");return;}
    setSaving(true);setErr("");
    try{
      let p={...form,course_id:course.id};
      delete p.id;delete p.created_at;delete p.updated_at;delete p.user_id;
      if(modal.mode==="add")await db.ins(TBL[modal.type],p);
      else await db.upd(TBL[modal.type],modal.item.id,p);
      await reloadAll();close();
    }catch(e){setErr(e.message);}
    setSaving(false);
  };

  const del=async(type,id)=>{
    if(!window.confirm("Delete this item?"))return;
    try{await db.del(TBL[type],id);await reloadAll();}catch(e){window.alert(e.message);}
  };

  const Row=({item,type,meta})=>{
    const od=isOD(item.due_date||item.date_time);
    return(
      <div style={{display:"flex",gap:12,padding:"12px 15px",borderRadius:12,marginBottom:9,background:od?"rgba(239,68,68,.1)":B.card,border:`1px solid ${od?"rgba(239,68,68,.3)":B.border}`,alignItems:"center"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:14,color:B.text,marginBottom:5,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>{item.title}{od&&<OD/>}</div>
          <div style={{fontSize:11,color:B.textMd,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>{meta}</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <Btn variant="secondary" size="sm" onClick={()=>open(type,item)}><Ic n="edit" size={12}/></Btn>
          <Btn variant="danger"    size="sm" onClick={()=>del(type,item.id)}><Ic n="trash" size={12}/></Btn>
        </div>
      </div>
    );
  };

  const TABS=[{k:"notes",l:`📝 Notes (${cN.length})`},{k:"deadlines",l:`⏰ Deadlines (${cD.length})`},{k:"quizzes",l:`📋 Quizzes (${cQ.length})`},{k:"assessments",l:`🏆 Assessments (${cA.length})`},{k:"assignments",l:`📌 Assignments (${cX.length})`}];

  return(
    <div className="fi">
      <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:B.textMd,fontSize:13,fontWeight:600,marginBottom:18,padding:0}}>
        <Ic n="cL" size={14}/> Back to Courses
      </button>

      <div style={{background:B.surface,borderRadius:20,border:`1px solid ${B.border}`,overflow:"hidden",marginBottom:24}}>
        <div style={{height:5,background:`linear-gradient(90deg,${col.accent},${col.dot})`}}/>
        <div style={{padding:"22px 26px"}}>
          <span style={{fontSize:12,fontWeight:800,padding:"3px 14px",borderRadius:99,background:col.soft,color:col.text,border:`1px solid ${col.border}`}}>{course.course_code}</span>
          <h1 style={{fontSize:20,fontWeight:800,color:B.text,marginTop:12,marginBottom:16,fontFamily:"'Lora',serif"}}>{course.course_name}</h1>
          <div style={{display:"flex",gap:26,flexWrap:"wrap"}}>
            {[["👤 Instructor",course.instructor_name||"—"],["📍 Room",course.room||"—"],["🕐 Schedule",course.schedule||"—"],["📧 Email",course.instructor_email||"—"]].map(([l,v])=>(
              <div key={l}><div style={{fontSize:10,color:B.textSm,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em"}}>{l}</div><div style={{fontSize:13,color:B.textMd,fontWeight:600,marginTop:2}}>{v}</div></div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:4,borderBottom:`1px solid ${B.border}`,marginBottom:22,overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)}
            style={{padding:"10px 16px",border:"none",background:"none",cursor:"pointer",fontSize:13,fontWeight:tab===t.k?800:500,color:tab===t.k?B.text:B.textSm,borderBottom:`2px solid ${tab===t.k?col.accent:"transparent"}`,marginBottom:-1,whiteSpace:"nowrap",fontFamily:"inherit",transition:"all .15s"}}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==="notes"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><Btn onClick={()=>open("note",null)}><Ic n="plus" size={14}/> Add Note</Btn></div>
          {cN.length===0?<Empty icon="note" title="No notes yet" sub="Add your first note" action="Add Note" onAction={()=>open("note",null)}/>:
            cN.map(note=>(
              <div key={note.id} style={{background:B.surface,borderRadius:14,border:`1px solid ${B.border}`,marginBottom:13,overflow:"hidden"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",background:B.bg,borderBottom:`1px solid ${B.border}`}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:15,color:B.text,fontFamily:"'Lora',serif"}}>{note.title}</div>
                    <div style={{fontSize:11,color:B.textSm,marginTop:2}}>Updated {fmtDate(note.updated_at)}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <Btn variant="secondary" size="sm" onClick={()=>open("note",note)}><Ic n="edit" size={12}/> Edit</Btn>
                    <Btn variant="danger"    size="sm" onClick={()=>del("note",note.id)}><Ic n="trash" size={12}/></Btn>
                  </div>
                </div>
                <div style={{padding:"16px 18px",minHeight:48}}>
                  {note.content?<div style={{fontSize:14,color:B.textMd,lineHeight:1.8}} dangerouslySetInnerHTML={{__html:note.content}}/>:<div style={{fontSize:13,color:B.textSm,fontStyle:"italic"}}>No content — tap Edit to write.</div>}
                </div>
              </div>
            ))
          }
        </div>
      )}
      {tab==="deadlines"&&(<div><div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><Btn onClick={()=>open("deadline",null)}><Ic n="plus" size={14}/> Add Deadline</Btn></div>{cD.length===0?<Empty icon="clock" title="No deadlines" sub="Track submission deadlines" action="Add Deadline" onAction={()=>open("deadline",null)}/>:cD.map(d=><Row key={d.id} item={d} type="deadline" meta={<><span>📅 {fmtDT(d.due_date)}</span><PPill p={d.priority}/><SPill s={d.status}/>{d.reminder&&d.reminder!=="None"&&<Pill>{d.reminder}</Pill>}</>}/>)}</div>)}
      {tab==="quizzes"&&(<div><div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><Btn onClick={()=>open("quiz",null)}><Ic n="plus" size={14}/> Add Quiz</Btn></div>{cQ.length===0?<Empty icon="doc" title="No quizzes" sub="Track upcoming quizzes" action="Add Quiz" onAction={()=>open("quiz",null)}/>:cQ.map(q=><Row key={q.id} item={{...q,due_date:q.date_time}} type="quiz" meta={<><span>📅 {fmtDT(q.date_time)}</span>{q.weight?<Pill>{q.weight}% weight</Pill>:null}{q.score!=null&&q.score!==""?<Pill color={B.green} bg={B.greenDim}>Score: {q.score}%</Pill>:null}<SPill s={q.status}/></>}/>)}</div>)}
      {tab==="assessments"&&(<div><div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><Btn onClick={()=>open("assessment",null)}><Ic n="plus" size={14}/> Add Assessment</Btn></div>{cA.length===0?<Empty icon="star" title="No assessments" sub="Track midterms, finals & projects" action="Add Assessment" onAction={()=>open("assessment",null)}/>:cA.map(a=><Row key={a.id} item={a} type="assessment" meta={<><Pill>{a.type}</Pill><span>📅 {fmtDT(a.due_date)}</span><Pill>{a.weight||0}%</Pill><Pill>{a.submission_type}</Pill><SPill s={a.status}/></>}/>)}</div>)}
      {tab==="assignments"&&(<div><div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><Btn onClick={()=>open("assignment",null)}><Ic n="plus" size={14}/> Add Assignment</Btn></div>{cX.length===0?<Empty icon="doc" title="No assignments" sub="Track your assignments" action="Add Assignment" onAction={()=>open("assignment",null)}/>:cX.map(a=><Row key={a.id} item={a} type="assignment" meta={<><span>📅 {fmtDT(a.due_date)}</span><PPill p={a.priority}/><SPill s={a.status}/><Pill>{a.submission_type}</Pill>{a.points?<Pill>{a.points} pts</Pill>:null}</>}/>)}</div>)}

      {modal&&(
        <Modal title={`${modal.mode==="add"?"Add":"Edit"} ${modal.type.charAt(0).toUpperCase()+modal.type.slice(1)}`} onClose={close} wide={modal.type==="note"}>
          {modal.type==="note"&&<NoteForm form={form} setForm={setForm} save={save} saving={saving} onCancel={close} err={err} showCourseSelect={false} courses={[]}/>}
          {modal.type!=="note"&&(
            <>
              <ErrBox msg={err}/>
              {modal.type==="deadline"&&(<><Inp label="Title" value={form.title||""} onChange={f("title")} placeholder="e.g. Submit Research Proposal" required/><TA label="Description" value={form.description||""} onChange={f("description")} rows={2}/><Inp label="Due Date & Time" type="datetime-local" value={toInpDT(form.due_date)} onChange={f("due_date")} required/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><Sel label="Priority" value={form.priority||"Medium"} onChange={f("priority")} options={["High","Medium","Low"]}/><Sel label="Status" value={form.status||"Pending"} onChange={f("status")} options={["Pending","Done"]}/></div><Sel label="Reminder" value={form.reminder||"None"} onChange={f("reminder")} options={["None","1 day before","2 hours before"]}/></>)}
              {modal.type==="quiz"&&(<><Inp label="Title" value={form.title||""} onChange={f("title")} placeholder="e.g. Mid-term Quiz 1" required/><Inp label="Date & Time" type="datetime-local" value={toInpDT(form.date_time)} onChange={f("date_time")} required/><TA label="Topics Covered" value={form.topics_covered||""} onChange={f("topics_covered")} rows={2}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}><Inp label="Weight (%)" type="number" value={form.weight||""} onChange={f("weight")} min={0} max={100}/><Inp label="Score (after)" type="number" value={form.score||""} onChange={f("score")} min={0} max={100}/><Sel label="Status" value={form.status||"Upcoming"} onChange={f("status")} options={["Upcoming","Completed"]}/></div></>)}
              {modal.type==="assessment"&&(<><Inp label="Title" value={form.title||""} onChange={f("title")} placeholder="e.g. Final Capstone Project" required/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><Sel label="Type" value={form.type||"Midterm"} onChange={f("type")} options={["Midterm","Final","Project"]}/><Inp label="Weight (%)" type="number" value={form.weight||""} onChange={f("weight")} min={0} max={100} required/></div><Inp label="Due Date" type="datetime-local" value={toInpDT(form.due_date)} onChange={f("due_date")} required/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}><Sel label="Submission Type" value={form.submission_type||"Online"} onChange={f("submission_type")} options={["Online","In-person","File upload"]}/><Sel label="Status" value={form.status||"Not Started"} onChange={f("status")} options={["Not Started","In Progress","Submitted","Graded"]}/></div></>)}
              {modal.type==="assignment"&&(<><Inp label="Title" value={form.title||""} onChange={f("title")} placeholder="e.g. Week 3 Problem Set" required/><TA label="Description" value={form.description||""} onChange={f("description")} rows={2}/><Inp label="Due Date & Time" type="datetime-local" value={toInpDT(form.due_date)} onChange={f("due_date")} required/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}><Sel label="Priority" value={form.priority||"Medium"} onChange={f("priority")} options={["High","Medium","Low"]}/><Sel label="Status" value={form.status||"Not Started"} onChange={f("status")} options={["Not Started","In Progress","Submitted","Graded"]}/><Inp label="Points" type="number" value={form.points||""} onChange={f("points")} min={0}/></div><Sel label="Submission Type" value={form.submission_type||"Text entry"} onChange={f("submission_type")} options={["Link","File upload","Text entry"]}/></>)}
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
                <Btn variant="secondary" onClick={close}>Cancel</Btn>
                <Btn onClick={save} loading={saving}><Ic n="ok" size={14}/> Save</Btn>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   NOTES PAGE — clickable cards, read-only modal, edit opens separately
───────────────────────────────────────────────────────────────────────────── */
function NotesPage({notes,courses,reload}){
  const [search,setSearch]=useState("");
  const [cf,setCf]=useState("");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [err,setErr]=useState("");
  const gc=id=>courses.find(c=>c.id===id);

  const filtered=notes.filter(n=>{
    if(cf&&n.course_id!==cf)return false;
    if(search&&!n.title.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });

  const save=async()=>{
    if(!form.title||!form.course_id){setErr("Title and course are required.");return;}
    setSaving(true);setErr("");
    try{
      const p={title:form.title,course_id:form.course_id,content:form.content||""};
      if(modal.mode==="add")await db.ins("notes",p);
      else await db.upd("notes",modal.item.id,p);
      await reload();setModal(null);
    }catch(e){setErr(e.message);}
    setSaving(false);
  };

  const del=async id=>{
    if(!window.confirm("Delete this note?"))return;
    try{await db.del("notes",id);await reload();}catch(e){window.alert(e.message);}
  };

  const openRead=note=>setModal({mode:"read",item:note});
  const switchToEdit=()=>{setForm({...modal.item});setErr("");setModal(m=>({...m,mode:"edit"}));};

  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:800,color:B.text}}>Notes</h1>
          <p style={{fontSize:13,color:B.textMd,marginTop:3}}>All lecture notes · tap a card to read</p>
        </div>
        <Btn onClick={()=>{setModal({mode:"add"});setForm({course_id:cf||""});setErr("");}}><Ic n="plus" size={14}/> New Note</Btn>
      </div>

      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <div style={{position:"relative",flex:1,minWidth:200}}>
          <Ic n="srch" size={15} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:B.textSm,pointerEvents:"none"}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notes..."
            style={{width:"100%",padding:"10px 13px 10px 36px",borderRadius:9,border:`1.5px solid ${B.border}`,fontSize:13,background:B.card,outline:"none",boxSizing:"border-box",color:B.text}}/>
        </div>
        <select value={cf} onChange={e=>setCf(e.target.value)}
          style={{padding:"10px 14px",borderRadius:9,border:`1.5px solid ${B.border}`,fontSize:13,background:B.card,outline:"none",minWidth:180,color:B.text}}>
          <option value="">All Courses</option>
          {courses.map(c=><option key={c.id} value={c.id}>{c.course_code}</option>)}
        </select>
      </div>

      {filtered.length===0
        ?<Empty icon="note" title="No notes found" sub={search?"Try a different term":"Add your first note"} action="New Note" onAction={()=>{setModal({mode:"add"});setForm({});}}/>
        :<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:15}}>
          {filtered.map(note=>{
            const c=gc(note.course_id);const col=c?PAL[c.color_tag]:PAL.Blue;
            return(
              <div key={note.id} className="clk" style={{background:B.surface,borderRadius:14,border:`1px solid ${B.border}`,overflow:"hidden",position:"relative"}} onClick={()=>openRead(note)}>
                <div style={{position:"absolute",top:0,left:0,bottom:0,width:3,background:col.accent}}/>
                <div style={{padding:"16px 16px 14px 20px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:800,fontSize:14,color:B.text,marginBottom:5,fontFamily:"'Lora',serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{note.title}</div>
                      {c&&<CPill course={c}/>}
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                      <Btn variant="secondary" size="sm" onClick={()=>{setForm({...note});setErr("");setModal({mode:"edit",item:note});}}><Ic n="edit" size={12}/></Btn>
                      <Btn variant="danger"    size="sm" onClick={()=>del(note.id)}><Ic n="trash" size={12}/></Btn>
                    </div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
                    <div style={{fontSize:11,color:B.textSm}}>Updated {fmtDate(note.updated_at)}</div>
                    <div style={{fontSize:11,color:col.text,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>Tap to read <Ic n="cR" size={11}/></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      }

      {/* READ-ONLY modal */}
      {modal&&modal.mode==="read"&&(()=>{
        const note=modal.item;const c=gc(note.course_id);
        return(
          <Modal title={note.title} onClose={()=>setModal(null)} wide>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,paddingBottom:14,borderBottom:`1px solid ${B.border}`}}>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {c&&<CPill course={c}/>}
                <span style={{fontSize:11,color:B.textSm}}>Updated {fmtDate(note.updated_at)}</span>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn variant="secondary" size="sm" onClick={switchToEdit}><Ic n="edit" size={12}/> Edit</Btn>
                <Btn variant="danger"    size="sm" onClick={()=>{setModal(null);del(note.id);}}><Ic n="trash" size={12}/></Btn>
              </div>
            </div>
            <div style={{background:B.bg,borderRadius:12,padding:"20px 22px",minHeight:120,border:`1px solid ${B.border}`}}>
              {note.content?<div style={{fontSize:14,color:B.text,lineHeight:1.85,userSelect:"text"}} dangerouslySetInnerHTML={{__html:note.content}}/>:<div style={{fontSize:13,color:B.textSm,fontStyle:"italic"}}>This note has no content yet.</div>}
            </div>
            <div style={{marginTop:14,textAlign:"right"}}><Btn variant="ghost" onClick={()=>setModal(null)}>Close</Btn></div>
          </Modal>
        );
      })()}

      {/* ADD / EDIT modal */}
      {modal&&(modal.mode==="add"||modal.mode==="edit")&&(
        <Modal title={modal.mode==="add"?"New Note":"Edit Note"} onClose={()=>setModal(null)} wide>
          <NoteForm form={form} setForm={setForm} save={save} saving={saving} onCancel={()=>setModal(null)} err={err} showCourseSelect={true} courses={courses}/>
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   CALENDAR PAGE
───────────────────────────────────────────────────────────────────────────── */
function CalendarPage({courses,deadlines,quizzes,assessments,assignments,reloadAll}){
  const [date,setDate]=useState(new Date());const [sel,setSel]=useState(null);
  const [modal,setModal]=useState(null);const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false);const [err,setErr]=useState("");
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const yr=date.getFullYear(),mo=date.getMonth();
  const first=new Date(yr,mo,1).getDay(),dim=new Date(yr,mo+1,0).getDate();
  const MN=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const TC={deadline:B.red,quiz:B.purple,assessment:B.blue,assignment:B.gold};
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
      if(form._t==="assessment")p={...p,due_date:form.due_date,type:form.atype||"Midterm",weight:Number(form.weight)||0,submission_type:"Online",status:"Not Started"};
      if(form._t==="assignment")p={...p,due_date:form.due_date,priority:form.priority||"Medium",status:"Not Started",submission_type:"Text entry",description:""};
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
        <div><h1 style={{fontSize:24,fontWeight:800,color:B.text}}>Calendar</h1><p style={{fontSize:13,color:B.textMd,marginTop:3}}>Tap a day to view or add events</p></div>
        <Btn onClick={openAdd}><Ic n="plus" size={14}/> Add Event</Btn>
      </div>
      <div style={{display:"flex",gap:16,marginBottom:14,flexWrap:"wrap"}}>
        {Object.entries(TC).map(([t,c])=><div key={t} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:B.textMd,fontWeight:500}}><div style={{width:9,height:9,borderRadius:"50%",background:c}}/>{t.charAt(0).toUpperCase()+t.slice(1)}</div>)}
      </div>
      <div style={{background:B.surface,borderRadius:18,border:`1px solid ${B.border}`,overflow:"hidden",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 22px",background:B.bg,borderBottom:`1px solid ${B.border}`}}>
          <Btn variant="secondary" size="sm" onClick={()=>setDate(new Date(yr,mo-1,1))}><Ic n="cL" size={14}/></Btn>
          <span style={{fontSize:17,fontWeight:800,color:B.text,fontFamily:"'Lora',serif"}}>{MN[mo]} {yr}</span>
          <Btn variant="secondary" size="sm" onClick={()=>setDate(new Date(yr,mo+1,1))}><Ic n="cR" size={14}/></Btn>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:B.bg,borderBottom:`1px solid ${B.border}`}}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} style={{textAlign:"center",padding:"8px",fontSize:11,fontWeight:800,color:B.textSm,letterSpacing:".05em"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {Array(first).fill(null).map((_,i)=><div key={`e${i}`} style={{minHeight:88,borderRight:`1px solid ${B.border}`,borderBottom:`1px solid ${B.border}`}}/>)}
          {Array(dim).fill(null).map((_,i)=>{
            const day=i+1,evts=dayEvts(day);
            const isToday=NOW().getDate()===day&&NOW().getMonth()===mo&&NOW().getFullYear()===yr;
            const isSel=sel===day;
            return(
              <div key={day} onClick={()=>setSel(isSel?null:day)}
                style={{minHeight:88,padding:"6px 7px",borderRight:`1px solid ${B.border}`,borderBottom:`1px solid ${B.border}`,background:isSel?"rgba(59,130,246,.12)":isToday?"rgba(99,102,241,.08)":B.surface,cursor:"pointer",transition:"background .15s"}}>
                <div style={{fontSize:13,fontWeight:isToday?800:500,width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:isToday?"linear-gradient(135deg,#3B82F6,#6366F1)":"transparent",color:isToday?"#fff":B.textMd,marginBottom:4}}>{day}</div>
                {evts.slice(0,3).map(ev=><div key={ev.id} style={{fontSize:10,fontWeight:600,padding:"2px 5px",borderRadius:5,background:TC[ev._t]+"30",color:TC[ev._t],marginBottom:2,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",border:`1px solid ${TC[ev._t]}50`}}>{ev.title}</div>)}
                {evts.length>3&&<div style={{fontSize:10,color:B.textSm}}>+{evts.length-3}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {sel&&(
        <div style={{background:B.surface,borderRadius:16,border:`1px solid ${B.border}`,padding:"20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <h2 style={{fontSize:15,fontWeight:800,color:B.text}}>{MN[mo]} {sel}, {yr}</h2>
            <Btn onClick={openAdd} size="sm"><Ic n="plus" size={12}/> Add</Btn>
          </div>
          {selEvts.length===0?<Empty icon="cal" title="No events" sub="Tap '+ Add' to schedule something"/>:
            selEvts.map(ev=>{const c=gc(ev.course_id);const col=c?PAL[c.color_tag]:PAL.Blue;return(
              <div key={ev.id} style={{display:"flex",gap:10,padding:"12px 15px",borderRadius:12,marginBottom:9,background:B.card,border:`1px solid ${B.border}`,alignItems:"center"}}>
                <div style={{width:3,alignSelf:"stretch",borderRadius:2,background:TC[ev._t],flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:B.text}}>{ev.title}</div>
                  <div style={{fontSize:11,color:B.textMd,display:"flex",gap:8,marginTop:3}}>{c&&<CPill course={c}/>}<span style={{color:TC[ev._t],fontWeight:600}}>{ev._t}</span><span>· {fmtTime(ev._d)}</span></div>
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
          {(form._t==="deadline"||form._t==="assignment")&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}><Sel label="Priority" value={form.priority||"Medium"} onChange={f("priority")} options={["High","Medium","Low"]}/><Sel label="Status" value={form.status||"Pending"} onChange={f("status")} options={form._t==="deadline"?["Pending","Done"]:["Not Started","In Progress","Submitted","Graded"]}/></div>}
          {(form._t==="quiz"||form._t==="assessment")&&<Inp label="Weight (%)" type="number" value={form.weight||""} onChange={f("weight")} min={0} max={100}/>}
          {form._t==="assessment"&&<Sel label="Type" value={form.atype||"Midterm"} onChange={f("atype")} options={["Midterm","Final","Project"]}/>}
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
   TIMETABLE
───────────────────────────────────────────────────────────────────────────── */
function TimetablePage({courses,slots,reloadSlots}){
  const [modal,setModal]=useState(null);const [form,setForm]=useState({});
  const [saving,setSaving]=useState(false);const [err,setErr]=useState("");
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
      if(modal.mode==="add")await db.ins("timetable_slots",p);else await db.upd("timetable_slots",form.id,p);
      await reloadSlots();setModal(null);
    }catch(e){setErr(e.message);}
    setSaving(false);
  };
  const del=async()=>{
    if(!form.id)return;if(!window.confirm("Remove this slot?"))return;
    try{await db.del("timetable_slots",form.id);await reloadSlots();setModal(null);}catch(e){window.alert(e.message);}
  };

  return(
    <div className="fi">
      <div style={{marginBottom:22}}>
        <h1 style={{fontSize:24,fontWeight:800,color:B.text}}>Timetable</h1>
        <p style={{fontSize:13,color:B.textMd,marginTop:3}}>06:30 – 21:30 · Tap any cell to add or edit</p>
      </div>
      <div style={{background:B.surface,borderRadius:18,border:`1px solid ${B.border}`,overflow:"auto"}}>
        <table style={{borderCollapse:"collapse",width:"100%",minWidth:64+120*7}}>
          <thead>
            <tr>
              <th style={{width:64,background:B.bg,color:B.textSm,fontSize:11,fontWeight:700,padding:"14px 10px",textAlign:"center",borderRight:`1px solid ${B.border}`,position:"sticky",left:0,zIndex:2}}>Time</th>
              {TT_DAYS.map(day=><th key={day} style={{width:120,background:B.bg,color:B.textMd,fontSize:11,fontWeight:700,padding:"14px 8px",textAlign:"center",borderRight:`1px solid ${B.border}`}}>{day}</th>)}
            </tr>
          </thead>
          <tbody>
            {TT_SLOTS.map(time=>{
              const isHour=time.endsWith(":00");
              return(
                <tr key={time}>
                  <td style={{width:64,fontSize:isHour?12:10,fontWeight:isHour?700:400,color:isHour?B.textMd:B.textSm,padding:"0 10px",textAlign:"right",borderRight:`1px solid ${B.border}`,borderBottom:`1px solid ${B.border}`,height:44,verticalAlign:"middle",background:isHour?"rgba(59,130,246,.05)":B.surface,position:"sticky",left:0,zIndex:1}}>{time}</td>
                  {TT_DAYS.map(day=>{
                    const slot=slotAt(day,time);const col=slot?(PAL[slot.color_tag]||PAL.Blue):{};const course=slot&&slot.course_id?gc(slot.course_id):null;
                    return(
                      <td key={day} onClick={()=>openCell(day,time)}
                        style={{width:120,height:44,padding:"3px 5px",borderRight:`1px solid ${B.border}`,borderBottom:`1px solid ${B.border}`,verticalAlign:"top",cursor:"pointer",transition:"background .12s"}}
                        onMouseEnter={e=>{if(!slot)e.currentTarget.style.background="rgba(59,130,246,.06)";}}
                        onMouseLeave={e=>{if(!slot)e.currentTarget.style.background="";}}>
                        {slot&&(
                          <div style={{background:col.bg,border:`1px solid ${col.border}`,borderRadius:7,padding:"3px 7px",height:"100%",boxSizing:"border-box",overflow:"hidden"}}>
                            <div style={{fontSize:11,fontWeight:800,color:col.text,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{course?course.course_code:slot.label||"Class"}</div>
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
          <Sel label="Course (optional)" value={form.course_id||""} onChange={f("course_id")} options={[{v:"",l:"— Free slot / custom label —"},...courses.map(c=>({v:c.id,l:`${c.course_code} — ${c.course_name.slice(0,35)}`}))]}/>
          <Inp label="Label (optional)" value={form.label||""} onChange={f("label")} placeholder="e.g. Lab, Tutorial…"/>
          <ColorPicker value={form.color_tag||"Blue"} onChange={v=>setForm(p=>({...p,color_tag:v}))}/>
          <div style={{display:"flex",gap:10,justifyContent:"space-between",marginTop:8}}>
            <div>{modal.mode==="edit"&&<Btn variant="danger" onClick={del}>Remove</Btn>}</div>
            <div style={{display:"flex",gap:10}}><Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn><Btn onClick={save} loading={saving}><Ic n="ok" size={14}/> Save Slot</Btn></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROFILE PAGE
───────────────────────────────────────────────────────────────────────────── */
function ProfilePage({session,onSignOut}){
  const meta=session?.user?.user_metadata||{};
  const [form,setForm]=useState({first_name:meta.first_name||"",last_name:meta.last_name||"",student_id:meta.student_id||"",programme:meta.programme||"",level:meta.level||"",email:session?.user?.email||""});
  const [saving,setSaving]=useState(false);const [msg,setMsg]=useState("");
  const f=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const save=async()=>{
    setSaving(true);setMsg("");
    const{error}=await supabase.auth.updateUser({data:{first_name:form.first_name,last_name:form.last_name,student_id:form.student_id,programme:form.programme,level:form.level}});
    setSaving(false);setMsg(error?`Error: ${error.message}`:"✓ Profile saved!");
    setTimeout(()=>setMsg(""),3000);
  };
  const initials=`${(form.first_name?.[0]||"?").toUpperCase()}${(form.last_name?.[0]||"").toUpperCase()}`;
  return(
    <div className="fi">
      <h1 style={{fontSize:24,fontWeight:800,color:B.text,marginBottom:4}}>Profile & Settings</h1>
      <p style={{fontSize:13,color:B.textMd,marginBottom:26}}>University of Cape Coast</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:24}}>
        <div style={{background:B.surface,borderRadius:18,border:`1px solid ${B.border}`,padding:"32px 24px",textAlign:"center"}}>
          <div style={{width:84,height:84,borderRadius:"50%",background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:30,margin:"0 auto 16px",fontFamily:"'Lora',serif",boxShadow:"0 8px 24px rgba(99,102,241,.4)"}}>{initials}</div>
          <div style={{fontWeight:800,fontSize:17,color:B.text,fontFamily:"'Lora',serif"}}>{form.first_name} {form.last_name}</div>
          {form.student_id&&<div style={{fontSize:12,color:B.textMd,marginTop:5}}>{form.student_id}</div>}
          {form.programme&&<div style={{fontSize:11,color:B.textSm,marginTop:3,lineHeight:1.5}}>{form.programme}</div>}
          {form.level&&<div style={{marginTop:10}}><Pill color={B.blueLt} bg="rgba(59,130,246,.15)" border="rgba(59,130,246,.3)">Level {form.level}</Pill></div>}
          <div style={{fontSize:12,color:B.textSm,marginTop:6}}>{form.email}</div>
          <div style={{marginTop:22}}><Btn variant="danger" onClick={onSignOut} style={{width:"100%",justifyContent:"center"}}><Ic n="out" size={14}/> Sign Out</Btn></div>
        </div>
        <div style={{background:B.surface,borderRadius:18,border:`1px solid ${B.border}`,padding:"28px"}}>
          <h2 style={{fontSize:16,fontWeight:800,color:B.text,marginBottom:22}}>Edit Profile</h2>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
            <Inp label="First Name"   value={form.first_name} onChange={f("first_name")} placeholder="Ama"/>
            <Inp label="Last Name"    value={form.last_name}  onChange={f("last_name")}  placeholder="Mensah"/>
            <Inp label="Student ID"   value={form.student_id} onChange={f("student_id")} placeholder="e.g. EH/GOV/25/0014"/>
            <Inp label="Level / Year" value={form.level}      onChange={f("level")}       placeholder="e.g. 100"/>
          </div>
          <Inp label="Programme" value={form.programme} onChange={f("programme")} placeholder="e.g. Bachelor of Education (Government)"/>
          <Inp label="Email (read-only)" value={form.email} onChange={()=>{}} style={{background:B.bg,color:B.textSm}}/>
          <div style={{display:"flex",justifyContent:"flex-end",gap:12,alignItems:"center",marginTop:6}}>
            {msg&&<span style={{fontSize:13,color:msg.startsWith("✓")?"#10B981":"#EF4444",fontWeight:600}}>{msg}</span>}
            <Btn onClick={save} loading={saving}><Ic n="ok" size={14}/> Save Changes</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SIDEBAR — slides in from left when triggered, closes on overlay click
───────────────────────────────────────────────────────────────────────────── */
function Sidebar({active,onNav,courses,onSelect,open,onClose}){
  const NAV=[
    {k:"dashboard",i:"home",l:"Dashboard"},
    {k:"courses",  i:"book",l:"Courses"},
    {k:"notes",    i:"note",l:"Notes"},
    {k:"calendar", i:"cal", l:"Calendar"},
    {k:"timetable",i:"tbl", l:"Timetable"},
    {k:"profile",  i:"user",l:"Profile"},
  ];

  return(
    <>
      {/* Overlay */}
      {open&&(
        <div onClick={onClose}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:90,animation:"fadeOverlay .2s ease"}}/>
      )}

      {/* Sidebar panel */}
      <div style={{
        position:"fixed",top:0,left:0,bottom:0,width:260,
        background:B.surface,borderRight:`1px solid ${B.border}`,
        display:"flex",flexDirection:"column",zIndex:100,
        transform:open?"translateX(0)":"translateX(-100%)",
        transition:"transform .28s cubic-bezier(.4,0,.2,1)",
        boxShadow:open?"8px 0 40px rgba(0,0,0,.5)":"none",
      }}>
        {/* Header */}
        <div style={{padding:"24px 20px 20px",borderBottom:`1px solid ${B.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:B.text,fontFamily:"'Lora',serif",letterSpacing:"-.4px",background:"linear-gradient(135deg,#F59E0B,#EF4444)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>StudyDesk</div>
            <div style={{fontSize:10,color:B.textSm,fontWeight:600,marginTop:2,letterSpacing:".04em"}}>UCC · 2025/2026</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:B.textMd,padding:6,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <Ic n="x" size={18}/>
          </button>
        </div>

        {/* Nav */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 10px"}}>
          <div style={{fontSize:10,fontWeight:700,color:B.textSm,textTransform:"uppercase",letterSpacing:".08em",padding:"6px 10px 10px"}}>Menu</div>
          {NAV.map(({k,i,l})=>{
            const isA=active===k||(k==="courses"&&active==="course-detail");
            return(
              <button key={k} onClick={()=>{onNav(k);onClose();}}
                style={{display:"flex",alignItems:"center",gap:12,width:"100%",padding:"11px 14px",borderRadius:12,border:"none",cursor:"pointer",background:isA?"rgba(99,102,241,.18)":"transparent",color:isA?"#A5B4FC":B.textMd,fontWeight:isA?700:500,fontSize:13,marginBottom:3,fontFamily:"inherit",transition:"all .15s",textAlign:"left"}}>
                <Ic n={i} size={17}/>
                <span>{l}</span>
                {isA&&<div style={{marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:"#6366F1"}}/>}
              </button>
            );
          })}

          {courses.length>0&&(
            <>
              <div style={{fontSize:10,fontWeight:700,color:B.textSm,textTransform:"uppercase",letterSpacing:".08em",padding:"18px 10px 10px"}}>My Courses</div>
              {courses.map(c=>{const col=PAL[c.color_tag]||PAL.Blue;return(
                <button key={c.id} onClick={()=>{onSelect(c);onClose();}}
                  style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"8px 12px",borderRadius:10,border:"none",cursor:"pointer",background:"transparent",color:B.textMd,fontSize:12,fontWeight:500,marginBottom:2,fontFamily:"inherit",textAlign:"left",transition:"background .12s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=B.glass}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:col.accent,flexShrink:0}}/>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.course_code}</span>
                  <span style={{fontSize:10,color:B.textSm,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginLeft:4}}>· {c.course_name.slice(0,20)}</span>
                </button>
              );})}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"14px 16px",borderTop:`1px solid ${B.border}`,fontSize:11,color:B.textSm,textAlign:"center"}}>
          Your data is private · Secured with RLS
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOP BAR — hamburger menu + current page title
───────────────────────────────────────────────────────────────────────────── */
function TopBar({view,onOpenSidebar}){
  const TITLES={dashboard:"Dashboard",courses:"Courses",notes:"Notes",calendar:"Calendar",timetable:"Timetable","course-detail":"Course Detail",profile:"Profile"};
  return(
    <div style={{height:60,background:B.surface,borderBottom:`1px solid ${B.border}`,display:"flex",alignItems:"center",paddingLeft:16,paddingRight:24,gap:14,flexShrink:0,position:"sticky",top:0,zIndex:50}}>
      <button onClick={onOpenSidebar}
        style={{width:38,height:38,borderRadius:10,background:B.glass,border:`1px solid ${B.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:B.text,flexShrink:0,transition:"all .15s"}}
        onMouseEnter={e=>e.currentTarget.style.background=B.glassB}
        onMouseLeave={e=>e.currentTarget.style.background=B.glass}>
        <Ic n="menu" size={18}/>
      </button>
      <div style={{flex:1}}>
        <span style={{fontSize:15,fontWeight:800,color:B.text,fontFamily:"'Lora',serif"}}>{TITLES[view]||"StudyDesk"}</span>
      </div>
      <div style={{fontSize:12,color:B.textSm,fontWeight:600,fontFamily:"'Lora',serif",background:"linear-gradient(135deg,#F59E0B,#EF4444)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
        StudyDesk
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ROOT EXPORT
───────────────────────────────────────────────────────────────────────────── */
export default function StudyDesk({session,onSignOut}){
  const [view,      setView]      = useState("dashboard");
  const [selCourse, setSelCourse] = useState(null);
  const [sideOpen,  setSideOpen]  = useState(false);

  const {rows:courses,     loading:lC, reload:rC} = useTable("courses");
  const {rows:notes,       loading:lN, reload:rN} = useTable("notes","updated_at");
  const {rows:deadlines,   loading:lD, reload:rD} = useTable("deadlines");
  const {rows:quizzes,     loading:lQ, reload:rQ} = useTable("quizzes","date_time");
  const {rows:assessments, loading:lA, reload:rA} = useTable("assessments");
  const {rows:assignments, loading:lX, reload:rX} = useTable("assignments");
  const {rows:slots,       loading:lS, reload:rS} = useTable("timetable_slots","start_time");

  const loading=lC||lN||lD||lQ||lA||lX||lS;

  const reloadAll=useCallback(async()=>{
    await Promise.all([rC(),rN(),rD(),rQ(),rA(),rX(),rS()]);
  },[]);

  const nav=v=>{setView(v);if(v!=="course-detail")setSelCourse(null);};
  const selectCourse=c=>{setSelCourse(c);setView("course-detail");};

  const renderMain=()=>{
    if(loading)return <Skeleton/>;
    switch(view){
      case "dashboard":
        return <Dashboard courses={courses} deadlines={deadlines} quizzes={quizzes} assessments={assessments} assignments={assignments} slots={slots} user={session?.user} onNav={nav} onSelectCourse={selectCourse}/>;
      case "courses":
        return <CoursesPage courses={courses} reload={rC} onSelect={selectCourse}/>;
      case "course-detail":
        if(!selCourse){nav("courses");return null;}
        const fresh=courses.find(c=>c.id===selCourse.id)||selCourse;
        return <CourseDetail course={fresh} notes={notes} deadlines={deadlines} quizzes={quizzes} assessments={assessments} assignments={assignments} reloadAll={reloadAll} onBack={()=>nav("courses")}/>;
      case "notes":
        return <NotesPage notes={notes} courses={courses} reload={rN}/>;
      case "calendar":
        return <CalendarPage courses={courses} deadlines={deadlines} quizzes={quizzes} assessments={assessments} assignments={assignments} reloadAll={reloadAll}/>;
      case "timetable":
        return <TimetablePage courses={courses} slots={slots} reloadSlots={rS}/>;
      case "profile":
        return <ProfilePage session={session} onSignOut={onSignOut}/>;
      default: return null;
    }
  };

  return(
    <>
      <style>{G}</style>
      <div style={{display:"flex",flexDirection:"column",height:"100vh",background:B.bg,overflow:"hidden"}}>
        {/* Top bar */}
        <TopBar view={view} onOpenSidebar={()=>setSideOpen(true)}/>

        {/* Slide-in sidebar */}
        <Sidebar
          active={view} onNav={nav}
          courses={courses} onSelect={selectCourse}
          open={sideOpen} onClose={()=>setSideOpen(false)}
        />

        {/* Main content */}
        <main style={{flex:1,overflowY:"auto",padding:"28px 32px 48px",background:B.bg}}>
          {renderMain()}
        </main>
      </div>
    </>
  );
}
