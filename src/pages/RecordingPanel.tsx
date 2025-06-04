import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../auth/supabaseClient';

// Fix: add type for RecordingPanelProps
interface RecordingPanelProps {
  setRecordedVideoUrl: (url: string | null) => void;
  onStartLiveScreen: (stream: MediaStream) => void;
}

const RecordingPanel: React.FC<RecordingPanelProps> = ({ setRecordedVideoUrl, onStartLiveScreen }: RecordingPanelProps) => {
  // --- State (copied from ScreenRecorder) ---
  const [micGain, setMicGain] = useState(() => {
    const stored = localStorage.getItem('micGain');
    return stored ? Number(stored) : 1;
  });
  const [systemGain, setSystemGain] = useState(() => {
    const stored = localStorage.getItem('systemGain');
    return stored ? Number(stored) : 1;
  });
  const [memberMode, setMemberMode] = useState<'existing' | 'new'>('existing');
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState<string | null>(() => localStorage.getItem('lastMemberId') || null);
  const [clientSuggestions, setClientSuggestions] = useState<Array<{ id: string; name?: string; email?: string; sparky_username?: string }>>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [searchDebounced, setSearchDebounced] = useState('');
  // New member form state
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newMemberLoading, setNewMemberLoading] = useState(false);
  const [newMemberError, setNewMemberError] = useState<string | null>(null);
  // Add state for audio devices
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedOutput, setSelectedOutput] = useState('');
  const [recording, setRecording] = useState(false);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  // When switching memberMode, reset search and suggestions state
  useEffect(() => {
    if (memberMode === 'existing') {
      setSearch('');
      setClientSuggestions([]);
      setSuggestionsLoading(false);
      setSuggestionsError(null);
      setClientId(null);
    } else if (memberMode === 'new') {
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewUsername('');
      setNewPhone('');
      setNewMemberError(null);
    }
  }, [memberMode]);

  // Debounce search input for better performance
  useEffect(() => {
    if (memberMode !== 'existing') return;
    const handler = setTimeout(() => {
      setSearchDebounced(search);
    }, 250);
    return () => clearTimeout(handler);
  }, [search, memberMode]);

  // Unified live search effect for existing member (debounced, only when 1+ chars)
  useEffect(() => {
    if (memberMode !== 'existing') return;
    let active = true;
    if (searchDebounced.trim().length < 1) {
      setClientSuggestions([]);
      setSuggestionsLoading(false);
      setSuggestionsError(null);
      return;
    }
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    (async () => {
      try {
        let data, error;
        ({ data, error } = await supabase
          .from('clients')
          .select('id, name, email, sparky_username')
          .or(`name.ilike.%${searchDebounced.trim()}%,email.ilike.%${searchDebounced.trim()}%,sparky_username.ilike.%${searchDebounced.trim()}%`)
          .order('name', { ascending: true })
          .limit(10));
        if (!active) return;
        if (error) {
          setSuggestionsError('Error searching members.');
          setClientSuggestions([]);
        } else {
          setClientSuggestions(data || []);
        }
      } catch (err) {
        if (!active) return;
        setSuggestionsError('Error searching members.');
        setClientSuggestions([]);
      } finally {
        if (active) setSuggestionsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [searchDebounced, memberMode]);

  // Fetch input/output devices on mount
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setInputs(devices.filter(d => d.kind === 'audioinput'));
      setOutputs(devices.filter(d => d.kind === 'audiooutput'));
    });
  }, []);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (liveVideoRef.current && liveStream) {
      liveVideoRef.current.srcObject = liveStream;
      liveVideoRef.current.play().catch(() => {});
    }
    if (!recording && liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
  }, [liveStream, recording]);

  const handleStartRecording = async () => {
    setRecordingError(null); // Reset error on each attempt
    let finalClientId = clientId;
    if (memberMode === 'existing') {
      if (!clientId) {
        alert('Please select a member before starting a recording.');
        return;
      }
      // --- Verify client exists in DB before proceeding ---
      try {
        const { data, error } = await supabase.from('clients').select('id').eq('id', clientId).single();
        if (error || !data) {
          setRecordingError('Selected member does not exist. Please select a valid member.');
          localStorage.removeItem('lastMemberId');
          setClientId(null);
          return;
        }
      } catch (err) {
        setRecordingError('Error verifying member: ' + (err instanceof Error ? err.message : String(err)));
        return;
      }
      console.log('[RecordingPanel] Using existing clientId:', clientId);
    } else {
      // --- NEW: Insert new client before recording ---
      if (!newFirstName.trim() || !newLastName.trim() || !newEmail.trim() || !newUsername.trim() || !newPhone.trim()) {
        setNewMemberError('All fields are required.');
        return;
      }
      setNewMemberError(null);
      setNewMemberLoading(true);
      try {
        const { data, error } = await supabase.from('clients').insert({
          name: `${newFirstName.trim()} ${newLastName.trim()}`,
          email: newEmail.trim(),
          sparky_username: newUsername.trim(),
          phone: newPhone.trim(),
        }).select('id').single();
        if (error) {
          setNewMemberError('Failed to create new member: ' + error.message);
          setNewMemberLoading(false);
          return;
        }
        if (!data?.id) {
          setNewMemberError('Failed to create new member: No ID returned');
          setNewMemberLoading(false);
          return;
        }
        setClientId(data.id);
        localStorage.setItem('lastMemberId', data.id);
        setNewMemberLoading(false);
        finalClientId = data.id;
        console.log('[RecordingPanel] Created new client with id:', data.id);
      } catch (err) {
        setNewMemberError('Unexpected error creating member: ' + (err instanceof Error ? err.message : String(err)));
        setNewMemberLoading(false);
        return;
      }
    }
    if (!finalClientId) {
      setRecordingError('No clientId available for recording.');
      return;
    }
    // ...existing code for screen/mic capture and recording...
    try {
      // 1. Get screen stream (video, maybe system audio)
      let screenStream;
      try {
        screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: selectedOutput === 'system' });
      } catch (err) {
        setRecordingError('Screen capture was denied or failed. Please try again and allow screen sharing.');
        setRecording(false);
        setLiveStream(null);
        return;
      }
      if (onStartLiveScreen) onStartLiveScreen(screenStream);
      setLiveStream(screenStream); // Show live preview (for legacy fallback)
      // 2. Get mic stream using selectedMic
      let micStream: MediaStream | null = null;
      if (selectedMic) {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: selectedMic } } });
      } else {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      // 3. Mix audio (mic + system) if both present
      let finalStream: MediaStream;
      if (screenStream.getAudioTracks().length > 0 && micStream && micStream.getAudioTracks().length > 0) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        // System audio
        const sysSource = audioCtx.createMediaStreamSource(new MediaStream([screenStream.getAudioTracks()[0]]));
        sysSource.connect(dest);
        // Mic audio
        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(dest);
        // Video track
        finalStream = new MediaStream([
          ...screenStream.getVideoTracks(),
          ...dest.stream.getAudioTracks()
        ]);
      } else if (micStream && micStream.getAudioTracks().length > 0) {
        // Only mic audio
        finalStream = new MediaStream([
          ...screenStream.getVideoTracks(),
          ...micStream.getAudioTracks()
        ]);
      } else {
        // Only screen audio
        finalStream = screenStream;
      }
      setRecording(true);
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(finalStream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        console.log('[RecordingPanel] mediaRecorder.onstop fired');
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        console.log('[RecordingPanel] setRecordedVideoUrl with', url);
        // --- Upload to Supabase Storage and insert DB row ---
        try {
          // Get user id
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id;
          if (!userId || !finalClientId) {
            console.error('No userId or clientId for upload', { userId, finalClientId });
            setRecordingError('No userId or clientId for upload');
            return;
          }
          const fileName = `${userId}-${Date.now()}.webm`;
          // Upload to storage
          const { error: storageError } = await supabase.storage.from('recordings').upload(fileName, blob, { upsert: true, contentType: 'video/webm' });
          if (storageError) {
            console.error('Failed to upload video:', storageError.message);
            setRecordingError('Failed to upload video: ' + storageError.message);
            return;
          }
          // Get public URL
          const { data: publicUrlData } = supabase.storage.from('recordings').getPublicUrl(fileName);
          const videoPublicUrl = publicUrlData?.publicUrl;
          // Insert into recordings table
          const { error: dbError } = await supabase.from('recordings').insert({
            user_id: userId,
            client_id: finalClientId,
            video_url: videoPublicUrl,
            transcript: '', // PATCH: placeholder transcript to satisfy NOT NULL constraint
            created_at: new Date().toISOString(),
          });
          if (dbError) {
            console.error('Failed to insert recording row:', dbError.message);
            setRecordingError('Failed to insert recording row: ' + dbError.message);
          } else {
            console.log('Recording uploaded and saved to DB!');
            // --- Poll for new recording to appear in DB, then trigger preview ---
            let found = false;
            const maxAttempts = 10; // 5 seconds max
            let attempts = 0;
            while (!found && attempts < maxAttempts) {
              const { data: recs } = await supabase
                .from('recordings')
                .select('video_url')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(5);
              if (recs && recs.some((r: { video_url: string }) => r.video_url === videoPublicUrl)) {
                found = true;
                setRecordedVideoUrl(videoPublicUrl); // Show preview and trigger auto-select
                window.dispatchEvent(new CustomEvent('sparky-auto-select-recording', { detail: videoPublicUrl }));
                break;
              }
              await new Promise(res => setTimeout(res, 500));
              attempts++;
            }
            if (!found) {
              // Fallback: still show preview
              setRecordedVideoUrl(videoPublicUrl);
              window.dispatchEvent(new CustomEvent('sparky-auto-select-recording', { detail: videoPublicUrl }));
            }
          }
        } catch (err) {
          console.error('Unexpected error during upload:', err);
          setRecordingError('Unexpected error during upload: ' + (err instanceof Error ? err.message : String(err)));
        }
      };
      mediaRecorder.start();
      // Stop tracks when recording is stopped
      screenStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        setRecording(false);
        setLiveStream(null);
      };
    } catch (err) {
      setRecordingError('Unexpected error: ' + (err instanceof Error ? err.message : String(err)));
      setRecording(false);
      setLiveStream(null);
    }
  };

  // Restore audio settings and member on mount
  useEffect(() => {
    const storedMic = localStorage.getItem('selectedMic');
    if (storedMic) setSelectedMic(storedMic);
    const storedOutput = localStorage.getItem('selectedOutput');
    if (storedOutput) setSelectedOutput(storedOutput);
    const storedMicGain = localStorage.getItem('micGain');
    if (storedMicGain) setMicGain(Number(storedMicGain));
    const storedSystemGain = localStorage.getItem('systemGain');
    if (storedSystemGain) setSystemGain(Number(storedSystemGain));
    const storedMember = localStorage.getItem('lastMemberId');
    if (storedMember) {
      setClientId(storedMember);
      // Try to fetch and set the search field to the member's name/email
      (async () => {
        const { data } = await supabase.from('clients').select('id, name, email, sparky_username').eq('id', storedMember).single();
        if (data) {
          setSearch(data.name || data.email || data.sparky_username || '');
          setClientSuggestions([data]);
        }
      })();
    }
  }, []);

  // Persist audio settings and member selection
  useEffect(() => { localStorage.setItem('micGain', String(micGain)); }, [micGain]);
  useEffect(() => { localStorage.setItem('systemGain', String(systemGain)); }, [systemGain]);
  useEffect(() => { localStorage.setItem('selectedMic', selectedMic); }, [selectedMic]);
  useEffect(() => { localStorage.setItem('selectedOutput', selectedOutput); }, [selectedOutput]);
  useEffect(() => { if (clientId) { localStorage.setItem('lastMemberId', clientId); } }, [clientId]);

  // Remove any useEffect that sets clientId or clientSuggestions on mount unless the user types.
  // Only update clientSuggestions based on the current search string.
  // Only show the dropdown if search.trim().length > 0 and clientSuggestions.length > 0
  // Do not set clientSuggestions to [data] when loading last member.
  // Ensure the dropdown always shows all search results for the current search string, not just the last selected member.
  // --- PiP support ---
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const pipHandler = () => {
      if (pipVideoRef.current && document.pictureInPictureEnabled) {
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

  // Add debug logs to trace recording lifecycle
  useEffect(() => {
    console.log('[RecordingPanel] mounted');
    return () => {
      console.log('[RecordingPanel] unmounted');
    };
  }, []);

  // const startRecording = async () => {
  //   console.log('[RecordingPanel] startRecording called');
  //   // ...existing code...
  // };

  // const stopRecording = () => {
  //   console.log('[RecordingPanel] stopRecording called');
  //   mediaRecorderRef.current?.stop();
  //   setRecording(false);
  // };

  // --- UI ---
  return (
    <div style={{ width: 480, background: '#fff', borderRadius: 10, boxShadow: '0 2px 12px #0001', padding: 24, marginBottom: 32 }}>
      <h3>New Recording</h3>
      <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
        <label style={{ fontWeight: 500 }}>
          <input
            type="radio"
            name="memberMode"
            value="existing"
            checked={memberMode === 'existing'}
            onChange={() => setMemberMode('existing')}
            style={{ marginRight: 6 }}
          />
          Existing Member
        </label>
        <label style={{ fontWeight: 500 }}>
          <input
            type="radio"
            name="memberMode"
            value="new"
            checked={memberMode === 'new'}
            onChange={() => setMemberMode('new')}
            style={{ marginRight: 6 }}
          />
          New Member
        </label>
      </div>
      {/* Member Search Field and Dropdown (only for existing member mode) */}
      {memberMode === 'existing' && (
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="existing-member-search">Search Member:</label>
          <input
            id="existing-member-search"
            type="text"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setSearch(e.target.value);
              setClientId(null);
            }}
            placeholder="Search by name or email"
            autoComplete="off"
            style={{ width: '100%', marginBottom: 6 }}
          />
          {clientSuggestions.length > 0 && (
            <select
              value={clientId || ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setClientId(e.target.value || null);
                if (e.target.value) {
                  localStorage.setItem('lastMemberId', e.target.value);
                  const selected = clientSuggestions.find((c: { id: string; name?: string; email?: string; sparky_username?: string }) => c.id === e.target.value);
                  setSearch(selected ? (selected.name || selected.email || selected.sparky_username || '') : '');
                } else {
                  localStorage.removeItem('lastMemberId');
                  setSearch('');
                }
              }}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', background: '#fafbfc', marginTop: 4 }}
              size={5}
            >
              <option value="">{suggestionsLoading ? 'Loading...' : 'Select a member'}</option>
              {clientSuggestions.map((client: { id: string; name?: string; email?: string; sparky_username?: string }) => (
                <option key={client.id} value={client.id}>
                  {client.name || client.email || client.sparky_username || '(No Name)'}
                  {client.email ? ` (${client.email})` : ''}
                </option>
              ))}
            </select>
          )}
          {suggestionsError && (
            <div style={{ color: 'red', fontSize: 13, marginTop: 4 }}>{suggestionsError}</div>
          )}
          {search.trim().length >= 1 && !suggestionsLoading && clientSuggestions.length === 0 && !suggestionsError && (
            <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>No members found.</div>
          )}
        </div>
      )}
      {/* New Member Form (only if selected) */}
      {memberMode === 'new' && (
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label>
            First Name:
            <input
              type="text"
              value={newFirstName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewFirstName(e.target.value)}
              style={{ width: '100%' }}
              autoComplete="off"
            />
          </label>
          <label>
            Last Name:
            <input
              type="text"
              value={newLastName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewLastName(e.target.value)}
              style={{ width: '100%' }}
              autoComplete="off"
            />
          </label>
          <label>
            Email:
            <input
              type="email"
              value={newEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEmail(e.target.value)}
              style={{ width: '100%' }}
              autoComplete="off"
            />
          </label>
          <label>
            Sparky Username:
            <input
              type="text"
              value={newUsername}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUsername(e.target.value)}
              style={{ width: '100%' }}
              autoComplete="off"
            />
          </label>
          <label>
            Phone:
            <input
              type="tel"
              value={newPhone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPhone(e.target.value)}
              style={{ width: '100%' }}
              autoComplete="off"
            />
          </label>
          {newMemberError && <div style={{ color: 'red', fontSize: 13 }}>{newMemberError}</div>}
        </div>
      )}
      {/* Audio device selection */}
      <div style={{ marginTop: 16, marginBottom: 8 }}>
        <label style={{ fontWeight: 600 }}>Microphone/Input Device:</label>
        <select
          value={selectedMic}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMic(e.target.value)}
          style={{ marginLeft: 10, width: 260 }}
        >
          <option value="">Default</option>
          {inputs.map((d: MediaDeviceInfo) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId}`}</option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 600 }}>Speaker/Output Device:</label>
        <select
          value={selectedOutput}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedOutput(e.target.value)}
          style={{ marginLeft: 10, width: 260 }}
        >
          <option value="">Default</option>
          <option value="system">System Audio (if supported)</option>
          {outputs.map((d: MediaDeviceInfo) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId}`}</option>
          ))}
        </select>
      </div>
      {/* Audio controls UI (simplified) */}
      <div style={{ marginTop: 16 }}>
        <label style={{ fontWeight: 600 }}>Microphone Gain:</label>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={micGain}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMicGain(Number(e.target.value))}
          style={{ marginLeft: 10, width: 200 }}
        />
        <span style={{ marginLeft: 8, fontSize: 14 }}>{Math.round(micGain * 100)}%</span>
      </div>
      <div>
        <label style={{ fontWeight: 600 }}>System Audio Gain:</label>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={systemGain}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSystemGain(Number(e.target.value))}
          style={{ marginLeft: 10, width: 200 }}
        />
        <span style={{ marginLeft: 8, fontSize: 14 }}>{Math.round(systemGain * 100)}%</span>
      </div>
      {/* Buttons at the bottom of the panel */}
      <div style={{ display: 'flex', marginTop: 32, justifyContent: 'space-between', alignItems: 'center' }}>
        {recording && liveStream ? (
          <>
            {/* Live preview of the window being recorded, always visible in the workspace */}
            <video ref={liveVideoRef} style={{ width: 400, height: 220, borderRadius: 8, background: '#000', marginRight: 24 }} autoPlay muted />
            <button
              onClick={() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                  mediaRecorderRef.current.stop();
                }
                setRecording(false);
                setLiveStream(null);
              }}
              style={{ background: '#dc3545', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 6, padding: '12px 28px', fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 8px #dc354522' }}
            >
              Stop Recording
            </button>
            <button
              onClick={() => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                  mediaRecorderRef.current.stop();
                }
                setRecording(false);
                setLiveStream(null);
              }}
              style={{ background: '#007bff', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 6, padding: '12px 28px', fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 8px #007bff22', marginLeft: 'auto' }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleStartRecording}
              disabled={memberMode === 'existing' ? !clientId : newMemberLoading || !newFirstName.trim() || !newLastName.trim() || !newEmail.trim() || !newUsername.trim() || !newPhone.trim()}
              style={{ background: '#28a745', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 6, padding: '12px 28px', fontSize: 18, cursor: (memberMode === 'existing' ? !clientId : newMemberLoading || !newFirstName.trim() || !newLastName.trim() || !newEmail.trim() || !newUsername.trim() || !newPhone.trim()) ? 'not-allowed' : 'pointer', boxShadow: '0 2px 8px #28a74522' }}
            >
              + New Recording
            </button>
            <div />
          </>
        )}
      </div>
      {/* Hidden video for PiP */}
      {recording && liveStream && (
        <video
          ref={pipVideoRef}
          style={{ display: 'none' }}
          autoPlay
          playsInline
          muted
        />
      )}
      {/* Error message for recording issues */}
      {recordingError && (
        <div style={{ color: 'red', fontWeight: 600, margin: '12px 0' }}>{recordingError}</div>
      )}
    </div>
  );
};

export default RecordingPanel;
