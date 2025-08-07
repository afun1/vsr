// Vercel cache bust: 2025-06-05
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../auth/supabaseClient';
import Header from '../Header';
import { useAuth } from '../auth/AuthContext';

// --- Dark mode hook ---
const useDarkMode = () => {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
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

const RECORDINGS_PER_PAGE_OPTIONS = [20, 40, 60, 80, 100, 'All'];

// --- CommentsPreview component for table ---
const CommentsPreview: React.FC<{
  recordingId: string;
  palette: any;
  onReadMore: (comments: string[]) => void;
  onDownload: (comments: string[]) => void;
  refreshTrigger?: number;
}> = ({
  recordingId,
  palette,
  onReadMore,
  onDownload,
  refreshTrigger
}) => {
  const [comments, setComments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchComments = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('comments')
        .select('content, display_name')
        .eq('recording_id', recordingId)
        .order('created_at', { ascending: true });
      if (!error && data && mounted) {
        setComments(
          data.map((c: any) => `By: ${c.display_name}\n${c.content}`)
        );
      } else if (mounted) {
        setComments([]);
      }
      setLoading(false);
    };
    fetchComments();
    return () => {
      mounted = false;
    };
  }, [recordingId, refreshTrigger]);

  let preview = '';
  if (comments.length > 0) {
    const lines = comments[0].split('\n');
    preview = lines.slice(0, 2).join('\n');
    if (lines.length > 2) preview += ' ...';
  }

  return (
    <div style={{ color: palette.text, fontSize: 13, whiteSpace: 'pre-line', maxWidth: 320 }}>
      <div
        style={{
          minHeight: 32,
          maxHeight: 38,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          whiteSpace: 'pre-line'
        }}
      >
        {loading ? (
          <span style={{ color: palette.textSecondary }}>Loading...</span>
        ) : comments.length > 0 ? (
          preview
        ) : (
          <span style={{ color: palette.textSecondary }}>No comments yet.</span>
        )}
      </div>
      <div style={{ marginTop: 4 }}>
        <a
          href="#"
          style={{ color: palette.accent, marginRight: 12, fontSize: 13 }}
          onClick={e => {
            e.preventDefault();
            onReadMore(comments);
          }}
        >
          Read More
        </a>
        <a
          href="#"
          style={{ color: palette.accent, fontSize: 13 }}
          onClick={e => {
            e.preventDefault();
            onDownload(comments);
          }}
        >
          Download Text
        </a>
      </div>
    </div>
  );
};

// --- RecordingPreview copied from RecordingPanel ---
const RecordingPreview: React.FC<{ recording: any; palette: any; onAddComment: () => void }> = ({ recording, palette, onAddComment }) => {
  if (!recording) return null;
  return (
    <div style={{
      width: 480,
      background: palette.card,
      borderRadius: 10,
      boxShadow: palette.shadow,
      padding: 24,
      margin: '0px auto 32px',
      color: palette.text,
      border: `1px solid ${palette.border}`,
      transition: 'background 0.2s, color 0.2s'
    }}>
      <h3 style={{ color: palette.text, marginBottom: 8 }}>Recording Preview</h3>
      {recording.video_url && (
        <video
          src={recording.video_url}
          controls
          style={{ width: '100%', maxWidth: 420, marginBottom: 12, background: '#000', borderRadius: 6 }}
        />
      )}
      <div style={{ marginBottom: 8 }}>
        <strong>Client Name:</strong>{' '}
        {recording.clients?.name || '-'}
      </div>
      <div style={{ marginBottom: 8 }}>
        <strong>By:</strong> {recording.profiles?.display_name || '-'}
      </div>
      <div style={{ marginBottom: 8 }}>
        <strong>Date:</strong> {recording.created_at ? new Date(recording.created_at).toLocaleString() : '-'}
      </div>
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
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
          onClick={onAddComment}
        >
          Add Comment
        </button>
      </div>
    </div>
  );
};

