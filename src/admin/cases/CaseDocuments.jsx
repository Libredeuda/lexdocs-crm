import { useState, useEffect } from "react";
import {
  X, Check, XCircle, FileText, Eye, Loader, Sparkles,
  ShieldCheck, ShieldAlert, AlertCircle, Clock, CheckCircle, Download, RefreshCw, MinusCircle
} from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";

const STATUS_CONFIG = {
  pending: { label: "Pendiente cliente", color: C.textMuted, bg: C.bg, icon: Clock },
  uploaded: { label: "Pendiente revisar", color: C.orange, bg: C.orangeSoft, icon: AlertCircle },
  review: { label: "Pendiente revisar", color: C.orange, bg: C.orangeSoft, icon: AlertCircle },
  approved: { label: "Aprobado", color: C.green, bg: C.greenSoft, icon: CheckCircle },
  rejected: { label: "Rechazado", color: C.red, bg: C.redSoft, icon: XCircle },
  not_applicable: { label: "No aplica a este caso", color: C.textMuted, bg: C.bg, icon: MinusCircle },
};

const AI_VERDICT_CONFIG = {
  valid: { label: "Verificado por IA", color: C.green, bg: C.greenSoft, icon: ShieldCheck },
  incomplete: { label: "Incompleto (IA)", color: C.orange, bg: C.orangeSoft, icon: ShieldAlert },
  wrong_document: { label: "Doc incorrecto (IA)", color: C.red, bg: C.redSoft, icon: XCircle },
  expired: { label: "Caducado (IA)", color: C.orange, bg: C.orangeSoft, icon: Clock },
  unreadable: { label: "Ilegible (IA)", color: C.red, bg: C.redSoft, icon: AlertCircle },
  needs_review: { label: "Revisión manual", color: C.blue, bg: C.blueSoft, icon: Eye },
};

