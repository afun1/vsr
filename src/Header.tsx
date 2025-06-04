import React, { useEffect, useState } from 'react';
import { supabase } from './auth/supabaseClient';
import { useAuth } from './auth/AuthContext';

const Header: React.FC = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    // Listen for custom event from ScreenRecorder
    const handler = () => {
      // setShowRecordingScreen(!!e.detail); // Removed unused
    };
    window.addEventListener('sparky-recording-visibility', handler);
    return () => window.removeEventListener('sparky-recording-visibility', handler);
  }, []);

  useEffect(() => {
    const fetchDisplayName = async () => {
      // Always get the real user id from Supabase
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      const userEmail = userData?.user?.email;
      if (!userId && !userEmail) { setDisplayName(''); return; }
      // Prefer lookup by id, fallback to email
      let { data } = await supabase.from('profiles').select('display_name').or(`id.eq.${userId},email.eq.${userEmail}`).single();
      setDisplayName(data?.display_name || userEmail || userId || 'User');
    };
    fetchDisplayName();
  }, [user]);

  useEffect(() => {
    const handler = (e: any) => {
      setIsRecording(!!(e && e.detail));
    };
    window.addEventListener('sparky-recording-visibility', handler);
    return () => window.removeEventListener('sparky-recording-visibility', handler);
  }, []);

  return (
    <header style={{
      width: '100%',
      background: '#fff',
      boxShadow: '0 2px 8px #0001',
      padding: '0 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 64,
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 100
    }}>
      {/* Left column (logo or nav) */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', height: '100%' }}>
        <div style={{ fontWeight: 700, fontSize: 22, color: '#1976d2', letterSpacing: '-1px' }}>
          Sparky Recorder
        </div>
        <div style={{ fontSize: 17, color: '#444', fontWeight: 500, marginLeft: 18 }}>Welcome,{' '}
          <span style={{
            fontSize: 17,
            color: '#1976d2',
            fontWeight: 700,
            background: 'transparent',
            borderRadius: 0,
            padding: 0,
            minWidth: 0,
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginLeft: 0
          }}>{displayName || user || 'User'}</span>
        </div>
      </div>
      {/* Center column (Stop and PiP buttons) */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        {isRecording && (
          <>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('sparky-stop-recording'))}
              style={{ background: '#dc3545', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 6, padding: '8px 24px', fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 8px #dc354522' }}
            >
              Stop
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('sparky-pip-toggle'))}
              style={{ background: '#007bff', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 6, padding: '8px 24px', fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 8px #007bff22' }}
            >
              PiP
            </button>
          </>
        )}
      </div>
      {/* Right column (user/profile/logout) */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
        <a href="http://localhost:5175/user" style={{ color: '#1976d2', fontWeight: 600, fontSize: 16, textDecoration: 'none', marginRight: 8 }}>Home</a>
        <a href="/search-export" style={{ color: '#1976d2', fontWeight: 600, fontSize: 16, textDecoration: 'none', marginRight: 8 }}>Search</a>
        <a href="/search-export" style={{ color: '#1976d2', fontWeight: 600, fontSize: 16, textDecoration: 'none', marginRight: 8 }}>Export</a>
        <button
          onClick={() => { if (window.confirm('Log out?')) { localStorage.clear(); window.location.href = '/login'; } }}
          style={{ background: 'none', border: 'none', color: '#e53935', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginLeft: 8, marginRight: 20 }}
        >
          Log Out
        </button>
      </div>
    </header>
  );
};

export default Header;