const RecordingsManagement: React.FC = () => {
  const darkMode = useDarkMode();
  const { user } = useAuth();
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

  const [recordings, setRecordings] = useState<any[]>([]);
  const [recordingSearch, setRecordingSearch] = useState('');
  const [recordingPage, setRecordingPage] = useState(1);
  const [recordingsPerPage, setRecordingsPerPage] = useState(RECORDINGS_PER_PAGE_OPTIONS[0]);
  const [selectedRecordingIds, setSelectedRecordingIds] = useState<string[]>([]);
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Date range state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modal state for transcript/comments
  const [modalTranscript, setModalTranscript] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState<string | null>(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  // Comments modal
  const [modalComments, setModalComments] = useState<string[]>([]);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [modalCommentsFilename, setModalCommentsFilename] = useState<string>('');

  // Preview panel state
  const [previewRecording, setPreviewRecording] = useState<any | null>(null);

  // Add Comment Modal state
  const [showAddCommentModal, setShowAddCommentModal] = useState(false);
  const [addCommentText, setAddCommentText] = useState('');
  const [addCommentDisplayName, setAddCommentDisplayName] = useState('');
  const [addCommentBy, setAddCommentBy] = useState('');
  const [addCommentDisplayNameLoading, setAddCommentDisplayNameLoading] = useState(true);

  // For triggering comments refresh after adding a comment
  const [commentsRefreshMap, setCommentsRefreshMap] = useState<{ [recordingId: string]: number }>({});

  // For keeping track of which recording's comments should refresh
  const lastCommentedRecordingId = useRef<string | null>(null);

  // Fetch display_name for the current user for the Add Comment modal
  useEffect(() => {
    const fetchDisplayName = async () => {
      setAddCommentDisplayNameLoading(true);
      let displayName = '';
      const userId = typeof user === 'string' ? user : null;
      if (userId) {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', userId)
          .maybeSingle();
        if (!error && data && data.display_name && data.display_name.trim() !== '') {
          displayName = data.display_name;
        } else {
          // Fallback to getting user info from Supabase auth
          const { data: userData } = await supabase.auth.getUser();
          if (userData.user?.user_metadata?.full_name) {
            displayName = userData.user.user_metadata.full_name;
          } else if (userData.user?.email) {
            displayName = userData.user.email;
          }
        }
      }
      setAddCommentDisplayName(displayName);
      setAddCommentBy(displayName);
      setAddCommentDisplayNameLoading(false);
    };
    fetchDisplayName();
  }, [user]);

  useEffect(() => {
    if (showAddCommentModal) {
      setAddCommentBy(addCommentDisplayName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddCommentModal, addCommentDisplayName]);

  useEffect(() => {
    const fetchRecordings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('recordings')
        .select(
          `id, video_url, transcript, created_at, client_id, user_id, clients:client_id (name), profiles:user_id (display_name)`
        )
        .order('created_at', { ascending: false });
      if (!error && data) setRecordings(data);
      setLoading(false);
    };
    fetchRecordings();
  }, []);

  // --- Date range filter logic ---
  function isWithinDateRange(dateStr: string) {
    if (!dateStr) return true;
    const date = new Date(dateStr);
    if (dateFrom && date < new Date(dateFrom)) return false;
    if (dateTo) {
      // Add 1 day to include the end date fully
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (date > end) return false;
    }
    return true;
  }

  const filteredRecordings = recordings.filter(r => {
    // Date range filter
    if (!isWithinDateRange(r.created_at)) return false;
    if (!recordingSearch) return true;
    const search = recordingSearch.toLowerCase();
    const recorderName = (r.profiles && r.profiles.display_name) ? r.profiles.display_name.toLowerCase() : '';
    const clientName = (r.clients && r.clients.name) ? r.clients.name.toLowerCase() : '';
    const videoUrl = (r.video_url || '').toLowerCase();
    const transcript = (r.transcript || '').toLowerCase();
    const idStr = r.id ? r.id.toString() : '';
    return (
      videoUrl.includes(search) ||
      transcript.includes(search) ||
      idStr.includes(search) ||
      recorderName.includes(search) ||
      clientName.includes(search)
    );
  });

  const perPage = recordingsPerPage === 'All' ? filteredRecordings.length || 1 : Number(recordingsPerPage);
  const recordingPageCount = Math.max(1, Math.ceil(filteredRecordings.length / perPage));
  const pagedRecordings = filteredRecordings.slice((recordingPage - 1) * perPage, recordingPage * perPage);

  useEffect(() => {
    if (recordingsPerPage === 'All') setRecordingPage(1);
  }, [recordingsPerPage]);

  function getTitle(clientName: string, displayName: string, createdAt: string) {
    // Vertical stack: name, display_name, created_at
    return (
      <div>
        <div><strong>Name:</strong> {clientName || '-'}</div>
        <div><strong>By:</strong> {displayName || '-'}</div>
        <div><strong>Date:</strong> {createdAt ? new Date(createdAt).toLocaleString() : '-'}</div>
      </div>
    );
  }

  function getCommentsFilename(clientName: string, displayName: string, dateStr: string, timeStr: string) {
    const safeClient = (clientName || '').replace(/[^a-zA-Z0-9-_]/g, '');
    const safeDisplay = (displayName || '').replace(/[^a-zA-Z0-9-_]/g, '');
    return `${safeClient}-by-${safeDisplay}-${dateStr}-at-${timeStr}-comments.txt`;
  }

  const openAddCommentModal = () => {
    setAddCommentText('');
    setShowAddCommentModal(true);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewRecording || !addCommentText.trim()) return;

    const displayName = addCommentBy || addCommentDisplayName || '';

    const { error } = await supabase.from('comments').insert([
      {
        recording_id: previewRecording.id,
        content: addCommentText,
        display_name: displayName
      }
    ]);
    if (!error) {
      setAddCommentText('');
      setShowAddCommentModal(false);

      lastCommentedRecordingId.current = previewRecording.id;
      setCommentsRefreshMap(prev => ({
        ...prev,
        [previewRecording.id]: (prev[previewRecording.id] || 0) + 1
      }));
    }
  };

  // --- Search input style ---
  const inputStyle: React.CSSProperties = {
    background: palette.inputBg,
    color: palette.inputText,
    border: `1px solid ${palette.inputBorder}`,
    borderRadius: 4,
    padding: '6px 14px',
    fontSize: 16,
    outline: 'none',
    transition: 'background 0.2s, color 0.2s, border 0.2s'
  };

  return (
    <>
      <Header />
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', paddingTop: 100, background: palette.bg, minHeight: '100vh', color: palette.text }}>
        <h3 style={{ color: palette.text }}>Recordings Management</h3>

        {/* --- Search Field + Date Range --- */}
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search recordings by client, user, transcript, or URL..."
            value={recordingSearch}
            onChange={e => {
              setRecordingSearch(e.target.value);
              setRecordingPage(1);
            }}
            style={{ ...inputStyle, width: 340 }}
          />
          <label style={{ color: palette.textSecondary, fontSize: 15 }}>
            From:{' '}
            <input
              type="date"
              value={dateFrom}
              onChange={e => {
                setDateFrom(e.target.value);
                setRecordingPage(1);
              }}
              style={{ ...inputStyle, width: 140, fontSize: 15, padding: '4px 10px', marginLeft: 4 }}
              max={dateTo || undefined}
            />
          </label>
          <label style={{ color: palette.textSecondary, fontSize: 15 }}>
            To:{' '}
            <input
              type="date"
              value={dateTo}
              onChange={e => {
                setDateTo(e.target.value);
                setRecordingPage(1);
              }}
              style={{ ...inputStyle, width: 140, fontSize: 15, padding: '4px 10px', marginLeft: 4 }}
              min={dateFrom || undefined}
            />
          </label>
          <button
            style={{
              background: palette.accent,
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              padding: '7px 18px',
              fontWeight: 600
            }}
            onClick={() => setRecordingPage(1)}
          >
            Search
          </button>
          <span style={{ color: palette.textSecondary, fontSize: 15, marginLeft: 16 }}>
            Files per page:
            <select
              value={recordingsPerPage}
              onChange={e => {
                setRecordingPage(1);
                setRecordingsPerPage(e.target.value as any);
              }}
              style={{ marginLeft: 8, fontSize: 15, padding: '2px 8px', background: palette.inputBg, color: palette.inputText, border: `1px solid ${palette.inputBorder}` }}
            >
              {RECORDINGS_PER_PAGE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </span>
        </div>

        {/* --- Preview Panel (copied from RecordingPanel) --- */}
        {previewRecording ? (
          <RecordingPreview recording={previewRecording} palette={palette} onAddComment={openAddCommentModal} />
        ) : (
          <div style={{
            width: 480,
            background: palette.card,
            borderRadius: 10,
            boxShadow: palette.shadow,
            padding: 24,
            margin: '0px auto 32px',
            color: palette.text,
            border: `1px solid ${palette.border}`,
            transition: 'background 0.2s, color 0.2s',
            textAlign: 'center'
          }}>
            <span style={{ color: palette.textSecondary }}>Select a recording below to preview and add comments.</span>
          </div>
        )}

        {/* --- Add Comment Modal --- */}
        {showAddCommentModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: darkMode ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={() => setShowAddCommentModal(false)}
          >
            <div
              style={{
                background: palette.modalBg,
                color: palette.modalText,
                borderRadius: 10,
                padding: 32,
                maxWidth: 420,
                width: '95%',
                boxShadow: palette.modalShadow,
                position: 'relative',
                border: `1px solid ${palette.modalBorder}`
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowAddCommentModal(false)}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: palette.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  zIndex: 2
                }}
              >
                Close
              </button>
              <h3 style={{ marginBottom: 16, color: palette.modalText }}>
                Add Comment
              </h3>
              <form
                onSubmit={handleAddComment}
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <label style={{ color: palette.textSecondary, fontSize: 15, marginBottom: 4 }}>
                  Name:
                  <input
                    type="text"
                    value={addCommentBy}
                    onChange={e => setAddCommentBy(e.target.value)}
                    style={{
                      ...inputStyle,
                      width: '100%',
                      marginTop: 4,
                      fontSize: 15
                    }}
                    disabled={addCommentDisplayNameLoading}
                  />
                </label>
                <textarea
                  value={addCommentText}
                  onChange={e => setAddCommentText(e.target.value)}
                  placeholder="Write your comment..."
                  style={{
                    ...inputStyle,
                    width: '100%',
                    minHeight: 80,
                    fontSize: 15,
                    resize: 'vertical'
                  }}
                  disabled={addCommentDisplayNameLoading}
                />
                <button
                  type="submit"
                  disabled={
                    addCommentDisplayNameLoading ||
                    !addCommentText.trim() ||
                    !addCommentBy.trim()
                  }
                  style={{
                    background: palette.accent,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '8px 0',
                    fontWeight: 600,
                    fontSize: 16,
                    marginTop: 8,
                    cursor: addCommentDisplayNameLoading || !addCommentText.trim() || !addCommentBy.trim() ? 'not-allowed' : 'pointer'
                  }}
                >
                  Post Comment
                </button>
              </form>
            </div>
          </div>
        )}

        {/* --- Table, pagination, transcript/comments modals, etc. --- */}
        {loading ? (
          <div style={{ color: palette.textSecondary }}>Loading recordings...</div>
        ) : (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 14,
            background: palette.tableBg,
            borderRadius: 8,
            boxShadow: palette.shadow,
            marginBottom: 24,
            color: palette.text
          }}>
            <thead>
              <tr>
                <th style={{ background: palette.tableBg, borderBottom: `1px solid ${palette.tableBorder}` }}></th>
                <th style={{ textAlign: 'left', borderBottom: `1px solid ${palette.tableBorder}` }}>Title</th>
                <th style={{ textAlign: 'left', borderBottom: `1px solid ${palette.tableBorder}` }}>Play / URL</th>
                <th style={{ textAlign: 'left', borderBottom: `1px solid ${palette.tableBorder}` }}>Transcript</th>
                <th style={{ textAlign: 'left', borderBottom: `1px solid ${palette.tableBorder}` }}>Comments</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecordings.map(r => {
                const clientName = r.clients?.name || '-';
                const displayName = r.profiles?.display_name || '-';
                const createdAtDate = r.created_at ? new Date(r.created_at) : null;
                const dateStr = createdAtDate
                  ? `${createdAtDate.getFullYear()}-${String(createdAtDate.getMonth() + 1).padStart(2, '0')}-${String(createdAtDate.getDate()).padStart(2, '0')}`
                  : '';
                let timeStr = '';
                if (createdAtDate) {
                  let hours = createdAtDate.getHours();
                  const ampm = hours >= 12 ? 'pm' : 'am';
                  let displayHours = hours % 12;
                  if (displayHours === 0) displayHours = 12;
                  const minutes = String(createdAtDate.getMinutes()).padStart(2, '0');
                  const seconds = String(createdAtDate.getSeconds()).padStart(2, '0');
                  timeStr = `${displayHours}-${minutes}-${seconds}${ampm}`;
                }
                const createdAt = r.created_at || '';
                const title = getTitle(clientName, displayName, createdAt);
                return (
                  <tr key={r.id} style={{ background: palette.card }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedRecordingIds.includes(r.id)}
                        onChange={e => setSelectedRecordingIds(e.target.checked ? [...selectedRecordingIds, r.id] : selectedRecordingIds.filter(id => id !== r.id))}
                      />
                    </td>
                    <td>
                      {title}
                    </td>
                    <td>
                      {r.video_url ? (
                        <>
                          <button
                            onClick={() => setPreviewRecording(r)}
                            style={{
                              background: palette.accent,
                              color: '#fff',
                              border: 'none',
                              borderRadius: 4,
                              padding: '6px 14px',
                              fontWeight: 600,
                              marginRight: 8,
                              boxShadow: palette.shadow
                            }}
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
                            style={{
                              color: palette.accent,
                              background: 'none',
                              border: 'none',
                              textDecoration: 'underline',
                              fontSize: 14,
                              cursor: 'pointer',
                              position: 'relative'
                            }}
                          >
                            {copiedUrlId === r.id ? 'Copied!' : 'Get URL'}
                          </button>
                        </>
                      ) : (
                        <span style={{ color: palette.textSecondary }}>No video</span>
                      )}
                    </td>
                    <td style={{ maxWidth: 320, wordBreak: 'break-word', whiteSpace: 'pre-wrap', color: palette.text }}>
                      {r.transcript
                        ? (() => {
                            let truncated = '';
                            const lines = r.transcript.split('\n').filter((l: string) => l.trim() !== '');
                            if (lines.length > 1) {
                              truncated = lines.slice(0, 2).join('\n');
                            } else {
                              const words = r.transcript.split(' ');
                              truncated = words.slice(0, 20).join(' ');
                              if (words.length > 20) truncated += '...';
                            }
                            return (
                              <>
                                {truncated}
                                <br />
                                <a
                                  href="#"
                                  style={{ color: palette.accent, marginRight: 12 }}
                                  onClick={e => {
                                    e.preventDefault();
                                    setModalTranscript(r.transcript);
                                    setModalTitle(clientName);
                                    setShowTranscriptModal(true);
                                  }}
                                >
                                  Read More
                                </a>
                                <a
                                  href="#"
                                  style={{ color: palette.accent }}
                                  onClick={e => {
                                    e.preventDefault();
                                    const safeClient = clientName.replace(/[^a-zA-Z0-9-_]/g, '');
                                    const safeDisplay = displayName.replace(/[^a-zA-Z0-9-_]/g, '');
                                    const filename = `${safeClient}-by-${safeDisplay}-${dateStr}-at-${timeStr}.txt`;
                                    const blob = new Blob([r.transcript], { type: 'text/plain' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = filename;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                  }}
                                >
                                  Download Text
                                </a>
                              </>
                            );
                          })()
                        : '-'}
                    </td>
                    <td style={{ minWidth: 200, maxWidth: 320, verticalAlign: 'top' }}>
                      <CommentsPreview
                        recordingId={r.id}
                        palette={palette}
                        onReadMore={comments => {
                          setModalComments(comments);
                          setModalTitle(clientName);
                          setShowCommentsModal(true);
                          setModalCommentsFilename(getCommentsFilename(clientName, displayName, dateStr, timeStr));
                        }}
                        onDownload={comments => {
                          const text = comments.length > 0 ? comments.join('\n\n---\n\n') : 'No comments';
                          const filename = getCommentsFilename(clientName, displayName, dateStr, timeStr);
                          const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = filename;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        refreshTrigger={commentsRefreshMap[r.id] || 0}
                      />
                    </td>
                  </tr>
                );
              })}
              {pagedRecordings.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: palette.textSecondary, textAlign: 'center', padding: 24 }}>
                    No recordings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 0 }}>
            <a
              href="#"
              onClick={e => {
                e.preventDefault();
                if (recordingPage > 1) setRecordingPage(p => Math.max(1, p - 1));
              }}
              style={{
                color: recordingPage === 1 ? palette.textSecondary : palette.accent,
                textDecoration: 'underline',
                pointerEvents: recordingPage === 1 ? 'none' : 'auto',
                fontWeight: 600,
                marginRight: 12
              }}
            >
              Prev
            </a>
            {recordingsPerPage !== 'All' && Array.from({ length: recordingPageCount }, (_, i) => (
              <a
                key={i + 1}
                href="#"
                onClick={e => {
                  e.preventDefault();
                  setRecordingPage(i + 1);
                }}
                style={{
                  color: recordingPage === i + 1 ? palette.accent2 : palette.accent,
                  textDecoration: 'underline',
                  fontWeight: recordingPage === i + 1 ? 700 : 600,
                  marginRight: 12
                }}
              >
                {i + 1}
              </a>
            ))}
            <a
              href="#"
              onClick={e => {
                e.preventDefault();
                if (recordingPage < recordingPageCount) setRecordingPage(p => Math.min(recordingPageCount, p + 1));
              }}
              style={{
                color: recordingPage === recordingPageCount ? palette.textSecondary : palette.accent,
                textDecoration: 'underline',
                pointerEvents: recordingPage === recordingPageCount ? 'none' : 'auto',
                fontWeight: 600
              }}
            >
              Next
            </a>
          </div>
          <div style={{ marginLeft: 16 }}>
            <button
              style={{
                background: recordingsPerPage === 'All' ? palette.accent : palette.card,
                color: recordingsPerPage === 'All' ? '#fff' : palette.accent,
                border: `1px solid ${palette.accent}`,
                borderRadius: 4,
                padding: '4px 14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              onClick={() => {
                setRecordingsPerPage('All');
                setRecordingPage(1);
              }}
              disabled={recordingsPerPage === 'All'}
            >
              Show All
            </button>
          </div>
        </div>

        {/* Transcript Modal */}
        {showTranscriptModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: darkMode ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={() => setShowTranscriptModal(false)}
          >
            <div
              style={{
                background: palette.modalBg,
                color: palette.modalText,
                borderRadius: 10,
                padding: 0,
                maxWidth: 700,
                width: '95%',
                boxShadow: palette.modalShadow,
                position: 'relative',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid ${palette.modalBorder}`
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowTranscriptModal(false)}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: palette.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  zIndex: 2
                }}
              >
                Close
              </button>
              <h3 style={{ marginTop: 24, marginBottom: 16, paddingLeft: 32, paddingRight: 80, color: palette.modalText }}>
                {modalTitle ? `Transcript for ${modalTitle}` : 'Transcript'}
              </h3>
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 32,
                  paddingTop: 0,
                  minHeight: 0,
                  fontSize: 15,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: palette.modalText
                }}
              >
                {modalTranscript}
              </div>
            </div>
          </div>
        )}

        {/* Comments Modal */}
        {showCommentsModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: darkMode ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={() => setShowCommentsModal(false)}
          >
            <div
              style={{
                background: palette.modalBg,
                color: palette.modalText,
                borderRadius: 10,
                padding: 0,
                maxWidth: 700,
                width: '95%',
                boxShadow: palette.modalShadow,
                position: 'relative',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid ${palette.modalBorder}`
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowCommentsModal(false)}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: palette.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  zIndex: 2
                }}
              >
                Close
              </button>
              <h3 style={{ marginTop: 24, marginBottom: 16, paddingLeft: 32, paddingRight: 80, color: palette.modalText }}>
                {modalTitle ? `Comments for ${modalTitle}` : 'Comments'}
              </h3>
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 32,
                  paddingTop: 0,
                  minHeight: 0,
                  fontSize: 15,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: palette.modalText
                }}
              >
                {modalComments.length > 0 ? (
                  modalComments.map((c, idx) => (
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
                  ))
                ) : (
                  <span style={{ color: palette.textSecondary }}>No comments yet.</span>
                )}
              </div>
              <button
                onClick={() => {
                  const text = modalComments.length > 0 ? modalComments.join('\n\n---\n\n') : 'No comments';
                  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = modalCommentsFilename || 'comments.txt';
                  a.click();
                  URL.revokeObjectURL(url);
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
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default RecordingsManagement;