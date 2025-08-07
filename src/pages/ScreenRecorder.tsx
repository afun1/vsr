import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../auth/supabaseClient';
import { useAuth } from '../auth/AuthContext';
// @ts-ignore
import FileSaver from 'file-saver';

// --- Dark mode hook ---
const useDarkMode = () => {
  const [dark, setDark] = useState(() =>
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return dark;
};

interface ScreenRecorderProps {
  recordedVideoUrl?: string | null;
}

function formatDateForFilename(dateString: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}-at-${hours}-${pad(minutes)}-${pad(seconds)}${ampm}`;
}

const ScreenRecorder: React.FC<ScreenRecorderProps> = ({ recordedVideoUrl }) => {
  const darkMode = useDarkMode();
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
        modalBg: '#23262f',
        modalText: '#e6e6e6',
        modalBorder: '#33384a',
        modalShadow: '0 4px 24px #000a'
      }
    : {
        bg: '#f7faff',
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
        modalBg: '#fff',
        modalText: '#222',
        modalBorder: '#eee',
        modalShadow: '0 4px 24px #0002'
      };

  const { user } = useAuth();
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTranscript, setModalTranscript] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [modalFilename, setModalFilename] = useState('');

  // --- Comments state ---
  const [comments, setComments] = useState<{ [recordingId: string]: any[] }>({});

  // --- Add Comment Modal ---
  const [addCommentModalOpen, setAddCommentModalOpen] = useState(false);
  const [addCommentInput, setAddCommentInput] = useState('');
  const [addCommentPosting, setAddCommentPosting] = useState(false);
  const [addCommentBy, setAddCommentBy] = useState('');

  // Fetch recordings
  useEffect(() => {
    const fetchRecordings = async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) { setRecordings([]); setLoading(false); return; }
      // Fetch recordings where user is owner OR user is client
      let query = supabase
        .from('recordings')
        .select('id, user_id, video_url, created_at, client_id, display_name, clients:client_id (id, name, email, first_name, last_name), profiles:user_id (display_name, email), transcript')
        .order('created_at', { ascending: false })
        .or(`user_id.eq.${userId},client_id.eq.${userId}`);
      const { data, error } = await query;
      if (error) {
        setLoading(false);
      } else setRecordings(data || []);
      setLoading(false);
      if (data && data.length > 0 && recordedVideoUrl) {
        const found = data.find(r => r.video_url === recordedVideoUrl);
        if (found) setSelectedRecording(found);
      }
    };
    fetchRecordings();
  }, [user, recordedVideoUrl]);

  // Fetch comments for all recordings on mount or when recordings change
  useEffect(() => {
    const fetchComments = async () => {
      if (!recordings.length) return;
      const ids = recordings.map(r => r.id);
      const { data, error } = await supabase
        .from('comments')
        .select('id, recording_id, user_id, content, created_at, display_name')
        .in('recording_id', ids);
      if (!error && data) {
        // Group comments by recording_id
        const grouped: { [recordingId: string]: any[] } = {};
        data.forEach((c: any) => {
          if (!grouped[c.recording_id]) grouped[c.recording_id] = [];
          grouped[c.recording_id].push(c);
        });
        setComments(grouped);
      }
    };
    fetchComments();
  }, [recordings]);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  // Play/Stop logic for preview panel
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, selectedRecording]);

  // When a new recording is selected, reset play state
  useEffect(() => {
    setIsPlaying(false);
    if (selectedRecording && previewVideoRef.current) {
      previewVideoRef.current.currentTime = 0;
    }
  }, [selectedRecording]);

  // --- Scroll to preview panel helper ---
  const previewPanelRef = useRef<HTMLDivElement | null>(null);
  const scrollToPreviewPanel = () => {
    if (previewPanelRef.current) {
      previewPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const filteredRecordings = recordings.filter(rec => {
    if (!search) return true;
    let clientArr: any[] = [];
    if (Array.isArray(rec.clients)) {
      clientArr = rec.clients;
    } else if (rec.clients) {
      clientArr = [rec.clients];
    }
    const clientNames = clientArr.flatMap((clientObj: any) => {
      if (!clientObj) return [];
      const names: string[] = [];
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
    const displayName = rec.profiles?.display_name || '';
    const displayEmail = rec.profiles?.email || '';
    const fields = [...clientNames, displayName, displayEmail].map(f => (f || '').toLowerCase());
    const searchLower = search.toLowerCase();
    return fields.some(f => f.includes(searchLower));
  });

  // --- Styles ---
  const cardStyle: React.CSSProperties = {
    width: '20%',
    minWidth: 0,
    maxWidth: '20%',
    background: palette.card,
    borderRadius: 10,
    boxShadow: palette.shadow,
    padding: 14,
    margin: '0 10px 24px 0', // 10px right padding between cards
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    color: palette.text,
    border: `1px solid ${palette.border}`,
    transition: 'background 0.2s, color 0.2s'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 10,
    borderRadius: 6,
    border: `1px solid ${palette.inputBorder}`,
    fontSize: 16,
    background: palette.inputBg,
    color: palette.inputText,
    marginBottom: 0,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'background 0.2s, color 0.2s, border 0.2s'
  };

  const transcriptBoxStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 54,
    maxHeight: 54,
    resize: 'none',
    fontSize: 13,
    color: palette.text,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 6,
    border: `1px solid ${palette.inputBorder}`,
    background: palette.inputBg,
    overflow: 'hidden',
    lineHeight: '1.2',
    boxSizing: 'border-box',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    whiteSpace: 'pre-line'
  };

  // --- NEW: Modal Comments Box Style ---
  const modalCommentBoxStyle: React.CSSProperties = {
    background: darkMode ? '#23262f' : '#f5f5f5',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 14,
    border: `1px solid ${darkMode ? '#33384a' : '#e0e0e0'}`,
    boxShadow: darkMode ? '0 1px 4px #0004' : '0 1px 4px #0001',
    color: palette.text,
    fontSize: 15,
    width: '100%',
    wordBreak: 'break-word'
  };

  // --- Post comment handler for modal ---
  const handlePostCommentModal = async () => {
    if (!selectedRecording || !addCommentInput.trim() || addCommentPosting) return;
    setAddCommentPosting(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    let displayName = '';
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .maybeSingle();
      displayName = profile?.display_name || userData.user?.email || 'User';
    }
    const { data, error } = await supabase
      .from('comments')
      .insert([
        {
          recording_id: selectedRecording.id,
          user_id: userId,
          content: addCommentInput.trim(),
          display_name: displayName
        }
      ])
      .select('id, recording_id, user_id, content, created_at, display_name')
      .single();
    if (!error && data) {
      setComments(prev => ({
        ...prev,
        [selectedRecording.id]: [...(prev[selectedRecording.id] || []), data]
      }));
      setAddCommentInput('');
      setAddCommentModalOpen(false);
    }
    setAddCommentPosting(false);
  };

  // Helper for transcript download: show display_name if present in client line
  function getTranscriptDownloadText(rec: any) {
    let clientArr: any[] = [];
    if (Array.isArray(rec.clients)) {
      clientArr = rec.clients;
    } else if (rec.clients) {
      clientArr = [rec.clients];
    }
    const clientDisplayNames = clientArr.map((clientObj: any) => {
      if (!clientObj) return '';
      if (clientObj.first_name && clientObj.last_name) return `${clientObj.first_name} ${clientObj.last_name}`;
      if (clientObj.name) return clientObj.name;
      if (clientObj.email) return clientObj.email;
      return '';
    }).filter(Boolean);
    let clientLine = '';
    if (clientDisplayNames.length > 0 && rec.display_name) {
      if (clientDisplayNames.includes(rec.display_name)) {
        clientLine = clientDisplayNames.join(', ');
      } else {
        clientLine = `${clientDisplayNames.join(', ')} / ${rec.display_name}`;
      }
    } else if (clientDisplayNames.length > 0) {
      clientLine = clientDisplayNames.join(', ');
    } else if (rec.display_name) {
      clientLine = rec.display_name;
    } else if (rec.profiles?.display_name) {
      clientLine = rec.profiles.display_name;
    } else {
      clientLine = '-';
    }
    // If display_name is in clientLine, show it
    let displayName = rec.profiles?.display_name || '';
    let header = clientLine;
    if (displayName && clientLine.includes(displayName)) {
      header = displayName;
    }
    return `${header}\n\n${rec.transcript || 'No transcript'}`;
  }

  // Helper for comments download: show display_name if present in client line
  function getCommentsDownloadText(rec: any, commentsArr: any[]) {
    let clientArr: any[] = [];
    if (Array.isArray(rec.clients)) {
      clientArr = rec.clients;
    } else if (rec.clients) {
      clientArr = [rec.clients];
    }
    const clientDisplayNames = clientArr.map((clientObj: any) => {
      if (!clientObj) return '';
      if (clientObj.first_name && clientObj.last_name) return `${clientObj.first_name} ${clientObj.last_name}`;
      if (clientObj.name) return clientObj.name;
      if (clientObj.email) return clientObj.email;
      return '';
    }).filter(Boolean);
    let clientLine = '';
    if (clientDisplayNames.length > 0 && rec.display_name) {
      if (clientDisplayNames.includes(rec.display_name)) {
        clientLine = clientDisplayNames.join(', ');
      } else {
        clientLine = `${clientDisplayNames.join(', ')} / ${rec.display_name}`;
      }
    } else if (clientDisplayNames.length > 0) {
      clientLine = clientDisplayNames.join(', ');
    } else if (rec.display_name) {
      clientLine = rec.display_name;
    } else if (rec.profiles?.display_name) {
      clientLine = rec.profiles.display_name;
    } else {
      clientLine = '-';
    }
    let displayName = rec.profiles?.display_name || '';
    let header = clientLine;
    if (displayName && clientLine.includes(displayName)) {
      header = displayName;
    }
    const commentsText = commentsArr.length
      ? commentsArr.map((c: any) => `${c.display_name || 'User'}: ${c.content}`).join('\n')
      : 'No comments';
    return `${header}\n\n${commentsText}`;
  }

  // --- Play/Stop button logic ---
  const handlePlayStop = () => {
    if (!previewVideoRef.current) return;
    if (isPlaying) {
      previewVideoRef.current.pause();
      setIsPlaying(false);
    } else {
      previewVideoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  // Always show preview panel, show placeholder if nothing selected
  const previewContent = selectedRecording ? (
    <>
      <div style={{ width: '100%', marginBottom: 16 }}>
        <video
          ref={previewVideoRef}
          src={selectedRecording.video_url}
          style={{ width: '100%', borderRadius: 8, background: '#000' }}
          controls={false}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>
      {/* Play/Stop button */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <button
          onClick={handlePlayStop}
          style={{
            background: isPlaying ? palette.accent3 : palette.accent2,
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: 48,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 700,
            boxShadow: isPlaying ? '0 2px 8px #e5393533' : '0 2px 8px #28a74533',
            cursor: 'pointer',
            marginBottom: 8,
            transition: 'background 0.2s'
          }}
          title={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? (
            <span style={{ fontSize: 28, fontWeight: 900 }}>■</span>
          ) : (
            <span style={{ fontSize: 28, fontWeight: 900 }}>▶</span>
          )}
        </button>
      </div>
      <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 2, color: palette.text }}>
        {(() => {
          let clientArr: any[] = [];
          if (Array.isArray(selectedRecording.clients)) {
            clientArr = selectedRecording.clients;
          } else if (selectedRecording.clients) {
            clientArr = [selectedRecording.clients];
          }
          const clientDisplayNames = clientArr.map((clientObj: any) => {
            if (!clientObj) return '';
            if (clientObj.first_name && clientObj.last_name) return `${clientObj.first_name} ${clientObj.last_name}`;
            if (clientObj.name) return clientObj.name;
            if (clientObj.email) return clientObj.email;
            return '';
          }).filter(Boolean);
          let clientLine = '';
          if (clientDisplayNames.length > 0 && selectedRecording.display_name) {
            if (clientDisplayNames.includes(selectedRecording.display_name)) {
              clientLine = clientDisplayNames.join(', ');
            } else {
              clientLine = `${clientDisplayNames.join(', ')} / ${selectedRecording.display_name}`;
            }
          } else if (clientDisplayNames.length > 0) {
            clientLine = clientDisplayNames.join(', ');
          } else if (selectedRecording.display_name) {
            clientLine = selectedRecording.display_name;
          } else if (selectedRecording.profiles?.display_name) {
            clientLine = selectedRecording.profiles.display_name;
          } else {
            clientLine = '-';
          }
          return clientLine;
        })()}
      </div>
      <div style={{ color: palette.textSecondary, fontSize: 15, marginBottom: 2 }}>
        By: {selectedRecording.profiles?.display_name || '-'}
      </div>
      <div style={{ color: palette.textSecondary, fontSize: 14, marginBottom: 16 }}>
        {selectedRecording.created_at ? new Date(selectedRecording.created_at).toLocaleString() : '-'}
      </div>
      {/* Add Comment Button */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 8 }}>
        <button
          style={{
            background: palette.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '8px 24px',
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer'
          }}
          onClick={async () => {
            // Get display_name for by line
            let displayName = '';
            const { data: userData } = await supabase.auth.getUser();
            const userId = userData?.user?.id;
            if (userId) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('id', userId)
                .maybeSingle();
              displayName = profile?.display_name || userData.user?.email || 'User';
            }
            setAddCommentBy(displayName);
            setAddCommentInput('');
            setAddCommentModalOpen(true);
          }}
        >
          Add Comment
        </button>
      </div>
      {/* Comments Section in Modal Style */}
      <div style={{ width: '100%', marginTop: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 10, color: palette.text, textAlign: 'center' }}>
          Comments
        </div>
        {Array.isArray(comments[selectedRecording.id]) && comments[selectedRecording.id].length > 0 ? (
          comments[selectedRecording.id]
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .map((c: any) => (
              <div key={c.id} style={modalCommentBoxStyle}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2, color: palette.text }}>
                  {c.display_name || 'User'}
                  <span style={{ color: palette.textSecondary, fontWeight: 400, fontSize: 13, marginLeft: 8 }}>
                    {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
                  </span>
                </div>
                <div style={{ fontSize: 15, color: palette.text, whiteSpace: 'pre-line' }}>
                  {c.content}
                </div>
              </div>
            ))
        ) : (
          <div style={{
            color: palette.textSecondary,
            fontSize: 15,
            textAlign: 'center',
            marginTop: 12,
            marginBottom: 12
          }}>
            No comments yet.
          </div>
        )}
      </div>
      {/* Add Comment Modal */}
      {addCommentModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: darkMode ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.32)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: palette.modalBg,
            color: palette.modalText,
            borderRadius: 10,
            maxWidth: 400,
            width: '90%',
            padding: 32,
            boxShadow: palette.modalShadow,
            position: 'relative',
            border: `1px solid ${palette.modalBorder}`
          }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, color: palette.modalText }}>Add Comment</h3>
            <div style={{ marginBottom: 12, color: palette.textSecondary, fontSize: 15 }}>
              By: <span style={{ color: palette.text, fontWeight: 600 }}>{addCommentBy}</span>
            </div>
            <textarea
              value={addCommentInput}
              onChange={e => setAddCommentInput(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                borderRadius: 6,
                border: `1px solid ${palette.inputBorder}`,
                background: palette.inputBg,
                color: palette.inputText,
                fontSize: 15,
                padding: 8,
                marginBottom: 16,
                resize: 'vertical'
              }}
              placeholder="Enter your comment..."
              disabled={addCommentPosting}
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={handlePostCommentModal}
                disabled={addCommentPosting || !addCommentInput.trim()}
                style={{
                  background: palette.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '8px 24px',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: addCommentPosting || !addCommentInput.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                Post
              </button>
              <button
                onClick={() => setAddCommentModalOpen(false)}
                style={{
                  background: palette.accent3,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '8px 24px',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  ) : (
    <div style={{ width: '100%', textAlign: 'center', color: palette.textSecondary, minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Select a recording below to preview and add comments.
    </div>
  );

  // Fix: previewPlayerStyle must be defined!
  const previewPlayerStyle: React.CSSProperties = {
    width: 480,
    margin: '0 auto',
    marginBottom: 32,
    background: palette.card,
    borderRadius: 10,
    boxShadow: palette.shadow,
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    color: palette.text,
    border: `1px solid ${palette.border}`,
    transition: 'background 0.2s, color 0.2s'
  };

  // --- Card comments box style (unchanged for grid) ---
  const commentsBoxStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 32,
    maxHeight: 32,
    fontSize: 13,
    color: palette.text,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 6,
    border: `1px solid ${palette.inputBorder}`,
    background: palette.inputBg,
    overflow: 'hidden',
    lineHeight: '1.2',
    boxSizing: 'border-box',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    whiteSpace: 'pre-line'
  };

  return (
    <div style={{ background: palette.bg, minHeight: '100vh', paddingBottom: 32 }}>
      {/* --- Preview Player (always present) --- */}
      <div ref={previewPanelRef} style={previewPlayerStyle}>
        {previewContent}
      </div>
      {/* --- End Preview Player --- */}
      <div style={{ width: 480, margin: '0 auto', marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
        <input
          type="text"
          placeholder="Search by member name, email, or recorder..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginTop: 24,
          justifyContent: 'center',
          alignItems: 'stretch',
          width: '100%',
          marginLeft: 0,
          marginRight: 0
        }}
      >
        {filteredRecordings.length === 0 && !loading ? (
          <div style={{ color: palette.textSecondary, fontSize: 16, textAlign: 'center', margin: '32px 0' }}>No recordings to display yet.</div>
        ) : (
          filteredRecordings
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map(rec => {
              let clientArr: any[] = [];
              if (Array.isArray(rec.clients)) {
                clientArr = rec.clients;
              } else if (rec.clients) {
                clientArr = [rec.clients];
              }
              const clientDisplayNames = clientArr.map((clientObj: any) => {
                if (!clientObj) return '';
                if (clientObj.first_name && clientObj.last_name) return `${clientObj.first_name} ${clientObj.last_name}`;
                if (clientObj.name) return clientObj.name;
                if (clientObj.email) return clientObj.email;
                return '';
              }).filter(Boolean);

              // Compose the client line: show both account name(s) and display_name if present and not duplicate
              let clientLine = '';
              if (clientDisplayNames.length > 0 && rec.display_name) {
                // Avoid duplicate if display_name is already in clientDisplayNames
                if (clientDisplayNames.includes(rec.display_name)) {
                  clientLine = clientDisplayNames.join(', ');
                } else {
                  clientLine = `${clientDisplayNames.join(', ')} / ${rec.display_name}`;
                }
              } else if (clientDisplayNames.length > 0) {
                clientLine = clientDisplayNames.join(', ');
              } else if (rec.display_name) {
                clientLine = rec.display_name;
              } else if (rec.profiles?.display_name) {
                clientLine = rec.profiles.display_name;
              } else {
                clientLine = '-';
              }

              const displayName = rec.profiles?.display_name || '-';
              const createdAt = rec.created_at ? new Date(rec.created_at).toLocaleString() : '-';
              const transcript = rec.transcript || '';
              const maxChars = 180;
              const isTruncated = transcript.length > maxChars;
              const truncatedTranscript = isTruncated
                ? transcript.slice(0, maxChars).replace(/\n/g, ' ') + '...'
                : transcript;
              const cardTitle = `${clientDisplayNames.length > 0 ? clientDisplayNames.join(',') : 'Recording'}-by-${displayName.replace(/\s+/g, '')}-${formatDateForFilename(rec.created_at)}`;

              // Comments field: show first 2 lines of comments, truncated
              const recComments = comments[rec.id] || [];
              let commentsText = '';
              if (recComments.length > 0) {
                commentsText = recComments
                  .map((c: any) => `${c.display_name || 'User'}: ${c.content}`)
                  .join('\n');
              } else {
                commentsText = 'No comments';
              }

              return (
                <div
                  key={rec.id}
                  style={cardStyle}
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
                    <div style={{ width: '100%', height: 135, background: palette.inputBg, borderRadius: 8, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: palette.textSecondary }}>No Video</div>
                  )}
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2, color: palette.text }}>
                    {clientLine}
                  </div>
                  <div style={{ color: palette.textSecondary, fontSize: 14, marginBottom: 2 }}>By: {displayName}</div>
                  <div style={{ color: palette.textSecondary, fontSize: 13, marginBottom: 8 }}>{createdAt}</div>
                  {/* Play, Download, URL buttons */}
                  <div style={{ width: '100%', display: 'flex', gap: 8, marginBottom: 8, justifyContent: 'center' }}>
                    <button
                      style={{
                        background: palette.accent,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 12px',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                      onClick={async e => {
                        e.stopPropagation();
                        setSelectedRecording(rec);
                        setTimeout(() => {
                          if (previewVideoRef.current) {
                            previewVideoRef.current.play().catch(() => {});
                          }
                          scrollToPreviewPanel();
                        }, 100);
                      }}
                    >
                      Play
                    </button>
                    <button
                      style={{
                        background: palette.accent2,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 12px',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        if (rec.video_url) {
                          FileSaver.saveAs(rec.video_url, `${cardTitle}.webm`);
                        }
                      }}
                    >
                      Download
                    </button>
                    <button
                      style={{
                        background: palette.accent4,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 12px',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        if (rec.video_url) {
                          navigator.clipboard.writeText(rec.video_url);
                        }
                      }}
                    >
                      URL
                    </button>
                  </div>
                  {/* Transcript label */}
                  <div style={{ width: '100%', textAlign: 'center', fontWeight: 600, marginBottom: 2, marginTop: 8 }}>Transcript</div>
                  <div style={transcriptBoxStyle}>
                    {transcript
                      ? truncatedTranscript
                      : <span style={{ color: palette.textSecondary }}>No transcript</span>
                    }
                  </div>
                  {/* Read More / Download Text links below transcript */}
                  <div style={{ width: '100%', display: 'flex', gap: 8, marginBottom: 8 }}>
                    <button
                      style={{
                        background: 'none',
                        color: palette.accent,
                        border: 'none',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        const text = getTranscriptDownloadText(rec);
                        setModalTranscript(text);
                        setModalTitle(cardTitle + ' (Transcript)');
                        setModalFilename(`${cardTitle}.txt`);
                        setModalOpen(true);
                      }}
                    >
                      Read More
                    </button>
                    <button
                      style={{
                        background: 'none',
                        color: palette.accent2,
                        border: 'none',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        const text = getTranscriptDownloadText(rec);
                        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                        FileSaver.saveAs(blob, `${cardTitle}.txt`);
                      }}
                    >
                      Download Text
                    </button>
                  </div>
                  {/* Comments label centered below transcript links */}
                  <div style={{ width: '100%', textAlign: 'center', fontWeight: 600, marginBottom: 4 }}>Comments</div>
                  <div style={commentsBoxStyle}>
                    {commentsText}
                  </div>
                  {/* Read More / Download Text links below comments field */}
                  <div style={{ width: '100%', display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center' }}>
                    <button
                      style={{
                        background: 'none',
                        color: palette.accent,
                        border: 'none',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        const text = getCommentsDownloadText(rec, comments[rec.id] || []);
                        setModalTranscript(text);
                        setModalTitle(cardTitle + ' (Comments)');
                        setModalFilename(`${cardTitle}-comments.txt`);
                        setModalOpen(true);
                      }}
                    >
                      Read More
                    </button>
                    <button
                      style={{
                        background: 'none',
                        color: palette.accent2,
                        border: 'none',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        const text = getCommentsDownloadText(rec, comments[rec.id] || []);
                        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                        FileSaver.saveAs(blob, `${cardTitle}-comments.txt`);
                      }}
                    >
                      Download Text
                    </button>
                  </div>
                  {/* Add Comment link below Read More / Download Text */}
                  <div style={{ width: '100%', textAlign: 'center', marginTop: 8 }}>
                    <a
                      href="#"
                      style={{
                        color: palette.accent,
                        textDecoration: 'underline',
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: 'pointer'
                      }}
                      onClick={async e => {
                        e.preventDefault();
                        setSelectedRecording(rec);
                        setTimeout(() => {
                          if (previewVideoRef.current) {
                            previewVideoRef.current.play().catch(() => {});
                          }
                          scrollToPreviewPanel();
                        }, 100);
                      }}
                    >
                      Add Comment
                    </a>
                  </div>
                </div>
              );
            })
        )}
      </div>
      {modalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: darkMode ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.32)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: palette.modalBg,
            color: palette.modalText,
            borderRadius: 10,
            maxWidth: 480,
            width: '90%',
            padding: 32,
            boxShadow: palette.modalShadow,
            position: 'relative',
            border: `1px solid ${palette.modalBorder}`
          }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, color: palette.modalText }}>{modalTitle}</h3>
            <div style={{
              maxHeight: 340,
              overflowY: 'auto',
              whiteSpace: 'pre-line',
              fontSize: 15,
              color: palette.modalText,
              marginBottom: 24
            }}>
              {/* Modal "Read More" for Comments: show each comment in its own box */}
              {modalTitle.endsWith('(Comments)') && modalTranscript && modalTranscript !== 'No comments' ? (
                <div>
                  {modalTranscript
                    .split('\n')
                    .slice(1) // skip header
                    .filter(Boolean)
                    .map((line, idx) => (
                      <div key={idx} style={modalCommentBoxStyle}>
                        {line}
                      </div>
                    ))}
                </div>
              ) : (
                modalTranscript
              )}
            </div>
            <button
              onClick={() => {
                const text = modalTranscript || 'No transcript';
                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                FileSaver.saveAs(blob, modalFilename || 'transcript.txt');
              }}
              style={{
                background: 'none',
                color: palette.accent2,
                border: 'none',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: 600,
                marginRight: 16,
                position: 'absolute',
                left: 32,
                bottom: 24
              }}
            >
              Download Text
            </button>
            <button
              onClick={() => setModalOpen(false)}
              style={{
                background: palette.accent,
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '10px 28px',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                position: 'absolute',
                right: 24,
                bottom: 24
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* Add Comment Modal for preview panel */}
      {addCommentModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: darkMode ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.32)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: palette.modalBg,
            color: palette.modalText,
            borderRadius: 10,
            maxWidth: 400,
            width: '90%',
            padding: 32,
            boxShadow: palette.modalShadow,
            position: 'relative',
            border: `1px solid ${palette.modalBorder}`
          }}>
            <h3 style={{ marginTop: 0, marginBottom: 16, color: palette.modalText }}>Add Comment</h3>
            <div style={{ marginBottom: 12, color: palette.textSecondary, fontSize: 15 }}>
              By: <span style={{ color: palette.text, fontWeight: 600 }}>{addCommentBy}</span>
            </div>
            <textarea
              value={addCommentInput}
              onChange={e => setAddCommentInput(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                borderRadius: 6,
                border: `1px solid ${palette.inputBorder}`,
                background: palette.inputBg,
                color: palette.inputText,
                fontSize: 15,
                padding: 8,
                marginBottom: 16,
                resize: 'vertical'
              }}
              placeholder="Enter your comment..."
              disabled={addCommentPosting}
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                onClick={handlePostCommentModal}
                disabled={addCommentPosting || !addCommentInput.trim()}
                style={{
                  background: palette.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '8px 24px',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: addCommentPosting || !addCommentInput.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                Post
              </button>
              <button
                onClick={() => setAddCommentModalOpen(false)}
                style={{
                  background: palette.accent3,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '8px 24px',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* No bottom Stop Recording button, handled by Play/Stop above */}
    </div>
  );
}

export default ScreenRecorder;