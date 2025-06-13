import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../auth/supabaseClient';
import Header from '../Header';

// Dark mode detection
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

const RECORDINGS_PER_PAGE_OPTIONS = [20, 40, 60, 80, 100];

const AdminDashboard: React.FC = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const darkMode = useDarkMode();

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
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
  const [memberPage, setMemberPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(RECORDINGS_PER_PAGE_OPTIONS[0]);
  const [membersPerPage, setMembersPerPage] = useState(RECORDINGS_PER_PAGE_OPTIONS[0]);

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const [auditLogSearch, setAuditLogSearch] = useState('');

  const [members, setMembers] = useState<any[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

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
  const memberPageCount = Math.max(1, Math.ceil(filteredMembers.length / membersPerPage));
  const pagedMembers = filteredMembers.slice((memberPage-1)*membersPerPage, memberPage*membersPerPage);

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
      }
    : {
        bg: '#fff',
        card: '#f5f5f5',
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
      };

  // Helper styles
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

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 14,
    background: palette.tableBg,
    borderRadius: 8,
    boxShadow: palette.shadow,
    marginBottom: 24,
    color: palette.text
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left' as const,
    borderBottom: `1px solid ${palette.tableBorder}`,
    color: palette.text,
    background: palette.tableBg,
    padding: '8px 6px'
  };

  const tdStyle: React.CSSProperties = {
    color: palette.text,
    background: palette.tableBg,
    borderBottom: `1px solid ${palette.tableBorder}`,
    padding: '8px 6px'
  };

  const secondaryText = { color: palette.textSecondary };

  return (
    <>
      <Header />
      <div
        style={{
          padding: 20,
          maxWidth: 1400,
          margin: '0 auto',
          paddingTop: 100,
          background: palette.bg,
          color: palette.text,
          minHeight: '100vh',
          transition: 'background 0.2s,color 0.2s',
        }}
      >
        {/* All panels and sections visible in both modes */}
        <h2 style={{ color: palette.text }}>Admin Dashboard</h2>
        <div style={{ display: 'flex', gap: 32, marginBottom: 24 }}>
          <div style={{ background: palette.card, borderRadius: 8, padding: 18, minWidth: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: palette.shadow }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ background: palette.accent, color: '#fff', border: 'none', borderRadius: 4, padding: '12px 28px', fontSize: 17, fontWeight: 600, marginBottom: 8, boxShadow: palette.shadow }}
            >
              New Recording
            </button>
          </div>
          <div style={{ background: palette.card, borderRadius: 8, padding: 18, minWidth: 180, boxShadow: palette.shadow }}>
            <div style={{ fontSize: 15, ...secondaryText }}>Total Users</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: palette.text }}>{analytics.userCount}</div>
          </div>
          <div style={{ background: palette.card, borderRadius: 8, padding: 18, minWidth: 180, boxShadow: palette.shadow }}>
            <div style={{ fontSize: 15, ...secondaryText }}>Admins</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: palette.text }}>{analytics.adminCount}</div>
          </div>
          <div style={{ background: palette.card, borderRadius: 8, padding: 18, minWidth: 180, boxShadow: palette.shadow }}>
            <div style={{ fontSize: 15, ...secondaryText }}>Total Members</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: palette.text }}>{analytics.userCount}</div>
          </div>
          <div style={{ background: palette.card, borderRadius: 8, padding: 18, minWidth: 180, boxShadow: palette.shadow }}>
            <div style={{ fontSize: 15, ...secondaryText }}>Recordings</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: palette.text }}>{analytics.recordingCount}</div>
          </div>
        </div>
        {/* User Lookup */}
        <div style={{ marginBottom: 24 }}>
          <input
            placeholder="Lookup user by email, name, username..."
            autoComplete="off"
            type="text"
            value={lookupInput}
            onChange={e => setLookupInput(e.target.value)}
            style={{ ...inputStyle, width: 340, marginRight: 12 }}
          />
          {lookupLoading && (
            <span style={{ color: palette.accent, fontSize: 15, background: palette.card, borderRadius: 8, padding: '6px 12px', marginLeft: 8 }}>Searching...</span>
          )}
          {lookupError && <span style={{ color: palette.accent3, marginLeft: 8 }}>{lookupError}</span>}
          {lookupUserChoices.length > 0 && !lookupUser && !lookupLoading && (
            <div style={{ position: 'absolute', background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 8, boxShadow: palette.shadow, zIndex: 10, width: 340, maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
              {lookupUserChoices.map(u => (
                <div key={u.id} style={{ padding: '8px 14px', cursor: 'pointer', borderBottom: `1px solid ${palette.border}` }} onClick={() => handleSelectLookupUser(u)}>
                  <span style={{ fontWeight: 600, color: palette.text }}>{u.display_name || u.email}</span>
                  <span style={{ color: palette.textSecondary, fontSize: 13, marginLeft: 8 }}>{u.email}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {lookupUser && (
          <div style={{ background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 10, padding: 24, marginBottom: 32, maxWidth: 900, marginLeft: 'auto', marginRight: 'auto', color: palette.text }}>
            <button onClick={() => { setLookupUser(null); setLookupInput(''); }} style={{ float: 'right', background: palette.accent, color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', fontWeight: 600, marginBottom: 8 }}>Lookup Another User</button>
            <h3 style={{ marginTop: 0, marginBottom: 12, color: palette.text }}>User Profile</h3>
            <div style={{ display: 'flex', gap: 32, alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: palette.text }}>{lookupUser.display_name || lookupUser.email}</div>
              <div style={{ color: palette.textSecondary, fontSize: 15 }}>{lookupUser.email}</div>
              <div style={{ color: palette.textSecondary, fontSize: 15 }}>Role: <b>{lookupUser.role}</b></div>
              <div style={{ color: palette.textSecondary, fontSize: 15 }}>User ID: {lookupUser.id}</div>
            </div>
            <div style={{ color: palette.textSecondary, fontSize: 14, marginBottom: 8 }}>Created: {lookupUser.created_at ? new Date(lookupUser.created_at).toLocaleString() : '-'}</div>
            <div style={{ color: palette.textSecondary, fontSize: 14, marginBottom: 18 }}>Last Updated: {lookupUser.updated_at ? new Date(lookupUser.updated_at).toLocaleString() : '-'}</div>
            <div style={{ display: 'flex', gap: 32, marginBottom: 18 }}>
              <div style={{ background: palette.accent5, borderRadius: 8, padding: '10px 18px', minWidth: 120, textAlign: 'center', color: palette.text }}>
                <div style={{ fontSize: 15, color: palette.accent }}>Recordings</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{lookupRecordings.length}</div>
              </div>
              <div style={{ background: palette.accent6, borderRadius: 8, padding: '10px 18px', minWidth: 120, textAlign: 'center', color: palette.text }}>
                <div style={{ fontSize: 15, color: palette.accent4 }}>Audit Logs</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{lookupLogs.length}</div>
              </div>
            </div>
            <hr style={{ margin: '18px 0', borderColor: palette.border }} />
            <h4 style={{ marginBottom: 8, color: palette.text }}>All Recordings</h4>
            {lookupRecordings.length === 0 && <div style={{ color: palette.textSecondary, fontSize: 14 }}>No recordings found.</div>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {lookupRecordings.map(r => (
                <li key={r.id} style={{ borderBottom: `1px solid ${palette.border}`, padding: '10px 0', marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: palette.text }}>Recording ID: {r.id}</div>
                  <div style={{ color: palette.textSecondary, fontSize: 13 }}>Created: {new Date(r.created_at).toLocaleString()}</div>
                  <div style={{ color: palette.textSecondary, fontSize: 13 }}>Client ID: {r.client_id}</div>
                  <div style={{ color: palette.textSecondary, fontSize: 13 }}>Video: {r.video_url ? <a href={r.video_url} target="_blank" rel="noopener noreferrer" style={{ color: palette.accent }}>{r.video_url}</a> : '-'}</div>
                  <div style={{ color: palette.textSecondary, fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>Transcript: {r.transcript || '-'}</div>
                </li>
              ))}
            </ul>
            <hr style={{ margin: '18px 0', borderColor: palette.border }} />
            <h4 style={{ marginBottom: 8, color: palette.text }}>All Audit Logs</h4>
            {lookupLogs.length === 0 && <div style={{ color: palette.textSecondary, fontSize: 14 }}>No audit logs found.</div>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {lookupLogs.map(log => (
                <li key={log.id} style={{ borderBottom: `1px solid ${palette.border}`, padding: '8px 0', fontSize: 13, marginBottom: 4 }}>
                  <strong style={{ color: palette.text }}>{log.action}</strong> on {log.target_type} {log.target_id} at {new Date(log.created_at).toLocaleString()}<br />
                  <span style={{ color: palette.textSecondary }}>Details: {JSON.stringify(log.details)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* User Management */}
        <hr style={{ borderColor: palette.border }} />
        <h3 style={{ color: palette.text }}>User Management</h3>
        <div style={{ marginBottom: 8, width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
            <input
              placeholder="Lookup user by email, name, username..."
              autoComplete="off"
              type="text"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              style={{ ...inputStyle, width: 340 }}
            />
            <button type="submit" style={{ background: palette.accent, color: '#fff', border: 'none', borderRadius: 4, padding: '7px 18px', fontWeight: 600 }}>User Lookup</button>
            <span style={{ ...secondaryText, fontSize: 15, marginLeft: 16 }}>
              Files per page:
              <select
                value={usersPerPage}
                onChange={e => {
                  setUserPage(1);
                  setUsersPerPage(Number(e.target.value));
                }}
                style={{ marginLeft: 8, fontSize: 15, padding: '2px 8px', background: palette.inputBg, color: palette.inputText, border: `1px solid ${palette.inputBorder}` }}
              >
                {RECORDINGS_PER_PAGE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </span>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flex: 1 }}>
              <button onClick={handleBulkPromoteUsers} disabled={selectedUserIds.length === 0} style={{ background: palette.accent, color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600 }}>Promote to Admin</button>
              <button onClick={() => exportCSV(filteredUsers, ['id','email','display_name','role'], 'users.csv')} style={{ background: palette.accent, color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600 }}>Export Users CSV</button>
              <button onClick={handleBulkDeleteUsers} disabled={selectedUserIds.length === 0} style={{ background: palette.accent3, color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600 }}>Delete Selected</button>
            </div>
          </div>
        </div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}><input type="checkbox" checked={filteredUsers.length > 0 && filteredUsers.slice((userPage-1)*usersPerPage, userPage*usersPerPage).every(u => selectedUserIds.includes(u.id))} onChange={e => setSelectedUserIds(e.target.checked ? filteredUsers.slice((userPage-1)*usersPerPage, userPage*usersPerPage).map(u => u.id) : [])} /></th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Display Name</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Change Role</th>
              <th style={thStyle}>Active</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.slice((userPage-1)*usersPerPage, userPage*usersPerPage).map(u => (
              <tr key={u.id}>
                <td style={tdStyle}><input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={e => setSelectedUserIds(e.target.checked ? [...selectedUserIds, u.id] : selectedUserIds.filter(id => id !== u.id))} /></td>
                <td style={tdStyle}>
                  {editingUserId === u.id ? (
                    <input value={editEmail} onChange={e => setEditEmail(e.target.value)} style={{ ...inputStyle, width: 180 }} />
                  ) : (
                    u.email
                  )}
                </td>
                <td style={tdStyle}>
                  {editingUserId === u.id ? (
                    <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} style={{ ...inputStyle, width: 140 }} />
                  ) : (
                    u.display_name || '-'
                  )}
                </td>
                <td style={tdStyle}>{u.role}</td>
                <td style={tdStyle}>
                  <select
                    value={u.role}
                    onChange={e => handleRoleChange(u.id, e.target.value)}
                    disabled={u.id === user}
                    style={{ ...inputStyle, width: 90, padding: '4px 8px', fontSize: 14 }}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td style={tdStyle}>
                  <button
                    onClick={() => handleUserActive(u.id, !(u.notifications_enabled ?? true))}
                    style={{ background: (u.notifications_enabled ?? true) ? palette.accent2 : palette.accent3, color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 13 }}
                  >
                    {(u.notifications_enabled ?? true) ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td style={tdStyle}>
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
          <div style={{ display: 'flex', gap: 0 }}>
            <a
              href="#"
              onClick={e => {
                e.preventDefault();
                if (userPage > 1) setUserPage(p => Math.max(1, p - 1));
              }}
              style={{
                color: userPage === 1 ? palette.textSecondary : palette.accent,
                textDecoration: 'underline',
                pointerEvents: userPage === 1 ? 'none' : 'auto',
                fontWeight: 600,
                marginRight: 12
              }}
            >
              Prev
            </a>
            {Array.from({ length: userPageCount }, (_, i) => (
              <a
                key={i + 1}
                href="#"
                onClick={e => {
                  e.preventDefault();
                  setUserPage(i + 1);
                }}
                style={{
                  color: userPage === i + 1 ? palette.accent2 : palette.accent,
                  textDecoration: 'underline',
                  fontWeight: userPage === i + 1 ? 700 : 600,
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
                if (userPage < userPageCount) setUserPage(p => Math.min(userPageCount, p + 1));
              }}
              style={{
                color: userPage === userPageCount ? palette.textSecondary : palette.accent,
                textDecoration: 'underline',
                pointerEvents: userPage === userPageCount ? 'none' : 'auto',
                fontWeight: 600
              }}
            >
              Next
            </a>
          </div>
        </div>
        {/* Member Management */}
        <hr style={{ borderColor: palette.border }} />
        <h3 style={{ color: palette.text }}>Member Management</h3>
        <div style={{ marginBottom: 8, width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
            <input
              placeholder="Lookup member by email, name, username..."
              autoComplete="off"
              type="text"
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
              style={{ ...inputStyle, width: 340 }}
            />
            <button type="submit" style={{ background: palette.accent, color: '#fff', border: 'none', borderRadius: 4, padding: '7px 18px', fontWeight: 600 }}>Member Lookup</button>
            <span style={{ ...secondaryText, fontSize: 15, marginLeft: 16 }}>
              Files per page:
              <select
                value={membersPerPage}
                onChange={e => {
                  setMemberPage(1);
                  setMembersPerPage(Number(e.target.value));
                }}
                style={{ marginLeft: 8, fontSize: 15, padding: '2px 8px', background: palette.inputBg, color: palette.inputText, border: `1px solid ${palette.inputBorder}` }}
              >
                {RECORDINGS_PER_PAGE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </span>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flex: 1 }}>
              <button onClick={() => exportMembersCSV(filteredMembers, ['id','email','name','first_name','last_name','created_at'], 'members.csv')} style={{ background: palette.accent, color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600 }}>Export Members CSV</button>
              <button onClick={handleBulkDeleteMembers} disabled={selectedMemberIds.length === 0} style={{ background: palette.accent3, color: '#fff', border: 'none', borderRadius: 4, padding: '6px 14px', fontWeight: 600 }}>Delete Selected</button>
            </div>
          </div>
        </div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}><input type="checkbox" checked={pagedMembers.length > 0 && pagedMembers.every(m => selectedMemberIds.includes(m.id))} onChange={e => setSelectedMemberIds(e.target.checked ? pagedMembers.map(m => m.id) : [])} /></th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Created At</th>
            </tr>
          </thead>
          <tbody>
            {pagedMembers.length === 0 ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', ...secondaryText }}>No members found.</td></tr>
            ) : (
              pagedMembers.map(m => (
                <tr key={m.id}>
                  <td style={tdStyle}><input type="checkbox" checked={selectedMemberIds.includes(m.id)} onChange={e => setSelectedMemberIds(e.target.checked ? [...selectedMemberIds, m.id] : selectedMemberIds.filter(id => id !== m.id))} /></td>
                  <td style={tdStyle}>{m.email}</td>
                  <td style={tdStyle}>{m.name || `${m.first_name || ''} ${m.last_name || ''}`}</td>
                  <td style={tdStyle}>{m.created_at ? new Date(m.created_at).toLocaleString() : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 0 }}>
            <a
              href="#"
              onClick={e => {
                e.preventDefault();
                if (memberPage > 1) setMemberPage(p => Math.max(1, p - 1));
              }}
              style={{
                color: memberPage === 1 ? palette.textSecondary : palette.accent,
                textDecoration: 'underline',
                pointerEvents: memberPage === 1 ? 'none' : 'auto',
                fontWeight: 600,
                marginRight: 12
              }}
            >
              Prev
            </a>
            {Array.from({ length: memberPageCount }, (_, i) => (
              <a
                key={i + 1}
                href="#"
                onClick={e => {
                  e.preventDefault();
                  setMemberPage(i + 1);
                }}
                style={{
                  color: memberPage === i + 1 ? palette.accent2 : palette.accent,
                  textDecoration: 'underline',
                  fontWeight: memberPage === i + 1 ? 700 : 600,
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
                if (memberPage < memberPageCount) setMemberPage(p => Math.min(memberPageCount, p + 1));
              }}
              style={{
                color: memberPage === memberPageCount ? palette.textSecondary : palette.accent,
                textDecoration: 'underline',
                pointerEvents: memberPage === memberPageCount ? 'none' : 'auto',
                fontWeight: 600
              }}
            >
              Next
            </a>
          </div>
        </div>
        {/* Audit Logs */}
        <hr style={{ borderColor: palette.border }} />
        <h3 style={{ color: palette.text }}>Audit Logs</h3>
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            placeholder="Search audit logs..."
            value={auditLogSearch}
            onChange={e => setAuditLogSearch(e.target.value)}
            style={{ ...inputStyle, fontSize: 15, width: 320 }}
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
              <li key={log.id} style={{ marginBottom: 8, fontSize: 13, borderBottom: `1px solid ${palette.border}`, paddingBottom: 4, color: palette.text }}>
                <strong style={{ color: palette.text }}>{log.action}</strong> by <span style={{ color: palette.accent }}>{log.user_id}</span> on {log.target_type} {log.target_id} <br />
                <span style={{ color: palette.textSecondary }}>{log.created_at}</span>
                {log.details && (
                  <pre style={{ background: palette.card, padding: 8, borderRadius: 4, marginTop: 4, fontSize: 12, color: palette.text }}>{JSON.stringify(log.details, null, 2)}</pre>
                )}
              </li>
            ))}
        </ul>
      </div>
    </>
  );
};

export default AdminDashboard;