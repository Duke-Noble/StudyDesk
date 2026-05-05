// src/Login.jsx
// ─────────────────────────────────────────────────────────────────
//  Authentication screen for StudyDesk.
//  Handles: Sign Up, Sign In, and Password Reset.
//  Uses Supabase Auth (email + password).
//  On successful sign-in the parent component (main.jsx / App.jsx
//  wrapper) will receive the session via onAuthStateChange and
//  render <StudyDesk /> instead of <Login />.
// ─────────────────────────────────────────────────────────────────
import { useState } from "react";
import { supabase } from "./supabaseClient";

/* ── Palette (matches StudyDesk) ── */
const C = {
  navy:    "#1E3A5F",
  blue:    "#2563EB",
  blueLt:  "#EFF6FF",
  border:  "#E2E8F0",
  muted:   "#64748B",
  error:   "#DC2626",
  errorBg: "#FEF2F2",
  success: "#15803D",
  successBg:"#F0FDF4",
  white:   "#ffffff",
  bg:      "#F0F4F8",
};

const GLOBAL = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Lora:ital,wght@0,600;1,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
  html, body, #root { height:100%; }
  body { font-family:'Plus Jakarta Sans',sans-serif; background:${C.bg}; color:#1a2332; }
  input, button { font-family:inherit; }
  .ld-fade { animation: ldFade 0.35s ease both; }
  @keyframes ldFade { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
`;

/* ── Tiny shared components ── */
function Label({ children, required }) {
  return (
    <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:"block",
      marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>
      {children}{required && <span style={{ color:C.error }}> *</span>}
    </label>
  );
}

function Field({ label, type="text", value, onChange, placeholder, required, autoComplete }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom:16 }}>
      <Label required={required}>{label}</Label>
      <input
        type={type} value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={()  => setFocused(false)}
        style={{
          width:"100%", padding:"10px 13px", borderRadius:10,
          border:`1.5px solid ${focused ? C.blue : C.border}`,
          fontSize:14, color:"#1a2332", background:C.white, outline:"none",
          transition:"border 0.15s",
        }}
      />
    </div>
  );
}

function Btn({ children, onClick, disabled, variant="primary", type="button", loading }) {
  const styles = {
    primary:   { background: C.navy,    color:"#fff",   border:"none" },
    secondary: { background: C.blueLt,  color: C.navy,  border:`1px solid #BFDBFE` },
    ghost:     { background: "transparent", color: C.muted, border:"none" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      style={{
        ...styles[variant], width:"100%", padding:"11px", borderRadius:10,
        fontSize:14, fontWeight:700, cursor: disabled||loading ? "not-allowed":"pointer",
        opacity: disabled||loading ? 0.6 : 1,
        display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        transition:"filter 0.15s",
      }}
      onMouseEnter={e => { if (!disabled && !loading) e.currentTarget.style.filter="brightness(0.92)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter=""; }}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5}
      style={{ animation:"spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
    </svg>
  );
}

function Alert({ type, children }) {
  const isErr = type === "error";
  return (
    <div style={{
      padding:"10px 14px", borderRadius:9, marginBottom:16,
      background: isErr ? C.errorBg : C.successBg,
      border: `1px solid ${isErr ? "#FECACA" : "#BBF7D0"}`,
      color: isErr ? C.error : C.success,
      fontSize:13, fontWeight:500, lineHeight:1.5,
    }}>
      {children}
    </div>
  );
}

/* ── Divider ── */
function Or() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, margin:"18px 0" }}>
      <div style={{ flex:1, height:1, background: C.border }} />
      <span style={{ fontSize:12, color: C.muted, fontWeight:500 }}>or</span>
      <div style={{ flex:1, height:1, background: C.border }} />
    </div>
  );
}

/* ── Views ── */
// 1. SIGN IN
function SignIn({ onSwitch }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleSignIn = async () => {
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError(err.message);
    // On success, the onAuthStateChange listener in the parent will fire
    // and replace <Login /> with <StudyDesk />.
  };

  return (
    <div className="ld-fade">
      <h2 style={{ fontSize:22, fontWeight:800, color:"#1a2332", marginBottom:6,
        fontFamily:"'Lora',serif" }}>Welcome back</h2>
      <p style={{ fontSize:13, color:C.muted, marginBottom:24 }}>
        Sign in to your StudyDesk account
      </p>

      {error && <Alert type="error">{error}</Alert>}

      <Field label="Email" type="email" value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="you@ucc.edu.gh" required autoComplete="email"/>

      <Field label="Password" type="password" value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="••••••••" required autoComplete="current-password"/>

      <div style={{ textAlign:"right", marginBottom:18, marginTop:-8 }}>
        <button onClick={() => onSwitch("reset")}
          style={{ background:"none", border:"none", cursor:"pointer",
            fontSize:12, color:C.blue, fontWeight:600 }}>
          Forgot password?
        </button>
      </div>

      <Btn onClick={handleSignIn} loading={loading}>
        {!loading && "Sign In →"}
      </Btn>

      <Or />

      <Btn variant="secondary" onClick={() => onSwitch("signup")}>
        Create an account
      </Btn>
    </div>
  );
}

// 2. SIGN UP
function SignUp({ onSwitch }) {
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [studentId, setStudentId] = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState(false);

  const handleSignUp = async () => {
    if (!firstName || !lastName || !email || !password) {
      setError("First name, last name, email and password are required."); return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters."); return;
    }
    if (password !== confirm) {
      setError("Passwords do not match."); return;
    }

    setLoading(true); setError("");

    // Supabase sign-up — extra profile fields go into `data` (user_metadata)
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, student_id: studentId },
      },
    });

    setLoading(false);
    if (err) { setError(err.message); return; }
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="ld-fade">
        <div style={{ textAlign:"center", padding:"24px 0" }}>
          <div style={{ fontSize:48, marginBottom:14 }}>📬</div>
          <h2 style={{ fontSize:20, fontWeight:800, color:"#1a2332", marginBottom:8,
            fontFamily:"'Lora',serif" }}>Check your inbox</h2>
          <p style={{ fontSize:13, color:C.muted, lineHeight:1.6, marginBottom:24 }}>
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account, then sign in.
          </p>
          <Btn onClick={() => onSwitch("signin")}>Back to Sign In</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="ld-fade">
      <h2 style={{ fontSize:22, fontWeight:800, color:"#1a2332", marginBottom:6,
        fontFamily:"'Lora',serif" }}>Create your account</h2>
      <p style={{ fontSize:13, color:C.muted, marginBottom:24 }}>
        Free forever · No credit card required
      </p>

      {error && <Alert type="error">{error}</Alert>}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
        <Field label="First Name" value={firstName} onChange={e=>setFirstName(e.target.value)}
          placeholder="Ama" required/>
        <Field label="Last Name" value={lastName} onChange={e=>setLastName(e.target.value)}
          placeholder="Mensah" required/>
      </div>

      <Field label="Student ID" value={studentId} onChange={e=>setStudentId(e.target.value)}
        placeholder="EH/GOV/25/0014" autoComplete="off"/>

      <Field label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)}
        placeholder="you@ucc.edu.gh" required autoComplete="email"/>

      <Field label="Password (min 8 chars)" type="password" value={password}
        onChange={e=>setPassword(e.target.value)}
        placeholder="••••••••" required autoComplete="new-password"/>

      <Field label="Confirm Password" type="password" value={confirm}
        onChange={e=>setConfirm(e.target.value)}
        placeholder="••••••••" required autoComplete="new-password"/>

      <Btn onClick={handleSignUp} loading={loading}>
        {!loading && "Create Account →"}
      </Btn>

      <Or />

      <Btn variant="secondary" onClick={() => onSwitch("signin")}>
        Already have an account? Sign in
      </Btn>
    </div>
  );
}

