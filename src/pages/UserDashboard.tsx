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
      <main style={{
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
        background: '#f7f8fa',
        fontSize: 12
      }}>
        <div style={{ height: 64 }} />
        <h2 style={{
          margin: 0,
          fontSize: 32,
          textAlign: 'center',
          fontWeight: 700,
          marginBottom: 32
        }}>
          Recording Dashboard
        </h2>
        <RecordingPanel setRecordedVideoUrl={handleSetRecordedVideoUrl} onStartLiveScreen={handleStartLiveScreen} />
        <ScreenRecorder recordedVideoUrl={recordedVideoUrl} />
      </main>
    </>
  );
};

export default UserDashboard;