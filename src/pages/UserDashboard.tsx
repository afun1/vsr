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
  const [recordings, setRecordings] = useState<any[]>([]);
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);

  // Debug logs
  console.log('USER:', user);
  console.log('RECORDINGS ARRAY:', recordings);

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
      const { data } = await supabase.from('profiles').select('display_name').eq('id', userId).single();
      setDisplayName(data?.display_name || '');
    };
    fetchDisplayName();
  }, [user]);

  // Fetch user's recordings
  useEffect(() => {
    const fetchRecordings = async () => {
      const { data } = await supabase
        .from('recordings')
        .select('id, video_url, transcript, created_at')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      if (data) setRecordings(data);
    };
    if (user?.id) fetchRecordings();
  }, [user, transcribingId]);

  const handleStartLiveScreen = (stream: MediaStream) => {
    setLiveStream(stream);
    setRecording(true);
    setRecordedVideoUrl(null);
    window.dispatchEvent(new CustomEvent('sparky-recording-visibility', { detail: true }));
  };

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

  const handleSetRecordedVideoUrl = (url: string | null) => {
    setRecordedVideoUrl(url);
    if (url) {
      window.dispatchEvent(new CustomEvent('sparky-auto-select-recording', { detail: url }));
    }
  };

  async function transcribeRecording(id: string) {
    setTranscribingId(id);
    await fetch('/api/transcribe', {
      method: 'POST',
      body: JSON.stringify({ id }),
      headers: { 'Content-Type': 'application/json' }
    });
    alert('Transcription started!');
    setTimeout(() => setTranscribingId(null), 2000);
  }

  // Helper to truncate transcript for preview
  function truncate(text: string, max: number) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  // Show Transcribe button if transcript is missing, empty, or "Empty"
  function shouldShowTranscribeButton(transcript: string | null | undefined) {
    return !transcript || transcript.trim() === '' || transcript === 'Empty';
  }

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
        <h2 style={{ margin: 0, fontSize: 32, textAlign: 'center', fontWeight: 700, marginBottom: 32 }}>
          Recording Dashboard
        </h2>
        <RecordingPanel setRecordedVideoUrl={handleSetRecordedVideoUrl} onStartLiveScreen={handleStartLiveScreen} />
        <ScreenRecorder recordedVideoUrl={recordedVideoUrl} />

        {/* User's Recordings Cards */}
        {recordings.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#888', padding: 16 }}>No recordings found.</div>
        ) : (
          recordings.map(r => {
            // Debug: show the full recording object on the card
            return (
              <div key={r.id} style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', marginBottom: 24, padding: 20, width: '100%', maxWidth: 700 }}>
                <pre style={{ background: '#eee', fontSize: 12, padding: 8, borderRadius: 4, marginBottom: 8 }}>
                  {JSON.stringify(r, null, 2)}
                </pre>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
                  {r.created_at ? new Date(r.created_at).toLocaleString() : '-'}
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  {r.video_url && (
                    <>
                      <button
                        onClick={() => window.open(r.video_url, '_blank')}
                        style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600 }}
                      >
                        Play
                      </button>
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          await navigator.clipboard.writeText(r.video_url);
                          setCopiedUrlId(r.id);
                          setTimeout(() => setCopiedUrlId(null), 1200);
                        }}
                        style={{ color: '#1976d2', background: 'none', border: 'none', textDecoration: 'underline', fontSize: 14, cursor: 'pointer', position: 'relative' }}
                      >
                        {copiedUrlId === r.id ? 'Copied!' : 'Get URL'}
                      </button>
                      <a
                        href={r.video_url}
                        download
                        style={{ background: '#888', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600, textDecoration: 'none' }}
                      >
                        Download
                      </a>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {shouldShowTranscribeButton(r.transcript) ? (
                    <button
                      onClick={async () => await transcribeRecording(r.id)}
                      style={{
                        background: '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '6px 14px',
                        fontWeight: 600,
                        minWidth: 120,
                        transition: 'background 0.2s'
                      }}
                      disabled={transcribingId === r.id}
                    >
                      {transcribingId === r.id ? 'Transcribing...' : 'Transcribe'}
                    </button>
                  ) : (
                    <span style={{ color: '#444', fontSize: 14, background: '#f5f5f5', borderRadius: 4, padding: '4px 10px', maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {truncate(r.transcript, 60)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>
    </>
  );
};

export default UserDashboard;