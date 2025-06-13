// Vercel cache bust: 2025-06-05
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../auth/supabaseClient';

// --- Dark mode hook ---
const useDarkMode = () => {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return dark;
};

interface RecordingPanelProps {
  setRecordedVideoUrl: (url: string | null) => void;
  onStartLiveScreen: (stream: MediaStream) => void;
}

const SUPABASE_MAX_SIZE_MB = 1024 * 5; // Set to 5GB (or your plan's max). Increase/decrease as needed.

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Unified member type for dropdown
type Member = {
  id: string;
  name?: string;
  email?: string;
  sparky_username?: string;
  source: 'client' | 'profile';
};

const RecordingPanel: React.FC<RecordingPanelProps> = ({ setRecordedVideoUrl, onStartLiveScreen }) => {
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
        tableBg: '#23262f',
        tableBorder: '#33384a',
        inputBg: '#23262f',
        inputText: '#e6e6e6',
        inputBorder: '#33384a',
        shadow: '0 2px 12px #0008',
        meterBg: '#33384a',
        meterFg: '#28a745',
        meterFgWarn: '#ff9800',
        meterFgOut: '#1976d2',
        error: '#e53935',
        success: '#28a745'
      }
    : {
        bg: '#fff',
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
        tableBg: '#fff',
        tableBorder: '#ccc',
        inputBg: '#fff',
        inputText: '#222',
        inputBorder: '#ccc',
        shadow: '0 2px 8px #0001',
        meterBg: '#eee',
        meterFg: '#28a745',
        meterFgWarn: '#ff9800',
        meterFgOut: '#1976d2',
        error: '#e53935',
        success: '#28a745'
      };

  const [memberMode, setMemberMode] = useState<'existing' | 'new'>('existing');
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('lastMemberId') || null : null
  );
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newMemberLoading, setNewMemberLoading] = useState(false);
  const [newMemberError, setNewMemberError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('selectedMic') || '' : ''
  );
  const [selectedOutput, setSelectedOutput] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('selectedOutput') || '' : ''
  );
  const [recording, setRecording] = useState(false);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [stoppedRecordingBlob, setStoppedRecordingBlob] = useState<Blob | null>(null);
  const [stoppedRecordingUrl, setStoppedRecordingUrl] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Recording time and size state
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingSize, setRecordingSize] = useState(0);
  const recordingTimerRef = useRef<number | null>(null);

  // --- Mic volume state and logic ---
  const [volume, setVolume] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // --- Output volume state and logic ---
  const [outputVolume, setOutputVolume] = useState(0);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputAnimationFrameRef = useRef<number | null>(null);

  // --- Output meter during recording ---
  const outputRecordingAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputRecordingAudioContextRef = useRef<AudioContext | null>(null);
  const outputRecordingSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputRecordingAnimationFrameRef = useRef<number | null>(null);

  // Fetch all clients and profiles once on mount
  useEffect(() => {
    async function fetchAllMembers() {
      try {
        const clientsRes = await supabase.from('clients').select('id, name, email, sparky_username');
        const profilesRes = await supabase.from('profiles').select('id, display_name, email');
        let clients: any[] = [];
        let profiles: any[] = [];
        let errorMsg = '';
        if (clientsRes.error) errorMsg += 'Clients: ' + clientsRes.error.message + '. ';
        if (profilesRes.error) errorMsg += 'Profiles: ' + profilesRes.error.message + '. ';
        if (errorMsg) {
          setSuggestionsError('Error loading members. ' + errorMsg);
          setAllMembers([]);
        } else {
          clients = clientsRes.data || [];
          profiles = profilesRes.data || [];
          const clientMembers: Member[] = clients.map((c: any) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            sparky_username: c.sparky_username,
            source: 'client'
          }));
          const profileMembers: Member[] = profiles.map((p: any) => ({
            id: p.id,
            name: p.display_name,
            email: p.email,
            sparky_username: undefined,
            source: 'profile'
          }));
          // Remove duplicates by id, prefer client over profile if both exist
          const all = [
            ...clientMembers,
            ...profileMembers.filter(p => !clientMembers.some(c => c.id === p.id))
          ];
          // Sort by name/email/username
          all.sort((a, b) => {
            const aStr = (a.name || a.email || a.sparky_username || '').toLowerCase();
            const bStr = (b.name || b.email || b.sparky_username || '').toLowerCase();
            return aStr.localeCompare(bStr);
          });
          setAllMembers(all);
        }
      } catch (err: any) {
        setSuggestionsError('Error loading members. ' + (err?.message || String(err)));
        setAllMembers([]);
      }
    }
    fetchAllMembers();
  }, []);

  // Filter allMembers in-memory for suggestions (quick filter)
  useEffect(() => {
    if (memberMode !== 'existing') return;
    const lower = search.trim().toLowerCase();
    if (!lower) {
      setFilteredMembers(allMembers);
      return;
    }
    setFilteredMembers(
      allMembers.filter(member =>
        (member.name && member.name.toLowerCase().startsWith(lower)) ||
        (member.email && member.email.toLowerCase().startsWith(lower)) ||
        (member.sparky_username && member.sparky_username.toLowerCase().startsWith(lower))
      )
    );
  }, [search, memberMode, allMembers]);

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
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
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

  // --- Mic volume meter logic ---
  useEffect(() => {
    let stopped = false;
    async function setupMicMeter() {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      try {
        let constraints: any = { audio: true };
        if (selectedMic && selectedMic !== 'bluetooth') {
          constraints = { audio: { deviceId: { exact: selectedMic } } };
        } else if (selectedMic === 'bluetooth') {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const bt = devices.find(d => d.kind === 'audioinput' && d.label.toLowerCase().includes('bluetooth'));
          if (bt) constraints = { audio: { deviceId: { exact: bt.deviceId } } };
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        micStreamRef.current = stream;
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        function update() {
          if (stopped) return;
          analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          setVolume(rms);
          animationFrameRef.current = requestAnimationFrame(update);
        }
        update();
      } catch (err) {
        setVolume(0);
      }
    }
    setupMicMeter();
    return () => {
      stopped = true;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
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
  }, [selectedMic]);

  // --- Output volume meter logic ---
  useEffect(() => {
    let stopped = false;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    if (recording && liveStream) {
      if (outputRecordingAnimationFrameRef.current) cancelAnimationFrame(outputRecordingAnimationFrameRef.current);
      if (outputRecordingAudioContextRef.current) {
        outputRecordingAudioContextRef.current.close();
        outputRecordingAudioContextRef.current = null;
      }
      if (outputRecordingSourceRef.current) {
        outputRecordingSourceRef.current.disconnect();
        outputRecordingSourceRef.current = null;
      }
      if (outputRecordingAnalyserRef.current) {
        outputRecordingAnalyserRef.current.disconnect();
        outputRecordingAnalyserRef.current = null;
      }
      try {
        const audioTracks = liveStream.getAudioTracks();
        if (audioTracks.length > 0) {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          outputRecordingAudioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          outputRecordingAnalyserRef.current = analyser;
          const source = audioCtx.createMediaStreamSource(new MediaStream([audioTracks[0]]));
          outputRecordingSourceRef.current = source;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          function update() {
            if (stopped) return;
            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const val = (dataArray[i] - 128) / 128;
              sum += val * val;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            setOutputVolume(rms);
            outputRecordingAnimationFrameRef.current = requestAnimationFrame(update);
          }
          update();
        } else {
          setOutputVolume(0);
        }
      } catch (err) {
        setOutputVolume(0);
      }
      return () => {
        stopped = true;
        if (outputRecordingAnimationFrameRef.current) cancelAnimationFrame(outputRecordingAnimationFrameRef.current);
        if (outputRecordingAudioContextRef.current) {
          outputRecordingAudioContextRef.current.close();
          outputRecordingAudioContextRef.current = null;
        }
        if (outputRecordingSourceRef.current) {
          outputRecordingSourceRef.current.disconnect();
          outputRecordingSourceRef.current = null;
        }
        if (outputRecordingAnalyserRef.current) {
          outputRecordingAnalyserRef.current.disconnect();
          outputRecordingAnalyserRef.current = null;
        }
      };
    } else {
      let sysStream: MediaStream | null = null;
      async function setupOutputMeter() {
        if (outputAudioContextRef.current) {
          outputAudioContextRef.current.close();
          outputAudioContextRef.current = null;
        }
        if (outputSourceRef.current) {
          outputSourceRef.current.disconnect();
          outputSourceRef.current = null;
        }
        if (outputAnalyserRef.current) {
          outputAnalyserRef.current.disconnect();
          outputAnalyserRef.current = null;
        }
        try {
          sysStream = await (navigator.mediaDevices as any).getDisplayMedia({
            video: false,
            audio: { 
              echoCancellation: false,
              noiseSuppression: false,
              sampleRate: 44100
            }
          });
          const audioTracks = sysStream.getAudioTracks();
          if (audioTracks.length > 0) {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            outputAudioContextRef.current = audioCtx;
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            outputAnalyserRef.current = analyser;
            const source = audioCtx.createMediaStreamSource(new MediaStream([audioTracks[0]]));
            outputSourceRef.current = source;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            function update() {
              if (stopped) return;
              analyser.getByteTimeDomainData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                const val = (dataArray[i] - 128) / 128;
                sum += val * val;
              }
              const rms = Math.sqrt(sum / dataArray.length);
              setOutputVolume(rms);
              outputAnimationFrameRef.current = requestAnimationFrame(update);
            }
            update();
          } else {
            setOutputVolume(0);
          }
        } catch (err) {
          setOutputVolume(0);
        }
      }
      setupOutputMeter();
      return () => {
        stopped = true;
        if (outputAnimationFrameRef.current) cancelAnimationFrame(outputAnimationFrameRef.current);
        if (outputAudioContextRef.current) {
          outputAudioContextRef.current.close();
          outputAudioContextRef.current = null;
        }
        if (outputSourceRef.current) {
          outputSourceRef.current.disconnect();
          outputSourceRef.current = null;
        }
        if (outputAnalyserRef.current) {
          outputAnalyserRef.current.disconnect();
          outputAnalyserRef.current = null;
        }
        if (sysStream) {
          sysStream.getTracks().forEach(track => track.stop());
        }
      };
    }
    // eslint-disable-next-line
  }, [selectedOutput, recording, liveStream]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Recording timer and size effect
  useEffect(() => {
    if (recording) {
      setRecordingTime(0);
      setRecordingSize(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingTime(t => t + 1);
        let size = 0;
        for (const chunk of recordedChunksRef.current) {
          size += chunk.size;
        }
        setRecordingSize(size);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [recording]);

  useEffect(() => {
    if (stoppedRecordingBlob) {
      setRecordingSize(stoppedRecordingBlob.size);
    }
  }, [stoppedRecordingBlob]);

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
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.log('[RecordingPanel] mounted');
      return () => {
        // eslint-disable-next-line no-console
        console.log('[RecordingPanel] unmounted');
      };
    }
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
    setRecordingTime(0);
    setRecordingSize(0);
    try {
      let screenStream;
      try {
        screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: { width: 640, height: 480, frameRate: 10 },
          audio: true
        });
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
          micStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: bluetoothDevice.deviceId }, channelCount: 1 } });
        } else {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
        }
      } else if (selectedMic) {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: selectedMic }, channelCount: 1 } });
      } else {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
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
      const mediaRecorder = new MediaRecorder(finalStream, {
        mimeType: 'video/webm',
        videoBitsPerSecond: 400_000
      });
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
        setRecordingTime(prev => prev);
        setRecordingSize(blob.size);
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
    if (SUPABASE_MAX_SIZE_MB > 0 && stoppedRecordingBlob.size > SUPABASE_MAX_SIZE_MB * 1024 * 1024) {
      setRecordingError(`Recording is too large to upload (max ${SUPABASE_MAX_SIZE_MB}MB). Please record a shorter video or upgrade your plan.`);
      return;
    }
    if (memberMode === 'existing') {
      if (!clientId) {
        setRecordingError('Please select a member before saving.');
        return;
      }
      try {
        const found = allMembers.find(m => m.id === clientId);
        if (!found) {
          setRecordingError('Selected member does not exist.');
          if (typeof window !== 'undefined') localStorage.removeItem('lastMemberId');
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
        if (typeof window !== 'undefined') localStorage.setItem('lastMemberId', data.id);
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
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sparky-auto-select-recording', { detail: newRecording.video_url }));
        }
        setStoppedRecordingBlob(null);
        setStoppedRecordingUrl(null);
      }
    } catch (err) {
      setRecordingError('Unexpected error during upload: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  useEffect(() => {
    if (memberMode !== 'existing') return;
    const lower = search.trim().toLowerCase();
    if (!lower) {
      setFilteredMembers(allMembers);
      return;
    }
    setFilteredMembers(
      allMembers.filter(member =>
        (member.name && member.name.toLowerCase().startsWith(lower)) ||
        (member.email && member.email.toLowerCase().startsWith(lower)) ||
        (member.sparky_username && member.sparky_username.toLowerCase().startsWith(lower))
      )
    );
  }, [search, memberMode, allMembers]);

  // --- Styles ---
  const cardStyle: React.CSSProperties = {
    width: 480,
    background: palette.card,
    borderRadius: 10,
    boxShadow: palette.shadow,
    padding: 24,
    marginBottom: 32,
    color: palette.text,
    border: `1px solid ${palette.border}`,
    transition: 'background 0.2s, color 0.2s'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: palette.inputBg,
    color: palette.inputText,
    border: `1px solid ${palette.inputBorder}`,
    borderRadius: 6,
    padding: '10px 12px',
    fontSize: 16,
    marginTop: 4,
    marginBottom: 0,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'background 0.2s, color 0.2s, border 0.2s'
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    width: 260,
    marginLeft: 10
  };

  const meterBgStyle: React.CSSProperties = {
    width: 260,
    height: 16,
    background: palette.meterBg,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    border: `1px solid ${palette.inputBorder}`,
    position: 'relative'
  };

  const meterFgStyle = (val: number, warn: boolean, out: boolean): React.CSSProperties => ({
    width: `${Math.min(100, Math.round(val * 100 * 2))}%`,
    height: '100%',
    background: out ? palette.meterFgOut : warn ? palette.meterFgWarn : palette.meterFg,
    transition: 'width 0.1s linear'
  });

  return (
    <div style={cardStyle}>
      <h3 style={{ color: palette.text }}>New Recording</h3>
      <div style={{ marginTop: 0, marginBottom: 8 }}>
        <label style={{ fontWeight: 600 }}>Microphone/Input Device:</label>
        <select
          value={selectedMic}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            setSelectedMic(e.target.value);
            if (typeof window !== 'undefined') localStorage.setItem('selectedMic', e.target.value);
          }}
          style={selectStyle}
        >
          <option value="bluetooth">Bluetooth Audio</option>
          {inputs.map((input, idx) => (
            <option key={input.deviceId || idx} value={input.deviceId}>
              {input.label || `Microphone ${idx + 1}`}
            </option>
          ))}
        </select>
      </div>
      {/* Input Volume Meter */}
      <div style={{ margin: '8px 0 16px 0', height: 24, display: 'flex', alignItems: 'center' }}>
        <div style={meterBgStyle}>
          <div style={meterFgStyle(volume, volume > 0.05, false)} />
        </div>
        <span style={{ fontSize: 13, color: palette.textSecondary }}>
          {volume > 0.01 ? 'Mic Active' : 'No Signal'}
        </span>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 600 }}>Speaker/Output Device:</label>
        <select
          value={selectedOutput}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            setSelectedOutput(e.target.value);
            if (typeof window !== 'undefined') localStorage.setItem('selectedOutput', e.target.value);
          }}
          style={selectStyle}
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
        <div style={meterBgStyle}>
          <div style={meterFgStyle(outputVolume, outputVolume > 0.05, true)} />
        </div>
        <span style={{ fontSize: 13, color: palette.textSecondary }}>
          {outputVolume > 0.01 ? 'Output Active' : 'No Signal'}
        </span>
      </div>
      {/* Recording Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 32 }}>
        {recording && liveStream ? (
          <>
            <video ref={liveVideoRef} style={{ width: 400, height: 220, borderRadius: 8, background: '#000', marginBottom: 24 }} autoPlay muted />
            {/* Recording time and file size */}
            <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
              <span style={{ fontWeight: 600, color: palette.accent, fontSize: 16 }}>
                Time: {formatDuration(recordingTime)}
              </span>
              <span style={{ fontWeight: 600, color: palette.textSecondary, fontSize: 16 }}>
                Size: {formatBytes(recordingSize)}
              </span>
              <span style={{ fontWeight: 600, color: palette.textSecondary, fontSize: 16 }}>
                Max: {SUPABASE_MAX_SIZE_MB} MB
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 16, marginBottom: 8 }}>
              {!isPaused ? (
                <button
                  onClick={handlePauseResume}
                  style={{
                    background: palette.meterFgWarn,
                    color: '#fff',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: 6,
                    padding: '12px 28px',
                    fontSize: 18,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px #ff980022'
                  }}
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={handlePauseResume}
                  style={{
                    background: palette.accent,
                    color: '#fff',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: 6,
                    padding: '12px 28px',
                    fontSize: 18,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px #1976d222'
                  }}
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
                style={{
                  background: palette.accent3,
                  color: '#fff',
                  fontWeight: 700,
                  border: 'none',
                  borderRadius: 6,
                  padding: '12px 28px',
                  fontSize: 18,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px #dc354522',
                  marginTop: 0
                }}
              >
                Stop Recording
              </button>
            </div>
          </>
        ) : stoppedRecordingUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <video src={stoppedRecordingUrl || undefined} controls style={{ width: 400, height: 220, borderRadius: 8, background: '#000', marginBottom: 24 }} />
            {/* Show final time and file size */}
            <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
              <span style={{ fontWeight: 600, color: palette.accent, fontSize: 16 }}>
                Time: {formatDuration(recordingTime)}
              </span>
              <span style={{ fontWeight: 600, color: palette.textSecondary, fontSize: 16 }}>
                Size: {formatBytes(recordingSize)}
              </span>
              <span style={{ fontWeight: 600, color: palette.textSecondary, fontSize: 16 }}>
                Max: {SUPABASE_MAX_SIZE_MB} MB
              </span>
            </div>
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
                  <label htmlFor="existing-member-search">Quick Filter:</label>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Type to filter by name, email, or username"
                    style={inputStyle}
                  />
                  <label htmlFor="existing-member-dropdown">Select Member:</label>
                  <select
                    id="existing-member-dropdown"
                    value={clientId || (filteredMembers.length > 0 ? filteredMembers[0].id : '')}
                    onChange={e => {
                      setClientId(e.target.value);
                      if (typeof window !== 'undefined') localStorage.setItem('lastMemberId', e.target.value);
                    }}
                    style={inputStyle}
                  >
                    {filteredMembers.length > 0 ? (
                      filteredMembers.map(member => (
                        <option key={member.id} value={member.id}>
                          {member.name || member.email || member.sparky_username || '(No Name)'}
                          {member.email ? ` (${member.email})` : ''}
                          {member.source === 'profile' ? ' [Admin]' : ''}
                        </option>
                      ))
                    ) : (
                      <option value="">-- Select a member --</option>
                    )}
                  </select>
                  {suggestionsError && (
                    <div style={{ color: palette.error, fontSize: 13, marginTop: 4 }}>{suggestionsError}</div>
                  )}
                  {filteredMembers.length === 0 && !suggestionsError && (
                    <div style={{ color: palette.textSecondary, fontSize: 13, marginTop: 4 }}>No members found.</div>
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
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    Last Name:
                    <input
                      type="text"
                      value={newLastName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewLastName(e.target.value)}
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    Email:
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEmail(e.target.value)}
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    Sparky Username:
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewUsername(e.target.value)}
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    Phone:
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPhone(e.target.value)}
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </label>
                  {newMemberError && <div style={{ color: palette.error, fontSize: 13 }}>{newMemberError}</div>}
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
                  background: palette.accent2,
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
              style={{
                background: palette.accent2,
                color: '#fff',
                fontWeight: 700,
                border: 'none',
                borderRadius: 6,
                padding: '12px 28px',
                fontSize: 18,
                cursor: 'pointer',
                boxShadow: '0 2px 8px #28a74522'
              }}
            >
              Start Recording
            </button>
            <div />
          </>
        )}
      </div>
      {recordingError && (
        <div style={{ color: palette.error, fontWeight: 600, margin: '12px 0' }}>{recordingError}</div>
      )}
    </div>
  );
};

export default RecordingPanel;