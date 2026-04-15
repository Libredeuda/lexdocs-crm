import { useState } from "react";
import { Plus, Check, ChevronDown, UserX, UserCheck } from "lucide-react";
import { C } from "../../constants";

const MOCK_TEAM = [
  { id: '1', full_name: 'Carlos Martinez', email: 'carlos@libredeuda.com', role: 'owner', is_active: true },
  { id: '2', full_name: 'Ana Beltran', email: 'ana@libredeuda.com', role: 'lawyer', is_active: true },
  { id: '3', full_name: 'Laura Sanchez', email: 'laura@libredeuda.com', role: 'staff', is_active: true },
];

const ROLE_COLORS = {
  owner: { bg: `${C.violet}15`, color: C.violet, label: "Propietario" },
  admin: { bg: `${C.blue}15`, color: C.blue, label: "Admin" },
  lawyer: { bg: `${C.teal}15`, color: C.teal, label: "Abogado" },
  staff: { bg: `${C.textMuted}12`, color: C.textMuted, label: "Staff" },
};

export default function TeamMembers() {
  const [team, setTeam] = useState(MOCK_TEAM);
  const [toast, setToast] = useState(null);
  const [editingRole, setEditingRole] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const getInitials = (name) => {
    const parts = name.split(" ");
    return (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
  };

  const toggleActive = (id) => {
    setTeam((prev) =>
      prev.map((m) => (m.id === id ? { ...m, is_active: !m.is_active } : m))
    );
  };

  const changeRole = (id, newRole) => {
    setTeam((prev) =>
      prev.map((m) => (m.id === id ? { ...m, role: newRole } : m))
    );
    setEditingRole(null);
  };

  return (
    <div style={{ maxWidth: 800, animation: "fadeIn .35s ease" }}>
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, right: 28, background: C.sidebar,
          color: "#fff", padding: "12px 22px", borderRadius: 10, fontSize: 13,
          fontWeight: 500, zIndex: 9999, display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 8px 32px rgba(0,0,0,.18)", animation: "fadeIn .25s ease",
        }}>
          <Check size={15} /> {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 12, color: C.textMuted }}>{team.length} miembros en el equipo</p>
        </div>
        <button
          onClick={() => showToast("Proximamente")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 10,
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
            color: "#fff", fontSize: 12, fontWeight: 600,
            boxShadow: `0 4px 16px ${C.primary}30`,
          }}
        >
          <Plus size={15} /> Invitar miembro
        </button>
      </div>

      {/* Table */}
      <div style={{
        background: C.white, borderRadius: 14,
        border: `1px solid ${C.border}`, overflow: "hidden",
      }}>
        {/* Header row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 2fr 1fr 1fr 120px",
          padding: "12px 20px",
          background: "#f8f8fa",
          borderBottom: `1px solid ${C.border}`,
          fontSize: 11, fontWeight: 600, color: C.textMuted,
          textTransform: "uppercase", letterSpacing: ".04em",
        }}>
          <span>Nombre</span>
          <span>Email</span>
          <span>Rol</span>
          <span>Estado</span>
          <span style={{ textAlign: "right" }}>Acciones</span>
        </div>

        {team.map((member) => {
          const rc = ROLE_COLORS[member.role] || ROLE_COLORS.staff;
          return (
            <div
              key={member.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 2fr 1fr 1fr 120px",
                padding: "14px 20px",
                alignItems: "center",
                borderBottom: `1px solid ${C.border}`,
                transition: ".15s",
                opacity: member.is_active ? 1 : 0.5,
              }}
            >
              {/* Name + Avatar */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${C.primary}20, ${C.violet}15)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: C.primary,
                }}>
                  {getInitials(member.full_name)}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{member.full_name}</span>
              </div>

              {/* Email */}
              <span style={{ fontSize: 12, color: C.textMuted }}>{member.email}</span>

              {/* Role */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => member.role !== "owner" && setEditingRole(editingRole === member.id ? null : member.id)}
                  style={{
                    padding: "4px 10px", borderRadius: 6,
                    background: rc.bg, color: rc.color,
                    fontSize: 11, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 4,
                    cursor: member.role === "owner" ? "default" : "pointer",
                  }}
                >
                  {rc.label}
                  {member.role !== "owner" && <ChevronDown size={11} />}
                </button>
                {editingRole === member.id && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, marginTop: 4,
                    background: C.white, borderRadius: 10, border: `1px solid ${C.border}`,
                    boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 20,
                    minWidth: 130, overflow: "hidden",
                  }}>
                    {["admin", "lawyer", "staff"].map((r) => (
                      <button
                        key={r}
                        onClick={() => changeRole(member.id, r)}
                        style={{
                          width: "100%", padding: "9px 14px", textAlign: "left",
                          fontSize: 12, color: member.role === r ? C.primary : C.text,
                          fontWeight: member.role === r ? 600 : 400,
                          background: member.role === r ? `${C.primary}08` : "transparent",
                        }}
                      >
                        {ROLE_COLORS[r].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: member.is_active ? C.green : C.red,
                }} />
                <span style={{ fontSize: 11, color: member.is_active ? C.green : C.red, fontWeight: 500 }}>
                  {member.is_active ? "Activo" : "Inactivo"}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => member.role !== "owner" && toggleActive(member.id)}
                  disabled={member.role === "owner"}
                  style={{
                    padding: "6px 12px", borderRadius: 7,
                    background: member.is_active ? C.redSoft : C.greenSoft,
                    color: member.is_active ? C.red : C.green,
                    fontSize: 11, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 4,
                    opacity: member.role === "owner" ? 0.3 : 1,
                    cursor: member.role === "owner" ? "not-allowed" : "pointer",
                  }}
                >
                  {member.is_active ? <UserX size={12} /> : <UserCheck size={12} />}
                  {member.is_active ? "Desactivar" : "Activar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
