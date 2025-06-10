import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../auth/supabaseClient';
import { useAuth } from '../auth/AuthContext';
// @ts-ignore
import FileSaver from 'file-saver';

// --- Main ScreenRecorder component (sidebar fully removed) ---
interface ScreenRecorderProps {
  recordedVideoUrl?: string | null;
}

const ScreenRecorder: React.FC<ScreenRecorderProps> = ({ recordedVideoUrl }) => {
  const { user } = useAuth();
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<any | null>(null);
  const [recording, setRecording] = useState(false);
  const [search, setSearch] = useState('');

  // --- Manual Transcribe Handler ---
  const handleManualTranscribe = async (recordingId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('trigger_github_transcribe', {
        body: { recording_id: recordingId }
      });
      if (error) {
        alert('Failed to trigger transcription: ' + error.message);
      } else {
        alert('Transcription triggered successfully!');
      }
    } catch (err: any) {
      alert('Failed to trigger transcription: ' + (err.message || err));
    }
  };

  useEffect(() => {
    if (!user) { setRecordings([]); setLoading(false); return; }
    const fetchRecordings = async () => {
      setLoading(true);
      // Get the user's id from Supabase
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) { setRecordings([]); setLoading(false); return; }
      let query = supabase
        .from('recordings')
        .select('id, user_id, video_url, created_at, client_id, clients:client_id (name, email, first_name, last_name), profiles:user_id (display_name, email)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }); // Only current user's recordings
      const { data, error } = await query;
      if (error) {
        setLoading(false);
      } else setRecordings(data || []);
      setLoading(false);
      // Auto-select and preview the latest recording if a new one was just added
      if (data && data.length > 0 && recordedVideoUrl) {
        const found = data.find((r: any) => r.video_url === recordedVideoUrl);
        if (found) setSelectedRecording(found);
      }
    };
    fetchRecordings();
  }, [user, recordedVideoUrl]);

  // Listen for auto-select event from UserDashboard
  useEffect(() => {
    const handler = (e: any) => {
      const url = e.detail;
      if (!url) return;
      // Try to find the recording with this video_url
      const found = recordings.find((r: any) => r.video_url === url);
      if (found) setSelectedRecording(found);
    };
    window.addEventListener('sparky-auto-select-recording', handler);
    return () => window.removeEventListener('sparky-auto-select-recording', handler);
  }, [recordings]);

  // Auto-select and preview the new recording if recordedVideoUrl changes
  useEffect(() => {
    if (recordedVideoUrl && recordings.length > 0) {
      const found = recordings.find((r: any) => r.video_url === recordedVideoUrl);
      if (found) setSelectedRecording(found);
    }
  }, [recordedVideoUrl, recordings]);

  // Re-fetch recordings and auto-select new recording when recordedVideoUrl changes
  useEffect(() => {
    if (!recordedVideoUrl) return;
    const fetchAndSelect = async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) { setRecordings([]); setLoading(false); return; }
      let query = supabase
        .from('recordings')
        .select('id, user_id, video_url, created_at, client_id, clients:client_id (name, email, first_name, last_name), profiles:user_id (display_name, email)') // removed joined selects
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      const { data, error } = await query;
      if (!error && data) {
        setRecordings(data);
        const found = data.find((r: any) => r.video_url === recordedVideoUrl);
        if (found) setSelectedRecording(found);
      }
      setLoading(false);
    };
    fetchAndSelect();
  }, [recordedVideoUrl]);

  // --- UI Rendering ---
  // --- Card-based layout for recordings (for dashboard) ---
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const pipHandler = () => {
      if (liveVideoRef.current && document.pictureInPictureEnabled) {
        liveVideoRef.current.requestPictureInPicture().catch(() => {});
      }
    };
    window.addEventListener('sparky-pip-toggle', pipHandler);
    return () => window.removeEventListener('sparky-pip-toggle', pipHandler);
  }, []);

  // Ref for preview video
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  // Auto-play preview when selectedRecording changes
  useEffect(() => {
    if (selectedRecording && previewVideoRef.current) {
      previewVideoRef.current.currentTime = 0;
      previewVideoRef.current.play().catch(() => {});
    }
  }, [selectedRecording]);

  // --- Filtered recordings based on search ---
  const filteredRecordings = recordings.filter(rec => {
    if (!search) return true;
    let clientArr: any[] = [];
    if (Array.isArray(rec.clients)) {
      clientArr = rec.clients;
    } else if (rec.clients) {
      clientArr = [rec.clients];
    }
    // Gather all possible client name fields (case-insensitive)
    const clientNames = clientArr.flatMap((clientObj: any) => {
      if (!clientObj) return [];
      const names: string[] = [];
      // Add all possible name fragments for robust search
      if (clientObj.first_name && clientObj.last_name) {
        names.push(`${clientObj.first_name} ${clientObj.last_name}`);
        names.push(clientObj.first_name);
        names.push(clientObj.last_name);
        names.push(...`${clientObj.first_name} ${clientObj.last_name}`.split(' '));
      }
      if (clientObj.name) {
        names.push(clientObj.name);
        names.push(...clientObj.name.split(' '));
      }
      if (clientObj.email) names.push(clientObj.email);
      return names;
    });
    // Add display name and email from profiles (recorder)
    const displayName = rec.profiles?.display_name || '';
    const displayEmail = rec.profiles?.email || '';
    // Add all fields to be searched
    const fields = [...clientNames, displayName, displayEmail].map(f => (f || '').toLowerCase());
    const searchLower = search.toLowerCase();
    return fields.some(f => f.includes(searchLower));
  });

  return (
    <div>
      {/* Search/filter input for recordings by member/client name/email */}
      <div style={{ width: 480, margin: '0 auto', marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
        <input
          type="text"
          placeholder="Search by member name, email, or recorder..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }}
        />
      </div>
      {/* Preview panel only */}
      <div style={{ width: 480, background: '#fff', borderRadius: 10, boxShadow: '0 2px 12px #0001', padding: 24, margin: '0 auto', marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h3>Recording Preview</h3>
        {selectedRecording && selectedRecording.video_url ? (
          <video
            key={selectedRecording.video_url}
            ref={previewVideoRef}
            src={selectedRecording.video_url}
            controls
            autoPlay
            style={{ width: '100%', borderRadius: 8, background: '#000' }}
          />
        ) : (
          <div style={{ width: '100%', height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', background: '#f5f5f5', borderRadius: 8 }}>
            Select a recording below to preview
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {selectedRecording && (
            <button onClick={() => setSelectedRecording(null)} style={{ background: '#007bff', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px' }}>Clear Preview</button>
          )}
        </div>
      </div>
      {/* Card grid for user's recordings */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 24, justifyContent: 'center' }}>
        {filteredRecordings.length === 0 && !loading ? (
          <div style={{ color: '#888', fontSize: 16, textAlign: 'center', margin: '32px 0' }}>No recordings to display yet.</div>
        ) : (
          filteredRecordings
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map(rec => {
              // Support both array and object for clients
              let clientArr: any[] = [];
              if (Array.isArray(rec.clients)) {
                clientArr = rec.clients;
              } else if (rec.clients) {
                clientArr = [rec.clients];
              }
              // Gather all possible client name fields for display
              const clientDisplayNames = clientArr.map((clientObj: any) => {
                if (!clientObj) return '';
                if (clientObj.first_name && clientObj.last_name) return `${clientObj.first_name} ${clientObj.last_name}`;
                if (clientObj.name) return clientObj.name;
                if (clientObj.email) return clientObj.email;
                return '';
              }).filter(Boolean);
              const displayName = rec.profiles?.display_name || '-';
              const createdAt = rec.created_at ? new Date(rec.created_at).toLocaleString() : '-';
              const isSelected = selectedRecording && selectedRecording.id === rec.id;
              return (
                <div key={rec.id} style={{ width: 240, background: isSelected ? '#e3f2fd' : '#fff', borderRadius: 10, boxShadow: isSelected ? '0 4px 16px #1976d233' : '0 2px 12px #0001', padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', border: isSelected ? '2px solid #1976d2' : '2px solid transparent' }}
                  onClick={() => setSelectedRecording(rec)}
                >
                  {rec.video_url ? (
                    <video 
                      src={rec.video_url} 
                      style={{ width: '100%', borderRadius: 8, marginBottom: 10, background: '#000', cursor: 'pointer' }} 
                      controls={false}
                      onClick={e => { e.stopPropagation(); setSelectedRecording(rec); }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: 135, background: '#eee', borderRadius: 8, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>No Video</div>
                  )}
                  {/* Show all client names/emails */}
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2 }}>
                    {clientDisplayNames.length > 0 ? clientDisplayNames.join(', ') : ''}
                  </div>
                  <div style={{ color: '#888', fontSize: 14, marginBottom: 2 }}>By: {displayName}</div>
                  <div style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>{createdAt}</div>
                  {/* Action Buttons Row */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 8, justifyContent: 'center' }}>
                    {/* Blue Play Button */}
                    <button
                      title="Play"
                      onClick={e => { e.stopPropagation(); setSelectedRecording(rec); }}
                      style={{ width: 40, height: 40, borderRadius: '50%', background: '#1976d2', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px #1976d222', cursor: 'pointer', padding: 0 }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ display: 'block' }}>
                        <polygon points="6,4 16,10 6,16" fill="#fff" />
                      </svg>
                    </button>
                    {/* Green Download Button */}
                    <button
                      title="Download"
                      onClick={async e => {
                        e.stopPropagation();
                        if (rec.video_url) {
                          try {
                            const response = await fetch(rec.video_url);
                            const blob = await response.blob();
                            const filename = `recording-${rec.id}.webm`;
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.style.display = 'none';
                            a.href = url;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);
                          } catch (err) { alert('Failed to download video.'); }
                        }
                      }}
                      style={{ width: 40, height: 40, borderRadius: '50%', background: '#28a745', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px #28a74522', cursor: 'pointer', padding: 0 }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ display: 'block' }}>
                        <path d="M10 3v10M10 13l-4-4M10 13l4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <rect x="4" y="16" width="12" height="2" rx="1" fill="#fff" />
                      </svg>
                    </button>
                    {/* Orange URL Button */}
                    <button
                      title="Copy URL"
                      onClick={e => {
                        e.stopPropagation();
                        if (rec.video_url) {
                          navigator.clipboard.writeText(rec.video_url);
                          alert('Video URL copied to clipboard!');
                        }
                      }}
                      style={{ width: 40, height: 40, borderRadius: '50%', background: '#ff9800', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px #ff980022', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
                    >
                      URL
                    </button>
                    {/* Manual Transcribe Button */}
                    <button
                      title="Manual Transcribe"
                      onClick={async e => {
                        e.stopPropagation();
                        await handleManualTranscribe(rec.id);
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: '#9c27b0',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px #9c27b022',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 16,
                        cursor: 'pointer'
                      }}
                    >
                      <span role="img" aria-label="Transcribe">📝</span>
                    </button>
                  </div>
                </div>
              );
            })
        )}
      </div>
      {/* Control buttons for recording (visible only during live recording) */}
      {(recording) ? (
        <div style={{ display: 'flex', gap: 12, marginTop: 32, justifyContent: 'center' }}>
          {/* Stop Button */}
          <button
            onClick={() => {
              setRecording(false);
            }}
            style={{ background: '#dc3545', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 28px', fontSize: 18, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px #dc354522' }}
          >
            Stop Recording
          </button>
          {/* PiP Button */}
          <button
            onClick={() => {
              const event = new Event('sparky-pip-toggle');
              window.dispatchEvent(event);
            }}
            style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 28px', fontSize: 18, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px #1976d222' }}
          >
            PiP
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default ScreenRecorder;