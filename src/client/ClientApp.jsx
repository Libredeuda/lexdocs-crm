import { useState, useEffect, useRef } from "react";
import { Upload, Camera, FileText, CheckCircle, Clock, AlertCircle, Calendar, MessageSquare, Home, LogOut, ChevronRight, X, Bell, User, Send, Paperclip, ScanLine, Eye, BarChart3, Phone, FolderOpen, Shield, Scale, Briefcase, Menu, ChevronDown, Building2, FileWarning, ChevronUp, Check, RotateCw, Sparkles, ShieldCheck, ShieldAlert, Loader, RefreshCw, CreditCard, Wallet, Receipt, Copy, Download, ArrowRightCircle, Banknote, TrendingUp, MinusCircle, XCircle } from "lucide-react";
import { LOGO, font, C, KB, DOCS_LSO, DOCS_CONCURSO, EVENTS_LSO, EVENTS_CONC, PAYMENTS, methodInfo } from "../constants";
import { statusMap, getS, evSt, getEv, fmtD, fmtMoney, daysUntil, payStatusMap, getPayStatus, motivMsg } from "../utils";
import Carlota from "../components/Carlota";
import CaseRoadmap from "../components/CaseRoadmap";
import MilestoneModal from "../components/MilestoneModal";
import Messages from "./Messages";
import { supabase } from "../lib/supabase";

