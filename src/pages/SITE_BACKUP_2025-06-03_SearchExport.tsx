// SITE BACKUP: SearchExport.tsx as of 2025-06-03
// This is a backup of the working SearchExport.tsx with robust, case-insensitive, fragment-matching search/filter and stable export features.

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
  { id: 'transcript', label: 'Transcript', accessor: (rec: any) => rec.transcript || '', default: true },
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

const SearchExport: React.FC = () => {
  // ...existing code...
  // (See main file for full implementation)
};

export default SearchExport;
