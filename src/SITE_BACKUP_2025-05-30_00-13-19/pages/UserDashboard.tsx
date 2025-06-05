import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../auth/supabaseClient';

const RecordingForm: React.FC<{ onClose: () => void; onRecordingSaved: () => void; setPreviewUrl: (url: string) => void }> = ({ onClose, onRecordingSaved, setPreviewUrl }) => {
  // Member selection state
  const [memberMode, setMemberMode] = useState<'existing' | 'new'>('existing');
  const [clientId, setClientId] = useState<string | null>(() => localStorage.getItem('lastMemberId') || null);
  const [search, setSearch] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<Array<{ id: string; display_name?: string; email?: string }>>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  // New member form state
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newMemberError, setNewMemberError] = useState<string | null>(null);
  const [newMemberSuccess, setNewMemberSuccess] = useState(false);
  // Audio controls state
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  // Speaker test state
  const [speakerTestActive, setSpeakerTestActive] = useState(false);
  const [speakerTestResult, setSpeakerTestResult] = useState<'yes' | 'no' | null>(null);
  const beepCtxRef = useRef<AudioContext | null>(null);
  const beepGainRef = useRef<GainNode | null>(null);
  const beepLoopRef = useRef<NodeJS.Timeout | null>(null);
  // Mic test state
  const [micTestActive, setMicTestActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micTestResult, setMicTestResult] = useState<'yes' | 'no' | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnimationRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  // Device selection state
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [selectedOutput, setSelectedOutput] = useState<string>('');

  // Live search for existing member (now using clients table)
  useEffect(() => {
    if (memberMode !== 'existing' || search.trim().length < 1) {
      setClientSuggestions([]);
      setSuggestionsLoading(false);
      setSuggestionsError(null);
      return;
    }
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('id, name, email, sparky_username, first_name, last_name')
          .or(`name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,sparky_username.ilike.%${search.trim()}%,first_name.ilike.%${search.trim()}%,last_name.ilike.%${search.trim()}%`)
          .order('created_at', { ascending: false })
          .limit(10);
        if (error) {
          setSuggestionsError('Error searching members.');
          setClientSuggestions([]);
        } else {
          setClientSuggestions(data || []);
        }
      } catch {
        setSuggestionsError('Error searching members.');
        setClientSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    })();
  }, [search, memberMode]);

  // Start recording handler
  const startRecording = async () => {
    setRecording(true);
    setVideoUrl(null);
    recordedChunks.current = [];
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) recordedChunks.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setPreviewUrl(url); // Show in preview window immediately
      };
      mediaRecorderRef.current.start();
    } catch (err: any) {
      setRecording(false);
    }
  };

  // Upload handler (auto-called after preview is rendered)
  const uploadRecording = async (urlToUpload?: string) => {
    const uploadUrl = urlToUpload || videoUrl;
    if (!uploadUrl || !clientId) return;
    try {
      const response = await fetch(uploadUrl);
      const blob = await response.blob();
      const userId = 'f2ff724e-a337-43c9-9dbb-3419eb29d22a'; // John Bradshaw's user_id
      const fileName = `${userId}-${Date.now()}.webm`;
      const { error: storageError } = await supabase.storage.from('recordings').upload(fileName, blob, { upsert: true, contentType: 'video/webm' });
      if (storageError) {
        return;
      }
      const { data: publicUrlData } = supabase.storage.from('recordings').getPublicUrl(fileName);
      const videoPublicUrl = publicUrlData?.publicUrl;
      await supabase.from('recordings').insert({
        user_id: userId,
        client_id: clientId,
        video_url: videoPublicUrl,
        created_at: new Date().toISOString(),
      });
      onRecordingSaved();
    } catch (err: any) {
    }
  };

  // Auto-upload when videoUrl is set (preview rendered)
  React.useEffect(() => {
    if (videoUrl) {
      uploadRecording(videoUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  // New member creation handler
  const handleNewMember = async () => {
    setNewMemberError(null);
    setNewMemberSuccess(false);
    if (!newFirstName.trim() || !newLastName.trim() || !newEmail.trim() || !newUsername.trim() || !newPhone.trim()) {
      setNewMemberError('All fields are required.');
      return;
    }
    try {
      const { data, error } = await supabase.from('clients').insert({
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        email: newEmail.trim(),
        sparky_username: newUsername.trim(),
        phone: newPhone.trim(),
        name: `${newFirstName.trim()} ${newLastName.trim()}`
      }).select('id').single();
      if (error || !data?.id) {
        setNewMemberError('Failed to create new member.');
        return;
      }
      setClientId(data.id);
      setNewFirstName(''); setNewLastName(''); setNewEmail(''); setNewUsername(''); setNewPhone('');
      setNewMemberSuccess(true);
      setMemberMode('existing');
      setSearch('');
      setClientSuggestions([]);
    } catch {
      setNewMemberError('Failed to create new member.');
    }
  };

  // Speaker test logic
  const handleTestSpeaker = () => {
    setSpeakerTestActive(true);
    setSpeakerTestResult(null);
    // Clean up any previous beep
    if (beepCtxRef.current) {
      beepCtxRef.current.close();
      beepCtxRef.current = null;
    }
    if (beepLoopRef.current) {
      clearInterval(beepLoopRef.current);
      beepLoopRef.current = null;
    }
    // Create beep loop
    const ctx = new (window.AudioContext)();
    beepCtxRef.current = ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.2;
    gain.connect(ctx.destination);
    beepGainRef.current = gain;
    // Function to play a single beep
    const playBeep = () => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 440;
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      osc.onended = () => osc.disconnect();
    };
    playBeep();
    beepLoopRef.current = setInterval(playBeep, 1000);
  };
  const stopSpeakerTest = () => {
    setSpeakerTestActive(false);
    if (beepLoopRef.current) {
      clearInterval(beepLoopRef.current);
      beepLoopRef.current = null;
    }
    if (beepCtxRef.current) {
      beepCtxRef.current.close();
      beepCtxRef.current = null;
    }
  };

  // Mic test logic
  const handleTestMic = async () => {
    setMicTestActive(true);
    setMicTestResult(null);
    setMicLevel(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const animate = () => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setMicLevel(rms);
        if (micTestActive) {
          micAnimationRef.current = requestAnimationFrame(animate);
        }
      };
      animate();
    } catch (e) {
      setMicLevel(0);
      setMicTestActive(false);
    }
  };
  const stopMicTest = () => {
    setMicTestActive(false);
    setMicLevel(0);
    if (micAnimationRef.current) cancelAnimationFrame(micAnimationRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
  };

  // Cleanup on unmount
  React.useEffect(() => () => { stopSpeakerTest(); stopMicTest(); }, []);

  // Device change handlers
  useEffect(() => {
    const fetchDevices = async () => {
      const inputDevices = await navigator.mediaDevices.enumerateDevices();
      setInputs(inputDevices.filter(d => d.kind === 'audioinput'));
      setOutputs(inputDevices.filter(d => d.kind === 'audiooutput'));
    };
    fetchDevices();
  }, []);
  useEffect(() => {
    const handle = (e: Event) => {
      const el = e.target as HTMLSelectElement;
      if (el.closest('.recording-form')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('touchstart', handle, { passive: false });
    return () => {
      document.removeEventListener('touchstart', handle);
    };
  }, []);

  return (
    <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 2px 12px #0001', padding: 32, maxWidth: 480, margin: '0 auto 32px auto' }} className="recording-form">
      <h2 style={{ fontSize: 22, marginBottom: 18 }}>New Recording</h2>
      {/* Audio Options: Speaker and Mic Test */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontWeight: 600, fontSize: 16 }}>Speaker Test:</label>
          {!speakerTestActive && (
            <button type="button" onClick={handleTestSpeaker} style={{ marginLeft: 12, background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', fontWeight: 600 }}>Start Speaker Test</button>
          )}
          {speakerTestActive && (
            <span style={{ marginLeft: 12, color: '#1976d2', fontWeight: 500 }}>Beep playing every second...</span>
          )}
          {speakerTestActive && (
            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 15 }}>Do you hear the beeps?</span>
              <button type="button" onClick={() => { setSpeakerTestResult('yes'); stopSpeakerTest(); }} style={{ marginLeft: 10, background: '#28a745', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 14px', fontWeight: 600 }}>Yes</button>
              <button type="button" onClick={() => { setSpeakerTestResult('no'); stopSpeakerTest(); }} style={{ marginLeft: 8, background: '#e53935', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 14px', fontWeight: 600 }}>No</button>
            </div>
          )}
          {speakerTestResult && (
            <div style={{ marginTop: 8, color: speakerTestResult === 'yes' ? '#28a745' : '#e53935', fontWeight: 600 }}>
              {speakerTestResult === 'yes' ? 'Speaker works!' : 'Speaker not working.'}
            </div>
          )}
        </div>
        <div>
          <label style={{ fontWeight: 600, fontSize: 16 }}>Mic Test:</label>
          {!micTestActive && (
            <button type="button" onClick={handleTestMic} style={{ marginLeft: 12, background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', fontWeight: 600 }}>Start Mic Test</button>
          )}
          {micTestActive && (
            <span style={{ marginLeft: 12, color: '#1976d2', fontWeight: 500 }}>Speak into your mic...</span>
          )}
          <div style={{ marginTop: 10, height: 18, width: 180, background: '#eee', borderRadius: 8, overflow: 'hidden', display: 'inline-block', verticalAlign: 'middle' }}>
            <div style={{ height: '100%', width: `${Math.min(100, Math.round(micLevel * 200))}%`, background: micLevel > 0.05 ? '#28a745' : '#ccc', transition: 'width 0.1s' }} />
          </div>
          {micTestActive && (
            <span style={{ marginLeft: 10, fontSize: 14, color: micLevel > 0.05 ? '#28a745' : '#888' }}>{micLevel > 0.05 ? 'Green = Mic working' : 'No input'}</span>
          )}
          {micTestActive && (
            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 15 }}>Did you see the green in the meter?</span>
              <button type="button" onClick={() => { setMicTestResult('yes'); stopMicTest(); }} style={{ marginLeft: 10, background: '#28a745', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 14px', fontWeight: 600 }}>Yes</button>
              <button type="button" onClick={() => { setMicTestResult('no'); stopMicTest(); }} style={{ marginLeft: 8, background: '#e53935', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 14px', fontWeight: 600 }}>No</button>
            </div>
          )}
          {micTestResult && (
            <div style={{ marginTop: 8, color: micTestResult === 'yes' ? '#28a745' : '#e53935', fontWeight: 600 }}>
              {micTestResult === 'yes' ? 'Mic works!' : 'Mic not working.'}
            </div>
          )}
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label>
          <input type="radio" checked={memberMode === 'existing'} onChange={() => setMemberMode('existing')} /> Existing Member
        </label>
        <label style={{ marginLeft: 16 }}>
          <input type="radio" checked={memberMode === 'new'} onChange={() => setMemberMode('new')} /> New Member
        </label>
      </div>
      {memberMode === 'existing' && (
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setClientId(null); }}
            placeholder="Type name, email, or username..."
            style={{ width: '100%', marginBottom: 4 }}
          />
          {suggestionsLoading && <div style={{ color: '#888', fontSize: 13 }}>Loading...</div>}
          {suggestionsError && <div style={{ color: 'red', fontSize: 13 }}>{suggestionsError}</div>}
          {newMemberSuccess && clientId && (
            <div style={{ color: '#28a745', fontSize: 14, marginBottom: 4 }}>New Member created! Select them above and click Start Recording.</div>
          )}
          {search.trim().length >= 1 && clientSuggestions.length > 0 && (
            <ul style={{ border: '1px solid #ccc', borderRadius: 4, background: '#fff', maxHeight: 180, overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none', width: '100%' }}>
              {clientSuggestions.map(client => (
                <li
                  key={client.id}
                  style={{ padding: '6px 12px', cursor: 'pointer', background: client.id === clientId ? '#e3f2fd' : undefined }}
                  onClick={() => { setClientId(client.id); setSearch(client.name || client.email || client.sparky_username || client.display_name || ''); setClientSuggestions([client]); localStorage.setItem('lastMemberId', client.id); }}
                >
                  <span style={{ fontWeight: 500 }}>{(client as any).name || (client as any).sparky_username || client.display_name || '(No Name)'}</span>
                  {client.email && <span style={{ color: '#888', marginLeft: 8, fontSize: 13 }}>({client.email})</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {memberMode === 'new' && (
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="text" placeholder="First Name" value={newFirstName} onChange={e => setNewFirstName(e.target.value)} />
          <input type="text" placeholder="Last Name" value={newLastName} onChange={e => setNewLastName(e.target.value)} />
          <input type="email" placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          <input type="text" placeholder="Sparky Username" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
          <input type="tel" placeholder="Phone" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
          {newMemberError && <div style={{ color: 'red', fontSize: 13 }}>{newMemberError}</div>}
          <button type="button" onClick={handleNewMember} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600 }}>Create Member</button>
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <label>Microphone/Input: </label>
        <select value={selectedMic} onChange={e => setSelectedMic(e.target.value)} style={{ marginLeft: 10, fontSize: 15 }}>
          <option value="">Default</option>
          {inputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId}`}</option>)}
        </select>
        <label style={{ marginLeft: 24 }}>Speaker/Output: </label>
        <select value={selectedOutput} onChange={e => setSelectedOutput(e.target.value)} style={{ marginLeft: 10, fontSize: 15 }}>
          <option value="">Default</option>
          <option value="system">System Audio (if supported)</option>
          {outputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId}`}</option>)}
        </select>
      </div>
      <div style={{ marginTop: 12 }}>
        <label htmlFor="userInputVolume" style={{ fontWeight: 500, fontSize: 14 }}>Input Volume:</label>
        <input
          id="userInputVolume"
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={1}
          style={{ marginLeft: 10, width: 160 }}
          onChange={e => {
            const val = Number((e.target as HTMLInputElement).value);
            document.querySelectorAll('audio, video').forEach((el: any) => { el.volume = Math.min(val, 2); });
            localStorage.setItem('user_output_volume', String(val));
            const label = document.getElementById('userInputVolumeValue');
            if (label) label.textContent = Math.round(val * 100) + '%';
          }}
        />
        <span style={{ marginLeft: 8, fontSize: 13 }} id="userInputVolumeValue">100%</span>
      </div>
      <div style={{ marginTop: 12 }}>
        <label htmlFor="userOutputVolume" style={{ fontWeight: 500, fontSize: 14 }}>Output Volume:</label>
        <input
          id="userOutputVolume"
          type="range"
          min={0}
          max={2}
          step={0.01}
          defaultValue={1}
          style={{ marginLeft: 10, width: 160 }}
          onInput={e => {
            const val = Number((e.target as HTMLInputElement).value);
            document.querySelectorAll('audio, video').forEach((el: any) => { el.volume = Math.min(val, 2); });
            localStorage.setItem('user_output_volume', String(val));
            const label = document.getElementById('userOutputVolumeValue');
            if (label) label.textContent = Math.round(val * 100) + '%';
          }}
        />
        <span style={{ marginLeft: 8, fontSize: 13 }} id="userOutputVolumeValue">100%</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button
          onClick={onClose}
          style={{ background: 'none', color: '#1976d2', border: 'none', padding: 0, fontSize: 16, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={startRecording}
          disabled={recording || !clientId}
          style={{ background: recording ? '#ccc' : '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600, cursor: recording ? 'not-allowed' : 'pointer' }}
        >
          {recording ? 'Recording...' : 'Start Recording'}
        </button>
      </div>
    </div>
  );
};

export default RecordingForm;
