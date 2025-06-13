// Vercel cache bust: 2025-06-05
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../auth/supabaseClient';

interface RecordingPanelProps {
  setRecordedVideoUrl: (url: string | null) => void;
  onStartLiveScreen: (stream: MediaStream) => void;
}

const RecordingPanel: React.FC<RecordingPanelProps> = ({ setRecordedVideoUrl, onStartLiveScreen }) => {
  const [memberMode, setMemberMode] = useState<'existing' | 'new'>('existing');
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState<string | null>(() => localStorage.getItem('lastMemberId') || null);
  const [clientSuggestions, setClientSuggestions] = useState<Array<{ id: string; name?: string; email?: string; sparky_username?: string }>>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [searchDebounced, setSearchDebounced] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newMemberLoading, setNewMemberLoading] = useState(false);
  const [newMemberError, setNewMemberError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState(() => localStorage.getItem('selectedMic') || '');
  const [selectedOutput, setSelectedOutput] = useState(() => localStorage.getItem('selectedOutput') || '');
  const [recording, setRecording] = useState(false);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [stoppedRecordingBlob, setStoppedRecordingBlob] = useState<Blob | null>(null);
  const [stoppedRecordingUrl, setStoppedRecordingUrl] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Input volume meter state
  const [volume, setVolume] = useState(0);
  const volumeAnimationRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Output volume meter state
  const [outputVolume, setOutputVolume] = useState(0);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputStreamRef = useRef<MediaStream | null>(null);
  const outputAudioRef = useRef<HTMLAudioElement | null>(null);

  // Input volume meter effect
  useEffect(() => {
    let cancelled = false;
    async function setupVolumeMeter() {
      if (!selectedMic) return;
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMic === 'bluetooth'
            ? { deviceId: { exact: (inputs.find(d => d.label.toLowerCase().includes('bluetooth'))?.deviceId || '') } }
            : selectedMic
              ? { deviceId: { exact: selectedMic } }
              : true
        });
        micStreamRef.current = stream;
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        function updateVolume() {
          if (cancelled) return;
          analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          setVolume(rms);
          volumeAnimationRef.current = requestAnimationFrame(updateVolume);
        }
        updateVolume();
      } catch {
        setVolume(0);
      }
    }
    setupVolumeMeter();
    return () => {
      cancelled = true;
      if (volumeAnimationRef.current) cancelAnimationFrame(volumeAnimationRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
    };
    // eslint-disable-next-line
  }, [selectedMic, inputs]);

  // Output volume meter effect (show output meter only during recording)
  useEffect(() => {
    let cancelled = false;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let animationId: number | null = null;
    let stream: MediaStream | null = null;

    async function setupOutputVolumeMeter() {
      if (!recording || !liveStream) {
        setOutputVolume(0);
        return;
      }
      try {
        // Try to get the output audio track from the liveStream (system+mic mixed)
        const audioTracks = liveStream.getAudioTracks();
        if (audioTracks.length === 0) {
          setOutputVolume(0);
          return;
        }
        stream = new MediaStream([audioTracks[0]]);
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        function updateOutputVolume() {
          if (cancelled) return;
          analyser!.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          setOutputVolume(rms);
          animationId = requestAnimationFrame(updateOutputVolume);
        }
        updateOutputVolume();
      } catch {
        setOutputVolume(0);
      }
    }

    setupOutputVolumeMeter();

    return () => {
      cancelled = true;
      if (animationId) cancelAnimationFrame(animationId);
      if (audioCtx) audioCtx.close();
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [recording, liveStream]);

  useEffect(() => {
    localStorage.setItem('selectedMic', selectedMic);
  }, [selectedMic]);
  useEffect(() => {
    localStorage.setItem('selectedOutput', selectedOutput);
  }, [selectedOutput]);

  useEffect(() => {
    if (memberMode === 'new') {
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewUsername('');
      setNewPhone('');
      setNewMemberError(null);
    }
  }, [memberMode]);

  useEffect(() => {
    if (memberMode !== 'existing') return;
    const handler = setTimeout(() => {
      setSearchDebounced(search);
    }, 250);
    return () => clearTimeout(handler);
  }, [search, memberMode]);

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

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        stream.getTracks().forEach(track => track.stop());
        return navigator.mediaDevices.enumerateDevices();
      })
      .then(devices => {
        setInputs(devices.filter(d => d.kind === 'audioinput'));
        setOutputs(devices.filter(d => d.kind === 'audiooutput'));
      })
      .catch(() => {
        navigator.mediaDevices.enumerateDevices().then(devices => {
          setInputs(devices.filter(d => d.kind === 'audioinput'));
          setOutputs(devices.filter(d => d.kind === 'audiooutput'));
        });
      });
  }, []);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (liveVideoRef.current && liveStream) {
      liveVideoRef.current.srcObject = liveStream;
      liveVideoRef.current.play().catch(() => {});
      if (typeof liveVideoRef.current.setSinkId === 'function') {
        let outputId = selectedOutput;
        if (selectedOutput === 'bluetooth') {
          const bt = outputs.find(d => d.label.toLowerCase().includes('bluetooth'));
          if (bt) outputId = bt.deviceId;
        }
        if (outputId) {
          liveVideoRef.current.setSinkId(outputId).catch(() => {});
        }
      }
    }
    if (!recording && liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
  }, [liveStream, recording, selectedOutput, outputs]);

  useEffect(() => {
    console.log('[RecordingPanel] mounted');
    return () => {
      console.log('[RecordingPanel] unmounted');
    };
  }, []);

  const handlePauseResume = () => {
    if (!mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    } else if (mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  };

  const handleStartRecording = async () => {
    setRecordingError(null);
    setStoppedRecordingUrl(null);
    try {
      let screenStream;
      try {
        screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
      } catch (err) {
        setRecordingError('Screen capture was denied or failed. Please try again and allow screen sharing.');
        setRecording(false);
        setLiveStream(null);
        return;
      }
      if (onStartLiveScreen) onStartLiveScreen(screenStream);
      setLiveStream(screenStream);
      let micStream: MediaStream | null = null;
      if (selectedMic === 'bluetooth') {
        const bluetoothDevice = inputs.find(d => d.label.toLowerCase().includes('bluetooth'));
        if (bluetoothDevice) {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: bluetoothDevice.deviceId } } });
        } else {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      } else if (selectedMic) {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: selectedMic } } });
      } else {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      let finalStream: MediaStream;
      if (screenStream.getAudioTracks().length > 0 && micStream && micStream.getAudioTracks().length > 0) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        const sysSource = audioCtx.createMediaStreamSource(new MediaStream([screenStream.getAudioTracks()[0]]));
        sysSource.connect(dest);
        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(dest);
        finalStream = new MediaStream([
          ...screenStream.getVideoTracks(),
          ...dest.stream.getAudioTracks()
        ]);
      } else if (micStream && micStream.getAudioTracks().length > 0) {
        finalStream = new MediaStream([
          ...screenStream.getVideoTracks(),
          ...micStream.getAudioTracks()
        ]);
      } else {
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
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setStoppedRecordingBlob(blob);
        setStoppedRecordingUrl(url);
        setRecording(false);
        setLiveStream(null);
        setIsPaused(false);
      };
      mediaRecorder.start();
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

  const handleSaveRecordingDetails = async () => {
    setRecordingError(null);
    let finalClientId = clientId;
    if (!stoppedRecordingBlob || !stoppedRecordingUrl) {
      setRecordingError('No recording to upload.');
      return;
    }
    if (memberMode === 'existing') {
      if (!clientId) {
        setRecordingError('Please select a member before saving.');
        return;
      }
      try {
        const { data, error } = await supabase.from('clients').select('id').eq('id', clientId).single();
        if (error || !data) {
          setRecordingError('Selected member does not exist.');
          localStorage.removeItem('lastMemberId');
          setClientId(null);
          return;
        }
      } catch (err) {
        setRecordingError('Error verifying member: ' + (err instanceof Error ? err.message : String(err)));
        return;
      }
    } else {
      if (!newFirstName.trim() || !newLastName.trim() || !newUsername.trim()) {
        setNewMemberError('First name, last name, and username are required.');
        return;
      }
      setNewMemberError(null);
      setNewMemberLoading(true);
      try {
        const insertData: any = {
          name: `${newFirstName.trim()} ${newLastName.trim()}`,
          sparky_username: newUsername.trim(),
          phone: newPhone.trim(),
        };
        if (newEmail.trim() !== '') {
          insertData.email = newEmail.trim();
        }
        const { data, error } = await supabase.from('clients').insert(insertData).select('id').single();
        if (error) {
          if (
            error.message &&
            error.message.includes('duplicate key value') &&
            error.message.includes('unique_client_email')
          ) {
            setNewMemberError('A member with this email already exists. Please use a different email or select the existing member.');
          } else {
            setNewMemberError('Failed to create new member: ' + error.message);
          }
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
      } catch (err) {
        setNewMemberError('Unexpected error creating member: ' + (err instanceof Error ? err.message : String(err)));
        setNewMemberLoading(false);
        return;
      }
    }
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        setRecordingError('No userId for upload');
        return;
      }
      const fileName = `${userId}-${Date.now()}.webm`;
      const { error: storageError } = await supabase.storage.from('recordings').upload(fileName, stoppedRecordingBlob, { upsert: true, contentType: 'video/webm' });
      if (storageError) {
        setRecordingError('Failed to upload video: ' + storageError.message);
        return;
      }
      const { data: publicUrlData } = supabase.storage.from('recordings').getPublicUrl(fileName);
      const videoPublicUrl = publicUrlData?.publicUrl;
      const { data: insertData, error: dbError } = await supabase.from('recordings').insert({
        user_id: userId,
        client_id: finalClientId,
        video_url: videoPublicUrl,
        transcript: '',
        created_at: new Date().toISOString(),
      }).select('id, video_url');
      if (dbError) {
        setRecordingError('Failed to insert recording row: ' + dbError.message);
      } else if (insertData && insertData.length > 0) {
        const newRecording = insertData[0];
        setRecordedVideoUrl(newRecording.video_url);
        window.dispatchEvent(new CustomEvent('sparky-auto-select-recording', { detail: newRecording.video_url }));
        setStoppedRecordingBlob(null);
        setStoppedRecordingUrl(null);
      }
    } catch (err) {
      setRecordingError('Unexpected error during upload: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div style={{ width: 480, background: '#fff', borderRadius: 10, boxShadow: '0 2px 12px #0001', padding: 24, marginBottom: 32 }}>
      <h3>New Recording</h3>
      <div style={{ marginTop: 0, marginBottom: 8 }}>
        <label style={{ fontWeight: 600 }}>Microphone/Input Device:</label>
        <select
          value={selectedMic}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMic(e.target.value)}
          style={{ marginLeft: 10, width: 260 }}
        >
          <option value="bluetooth">Bluetooth Audio</option>
          {inputs.map((input, idx) => (
            <option key={input.deviceId || idx} value={input.deviceId}>
              {input.label || `Microphone ${idx+1}`}
            </option>
          ))}
        </select>
      </div>
      {/* Input Volume Meter */}
      <div style={{ margin: '8px 0 16px 0', height: 24, display: 'flex', alignItems: 'center' }}>
        <div style={{
          width: 260,
          height: 16,
          background: '#eee',
          borderRadius: 8,
          overflow: 'hidden',
          marginRight: 12,
          border: '1px solid #ccc',
          position: 'relative'
        }}>
          <div style={{
            width: `${Math.min(100, Math.round(volume * 100 * 2))}%`,
            height: '100%',
            background: volume > 0.5 ? '#ff9800' : '#28a745',
            transition: 'width 0.1s linear'
          }} />
        </div>
        <span style={{ fontSize: 13, color: '#888' }}>
          {volume > 0.01 ? 'Mic Active' : 'No Signal'}
        </span>
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
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Speaker ${d.deviceId}`}
              {d.label && d.label.toLowerCase().includes('bluetooth') ? ' (Bluetooth)' : ''}
            </option>
          ))}
        </select>
      </div>
      {/* Output Volume Meter */}
      <div style={{ margin: '8px 0 16px 0', height: 24, display: 'flex', alignItems: 'center' }}>
        <div style={{
          width: 260,
          height: 16,
          background: '#eee',
          borderRadius: 8,
          overflow: 'hidden',
          marginRight: 12,
          border: '1px solid #ccc',
          position: 'relative'
        }}>
          <div style={{
            width: `${Math.min(100, Math.round(outputVolume * 100 * 2))}%`,
            height: '100%',
            background: outputVolume > 0.5 ? '#ff9800' : '#1976d2',
            transition: 'width 0.1s linear'
          }} />
        </div>
        <span style={{ fontSize: 13, color: '#888' }}>
          {outputVolume > 0.01 ? 'Output Active' : 'No Signal'}
        </span>
      </div>
      {/* Recording Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 32 }}>
        {recording && liveStream ? (
          <>
            <video ref={liveVideoRef} style={{ width: 400, height: 220, borderRadius: 8, background: '#000', marginBottom: 24 }} autoPlay muted />
            <div style={{ display: 'flex', flexDirection: 'row', gap: 16, marginBottom: 8 }}>
              {!isPaused ? (
                <button
                  onClick={handlePauseResume}
                  style={{ background: '#ff9800', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 6, padding: '12px 28px', fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 8px #ff980022' }}
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={handlePauseResume}
                  style={{ background: '#1976d2', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 6, padding: '12px 28px', fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 8px #1976d222' }}
                >
                  Resume
                </button>
              )}
              <button
                onClick={() => {
                  if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                  }
                  setRecording(false);
                  setLiveStream(null);
                  setIsPaused(false);
                }}
                style={{ background: '#dc3545', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 6, padding: '12px 28px', fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 8px #dc354522', marginTop: 0 }}
              >
                Stop Recording
              </button>
            </div>
          </>
        ) : stoppedRecordingUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <video src={stoppedRecordingUrl || undefined} controls style={{ width: 400, height: 220, borderRadius: 8, background: '#000', marginBottom: 24 }} />
            <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 24, marginBottom: 12, marginTop: 0 }}>
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
              {memberMode === 'existing' && (
                <div style={{ marginBottom: 16, width: '100%' }}>
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
              {memberMode === 'new' && (
                <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
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
              <button
                onClick={handleSaveRecordingDetails}
                disabled={
                  memberMode === 'existing'
                    ? !clientId
                    : newMemberLoading || !newFirstName.trim() || !newLastName.trim() || !newUsername.trim()
                }
                style={{
                  background: '#28a745',
                  color: '#fff',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 6,
                  padding: '12px 28px',
                  fontSize: 18,
                  cursor:
                    memberMode === 'existing'
                      ? !clientId
                        ? 'not-allowed'
                        : 'pointer'
                      : newMemberLoading || !newFirstName.trim() || !newLastName.trim() || !newUsername.trim()
                      ? 'not-allowed'
                      : 'pointer',
                  boxShadow: '0 2px 8px #28a74522',
                  marginTop: 12,
                }}
              >
                Save Details
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={handleStartRecording}
              style={{ background: '#28a745', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 6, padding: '12px 28px', fontSize: 18, cursor: 'pointer', boxShadow: '0 2px 8px #28a74522' }}
            >
              Start Recording
            </button>
            <div />
          </>
        )}
      </div>
      {recordingError && (
        <div style={{ color: 'red', fontWeight: 600, margin: '12px 0' }}>{recordingError}</div>
      )}
    </div>
  );
};

export default RecordingPanel;