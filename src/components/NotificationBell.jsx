import { useState, useEffect, useRef } from 'react';
import { Bell, BellRing, Check, X, Clock, FileText, MessageSquare, AlertCircle, Calendar } from 'lucide-react';
import { C, font } from '../constants';
import { supabase } from '../lib/supabase';
import { useWebPush } from '../lib/hooks/useWebPush';

const TYPE_ICONS = {
  task_reminder: Calendar,
  doc_uploaded: FileText,
  doc_approved: Check,
  doc_rejected: X,
  message_received: MessageSquare,
  case_assigned: AlertCircle,
  default: Bell,
};

const TYPE_COLORS = {
  task_reminder: C.primary,
  doc_uploaded: C.blue,
  doc_approved: C.green,
  doc_rejected: C.red,
  message_received: C.teal,
  case_assigned: C.violet,
  default: C.textMuted,
};

function timeAgo(date) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`;
  return new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function NotificationBell({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);
  const { supported, permission, isSubscribed, requestPermission } = useWebPush(user?.id, user?.org_id);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (!user?.id) return;
    loadNotifications();

    // Realtime subscription
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications_inbox',
        filter: `user_id=eq.${user.id}`,
      }, () => loadNotifications())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    }
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  async function loadNotifications() {
    setLoading(true);
    const { data } = await supabase
      .from('notifications_inbox')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setNotifications(data || []);
    setLoading(false);
  }

  async function markRead(notifId) {
    await supabase
      .from('notifications_inbox')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notifId);
    setNotifications(p => p.map(n => n.id === notifId ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    const ids = notifications.filter(n => !n.is_read).map(n => n.id);
    if (ids.length === 0) return;
    await supabase
      .from('notifications_inbox')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', ids);
    setNotifications(p => p.map(n => ({ ...n, is_read: true })));
  }

  async function handleClick(notif) {
    if (!notif.is_read) await markRead(notif.id);
    if (notif.link) window.location.href = notif.link;
    setIsOpen(false);
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{ position: 'relative', background: 'transparent', border: 'none', padding: 8, borderRadius: 8, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}
      >
        {unreadCount > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 8, minWidth: 14, lineHeight: 1, textAlign: 'center' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 360, maxWidth: '90vw', background: C.card, borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', border: `1px solid ${C.border}`, zIndex: 1500, overflow: 'hidden', fontFamily: font }}>
          {/* Header */}
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `linear-gradient(135deg, ${C.primary}08, ${C.violet}05)` }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Notificaciones {unreadCount > 0 && <span style={{ fontSize: 11, color: C.primary }}>({unreadCount} sin leer)</span>}</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ fontSize: 11, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Marcar todas leídas</button>
            )}
          </div>

          {/* CTA activar push si no */}
          {supported && permission !== 'granted' && (
            <div style={{ padding: '12px 18px', background: `${C.primary}08`, borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.text, lineHeight: 1.5 }}>
              <p style={{ marginBottom: 6 }}>🔔 <strong>Recibe avisos al instante</strong> aunque no tengas la app abierta.</p>
              <button onClick={requestPermission} style={{ padding: '6px 12px', borderRadius: 7, background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, color: '#fff', border: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>Activar notificaciones</button>
            </div>
          )}

          {/* Lista */}
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {loading && <p style={{ padding: 20, textAlign: 'center', fontSize: 12, color: C.textMuted }}>Cargando...</p>}
            {!loading && notifications.length === 0 && (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: C.textMuted }}>
                <Bell size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
                <p style={{ fontSize: 12 }}>No tienes notificaciones</p>
              </div>
            )}
            {notifications.map(n => {
              const Icon = TYPE_ICONS[n.type] || TYPE_ICONS.default;
              const color = TYPE_COLORS[n.type] || TYPE_COLORS.default;
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{ padding: '12px 18px', borderBottom: `1px solid ${C.bg}`, cursor: 'pointer', display: 'flex', gap: 11, alignItems: 'flex-start', background: n.is_read ? 'transparent' : `${color}06`, transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg}
                  onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : `${color}06`}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: n.is_read ? 500 : 700, color: C.text, lineHeight: 1.4 }}>{n.title}</p>
                    {n.body && <p style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.body}</p>}
                    <p style={{ fontSize: 10.5, color: C.textMuted, marginTop: 4 }}>{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 6 }} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
