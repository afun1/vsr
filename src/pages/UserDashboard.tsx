import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../auth/supabaseClient';
import ScreenRecorder from './ScreenRecorder';
import Header from '../Header';
import RecordingPanel from './RecordingPanel';
import Comments from '../components/comments'; // <-- Import Comments

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

interface Recording {
  id: string;
  video_url: string;
  transcript: string;
  created_at: string;
  // Add other fields as needed
}

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

  // --- Recordings state ---
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(true);

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

  // Fetch user's recordings
  useEffect(() => {
    const fetchRecordings = async () => {
      setLoadingRecordings(true);
      if (!user?.id) {
        setRecordings([]);
        setLoadingRecordings(false);
        return;
      }
      const { data, error } = await supabase
        .from('recordings')
        .select('id, video_url, transcript, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setRecordings(data || []);
      setLoadingRecordings(false);
    };
    fetchRecordings();
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

  // --- Patch: disable unsaved changes warning after Save Details ---
  // This callback will be passed to RecordingPanel and called after save
  const handleSetRecordedVideoUrl = useCallback((url: string | null) => {
    setRecordedVideoUrl(url);
    if (url) {
      setRecording(false);
      setLiveStream(null);
      window.dispatchEvent(new CustomEvent('sparky-auto-select-recording', { detail: url }));
    }
  }, []);

  const handleStartLiveScreen = (stream: MediaStream) => {
    setLiveStream(stream);
    setRecording(true);
    setRecordedVideoUrl(null);
    window.dispatchEvent(new CustomEvent('sparky-recording-visibility', { detail: true }));
  };

  // Helper to truncate text to 2 lines (approx)
  const truncateLines = (text: string, maxLines = 2) => {
    if (!text) return '';
    const lines = text.split('\n').filter(l => l.trim() !== '');
    if (lines.length > maxLines) {
      return lines.slice(0, maxLines).join('\n') + '...';
    }
    if (lines.length === 1) {
      const words = text.split(' ');
      if (words.length > 20) return words.slice(0, 20).join(' ') + '...';
    }
    return text;
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
        {/* User's Recordings List */}
        <div style={{ width: '100%', maxWidth: 700 }}>
          <h3 style={{ color: palette.text, marginBottom: 16 }}>Your Recordings</h3>
          {loadingRecordings ? (
            <div style={{ color: palette.textSecondary }}>Loading...</div>
          ) : recordings.length === 0 ? (
            <div style={{ color: palette.textSecondary }}>No recordings found.</div>
          ) : (
            recordings.map(rec => (
              <div
                key={rec.id}
                style={{
                  background: palette.card,
                  border: `1px solid ${palette.border}`,
                  borderRadius: 8,
                  boxShadow: palette.shadow,
                  marginBottom: 24,
                  padding: 20,
                  color: palette.text
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <strong>Created:</strong> {rec.created_at ? new Date(rec.created_at).toLocaleString() : '-'}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Transcript:</strong>
                  <div
                    style={{
                      marginTop: 4,
                      background: palette.inputBg,
                      color: palette.inputText,
                      borderRadius: 4,
                      padding: 8,
                      fontSize: 14,
                      whiteSpace: 'pre-wrap',
                      maxHeight: 48,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    {truncateLines(rec.transcript, 2)}
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Comments:</strong>
                  <div
                    style={{
                      marginTop: 4,
                      background: palette.inputBg,
                      color: palette.inputText,
                      borderRadius: 4,
                      padding: 8,
                      fontSize: 14,
                      whiteSpace: 'pre-wrap',
                      maxHeight: 48,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    <Comments recordingId={rec.id} userId={user?.id || ''} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </>
  );
};

export default UserDashboard;