export default function CaseDocuments({ caseId, caseNumber, clientName, onClose }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending_review");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [rejectModal, setRejectModal] = useState(null); // doc
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (authUser) {
        setCurrentUserId(authUser.id);
        const { data } = await supabase.from("users").select("full_name").eq("id", authUser.id).single();
        setCurrentUserName(data?.full_name || "");
      }
    });
  }, []);

  useEffect(() => {
    if (!caseId) return;
    loadDocs();
  }, [caseId]);

  async function loadDocs() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*, doc_type:document_types(name, category, cat_num, required), reviewer:users!documents_reviewed_by_fkey(full_name)")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setDocs(data || []);
    } catch (e) {
      console.error("Error cargando docs:", e);
      showToast("Error cargando documentos");
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function openPreview(doc) {
    setPreviewDoc(doc);
    setPreviewUrl(null);
    if (doc.storage_path) {
      try {
        const { data } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 300);
        setPreviewUrl(data?.signedUrl || null);
      } catch (e) {
        console.error("Signed URL error", e);
      }
    }
  }

  async function markNotApplicable(doc) {
    const reason = window.prompt(`Marcar "${doc.name || doc.doc_type?.name}" como NO APLICA a este caso.\n\n¿Por qué no es necesario? (opcional)`, "");
    if (reason === null) return; // cancelado
    setProcessing(doc.id);
    try {
      const { error } = await supabase
        .from("documents")
        .update({
          status: "not_applicable",
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString(),
          not_applicable_reason: (reason || "").trim() || null,
        })
        .eq("id", doc.id);
      if (error) throw error;
      showToast(`"${doc.name || doc.doc_type?.name}" marcado como No aplica`);
      loadDocs();
    } catch (e) {
      console.error(e);
      showToast("Error al marcar no aplica");
    } finally {
      setProcessing(null);
    }
  }

  async function reactivateDoc(doc) {
    setProcessing(doc.id);
    try {
      const { error } = await supabase
        .from("documents")
        .update({
          status: "pending",
          reviewed_by: null,
          reviewed_at: null,
          not_applicable_reason: null,
        })
        .eq("id", doc.id);
      if (error) throw error;
      showToast(`"${doc.name || doc.doc_type?.name}" reactivado`);
      loadDocs();
    } catch (e) {
      console.error(e);
      showToast("Error al reactivar");
    } finally {
      setProcessing(null);
    }
  }

  async function approveDoc(doc) {
    setProcessing(doc.id);
    try {
      const { error } = await supabase
        .from("documents")
        .update({
          status: "approved",
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", doc.id);
      if (error) throw error;
      showToast(`"${doc.name || doc.doc_type?.name}" aprobado ✓`);
      loadDocs();
    } catch (e) {
      console.error(e);
      showToast("Error al aprobar");
    } finally {
      setProcessing(null);
    }
  }

  async function rejectDoc() {
    if (!rejectModal) return;
    if (!rejectReason.trim()) {
      showToast("Indica un motivo para el rechazo");
      return;
    }
    setProcessing(rejectModal.id);
    try {
      const { error } = await supabase
        .from("documents")
        .update({
          status: "rejected",
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString(),
          review_note: rejectReason.trim(),
        })
        .eq("id", rejectModal.id);
      if (error) throw error;

      // Disparar notificación (email/WhatsApp) al cliente
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
          body: JSON.stringify({
            type: "document_rejected",
            caseId,
            documentName: rejectModal.name || rejectModal.doc_type?.name,
            reason: rejectReason.trim(),
          }),
        });
      } catch (e) { /* silent fail */ }

      showToast(`"${rejectModal.name || rejectModal.doc_type?.name}" rechazado`);
      setRejectModal(null);
      setRejectReason("");
      loadDocs();
    } catch (e) {
      console.error(e);
      showToast("Error al rechazar");
    } finally {
      setProcessing(null);
    }
  }

  const stats = {
    total: docs.length,
    pending_review: docs.filter(d => d.status === "uploaded" || d.status === "review").length,
    approved: docs.filter(d => d.status === "approved").length,
    rejected: docs.filter(d => d.status === "rejected").length,
  };

  const filtered = docs.filter(d => {
    if (filter === "all") return true;
    if (filter === "pending_review") return d.status === "uploaded" || d.status === "review";
    if (filter === "approved") return d.status === "approved";
    if (filter === "rejected") return d.status === "rejected";
    return true;
  });

  const grouped = filtered.reduce((acc, d) => {
    const cat = d.doc_type?.category || "Sin categoría";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(d);
    return acc;
  }, {});

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: font }}>
      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.sidebar, color: "#fff", padding: "12px 24px", borderRadius: 12, fontSize: 13, fontWeight: 500, zIndex: 10001, boxShadow: "0 8px 30px rgba(0,0,0,.2)" }}>{toast}</div>}

      <div style={{ background: C.card, borderRadius: 18, width: "100%", maxWidth: 960, maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        {/* Header */}
        <div style={{ padding: "20px 26px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: `linear-gradient(135deg, ${C.primary}08, ${C.violet}05)` }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}><FileText size={18} color={C.primary} /> Revisión documental</h2>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>Exp. {caseNumber} · {clientName}</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: C.bg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} color={C.textMuted} />
          </button>
        </div>

        {/* Stats + Filters */}
        <div style={{ padding: "14px 26px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { k: "pending_review", l: `Pendientes de revisar (${stats.pending_review})`, color: C.orange },
              { k: "approved", l: `Aprobados (${stats.approved})`, color: C.green },
              { k: "rejected", l: `Rechazados (${stats.rejected})`, color: C.red },
              { k: "all", l: `Todos (${stats.total})`, color: C.text },
            ].map(f => (
              <button key={f.k} onClick={() => setFilter(f.k)} style={{
                padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font,
                background: filter === f.k ? `linear-gradient(135deg, ${C.primary}, ${C.violet})` : C.bg,
                color: filter === f.k ? "#fff" : C.text,
                border: filter === f.k ? "none" : `1px solid ${C.border}`,
              }}>{f.l}</button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 26px" }}>
          {loading && <div style={{ textAlign: "center", padding: 40 }}><Loader size={22} color={C.primary} style={{ animation: "spin 1s linear infinite" }} /><p style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>Cargando documentos...</p></div>}

          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: C.textMuted }}>
              <FileText size={32} style={{ opacity: 0.35, marginBottom: 10 }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                {filter === "pending_review" ? "No hay documentos pendientes de revisar" : "Sin documentos en esta categoría"}
              </p>
              <p style={{ fontSize: 11.5, marginTop: 5 }}>Cuando el cliente suba documentos, aparecerán aquí para que los apruebes.</p>
            </div>
          )}

          {!loading && Object.entries(grouped).map(([cat, catDocs]) => (
            <div key={cat} style={{ marginBottom: 22 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>{cat} ({catDocs.length})</h3>
              {catDocs.map(doc => {
                const sConf = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
                const StatusIcon = sConf.icon;
                const aiVerdict = doc.ai_verification?.verdict;
                const aiConf = aiVerdict ? AI_VERDICT_CONFIG[aiVerdict] : null;
                const AiIcon = aiConf?.icon;
                const canReview = doc.status === "uploaded" || doc.status === "review";
                const docName = doc.name || doc.doc_type?.name || "Documento";

                return (
                  <div key={doc.id} style={{ padding: "14px 16px", background: C.bg, borderRadius: 10, marginBottom: 8, border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <StatusIcon size={20} color={sConf.color} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 600 }}>{docName}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 5, background: sConf.bg, color: sConf.color, fontSize: 10.5, fontWeight: 600 }}>{sConf.label}</span>
                          {aiConf && AiIcon && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 5, background: aiConf.bg, color: aiConf.color, fontSize: 10.5, fontWeight: 600 }}>
                              <AiIcon size={11} /> {aiConf.label} {doc.ai_verification?.confidence ? `· ${doc.ai_verification.confidence}%` : ""}
                            </span>
                          )}
                          {doc.doc_type?.required && <span style={{ fontSize: 9.5, color: C.red, background: C.redSoft, padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Obligatorio</span>}
                        </div>
                        {doc.ai_verification?.message && (
                          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 6, fontStyle: "italic", lineHeight: 1.5 }}>"{doc.ai_verification.message}"</p>
                        )}
                        {doc.status === "approved" && (
                          <p style={{ fontSize: 11, color: C.green, marginTop: 6 }}>
                            ✓ Aprobado {doc.reviewer?.full_name ? `por ${doc.reviewer.full_name}` : ""} {doc.reviewed_at ? `· ${new Date(doc.reviewed_at).toLocaleDateString("es-ES")}` : ""}
                          </p>
                        )}
                        {doc.status === "rejected" && (
                          <div style={{ marginTop: 8, padding: "8px 10px", background: C.redSoft, borderRadius: 6, borderLeft: `3px solid ${C.red}` }}>
                            <p style={{ fontSize: 10.5, fontWeight: 700, color: C.red, marginBottom: 3 }}>MOTIVO DEL RECHAZO:</p>
                            <p style={{ fontSize: 11.5, color: C.text, lineHeight: 1.5 }}>{doc.review_note || "Sin motivo especificado"}</p>
                            <p style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>Cliente notificado · {doc.reviewed_at ? new Date(doc.reviewed_at).toLocaleDateString("es-ES") : ""}</p>
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "flex-start", flexWrap: "wrap" }}>
                        <button onClick={() => openPreview(doc)} style={btnSecondary}>
                          <Eye size={12} /> Ver
                        </button>
                        {canReview && (
                          <>
                            <button onClick={() => approveDoc(doc)} disabled={processing === doc.id} style={{ ...btnGreen, opacity: processing === doc.id ? 0.6 : 1 }}>
                              <Check size={12} /> Aprobar
                            </button>
                            <button onClick={() => { setRejectModal(doc); setRejectReason(""); }} disabled={processing === doc.id} style={btnRed}>
                              <XCircle size={12} /> Rechazar
                            </button>
                          </>
                        )}
                        {doc.status === "pending" && (
                          <button onClick={() => markNotApplicable(doc)} disabled={processing === doc.id} style={btnMuted} title="Marcar que este documento no es necesario para este caso">
                            <MinusCircle size={12} /> No aplica
                          </button>
                        )}
                        {doc.status === "rejected" && (
                          <button onClick={() => approveDoc(doc)} disabled={processing === doc.id} style={btnGreen}>
                            <RefreshCw size={12} /> Aprobar igualmente
                          </button>
                        )}
                        {doc.status === "not_applicable" && (
                          <button onClick={() => reactivateDoc(doc)} disabled={processing === doc.id} style={btnSecondary} title="Volver a hacer este documento necesario">
                            <RefreshCw size={12} /> Reactivar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Preview modal */}
      {previewDoc && (
        <div onClick={() => setPreviewDoc(null)} style={{ position: "fixed", inset: 0, zIndex: 10002, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 30 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 14, maxWidth: 900, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 13.5, fontWeight: 600 }}>{previewDoc.name || previewDoc.doc_type?.name}</p>
              <button onClick={() => setPreviewDoc(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color={C.textMuted} /></button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
              {!previewDoc.storage_path && (
                <div style={{ textAlign: "center", color: C.textMuted }}>
                  <FileText size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Documento de prueba</p>
                  <p style={{ fontSize: 11.5, marginTop: 6, maxWidth: 340, lineHeight: 1.5 }}>Este documento no tiene archivo adjunto (datos seed). En producción, aquí se mostraría el archivo real subido por el cliente.</p>
                </div>
              )}
              {previewDoc.storage_path && !previewUrl && <Loader size={24} color={C.primary} style={{ animation: "spin 1s linear infinite" }} />}
              {previewUrl && previewDoc.mime_type?.startsWith("image/") && <img src={previewUrl} alt="preview" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }} />}
              {previewUrl && previewDoc.mime_type === "application/pdf" && <iframe src={previewUrl} style={{ width: "100%", height: "70vh", border: "none", borderRadius: 8 }} title="PDF preview" />}
              {previewUrl && !previewDoc.mime_type?.startsWith("image/") && previewDoc.mime_type !== "application/pdf" && (
                <a href={previewUrl} download style={{ padding: "10px 20px", borderRadius: 8, background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Download size={14} /> Descargar archivo
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject reason modal */}
      {rejectModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10003, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.card, borderRadius: 14, width: "100%", maxWidth: 480, padding: "22px 24px" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Rechazar "{rejectModal.name || rejectModal.doc_type?.name}"</h3>
            <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 16, lineHeight: 1.5 }}>Explica al cliente qué falla con el documento. Recibirá este mensaje por email y en la app para que pueda corregirlo rápidamente.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Ej: La imagen está borrosa y no se lee el número de DNI. Por favor, sube una foto con más luz."
              rows={4}
              autoFocus
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 13, fontFamily: font, resize: "vertical", outline: "none", marginBottom: 14 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => { setRejectModal(null); setRejectReason(""); }} style={{ padding: "9px 18px", borderRadius: 9, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: font }}>Cancelar</button>
              <button onClick={rejectDoc} disabled={processing === rejectModal.id || !rejectReason.trim()} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: C.red, color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: font, opacity: !rejectReason.trim() ? 0.5 : 1, display: "flex", alignItems: "center", gap: 5 }}>
                <XCircle size={13} /> Rechazar y notificar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const btnBase = {
  padding: "7px 12px", borderRadius: 8, border: "none", fontSize: 11.5, fontWeight: 600,
  cursor: "pointer", fontFamily: font, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
};
const btnSecondary = { ...btnBase, background: C.card, color: C.text, border: `1px solid ${C.border}` };
const btnGreen = { ...btnBase, background: C.green, color: "#fff" };
const btnRed = { ...btnBase, background: C.redSoft, color: C.red, border: `1px solid ${C.red}40` };
const btnMuted = { ...btnBase, background: C.bg, color: C.textMuted, border: `1px solid ${C.border}`, borderStyle: "dashed" };
