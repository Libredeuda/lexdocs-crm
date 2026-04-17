import { useState, useEffect } from "react";
import { X, Scale, Briefcase, Check, Mail, MessageSquare, AlertCircle } from "lucide-react";
import { C, font } from "../constants";
import { supabase } from "../lib/supabase";

export default function AssignCaseModal({ caseData, onClose, onSaved }) {
  const [lawyers, setLawyers] = useState([]);
  const [procuradores, setProcuradores] = useState([]);
  const [selectedLawyer, setSelectedLawyer] = useState(caseData?.assigned_lawyer_id || "");
  const [selectedProcurador, setSelectedProcurador] = useState(caseData?.assigned_procurador_id || "");
  const [notifyLawyer, setNotifyLawyer] = useState(true);
  const [notifyProcurador, setNotifyProcurador] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: law } = await supabase
        .from("users")
        .select("id, full_name, professional_title, colegio, colegiado_num, email, phone")
        .in("role", ["lawyer", "admin", "owner"])
        .eq("is_active", true);
      setLawyers(law || []);

      const { data: proc } = await supabase
        .from("users")
        .select("id, full_name, professional_title, colegio, colegiado_num, email, phone")
        .eq("role", "procurador")
        .eq("is_active", true);
      setProcuradores(proc || []);
    }
    load();
  }, []);

  async function handleSave() {
    if (!caseData?.id) return;
    setSaving(true);
    try {
      const prevLawyer = caseData.assigned_lawyer_id;
      const prevProcurador = caseData.assigned_procurador_id;

      const { error } = await supabase
        .from("cases")
        .update({
          assigned_lawyer_id: selectedLawyer || null,
          assigned_procurador_id: selectedProcurador || null,
        })
        .eq("id", caseData.id);
      if (error) throw error;

      // Disparar notificaciones solo a los nuevos asignados
      const newRecipients = [];
      if (selectedLawyer && selectedLawyer !== prevLawyer && notifyLawyer) {
        newRecipients.push(selectedLawyer);
      }
      if (selectedProcurador && selectedProcurador !== prevProcurador && notifyProcurador) {
        newRecipients.push(selectedProcurador);
      }

      if (newRecipients.length > 0) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const { data: { user: authUser } } = await supabase.auth.getUser();
        let assignerName = "";
        if (authUser) {
          const { data: me } = await supabase.from("users").select("full_name").eq("id", authUser.id).single();
          assignerName = me?.full_name || "";
        }
        fetch(`${supabaseUrl}/functions/v1/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
          body: JSON.stringify({
            type: "assignment",
            recipientUserIds: newRecipients,
            caseId: caseData.id,
            assignerName,
          }),
        }).catch(() => {});
      }

      setToast(newRecipients.length > 0 ? `Asignación guardada. ${newRecipients.length} notificación(es) enviadas.` : "Asignación guardada.");
      setTimeout(() => {
        setToast(null);
        if (onSaved) onSaved();
        onClose();
      }, 1200);
    } catch (e) {
      console.error(e);
      setToast("Error al guardar: " + e.message);
      setTimeout(() => setToast(null), 3500);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: `1.5px solid ${C.border}`, fontSize: 13,
    fontFamily: font, background: C.card, color: C.text,
    outline: "none", cursor: "pointer",
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: C.textMuted,
    textTransform: "uppercase", letterSpacing: ".04em",
    marginBottom: 6, display: "block",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: font }}>
      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.sidebar, color: "#fff", padding: "12px 24px", borderRadius: 12, fontSize: 13, fontWeight: 500, zIndex: 10001, boxShadow: "0 8px 30px rgba(0,0,0,.2)" }}>{toast}</div>}

      <div style={{ background: C.card, borderRadius: 18, width: "100%", maxWidth: 540, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: `1px solid ${C.border}` }}>

        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: `linear-gradient(135deg, ${C.primary}08, ${C.violet}05)` }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Asignar equipo al expediente</h2>
            <p style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>Exp. {caseData?.case_number || caseData?.client?.caseId} · {caseData?.client?.name}</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: C.bg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} color={C.textMuted} />
          </button>
        </div>

        <div style={{ padding: "22px 24px" }}>

          {/* Abogado */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
              <Scale size={12} color={C.primary} /> Abogado designado
            </label>
            <select value={selectedLawyer} onChange={e => setSelectedLawyer(e.target.value)} style={inputStyle}>
              <option value="">— Sin asignar —</option>
              {lawyers.map(l => (
                <option key={l.id} value={l.id}>
                  {l.full_name}{l.colegio ? ` · ${l.colegio} nº ${l.colegiado_num || "—"}` : ""}
                </option>
              ))}
            </select>
            {selectedLawyer && selectedLawyer !== caseData?.assigned_lawyer_id && (
              <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 11.5, color: C.text, cursor: "pointer" }}>
                <input type="checkbox" checked={notifyLawyer} onChange={e => setNotifyLawyer(e.target.checked)} style={{ cursor: "pointer" }} />
                <Mail size={12} color={C.primary} /> Notificar por email
                <MessageSquare size={12} color={C.teal} /> + WhatsApp
              </label>
            )}
          </div>

          {/* Procurador */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
              <Briefcase size={12} color={C.orange} /> Procurador designado
            </label>
            <select value={selectedProcurador} onChange={e => setSelectedProcurador(e.target.value)} style={inputStyle}>
              <option value="">— Sin asignar —</option>
              {procuradores.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name}{p.colegio ? ` · ${p.colegio} nº ${p.colegiado_num || "—"}` : ""}
                </option>
              ))}
            </select>
            {selectedProcurador && selectedProcurador !== caseData?.assigned_procurador_id && (
              <label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 11.5, color: C.text, cursor: "pointer" }}>
                <input type="checkbox" checked={notifyProcurador} onChange={e => setNotifyProcurador(e.target.checked)} style={{ cursor: "pointer" }} />
                <Mail size={12} color={C.primary} /> Notificar por email
                <MessageSquare size={12} color={C.teal} /> + WhatsApp
              </label>
            )}
          </div>

          {/* Info */}
          <div style={{ padding: "10px 14px", background: `${C.primary}08`, borderRadius: 10, marginBottom: 20, fontSize: 11.5, color: C.text, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertCircle size={14} color={C.primary} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Los datos de contacto del abogado/procurador son <strong>internos</strong>. El cliente no ve su email ni teléfono — solo podrá comunicarse a través de la plataforma.</span>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={onClose} style={{ padding: "10px 22px", borderRadius: 10, fontSize: 13, fontWeight: 500, fontFamily: font, cursor: "pointer", background: C.card, color: C.text, border: `1px solid ${C.border}` }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: "10px 22px", borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: font, cursor: saving ? "default" : "pointer", border: "none", background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, color: "#fff", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
              <Check size={14} /> {saving ? "Guardando..." : "Guardar asignación"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
