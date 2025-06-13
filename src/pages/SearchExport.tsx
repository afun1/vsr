import React, { useState, useEffect } from 'react';
import { supabase } from '../auth/supabaseClient';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import Header from '../Header';
// @ts-ignore
import FileSaver from 'file-saver';
import { useAuth } from '../auth/AuthContext';

type ColumnConfig = {
  id: string;
  label: string;
  accessor: (rec: any) => any;
  default: boolean;
  visible?: boolean;
};

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

const TRANSCRIPT_PREVIEW_LENGTH = 200;

const TranscriptCell: React.FC<{ transcript: string, rec: any, onReadMore: (full: string, title: string, filename: string) => void }> = ({ transcript, rec, onReadMore }) => {
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
  const cardTitle = `${clientDisplayNames.length > 0 ? clientDisplayNames.join(',') : 'Recording'}-by-${displayName.replace(/\s+/g, '')}-${formatDateForFilename(rec.created_at)}`;
  const truncated = transcript && transcript.length > TRANSCRIPT_PREVIEW_LENGTH
    ? transcript.slice(0, TRANSCRIPT_PREVIEW_LENGTH).replace(/\n/g, ' ') + '...'
    : transcript;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          whiteSpace: 'pre-line',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}
      >
        {transcript
          ? truncated
          : <span style={{ color: '#bbb' }}>No transcript</span>
        }
      </span>
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button
          style={{
            background: 'none',
            color: '#1976d2',
            border: 'none',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            padding: 0
          }}
          onClick={() => onReadMore(transcript || 'No transcript', cardTitle, `${cardTitle}.txt`)}
        >
          Read More
        </button>
        <button
          style={{
            background: 'none',
            color: '#28a745',
            border: 'none',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            padding: 0
          }}
          onClick={() => {
            const text = transcript || 'No transcript';
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            FileSaver.saveAs(blob, `${cardTitle}.txt`);
          }}
        >
          Download Text
        </button>
      </div>
    </div>
  );
};

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'date', label: 'Date', accessor: (rec: any) => new Date(rec.created_at).toLocaleString(), default: true },
  { id: 'client', label: 'Client', accessor: (rec: any) => rec.clients?.name || rec.client_name || '', default: true },
  { id: 'email', label: 'Email', accessor: (rec: any) => rec.clients?.email || rec.client_email || '', default: true },
  { id: 'sparky', label: 'Sparky Username', accessor: (rec: any) => rec.clients?.sparky_username || rec.client_sparky_username || '', default: true },
  { id: 'phone', label: 'Phone', accessor: (rec: any) => rec.clients?.phone || rec.client_phone || '', default: true },
  { id: 'user', label: 'User', accessor: (rec: any) => rec.profiles?.display_name || '', default: true },
  { id: 'transcript', label: 'Transcript', accessor: (rec: any) => rec, default: true },
  { id: 'video', label: 'Video', accessor: (rec: any) => rec.video_url ? <a href={rec.video_url} target="_blank" rel="noopener noreferrer">Play</a> : '', default: true },
];

function getStoredColumns(): ColumnConfig[] {
  try {
    const stored = localStorage.getItem('searchExportColumns');
    if (stored) {
      const parsed = JSON.parse(stored);
      return DEFAULT_COLUMNS.map(def => {
        const match = parsed.find((c: any) => c.id === def.id);
        return {
          ...def,
          visible: match && typeof match.visible === 'boolean' ? match.visible : def.default,
        };
      });
    }
  } catch (e) {}
  return DEFAULT_COLUMNS.map(c => ({ ...c, visible: c.default }));
}

function storeColumns(cols: ColumnConfig[]) {
  const toStore = cols.map(c => ({ id: c.id, visible: c.visible }));
  localStorage.setItem('searchExportColumns', JSON.stringify(toStore));
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) {
      return <div style={{color: 'red', padding: 32}}><h2>Something went wrong.</h2><pre>{String(this.state.error)}</pre></div>;
    }
    return this.props.children;
  }
}

