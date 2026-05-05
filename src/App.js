// src/App.js
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import StudyDesk from './StudyDesk';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    // Get the current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for sign-in / sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // Still loading initial session
  if (session === undefined) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#F0F4F8',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        fontSize: 14, color: '#64748B'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid #E2E8F0',
            borderTopColor: '#1E3A5F', borderRadius: '50%',
            animation: 'spin .8s linear infinite', margin: '0 auto 12px'
          }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Loading StudyDesk…
        </div>
      </div>
    );
  }

  // Not signed in → show Login
  if (!session) {
    return <Login />;
  }

  // Signed in → show the full app
  return <StudyDesk session={session} onSignOut={handleSignOut} />;
}
