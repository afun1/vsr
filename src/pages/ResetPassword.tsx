import React, { useEffect, useState } from 'react';
import { supabase } from '../auth/supabaseClient';
import { useNavigate } from 'react-router-dom';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowForm(true);
        setLoading(false);
        setEmail(session?.user?.email || '');
      } else if (event === 'SIGNED_IN' && session?.user?.email) {
        setShowForm(true);
        setLoading(false);
        setEmail(session.user.email || '');
      }
    });
    // Also check if already in recovery mode on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && session.user) {
        setShowForm(true);
        setLoading(false);
        setEmail(session.user.email || '');
      } else {
        setLoading(false);
      }
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
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

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: 20, color: '#1976d2' }}>Loading...</div>
      </div>
    );
  }

  if (!showForm) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ maxWidth: 420, margin: '2rem 0', textAlign: 'left', background: '#f7faff', borderRadius: 10, padding: 24, boxShadow: '0 2px 8px #1976d211' }}>
        <h2>Reset Password</h2>
        <div style={{ color: 'red', marginBottom: 12 }}>
          Could not detect a valid password reset session.<br />
          Please use the link from your email, or request a new password reset.
        </div>
      </div>
    </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ maxWidth: 420, margin: '2rem 0', textAlign: 'left', background: '#f7faff', borderRadius: 10, padding: 24, boxShadow: '0 2px 8px #1976d211' }}>
        <h2>Set New Password</h2>
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
        <div style={{ marginTop: 16, fontSize: 12, color: '#888' }}>
          <div>email: {email}</div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
