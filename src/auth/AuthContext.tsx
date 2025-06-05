import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './supabaseClient';

// Types for user and roles
export type UserRole = 'user' | 'admin' | null;
export interface AuthContextType {
  user: string | null;
  role: UserRole;
  login: (username: string, role: UserRole, password?: string, displayName?: string) => Promise<void>;
  logout: () => void;
  promoteToAdmin: (targetUser: string) => void; // Added promoteToAdmin
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  // On mount, check for session
  React.useEffect(() => {
    const session = supabase.auth.getSession();
    session.then(({ data }) => {
      if (data.session) {
        setUser(data.session.user.email || data.session.user.id);
        // Fetch user role from Supabase (stub: default to 'user')
        fetchUserRole(data.session.user.id);
      }
      setLoading(false);
    });
    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user.email || session.user.id);
        fetchUserRole(session.user.id);
      } else {
        setUser(null);
        setRole(null);
      }
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Fetch user role from Supabase
  const fetchUserRole = async (_userId: string) => {
    // Always await getUser and use the id directly
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      setRole('user');
      console.log('[AuthContext] fetchUserRole: no userId, setting role to user');
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    if (error || !data) {
      setRole('user');
      console.log('[AuthContext] fetchUserRole: error or no data, setting role to user', error, data);
      return;
    }
    setRole(data.role as UserRole);
    console.log('[AuthContext] fetchUserRole: set role to', data.role);
  };

  // Supabase login
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
      console.log('[LOGIN] user.id:', userData.user.id, 'user.email:', userData.user.email);
      // Check if profile exists (by id)
      const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
      console.log('[LOGIN] profile fetch result:', profile, 'error:', profileError);
      if (profileError || !profile) {
        // Profile does not exist: create it (include display_name if provided)
        const upsertObj: any = {
          id: userData.user.id,
          email: userData.user.email,
        };
        if (typeof displayName === 'string' && displayName.trim() !== '') {
          upsertObj.display_name = displayName;
        }
        await supabase.from('profiles').upsert(upsertObj, { onConflict: 'id' });
        console.log('[LOGIN] upserted new profile:', upsertObj);
      } else if ((profile.display_name === null || profile.display_name === '') && typeof displayName === 'string' && displayName.trim() !== '') {
        // Profile exists but display_name is blank/null and a displayName is provided: heal it
        await supabase.from('profiles').update({ display_name: displayName }).eq('id', userData.user.id);
        console.log('[LOGIN] healed blank display_name for existing profile:', userData.user.id);
      }
      // If profile exists and display_name is set, do NOT update display_name here.
      fetchUserRole(userData.user.id);
    }
    setUser(email);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
  };

  // Helper: Only admins can promote others to admin
  const promoteToAdmin = (targetUser: string) => {
    if (role !== 'admin') {
      alert('Only admins can promote users to admin.');
      return;
    }
    // In a real app, this would update the backend/user list
    alert(`${targetUser} is now an admin! (stub)`);
  };

  if (loading) return <div>Loading...</div>;

  // Debug: log current role and user on every render
  console.log('[AuthProvider] render: user:', user, 'role:', role);

  return (
    <AuthContext.Provider value={{ user, role, login, logout, promoteToAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
