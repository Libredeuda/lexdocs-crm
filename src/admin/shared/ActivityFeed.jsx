import { C } from "../../constants";

const ACTION_COLORS = {
  created: C.green,
  updated: C.blue,
  status_changed: C.orange,
  uploaded: C.teal,
  approved: C.green,
  rejected: C.red,
  payment_received: C.green,
  note_added: C.textMuted,
  assigned: C.violet,
};

const ACTION_LABELS = {
  created: "Creado",
  updated: "Actualizado",
  status_changed: "Estado cambiado",
  uploaded: "Subido",
  approved: "Aprobado",
  rejected: "Rechazado",
  payment_received: "Pago recibido",
  note_added: "Nota",
  assigned: "Asignado",
};

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Ahora";
  if (diffMins < 60) return `Hace ${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default function ActivityFeed({ activities = [] }) {
  if (!activities.length) {
    return (
      <div style={{
        padding: "32px 20px", textAlign: "center",
        color: C.textMuted, fontSize: 13,
      }}>
        No hay actividad reciente
      </div>
    );
  }

  return (
    <div style={{ position: "relative", paddingLeft: 24 }}>
      {/* Vertical line */}
      <div style={{
        position: "absolute", left: 7, top: 8, bottom: 8,
        width: 2, background: C.border, borderRadius: 2,
      }} />

      {activities.map((activity, i) => {
        const color = ACTION_COLORS[activity.action] || C.textMuted;
        const actionLabel = ACTION_LABELS[activity.action] || activity.action;
        return (
          <div
            key={activity.id}
            style={{
              position: "relative",
              paddingBottom: i === activities.length - 1 ? 0 : 20,
              animation: `fadeIn .3s ease ${i * 0.05}s both`,
            }}
          >
            {/* Dot */}
            <div style={{
              position: "absolute", left: -20, top: 4,
              width: 12, height: 12, borderRadius: "50%",
              background: C.white,
              border: `2.5px solid ${color}`,
              zIndex: 1,
            }} />

            {/* Content */}
            <div style={{
              padding: "8px 14px",
              borderRadius: 10,
              background: `${color}06`,
              border: `1px solid ${color}12`,
              transition: ".15s",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 4,
              }}>
                <span style={{
                  padding: "2px 8px", borderRadius: 4,
                  background: `${color}15`, color: color,
                  fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: ".03em",
                }}>
                  {actionLabel}
                </span>
                <span style={{ fontSize: 10, color: C.textLight }}>
                  {formatRelativeTime(activity.created_at)}
                </span>
              </div>

              <p style={{ fontSize: 12.5, color: C.text, lineHeight: 1.4, marginBottom: 3 }}>
                {activity.description}
              </p>

              {activity.performed_by && (
                <p style={{ fontSize: 11, color: C.textMuted }}>
                  por {activity.performed_by}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
