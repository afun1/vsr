import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../auth/supabaseClient';

// Simple dark mode hook
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

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const darkMode = useDarkMode();

  // Color palette for light/dark mode
  const palette = darkMode
    ? {
        bg: '#181a20',
        card: '#23262f',
        border: '#33384a',
        text: '#e6e6e6',
        accent: '#1976d2',
        accent2: '#28a745',
        accent3: '#e53935',
        inputBg: '#23262f',
        inputText: '#e6e6e6',
        inputBorder: '#33384a',
        shadow: '0 2px 12px #0008',
        link: '#90caf9'
      }
    : {
        bg: '#f7faff',
        card: '#fff',
        border: '#eee',
        text: '#222',
        accent: '#1976d2',
        accent2: '#28a745',
        accent3: '#e53935',
        inputBg: '#fff',
        inputText: '#222',
        inputBorder: '#ccc',
        shadow: '0 2px 8px #1976d211',
        link: '#1976d2'
      };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: palette.inputBg,
    color: palette.inputText,
    border: `1px solid ${palette.inputBorder}`,
    borderRadius: 6,
    padding: '12px 14px',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 0,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'background 0.2s, color 0.2s, border 0.2s'
  };

  const buttonStyle: React.CSSProperties = {
    background: palette.accent2,
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '12px 28px',
    fontSize: 18,
    fontWeight: 600,
    boxShadow: palette.shadow,
    marginTop: 18,
    cursor: 'pointer',
    width: '100%'
  };

  const cardStyle: React.CSSProperties = {
    maxWidth: 420,
    margin: '2rem 0',
    textAlign: 'left' as const,
    background: palette.card,
    borderRadius: 10,
    padding: 24,
    boxShadow: palette.shadow,
    color: palette.text,
    border: `1px solid ${palette.border}`,
    width: '100%'
  };

  const linkButtonStyle: React.CSSProperties = {
    background: 'none',
    color: palette.link,
    border: 'none',
    textDecoration: 'underline',
    cursor: 'pointer',
    fontSize: 15,
    marginTop: 4,
    padding: 0
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // Use Supabase signInWithPassword for login
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      return;
    }
    // Fetch the user
    const { data: { user } } = await supabase.auth.getUser();
    let role = 'user';
    if (user) {
      // Always fetch role from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile && profile.role) {
        role = profile.role;
      }
    }
    try {
      await login(email, role as 'user' | 'admin' | null, password, email === 'miracle@yourdomain.com' ? 'Miracle SR' : undefined);
      navigate('/user');
    } catch (err: any) {
      setError('Login failed. Please try again.');
    }
  };

  // --- Password Reset Handler ---
  const handlePasswordReset = async (email: string) => {
    setResetMessage(null);
    setError(null);
    if (!email) {
      setError('Please enter your email address above first.');
      return;
    }
    const redirectTo = 'https://sr-nine-red.vercel.app/reset-password';
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      setError(error.message || 'Failed to send reset link.');
    } else {
      setResetMessage('Password reset link sent! Check your email.');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100vw',
        background: palette.bg,
        color: palette.text,
        transition: 'background 0.2s, color 0.2s'
      }}
    >
      <div style={cardStyle}>
        <h2 style={{ color: palette.text, marginBottom: 18 }}>Sparky Screen Recorder</h2>
        <form onSubmit={handleSubmit} autoComplete="on">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
            autoComplete="email"
          />
          <div style={{ position: 'relative', marginTop: 8 }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={inputStyle}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: palette.link,
                padding: 0
              }}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {error && <div style={{ color: palette.accent3, marginTop: 8 }}>{error}</div>}
          <button type="submit" style={buttonStyle}>
            Login
          </button>
        </form>
        <div style={{ marginTop: 16, color: palette.text }}>
          <span>Don't have an account?</span>
          <button
            style={{
              marginLeft: 8,
              padding: '4px 12px',
              fontWeight: 600,
              background: palette.accent,
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
            onClick={() => navigate('/signup')}
          >
            Sign Up
          </button>
        </div>
        <button
          type="button"
          style={linkButtonStyle}
          onClick={() => handlePasswordReset(email)}
        >
          Forgot password?
        </button>
        {resetMessage && <div style={{ color: palette.accent2, marginTop: 8 }}>{resetMessage}</div>}
      </div>
    </div>
  );
};

export default Login;