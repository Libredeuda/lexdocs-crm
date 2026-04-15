import { useState } from "react";
import Login from "./components/Login";
import ClientApp from "./client/ClientApp";
import AdminApp from "./admin/AdminApp";
import { useAuth } from "./lib/hooks/useAuth";
import { DEMO } from "./constants";

export default function App() {
  const { user: supaUser, loading, login: supaLogin, logout: supaLogout } = useAuth();
  const [demoUser, setDemoUser] = useState(null);

  // Determine active user (Supabase auth takes priority, then demo fallback)
  const user = supaUser || demoUser;

  async function handleLogin(email, password) {
    // Try Supabase auth first
    try {
      await supaLogin(email, password);
      return; // Success - useAuth will set the user
    } catch (e) {
      console.log('Supabase auth failed, trying demo mode:', e.message);
    }

    // Fallback: demo credentials
    const found = DEMO.find(c => c.email === email && c.password === password);
    if (found) {
      setDemoUser(found);
      return;
    }

    throw new Error('Credenciales incorrectas');
  }

  function handleLogout() {
    if (supaUser) {
      supaLogout();
    }
    setDemoUser(null);
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

  // Determine role: Supabase user has role in the record, demo user has role property
  const role = user.role;

  if (role === 'admin' || role === 'owner' || role === 'lawyer') {
    return <AdminApp user={user} onLogout={handleLogout} />;
  }

  return <ClientApp user={user} onLogout={handleLogout} />;
}
