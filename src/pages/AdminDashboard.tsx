import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../auth/supabaseClient';
import Header from '../Header';

const RECORDINGS_PER_PAGE_OPTIONS = [20, 40, 60, 80, 100];

const AdminDashboard: React.FC = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [recordings, setRecordings] = useState<any[]>([]);
  const [recordingSearch, setRecordingSearch] = useState('');
  const [analytics, setAnalytics] = useState<{ userCount: number; adminCount: number; recordingCount: number }>({ userCount: 0, adminCount: 0, recordingCount: 0 });

  const [lookupInput, setLookupInput] = useState('');
  const [lookupUser, setLookupUser] = useState<any>(null);
  const [lookupUserChoices, setLookupUserChoices] = useState<any[]>([]);
  const [lookupRecordings, setLookupRecordings] = useState<any[]>([]);
  const [lookupLogs, setLookupLogs] = useState<any[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const [userPage, setUserPage] = useState(1);
  const [recordingPage, setRecordingPage] = useState(1);
  const [memberPage, setMemberPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(RECORDINGS_PER_PAGE_OPTIONS[0]);
  const [recordingsPerPage, setRecordingsPerPage] = useState(RECORDINGS_PER_PAGE_OPTIONS[0]);
  const [membersPerPage, setMembersPerPage] = useState(RECORDINGS_PER_PAGE_OPTIONS[0]);

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedRecordingIds, setSelectedRecordingIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const [auditLogSearch, setAuditLogSearch] = useState('');

  const [members, setMembers] = useState<any[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);

  useEffect(() => {
    if (role === 'admin') {
      supabase
        .from('audit_logs')
        .select('id, user_id, action, target_type, target_id, details, created_at')
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setAuditLogs(data);
        });
    }
  }, [role]);

  useEffect(() => {
    if (role === 'admin') {
      const fetchUsers = async () => {
        const { data, error } = await supabase.from('profiles').select('id, email, display_name, role');
        if (!error && data) {
          setUsers(data);
        }
      };
      fetchUsers();
    }
  }, [role]);

  useEffect(() => {
    if (role === 'admin') {
      const fetchRecordings = async () => {
        const { data, error } = await supabase.from('recordings').select(`id, video_url, transcript, created_at, client_id, user_id, clients:client_id (name, first_name, last_name), profiles:user_id (display_name)`).order('created_at', { ascending: false });
        if (!error && data) setRecordings(data);
      };
      fetchRecordings();
    }
  }, [role]);

  useEffect(() => {
    if (role === 'admin') {
      const fetchAnalytics = async () => {
        const { data: usersData } = await supabase.from('profiles').select('id, role');
        const { data: recsData } = await supabase.from('recordings').select('id');
        setAnalytics({
          userCount: usersData ? usersData.length : 0,
          adminCount: usersData ? usersData.filter((u: any) => u.role === 'admin').length : 0,
          recordingCount: recsData ? recsData.length : 0,
        });
      };
      fetchAnalytics();
    }
  }, [role]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    setUsers(users => users.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

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

  useEffect(() => {
    if (!lookupInput.trim()) {
      setLookupUserChoices([]);
      setLookupError(null);
      return;
    }
    const timeout = setTimeout(async () => {
      const input = lookupInput.trim();
      if (!input) {
        setLookupUserChoices([]);
        setLookupError(null);
        return;
      }
      const { data: matches, error } = await supabase
        .from('profiles')
        .select('id, email, display_name, role, created_at')
        .or(`email.ilike.*${input}*,display_name.ilike.*${input}*`);
      if (!error && matches) {
        setLookupUserChoices(matches);
      } else {
        setLookupUserChoices([]);
        setLookupError(error ? `Error searching users: ${error.message || error}` : 'Unknown error.');
      }
    }, 200);
    return () => clearTimeout(timeout);
  }, [lookupInput]);

  const handleSelectLookupUser = async (userProfile: any) => {
    setLookupUser(userProfile);
    setLookupUserChoices([]);
    setLookupLoading(true);
    const { data: recs } = await supabase.from('recordings').select('*').eq('user_id', userProfile.id).order('created_at', { ascending: false });
    setLookupRecordings(recs || []);
    const { data: logs } = await supabase.from('audit_logs').select('*').eq('user_id', userProfile.id).order('created_at', { ascending: false });
    setLookupLogs(logs || []);
    setLookupLoading(false);
  };

  const filteredUsers = users.filter(u => {
    if (!userSearch) return true;
    const search = userSearch.trim().toLowerCase();
    return (
      String(u.email || '').toLowerCase().includes(search) ||
      String(u.display_name || '').toLowerCase().includes(search) ||
      String(u.role || '').toLowerCase().includes(search) ||
      String(u.id || '').toLowerCase().includes(search)
    );
  });

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
  const [profileEmails, setProfileEmails] = useState<string[]>([]);
  useEffect(() => {
    supabase.from('profiles').select('email').then(({ data }) => {
      if (data) setProfileEmails(data.map((p: any) => p.email));
    });
  }, []);
  const filteredMembers = members.filter(m =>
    (!memberSearch || (m.email && m.email.toLowerCase().includes(memberSearch.toLowerCase())) || (m.name && m.name.toLowerCase().includes(memberSearch.toLowerCase()))) &&
    !profileEmails.includes(m.email)
  );

  const handleUserActive = async (userId: string, active: boolean) => {
    await supabase.from('profiles').update({ notifications_enabled: active }).eq('id', userId);
    setUsers(users => users.map(u => u.id === userId ? { ...u, notifications_enabled: active } : u));
  };

  const handleSaveUserEdit = async (userId: string) => {
    const updateFields: any = { email: editEmail };
    const userObj = users.find(u => u.id === userId);
    if (userObj && userObj.role === 'admin' && (!editDisplayName || editDisplayName.trim() === '')) {
      alert('Admin display name cannot be blank.');
      return;
    }
    if (editDisplayName && editDisplayName.trim() !== '') {
      updateFields.display_name = editDisplayName;
    }
    await supabase.from('profiles').update(updateFields).eq('id', userId);
    setUsers(users => users.map(u => u.id === userId ? { ...u, ...updateFields } : u));
    setEditingUserId(null);
  };

  useEffect(() => {
    supabase.from('clients').select('id, email, name, first_name, last_name, created_at').then(({ data }) => {
      if (data) setMembers(data);
    });
  }, []);

  const handleBulkDeleteUsers = async () => {
    if (selectedUserIds.length === 0) {
      alert('No users selected for deletion.');
      return;
    }
    if (selectedUserIds.length === users.length) {
      alert('Bulk delete of ALL users is not allowed. Please deselect at least one user.');
      return;
    }
    if (!window.confirm(`Delete ${selectedUserIds.length} selected user(s)? This cannot be undone.`)) return;
    await supabase.from('profiles').delete().in('id', selectedUserIds);
    setUsers(users => users.filter(u => !selectedUserIds.includes(u.id)));
    setSelectedUserIds([]);
  };
  const handleBulkPromoteUsers = async () => {
    await supabase.from('profiles').update({ role: 'admin' }).in('id', selectedUserIds);
    setUsers(users => users.map(u => selectedUserIds.includes(u.id) ? { ...u, role: 'admin' } : u));
    setSelectedUserIds([]);
  };
  const handleBulkDeleteRecordings = async () => {
    if (!window.confirm('Delete selected recordings? This cannot be undone.')) return;
    await supabase.from('recordings').delete().in('id', selectedRecordingIds);
    setRecordings(recs => recs.filter(r => !selectedRecordingIds.includes(r.id)));
    setSelectedRecordingIds([]);
  };
  const exportMembersCSV = (rows: any[], columns: string[], filename: string) => {
    const csv = [columns.join(',')].concat(rows.map(r => columns.map(c => JSON.stringify(r[c] ?? '')).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkDeleteMembers = async () => {
    if (selectedMemberIds.length === 0) {
      alert('No members selected for deletion.');
      return;
    }
    if (!window.confirm(`Delete ${selectedMemberIds.length} selected member(s)? This cannot be undone.`)) return;
    await supabase.from('clients').delete().in('id', selectedMemberIds);
    setMembers(members => members.filter(m => !selectedMemberIds.includes(m.id)));
    setSelectedMemberIds([]);
  };

  const userPageCount = Math.max(1, Math.ceil(filteredUsers.length / usersPerPage));
  const recordingPageCount = Math.max(1, Math.ceil(filteredRecordings.length / recordingsPerPage));
  const pagedRecordings = filteredRecordings.slice((recordingPage-1)*recordingsPerPage, recordingPage*recordingsPerPage);
  const memberPageCount = Math.max(1, Math.ceil(filteredMembers.length / membersPerPage));
  const pagedMembers = filteredMembers.slice((memberPage-1)*membersPerPage, memberPage*membersPerPage);

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
                  setRecordingsPerPage(Number(e.target.value));
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
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
            {Array.from({ length: recordingPageCount }, (_, i) => (
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
            <a
              href="#"
              onClick={e => {
                e.preventDefault();
                setRecordingPage(1);
                setRecordingsPerPage(filteredRecordings.length > 0 ? filteredRecordings.length : 1000);
              }}
              style={{
                color: '#1976d2',
                textDecoration: 'underline',
                fontWeight: 600,
                marginLeft: 18
              }}
            >
              Show All
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;