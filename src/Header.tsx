import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './auth/supabaseClient';
import { useAuth } from './auth/AuthContext';

const Header: React.FC = () => {
  const { user, role } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [camSize, setCamSize] = useState(80); // 80 or 160
  const [drag, setDrag] = useState<{ x: number; y: number }>({ x: 18, y: 18 });
  const [dragging, setDragging] = useState(false);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Track offset between mouse and top-left of box when drag starts
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const fetchDisplayName = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      const userEmail = userData?.user?.email;
      if (!userId && !userEmail) { setDisplayName(''); return; }
      let { data } = await supabase.from('profiles').select('display_name').or(`id.eq.${userId},email.eq.${userEmail}`).single();
      setDisplayName(data?.display_name || userEmail || userId || 'User');
    };
    fetchDisplayName();
  }, [user]);

  // Handle camera open/close
  useEffect(() => {
    let active = true;
    if (cameraOpen) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (!active) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          cameraStreamRef.current = stream;
          if (cameraVideoRef.current) {
            cameraVideoRef.current.srcObject = stream;
            cameraVideoRef.current.play().catch(() => {});
          }
        })
        .catch(() => {
          setCameraOpen(false);
          if (cameraStreamRef.current) {
            cameraStreamRef.current.getTracks().forEach(track => track.stop());
            cameraStreamRef.current = null;
          }
          if (cameraVideoRef.current) {
            cameraVideoRef.current.srcObject = null;
          }
        });
    } else {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
        cameraStreamRef.current = null;
      }
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = null;
      }
    }
    // Cleanup on unmount
    return () => {
      active = false;
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
        cameraStreamRef.current = null;
      }
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = null;
      }
    };
  }, [cameraOpen]);

  // Mouse drag handlers
  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setDrag({
        x: Math.max(0, e.clientX - dragOffsetRef.current.x),
        y: Math.max(0, e.clientY - dragOffsetRef.current.y),
      });
    };
    const handleMouseUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  // Touch drag handlers
  useEffect(() => {
    if (!dragging) return;
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        setDrag({
          x: Math.max(0, e.touches[0].clientX - dragOffsetRef.current.x),
          y: Math.max(0, e.touches[0].clientY - dragOffsetRef.current.y),
        });
      }
    };
    const handleTouchEnd = () => setDragging(false);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dragging]);

  return (
    <>
      <header style={{
        width: '100%',
        background: '#fff',
        boxShadow: '0 2px 8px #0001',
        padding: '0 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 64,
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 100
      }}>
        {/* Left column (logo or nav) */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', height: '100%' }}>
          <div style={{ fontWeight: 700, fontSize: 22, color: '#1976d2', letterSpacing: '-1px' }}>
            Sparky Recorder
          </div>
          <div style={{ fontSize: 17, color: '#444', fontWeight: 500, marginLeft: 18 }}>Welcome,{' '}
            <span style={{
              fontSize: 17,
              color: '#1976d2',
              fontWeight: 700,
              background: 'transparent',
              borderRadius: 0,
              padding: 0,
              minWidth: 0,
              maxWidth: 220,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginLeft: 0
            }}>{displayName || user || 'User'}</span>
          </div>
        </div>
        {/* Center column (Camera and PiP buttons) */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <button
            onClick={() => setCameraOpen(prev => !prev)}
            style={{
              background: cameraOpen ? '#dc3545' : '#1976d2',
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              borderRadius: 6,
              padding: '8px 24px',
              fontSize: 16,
              cursor: 'pointer',
              boxShadow: cameraOpen ? '0 2px 8px #dc354522' : '0 2px 8px #1976d222'
            }}
          >
            {cameraOpen ? 'Close Camera' : 'Open Camera'}
          </button>
        </div>
        {/* Right column (user/profile/logout) */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          <a
            href={role === 'admin' ? 'https://sr-nine-red.vercel.app/admin' : 'https://sr-nine-red.vercel.app/user'}
            style={{
              background: 'transparent',
              color: '#1976d2',
              fontWeight: 700,
              border: 'none',
              borderRadius: 6,
              padding: '8px 24px',
              fontSize: 16,
              cursor: 'pointer',
              boxShadow: 'none',
              textDecoration: 'none',
              marginRight: 16
            }}
          >
            Home
          </a>
          <a href="/search-export" style={{ color: '#1976d2', fontWeight: 600, fontSize: 16, textDecoration: 'none', marginRight: 8 }}>Search</a>
          <a href="/search-export" style={{ color: '#1976d2', fontWeight: 600, fontSize: 16, textDecoration: 'none', marginRight: 8 }}>Export</a>
          <button
            onClick={() => { if (window.confirm('Log out?')) { localStorage.clear(); window.location.href = '/login'; } }}
            style={{ background: 'none', border: 'none', color: '#e53935', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginLeft: 8, marginRight: 20 }}
          >
            Log Out
          </button>
        </div>
      </header>
      {/* Camera view in bottom right, resizable and draggable */}
      {cameraOpen && (
        <div
          style={{
            position: 'fixed',
            left: drag.x,
            top: drag.y,
            width: camSize,
            height: camSize,
            zIndex: 9999,
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 2px 8px #0003',
            background: '#000',
            userSelect: dragging ? 'none' : undefined,
            transition: dragging ? 'none' : 'box-shadow 0.2s',
            cursor: dragging ? 'grabbing' : 'grab'
          }}
          onMouseDown={e => {
            // Only start drag if not clicking the size button
            if ((e.target as HTMLElement).closest('.size-arrow-btn')) return;
            setDragging(true);
            // Offset from top-left of box to mouse position
            dragOffsetRef.current = {
              x: e.clientX - drag.x,
              y: e.clientY - drag.y
            };
          }}
          onTouchStart={e => {
            if ((e.target as HTMLElement).closest('.size-arrow-btn')) return;
            if (e.touches.length === 1) {
              setDragging(true);
              dragOffsetRef.current = {
                x: e.touches[0].clientX - drag.x,
                y: e.touches[0].clientY - drag.y
              };
            }
          }}
        >
          {/* Size toggle arrow in the corner */}
          <button
            className="size-arrow-btn"
            onClick={e => {
              e.stopPropagation();
              setCamSize(s => (s === 80 ? 160 : 80));
            }}
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              zIndex: 3,
              background: 'none',
              color: '#fff',
              border: 'none',
              borderRadius: 0,
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
              filter: 'drop-shadow(0 1px 2px #0008)'
            }}
            tabIndex={-1}
            title="Toggle size"
          >
            {camSize === 80
              ? (
                // Arrow to upper right
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <polyline points="3,15 15,3" stroke="#fff" strokeWidth="2.5" fill="none" />
                  <polyline points="8,3 15,3 15,10" stroke="#fff" strokeWidth="2.5" fill="none" />
                </svg>
              )
              : (
                // Arrow to center (down)
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <polyline points="9,3 9,15" stroke="#fff" strokeWidth="2.5" fill="none" />
                  <polyline points="4,10 9,15 14,10" stroke="#fff" strokeWidth="2.5" fill="none" />
                </svg>
              )
            }
          </button>
          <video
            ref={cameraVideoRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              marginTop: 0
            }}
            autoPlay
            muted
            playsInline
          />
        </div>
      )}
    </>
  );
};

export default Header;