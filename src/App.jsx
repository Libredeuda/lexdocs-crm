import { useState, useEffect } from "react";
import Login from "./components/Login";
import ClientApp from "./client/ClientApp";
import AdminApp from "./admin/AdminApp";
import { supabase } from "./lib/supabase";
import { DEMO } from "./constants";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: check if there's an existing Supabase session
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (profile) {
          setUser(profile);
        }
      }
      setLoading(false);
    });
  }, []);

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

  async function handleLogin(email, password) {
    // Try Supabase auth first
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const profile = await fetchProfile(data.user.id);
      if (profile) {
        setUser(profile);
        return;
      }
      throw new Error('Usuario no encontrado en el sistema');
    } catch (e) {
      console.log('Supabase auth failed:', e.message);
    }

    // Fallback: demo credentials
    const found = DEMO.find(c => c.email === email && c.password === password);
    if (found) {
      setUser(found);
      return;
    }

    throw new Error('Credenciales incorrectas');
  }

  function handleLogout() {
    supabase.auth.signOut();
    setUser(null);
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F5F7', fontFamily: "'Poppins', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #E5E5EA', borderTopColor: '#5B6BF0', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#7A7A8A', fontSize: 14 }}>Cargando...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  if (!user) return <Login onLogin={handleLogin} />;

  const role = user.role;

  if (role === 'admin' || role === 'owner' || role === 'lawyer' || role === 'staff') {
    return <AdminApp user={user} onLogout={handleLogout} />;
  }

  return <ClientApp user={user} onLogout={handleLogout} />;
}
