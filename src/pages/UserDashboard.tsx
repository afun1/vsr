import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../auth/supabaseClient';
import ScreenRecorder from './ScreenRecorder';
import Header from '../Header';
import RecordingPanel from './RecordingPanel';

const UserDashboard: React.FC = () => {
  const { user } = useAuth();
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [errorPopup, setErrorPopup] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

  useEffect(() => {
    if (liveVideoRef.current && liveStream) {
      liveVideoRef.current.srcObject = liveStream;
      liveVideoRef.current.play().catch(() => {});
    }
    if (!recording && liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
  }, [liveStream, recording]);

  // Listen for stop event from header
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
      console.log('[UserDashboard] userId:', userId);
      if (!userId) return;
      const { data, error } = await supabase.from('profiles').select('display_name').eq('id', userId).single();
      console.log('[UserDashboard] profile fetch result:', data, 'error:', error);
      setDisplayName(data?.display_name || '');
    };
    fetchDisplayName();
  }, [user]);

  // Debug log to print the result of supabase.auth.getUser()
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      console.log('[DEBUG] supabase.auth.getUser()', data);
    });
  }, []);

  // Handler to start recording and show the live screen in workspace
  const handleStartLiveScreen = (stream: MediaStream) => {
    setLiveStream(stream);
    setRecording(true);
    setRecordedVideoUrl(null); // Clear preview when starting a new recording
    window.dispatchEvent(new CustomEvent('sparky-recording-visibility', { detail: true }));
  };

  // --- PiP support: hidden video for PiP ---
  useEffect(() => {
    const pipHandler = () => {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      } else if (pipVideoRef.current && document.pictureInPictureEnabled) {
        pipVideoRef.current.requestPictureInPicture().catch(() => {});
      }
    };
    window.addEventListener('sparky-pip-toggle', pipHandler);
    return () => window.removeEventListener('sparky-pip-toggle', pipHandler);
  }, []);
  useEffect(() => {
    if (pipVideoRef.current && liveStream && recording) {
      pipVideoRef.current.srcObject = liveStream;
      pipVideoRef.current.play().catch(() => {});
    }
    if ((!recording || !liveStream) && pipVideoRef.current) {
      pipVideoRef.current.srcObject = null;
    }
  }, [liveStream, recording]);

  // Handler to set the recorded video URL and auto-select the new recording in ScreenRecorder
  const handleSetRecordedVideoUrl = (url: string | null) => {
    console.log('setRecordedVideoUrl called with:', url);
    setRecordedVideoUrl(url);
    // Dispatch a custom event to ScreenRecorder to auto-select the new recording
    if (url) {
      window.dispatchEvent(new CustomEvent('sparky-auto-select-recording', { detail: url }));
    }
  };

  return (
    <>
      <Header />
      {/* Hidden video for PiP support, always available during recording */}
      {recording && liveStream && (
        <video
          ref={pipVideoRef}
          style={{ display: 'none' }}
          autoPlay
          playsInline
          muted
        />
      )}
      <main style={{ width: '100%', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: 32, position: 'relative', minHeight: '100vh', background: '#f7f8fa', fontSize: 12 }}>
        <div style={{ height: 64 }} /> {/* Spacer for header */}
        <h2 style={{ margin: 0, fontSize: 32, textAlign: 'center', fontWeight: 700, marginBottom: 32 }}>User Dashboard</h2>
        {displayName && (
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Welcome, {displayName}!</div>
        )}
        {/* New Recording Panel (always visible) */}
        <RecordingPanel setRecordedVideoUrl={handleSetRecordedVideoUrl} onStartLiveScreen={handleStartLiveScreen} />
        {/* Recording Preview and List */}
        <ScreenRecorder recordedVideoUrl={recordedVideoUrl} />
        {/* Remove local preview video here to avoid double preview and confusion */}
      </main>
      {errorPopup.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#0008', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 340, maxWidth: 600, boxShadow: '0 2px 16px #0003', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Error</div>
            <textarea
              value={errorPopup.message}
              readOnly
              style={{ width: '100%', minHeight: 120, fontSize: 14, marginBottom: 12, fontFamily: 'monospace', resize: 'vertical' }}
              onFocus={e => e.target.select()}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(errorPopup.message);
                }}
                style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 18px', fontWeight: 600 }}
              >Copy</button>
              <button
                onClick={() => setErrorPopup({ open: false, message: '' })}
                style={{ background: '#888', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 18px', fontWeight: 600 }}
              >Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UserDashboard;
