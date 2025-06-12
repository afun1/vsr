import React, { useState, useEffect } from 'react';
import { supabase } from '../auth/supabaseClient';
import Header from '../Header';

const RECORDINGS_PER_PAGE_OPTIONS = [20, 40, 60, 80, 100, 'All'];

const RecordingsManagement: React.FC = () => {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [recordingSearch, setRecordingSearch] = useState('');
  const [recordingPage, setRecordingPage] = useState(1);
  const [recordingsPerPage, setRecordingsPerPage] = useState(RECORDINGS_PER_PAGE_OPTIONS[0]);
  const [selectedRecordingIds, setSelectedRecordingIds] = useState<string[]>([]);
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state for transcript
  const [modalTranscript, setModalTranscript] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState<string | null>(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  useEffect(() => {
    const fetchRecordings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('recordings')
        .select(`id, video_url, transcript, created_at, client_id, user_id, clients:client_id (name, first_name, last_name), profiles:user_id (display_name)`)
        .order('created_at', { ascending: false });
      if (!error && data) setRecordings(data);
      setLoading(false);
    };
    fetchRecordings();
  }, []);

  const exportCSV = (rows: any[], columns: string[], filename: string) => {
    const csv = [columns.join(',')].concat(rows.map(r => columns.map(c => JSON.stringify(r[c] ?? '')).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkDeleteRecordings = async () => {
    if (!window.confirm('Delete selected recordings? This cannot be undone.')) return;
    await supabase.from('recordings').delete().in('id', selectedRecordingIds);
    setRecordings(recs => recs.filter(r => !selectedRecordingIds.includes(r.id)));
    setSelectedRecordingIds([]);
  };

  const filteredRecordings = recordings.filter(r => {
    if (!recordingSearch) return true;
    const search = recordingSearch.toLowerCase();
    const recorderName = (r.profiles && r.profiles.display_name) ? r.profiles.display_name.toLowerCase() : '';
    const clientObj = r.clients || {};
    const clientName = (clientObj.name || '').toLowerCase();
    const clientFirst = (clientObj.first_name || '').toLowerCase();
    const clientLast = (clientObj.last_name || '').toLowerCase();
    const videoUrl = (r.video_url || '').toLowerCase();
    const transcript = (r.transcript || '').toLowerCase();
    const idStr = r.id ? r.id.toString() : '';
    return (
      videoUrl.includes(search) ||
      transcript.includes(search) ||
      idStr.includes(search) ||
      recorderName.includes(search) ||
      clientName.includes(search) ||
      clientFirst.includes(search) ||
      clientLast.includes(search)
    );
  });

  // Handle "All" option for per page
  const perPage = recordingsPerPage === 'All' ? filteredRecordings.length || 1 : Number(recordingsPerPage);
  const recordingPageCount = Math.max(1, Math.ceil(filteredRecordings.length / perPage));
  const pagedRecordings = filteredRecordings.slice((recordingPage-1)*perPage, recordingPage*perPage);

  // If "All" is selected, always show page 1
  useEffect(() => {
    if (recordingsPerPage === 'All') setRecordingPage(1);
  }, [recordingsPerPage]);

  return (
    <>
      <Header />
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', paddingTop: 100 }}>
        <h3>Recordings Management</h3>
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <input
              type="text"
              placeholder="Search recordings by URL, transcript, or ID..."
              value={recordingSearch}
              onChange={e => setRecordingSearch(e.target.value)}
              style={{ fontSize: 15, padding: '4px 10px', width: 320 }}
            />
            <span style={{ color: '#888', fontSize: 15 }}>
              Files per page:
              <select
                value={recordingsPerPage}
                onChange={e => {
                  setRecordingPage(1);
                  setRecordingsPerPage(e.target.value === 'All' ? 'All' : Number(e.target.value));
                }}
                style={{ marginLeft: 8, fontSize: 15, padding: '2px 8px' }}
              >
                {RECORDINGS_PER_PAGE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12, marginLeft: 'auto' }}>
            <button onClick={() => exportCSV(filteredRecordings, ['id','video_url','transcript','created_at','client_id','user_id'], 'recordings.csv')} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600 }}>
              Export Recordings CSV
            </button>
            <button onClick={handleBulkDeleteRecordings} disabled={selectedRecordingIds.length === 0} style={{ background: '#e53935', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600 }}>
              Delete Selected
            </button>
          </div>
        </div>
        {loading ? (
          <div>Loading recordings...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', marginBottom: 24 }}>
            <thead>
              <tr>
                <th><input type="checkbox" checked={pagedRecordings.length > 0 && pagedRecordings.every(r => selectedRecordingIds.includes(r.id))} onChange={e => setSelectedRecordingIds(e.target.checked ? pagedRecordings.map(r => r.id) : [])} /></th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Title</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Play / URL</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Transcript</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecordings.map(r => {
                const clientObj = r.clients || {};
                const clientName = (clientObj.first_name && clientObj.last_name)
                  ? `${clientObj.first_name} ${clientObj.last_name}`
                  : (clientObj.name || '-');
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
                const createdAt = createdAtDate ? createdAtDate.toLocaleString() : '-';
                return (
                  <tr key={r.id}>
                    <td><input type="checkbox" checked={selectedRecordingIds.includes(r.id)} onChange={e => setSelectedRecordingIds(e.target.checked ? [...selectedRecordingIds, r.id] : selectedRecordingIds.filter(id => id !== r.id))} /></td>
                    <td>
                      <div>{clientName}</div>
                      <div style={{ color: '#888', fontSize: 13 }}>By: {displayName}</div>
                      <div style={{ color: '#888', fontSize: 13 }}>{createdAt}</div>
                    </td>
                    <td>
                      {r.video_url ? (
                        <>
                          <button onClick={() => window.open(r.video_url, '_blank')} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600, marginRight: 8 }}>Play</button>
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
                        </>
                      ) : (
                        <span style={{ color: '#888' }}>No video</span>
                      )}
                    </td>
                    <td style={{ maxWidth: 320, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
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
                                  style={{ color: '#1976d2', marginRight: 12 }}
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
                                  style={{ color: '#1976d2' }}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 0 }}>
            <a
              href="#"
              onClick={e => {
                e.preventDefault();
                if (recordingPage > 1) setRecordingPage(p => Math.max(1, p - 1));
              }}
              style={{
                color: recordingPage === 1 ? '#888' : '#1976d2',
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
                  color: recordingPage === i + 1 ? '#28a745' : '#1976d2',
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
                color: recordingPage === recordingPageCount ? '#888' : '#1976d2',
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
                background: recordingsPerPage === 'All' ? '#1976d2' : '#fff',
                color: recordingsPerPage === 'All' ? '#fff' : '#1976d2',
                border: '1px solid #1976d2',
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
              background: 'rgba(0,0,0,0.35)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={() => setShowTranscriptModal(false)}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 10,
                padding: 32,
                maxWidth: 600,
                width: '90%',
                boxShadow: '0 4px 24px #0002',
                position: 'relative'
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowTranscriptModal(false)}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <h3 style={{ marginTop: 0, marginBottom: 16 }}>{modalTitle ? `Transcript for ${modalTitle}` : 'Transcript'}</h3>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 15, margin: 0 }}>
                {modalTranscript}
              </pre>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default RecordingsManagement;