const SearchExport: React.FC = () => {
  const { user, role } = useAuth();

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [allClients, setAllClients] = useState<any[]>([]);
  const [filteredRecordings, setFilteredRecordings] = useState<any[]>([]);
  const [allRecordings, setAllRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [columns, setColumns] = useState(() => getStoredColumns());
  const [showColSelector, setShowColSelector] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTranscript, setModalTranscript] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [modalFilename, setModalFilename] = useState('');

  useEffect(() => {
    supabase.from('clients').select('id, name, email').then(({ data }) => {
      if (data) setAllClients(data);
    });
    // fetchRecordings(); // REMOVE this line to avoid fetching before role is loaded
    // eslint-disable-next-line
  }, []);

  const fetchRecordings = async () => {
    setLoading(true);
    let query = supabase
      .from('recordings')
      .select(`id, video_url, transcript, created_at, client_id, user_id, clients:client_id (name, first_name, last_name, email, sparky_username, phone), profiles:user_id (display_name, email)`)
      .order('created_at', { ascending: sortOrder === 'asc' });

    // Only admins see all, users see their own
    if (role !== 'admin' && user) {
      query = query.eq('user_id', user);
    }

    if (clientFilter) query = query.eq('client_id', clientFilter);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');
    const { data } = await query;
    if (data) {
      setAllRecordings(data);
      setFilteredRecordings(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (role !== null) {
      fetchRecordings();
    }
  }, [clientFilter, dateFrom, dateTo, sortOrder, user, role]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredRecordings(allRecordings);
      return;
    }
    const lower = search.toLowerCase();
    const filtered = allRecordings.filter(rec => {
      const clientName = (rec.clients?.name || rec.client_name || '').toLowerCase();
      const clientFirst = (rec.clients?.first_name || '').toLowerCase();
      const clientLast = (rec.clients?.last_name || '').toLowerCase();
      const clientEmail = (rec.clients?.email || rec.client_email || '').toLowerCase();
      const clientSparky = (rec.clients?.sparky_username || rec.client_sparky_username || '').toLowerCase();
      const clientPhone = (rec.clients?.phone || rec.client_phone || '').toLowerCase();
      const userDisplay = (rec.profiles?.display_name || '').toLowerCase();
      const transcript = (rec.transcript || '').toLowerCase();
      const userId = (rec.user_id !== undefined && rec.user_id !== null) ? String(rec.user_id).toLowerCase() : '';
      const clientId = (rec.client_id !== undefined && rec.client_id !== null) ? String(rec.client_id).toLowerCase() : '';
      const recId = (rec.id !== undefined && rec.id !== null) ? String(rec.id).toLowerCase() : '';
      return (
        clientName.includes(lower) ||
        clientFirst.includes(lower) ||
        clientLast.includes(lower) ||
        clientEmail.includes(lower) ||
        clientSparky.includes(lower) ||
        clientPhone.includes(lower) ||
        transcript.includes(lower) ||
        userDisplay.includes(lower) ||
        userId.includes(lower) ||
        clientId.includes(lower) ||
        recId.includes(lower)
      );
    });
    setFilteredRecordings(filtered);
  }, [search, allRecordings]);

  useEffect(() => { storeColumns(columns); }, [columns]);

  const moveColumn = (idx: number, dir: -1 | 1) => {
    const newCols = [...columns];
    const target = idx + dir;
    if (target < 0 || target >= newCols.length) return;
    [newCols[idx], newCols[target]] = [newCols[target], newCols[idx]];
    setColumns(newCols);
  };

  const toggleColumn = (idx: number) => {
    const newCols = [...columns];
    newCols[idx].visible = !newCols[idx].visible;
    setColumns(newCols);
  };

  const visibleColumns = columns.filter(c => c.visible !== false);

  const exportToCSV = () => {
    const headers = visibleColumns.map(c => c.label);
    const rows = filteredRecordings.map(rec => visibleColumns.map(c => {
      let val = c.id === 'transcript'
        ? (rec.transcript || '')
        : c.accessor(rec);
      if (typeof val === 'string') return val.replace(/\n/g, ' ');
      if (typeof val === 'object' && val?.props?.children) return val.props.children;
      return val;
    }));
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => '"' + String(field).replace(/"/g, '""') + '"').join(','))
      .join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recordings-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    const rows = filteredRecordings.map(rec => {
      const row: any = {};
      visibleColumns.forEach(c => {
        let val = c.id === 'transcript'
          ? (rec.transcript || '')
          : c.accessor(rec);
        if (typeof val === 'object' && val?.props?.children) val = val.props.children;
        row[c.label] = val;
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Recordings');
    XLSX.writeFile(wb, `recordings-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    filteredRecordings.forEach((rec, idx) => {
      if (idx > 0) doc.addPage();
      doc.setFontSize(14);
      let y = 20;
      visibleColumns.forEach(col => {
        let val = col.id === 'transcript'
          ? (rec.transcript || '')
          : col.accessor(rec);
        if (typeof val === 'object' && val?.props?.children) val = val.props.children;
        doc.text(`${col.label}: ${val}`, 10, y);
        y += 10;
      });
    });
    doc.save(`recordings-export-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleReadMore = (transcript: string, title: string, filename: string) => {
    setModalTranscript(transcript);
    setModalTitle(title);
    setModalFilename(filename);
    setModalOpen(true);
  };

  return (
    <ErrorBoundary>
      <Header />
      <div style={{ maxWidth: 1400, margin: '2rem auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', padding: 32 }}>
        <h2>Search & Export Recordings</h2>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-end' }}>
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="search-input" style={{ fontWeight: 600, marginBottom: 4 }}>Search</label>
            <input
              id="search-input"
              type="text"
              placeholder="Search by client, email, phone, Sparky username, or transcript..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: 8, fontSize: 15 }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="date-from" style={{ fontWeight: 600, marginBottom: 4 }}>Date Range: From</label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
          </div>
          <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="date-to" style={{ fontWeight: 600, marginBottom: 4 }}>Date Range: To</label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
          </div>
          <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="client-filter" style={{ fontWeight: 600, marginBottom: 4 }}>Client</label>
            <select
              id="client-filter"
              value={clientFilter}
              onChange={e => setClientFilter(e.target.value)}
            >
              <option value="">All Clients</option>
              {allClients.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="sort-order" style={{ fontWeight: 600, marginBottom: 4 }}>Order</label>
            <select
              id="sort-order"
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button onClick={exportToCSV}>Export CSV</button>
          <button onClick={exportToExcel}>Export Excel</button>
          <button onClick={exportToPDF}>Export PDF</button>
        </div>
        {loading ? <div>Loading...</div> : (
          <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #eee', borderRadius: 6, marginTop: 16 }}>
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
              <button onClick={() => setShowColSelector(v => !v)} style={{ fontSize: 14, padding: '4px 12px' }}>Columns</button>
              {showColSelector && (
                <div style={{ position: 'absolute', zIndex: 10, background: '#fff', border: '1px solid #ccc', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: 12, minWidth: 220 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Show/Hide & Order Columns</div>
                  {columns.map((col, idx) => (
                    <div key={col.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      <input type="checkbox" checked={!!col.visible} onChange={() => toggleColumn(idx)} id={`col-${col.id}`} />
                      <label htmlFor={`col-${col.id}`} style={{ marginLeft: 6, flex: 1 }}>{col.label}</label>
                      <button onClick={() => moveColumn(idx, -1)} disabled={idx === 0} style={{ marginLeft: 4, fontSize: 12 }}>↑</button>
                      <button onClick={() => moveColumn(idx, 1)} disabled={idx === columns.length - 1} style={{ fontSize: 12 }}>↓</button>
                    </div>
                  ))}
                  <button onClick={() => setShowColSelector(false)} style={{ marginTop: 8, width: '100%' }}>Done</button>
                </div>
              )}
            </div>
            <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{
                  background: '#f8f8f8',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2
                }}>
                  {visibleColumns.length === 0 ? <th>No columns selected</th> : visibleColumns.map(col => (
                    <th
                      key={col.id}
                      style={{
                        border: '1px solid #ddd',
                        padding: '8px',
                        background: '#f8f8f8',
                        ...(col.id === 'sparky' ? { width: 160 } : {}),
                        ...(col.id === 'transcript' ? { maxWidth: 180 } : {}),
                        position: 'sticky',
                        top: 0,
                        zIndex: 2
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecordings.map(rec => (
                  <tr key={rec.id}>
                    {visibleColumns.length === 0 ? <td>No columns</td> : visibleColumns.map(col => (
                      <td
                        key={col.id}
                        style={{
                          border: '1px solid #ddd',
                          padding: '8px',
                          ...(col.id === 'sparky' ? { width: 160 } : {}),
                          ...(col.id === 'transcript' ? {
                            maxWidth: 320,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            overflow: 'hidden',
                          } : {}),
                          ...(col.id === 'video' ? { maxWidth: 120, wordBreak: 'break-all' } : {}),
                        }}
                      >
                        {col.id === 'transcript'
                          ? <TranscriptCell transcript={rec.transcript || ''} rec={rec} onReadMore={handleReadMore} />
                          : col.accessor(rec)
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {modalOpen && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.32)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              background: '#fff',
              borderRadius: 10,
              maxWidth: 700,
              width: '95%',
              padding: 0,
              boxShadow: '0 8px 32px #0003',
              position: 'relative',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <h3 style={{ marginTop: 24, marginBottom: 16, paddingLeft: 32, paddingRight: 80 }}>{modalTitle}</h3>
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: 32,
                paddingTop: 0,
                minHeight: 0,
                fontSize: 15,
                color: '#222',
                whiteSpace: 'pre-line'
              }}>
                {modalTranscript}
              </div>
              <button
                onClick={() => {
                  const text = modalTranscript || 'No transcript';
                  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                  FileSaver.saveAs(blob, modalFilename || 'transcript.txt');
                }}
                style={{
                  background: 'none',
                  color: '#28a745',
                  border: 'none',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 600,
                  marginLeft: 32,
                  marginBottom: 24,
                  alignSelf: 'flex-start'
                }}
              >
                Download Text
              </button>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  background: '#1976d2',
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
      </div>
    </ErrorBoundary>
  );
};

export default SearchExport;