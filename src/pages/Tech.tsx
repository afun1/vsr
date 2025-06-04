// --- Tech.tsx (May 29, 2025) ---
// Standalone tech login page with logout redirect, backup download, and UI polish
import React, { useState, useRef } from 'react';

const TECH_EMAIL = 'john@tpnlife.com';
const TECH_PASSWORD = 'BigBad5646$'; // Updated password

const TechPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [input, setInput] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  // --- state for outputVolume and micLevel ---
  const [outputVolume, setOutputVolume] = useState(() => {
    const v = localStorage.getItem('tech_output_volume');
    return v ? Number(v) : 1;
  });
  const [micLevel, setMicLevel] = useState(0);
  const [micTesting, setMicTesting] = useState(false);
  // --- refs for mic test stream and stop function ---
  const micTestStreamRef = useRef<MediaStream | null>(null);
  const stopMicTestRef = useRef<(() => void) | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim().toLowerCase() === TECH_EMAIL && input === TECH_PASSWORD) {
      setUnlocked(true);
      setError('');
    } else if (email.trim().toLowerCase() !== TECH_EMAIL) {
      setError('Access denied. Only john@tpnlife.com may access this page.');
    } else {
      setError('Incorrect password.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fa', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 50 }}>
      {/* Logout button in upper right */}
      {unlocked && (
        <button
          onClick={() => {
            setUnlocked(false);
            setEmail('');
            setInput('');
            setError('');
            setShowForgot(false);
            window.location.href = '/login';
          }}
          style={{
            position: 'absolute',
            top: 24,
            right: 32,
            background: '#fff',
            color: '#1976d2',
            border: '1px solid #1976d2',
            borderRadius: 6,
            padding: '8px 18px',
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
            boxShadow: '0 2px 8px #1976d222',
            zIndex: 10
          }}
        >
          Log Out
        </button>
      )}
      {/* Centered User Dashboard headline with 75px top padding */}
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 32, textAlign: 'center', paddingTop: 75 }}>User Dashboard</h1>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Tech Page Login</h1>
      <p style={{ fontSize: 15, color: '#555', marginBottom: 24, textAlign: 'center', maxWidth: 340 }}>
        This login is for technical staff only. Enter the tech email and password to access sensitive tools and backups.
      </p>
      {!unlocked ? (
        <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 32, borderRadius: 10, boxShadow: '0 2px 12px #0001', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minWidth: 320 }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Enter tech email"
            style={{ fontSize: 18, padding: 8, borderRadius: 4, border: '1px solid #ccc', width: 220 }}
            autoFocus
          />
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter tech password"
            style={{ fontSize: 18, padding: 8, borderRadius: 4, border: '1px solid #ccc', width: 220 }}
          />
          <button type="submit" style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '10px 22px', fontSize: 16, fontWeight: 600 }}>Unlock</button>
          <button
            type="button"
            style={{ background: 'none', color: '#1976d2', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: 15, marginTop: 4 }}
            onClick={() => setShowForgot(true)}
          >
            Forgot password?
          </button>
          {showForgot && (
            <a
              href={`mailto:${TECH_EMAIL}?subject=Password%20Reset%20Request&body=Hi%2C%20please%20help%20me%20reset%20my%20Tech%20page%20password.`}
              style={{ color: '#1976d2', fontSize: 15, marginTop: 4 }}
            >
              Email tech support for password reset
            </a>
          )}
          {error && <div style={{ color: 'red', fontSize: 14 }}>{error}</div>}
        </form>
      ) : (
        <div style={{ background: '#fff', padding: 32, borderRadius: 10, boxShadow: '0 2px 12px #0001', minWidth: 320 }}>
          <h2 style={{ fontSize: 22, marginBottom: 16 }}>Welcome, Tech!</h2>
          <p style={{ fontSize: 15, color: '#444' }}>This page is reserved for technical tools and sensitive actions. Add your tools/components here.</p>
        </div>
      )}
      {/* Download SITE_BACKUP_2025-05-28.txt button for tech user */}
      {unlocked && (
        <>
          <div style={{ marginTop: 32 }}>
            <a
              href="/SITE_BACKUP_2025-05-28.txt"
              download="SITE_BACKUP_2025-05-28.txt"
              style={{
                display: 'inline-block',
                background: '#1976d2',
                color: '#fff',
                borderRadius: 4,
                padding: '10px 22px',
                fontSize: 16,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 2px 8px #1976d222',
                marginTop: 8
              }}
            >
              Download Site Backup
            </a>
          </div>
          <div style={{ marginTop: 32 }}>
            <a
              href="/src/SITE_BACKUP_2025-05-30_00-13-19/"
              download
              style={{
                display: 'inline-block',
                background: '#1976d2',
                color: '#fff',
                borderRadius: 4,
                padding: '10px 22px',
                fontSize: 16,
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 2px 8px #1976d222',
                marginTop: 8
              }}
            >
              Download Full Site Backup (2025-05-30)
            </a>
          </div>
          {/* System Audio and Output Volume Controls */}
          <div style={{ marginTop: 36, background: '#f8faff', borderRadius: 8, padding: 24, boxShadow: '0 2px 8px #1976d222', maxWidth: 400 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 18 }}>Audio Device Test</h3>
            {/* System Audio Test Button */}
            <button
              type="button"
              style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '8px 18px', fontWeight: 600, fontSize: 15, marginBottom: 18, cursor: 'pointer' }}
              onClick={() => {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = 'sine';
                o.frequency.value = 440;
                o.connect(g);
                g.connect(ctx.destination);
                g.gain.value = outputVolume;
                o.start();
                setTimeout(() => { o.stop(); ctx.close(); }, 800);
              }}
            >
              Play System Test Tone
            </button>
            {/* Output Volume Slider */}
            <div style={{ marginTop: 18 }}>
              <label htmlFor="outputVolume" style={{ fontWeight: 500, fontSize: 15 }}>Output Volume:</label>
              <input
                id="outputVolume"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={outputVolume}
                style={{ marginLeft: 12, width: 180 }}
                onChange={e => {
                  const val = Number(e.target.value);
                  setOutputVolume(val);
                  document.querySelectorAll('audio, video').forEach((el: any) => { el.volume = val; });
                  localStorage.setItem('tech_output_volume', String(val));
                }}
              />
              <span style={{ marginLeft: 10, fontSize: 14 }}>{Math.round(outputVolume * 100)}%</span>
            </div>
            {/* Mic Test Section */}
            <div style={{ marginTop: 28 }}>
              <label style={{ fontWeight: 500, fontSize: 15, marginRight: 10 }}>Mic Test:</label>
              <button
                type="button"
                style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600, fontSize: 14, marginRight: 12, cursor: 'pointer' }}
                onClick={async () => {
                  if (micTestStreamRef.current) {
                    micTestStreamRef.current.getTracks().forEach((t: any) => t.stop());
                    micTestStreamRef.current = null;
                    setMicLevel(0);
                    setMicTesting(false);
                    if (stopMicTestRef.current) stopMicTestRef.current();
                    stopMicTestRef.current = null;
                    return;
                  }
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    micTestStreamRef.current = stream;
                    setMicTesting(true);
                    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const src = ctx.createMediaStreamSource(stream);
                    const analyser = ctx.createAnalyser();
                    analyser.fftSize = 256;
                    src.connect(analyser);
                    const data = new Uint8Array(analyser.frequencyBinCount);
                    let running = true;
                    let silenceFrames = 0;
                    function draw() {
                      if (!running) return;
                      analyser.getByteTimeDomainData(data);
                      let sum = 0;
                      for (let i = 0; i < data.length; i++) {
                        const v = (data[i] - 128) / 128;
                        sum += v * v;
                      }
                      const rms = Math.sqrt(sum / data.length);
                      setMicLevel(rms * 2); // scale up for better UI feedback
                      // Detect silence (muted or no input)
                      if (rms < 0.01) {
                        silenceFrames++;
                      } else {
                        silenceFrames = 0;
                      }
                      if (micTestStreamRef.current && running) setTimeout(draw, 50);
                    }
                    draw();
                    // Check for muted mic after 1 second
                    setTimeout(() => {
                      if (silenceFrames > 15) {
                        alert('No mic input detected. Your mic may be muted, not selected, or not working.');
                      }
                    }, 1000);
                    stopMicTestRef.current = () => {
                      running = false;
                      stream.getTracks().forEach((t: any) => t.stop());
                      ctx.close();
                      setMicLevel(0);
                      setMicTesting(false);
                      micTestStreamRef.current = null;
                    };
                  } catch (e) {
                    alert('Mic access denied or not available.');
                  }
                }}
              >
                {micTesting ? 'Stop Mic Test' : 'Start Mic Test'}
              </button>
              <div style={{ display: 'inline-block', width: 120, height: 16, background: '#eee', borderRadius: 8, verticalAlign: 'middle', position: 'relative' }}>
                <div style={{ width: `${Math.min(100, Math.round(micLevel * 100))}%`, height: '100%', background: micLevel > 0.2 ? '#4caf50' : '#bbb', borderRadius: 8, transition: 'width 0.1s' }} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TechPage;
// --- END Tech.tsx ---
