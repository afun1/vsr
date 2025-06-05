import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../auth/supabaseClient';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      await login(email, role as 'user' | 'admin' | null, password, email === 'miracle@yourdomain.com' ? 'Miracle SR' : undefined); // Pass displayName for admin
      navigate('/user');
    } catch (err: any) {
      setError('Login failed. Please try again.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100vw' }}>
      <div style={{ maxWidth: 300, margin: '2rem 0', textAlign: 'left' }}>
        <h2>Sparky Screen Recorder</h2>
        <form onSubmit={handleSubmit}>
          {/* Show email in the UI, do not show UUID here */}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <div style={{ position: 'relative', marginTop: 8 }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width: '100%' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: '#007bff',
                padding: 0
              }}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
          <button
            type="submit"
            style={{
              background: '#28a745', // green
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '12px 28px',
              fontSize: 18,
              fontWeight: 600,
              boxShadow: '0 2px 8px #28a74522',
              marginTop: 18,
              cursor: 'pointer',
            }}
          >
            Login
          </button>
        </form>
        <div style={{ marginTop: 16 }}>
          <span>Don't have an account?</span>
          <button
            style={{ marginLeft: 8, padding: '4px 12px', fontWeight: 600 }}
            onClick={() => navigate('/signup')}
          >
            Sign Up
          </button>
        </div>
        <button
          type="button"
          style={{ background: 'none', color: '#1976d2', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: 15, marginTop: 4 }}
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
      </div>
    </div>
  );
};

export default Login;
