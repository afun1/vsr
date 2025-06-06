import React, { useEffect, useState } from 'react';
import { supabase } from '../auth/supabaseClient';
import { useNavigate } from 'react-router-dom';

// Helper to parse hash params (e.g. #access_token=...&type=recovery)
function parseHashParams(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const navigate = useNavigate();

  // Reactively parse hash and search params
  useEffect(() => {
    function updateFromLocation() {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = parseHashParams(window.location.hash);
      const token = hashParams.access_token || searchParams.get('access_token');
      const t = hashParams.type || searchParams.get('type');
      setAccessToken(token);
      setType(t);
    }
    updateFromLocation();
    window.addEventListener('hashchange', updateFromLocation);
    return () => window.removeEventListener('hashchange', updateFromLocation);
  }, []);

  useEffect(() => {
    if (accessToken === null) {
      // Wait for hash to be processed
      return;
    }
    if (!accessToken) {
      setError('No access_token in URL. You must use the link from your email.');
    } else {
      setError(null);
    }
  }, [accessToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!accessToken) {
      setError('No access_token in URL. You must use the link from your email.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    // Supabase will use the session from the access_token in the URL fragment
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSuccess('Password updated! Logging you in...');
      setTimeout(() => {
        navigate('/user');
      }, 1500);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ maxWidth: 420, margin: '2rem 0', textAlign: 'left', background: '#f7faff', borderRadius: 10, padding: 24, boxShadow: '0 2px 8px #1976d211' }}>
        <h2>Reset Password</h2>
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ color: 'green', marginBottom: 12 }}>{success}</div>}
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ width: '100%', marginBottom: 8 }}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            style={{ width: '100%', marginBottom: 8 }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 28px', fontSize: 18, fontWeight: 600, boxShadow: '0 2px 8px #1976d222', marginTop: 8, cursor: 'pointer' }}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
        {/* Debug info for troubleshooting */}
        <div style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
          <div>access_token: {accessToken ? '[present]' : '[missing]'}</div>
          <div>type: {type}</div>
          <div>hash: {window.location.hash}</div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
