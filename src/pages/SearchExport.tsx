import React, { useState, useEffect } from 'react';
import { supabase } from '../auth/supabaseClient';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import Header from '../Header';

// --- COLUMN CONFIGURATION ---
type ColumnConfig = {
  id: string;
  label: string;
  accessor: (rec: any) => any;
  default: boolean;
  visible?: boolean;
};

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'date', label: 'Date', accessor: (rec: any) => new Date(rec.created_at).toLocaleString(), default: true },
  { id: 'client', label: 'Client', accessor: (rec: any) => rec.clients?.name || rec.client_name || '', default: true },
  { id: 'email', label: 'Email', accessor: (rec: any) => rec.clients?.email || rec.client_email || '', default: true },
  { id: 'sparky', label: 'Sparky Username', accessor: (rec: any) => rec.clients?.sparky_username || rec.client_sparky_username || '', default: true },
  { id: 'phone', label: 'Phone', accessor: (rec: any) => rec.clients?.phone || rec.client_phone || '', default: true },
  { id: 'user', label: 'User', accessor: (rec: any) => rec.profiles?.display_name || '', default: true },
  { id: 'transcript', label: 'Transcript', accessor: (rec: any) => <TranscriptCell transcript={rec.transcript || ''} />, default: true },
  { id: 'video', label: 'Video', accessor: (rec: any) => rec.video_url ? <a href={rec.video_url} target="_blank" rel="noopener noreferrer">View</a> : '', default: true },
];

function getStoredColumns(): ColumnConfig[] {
  try {
    const stored = localStorage.getItem('searchExportColumns');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure all columns have 'visible' property
      return DEFAULT_COLUMNS.map(def => {
        const match = parsed.find((c: any) => c.id === def.id);
        return {
          ...def,
          visible: match && typeof match.visible === 'boolean' ? match.visible : def.default,
        };
      });
    }
  } catch (e) {
    console.error('Error parsing stored columns', e);
  }
  // fallback: ensure all have visible
  return DEFAULT_COLUMNS.map(c => ({ ...c, visible: c.default }));
}

function storeColumns(cols: ColumnConfig[]) {
  // Only store id and visible to avoid function serialization issues
  const toStore = cols.map(c => ({ id: c.id, visible: c.visible }));
  localStorage.setItem('searchExportColumns', JSON.stringify(toStore));
}

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return <div style={{color: 'red', padding: 32}}><h2>Something went wrong.</h2><pre>{String(this.state.error)}</pre></div>;
    }
    return this.props.children;
  }
}

const TRANSCRIPT_PREVIEW_LENGTH = 200;

const TranscriptCell: React.FC<{ transcript: string }> = ({ transcript }) => {
  const [expanded, setExpanded] = useState(false);
  if (!transcript) return <span style={{ color: '#888' }}>(No transcript)</span>;
  if (transcript.length <= TRANSCRIPT_PREVIEW_LENGTH) return <span>{transcript}</span>;
  return (
    <>
      <span>{expanded ? transcript : transcript.slice(0, TRANSCRIPT_PREVIEW_LENGTH) + '... '}</span>
      <button
        style={{ marginLeft: 8, fontSize: 12, padding: '2px 8px' }}
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? 'Collapse' : 'Expand'}
      </button>
    </>
  );
};

const SearchExport: React.FC = () => {
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

  useEffect(() => {
    supabase.from('clients').select('id, name, email').then(({ data }) => {
      if (data) setAllClients(data);
    });
    fetchRecordings();
    // eslint-disable-next-line
  }, []);

  const fetchRecordings = async () => {
    setLoading(true);
    let query = supabase
      .from('recordings')
      .select(`id, video_url, transcript, created_at, client_id, user_id, clients:client_id (name, first_name, last_name, email, sparky_username, phone), profiles:user_id (display_name, email)`)
      .order('created_at', { ascending: sortOrder === 'asc' });
    if (clientFilter) query = query.eq('client_id', clientFilter);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');
    const { data, error } = await query;
    if (!error && data) {
      console.log('DEBUG: fetched recordings', data);
      setAllRecordings(data);
      setFilteredRecordings(data);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRecordings(); }, [clientFilter, dateFrom, dateTo, sortOrder]);
  useEffect(() => {
    if (!search.trim()) {
      setFilteredRecordings(allRecordings);
      console.log('DEBUG: search empty, showing allRecordings', allRecordings.length);
      return;
    }
    const lower = search.toLowerCase();
    const filtered = allRecordings.filter(rec => {
      // Client fields
      const clientName = (rec.clients?.name || rec.client_name || '').toLowerCase();
      const clientFirst = (rec.clients?.first_name || '').toLowerCase();
      const clientLast = (rec.clients?.last_name || '').toLowerCase();
      const clientEmail = (rec.clients?.email || rec.client_email || '').toLowerCase();
      const clientSparky = (rec.clients?.sparky_username || rec.client_sparky_username || '').toLowerCase();
      const clientPhone = (rec.clients?.phone || rec.client_phone || '').toLowerCase();
      // Recorder display name
      const userDisplay = (rec.profiles?.display_name || '').toLowerCase();
      // Transcript
      const transcript = (rec.transcript || '').toLowerCase();
      // IDs (force string)
      const userId = (rec.user_id !== undefined && rec.user_id !== null) ? String(rec.user_id).toLowerCase() : '';
      const clientId = (rec.client_id !== undefined && rec.client_id !== null) ? String(rec.client_id).toLowerCase() : '';
      const recId = (rec.id !== undefined && rec.id !== null) ? String(rec.id).toLowerCase() : '';
      // Debug log for userId, clientId, recId
      if (search.toLowerCase() === userId || search.toLowerCase() === clientId || search.toLowerCase() === recId) {
        console.log('DEBUG: record matches by id', {userId, clientId, recId, rec});
      }
      // Match any fragment
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
    console.log('DEBUG: filteredRecordings after search', filtered.length, 'search:', search);
  }, [search, allRecordings]);

  useEffect(() => { storeColumns(columns); }, [columns]);

  // --- COLUMN SELECTOR UI ---
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

  // --- FILTERED COLUMNS ---
  const visibleColumns = columns.filter(c => c.visible !== false);

  // --- EXPORTS: use visibleColumns ---
  const exportToCSV = () => {
    const headers = visibleColumns.map(c => c.label);
    const rows = filteredRecordings.map(rec => visibleColumns.map(c => {
      const val = c.accessor(rec);
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
        let val = c.accessor(rec);
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
        let val = col.accessor(rec);
        if (typeof val === 'object' && val?.props?.children) val = val.props.children;
        doc.text(`${col.label}: ${val}`, 10, y);
        y += 10;
      });
    });
    doc.save(`recordings-export-${new Date().toISOString().slice(0, 10)}.pdf`);
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
            {/* COLUMN SELECTOR DROPDOWN */}
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
                <tr style={{ background: '#f8f8f8' }}>
                  {visibleColumns.length === 0 ? <th>No columns selected</th> : visibleColumns.map(col => (
                    <th key={col.id} style={{ border: '1px solid #ddd', padding: '8px', ...(col.id === 'sparky' ? { width: 160 } : {}), ...(col.id === 'transcript' ? { maxWidth: 180 } : {}) }}>{col.label}</th>
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
                        {col.accessor(rec)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default SearchExport;
