import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../auth/supabaseClient';
import ScreenRecorder from './ScreenRecorder';
import Header from '../Header';
import RecordingPanel from './RecordingPanel';

// --- Dark mode hook ---
const useDarkMode = () => {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return dark;
};

const UserDashboard: React.FC = () => {
  const { user } = useAuth();
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const darkMode = useDarkMode();

  // Palette for dark/light mode
  const palette = darkMode
    ? {
        bg: '#181a20',
        card: '#23262f',
        border: '#33384a',
        text: '#e6e6e6',
        textSecondary: '#b0b0b0',
        accent: '#1976d2',
        accent2: '#28a745',
        accent3: '#e53935',
        accent4: '#d81b60',
        accent5: '#2d3a4a',
        accent6: '#3a2d4a',
        inputBg: '#23262f',
        inputText: '#e6e6e6',
        inputBorder: '#33384a',
        shadow: '0 2px 12px #0008',
        error: '#e53935',
        success: '#28a745'
      }
    : {
        bg: '#f7f8fa',
        card: '#fff',
        border: '#eee',
        text: '#222',
        textSecondary: '#888',
        accent: '#1976d2',
        accent2: '#28a745',
        accent3: '#e53935',
        accent4: '#d81b60',
        accent5: '#e3f2fd',
        accent6: '#fce4ec',
        inputBg: '#fff',
        inputText: '#222',
        inputBorder: '#ccc',
        shadow: '0 2px 8px #0001',
        error: '#e53935',
        success: '#28a745'
      };

  useEffect(() => {
    if (liveVideoRef.current && liveStream) {
      liveVideoRef.current.srcObject = liveStream;
      liveVideoRef.current.play().catch(() => {});
    }
    if (!recording && liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
  }, [liveStream, recording]);

  useEffect(() => {
    const stopHandler = () => {
      setRecording(false);
      setLiveStream(null);
      window.dispatchEvent(new CustomEvent('sparky-recording-visibility', { detail: false }));
    };
    window.addEventListener('sparky-stop-recording', stopHandler);
    return () => window.removeEventListener('sparky-stop-recording', stopHandler);
  }, []);

  useEffect(() => {
    const fetchDisplayName = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;
      await supabase.from('profiles').select('display_name').eq('id', userId).single();
    };
    fetchDisplayName();
  }, [user]);

  // Warn user before leaving if recording or liveStream is active
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (recording || liveStream) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [recording, liveStream]);

  const handleStartLiveScreen = (stream: MediaStream) => {
    setLiveStream(stream);
    setRecording(true);
    setRecordedVideoUrl(null);
    window.dispatchEvent(new CustomEvent('sparky-recording-visibility', { detail: true }));
  };

  const handleSetRecordedVideoUrl = (url: string | null) => {
    setRecordedVideoUrl(url);
    if (url) {
      window.dispatchEvent(new CustomEvent('sparky-auto-select-recording', { detail: url }));
    }
  };

  return (
    <>
      <Header />
      <main
        style={{
          width: '100%',
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: 32,
          position: 'relative',
          minHeight: '100vh',
          background: palette.bg,
          fontSize: 12,
          color: palette.text,
          transition: 'background 0.2s, color 0.2s'
        }}
      >
        <div style={{ height: 64 }} />
        <h2
          style={{
            margin: 0,
            fontSize: 32,
            textAlign: 'center',
            fontWeight: 700,
            marginBottom: 32,
            color: palette.text
          }}
        >
          Recording Dashboard
        </h2>
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            background: palette.card,
            borderRadius: 10,
            boxShadow: palette.shadow,
            border: `1px solid ${palette.border}`,
            padding: 24,
            marginBottom: 32,
            transition: 'background 0.2s, color 0.2s'
          }}
        >
          <div style={{ width: '100%', maxWidth: 600 }}>
            <RecordingPanel setRecordedVideoUrl={handleSetRecordedVideoUrl} onStartLiveScreen={handleStartLiveScreen} />
          </div>
        </div>
        <div
          style={{
            width: '100%',
            background: palette.card,
            borderRadius: 10,
            boxShadow: palette.shadow,
            border: `1px solid ${palette.border}`,
            padding: 24,
            marginBottom: 32,
            transition: 'background 0.2s, color 0.2s'
          }}
        >
          <ScreenRecorder recordedVideoUrl={recordedVideoUrl} />
        </div>
      </main>
    </>
  );
};

export default UserDashboard;