// 3. PASSWORD RESET
function ResetPassword({ onSwitch }) {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [sent,    setSent]    = useState(false);

  const handleReset = async () => {
    if (!email) { setError("Please enter your email address."); return; }
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      // After clicking the email link Supabase redirects here:
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="ld-fade">
        <div style={{ textAlign:"center", padding:"24px 0" }}>
          <div style={{ fontSize:48, marginBottom:14 }}>🔑</div>
          <h2 style={{ fontSize:20, fontWeight:800, color:"#1a2332", marginBottom:8,
            fontFamily:"'Lora',serif" }}>Reset link sent</h2>
          <p style={{ fontSize:13, color:C.muted, lineHeight:1.6, marginBottom:24 }}>
            Check <strong>{email}</strong> for a password-reset link.
          </p>
          <Btn onClick={() => onSwitch("signin")}>Back to Sign In</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="ld-fade">
      <button onClick={() => onSwitch("signin")}
        style={{ background:"none", border:"none", cursor:"pointer",
          fontSize:13, color:C.muted, fontWeight:600, marginBottom:20,
          display:"flex", alignItems:"center", gap:4, padding:0 }}>
        ← Back to Sign In
      </button>

      <h2 style={{ fontSize:22, fontWeight:800, color:"#1a2332", marginBottom:6,
        fontFamily:"'Lora',serif" }}>Reset your password</h2>
      <p style={{ fontSize:13, color:C.muted, marginBottom:24 }}>
        Enter your email and we'll send you a reset link.
      </p>

      {error && <Alert type="error">{error}</Alert>}

      <Field label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)}
        placeholder="you@ucc.edu.gh" required autoComplete="email"/>

      <Btn onClick={handleReset} loading={loading}>
        {!loading && "Send Reset Link →"}
      </Btn>
    </div>
  );
}

