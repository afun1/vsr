import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../auth/supabaseClient';

const Signup: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

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
    <>
      <div style={{ maxWidth: 300, margin: '2rem auto' }}>
        <h2>Sign Up</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            required
            style={{ marginTop: 8 }}
          />
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            required
            style={{ marginTop: 8 }}
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
          <button
            type="submit"
            style={{
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
              transition: 'background 0.2s',
              // Use CSSStyleDeclaration string for !important
              // @ts-ignore
              '--signup-btn': 'true',
            }}
            className="signup-btn-override"
          >
            Sign Up
          </button>
        </form>
        {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <span>Already have an account?</span>
          <button
            style={{ marginLeft: 8, padding: '4px 12px', fontWeight: 600 }}
            onClick={() => navigate('/login')}
          >
            Login
          </button>
        </div>
      </div>
    </>
  );
};

export default Signup;
