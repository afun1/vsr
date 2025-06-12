import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './supabaseClient';

// Types for user and roles
export type UserRole = 'user' | 'admin' | null;
export interface AuthContextType {
  user: string | null;
  role: UserRole;
  loading: boolean;
  login: (username: string, role: UserRole, password?: string, displayName?: string) => Promise<void>;
  logout: () => void;
  promoteToAdmin: (targetUser: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user role from Supabase and set loading to false after
  const fetchUserRole = async (_userId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      setRole('user');
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    if (error || !data) {
      setRole('user');
      setLoading(false);
      return;
    }
    setRole(data.role as UserRole);
    setLoading(false);
  };

  React.useEffect(() => {
    const session = supabase.auth.getSession();
    session.then(({ data }) => {
      if (data.session) {
        setUser(data.session.user.id);
        fetchUserRole(data.session.user.id);
      } else {
        setLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user.id);
        fetchUserRole(session.user.id);
      } else {
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const login = async (username: string, _userRole: UserRole, password?: string, displayName?: string) => {
    const email = username.includes('@') ? username : `${username}@example.com`;
    let signInError = null;
    if (password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      signInError = error;
    } else {
      const { error } = await supabase.auth.signInWithOtp({ email });
      signInError = error;
    }
    if (signInError) {
      alert(signInError.message);
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
      if (profileError || !profile) {
        const upsertObj: any = {
          id: userData.user.id,
          email: userData.user.email,
        };
        if (typeof displayName === 'string' && displayName.trim() !== '') {
          upsertObj.display_name = displayName;
        }
        await supabase.from('profiles').upsert(upsertObj, { onConflict: 'id' });
      } else if ((profile.display_name === null || profile.display_name === '') && typeof displayName === 'string' && displayName.trim() !== '') {
        await supabase.from('profiles').update({ display_name: displayName }).eq('id', userData.user.id);
      }
      fetchUserRole(userData.user.id);
      setUser(userData.user.id);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setLoading(false);
  };

  const promoteToAdmin = (targetUser: string) => {
    if (role !== 'admin') {
      alert('Only admins can promote users to admin.');
      return;
    }
    alert(`${targetUser} is now an admin! (stub)`);
  };

  // Debug: log current role and user on every render
  console.log('[AuthProvider] render: user:', user, 'role:', role, 'loading:', loading);

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout, promoteToAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};