// Verificación documental con Claude Vision via Supabase Edge Function
async function verifyDocWithAI(file, docId, clientName) {
  const sig = KB[docId];
  const docName = sig?.name || "Documento legal";

  // Word/Excel/CSV: skip vision verification
  if (file.type.includes("word") || file.type.includes("sheet") || file.type.includes("excel") || file.name.match(/\.(xlsx?|docx?|csv)$/i)) {
    return { verdict: "needs_review", confidence: 60, documentType: "Archivo editable", message: `${clientName}, he recibido tu archivo "${docName}". Como es un formato editable (Word/Excel), lo revisará tu letrado manualmente.` };
  }

  // Try Edge Function for real Claude Vision verification (only for images)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey && file.type.startsWith("image/")) {
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`${supabaseUrl}/functions/v1/verify-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type,
          docId,
          docName,
          issuer: sig?.issuer || '',
          validity: sig?.validity || '',
          criteria: sig?.criteria || '',
          clientName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success !== false) return data;
      }
    } catch (e) { console.warn('Edge verify failed, falling back:', e.message); }
  }

  // Fallback: simple validation without AI
  await new Promise(r => setTimeout(r, 1200));
  if (!sig) {
    return { verdict: "needs_review", message: `${clientName}, he recibido tu documento. Tu letrado lo revisará manualmente.` };
  }
  const apiUrl = import.meta.env.VITE_VERIFY_API_URL;
  if (apiUrl) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("docId", docId);
      formData.append("clientName", clientName);
      const res = await fetch(apiUrl + "/verify-document", { method: "POST", body: formData });
      if (res.ok) return await res.json();
    } catch (e) { console.warn("Backend verify failed, falling back to demo mode"); }
  }
  const fileSizeKB = file.size / 1024;
  const isImage = file.type.startsWith("image/");
  if (fileSizeKB < 10) {
    return { verdict: "unreadable", confidence: 95, documentType: "Archivo corrupto", message: `${clientName}, este archivo parece estar vacío o corrupto (menos de 10KB). Inténtalo de nuevo con el archivo original.`, warnings: ["Archivo demasiado pequeño"] };
  }
  if (isImage && fileSizeKB < 30) {
    return { verdict: "unreadable", confidence: 80, documentType: "Imagen de baja calidad", message: `${clientName}, la imagen está borrosa o tiene poca resolución. Hazle una foto con mejor luz o usa el escáner integrado.`, warnings: ["Resolución insuficiente para verificar el contenido"] };
  }
  // Fallback when no AI verification is available: send to manual review
  return { verdict: "needs_review", confidence: 70, documentType: sig.name, issuer: sig.issuer, message: `${clientName}, he recibido tu ${sig.name}. Tu letrado lo revisará y te avisará si todo está correcto.`, warnings: [] };
}

// Mini-guías genéricas por categoría (fallback cuando KB no tiene el documento)
const CATEGORY_GUIDES = {
  "Datos Personales": "Estos documentos los obtienes en sede electrónica del organismo o en su oficina física.",
  "Situación Laboral": "Pídelos a tu empresa (RRHH) o accede a sede.agenciatributaria.gob.es con Cl@ve.",
  "Situación Bancaria": "Descárgalos desde la banca online de tu entidad bancaria. Pestaña 'Documentos' o 'Certificados'.",
  "Deudas y Acreedores": "Solicítalos en sede electrónica de cada organismo (AEAT, TGSS, etc.) con Cl@ve o certificado digital.",
  "Inventario Bienes": "Escrituras: notaría/registro. Recibos IBI: ayuntamiento o banca online. Vehículos: tráfico.",
  "Gastos e Ingresos": "Hoja de cálculo o documento simple con tus ingresos y gastos mensuales.",
  "Contratos Vigentes": "Contratos firmados con tu empresa, banco u otras entidades. Solicítalos si no los tienes.",
  "Identificación y Constitución": "Documentos societarios: notaría, registro mercantil, asesoría contable.",
  "Doc. Contable y Fiscal": "Tu asesoría contable o tu portal de la AEAT con Cl@ve.",
  "Memoria Económica y Jurídica": "Documento que prepara el letrado con tu información. Se redacta en el despacho.",
  "Inventario Bienes (Masa Activa)": "Escrituras, registro de la propiedad, banca online de la empresa.",
  "Lista Acreedores (Masa Pasiva)": "Sede electrónica de cada acreedor (bancos, AEAT, TGSS, proveedores).",
  "Doc. Laboral": "Departamento de RRHH, asesoría laboral o sede.seg-social.gob.es.",
  "Contratos y Rel. Jurídicas": "Contratos archivados en la empresa o solicítalos a las contrapartes.",
  "Transmisiones Patrimoniales": "Notaría donde se firmaron las operaciones, registro mercantil.",
};

export default function ClientApp({ user, onLogout }) {
  const [page, setPage] = useState("dashboard");
  const [docs, setDocs] = useState([]);
  const [events, setEvents] = useState([]);
  const [showScan, setShowScan] = useState(false);
  const [scanId, setScanId] = useState(null);
  const [mobMenu, setMobMenu] = useState(false);
  const [chatMsgs, setChatMsgs] = useState([]);
  const [toast, setToast] = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [caseInfo, setCaseInfo] = useState(null);
  const [milestoneToShow, setMilestoneToShow] = useState(null);

  const caseType = user.caseType || 'lso';
  const caseId = user.caseId || 'N/A';
  const lawyerName = user.lawyer || 'Sin asignar';
  const fullName = user.full_name || user.name || '';

  useEffect(() => {
    async function loadData() {
      if (user.org_id) {
        try {
          const { data: cases } = await supabase
            .from('cases')
            .select('*')
            .eq('org_id', user.org_id)
            .limit(1);

          const currentCase = cases?.[0];
          if (currentCase) setCaseInfo(currentCase);

          if (currentCase) {
            const { data: docTypes } = await supabase
              .from('document_types')
              .select('*')
              .eq('org_id', user.org_id)
              .eq('case_type', currentCase.case_type)
              .order('cat_num', { ascending: true });

            if (docTypes?.length > 0) {
              setDocs(docTypes.map(d => ({
                id: d.id,
                name: d.name,
                cat: d.category,
                catNum: d.cat_num,
                status: 'pending',
                required: d.required,
              })));
            } else {
              setDocs((currentCase.case_type === "concurso" ? DOCS_CONCURSO : DOCS_LSO).map(d => ({ ...d })));
            }

            const { data: eventsData } = await supabase
              .from('events')
              .select('*')
              .eq('case_id', currentCase.id)
              .order('event_date', { ascending: true });

            if (eventsData?.length > 0) {
              setEvents(eventsData.map(e => ({
                id: e.id,
                title: e.title,
                date: e.event_date,
                time: e.event_time,
                type: e.event_type,
                desc: e.description,
              })));
            } else {
              setEvents(currentCase.case_type === "concurso" ? EVENTS_CONC : EVENTS_LSO);
            }
          } else {
            setDocs(DOCS_LSO.map(d => ({ ...d })));
            setEvents(EVENTS_LSO);
          }
        } catch (e) {
          console.error('Error loading client data:', e);
          setDocs((caseType === "concurso" ? DOCS_CONCURSO : DOCS_LSO).map(d => ({ ...d })));
          setEvents(caseType === "concurso" ? EVENTS_CONC : EVENTS_LSO);
        }
      } else {
        setDocs((caseType === "concurso" ? DOCS_CONCURSO : DOCS_LSO).map(d => ({ ...d })));
        setEvents(caseType === "concurso" ? EVENTS_CONC : EVENTS_LSO);
      }

      const n = fullName.split(" ")[0];
      setChatMsgs([{ role: "assistant", content: `¡Hola ${n}! 👋 Soy tu asistente documental de LibreApp.\n\nPuedo ayudarte con:\n• Qué documentos necesitas y dónde conseguirlos\n• Estado de tu expediente ${caseId}\n• Plazos y fechas\n\n¿En qué puedo ayudarte?` }]);
    }

    loadData();
  }, [user]);

  const up = docs.filter(d => d.status === "uploaded" || d.status === "review").length;
  const pct = docs.length ? Math.round(up / docs.length * 100) : 0;

  // Detecta hitos de progreso (25/50/75/100) y muestra modal una sola vez por hito
  useEffect(() => {
    if (!caseInfo?.id) return;
    if (milestoneToShow) return;
    const shown = caseInfo.milestone_shown || {};
    const thresholds = [25, 50, 75, 100];
    for (const m of thresholds) {
      if (pct >= m && !shown[m]) {
        setMilestoneToShow(m);
        break;
      }
    }
  }, [pct, caseInfo, milestoneToShow]);

  const cats = [...new Set(docs.map(d => d.cat))];
  const pendingReq = docs.filter(d => d.status === "pending" && d.required).length;
  const firstName = fullName.split(" ")[0] || "";

  async function handleFileSelected(docId, file) {
    setVerifying({ docId, fileName: file.name, file });
    setVerifyResult(null);
    const result = await verifyDocWithAI(file, docId, firstName);
    setVerifyResult(result);
  }

  function confirmUpload(docId, fileName, status) {
    const doc = docs.find(d => d.id === docId);
    setDocs(p => p.map(d => d.id === docId ? { ...d, status, uploadedAt: new Date().toISOString().split("T")[0], note: status === "uploaded" ? "✓ Verificado por IA" : "Pendiente revisión letrada" } : d));
    setVerifying(null);
    setVerifyResult(null);
    setToast(`✅ ${firstName}, "${doc?.name || fileName}" añadido a tu expediente`);
    setTimeout(() => setToast(null), 4000);
  }

  function rejectUpload() {
    setVerifying(null);
    setVerifyResult(null);
  }

  async function markNotApplicable(docId) {
    const doc = docs.find(d => d.id === docId);
    if (!doc) return;
    const ok = window.confirm(`¿Marcar "${doc.name}" como NO APLICA a tu caso?\n\nEsto le indica al despacho que este documento no es necesario para tu situación. Tu abogado podrá revisarlo después.`);
    if (!ok) return;
    const reason = window.prompt(`(Opcional) ¿Por qué no es necesario? Por ejemplo: "No tengo libro de familia porque soy soltero".`, "");
    // Update local immediately
    setDocs(p => p.map(d => d.id === docId ? { ...d, status: "not_applicable", note: reason || "Marcado como no aplica" } : d));
    setToast(`"${doc.name}" marcado como No aplica`);
    setTimeout(() => setToast(null), 3500);
    // Persist a Supabase si es usuario real
    if (user.org_id) {
      try {
        await supabase.from("documents").upsert({
          org_id: user.org_id,
          doc_type_id: docId,
          name: doc.name,
          status: "not_applicable",
          not_applicable_reason: reason?.trim() || null,
        }, { onConflict: "doc_type_id" });
      } catch (e) { console.warn("No persisted not_applicable:", e.message); }
    }
  }

  async function reactivateDoc(docId) {
    const doc = docs.find(d => d.id === docId);
    if (!doc) return;
    setDocs(p => p.map(d => d.id === docId ? { ...d, status: "pending", note: undefined } : d));
    setToast(`"${doc.name}" reactivado como pendiente`);
    setTimeout(() => setToast(null), 3000);
    if (user.org_id) {
      try {
        await supabase.from("documents").update({ status: "pending", not_applicable_reason: null }).eq("doc_type_id", docId).eq("org_id", user.org_id);
      } catch (e) { console.warn("No persisted reactivate:", e.message); }
    }
  }

  const navItems = [{ id: "dashboard", label: "Inicio", icon: Home }, { id: "documents", label: "Documentos", icon: FolderOpen, badge: pendingReq }, { id: "timeline", label: "Mi expediente", icon: BarChart3 }, { id: "calendar", label: "Agenda", icon: Calendar }, { id: "messages", label: "Mi abogado", icon: Scale }, { id: "payments", label: "Pagos", icon: Wallet }, { id: "chat", label: "Asistente IA", icon: MessageSquare }];
  const caseLabel = caseType === "concurso" ? "Concurso de Acreedores" : "Ley de Segunda Oportunidad";

  return (
    <div style={{ fontFamily: font, background: C.bg, minHeight: "100vh", display: "flex", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes slideIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes scaleIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes shimmer{0%{background-position:-200px 0}100%{background-position:calc(200px + 100%) 0}}.fade-in{animation:fadeIn .35s ease both}.scale-in{animation:scaleIn .3s ease both}.hover-lift{transition:transform .2s,box-shadow .2s}.hover-lift:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(91,107,240,.12)}input:focus,textarea:focus{outline:none;border-color:${C.primary}!important;box-shadow:0 0 0 3px rgba(91,107,240,.15)}button{cursor:pointer;border:none;font-family:${font}}@media(max-width:768px){.dsk{display:none!important}.mh{display:flex!important}.mc{margin-left:0!important;padding:14px!important;padding-top:68px!important}}@media(min-width:769px){.mh{display:none!important}.mo{display:none!important}}`}</style>

      {!user.org_id && <div style={{ position: "fixed", top: 0, right: 0, zIndex: 9999, padding: "4px 12px", background: `linear-gradient(135deg,#5B6BF0,#7C5BF0)`, color: "#fff", fontSize: 10, fontWeight: 600, borderRadius: "0 0 0 8px", letterSpacing: ".05em" }}>MODO DEMO · IA simulada</div>}
      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.sidebar, color: "#fff", padding: "12px 24px", borderRadius: 12, fontSize: 13, fontWeight: 500, zIndex: 999, animation: "slideUp .3s ease", boxShadow: "0 8px 30px rgba(0,0,0,.2)", maxWidth: "90%", textAlign: "center" }}>{toast}</div>}

      {verifying && <VerificationModal verifying={verifying} result={verifyResult} firstName={firstName} onConfirm={confirmUpload} onReject={rejectUpload} expectedDoc={docs.find(d => d.id === verifying.docId)} />}

      {milestoneToShow && (
        <MilestoneModal
          milestone={milestoneToShow}
          firstName={firstName}
          caseId={caseInfo?.id}
          onClose={() => {
            // actualiza el caseInfo local para evitar re-disparo
            setCaseInfo(prev => prev ? { ...prev, milestone_shown: { ...(prev.milestone_shown || {}), [milestoneToShow]: true } } : prev);
            setMilestoneToShow(null);
          }}
        />
      )}

      <aside className="dsk" style={{ width: 260, background: C.sidebar, position: "fixed", top: 0, left: 0, bottom: 0, display: "flex", flexDirection: "column", zIndex: 50 }}>
        <div style={{ padding: "22px 20px 16px", borderBottom: `1px solid ${C.sidebarMid}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <img src={LOGO} alt="LibreApp" style={{ width: 34, height: 34, borderRadius: 8 }} />
            <div><span style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>LibreApp</span><p style={{ fontSize: 9.5, color: C.textLight }}>Suite Legal</p></div>
          </div>
          <div style={{ padding: "8px 10px", background: C.sidebarLight, borderRadius: 8, borderLeft: `3px solid ${C.primary}` }}>
            <p style={{ fontSize: 10.5, color: C.primaryLight, fontWeight: 600 }}>Exp. {caseId}</p>
            <p style={{ fontSize: 9.5, color: C.textLight, marginTop: 1 }}>{caseLabel}</p>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "14px 10px" }}>
          {navItems.map(it => { const a = page === it.id; return (
            <button key={it.id} onClick={() => setPage(it.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderRadius: 10, marginBottom: 3, background: a ? `linear-gradient(135deg,${C.primary}20,${C.violet}15)` : "transparent", color: a ? "#fff" : "rgba(255,255,255,.5)", fontSize: 13, fontWeight: a ? 600 : 400, transition: ".2s", textAlign: "left", position: "relative" }}>
              {a && <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 18, borderRadius: 2, background: `linear-gradient(to bottom,${C.primary},${C.violet})` }} />}
              <it.icon size={17} /><span style={{ flex: 1 }}>{it.label}</span>
              {it.badge > 0 && <span style={{ background: `linear-gradient(135deg,${C.primary},${C.violet})`, color: "#fff", fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 8 }}>{it.badge}</span>}
            </button>); })}
        </nav>
        <div style={{ padding: "14px 14px 18px", borderTop: `1px solid ${C.sidebarMid}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.sidebarLight, display: "flex", alignItems: "center", justifyContent: "center" }}>{caseType === "concurso" ? <Building2 size={15} color={C.primaryLight} /> : <User size={15} color={C.primaryLight} />}</div>
            <div><p style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{fullName.length > 20 ? fullName.substring(0, 20) + "…" : fullName}</p><p style={{ fontSize: 9.5, color: C.textLight }}>Letrado: {lawyerName}</p></div>
          </div>
          <button onClick={onLogout} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 7, borderRadius: 7, background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.4)", fontSize: 11 }}><LogOut size={12} /> Cerrar sesión</button>
        </div>
      </aside>

      <header className="mh" style={{ position: "fixed", top: 0, left: 0, right: 0, height: 56, background: C.sidebar, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", zIndex: 100 }}>
        <button onClick={() => setMobMenu(true)} style={{ background: "none", color: "#fff" }}><Menu size={22} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}><img src={LOGO} alt="" style={{ width: 24, height: 24, borderRadius: 5 }} /><span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>LibreApp</span></div>
        <div style={{ width: 22 }} />
      </header>
      {mobMenu && <div className="mo" style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}><div onClick={() => setMobMenu(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)" }} /><div style={{ position: "relative", width: 260, background: C.sidebar, height: "100%", display: "flex", flexDirection: "column", animation: "slideIn .25s ease" }}><div style={{ padding: 18, borderBottom: `1px solid ${C.sidebarMid}`, display: "flex", alignItems: "center", gap: 8 }}><img src={LOGO} alt="" style={{ width: 22, height: 22, borderRadius: 4 }} /><span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>LibreApp</span></div><nav style={{ flex: 1, padding: 9 }}>{navItems.map(i => <button key={i.id} onClick={() => { setPage(i.id); setMobMenu(false); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, marginBottom: 2, background: page === i.id ? C.sidebarLight : "transparent", color: page === i.id ? "#fff" : "rgba(255,255,255,.5)", fontSize: 13.5, textAlign: "left" }}><i.icon size={16} />{i.label}</button>)}</nav><div style={{ padding: 12, borderTop: `1px solid ${C.sidebarMid}` }}><button onClick={() => { onLogout(); setMobMenu(false); }} style={{ width: "100%", padding: 8, borderRadius: 6, background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.4)", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><LogOut size={12} />Cerrar sesión</button></div></div></div>}

      <main className="mc" style={{ marginLeft: 260, flex: 1, padding: "24px 30px", minHeight: "100vh" }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em" }}>{page === "dashboard" && `Hola, ${firstName}`}{page === "documents" && "Gestión documental"}{page === "timeline" && "Mi expediente"}{page === "calendar" && "Agenda"}{page === "messages" && "Mi abogado"}{page === "payments" && "Mis pagos"}{page === "chat" && "Asistente documental"}</h1>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{caseLabel} · Exp. {caseId}</p>
        </div>

        {page === "dashboard" && <div style={{ background: `linear-gradient(135deg,${C.primary},${C.violet})`, borderRadius: 14, padding: "20px 24px", marginBottom: 20, color: "#fff", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
          <div style={{ position: "absolute", bottom: -20, right: 40, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,.05)" }} />
          <p style={{ fontSize: 15, fontWeight: 500, position: "relative", lineHeight: 1.6 }}>{motivMsg(firstName, pct, pendingReq)}</p>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
            <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,.2)", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, borderRadius: 4, background: "rgba(255,255,255,.9)", transition: "width .8s" }} /></div>
            <span style={{ fontSize: 22, fontWeight: 700 }}>{pct}%</span>
          </div>
        </div>}

        <div className="fade-in" key={page}>
          {page === "dashboard" && <Dashboard docs={docs} pct={pct} setPage={setPage} events={events} cats={cats} user={user} pendingReq={pendingReq} firstName={firstName} onFileSelected={handleFileSelected} onScan={id=>{setScanId(id);setShowScan(true);}} caseInfo={caseInfo} caseType={caseType} />}
          {page === "documents" && <Documents docs={docs} cats={cats} onFileSelected={handleFileSelected} onScan={id => { setScanId(id); setShowScan(true); }} pct={pct} firstName={firstName} onMarkNotApplicable={markNotApplicable} onReactivate={reactivateDoc} />}
          {page === "timeline" && <Timeline docs={docs} cats={cats} pct={pct} user={user} caseLabel={caseLabel} />}
          {page === "calendar" && <Cal events={events} />}
          {page === "payments" && <Payments user={user} firstName={firstName} />}
          {page === "messages" && <Messages user={user} firstName={firstName} />}
          {page === "chat" && <Chat messages={chatMsgs} setMessages={setChatMsgs} docs={docs} user={user} caseLabel={caseLabel} />}
        </div>
      </main>
      {showScan && <Scanner docId={scanId} docs={docs} onCapture={(id, file) => { handleFileSelected(id, file); setShowScan(false); }} onClose={() => setShowScan(false)} />}
      <Carlota user={user} currentModule="lexdocs" currentContext={{ caseId: caseId }} />
    </div>
  );
}

// ════ VERIFICATION MODAL ════
function VerificationModal({verifying, result, firstName, onConfirm, onReject, expectedDoc}){
  const verdict = result?.verdict;
  const isLoading = !result;

  const verdictConfig = {
    valid: { color: C.green, bg: C.greenSoft, icon: ShieldCheck, title: "✓ Documento verificado", subtitle: "Todo correcto" },
    incomplete: { color: C.orange, bg: C.orangeSoft, icon: ShieldAlert, title: "Documento incompleto", subtitle: "Le falta algo" },
    wrong_document: { color: C.red, bg: C.redSoft, icon: X, title: "Documento incorrecto", subtitle: "No es el documento solicitado" },
    expired: { color: C.orange, bg: C.orangeSoft, icon: Clock, title: "Documento caducado", subtitle: "Necesitas uno actualizado" },
    unreadable: { color: C.red, bg: C.redSoft, icon: AlertCircle, title: "No se puede leer", subtitle: "Imagen borrosa o ilegible" },
    needs_review: { color: C.blue, bg: C.blueSoft, icon: Eye, title: "Pendiente de revisión", subtitle: "Tu letrado lo revisará" },
  };

  const config = verdictConfig[verdict] || verdictConfig.needs_review;
  const Icon = config.icon;

  return(<div style={{position:"fixed",inset:0,zIndex:600,background:"rgba(30,30,46,.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:font,backdropFilter:"blur(4px)"}}>
    <div className="scale-in" style={{background:C.white,borderRadius:18,maxWidth:480,width:"100%",overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>

      {/* Header */}
      <div style={{padding:"22px 26px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:38,height:38,borderRadius:10,background:`linear-gradient(135deg,${C.primary},${C.violet})`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Sparkles size={18} color="#fff"/>
        </div>
        <div style={{flex:1}}>
          <h3 style={{fontSize:15,fontWeight:600}}>Verificación con IA</h3>
          <p style={{fontSize:11,color:C.textMuted,marginTop:2}}>{verifying.fileName}</p>
        </div>
        {!isLoading && verdict !== "valid" && <button onClick={onReject} style={{background:"none",color:C.textMuted,padding:4}}><X size={18}/></button>}
      </div>

      {/* Body */}
      <div style={{padding:"28px 26px"}}>
        {isLoading ? (
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{width:60,height:60,margin:"0 auto 18px",borderRadius:"50%",background:`linear-gradient(135deg,${C.primary}15,${C.violet}15)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Loader size={28} color={C.primary} style={{animation:"spin 1s linear infinite"}}/>
            </div>
            <p style={{fontSize:15,fontWeight:600,marginBottom:6}}>Analizando documento...</p>
            <p style={{fontSize:12,color:C.textMuted,lineHeight:1.6,maxWidth:300,margin:"0 auto"}}>
              La IA está comprobando que el archivo corresponde con <strong>{expectedDoc?.name}</strong> y cumple los requisitos.
            </p>
            <div style={{marginTop:20,padding:"10px 14px",background:C.bg,borderRadius:8,fontSize:11,color:C.textMuted,maxWidth:340,margin:"20px auto 0"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><Check size={11} color={C.green}/> Comprobando formato</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}><Loader size={11} color={C.primary} style={{animation:"spin 1s linear infinite"}}/> Verificando contenido</div>
              <div style={{display:"flex",alignItems:"center",gap:6,opacity:.4}}><Clock size={11}/> Validando vigencia</div>
            </div>
          </div>
        ) : (
          <div>
            {/* Verdict header */}
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18,padding:"14px 16px",background:config.bg,borderRadius:12}}>
              <div style={{width:42,height:42,borderRadius:10,background:config.color,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Icon size={20} color="#fff"/>
              </div>
              <div>
                <p style={{fontSize:14,fontWeight:600,color:config.color}}>{config.title}</p>
                <p style={{fontSize:11,color:C.textMuted,marginTop:1}}>{config.subtitle}</p>
              </div>
            </div>

            {/* Message for client */}
            <div style={{padding:"14px 16px",background:C.bg,borderRadius:10,marginBottom:14}}>
              <p style={{fontSize:13,lineHeight:1.6,color:C.text}}>{result.message}</p>
            </div>

            {/* Detected info */}
            {(result.documentType || result.issuer || result.issueDate) && (
              <div style={{padding:"12px 14px",background:"rgba(91,107,240,.04)",borderRadius:10,marginBottom:14,fontSize:12}}>
                <p style={{fontSize:11,fontWeight:600,color:C.textMuted,textTransform:"uppercase",letterSpacing:".05em",marginBottom:6}}>Detectado por IA</p>
                {result.documentType && <p style={{marginBottom:3}}><strong>Tipo:</strong> {result.documentType}</p>}
                {result.issuer && <p style={{marginBottom:3}}><strong>Emisor:</strong> {result.issuer}</p>}
                {result.issueDate && <p><strong>Fecha:</strong> {result.issueDate}</p>}
                {result.confidence && <div style={{marginTop:8,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,color:C.textMuted}}>Confianza IA:</span>
                  <div style={{flex:1,height:5,background:C.border,borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${result.confidence}%`,background:result.confidence>=80?C.green:result.confidence>=60?C.orange:C.red,borderRadius:3}}/>
                  </div>
                  <span style={{fontSize:11,fontWeight:600,color:C.text}}>{result.confidence}%</span>
                </div>}
              </div>
            )}

            {/* Warnings */}
            {result.warnings && result.warnings.length > 0 && (
              <div style={{padding:"10px 14px",background:C.orangeSoft,borderRadius:10,marginBottom:14}}>
                <p style={{fontSize:11,fontWeight:600,color:C.orange,textTransform:"uppercase",marginBottom:5}}>⚠ Advertencias</p>
                {result.warnings.map((w,i)=><p key={i} style={{fontSize:11.5,color:C.text,lineHeight:1.5,marginBottom:3}}>• {w}</p>)}
              </div>
            )}

            {/* Where to get (if wrong/expired) */}
            {(verdict==="expired"||verdict==="wrong_document"||verdict==="incomplete")&&KB[verifying.docId]&&(
              <div style={{padding:"10px 14px",background:C.tealSoft,borderRadius:10,marginBottom:14,fontSize:11.5,lineHeight:1.5}}>
                <p style={{fontWeight:600,color:C.teal,marginBottom:3}}>💡 Dónde conseguirlo:</p>
                <p style={{color:C.text}}>{KB[verifying.docId].whereToGet}</p>
              </div>
            )}

            {/* Actions */}
            <div style={{display:"flex",gap:8,marginTop:18}}>
              {verdict==="valid" || verdict==="needs_review" ? (
                <>
                  <button onClick={()=>onConfirm(verifying.docId, verifying.fileName, verdict==="valid"?"uploaded":"review")} style={{flex:1,padding:"12px",borderRadius:10,fontSize:13,fontWeight:600,background:`linear-gradient(135deg,${C.primary},${C.violet})`,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    <Check size={15}/>{verdict==="valid"?"Confirmar y guardar":"Enviar al letrado"}
                  </button>
                  {verdict !== "valid" && <button onClick={onReject} style={{padding:"12px 16px",borderRadius:10,fontSize:13,fontWeight:500,background:C.bg,color:C.textMuted}}>Cancelar</button>}
                </>
              ) : (
                <>
                  <button onClick={onReject} style={{flex:1,padding:"12px",borderRadius:10,fontSize:13,fontWeight:600,background:`linear-gradient(135deg,${C.primary},${C.violet})`,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    <RefreshCw size={14}/>Subir otro archivo
                  </button>
                  <button onClick={()=>onConfirm(verifying.docId, verifying.fileName, "review")} style={{padding:"12px 16px",borderRadius:10,fontSize:13,fontWeight:500,background:C.bg,color:C.textMuted}}>Subir igual</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>);
}

// ════ DASHBOARD ════
function Dashboard({docs,pct,setPage,events,cats,user,pendingReq,firstName,onFileSelected,onScan,caseInfo,caseType}){
  const nextEv=events.filter(e=>new Date(e.date)>=new Date()).slice(0,3);
  const urgentDocs = docs.filter(d => d.status === "pending" && d.required).slice(0, 4);
  const fRef = useRef(null);
  const [activeUpload, setActiveUpload] = useState(null);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (f && activeUpload) {
      onFileSelected(activeUpload, f);
      setActiveUpload(null);
      e.target.value = "";
    }
  }

  function triggerUpload(docId, mode) {
    setActiveUpload(docId);
    if (mode === "camera") fRef.current?.setAttribute("capture", "environment");
    else fRef.current?.removeAttribute("capture");
    setTimeout(() => fRef.current?.click(), 50);
  }

  return(<div>
    <input ref={fRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{display:"none"}} onChange={handleFileChange}/>

    {/* CTA Carlota */}
    <div onClick={() => window.dispatchEvent(new CustomEvent('open-carlota'))} className="hover-lift" style={{cursor:"pointer", background:`linear-gradient(135deg, rgba(91,107,240,0.08), rgba(124,91,240,0.05))`, borderRadius:14, padding:"16px 20px", marginBottom:18, border:`1px solid ${C.primary}30`, display:"flex", alignItems:"center", gap:14}}>
      <div style={{width:46, height:46, borderRadius:12, background:`linear-gradient(135deg, ${C.primary}, ${C.violet})`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:`0 4px 12px rgba(91,107,240,0.3)`}}>
        <Sparkles size={22} color="#fff"/>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <p style={{fontSize:13.5, fontWeight:600, marginBottom:2}}>¿Tienes dudas? Pregunta a Carlota</p>
        <p style={{fontSize:11.5, color:C.textMuted, lineHeight:1.4}}>Tu asistente legal con IA, disponible 24/7. Te explica cualquier documento, plazo o duda legal.</p>
      </div>
      <button style={{padding:"9px 14px", borderRadius:9, background:`linear-gradient(135deg, ${C.primary}, ${C.violet})`, color:"#fff", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap", flexShrink:0}}>
        <MessageSquare size={13}/> Hablar
      </button>
    </div>

    {/* DOCUMENTOS URGENTES */}
    {urgentDocs.length > 0 && (
      <div style={{background:C.card, borderRadius:14, padding:"18px 20px", marginBottom:18, border:`2px solid ${C.primary}30`, boxShadow:`0 4px 20px rgba(91,107,240,0.08)`}}>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8}}>
          <div>
            <h3 style={{fontSize:15, fontWeight:700, display:"flex", alignItems:"center", gap:7}}>
              <Upload size={16} color={C.primary}/> Sube tus documentos
            </h3>
            <p style={{fontSize:11.5, color:C.textMuted, marginTop:3}}>Tienes {pendingReq} documentos pendientes. Cuanto antes los subas, antes avanzaremos.</p>
          </div>
          <button onClick={()=>setPage("documents")} style={{fontSize:12, color:C.primary, background:"none", fontWeight:600, display:"flex", alignItems:"center", gap:3}}>Ver todos<ChevronRight size={12}/></button>
        </div>
        {urgentDocs.map(doc => {
          const guide = KB[doc.id]?.whereToGet || CATEGORY_GUIDES[doc.cat] || "Tu letrado te indicará dónde conseguirlo.";
          return (
            <div key={doc.id} style={{padding:"12px 0", borderBottom:`1px solid ${C.bg}`}}>
              <div style={{display:"flex", alignItems:"flex-start", gap:10, marginBottom:8, flexWrap:"wrap"}}>
                <div style={{flex:1, minWidth:200}}>
                  <p style={{fontSize:13, fontWeight:600}}>{doc.name}</p>
                  <p style={{fontSize:10.5, color:C.textMuted, marginTop:3, lineHeight:1.4, display:"flex", alignItems:"flex-start", gap:5}}>
                    <span style={{fontSize:11}}>💡</span><span>{guide}</span>
                  </p>
                </div>
                <div style={{display:"flex", gap:5, flexShrink:0}}>
                  <button onClick={()=>triggerUpload(doc.id, "file")} title="Adjuntar archivo" style={{padding:"8px 11px", borderRadius:8, background:`linear-gradient(135deg, ${C.primary}, ${C.violet})`, color:"#fff", fontSize:11, fontWeight:600, display:"flex", alignItems:"center", gap:4}}>
                    <Paperclip size={12}/> Subir
                  </button>
                  <button onClick={()=>triggerUpload(doc.id, "camera")} title="Hacer foto" style={{padding:"8px 10px", borderRadius:8, background:C.tealSoft, color:C.teal, fontSize:11, fontWeight:600, border:`1px solid ${C.teal}30`}}>
                    <Camera size={12}/>
                  </button>
                  <button onClick={()=>onScan(doc.id)} title="Escanear" style={{padding:"8px 10px", borderRadius:8, background:`rgba(124,91,240,0.08)`, color:C.violet, fontSize:11, fontWeight:600, border:`1px solid ${C.violet}30`}}>
                    <ScanLine size={12}/>
                  </button>
                </div>
              </div>
              <button onClick={(e)=>{e.stopPropagation(); window.dispatchEvent(new CustomEvent('open-carlota', {detail:{message:`Necesito ayuda para conseguir el documento: ${doc.name}`}}))}} style={{fontSize:10.5, color:C.primary, background:"none", padding:0, display:"inline-flex", alignItems:"center", gap:4, fontWeight:500}}>
                <Sparkles size={10}/> ¿Dudas con este documento? Pregúntale a Carlota
              </button>
            </div>
          );
        })}
      </div>
    )}

    {/* Roadmap del expediente */}
    <CaseRoadmap
      currentPhase={caseInfo?.phase || 'document_collection'}
      progress={pct}
      caseType={caseType}
    />

    {/* Mensaje motivacional compacto */}
    <div style={{background:`linear-gradient(135deg,${C.primary}15,${C.violet}08)`, borderRadius:12, padding:"12px 16px", marginBottom:18, display:"flex", alignItems:"center", gap:12, border:`1px solid ${C.primary}15`}}>
      <div style={{flex:1}}>
        <p style={{fontSize:12.5, color:C.text, lineHeight:1.5}}>{motivMsg(firstName, pct, pendingReq)}</p>
      </div>
      <div style={{textAlign:"center", flexShrink:0}}>
        <div style={{fontSize:22, fontWeight:700, color:C.primary, lineHeight:1}}>{pct}%</div>
        <div style={{fontSize:9, color:C.textMuted, textTransform:"uppercase", letterSpacing:".05em", marginTop:2}}>completado</div>
      </div>
    </div>

    {/* Progreso por categoría */}
    <div style={{background:C.card,borderRadius:14,padding:"16px 20px",marginBottom:18,border:`1px solid ${C.border}`}}>
      <h3 style={{fontSize:13,fontWeight:600,marginBottom:12}}>Progreso por categoría</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}}>
        {cats.map(cat=>{const cd=docs.filter(d=>d.cat===cat);const cu=cd.filter(d=>d.status==="uploaded"||d.status==="review").length;const cp=Math.round(cu/cd.length*100);const cn=cd[0]?.catNum;return(
          <div key={cat} style={{padding:"8px 10px",borderRadius:8,background:C.bg,display:"flex",alignItems:"center",gap:9}}>
            <div style={{width:24,height:24,borderRadius:7,background:cp===100?C.greenSoft:`rgba(91,107,240,.08)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:10,fontWeight:700,color:cp===100?C.green:C.primary}}>{cn}</span></div>
            <div style={{flex:1,minWidth:0}}><p style={{fontSize:11,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat}</p>
              <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}><div style={{flex:1,height:3,background:C.border,borderRadius:2}}><div style={{height:"100%",width:`${cp}%`,borderRadius:2,background:cp===100?C.green:`linear-gradient(90deg,${C.primary},${C.violet})`}}/></div><span style={{fontSize:9.5,color:C.textMuted,fontWeight:600}}>{cu}/{cd.length}</span></div>
            </div>
          </div>);})}
      </div>
    </div>

    {/* Agenda + Pagos */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14}}>
      <div style={{background:C.card,borderRadius:14,padding:"16px 18px",border:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><h3 style={{fontSize:13,fontWeight:600}}>Próximos eventos</h3><button onClick={()=>setPage("calendar")} style={{fontSize:11.5,color:C.primary,background:"none",fontWeight:500,display:"flex",alignItems:"center",gap:2}}>Ver todo<ChevronRight size={11}/></button></div>
        {nextEv.length===0 && <p style={{fontSize:11,color:C.textMuted,padding:"8px 0"}}>No hay eventos próximos</p>}
        {nextEv.map(ev=>{const s=getEv(ev.type);return(<div key={ev.id} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:`1px solid ${C.bg}`}}>
          <div style={{width:36,height:36,borderRadius:8,background:s.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:13,fontWeight:700,color:s.c,lineHeight:1}}>{new Date(ev.date).getDate()}</span><span style={{fontSize:7.5,color:s.c,textTransform:"uppercase",fontWeight:600}}>{new Date(ev.date).toLocaleDateString("es-ES",{month:"short"})}</span></div>
          <div><p style={{fontSize:11.5,fontWeight:500}}>{ev.title}</p><p style={{fontSize:10,color:C.textMuted}}>{ev.time&&`${ev.time} · `}{s.l}</p></div>
        </div>);})}
      </div>
      {(()=>{const pd=PAYMENTS[user.caseType||'lso'];if(!pd)return null;const paid=pd.payments.filter(p=>p.status==="paid");const totalPaid=paid.reduce((a,p)=>a+p.amount,0);const upc=pd.payments.find(p=>p.status==="upcoming");const days=upc?daysUntil(upc.date):null;const payPct=Math.round(totalPaid/pd.totalContracted*100);return(
        <div onClick={()=>setPage("payments")} className="hover-lift" style={{cursor:"pointer",background:C.card,borderRadius:14,padding:"16px 18px",border:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{width:34,height:34,borderRadius:9,background:`linear-gradient(135deg,${C.primary}15,${C.violet}10)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Wallet size={16} color={C.primary}/></div>
            <div style={{flex:1}}><p style={{fontSize:13,fontWeight:600}}>Tus pagos</p><p style={{fontSize:10.5,color:C.textMuted}}>{paid.length}/{pd.payments.length} cuotas</p></div>
            <span style={{fontSize:13,fontWeight:700,color:C.primary}}>{payPct}%</span>
          </div>
          <div style={{height:5,background:C.bg,borderRadius:3,overflow:"hidden",marginBottom:7}}><div style={{height:"100%",width:`${payPct}%`,background:`linear-gradient(90deg,${C.primary},${C.violet})`,borderRadius:3}}/></div>
          <p style={{fontSize:10.5,color:C.textMuted}}>{fmtMoney(totalPaid)} de {fmtMoney(pd.totalContracted)}</p>
          {upc&&<div style={{marginTop:7,padding:"6px 9px",borderRadius:6,background:days<=3?C.orangeSoft:C.tealSoft,fontSize:10.5,fontWeight:600,color:days<=3?C.orange:C.teal,textAlign:"center"}}>{days===0?"Cargo hoy":days===1?"Cargo mañana":`Próximo cargo en ${days} días`}</div>}
        </div>
      );})()}
    </div>
  </div>);
}

// ════ DOCUMENTS ════
function Documents({docs,cats,onFileSelected,onScan,pct,firstName,onMarkNotApplicable,onReactivate}){
  const[filter,setFilter]=useState("all");
  const[expCats,setExpCats]=useState(new Set(cats));
  const fRef=useRef(null);
  const [activeUpload, setActiveUpload] = useState(null);

  const filtered=filter==="all"?docs:filter==="pending"?docs.filter(d=>d.status==="pending"||d.status==="partial"):docs.filter(d=>d.status==="uploaded"||d.status==="review");
  const up=docs.filter(d=>d.status==="uploaded"||d.status==="review").length;

  function hf(e){const f=e.target.files?.[0];if(f&&activeUpload){onFileSelected(activeUpload,f);setActiveUpload(null);e.target.value="";}}
  function tCat(c){setExpCats(p=>{const n=new Set(p);n.has(c)?n.delete(c):n.add(c);return n;});}
  function triggerUpload(docId, mode) {
    setActiveUpload(docId);
    if (mode === "camera") fRef.current?.setAttribute("capture", "environment");
    else fRef.current?.removeAttribute("capture");
    setTimeout(() => fRef.current?.click(), 50);
  }

  const groups=cats.map(c=>({cat:c,catNum:docs.find(d=>d.cat===c)?.catNum,docs:filtered.filter(d=>d.cat===c)})).filter(g=>g.docs.length>0);

  return(<div>
    <input ref={fRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{display:"none"}} onChange={hf}/>

    {/* Banner IA */}
    <div style={{background:`linear-gradient(135deg,rgba(91,107,240,.06),rgba(124,91,240,.04))`,borderRadius:12,padding:"12px 16px",marginBottom:10,border:`1px solid ${C.primary}20`,display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${C.primary},${C.violet})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Sparkles size={14} color="#fff"/></div>
      <div style={{flex:1, minWidth:0}}><p style={{fontSize:12,fontWeight:600}}>Verificación con IA activada</p><p style={{fontSize:10.5,color:C.textMuted}}>Cada documento se verifica automáticamente al subirlo</p></div>
    </div>

    {/* Carlota CTA */}
    <div onClick={() => window.dispatchEvent(new CustomEvent('open-carlota'))} className="hover-lift" style={{cursor:"pointer", background:C.sidebar, borderRadius:12, padding:"12px 16px", marginBottom:14, display:"flex", alignItems:"center", gap:12, border:"none"}}>
      <div style={{width:32, height:32, borderRadius:9, background:`linear-gradient(135deg, ${C.primary}, ${C.violet})`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>
        <Sparkles size={15} color="#fff"/>
      </div>
      <div style={{flex:1, minWidth:0}}>
        <p style={{fontSize:12.5, fontWeight:600, color:"#fff"}}>Carlota está aquí para ayudarte</p>
        <p style={{fontSize:10.5, color:"rgba(255,255,255,0.6)", marginTop:1}}>Dónde conseguir cualquier documento, plazos, dudas legales...</p>
      </div>
      <button style={{padding:"7px 11px", borderRadius:7, background:"rgba(255,255,255,0.15)", color:"#fff", fontSize:11, fontWeight:600, display:"flex", alignItems:"center", gap:4, whiteSpace:"nowrap", flexShrink:0}}>
        Hablar <ChevronRight size={11}/>
      </button>
    </div>

    {/* Progress */}
    <div style={{background:C.card,borderRadius:12,padding:"12px 16px",marginBottom:12,border:`1px solid ${C.border}`}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:12,fontWeight:600}}>Progreso global</span><span style={{fontSize:12,fontWeight:700,color:C.primary}}>{pct}%</span></div>
      <div style={{height:6,background:C.bg,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,borderRadius:3,background:`linear-gradient(90deg,${C.primary},${C.violet})`}}/></div>
    </div>

    {/* Filtros */}
    <div style={{display:"flex",gap:5,marginBottom:14,flexWrap:"wrap"}}>
      {[{k:"all",l:`Todos (${docs.length})`},{k:"pending",l:`Pendientes (${docs.filter(d=>d.status==="pending").length})`},{k:"done",l:`Entregados (${up})`}].map(f=><button key={f.k} onClick={()=>setFilter(f.k)} style={{padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:500,background:filter===f.k?`linear-gradient(135deg,${C.primary},${C.violet})`:C.card,color:filter===f.k?"#fff":C.text,border:`1px solid ${filter===f.k?"transparent":C.border}`}}>{f.l}</button>)}
    </div>

    {/* Categorías */}
    {groups.map(g=>{const o=expCats.has(g.cat);const cu=g.docs.filter(d=>d.status==="uploaded"||d.status==="review").length;const total=docs.filter(d=>d.cat===g.cat).length;const cp=Math.round(cu/total*100);return(
      <div key={g.cat} style={{marginBottom:10}}>
        <button onClick={()=>tCat(g.cat)} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"12px 14px",background:C.card,borderRadius:o?"12px 12px 0 0":12,border:`1px solid ${C.border}`,borderBottom:o?"none":`1px solid ${C.border}`,textAlign:"left"}}>
          <div style={{width:28,height:28,borderRadius:8,background:cp===100?C.greenSoft:`rgba(91,107,240,.08)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:11,fontWeight:700,color:cp===100?C.green:C.primary}}>{g.catNum}</span></div>
          <div style={{flex:1}}><p style={{fontSize:13,fontWeight:600}}>{g.cat}</p><p style={{fontSize:10,color:C.textMuted,marginTop:1}}>{cu}/{total}</p></div>
          <span style={{fontSize:11,fontWeight:600,color:cp===100?C.green:C.primary}}>{cp}%</span>
          {o?<ChevronUp size={15} color={C.textMuted}/>:<ChevronDown size={15} color={C.textMuted}/>}
        </button>
        {o&&<div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 12px 12px",overflow:"hidden"}}>
          {g.docs.map(doc=>{const inf=getS(doc.status);const Ic=inf.i;const hasKB = !!KB[doc.id];const isPending = doc.status==="pending"||doc.status==="partial";const guide = KB[doc.id]?.whereToGet || CATEGORY_GUIDES[doc.cat] || "Tu letrado te indicará dónde conseguirlo.";return(
            <div key={doc.id} style={{borderBottom:`1px solid ${C.bg}`,padding:"12px 16px",background:C.card}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                <Ic size={16} color={inf.c} style={{flexShrink:0,marginTop:2}}/>
                <div style={{flex:1,minWidth:200}}>
                  <p style={{fontSize:12.5,fontWeight:500}}>{doc.name}</p>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginTop:3,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,color:inf.c,fontWeight:600}}>{inf.l}</span>
                    {hasKB && <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:9.5,color:C.primary,background:`rgba(91,107,240,.08)`,padding:"1px 6px",borderRadius:3,fontWeight:500}}><Sparkles size={9}/> IA verifica</span>}
                    {!doc.required&&<span style={{fontSize:9,color:C.textMuted,background:C.bg,padding:"1px 5px",borderRadius:3}}>Opcional</span>}
                    {doc.uploadedAt&&<span style={{fontSize:10,color:C.textMuted}}>· {fmtD(doc.uploadedAt)}</span>}
                  </div>
                  {doc.warn&&<p style={{fontSize:10.5,color:C.orange,marginTop:4,display:"flex",alignItems:"flex-start",gap:3}}><FileWarning size={11} style={{flexShrink:0,marginTop:1}}/>{doc.warn}</p>}
                  {doc.note&&<p style={{fontSize:10.5,color:doc.note.includes("Verificado")?C.green:C.blue,marginTop:4,fontStyle:"italic"}}>{doc.note}</p>}
                </div>
                {isPending && (
                  <div style={{display:"flex",gap:5,flexShrink:0,flexWrap:"wrap"}}>
                    <button onClick={()=>triggerUpload(doc.id, "file")} title="Adjuntar archivo" style={{padding:"7px 11px",borderRadius:7,background:`linear-gradient(135deg,${C.primary},${C.violet})`,color:"#fff",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
                      <Paperclip size={11}/>Subir
                    </button>
                    <button onClick={()=>triggerUpload(doc.id, "camera")} title="Hacer foto" style={{padding:"7px 9px",borderRadius:7,background:C.tealSoft,color:C.teal,fontSize:11,fontWeight:600,border:`1px solid ${C.teal}30`}}>
                      <Camera size={11}/>
                    </button>
                    <button onClick={()=>onScan(doc.id)} title="Escanear" style={{padding:"7px 9px",borderRadius:7,background:`rgba(124,91,240,0.08)`,color:C.violet,fontSize:11,fontWeight:600,border:`1px solid ${C.violet}30`}}>
                      <ScanLine size={11}/>
                    </button>
                    {!doc.required && onMarkNotApplicable && (
                      <button onClick={()=>onMarkNotApplicable(doc.id)} title="Marcar como no aplica a mi caso" style={{padding:"7px 9px",borderRadius:7,background:C.bg,color:C.textMuted,fontSize:11,fontWeight:600,border:`1px dashed ${C.border}`,display:"flex",alignItems:"center",gap:3,whiteSpace:"nowrap"}}>
                        <MinusCircle size={11}/> No aplica
                      </button>
                    )}
                  </div>
                )}
                {doc.status === "not_applicable" && onReactivate && (
                  <div style={{display:"flex",gap:5,flexShrink:0}}>
                    <button onClick={()=>onReactivate(doc.id)} title="Volver a marcar como pendiente" style={{padding:"7px 11px",borderRadius:7,background:C.card,color:C.text,fontSize:11,fontWeight:600,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
                      <RefreshCw size={11}/> Reactivar
                    </button>
                  </div>
                )}
              </div>
              {/* Mini-guía siempre visible para pendientes */}
              {isPending && (
                <div style={{marginTop:8, marginLeft:26, padding:"7px 10px", background:`rgba(91,191,160,.06)`, borderRadius:7, fontSize:10.5, color:C.text, lineHeight:1.4, display:"flex", gap:6, alignItems:"flex-start"}}>
                  <span style={{flexShrink:0}}>💡</span>
                  <span>{guide}</span>
                </div>
              )}
              {/* CTA Carlota contextual */}
              {isPending && (
                <button onClick={()=>window.dispatchEvent(new CustomEvent('open-carlota', {detail:{message:`Necesito ayuda para conseguir o entender el documento: ${doc.name}`}}))} style={{marginTop:6, marginLeft:26, fontSize:10.5, color:C.primary, background:"none", padding:0, display:"inline-flex", alignItems:"center", gap:4, fontWeight:500}}>
                  <Sparkles size={10}/> ¿Dudas con este documento? Pregúntale a Carlota
                </button>
              )}
            </div>);})}
        </div>}
      </div>);})}
  </div>);
}

// ════ SCANNER ════
function Scanner({docId,docs,onCapture,onClose}){
  const vRef=useRef(null);const cRef=useRef(null);const[str,setStr]=useState(null);const[cap,setCap]=useState(null);const[capFile,setCapFile]=useState(null);const[err,setErr]=useState(false);
  const doc=docs.find(d=>d.id===docId);
  useEffect(()=>{go();return()=>str?.getTracks().forEach(t=>t.stop());},[]);
  async function go(){try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment",width:{ideal:1920}}});setStr(s);if(vRef.current){vRef.current.srcObject=s;vRef.current.play();}}catch{setErr(true);}}
  function snap(){if(!vRef.current||!cRef.current)return;const v=vRef.current,c=cRef.current;c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext("2d");ctx.drawImage(v,0,0);const im=ctx.getImageData(0,0,c.width,c.height);const d=im.data;for(let i=0;i<d.length;i+=4){const gr=.299*d[i]+.587*d[i+1]+.114*d[i+2];const v2=Math.min(255,Math.max(0,((gr/255-.5)*1.6+.5)*255));d[i]=d[i+1]=d[i+2]=v2;}ctx.putImageData(im,0,0);const dataUrl=c.toDataURL("image/jpeg",.92);setCap(dataUrl);
    c.toBlob(blob=>{const file=new File([blob],`${doc?.name||"scan"}.jpg`,{type:"image/jpeg"});setCapFile(file);},"image/jpeg",.92);
    str?.getTracks().forEach(t=>t.stop());}
  function confirm(){if(capFile)onCapture(docId,capFile);}
  return(<div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,.95)",display:"flex",flexDirection:"column",fontFamily:font}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px"}}>
      <div><h3 style={{color:"#fff",fontSize:14,fontWeight:600}}>Escáner</h3>{doc&&<p style={{color:"rgba(255,255,255,.4)",fontSize:10.5}}>{doc.name}</p>}</div>
      <button onClick={onClose} style={{background:"rgba(255,255,255,.1)",borderRadius:7,width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff"}}><X size={16}/></button>
    </div>
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:14}}>
      {err?<div style={{textAlign:"center",color:"#fff"}}><Camera size={40} style={{opacity:.3,marginBottom:12}}/><p>Sin acceso a cámara</p><button onClick={onClose} style={{marginTop:14,padding:"8px 20px",borderRadius:7,background:`linear-gradient(135deg,${C.primary},${C.violet})`,color:"#fff",fontSize:12,fontWeight:600}}>Cerrar</button></div>
      :cap?<div style={{maxWidth:460,width:"100%"}}><img src={cap} alt="Scan" style={{width:"100%",borderRadius:10}}/></div>
      :<div style={{maxWidth:460,width:"100%",position:"relative"}}><video ref={vRef} autoPlay playsInline muted style={{width:"100%",borderRadius:10}}/><div style={{position:"absolute",inset:16,border:`2px dashed ${C.primary}80`,borderRadius:5,pointerEvents:"none"}}/></div>}
      <canvas ref={cRef} style={{display:"none"}}/>
    </div>
    <div style={{padding:"12px 16px 22px"}}>
      {cap?<div style={{display:"flex",gap:8,justifyContent:"center"}}>
        <button onClick={()=>{setCap(null);setCapFile(null);go();}} style={{padding:"10px 22px",borderRadius:9,fontSize:12,fontWeight:600,background:"rgba(255,255,255,.1)",color:"#fff",display:"flex",alignItems:"center",gap:5}}><RotateCw size={13}/>Repetir</button>
        <button onClick={confirm} style={{padding:"10px 22px",borderRadius:9,fontSize:12,fontWeight:600,background:`linear-gradient(135deg,${C.primary},${C.violet})`,color:"#fff",display:"flex",alignItems:"center",gap:5}}><Sparkles size={13}/>Verificar con IA</button>
      </div>:!err?<div style={{display:"flex",justifyContent:"center"}}><button onClick={snap} style={{width:56,height:56,borderRadius:"50%",background:`linear-gradient(135deg,${C.primary},${C.violet})`,border:"3px solid rgba(255,255,255,.3)",display:"flex",alignItems:"center",justifyContent:"center"}}><ScanLine size={20} color="#fff"/></button></div>:null}
    </div>
  </div>);
}

// ════ TIMELINE ════
function Timeline({docs,cats,pct,user,caseLabel}){
  return(<div>
    <div style={{background:C.card,borderRadius:14,padding:"20px",border:`1px solid ${C.border}`,marginBottom:18,display:"flex",gap:18,flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:160}}><p style={{fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:".04em"}}>Expediente</p><p style={{fontSize:14,fontWeight:600}}>Exp. {user.caseId || 'N/A'}</p><p style={{fontSize:11,color:C.textMuted,marginTop:2}}>{caseLabel}</p></div>
      <div style={{flex:1,minWidth:160}}><p style={{fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:".04em"}}>Letrado</p><p style={{fontSize:14,fontWeight:600}}>{user.lawyer || 'Sin asignar'}</p></div>
      <div style={{flex:1,minWidth:160}}><p style={{fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:".04em"}}>Estado</p><span style={{display:"inline-block",padding:"4px 10px",borderRadius:6,background:`rgba(91,107,240,.08)`,color:C.primary,fontSize:11,fontWeight:600}}>Fase documental — {pct}%</span></div>
    </div>
    <div style={{background:C.card,borderRadius:14,padding:"22px",border:`1px solid ${C.border}`}}>
      <h3 style={{fontSize:16,fontWeight:600,marginBottom:18}}>Checklist documental</h3>
      {cats.map((cat,ci)=>{const cd=docs.filter(d=>d.cat===cat);const dn=cd.filter(d=>d.status==="uploaded"||d.status==="review").length;const cn=cd[0]?.catNum;const cp=Math.round(dn/cd.length*100);return(
        <div key={cat} className="fade-in" style={{marginBottom:20,animationDelay:`${ci*.07}s`}}>
          <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
            <div style={{width:28,height:28,borderRadius:8,background:cp===100?C.green:`linear-gradient(135deg,${C.primary},${C.violet})`,display:"flex",alignItems:"center",justifyContent:"center"}}>{cp===100?<Check size={13} color="#fff" strokeWidth={3}/>:<span style={{fontSize:11,fontWeight:700,color:"#fff"}}>{cn}</span>}</div>
            <p style={{flex:1,fontSize:13,fontWeight:600}}>{cat}</p>
            <span style={{fontSize:11,fontWeight:600,color:cp===100?C.green:C.primary}}>{dn}/{cd.length}</span>
          </div>
          <div style={{marginLeft:14,borderLeft:`2px solid ${cp===100?C.green+"40":C.border}`,paddingLeft:16}}>
            {cd.map(d=>{const done=d.status==="uploaded"||d.status==="review";const inf=getS(d.status);return(
              <div key={d.id} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"6px 0"}}>
                <div style={{width:18,height:18,borderRadius:"50%",flexShrink:0,marginTop:1,background:done?inf.c:"transparent",border:done?"none":`2px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{done&&<Check size={9} color="#fff" strokeWidth={3}/>}</div>
                <div><p style={{fontSize:12,color:done?C.textMuted:C.text,textDecoration:d.status==="uploaded"?"line-through":"none"}}>{d.name}</p>{d.warn&&<p style={{fontSize:10,color:C.orange,marginTop:1}}>⚠ {d.warn}</p>}</div>
              </div>);})}
          </div>
        </div>);})}
    </div>
  </div>);
}

// ════ CALENDAR ════
function Cal({events}){
  const sorted=[...events].sort((a,b)=>new Date(a.date)-new Date(b.date));const today=new Date();
  return(<div style={{display:"flex",flexDirection:"column",gap:10}}>
    {sorted.map((ev,i)=>{const s=getEv(ev.type);const d=new Date(ev.date);const past=d<today;const isT=d.toDateString()===today.toDateString();const days=Math.ceil((d-today)/864e5);return(
      <div key={ev.id} className="hover-lift fade-in" style={{background:C.card,borderRadius:13,border:`1px solid ${C.border}`,padding:"16px 20px",display:"flex",gap:14,opacity:past?.5:1,borderLeft:isT?`3px solid ${C.primary}`:undefined,animationDelay:`${i*.06}s`}}>
        <div style={{width:48,height:48,borderRadius:11,background:s.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:18,fontWeight:700,color:s.c,lineHeight:1}}>{d.getDate()}</span><span style={{fontSize:8.5,color:s.c,textTransform:"uppercase",fontWeight:600}}>{d.toLocaleDateString("es-ES",{month:"short"})}</span></div>
        <div style={{flex:1}}><h4 style={{fontSize:13.5,fontWeight:600}}>{ev.title}</h4><p style={{fontSize:11.5,color:C.textMuted,marginTop:2}}>{ev.desc}</p>
          {!past&&<p style={{fontSize:10.5,marginTop:5,color:isT?C.primary:days<=7?C.orange:C.textMuted,fontWeight:isT?600:400}}>{isT?"Hoy":days===1?"Mañana":`En ${days} días`}</p>}
        </div>
        <div><span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 8px",borderRadius:5,background:s.bg,color:s.c,fontSize:10,fontWeight:600}}><s.i size={10}/>{s.l}</span>{ev.time&&<p style={{fontSize:10.5,color:C.textMuted,marginTop:2,textAlign:"right"}}>{ev.time}h</p>}</div>
      </div>);})}
  </div>);
}

// ════ PAYMENTS PAGE ════
function Payments({user, firstName}){
  const [payments, setPayments] = useState([]);
  const [caseInfo, setCaseInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (user?.org_id) {
          let contactId = null;
          if (user?.email) {
            const { data: contact } = await supabase
              .from('contacts')
              .select('id')
              .eq('email', user.email)
              .limit(1)
              .maybeSingle();
            contactId = contact?.id || null;
          }

          let caseRow = null;
          if (contactId) {
            const { data } = await supabase
              .from('cases')
              .select('id, case_number, case_type')
              .eq('contact_id', contactId)
              .limit(1)
              .maybeSingle();
            caseRow = data;
          }
          if (!caseRow) {
            const { data } = await supabase
              .from('cases')
              .select('id, case_number, case_type')
              .eq('org_id', user.org_id)
              .limit(1)
              .maybeSingle();
            caseRow = data;
          }
          setCaseInfo(caseRow);

          if (caseRow?.id) {
            const { data: pays } = await supabase
              .from('payments')
              .select('*')
              .eq('case_id', caseRow.id)
              .order('due_date', { ascending: true });
            setPayments(pays || []);
          }
        }
      } catch (e) {
        console.error('Error cargando pagos:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.email, user?.org_id]);

  // Detectar retorno de Stripe (?paid=<id>)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paidId = params.get('paid');
    if (paidId) {
      setToast('✅ Pago recibido. Tu expediente se actualizará en breve.');
      setTimeout(() => setToast(null), 5000);
      const url = new URL(window.location.href);
      url.searchParams.delete('paid');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  async function handlePayNow(paymentId) {
    setProcessing(paymentId);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setToast('Sesión expirada. Vuelve a entrar.');
        setTimeout(() => setToast(null), 4000);
        return;
      }
      const res = await fetch(`${supabaseUrl}/functions/v1/pay-installment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          paymentId,
          successUrl: `${window.location.origin}${window.location.pathname}?paid=${paymentId}`,
          cancelUrl: window.location.href,
        }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
        return;
      }
      setToast('Error al abrir la pasarela de pago.');
      setTimeout(() => setToast(null), 4000);
    } catch (e) {
      setToast('Error de conexión con la pasarela.');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setProcessing(null);
    }
  }

  // Fallback al mock si no hay datos reales (demo / sin org_id)
  const mockData = PAYMENTS[user.caseType || 'lso'];
  const usesMock = !loading && payments.length === 0;

  if (loading) {
    return <div style={{padding:"40px 20px",textAlign:"center",color:C.textMuted,fontSize:13}}><Loader size={20} style={{animation:"spin 1s linear infinite"}}/><p style={{marginTop:10}}>Cargando tus pagos…</p></div>;
  }
  if (usesMock && !mockData) {
    return <div style={{padding:"30px 20px",textAlign:"center",color:C.textMuted}}>No hay datos de pagos disponibles.</div>;
  }

  // Normalizamos pagos a forma común
  const normalized = usesMock
    ? mockData.payments.map(p => ({
        id: p.id,
        concept: p.concept,
        amount: p.amount,
        dateStr: p.date,
        status: p.status,
        invoice_number: p.invoice || null,
        invoice_url: null,
        services_included: null,
        service_description: null,
        payment_method: mockData.method,
      }))
    : payments.map(p => ({
        id: p.id,
        concept: p.concept,
        amount: parseFloat(p.amount || 0),
        dateStr: p.due_date,
        status: p.status,
        invoice_number: p.invoice_number || null,
        invoice_url: p.invoice_url || null,
        services_included: Array.isArray(p.services_included) ? p.services_included : null,
        service_description: p.service_description || null,
        payment_method: p.payment_method,
      }));

  const paid = normalized.filter(p => p.status === "paid");
  const pending = normalized.filter(p => p.status !== "paid");
  const upcoming = normalized.find(p => p.status === "upcoming") || normalized.find(p => p.status === "pending");
  const totalPaid = paid.reduce((a,p) => a + p.amount, 0);
  const totalPending = pending.reduce((a,p) => a + p.amount, 0);
  const totalContracted = usesMock
    ? mockData.totalContracted
    : normalized.reduce((a,p) => a + p.amount, 0);
  const pct = totalContracted > 0 ? Math.round(totalPaid/totalContracted*100) : 0;

  const methodKey = usesMock
    ? mockData.method
    : (pending.find(p => p.payment_method)?.payment_method || paid[0]?.payment_method || 'direct_debit');
  const method = methodInfo[methodKey] || methodInfo.direct_debit;
  const MethodIcon = method.icon;

  const ibanDisplay = usesMock ? mockData.iban : '—';
  const beneficiary = usesMock ? mockData.beneficiary : '';
  const paymentConcept = usesMock ? mockData.paymentConcept : (upcoming?.concept || '');

  function copyIban(iban){
    navigator.clipboard.writeText((iban||"").replace(/\s/g,""));
    setCopied(true);
    setTimeout(()=>setCopied(false),2000);
  }

  return(<div>
    {/* Hero summary */}
    <div style={{background:`linear-gradient(135deg,${C.primary},${C.violet})`,borderRadius:14,padding:"22px 24px",marginBottom:18,color:"#fff",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-30,right:-30,width:140,height:140,borderRadius:"50%",background:"rgba(255,255,255,.08)"}}/>
      <div style={{position:"absolute",bottom:-20,right:60,width:90,height:90,borderRadius:"50%",background:"rgba(255,255,255,.05)"}}/>
      <div style={{position:"relative"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <Wallet size={16}/><span style={{fontSize:12,fontWeight:500,opacity:.8}}>TOTAL CONTRATADO</span>
        </div>
        <p style={{fontSize:32,fontWeight:700,lineHeight:1.1}}>{fmtMoney(totalContracted)}</p>
        <div style={{marginTop:18,display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1,height:8,background:"rgba(255,255,255,.2)",borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${pct}%`,background:"#fff",borderRadius:4,transition:"width .8s"}}/>
          </div>
          <span style={{fontSize:18,fontWeight:700}}>{pct}%</span>
        </div>
        <div style={{display:"flex",gap:24,marginTop:14,flexWrap:"wrap"}}>
          <div><p style={{fontSize:10.5,opacity:.7,fontWeight:500}}>PAGADO</p><p style={{fontSize:18,fontWeight:700,marginTop:2}}>{fmtMoney(totalPaid)}</p></div>
          <div style={{width:1,background:"rgba(255,255,255,.2)"}}/>
          <div><p style={{fontSize:10.5,opacity:.7,fontWeight:500}}>PENDIENTE</p><p style={{fontSize:18,fontWeight:700,marginTop:2}}>{fmtMoney(totalPending)}</p></div>
          <div style={{width:1,background:"rgba(255,255,255,.2)"}}/>
          <div><p style={{fontSize:10.5,opacity:.7,fontWeight:500}}>{paid.length}/{normalized.length} CUOTAS</p><p style={{fontSize:18,fontWeight:700,marginTop:2}}>{pending.length} restantes</p></div>
        </div>
      </div>
    </div>

    {/* Próximo pago - alerta destacada */}
    {upcoming && (() => {
      const days = daysUntil(upcoming.dateStr);
      const isTransfer = methodKey === "transfer";
      const isCard = methodKey === "card";
      const urgent = days <= 3;
      const evDate = new Date(upcoming.dateStr);
      return (
        <div style={{background:urgent?C.orangeSoft:C.tealSoft,border:`1.5px solid ${urgent?C.orange:C.teal}40`,borderRadius:14,padding:"18px 22px",marginBottom:16,position:"relative",overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
            <div style={{width:42,height:42,borderRadius:10,background:urgent?C.orange:C.teal,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {isTransfer ? <ArrowRightCircle size={20} color="#fff"/> : isCard ? <CreditCard size={20} color="#fff"/> : <Banknote size={20} color="#fff"/>}
            </div>
            <div style={{flex:1,minWidth:200}}>
              <p style={{fontSize:11,fontWeight:600,color:urgent?C.orange:C.teal,textTransform:"uppercase",letterSpacing:".05em"}}>
                {isTransfer ? "Próxima transferencia" : isCard ? "Próximo pago con tarjeta" : "Próximo cargo automático"}
              </p>
              <p style={{fontSize:18,fontWeight:700,marginTop:4}}>{fmtMoney(upcoming.amount)} <span style={{fontSize:13,fontWeight:500,color:C.textMuted}}>· {upcoming.concept}</span></p>
              <p style={{fontSize:13,color:C.text,marginTop:6,lineHeight:1.5}}>
                {firstName}, {isTransfer ? "tienes que realizar la" : "se realizará el"} {isTransfer?"transferencia":"cargo"} el <strong>{evDate.toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})}</strong>
                {days >= 0 && (days===0?" — HOY":days===1?" — mañana":` (en ${days} días)`)}
              </p>
              {!usesMock && upcoming.status === "upcoming" && (
                <button
                  onClick={() => handlePayNow(upcoming.id)}
                  disabled={processing === upcoming.id}
                  style={{marginTop:10,padding:"10px 16px",borderRadius:9,background:`linear-gradient(135deg,${C.primary},${C.violet})`,color:"#fff",fontSize:13,fontWeight:600,border:"none",cursor:processing===upcoming.id?"wait":"pointer",display:"inline-flex",alignItems:"center",gap:6}}
                >
                  <CreditCard size={14}/> {processing === upcoming.id ? "Procesando…" : "Pagar ahora con tarjeta"}
                </button>
              )}
              {isTransfer && usesMock ? (
                <div style={{marginTop:10,padding:"12px 14px",background:"rgba(255,255,255,.7)",borderRadius:10,fontSize:12,lineHeight:1.7}}>
                  <p style={{fontWeight:600,marginBottom:6,fontSize:11,textTransform:"uppercase",letterSpacing:".05em",color:C.textMuted}}>Datos para la transferencia</p>
                  <p><strong>Beneficiario:</strong> {beneficiary}</p>
                  <p><strong>IBAN:</strong> <code style={{background:C.bg,padding:"2px 6px",borderRadius:4,fontFamily:"monospace",fontSize:12}}>{ibanDisplay}</code> <button onClick={()=>copyIban(ibanDisplay)} style={{background:"none",color:C.primary,fontSize:11,fontWeight:600,marginLeft:6,display:"inline-flex",alignItems:"center",gap:3}}><Copy size={11}/>{copied?"¡Copiado!":"Copiar"}</button></p>
                  <p><strong>Concepto:</strong> {paymentConcept}</p>
                  <p><strong>Importe:</strong> {fmtMoney(upcoming.amount)}</p>
                </div>
              ) : !isCard && usesMock ? (
                <p style={{fontSize:12,color:C.textMuted,marginTop:8,padding:"8px 12px",background:"rgba(255,255,255,.6)",borderRadius:8}}>
                  💡 Asegúrate de tener saldo suficiente en tu cuenta <strong>{ibanDisplay}</strong>. Si tienes dudas, contacta con tu letrado.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      );
    })()}

    {/* Método de pago */}
    <div style={{background:C.card,borderRadius:14,padding:"18px 22px",marginBottom:16,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:14}}>
      <div style={{width:42,height:42,borderRadius:10,background:`linear-gradient(135deg,${C.primary}15,${C.violet}10)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <MethodIcon size={20} color={C.primary}/>
      </div>
      <div style={{flex:1}}>
        <p style={{fontSize:11,color:C.textMuted,textTransform:"uppercase",letterSpacing:".05em",fontWeight:500}}>Método de pago</p>
        <p style={{fontSize:14,fontWeight:600,marginTop:2}}>{method.label}</p>
        <p style={{fontSize:12,color:C.textMuted,marginTop:2}}>{method.desc}{ibanDisplay && ibanDisplay !== '—' ? ` · ${ibanDisplay}` : ''}</p>
      </div>
      <button style={{padding:"8px 14px",borderRadius:8,fontSize:12,fontWeight:500,background:C.bg,color:C.text,border:`1px solid ${C.border}`}}>Cambiar</button>
    </div>

    {/* Historial de pagos */}
    <div style={{background:C.card,borderRadius:14,padding:"20px 22px",border:`1px solid ${C.border}`}}>
      <h3 style={{fontSize:15,fontWeight:600,marginBottom:14}}>Historial de pagos</h3>
      <div>
        {normalized.map((p,i)=>{
          const s = getPayStatus(p.status);
          const Icon = s.i;
          const days = p.status==="upcoming" || p.status==="pending" ? daysUntil(p.dateStr) : null;
          const canPay = !usesMock && p.status === "upcoming";
          return (
            <div key={p.id} style={{padding:"14px 0",borderBottom:i<normalized.length-1?`1px solid ${C.bg}`:"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:36,height:36,borderRadius:9,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <Icon size={17} color={s.c}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <p style={{fontSize:13,fontWeight:600}}>{p.concept}</p>
                    <span style={{fontSize:10,fontWeight:600,color:s.c,background:s.bg,padding:"2px 7px",borderRadius:4}}>{s.l}</span>
                  </div>
                  <p style={{fontSize:11.5,color:C.textMuted,marginTop:3}}>
                    {p.dateStr ? new Date(p.dateStr).toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric"}) : "—"}
                    {p.invoice_number && ` · Factura ${p.invoice_number}`}
                    {days !== null && days >= 0 && ` · ${days===0?"Hoy":days===1?"Mañana":`En ${days} días`}`}
                  </p>
                  {p.service_description && (
                    <p style={{fontSize:11.5,color:C.text,marginTop:4,lineHeight:1.5}}>{p.service_description}</p>
                  )}
                  {p.services_included && p.services_included.length > 0 && (
                    <details style={{marginTop:6}}>
                      <summary style={{fontSize:11,color:C.primary,cursor:"pointer",fontWeight:500}}>¿Qué incluye este pago?</summary>
                      <ul style={{marginTop:5,paddingLeft:16,fontSize:11,color:C.text,lineHeight:1.6}}>
                        {p.services_included.map((s, idx) => <li key={idx}>{typeof s === 'string' ? s : (s.label || JSON.stringify(s))}</li>)}
                      </ul>
                    </details>
                  )}
                </div>
                <div style={{textAlign:"right",flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                  <p style={{fontSize:14,fontWeight:700}}>{fmtMoney(p.amount)}</p>
                  {canPay && (
                    <button
                      onClick={()=>handlePayNow(p.id)}
                      disabled={processing === p.id}
                      style={{padding:"8px 14px",borderRadius:8,background:`linear-gradient(135deg,${C.primary},${C.violet})`,color:"#fff",fontSize:12,fontWeight:600,border:"none",cursor:processing===p.id?"wait":"pointer",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}
                    >
                      <CreditCard size={12}/> {processing === p.id ? "Procesando…" : "Pagar con tarjeta"}
                    </button>
                  )}
                  {p.invoice_url ? (
                    <a href={p.invoice_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:C.primary,background:"none",fontWeight:500,display:"flex",alignItems:"center",gap:3,textDecoration:"none"}}>
                      <Download size={11}/> Ver factura
                    </a>
                  ) : p.invoice_number && usesMock ? (
                    <button style={{fontSize:11,color:C.primary,background:"none",fontWeight:500,display:"flex",alignItems:"center",gap:3,border:"none",cursor:"pointer"}}>
                      <Download size={11}/> Factura
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Footer info ERP */}
    <div style={{marginTop:14,padding:"12px 16px",borderRadius:10,background:`rgba(91,107,240,.05)`,border:`1px solid ${C.primary}15`,fontSize:11.5,color:C.text,lineHeight:1.6,display:"flex",gap:8,alignItems:"flex-start"}}>
      <Sparkles size={13} color={C.primary} style={{flexShrink:0,marginTop:1}}/>
      <span><strong>Sincronización con ERP:</strong> el estado de tus pagos se actualiza automáticamente cada vez que el ERP procesa un cobro. Recibirás aviso por WhatsApp y notificación en la app antes de cada cargo.</span>
    </div>

    {toast && <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:C.sidebar,color:"#fff",padding:"12px 24px",borderRadius:12,fontSize:13,fontWeight:500,zIndex:999,boxShadow:"0 8px 30px rgba(0,0,0,.2)",maxWidth:"90%",textAlign:"center"}}>{toast}</div>}
  </div>);
}

// ════ CHAT ════
function Chat({messages,setMessages,docs,user,caseLabel}){
  const[input,setInput]=useState("");const[ld,setLd]=useState(false);const endRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  const payData = PAYMENTS[user.caseType || 'lso'];
  const payCtx = payData ? `\nPAGOS:\nTotal contratado: ${fmtMoney(payData.totalContracted)}, Pagados: ${payData.payments.filter(p=>p.status==="paid").length}/${payData.payments.length}, Método: ${methodInfo[payData.method].label}, Próximo pago: ${(()=>{const u=payData.payments.find(p=>p.status==="upcoming");return u?`${fmtMoney(u.amount)} el ${u.date}`:"ninguno"})()}`:"";
  const docCtx=docs.map(d=>`- [${d.status==="pending"?"PENDIENTE":d.status==="uploaded"?"VERIFICADO":"EN REVISIÓN"}] ${d.name} (${d.cat})${d.warn?` ⚠ ${d.warn}`:""}${!d.required?" [opcional]":""}`).join("\n");
  async function send(){
    if(!input.trim()||ld)return;
    const msg=input.trim();
    setInput("");
    setMessages(p=>[...p,{role:"user",content:msg}]);
    setLd(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setMessages(p => [...p, { role: "assistant", content: "Tu sesión ha caducado. Vuelve a entrar con tu email." }]);
        return;
      }
      const apiMessages = [...messages.slice(-10), { role: "user", content: msg }].map(m => ({ role: m.role, content: m.content }));
      const contextNote = `\n\nContexto extra del cliente (usa solo si es relevante): Exp ${user.caseId || 'N/A'} · ${caseLabel} · Letrado: ${user.lawyer || 'Sin asignar'}.\nDocumentos:\n${docCtx}${payCtx}`;
      const messagesWithContext = apiMessages.length === 1
        ? [{ role: "user", content: msg + contextNote }]
        : apiMessages;

      const res = await fetch(`${supabaseUrl}/functions/v1/carlota-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({
          messages: messagesWithContext,
          currentModule: "lexdocs",
          currentContext: { caseId: user.caseId, caseType: user.caseType || 'lso' },
        }),
      });
      const data = await res.json();
      if (data.success && data.reply) {
        setMessages(p => [...p, { role: "assistant", content: data.reply }]);
      } else {
        setMessages(p => [...p, { role: "assistant", content: "Disculpa, no he podido procesar tu pregunta. Inténtalo de nuevo en unos segundos." }]);
      }
    } catch (e) {
      console.error("Chat error:", e);
      setMessages(p => [...p, { role: "assistant", content: "Error de conexión. Revisa tu internet e inténtalo de nuevo." }]);
    }
    setLd(false);
  }

  const qQ=(user.caseType||'lso')==="concurso"?["¿Qué me falta?","¿Cómo consigo el CIRBE?","¿Formato Lexnet?","¿Plazo?"]:["¿Qué me falta?","¿Dónde saco empadronamiento?","¿Antecedentes penales?","¿Mi próximo plazo?"];

  return(<div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 120px)",background:C.card,borderRadius:14,border:`1px solid ${C.border}`,overflow:"hidden"}}>
    <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:9}}>
      <img src={LOGO} alt="" style={{width:34,height:34,borderRadius:8}}/>
      <div><h3 style={{fontSize:13,fontWeight:600}}>Asistente LibreApp</h3><p style={{fontSize:10.5,color:C.green,display:"flex",alignItems:"center",gap:3}}><span style={{width:5,height:5,borderRadius:"50%",background:C.green}}/>En línea</p></div>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"16px 18px",display:"flex",flexDirection:"column",gap:12}}>
      {messages.map((m,i)=><div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
        <div style={{maxWidth:"80%",padding:"10px 14px",borderRadius:m.role==="user"?"12px 12px 3px 12px":"12px 12px 12px 3px",background:m.role==="user"?`linear-gradient(135deg,${C.primary},${C.violet})`:C.bg,color:m.role==="user"?"#fff":C.text,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{m.content}</div>
      </div>)}
      {ld&&<div style={{display:"flex"}}><div style={{padding:"10px 14px",borderRadius:"12px 12px 12px 3px",background:C.bg}}><div style={{display:"flex",gap:3}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:C.textMuted,animation:`pulse 1.4s ease ${i*.2}s infinite`}}/>)}</div></div></div>}
      {messages.length<=1&&<div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:4}}>{qQ.map((q,i)=><button key={i} onClick={()=>setInput(q)} style={{padding:"6px 10px",borderRadius:16,fontSize:11,background:`rgba(91,107,240,.06)`,border:`1px solid ${C.primary}20`,color:C.text}}>{q}</button>)}</div>}
      <div ref={endRef}/>
    </div>
    <div style={{padding:"10px 12px",borderTop:`1px solid ${C.border}`,background:C.bg}}>
      <div style={{display:"flex",gap:7,alignItems:"flex-end",background:C.white,borderRadius:10,padding:"6px 10px",border:`1.5px solid ${C.border}`}}>
        <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Escribe tu pregunta..." rows={1} style={{flex:1,border:"none",outline:"none",resize:"none",fontSize:13,fontFamily:font,background:"transparent",padding:"2px 0",maxHeight:80,lineHeight:1.5,color:C.text}}/>
        <button onClick={send} disabled={!input.trim()||ld} style={{width:34,height:34,borderRadius:9,flexShrink:0,background:input.trim()?`linear-gradient(135deg,${C.primary},${C.violet})`:C.bg,color:input.trim()?"#fff":C.textMuted,display:"flex",alignItems:"center",justifyContent:"center"}}><Send size={14}/></button>
      </div>
    </div>
  </div>);
}
