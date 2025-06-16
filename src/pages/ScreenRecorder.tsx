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
        accent4: '#ff9800', // orange for URL
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
        accent4: '#ff9800', // orange for URL
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
  const [recording, setRecording] = useState(false);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTranscript, setModalTranscript] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [modalFilename, setModalFilename] = useState('');
  const [modalComments, setModalComments] = useState<string[]>([]);
  const [modalShowComments, setModalShowComments] = useState(false);
  const [addCommentOpen, setAddCommentOpen] = useState(false);
  const [addCommentText, setAddCommentText] = useState('');
  const [addCommentBy, setAddCommentBy] = useState('');
  const [addCommentLoading, setAddCommentLoading] = useState(false);
  const [addCommentError, setAddCommentError] = useState('');
  const [previewVideoPlaying, setPreviewVideoPlaying] = useState(false);

  // Comments state for preview cards
  const [firstComment, setFirstComment] = useState<string>('');
  const [firstCommentLoading, setFirstCommentLoading] = useState(false);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  // --- Fetch display_name from profiles for default By field ---
  const [profileDisplayName, setProfileDisplayName] = useState<string>('');
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    const fetchProfileDisplayName = async () => {
      setProfileLoaded(false);
      // Fix: handle user as string or object
      const userId = typeof user === 'string' ? user : user?.id;
      if (!userId) {
        setProfileDisplayName('');
        setProfileLoaded(true);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .single();
      if (!error && data && data.display_name) {
        setProfileDisplayName(data.display_name);
      } else if (typeof user === 'object' && user?.user_metadata?.display_name) {
        setProfileDisplayName(user.user_metadata.display_name);
      } else if (typeof user === 'object' && user.email) {
        setProfileDisplayName(user.email);
      } else {
        setProfileDisplayName('');
      }
      setProfileLoaded(true);
    };
    fetchProfileDisplayName();
  }, [user]);

  // Always set By field to display_name from profile when modal opens or display_name changes
  useEffect(() => {
    if (addCommentOpen && profileLoaded && !addCommentBy) {
      if (typeof user === 'object') {
        setAddCommentBy(profileDisplayName || user?.user_metadata?.display_name || user?.email || '');
      } else {
        setAddCommentBy(profileDisplayName || '');
      }
    }
  }, [addCommentOpen, profileDisplayName, user, profileLoaded, addCommentBy]);

  useEffect(() => {
    if (previewVideoRef.current) {
      previewVideoRef.current.pause();
      previewVideoRef.current.currentTime = 0;
      setPreviewVideoPlaying(false);
    }
  }, [selectedRecording]);

  useEffect(() => {
    const fetchFirstComment = async () => {
      setFirstComment('');
      if (!selectedRecording?.id) return;
      setFirstCommentLoading(true);
      const { data, error } = await supabase
        .from('comments')
        .select('content, display_name')
        .eq('recording_id', selectedRecording.id)
        .order('created_at', { ascending: true })
        .limit(1);
      if (!error && data && data.length > 0) {
        // Only show the first line and indicate truncation if multi-line
        const content = data[0].content;
        const lines = content.split('\n');
        let preview = `By: ${data[0].display_name}\n${lines[0]}`;
        if (lines.length > 1) preview += ' ...';
        setFirstComment(preview);
      } else {
        setFirstComment('');
      }
      setFirstCommentLoading(false);
    };
    fetchFirstComment();
  }, [selectedRecording?.id]);

  useEffect(() => {
    const fetchRecordings = async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) { setRecordings([]); setLoading(false); return; }
      let query = supabase
        .from('recordings')
        .select('id, user_id, video_url, created_at, client_id, clients:client_id (name, email, first_name, last_name), profiles:user_id (display_name, email), transcript')
        .order('created_at', { ascending: false })
        .eq('user_id', userId);
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

  useEffect(() => {
    const handler = (e: any) => {
      const url = e.detail;
      if (!url) return;
      const found = recordings.find(r => r.video_url === url);
      if (found) setSelectedRecording(found);
    };
    window.addEventListener('sparky-auto-select-recording', handler);
    return () => window.removeEventListener('sparky-auto-select-recording', handler);
  }, [recordings]);

  useEffect(() => {
    if (recordedVideoUrl && recordings.length > 0) {
      const found = recordings.find(r => r.video_url === recordedVideoUrl);
      if (found) setSelectedRecording(found);
    }
  }, [recordedVideoUrl, recordings]);

  useEffect(() => {
    if (!recordedVideoUrl) return;
    const fetchAndSelect = async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) { setRecordings([]); setLoading(false); return; }
      let query = supabase
        .from('recordings')
        .select('id, user_id, video_url, created_at, client_id, clients:client_id (name, email, first_name, last_name), profiles:user_id (display_name, email), transcript')
        .order('created_at', { ascending: false })
        .eq('user_id', userId);
      const { data, error } = await query;
      if (!error && data) {
        setRecordings(data);
        const found = data.find(r => r.video_url === recordedVideoUrl);
        if (found) setSelectedRecording(found);
      }
      setLoading(false);
    };
    fetchAndSelect();
  }, [recordedVideoUrl]);

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
    width: 480,
    background: palette.card,
    borderRadius: 10,
    boxShadow: palette.shadow,
    padding: 24,
    margin: '0 auto',
    marginBottom: 32,
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

  const previewPlaceholderStyle: React.CSSProperties = {
    width: '100%',
    height: 220,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: palette.textSecondary,
    background: darkMode ? '#23262f' : '#f5f5f5',
    borderRadius: 8
  };

  const recordingCardStyle = (selected: boolean): React.CSSProperties => ({
    width: 240,
    background: selected ? palette.accent5 : palette.card,
    borderRadius: 10,
    boxShadow: selected ? '0 4px 16px #1976d233' : palette.shadow,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    border: selected ? `2px solid ${palette.accent}` : '2px solid transparent',
    color: palette.text,
    transition: 'background 0.2s, color 0.2s, border 0.2s'
  });

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

  const commentBoxStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 40,
    maxHeight: 60,
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
    whiteSpace: 'pre-line',
    textAlign: 'left'
  };

  // Fetch all comments for modal
  const fetchAllComments = async (recordingId: string) => {
    const { data, error } = await supabase
      .from('comments')
      .select('content, display_name, created_at')
      .eq('recording_id', recordingId)
      .order('created_at', { ascending: true });
    if (!error && data && data.length > 0) {
      setModalComments(data.map((c: any) => `By: ${c.display_name}\n${c.content}`));
    } else {
      setModalComments([]);
    }
  };

  // Add comment handler
  const handleAddComment = async () => {
    setAddCommentError('');
    if (!addCommentText.trim()) {
      setAddCommentError('Comment cannot be empty.');
      return;
    }
    if (!addCommentBy.trim()) {
      setAddCommentError('By field cannot be empty.');
      return;
    }
    // Debug: log selectedRecording before check
    console.log('selectedRecording:', selectedRecording);
    // Fix: handle user as string or object
    let commentUserId = typeof user === 'string' ? user : user?.id;
    console.log('user:', user);
    if (!selectedRecording?.id) {
      setAddCommentError('Not authorized.');
      return;
    }
    setAddCommentLoading(true);

    let displayNameToSave = addCommentBy;

    // Always try to fetch the latest display_name from profiles for this user
    if (commentUserId) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', commentUserId)
        .single();
      if (!profileError && profile && profile.display_name) {
        displayNameToSave = profile.display_name;
      }
    }

    if (!commentUserId) {
      setAddCommentError('Not authorized.');
      setAddCommentLoading(false);
      return;
    }

    // Ensure we use user_id and not id for the user reference
    const { data, error } = await supabase
      .from('comments')
      .insert([{
        recording_id: selectedRecording.id,
        user_id: commentUserId, // <-- always use user_id for the user reference
        content: addCommentText.trim(),
        display_name: displayNameToSave
      }])
      .select();

    setAddCommentLoading(false);

    if (error || !data) {
      setAddCommentError(error?.message || 'Failed to add comment.');
    } else {
      setAddCommentText('');
      setAddCommentOpen(false);
      if (modalShowComments && selectedRecording) {
        fetchAllComments(selectedRecording.id);
      }
      setFirstCommentLoading(true);
      const { data: commentData, error: err } = await supabase
        .from('comments')
        .select('content, display_name')
        .eq('recording_id', selectedRecording.id)
        .order('created_at', { ascending: true })
        .limit(1);
      if (!err && commentData && commentData.length > 0) {
        // Only show the first line and indicate truncation if multi-line
        const content = commentData[0].content;
        const lines = content.split('\n');
        let preview = `By: ${commentData[0].display_name}\n${lines[0]}`;
        if (lines.length > 1) preview += ' ...';
        setFirstComment(preview);
      }
      setFirstCommentLoading(false);
    }
  };

  // Play video only on play button click
  const handlePlayPreview = () => {
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = 0;
      previewVideoRef.current.play();
      setPreviewVideoPlaying(true);
    }
  };

  // Download video
  const handleDownloadPreview = () => {
    if (selectedRecording?.video_url) {
      const a = document.createElement('a');
      a.href = selectedRecording.video_url;
      a.download = 'recording.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Copy URL
  const handleCopyUrl = () => {
    if (selectedRecording?.video_url) {
      navigator.clipboard.writeText(selectedRecording.video_url);
    }
  };

  // Card-level handlers for play/download/url
  const handleCardPlay = (videoUrl: string) => {
    if (previewVideoRef.current && selectedRecording?.video_url === videoUrl) {
      previewVideoRef.current.currentTime = 0;
      previewVideoRef.current.play();
      setPreviewVideoPlaying(true);
    } else {
      const found = recordings.find(r => r.video_url === videoUrl);
      if (found) setSelectedRecording(found);
      setTimeout(() => {
        if (previewVideoRef.current) {
          previewVideoRef.current.currentTime = 0;
          previewVideoRef.current.play();
          setPreviewVideoPlaying(true);
        }
      }, 100);
    }
  };
  const handleCardDownload = (videoUrl: string) => {
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = 'recording.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  const handleCardCopyUrl = (videoUrl: string) => {
    navigator.clipboard.writeText(videoUrl);
  };

  // --- Add Comment in preview: just open modal, do not play video ---
  const handleAddCommentOnly = () => {
    setAddCommentOpen(true);
  };

  // --- Card Add Comment: do nothing ---
  const handleCardAddComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Do nothing
  };

  // --- Helper for consistent preview title ---
  const getPreviewTitle = (rec: any) => {
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
    return clientDisplayNames.length > 0 ? clientDisplayNames.join(', ') : '';
  };

  return (
    <div style={{ background: palette.bg, minHeight: '100vh', paddingBottom: 32 }}>
      <div style={{ width: 480, margin: '0 auto', marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
        <input
          type="text"
          placeholder="Search by member name, email, or recorder..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={cardStyle}>
        <h3 style={{ color: palette.text }}>Recording Preview</h3>
        {selectedRecording && (
          <>
            {/* Title, By, Date */}
            <div style={{ width: '100%', textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: palette.text, marginBottom: 2 }}>
                {getPreviewTitle(selectedRecording)}
              </div>
              <div style={{ color: palette.textSecondary, fontSize: 15, marginBottom: 2 }}>
                By: {selectedRecording.profiles?.display_name || '-'}
              </div>
              <div style={{ color: palette.textSecondary, fontSize: 14, marginBottom: 8 }}>
                {selectedRecording.created_at
                  ? new Date(selectedRecording.created_at).toLocaleString()
                  : '6/14/2025, 3:27:37 PM'}
              </div>
            </div>
          </>
        )}
        {selectedRecording && selectedRecording.video_url ? (
          <video
            key={selectedRecording.video_url}
            ref={previewVideoRef}
            src={selectedRecording.video_url}
            controls
            style={{ width: '100%', borderRadius: 8, background: '#000' }}
            onPlay={() => setPreviewVideoPlaying(true)}
            onPause={() => setPreviewVideoPlaying(false)}
            onClick={e => e.preventDefault()}
            tabIndex={-1}
          />
        ) : (
          <div style={previewPlaceholderStyle}>
            Select a recording below to preview
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {selectedRecording && (
            <button
              onClick={() => setSelectedRecording(null)}
              style={{
                background: palette.accent,
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '8px 16px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Clear Preview
            </button>
          )}
        </div>
        {/* Comments preview below Read More/Download */}
        {selectedRecording && (
          <div style={{ width: '100%', marginTop: 16, textAlign: 'center' }}>
            <div style={{ fontWeight: 600, color: palette.text, marginBottom: 4 }}>Comments</div>
            <div style={commentBoxStyle}>
              {firstCommentLoading ? (
                <span style={{ color: palette.textSecondary }}>Loading...</span>
              ) : firstComment ? (
                firstComment
              ) : (
                <span style={{ color: palette.textSecondary }}>No comments yet.</span>
              )}
            </div>
            {/* Second set of Read More / Download Text below comments */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, width: '100%', justifyContent: 'flex-end' }}>
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
                onClick={async e => {
                  e.stopPropagation();
                  if (selectedRecording) {
                    const clientArr = Array.isArray(selectedRecording.clients)
                      ? selectedRecording.clients
                      : selectedRecording.clients
                      ? [selectedRecording.clients]
                      : [];
                    const clientDisplayNames = clientArr.map((clientObj: any) => {
                      if (!clientObj) return '';
                      if (clientObj.first_name && clientObj.last_name)
                        return `${clientObj.first_name} ${clientObj.last_name}`;
                      if (clientObj.name) return clientObj.name;
                      if (clientObj.email) return clientObj.email;
                      return '';
                    }).filter(Boolean);
                    const displayName = selectedRecording.profiles?.display_name || '-';
                    const cardTitle = `${clientDisplayNames.length > 0 ? clientDisplayNames.join(',') : 'Recording'}-by-${displayName.replace(/\s+/g, '')}-${formatDateForFilename(selectedRecording.created_at)}`;
                    setModalTitle(cardTitle + ' - Comments');
                    setModalFilename(`${cardTitle}-comments.txt`);
                    setModalShowComments(true);
                    await fetchAllComments(selectedRecording.id);
                    setModalOpen(true);
                  }
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
                onClick={async e => {
                  e.stopPropagation();
                  if (selectedRecording) {
                    // Download all comments as text
                    await fetchAllComments(selectedRecording.id);
                    setTimeout(() => {
                      const text = modalComments.length > 0 ? modalComments.join('\n\n---\n\n') : 'No comments';
                      const clientArr = Array.isArray(selectedRecording.clients)
                        ? selectedRecording.clients
                        : selectedRecording.clients
                        ? [selectedRecording.clients]
                        : [];
                      const clientDisplayNames = clientArr.map((clientObj: any) => {
                        if (!clientObj) return '';
                        if (clientObj.first_name && clientObj.last_name)
                          return `${clientObj.first_name} ${clientObj.last_name}`;
                        if (clientObj.name) return clientObj.name;
                        if (clientObj.email) return clientObj.email;
                        return '';
                      }).filter(Boolean);
                      const displayName = selectedRecording.profiles?.display_name || '-';
                      const cardTitle = `${clientDisplayNames.length > 0 ? clientDisplayNames.join(',') : 'Recording'}-by-${displayName.replace(/\s+/g, '')}-${formatDateForFilename(selectedRecording.created_at)}`;
                      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                      FileSaver.saveAs(blob, `${cardTitle}-comments.txt`);
                    }, 200);
                  }
                }}
              >
                Download Text
              </button>
            </div>
            {/* Add Comment link (in preview) */}
            <div style={{ width: '100%', marginTop: 10, display: 'flex', justifyContent: 'center' }}>
              <button
                style={{
                  background: 'none',
                  color: palette.accent4,
                  border: 'none',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 600
                }}
                onClick={handleAddCommentOnly}
              >
                Add Comment
              </button>
            </div>
            {/* Add Comment Modal */}
            {addCommentOpen && (
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
                  padding: 28,
                  boxShadow: palette.modalShadow,
                  position: 'relative',
                  border: `1px solid ${palette.modalBorder}`
                }}>
                  <h3 style={{ marginTop: 0, marginBottom: 16, color: palette.modalText }}>Add Comment</h3>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 4, color: palette.textSecondary, fontSize: 15, fontWeight: 600 }}>
                      By:
                    </label>
                    <input
                      type="text"
                      value={addCommentBy}
                      onChange={e => setAddCommentBy(e.target.value)}
                      style={{
                        width: '100%',
                        borderRadius: 6,
                        border: `1px solid ${palette.inputBorder}`,
                        background: palette.inputBg,
                        color: palette.inputText,
                        fontSize: 15,
                        padding: 10,
                        marginBottom: 0,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                      placeholder="Your name"
                    />
                  </div>
                  <textarea
                    value={addCommentText}
                    onChange={e => setAddCommentText(e.target.value)}
                    rows={4}
                    style={{
                      width: '100%',
                      borderRadius: 6,
                      border: `1px solid ${palette.inputBorder}`,
                      background: palette.inputBg,
                      color: palette.inputText,
                      fontSize: 15,
                      padding: 10,
                      marginBottom: 12,
                      resize: 'vertical'
                    }}
                    placeholder="Type your comment here..."
                  />
                  {addCommentError && (
                    <div style={{ color: palette.accent3, marginBottom: 8, fontSize: 14 }}>{addCommentError}</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                      onClick={() => setAddCommentOpen(false)}
                      style={{
                        background: palette.accent3,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '8px 18px',
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      disabled={addCommentLoading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddComment}
                      style={{
                        background: palette.accent2,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '8px 18px',
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      disabled={addCommentLoading}
                    >
                      {addCommentLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 24, justifyContent: 'center' }}>
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
              const displayName = rec.profiles?.display_name || '-';
              const createdAt = rec.created_at ? new Date(rec.created_at).toLocaleString() : '-';
              const transcript = rec.transcript || '';
              const maxChars = 180;
              const isTruncated = transcript.length > maxChars;
              const truncatedTranscript = isTruncated
                ? transcript.slice(0, maxChars).replace(/\n/g, ' ') + '...'
                : transcript;
              const cardTitle = `${clientDisplayNames.length > 0 ? clientDisplayNames.join(',') : 'Recording'}-by-${displayName.replace(/\s+/g, '')}-${formatDateForFilename(rec.created_at)}`;
              return (
                <div
                  key={rec.id}
                  style={recordingCardStyle(selectedRecording && selectedRecording.id === rec.id)}
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
                    {clientDisplayNames.length > 0 ? clientDisplayNames.join(', ') : ''}
                  </div>
                  <div style={{ color: palette.textSecondary, fontSize: 14, marginBottom: 2 }}>By: {displayName}</div>
                  <div style={{ color: palette.textSecondary, fontSize: 13, marginBottom: 8 }}>{createdAt}</div>
                  {/* Play/Download/URL buttons for card */}
                  {rec.video_url && (
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 8 }}>
                      <button
                        style={{
                          background: palette.accent,
                          color: '#fff',
                          border: 'none',
                          borderRadius: 50,
                          width: 36,
                          height: 36,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 18,
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px #1976d233'
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          handleCardPlay(rec.video_url);
                        }}
                        title="Play"
                      >
                        <span style={{ display: 'inline-block', marginLeft: 2 }}>▶</span>
                      </button>
                      <button
                        style={{
                          background: palette.accent2,
                          color: '#fff',
                          border: 'none',
                          borderRadius: 50,
                          width: 36,
                          height: 36,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 18,
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px #28a74533'
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          handleCardDownload(rec.video_url);
                        }}
                        title="Download"
                      >
                        <span style={{ display: 'inline-block', fontSize: 18, fontWeight: 700 }}>
                          <svg width="18" height="18" viewBox="0 0 22 22" style={{ display: 'block' }}>
                            <path d="M11 3v10m0 0l-4-4m4 4l4-4" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                            <rect x="5" y="17" width="12" height="2" rx="1" fill="#fff"/>
                          </svg>
                        </span>
                      </button>
                      <button
                        style={{
                          background: palette.accent4,
                          color: '#fff',
                          border: 'none',
                          borderRadius: 50,
                          width: 46,
                          height: 36,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px #ff980033'
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          handleCardCopyUrl(rec.video_url);
                        }}
                        title="Copy URL"
                      >
                        <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>URL</span>
                      </button>
                    </div>
                  )}
                  {/* Transcript label */}
                  <div style={{ fontWeight: 600, color: palette.text, margin: '8px 0 0 0', width: '100%', textAlign: 'center' }}>
                    Transcript
                  </div>
                  <div style={transcriptBoxStyle}>
                    {transcript
                      ? truncatedTranscript
                      : <span style={{ color: palette.textSecondary }}>No transcript</span>
                    }
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, width: '100%', justifyContent: 'flex-end' }}>
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
                        setModalTranscript(transcript || 'No transcript');
                        setModalTitle(cardTitle);
                        setModalFilename(`${cardTitle}.txt`);
                        setModalShowComments(false);
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
                        const text = transcript || 'No transcript';
                        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                        FileSaver.saveAs(blob, `${cardTitle}.txt`);
                      }}
                    >
                      Download Text
                    </button>
                  </div>
                  {/* Comments preview below transcript */}
                  <div style={{ width: '100%', marginTop: 16, textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: palette.text, marginBottom: 4 }}>Comments</div>
                    <CommentPreview recordingId={rec.id} palette={palette} />
                    {/* Second set of Read More / Download Text below comments */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, width: '100%', justifyContent: 'flex-end' }}>
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
                        onClick={async e => {
                          e.stopPropagation();
                          setModalShowComments(true);
                          setModalTitle(cardTitle + ' - Comments');
                          setModalFilename(`${cardTitle}-comments.txt`);
                          await fetchAllComments(rec.id);
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
                        onClick={async e => {
                          e.stopPropagation();
                          await fetchAllComments(rec.id);
                          setTimeout(() => {
                            const text = modalComments.length > 0 ? modalComments.join('\n\n---\n\n') : 'No comments';
                            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                            FileSaver.saveAs(blob, `${cardTitle}-comments.txt`);
                          }, 200);
                        }}
                      >
                        Download Text
                      </button>
                    </div>
                    {/* Play Video to Add Comment link */}
                    <div style={{ width: '100%', marginTop: 10, display: 'flex', justifyContent: 'center' }}>
                      <button
                        style={{
                          background: 'none',
                          color: palette.accent4,
                          border: 'none',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          fontSize: 15,
                          fontWeight: 600
                        }}
                        onClick={handleCardAddComment}
                      >
                        Play Video to Add Comment
                      </button>
                    </div>
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
              {modalShowComments ? (
                modalComments.length > 0 ? (
                  <div>
                    {modalComments.map((c, idx) => (
                      <div key={idx} style={{
                        marginBottom: 18,
                        padding: 12,
                        background: darkMode ? '#23262f' : '#f5f5f5',
                        borderRadius: 6,
                        border: `1px solid ${palette.inputBorder}`,
                        maxHeight: 120,
                        overflowY: 'auto'
                      }}>
                        {c}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: palette.textSecondary }}>No comments yet.</span>
                )
              ) : (
                modalTranscript
              )}
            </div>
            <button
              onClick={() => {
                if (modalShowComments) {
                  const text = modalComments.length > 0 ? modalComments.join('\n\n---\n\n') : 'No comments';
                  FileSaver.saveAs(new Blob([text], { type: 'text/plain;charset=utf-8' }), modalFilename || 'comments.txt');
                } else {
                  const text = modalTranscript || 'No transcript';
                  FileSaver.saveAs(new Blob([text], { type: 'text/plain;charset=utf-8' }), modalFilename || 'transcript.txt');
                }
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
      {(recording) ? (
        <div style={{ display: 'flex', gap: 12, marginTop: 32, justifyContent: 'center' }}>
          <button
            onClick={() => {
              setRecording(false);
            }}
            style={{ background: palette.accent3, color: '#fff', border: 'none', borderRadius: 6, padding: '12px 28px', fontSize: 18, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px #dc354522' }}
          >
            Stop Recording
          </button>
        </div>
      ) : null}
    </div>
  );
};

// Helper component for comment preview in cards
const CommentPreview: React.FC<{ recordingId: string; palette: any }> = ({ recordingId, palette }) => {
  const [comment, setComment] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchFirstComment = async () => {
      setComment('');
      setLoading(true);
      const { data, error } = await supabase
        .from('comments')
        .select('content, display_name')
        .eq('recording_id', recordingId)
        .order('created_at', { ascending: true })
        .limit(1);
      if (!error && data && data.length > 0) {
        // Only show the first line and indicate truncation if multi-line
        const content = data[0].content;
        const lines = content.split('\n');
        let preview = `By: ${data[0].display_name}\n${lines[0]}`;
        if (lines.length > 1) preview += ' ...';
        setComment(preview);
      } else {
        setComment('');
      }
      setLoading(false);
    };
    fetchFirstComment();
  }, [recordingId]);

  // Truncate to 3 lines
  const commentBoxStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 40,
    maxHeight: 60,
    resize: 'none',
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
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    whiteSpace: 'pre-line',
    textAlign: 'left'
  };

  return (
    <div style={commentBoxStyle}>
      {loading ? (
        <span style={{ color: palette.textSecondary }}>Loading...</span>
      ) : comment ? (
        comment
      ) : (
        <span style={{ color: palette.textSecondary }}>No comments yet.</span>
      )}
    </div>
  );
};

export default ScreenRecorder;