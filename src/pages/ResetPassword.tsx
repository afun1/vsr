import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../auth/supabaseClient';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // If no access_token in URL, redirect to login
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const type = params.get('type');
    const refreshToken = params.get('refresh_token');
    const errorDesc = params.get('error_description');
    // Debug output for troubleshooting
    console.log('[ResetPassword] URL params:', {
      accessToken,
      type,
      refreshToken,
      errorDesc,
      full: window.location.search
    });
    if (!accessToken) {
      setError('No access_token in URL. You must use the link from your email.');
      // Don't redirect immediately, show error for debug
      // navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    // If the user lands here from a Supabase reset link, prefill email if possible
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) setEmail(emailParam);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    // Supabase will have the user session if access_token is valid
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      setError(error.message || 'Failed to reset password.');
      return;
    }
    // Try to sign in automatically
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setSuccess('Password updated! Please log in.');
      setTimeout(() => navigate('/login'), 2000);
    } else {
      setSuccess('Password updated! Logging you in...');
      setTimeout(() => navigate('/user'), 1200);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100vw' }}>
      <div style={{ maxWidth: 420, margin: '2rem 0', textAlign: 'left', background: '#f7faff', borderRadius: 10, padding: 24, boxShadow: '0 2px 8px #1976d211' }}>
        <h2>Set New Password</h2>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
          <b>Debug info:</b> <br />
          <code style={{ fontSize: 12 }}>{window.location.search}</code>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ width: '100%', marginBottom: 10 }}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            style={{ width: '100%', marginBottom: 10 }}
          />
          {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
          {success && <div style={{ color: 'green', marginBottom: 8 }}>{success}</div>}
          <button type="submit" style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 28px', fontSize: 18, fontWeight: 600, boxShadow: '0 2px 8px #1976d222', marginTop: 8, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }} disabled={loading}>
            {loading ? 'Updating...' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
