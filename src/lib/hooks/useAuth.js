import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';

export function useAuth() {
  const [user, setUser] = useState(null);       // public.users record + org info
  const [session, setSession] = useState(null);  // Supabase auth session
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch public user profile + org
  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*, organizations(*)')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('Profile fetch error:', error);
      return null;
    }
    return data;
  }

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        const profile = await fetchProfile(s.user.id);
        setUser(profile);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);
      if (s?.user) {
        const profile = await fetchProfile(s.user.id);
        setUser(profile);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      const profile = await fetchProfile(data.user.id);
      setUser(profile);
      setSession(data.session);
      return profile;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  return { user, session, loading, error, login, logout };
}
