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
  const USERS_PER_PAGE = 10;
  const [recordingsPerPage, setRecordingsPerPage] = useState(RECORDINGS_PER_PAGE_OPTIONS[0]);
  const MEMBERS_PER_PAGE = 10;

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedRecordingIds, setSelectedRecordingIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const [auditLogSearch, setAuditLogSearch] = useState('');

  const [members, setMembers] = useState<any[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);

  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [modalTranscript, setModalTranscript] = useState('');
  const [modalTitle, setModalTitle] = useState('');

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

  const userPageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const recordingPageCount = Math.max(1, Math.ceil(filteredRecordings.length / recordingsPerPage));
  const pagedRecordings = filteredRecordings.slice((recordingPage-1)*recordingsPerPage, recordingPage*recordingsPerPage);
  const memberPageCount = Math.max(1, Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE));
  const pagedMembers = filteredMembers.slice((memberPage-1)*MEMBERS_PER_PAGE, memberPage*MEMBERS_PER_PAGE);

  return (
    <>
      <Header />
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', paddingTop: 100 }}>
        <h2>Admin Dashboard</h2>
        <div style={{ display: 'flex', gap: 32, marginBottom: 24 }}>
          <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 18, minWidth: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '12px 28px', fontSize: 17, fontWeight: 600, marginBottom: 8 }}
            >
              New Recording
            </button>
          </div>
          <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 18, minWidth: 180 }}>
            <div style={{ fontSize: 15, color: '#888' }}>Total Users</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{analytics.userCount}</div>
          </div>
          <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 18, minWidth: 180 }}>
            <div style={{ fontSize: 15, color: '#888' }}>Admins</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{analytics.adminCount}</div>
          </div>
          <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 18, minWidth: 180 }}>
            <div style={{ fontSize: 15, color: '#888' }}>Total Members</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{analytics.userCount}</div>
          </div>
          <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 18, minWidth: 180 }}>
            <div style={{ fontSize: 15, color: '#888' }}>Recordings</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{analytics.recordingCount}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 24 }}>
          </div>
        </div>
        {lookupLoading && (
          <div style={{ position: 'absolute', top: 44, left: 0, width: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11 }}>
            <span style={{ color: '#1976d2', fontSize: 15, background: '#fff', borderRadius: 8, padding: '6px 0', width: '100%', textAlign: 'center' }}>Searching...</span>
          </div>
        )}
        {lookupUserChoices.length > 0 && !lookupUser && !lookupLoading && (
          <div style={{ position: 'absolute', top: 44, left: 0, background: '#fff', border: '1px solid #eee', borderRadius: 8, boxShadow: '0 2px 8px #0001', zIndex: 10, width: 340, maxHeight: 220, overflowY: 'auto' }}>
            {lookupUserChoices.map(u => (
              <div key={u.id} style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5' }} onClick={() => handleSelectLookupUser(u)}>
                <span style={{ fontWeight: 600 }}>{u.display_name || u.email}</span>
                <span style={{ color: '#888', fontSize: 13, marginLeft: 8 }}>{u.email}</span>
              </div>
            ))}
          </div>
        )}
        {lookupLoading && <div style={{ color: '#1976d2', marginBottom: 12 }}>Loading account...</div>}
        {lookupError && <div style={{ color: '#e53935', marginBottom: 12 }}>{lookupError}</div>}
        {lookupUser && (
          <div style={{ background: '#f7f8fa', border: '1px solid #eee', borderRadius: 10, padding: 24, marginBottom: 32, maxWidth: 900, marginLeft: 'auto', marginRight: 'auto' }}>
            <button onClick={() => { setLookupUser(null); setLookupInput(''); }} style={{ float: 'right', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', fontWeight: 600, marginBottom: 8 }}>Lookup Another User</button>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>User Profile</h3>
            <div style={{ display: 'flex', gap: 32, alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{lookupUser.display_name || lookupUser.email}</div>
              <div style={{ color: '#888', fontSize: 15 }}>{lookupUser.email}</div>
              <div style={{ color: '#888', fontSize: 15 }}>Role: <b>{lookupUser.role}</b></div>
              <div style={{ color: '#888', fontSize: 15 }}>User ID: {lookupUser.id}</div>
            </div>
            <div style={{ color: '#888', fontSize: 14, marginBottom: 8 }}>Created: {lookupUser.created_at ? new Date(lookupUser.created_at).toLocaleString() : '-'}</div>
            <div style={{ color: '#888', fontSize: 14, marginBottom: 18 }}>Last Updated: {lookupUser.updated_at ? new Date(lookupUser.updated_at).toLocaleString() : '-'}</div>
            <div style={{ display: 'flex', gap: 32, marginBottom: 18 }}>
              <div style={{ background: '#e3f2fd', borderRadius: 8, padding: '10px 18px', minWidth: 120, textAlign: 'center' }}>
                <div style={{ fontSize: 15, color: '#1976d2' }}>Recordings</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{lookupRecordings.length}</div>
              </div>
              <div style={{ background: '#fce4ec', borderRadius: 8, padding: '10px 18px', minWidth: 120, textAlign: 'center' }}>
                <div style={{ fontSize: 15, color: '#d81b60' }}>Audit Logs</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{lookupLogs.length}</div>
              </div>
            </div>
            <hr style={{ margin: '18px 0' }} />
            <h4 style={{ marginBottom: 8 }}>All Recordings</h4>
            {lookupRecordings.length === 0 && <div style={{ color: '#888', fontSize: 14 }}>No recordings found.</div>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {lookupRecordings.map(r => (
                <li key={r.id} style={{ borderBottom: '1px solid #eee', padding: '10px 0', marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Recording ID: {r.id}</div>
                  <div style={{ color: '#888', fontSize: 13 }}>Created: {new Date(r.created_at).toLocaleString()}</div>
                  <div style={{ color: '#888', fontSize: 13 }}>Client ID: {r.client_id}</div>
                  <div style={{ color: '#888', fontSize: 13 }}>Video: {r.video_url ? <a href={r.video_url} target="_blank" rel="noopener noreferrer">{r.video_url}</a> : '-'}</div>
                  <div style={{ color: '#888', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>Transcript: {r.transcript || '-'}</div>
                </li>
              ))}
            </ul>
            <hr style={{ margin: '18px 0' }} />
            <h4 style={{ marginBottom: 8 }}>All Audit Logs</h4>
            {lookupLogs.length === 0 && <div style={{ color: '#888', fontSize: 14 }}>No audit logs found.</div>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {lookupLogs.map(log => (
                <li key={log.id} style={{ borderBottom: '1px solid #eee', padding: '8px 0', fontSize: 13, marginBottom: 4 }}>
                  <strong>{log.action}</strong> on {log.target_type} {log.target_id} at {new Date(log.created_at).toLocaleString()}<br />
                  <span style={{ color: '#555' }}>Details: {JSON.stringify(log.details)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {lookupUserChoices.length > 0 && !lookupUser && (
          <div style={{ position: 'absolute', background: '#fff', border: '1px solid #eee', borderRadius: 8, boxShadow: '0 2px 8px #0001', zIndex: 10, width: 340, maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
            {lookupUserChoices.map(u => (
              <div key={u.id} style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5' }} onClick={() => handleSelectLookupUser(u)}>
                <span style={{ fontWeight: 600 }}>{u.display_name || u.email}</span>
                <span style={{ color: '#888', fontSize: 13, marginLeft: 8 }}>{u.email}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 32, marginBottom: 24 }}>
        </div>
        <hr />
        <h3>User Management</h3>
        <div style={{ marginBottom: 8, width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
            <input
              placeholder="Lookup user by email, name, username..."
              autoComplete="off"
              type="text"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              style={{ fontSize: 16, padding: '6px 14px', width: 340 }}
            />
            <button type="submit" style={{ background: 'rgb(25, 118, 210)', color: 'rgb(255, 255, 255)', border: 'none', borderRadius: 4, padding: '7px 18px', fontWeight: 600 }}>User Lookup</button>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flex: 1 }}>
              <button onClick={handleBulkPromoteUsers} disabled={selectedUserIds.length === 0} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600 }}>Promote to Admin</button>
              <button onClick={() => exportCSV(filteredUsers, ['id','email','display_name','role'], 'users.csv')} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600 }}>Export Users CSV</button>
              <button onClick={handleBulkDeleteUsers} disabled={selectedUserIds.length === 0} style={{ background: '#e53935', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600 }}>Delete Selected</button>
            </div>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', marginBottom: 24 }}>
          <thead>
            <tr>
              <th><input type="checkbox" checked={filteredUsers.length > 0 && filteredUsers.slice((userPage-1)*USERS_PER_PAGE, userPage*USERS_PER_PAGE).every(u => selectedUserIds.includes(u.id))} onChange={e => setSelectedUserIds(e.target.checked ? filteredUsers.slice((userPage-1)*USERS_PER_PAGE, userPage*USERS_PER_PAGE).map(u => u.id) : [])} /></th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Email</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Display Name</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Role</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Change Role</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Active</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.slice((userPage-1)*USERS_PER_PAGE, userPage*USERS_PER_PAGE).map(u => (
              <tr key={u.id}>
                <td><input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={e => setSelectedUserIds(e.target.checked ? [...selectedUserIds, u.id] : selectedUserIds.filter(id => id !== u.id))} /></td>
                <td>
                  {editingUserId === u.id ? (
                    <input value={editEmail} onChange={e => setEditEmail(e.target.value)} style={{ width: 180 }} />
                  ) : (
                    u.email
                  )}
                </td>
                <td>
                  {editingUserId === u.id ? (
                    <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} style={{ width: 140 }} />
                  ) : (
                    u.display_name || '-'
                  )}
                </td>
                <td>{u.role}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={e => handleRoleChange(u.id, e.target.value)}
                    disabled={u.id === user}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>
                  <button
                    onClick={() => handleUserActive(u.id, !(u.notifications_enabled ?? true))}
                    style={{ background: (u.notifications_enabled ?? true) ? '#28a745' : '#e53935', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 13 }}
                  >
                    {(u.notifications_enabled ?? true) ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td>
                  {editingUserId === u.id ? (
                    <>
                      <button onClick={() => handleSaveUserEdit(u.id)} style={{ marginRight: 6 }}>Save</button>
                      <button onClick={() => setEditingUserId(null)}>Cancel</button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingUserId(u.id);
                        setEditDisplayName(u.display_name || '');
                        setEditEmail(u.email || '');
                      }}
                    >Edit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button disabled={userPage === 1} onClick={() => setUserPage(p => Math.max(1, p-1))}>Prev</button>
          <span>Page {userPage} of {userPageCount}</span>
          <button disabled={userPage === userPageCount} onClick={() => setUserPage(p => Math.min(userPageCount, p+1))}>Next</button>
        </div>
        <hr />
        <h3>Member Management</h3>
        <div style={{ marginBottom: 8, width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
            <input
              placeholder="Lookup member by email, name, username..."
              autoComplete="off"
              type="text"
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              style={{ fontSize: 16, padding: '6px 14px', width: 340 }}
            />
            <button type="submit" style={{ background: 'rgb(25, 118, 210)', color: 'rgb(255, 255, 255)', border: 'none', borderRadius: 4, padding: '7px 18px', fontWeight: 600 }}>Member Lookup</button>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flex: 1 }}>
              <button onClick={() => exportMembersCSV(filteredMembers, ['id','email','name','first_name','last_name','created_at'], 'members.csv')} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600 }}>Export Members CSV</button>
              <button onClick={handleBulkDeleteMembers} disabled={selectedMemberIds.length === 0} style={{ background: '#e53935', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600 }}>Delete Selected</button>
            </div>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', marginBottom: 24 }}>
          <thead>
            <tr>
              <th><input type="checkbox" checked={pagedMembers.length > 0 && pagedMembers.every(m => selectedMemberIds.includes(m.id))} onChange={e => setSelectedMemberIds(e.target.checked ? pagedMembers.map(m => m.id) : [])} /></th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Email</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Name</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Created At</th>
            </tr>
          </thead>
          <tbody>
            {pagedMembers.length === 0 ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: '#888' }}>No members found.</td></tr>
            ) : (
              pagedMembers.map(m => (
                <tr key={m.id}>
                  <td><input type="checkbox" checked={selectedMemberIds.includes(m.id)} onChange={e => setSelectedMemberIds(e.target.checked ? [...selectedMemberIds, m.id] : selectedMemberIds.filter(id => id !== m.id))} /></td>
                  <td>{m.email}</td>
                  <td>{m.name || `${m.first_name || ''} ${m.last_name || ''}`}</td>
                  <td>{m.created_at ? new Date(m.created_at).toLocaleString() : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button disabled={memberPage === 1} onClick={() => setMemberPage(p => Math.max(1, p-1))}>Prev</button>
          <span>Page {memberPage} of {memberPageCount}</span>
          <button disabled={memberPage === memberPageCount} onClick={() => setMemberPage(p => Math.min(memberPageCount, p+1))}>Next</button>
        </div>
        <hr />
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
        {showTranscriptModal && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              background: '#fff',
              borderRadius: 8,
              maxWidth: 600,
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 4px 32px #0003',
              padding: 32,
              position: 'relative'
            }}>
              <button
                onClick={() => setShowTranscriptModal(false)}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '6px 16px',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <h3 style={{ marginTop: 0, marginBottom: 18 }}>{modalTitle} Transcript</h3>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 15, color: '#222', margin: 0 }}>{modalTranscript}</pre>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button disabled={recordingPage === 1} onClick={() => setRecordingPage(p => Math.max(1, p-1))}>Prev</button>
          <span>Page {recordingPage} of {recordingPageCount}</span>
          <button disabled={recordingPage === recordingPageCount} onClick={() => setRecordingPage(p => Math.min(recordingPageCount, p+1))}>Next</button>
        </div>
        <hr />
        <h3>Audit Logs</h3>
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            placeholder="Search audit logs..."
            value={auditLogSearch}
            onChange={e => setAuditLogSearch(e.target.value)}
            style={{ fontSize: 15, padding: '4px 10px', width: 320 }}
          />
        </div>
        <ul style={{ marginTop: 24, padding: 0, listStyle: 'none' }}>
          {auditLogs
            .filter((log) => {
              const search = auditLogSearch.toLowerCase();
              return (
                (log.user_id && log.user_id.toLowerCase().includes(search)) ||
                (log.action && log.action.toLowerCase().includes(search)) ||
                (log.target_type && log.target_type.toLowerCase().includes(search)) ||
                (log.target_id && String(log.target_id).toLowerCase().includes(search)) ||
                (log.details && JSON.stringify(log.details).toLowerCase().includes(search))
              );
            })
            .map((log) => (
              <li key={log.id} style={{ marginBottom: 8, fontSize: 13, borderBottom: '1px solid #eee', paddingBottom: 4 }}>
                <strong>{log.action}</strong> by <span style={{ color: '#1976d2' }}>{log.user_id}</span> on {log.target_type} {log.target_id} <br />
                <span style={{ color: '#888' }}>{log.created_at}</span>
                {log.details && (
                  <pre style={{ background: '#f7f7fa', padding: 8, borderRadius: 4, marginTop: 4, fontSize: 12, color: '#333' }}>{JSON.stringify(log.details, null, 2)}</pre>
                )}
              </li>
            ))}
        </ul>
      </div>
    </>
  );
};

export default AdminDashboard;