/* ── Root Login component ── */
export default function Login() {
  const [view, setView] = useState("signin"); // "signin" | "signup" | "reset"

  return (
    <>
      <style>{GLOBAL}</style>

      <div style={{
        minHeight:"100vh", display:"flex", alignItems:"center",
        justifyContent:"center", padding:16,
        background:`linear-gradient(145deg, #EFF6FF 0%, #F0F4F8 50%, #FAF5FF 100%)`,
      }}>
        <div style={{ width:"100%", maxWidth:480 }}>

          {/* Brand header */}
          <div style={{ textAlign:"center", marginBottom:32 }}>
            <div style={{
              width:56, height:56, borderRadius:16,
              background:`linear-gradient(135deg, ${C.navy}, ${C.blue})`,
              display:"flex", alignItems:"center", justifyContent:"center",
              margin:"0 auto 14px", boxShadow:"0 8px 24px rgba(30,58,95,0.3)",
            }}>
              <span style={{ fontSize:26 }}>📚</span>
            </div>
            <div style={{ fontFamily:"'Lora',serif", fontSize:26, fontWeight:600,
              color: C.navy, letterSpacing:"-0.5px" }}>StudyDesk</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:3, fontWeight:500 }}>
              University of Cape Coast · Student Planner
            </div>
          </div>

          {/* Card */}
          <div style={{
            background: C.white, borderRadius:20,
            border:"1px solid #E2E8F0",
            boxShadow:"0 4px 32px rgba(0,0,0,0.08)",
            padding:"32px 36px",
          }}>
            {view === "signin"  && <SignIn    onSwitch={setView} />}
            {view === "signup"  && <SignUp    onSwitch={setView} />}
            {view === "reset"   && <ResetPassword onSwitch={setView} />}
          </div>

          <p style={{ textAlign:"center", fontSize:12, color:C.muted, marginTop:20 }}>
            Your data is private and secured with Row Level Security.
          </p>
        </div>
      </div>
    </>
  );
}
