import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../auth/supabaseClient';

// --- Dark mode hook ---
const useDarkMode = () => {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return dark;
};

const Signup: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const darkMode = useDarkMode();

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
        inputBg: '#23262f',
        inputText: '#e6e6e6',
        inputBorder: '#33384a',
        shadow: '0 2px 12px #0008',
        error: '#e53935',
        success: '#28a745'
      }
    : {
        bg: '#fff',
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
        inputBg: '#fff',
        inputText: '#222',
        inputBorder: '#ccc',
        shadow: '0 2px 8px #0001',
        error: '#e53935',
        success: '#28a745'
      };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 10,
    fontSize: 16,
    background: palette.inputBg,
    color: palette.inputText,
    border: `1px solid ${palette.inputBorder}`,
    borderRadius: 6,
    marginTop: 8,
    marginBottom: 0,
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'background 0.2s, color 0.2s, border 0.2s'
  };

  const labelStyle: React.CSSProperties = {
    color: palette.text,
    fontWeight: 600,
    marginTop: 12,
    marginBottom: 2,
    display: 'block'
  };

  const cardStyle: React.CSSProperties = {
    maxWidth: 340,
    margin: '2rem auto',
    background: palette.card,
    borderRadius: 10,
    boxShadow: palette.shadow,
    padding: 32,
    color: palette.text,
    border: `1px solid ${palette.border}`,
    transition: 'background 0.2s, color 0.2s'
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: '#ff9800',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '12px 28px',
    fontSize: 18,
    fontWeight: 600,
    boxShadow: '0 2px 8px #ff980022',
    marginTop: 18,
    cursor: 'pointer',
    width: '100%',
    transition: 'background 0.2s'
  };

  const linkButtonStyle: React.CSSProperties = {
    background: 'none',
    color: palette.accent,
    border: 'none',
    textDecoration: 'underline',
    cursor: 'pointer',
    fontSize: 15,
    marginTop: 4
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password || !firstName || !lastName) {
      setError('All fields are required.');
      return;
    }
    try {
      const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
      // Call Supabase signUp directly for signup
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      await login(email, 'user', password, displayName); // login will upsert profile and set context
      navigate('/user');
    } catch (err: any) {
      setError('Signup failed. Please try again.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: palette.bg, paddingTop: 40 }}>
      <div style={cardStyle}>
        <h2 style={{ color: palette.text, textAlign: 'center', marginBottom: 24 }}>Sign Up</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="signup-email" style={labelStyle}>Email</label>
          <input
            id="signup-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
            autoComplete="username"
          />
          <label htmlFor="signup-first" style={labelStyle}>First Name</label>
          <input
            id="signup-first"
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            required
            style={inputStyle}
            autoComplete="given-name"
          />
          <label htmlFor="signup-last" style={labelStyle}>Last Name</label>
          <input
            id="signup-last"
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            required
            style={inputStyle}
            autoComplete="family-name"
          />
          <label htmlFor="signup-password" style={labelStyle}>Password</label>
          <div style={{ position: 'relative', marginTop: 0 }}>
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ ...inputStyle, paddingRight: 60 }}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: palette.accent,
                padding: 0
              }}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <button
            type="button"
            style={linkButtonStyle}
            onClick={() => {
              if (email) {
                window.location.href = `mailto:${email}?subject=Password%20Reset%20Request&body=Hi%2C%20please%20help%20me%20reset%20my%20password.`;
              } else {
                alert('Please enter your email address above first.');
              }
            }}
          >
            Forgot password?
          </button>
          <button
            type="submit"
            style={buttonStyle}
            className="signup-btn-override"
          >
            Sign Up
          </button>
        </form>
        {error && <div style={{ color: palette.error, marginTop: 10 }}>{error}</div>}
        <div style={{ marginTop: 16, textAlign: 'center', color: palette.text }}>
          <span>Already have an account?</span>
          <button
            style={{
              marginLeft: 8,
              padding: '4px 12px',
              fontWeight: 600,
              background: 'none',
              color: palette.accent,
              border: 'none',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/login')}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default Signup;