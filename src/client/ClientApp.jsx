import { useState, useEffect, useRef } from "react";
import { Upload, Camera, FileText, CheckCircle, Clock, AlertCircle, Calendar, MessageSquare, Home, LogOut, ChevronRight, X, Bell, User, Send, Paperclip, ScanLine, Eye, BarChart3, Phone, FolderOpen, Shield, Scale, Briefcase, Menu, ChevronDown, Building2, FileWarning, ChevronUp, Check, RotateCw, Sparkles, ShieldCheck, ShieldAlert, Loader, RefreshCw, CreditCard, Wallet, Receipt, Copy, Download, ArrowRightCircle, Banknote, TrendingUp } from "lucide-react";
import { LOGO, font, C, KB, DOCS_LSO, DOCS_CONCURSO, EVENTS_LSO, EVENTS_CONC, PAYMENTS, methodInfo } from "../constants";
import { statusMap, getS, evSt, getEv, fmtD, fmtMoney, daysUntil, payStatusMap, getPayStatus, motivMsg } from "../utils";
import Carlota from "../components/Carlota";

// Verificación documental con Claude Vision (con backend proxy o modo demo)
async function verifyDocWithAI(file, docId, clientName) {
  const sig = KB[docId];
  if (!sig) {
    return { verdict: "needs_review", message: "Documento no en base de conocimiento. Tu letrado lo revisará manualmente." };
  }
  await new Promise(r => setTimeout(r, 1800 + Math.random() * 1500));
  if (file.type.includes("word") || file.type.includes("sheet") || file.type.includes("excel") || file.name.match(/\.(xlsx?|docx?|csv)$/i)) {
    return { verdict: "needs_review", confidence: 60, documentType: "Archivo editable", message: `${clientName}, he recibido tu archivo "${sig.name}". Como es un formato editable (Word/Excel), lo revisará tu letrado manualmente.` };
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
  const rand = Math.random();
  const today = new Date();
  if (rand < 0.70) {
    return { verdict: "valid", confidence: 88 + Math.floor(Math.random() * 10), documentType: sig.name, issuer: sig.issuer, issueDate: new Date(today - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], message: `¡Perfecto ${clientName}! He verificado que este documento es un ${sig.name} válido de ${sig.issuer}. Todo correcto.`, warnings: [] };
  } else if (rand < 0.85) {
    return { verdict: "incomplete", confidence: 75, documentType: sig.name, issuer: sig.issuer, message: `${clientName}, parece ser el documento correcto pero está incompleto. Falta alguna página o información clave. ¿Puedes subir el documento completo?`, warnings: ["Documento posiblemente incompleto", "Faltan páginas o secciones"] };
  } else if (rand < 0.95) {
    return { verdict: "wrong_document", confidence: 92, documentType: "Otro tipo de documento", message: `${clientName}, este archivo no parece ser un ${sig.name}. Necesitamos específicamente este documento. Te dejo abajo dónde puedes conseguirlo.`, warnings: ["El documento subido no coincide con el solicitado"] };
  } else {
    const oldDate = new Date(today - 120 * 24 * 60 * 60 * 1000);
    return { verdict: "expired", confidence: 90, documentType: sig.name, issuer: sig.issuer, issueDate: oldDate.toISOString().split("T")[0], message: `${clientName}, este documento está caducado (tiene más de 3 meses). Necesitamos uno actualizado. Es rápido pedir uno nuevo.`, warnings: ["Documento caducado", "La vigencia legal es de 3 meses"] };
  }
}

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

  useEffect(() => {
    setDocs((user.caseType === "concurso" ? DOCS_CONCURSO : DOCS_LSO).map(d => ({ ...d })));
    setEvents(user.caseType === "concurso" ? EVENTS_CONC : EVENTS_LSO);
    const n = user.name.split(" ")[0];
    setChatMsgs([{ role: "assistant", content: `¡Hola ${n}! 👋 Soy tu asistente documental de LibreApp.\n\nPuedo ayudarte con:\n• Qué documentos necesitas y dónde conseguirlos\n• Estado de tu expediente ${user.caseId}\n• Plazos y fechas\n\n¿En qué puedo ayudarte?` }]);
  }, [user]);

  const up = docs.filter(d => d.status === "uploaded" || d.status === "review").length;
  const pct = docs.length ? Math.round(up / docs.length * 100) : 0;
  const cats = [...new Set(docs.map(d => d.cat))];
  const pendingReq = docs.filter(d => d.status === "pending" && d.required).length;
  const firstName = user?.name?.split(" ")[0] || "";

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

  const navItems = [{ id: "dashboard", label: "Inicio", icon: Home }, { id: "documents", label: "Documentos", icon: FolderOpen, badge: pendingReq }, { id: "timeline", label: "Mi expediente", icon: BarChart3 }, { id: "calendar", label: "Agenda", icon: Calendar }, { id: "payments", label: "Pagos", icon: Wallet }, { id: "chat", label: "Asistente IA", icon: MessageSquare }];
  const caseLabel = user.caseType === "concurso" ? "Concurso de Acreedores" : "Ley de Segunda Oportunidad";

  return (
    <div style={{ fontFamily: font, background: C.bg, minHeight: "100vh", display: "flex", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes slideIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes scaleIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes shimmer{0%{background-position:-200px 0}100%{background-position:calc(200px + 100%) 0}}.fade-in{animation:fadeIn .35s ease both}.scale-in{animation:scaleIn .3s ease both}.hover-lift{transition:transform .2s,box-shadow .2s}.hover-lift:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(91,107,240,.12)}input:focus,textarea:focus{outline:none;border-color:${C.primary}!important;box-shadow:0 0 0 3px rgba(91,107,240,.15)}button{cursor:pointer;border:none;font-family:${font}}@media(max-width:768px){.dsk{display:none!important}.mh{display:flex!important}.mc{margin-left:0!important;padding:14px!important;padding-top:68px!important}}@media(min-width:769px){.mh{display:none!important}.mo{display:none!important}}`}</style>

      <div style={{ position: "fixed", top: 0, right: 0, zIndex: 9999, padding: "4px 12px", background: `linear-gradient(135deg,#5B6BF0,#7C5BF0)`, color: "#fff", fontSize: 10, fontWeight: 600, borderRadius: "0 0 0 8px", letterSpacing: ".05em" }}>MODO DEMO · IA simulada</div>
      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.sidebar, color: "#fff", padding: "12px 24px", borderRadius: 12, fontSize: 13, fontWeight: 500, zIndex: 999, animation: "slideUp .3s ease", boxShadow: "0 8px 30px rgba(0,0,0,.2)", maxWidth: "90%", textAlign: "center" }}>{toast}</div>}

      {verifying && <VerificationModal verifying={verifying} result={verifyResult} firstName={firstName} onConfirm={confirmUpload} onReject={rejectUpload} expectedDoc={docs.find(d => d.id === verifying.docId)} />}

      <aside className="dsk" style={{ width: 260, background: C.sidebar, position: "fixed", top: 0, left: 0, bottom: 0, display: "flex", flexDirection: "column", zIndex: 50 }}>
        <div style={{ padding: "22px 20px 16px", borderBottom: `1px solid ${C.sidebarMid}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <img src={LOGO} alt="LibreApp" style={{ width: 34, height: 34, borderRadius: 8 }} />
            <div><span style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>LibreApp</span><p style={{ fontSize: 9.5, color: C.textLight }}>Suite Legal</p></div>
          </div>
          <div style={{ padding: "8px 10px", background: C.sidebarLight, borderRadius: 8, borderLeft: `3px solid ${C.primary}` }}>
            <p style={{ fontSize: 10.5, color: C.primaryLight, fontWeight: 600 }}>Exp. {user.caseId}</p>
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
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.sidebarLight, display: "flex", alignItems: "center", justifyContent: "center" }}>{user.caseType === "concurso" ? <Building2 size={15} color={C.primaryLight} /> : <User size={15} color={C.primaryLight} />}</div>
            <div><p style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{user.name.length > 20 ? user.name.substring(0, 20) + "…" : user.name}</p><p style={{ fontSize: 9.5, color: C.textLight }}>Letrado: {user.lawyer}</p></div>
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
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em" }}>{page === "dashboard" && `Hola, ${firstName}`}{page === "documents" && "Gestión documental"}{page === "timeline" && "Mi expediente"}{page === "calendar" && "Agenda"}{page === "payments" && "Mis pagos"}{page === "chat" && "Asistente documental"}</h1>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{caseLabel} · Exp. {user.caseId}</p>
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
          {page === "dashboard" && <Dashboard docs={docs} pct={pct} setPage={setPage} events={events} cats={cats} user={user} pendingReq={pendingReq} firstName={firstName} />}
          {page === "documents" && <Documents docs={docs} cats={cats} onFileSelected={handleFileSelected} onScan={id => { setScanId(id); setShowScan(true); }} pct={pct} firstName={firstName} />}
          {page === "timeline" && <Timeline docs={docs} cats={cats} pct={pct} user={user} caseLabel={caseLabel} />}
          {page === "calendar" && <Cal events={events} />}
          {page === "payments" && <Payments user={user} firstName={firstName} />}
          {page === "chat" && <Chat messages={chatMsgs} setMessages={setChatMsgs} docs={docs} user={user} caseLabel={caseLabel} />}
        </div>
      </main>
      {showScan && <Scanner docId={scanId} docs={docs} onCapture={(id, file) => { handleFileSelected(id, file); setShowScan(false); }} onClose={() => setShowScan(false)} />}
      <Carlota user={user} currentModule="lexdocs" currentContext={{ caseId: user.caseId }} />
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
function Dashboard({docs,pct,setPage,events,cats,user,pendingReq,firstName}){
  const nextEv=events.filter(e=>new Date(e.date)>=new Date()).slice(0,3);
  return(<div>
    <div style={{background:C.card,borderRadius:14,padding:"20px 24px",marginBottom:18,border:`1px solid ${C.border}`}}>
      <h3 style={{fontSize:14,fontWeight:600,marginBottom:14}}>Progreso por categoría</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:8}}>
        {cats.map(cat=>{const cd=docs.filter(d=>d.cat===cat);const cu=cd.filter(d=>d.status==="uploaded"||d.status==="review").length;const cp=Math.round(cu/cd.length*100);const cn=cd[0]?.catNum;return(
          <div key={cat} style={{padding:"10px 12px",borderRadius:10,background:C.bg,display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:28,height:28,borderRadius:8,background:cp===100?C.greenSoft:`rgba(91,107,240,.08)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:11,fontWeight:700,color:cp===100?C.green:C.primary}}>{cn}</span></div>
            <div style={{flex:1,minWidth:0}}><p style={{fontSize:11.5,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat}</p>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}><div style={{flex:1,height:4,background:C.border,borderRadius:2}}><div style={{height:"100%",width:`${cp}%`,borderRadius:2,background:cp===100?C.green:`linear-gradient(90deg,${C.primary},${C.violet})`}}/></div><span style={{fontSize:10,color:C.textMuted,fontWeight:600}}>{cu}/{cd.length}</span></div>
            </div>
          </div>);})}
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14}}>
      <div style={{background:C.card,borderRadius:14,padding:"18px",border:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h3 style={{fontSize:14,fontWeight:600}}>Pendientes</h3><button onClick={()=>setPage("documents")} style={{fontSize:12,color:C.primary,background:"none",fontWeight:500,display:"flex",alignItems:"center",gap:2}}>Ver todos<ChevronRight size={12}/></button></div>
        {docs.filter(d=>d.status==="pending"&&d.required).slice(0,4).map(d=><div key={d.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:`1px solid ${C.bg}`}}><div style={{width:6,height:6,borderRadius:"50%",background:C.red,flexShrink:0}}/><div style={{flex:1,minWidth:0}}><p style={{fontSize:11.5,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</p></div></div>)}
      </div>
      <div style={{background:C.card,borderRadius:14,padding:"18px",border:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h3 style={{fontSize:14,fontWeight:600}}>Agenda</h3><button onClick={()=>setPage("calendar")} style={{fontSize:12,color:C.primary,background:"none",fontWeight:500,display:"flex",alignItems:"center",gap:2}}>Ver todo<ChevronRight size={12}/></button></div>
        {nextEv.map(ev=>{const s=getEv(ev.type);return(<div key={ev.id} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.bg}`}}>
          <div style={{width:40,height:40,borderRadius:9,background:s.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:14,fontWeight:700,color:s.c,lineHeight:1}}>{new Date(ev.date).getDate()}</span><span style={{fontSize:8,color:s.c,textTransform:"uppercase",fontWeight:600}}>{new Date(ev.date).toLocaleDateString("es-ES",{month:"short"})}</span></div>
          <div><p style={{fontSize:12,fontWeight:500}}>{ev.title}</p><p style={{fontSize:10.5,color:C.textMuted}}>{ev.time&&`${ev.time} · `}{s.l}</p></div>
        </div>);})}
      </div>
    </div>
          {/* Payment widget */}
      {(()=>{const pd=PAYMENTS[user.caseType];if(!pd)return null;const paid=pd.payments.filter(p=>p.status==="paid");const totalPaid=paid.reduce((a,p)=>a+p.amount,0);const upc=pd.payments.find(p=>p.status==="upcoming");const days=upc?daysUntil(upc.date):null;const payPct=Math.round(totalPaid/pd.totalContracted*100);return(
        <div onClick={()=>setPage("payments")} className="hover-lift" style={{cursor:"pointer",background:C.card,borderRadius:14,padding:"18px",border:`1px solid ${C.border}`,marginTop:14,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{width:42,height:42,borderRadius:10,background:`linear-gradient(135deg,${C.primary}15,${C.violet}10)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Wallet size={20} color={C.primary}/></div>
          <div style={{flex:1,minWidth:180}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:10}}>
              <p style={{fontSize:13,fontWeight:600}}>Tus pagos</p>
              <span style={{fontSize:12,fontWeight:700,color:C.primary}}>{payPct}%</span>
            </div>
            <div style={{height:6,background:C.bg,borderRadius:3,overflow:"hidden",marginBottom:6}}><div style={{height:"100%",width:`${payPct}%`,background:`linear-gradient(90deg,${C.primary},${C.violet})`,borderRadius:3}}/></div>
            <p style={{fontSize:11.5,color:C.textMuted}}>{fmtMoney(totalPaid)} pagados de {fmtMoney(pd.totalContracted)}</p>
          </div>
          {upc&&<div style={{padding:"8px 12px",borderRadius:8,background:days<=3?C.orangeSoft:C.tealSoft,fontSize:11,fontWeight:600,color:days<=3?C.orange:C.teal,whiteSpace:"nowrap"}}>{days===0?"Cargo hoy":days===1?"Cargo mañana":`Cargo en ${days}d`}</div>}
          <ChevronRight size={16} color={C.textMuted}/>
        </div>
      );})()}
      <div style={{display:"flex",gap:8,marginTop:18,flexWrap:"wrap"}}>
      {[{l:"Subir documento",i:Upload,fn:()=>setPage("documents"),p:true},{l:"Asistente IA",i:MessageSquare,fn:()=>setPage("chat")},{l:"Ver expediente",i:BarChart3,fn:()=>setPage("timeline")}].map((b,i)=><button key={i} onClick={b.fn} className="hover-lift" style={{display:"flex",alignItems:"center",gap:7,padding:"11px 18px",borderRadius:10,background:b.p?`linear-gradient(135deg,${C.primary},${C.violet})`:C.card,color:b.p?"#fff":C.text,fontSize:12.5,fontWeight:600,border:b.p?"none":`1px solid ${C.border}`}}><b.i size={14}/>{b.l}</button>)}
    </div>
  </div>);
}

// ════ DOCUMENTS ════
function Documents({docs,cats,onFileSelected,onScan,pct,firstName}){
  const[filter,setFilter]=useState("all");const[expDoc,setExpDoc]=useState(null);const[expCats,setExpCats]=useState(new Set(cats));const fRef=useRef(null);
  const filtered=filter==="all"?docs:filter==="pending"?docs.filter(d=>d.status==="pending"||d.status==="partial"):docs.filter(d=>d.status==="uploaded"||d.status==="review");
  const up=docs.filter(d=>d.status==="uploaded"||d.status==="review").length;
  function hf(e){const f=e.target.files?.[0];if(f&&expDoc){onFileSelected(expDoc,f);setExpDoc(null);e.target.value="";}}
  function tCat(c){setExpCats(p=>{const n=new Set(p);n.has(c)?n.delete(c):n.add(c);return n;});}
  const groups=cats.map(c=>({cat:c,catNum:docs.find(d=>d.cat===c)?.catNum,docs:filtered.filter(d=>d.cat===c)})).filter(g=>g.docs.length>0);

  return(<div>
    <input ref={fRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{display:"none"}} onChange={hf}/>
    <div style={{background:`linear-gradient(135deg,rgba(91,107,240,.06),rgba(124,91,240,.04))`,borderRadius:12,padding:"14px 18px",marginBottom:14,border:`1px solid ${C.primary}20`,display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:34,height:34,borderRadius:9,background:`linear-gradient(135deg,${C.primary},${C.violet})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Sparkles size={16} color="#fff"/></div>
      <div><p style={{fontSize:12.5,fontWeight:600}}>Verificación con IA activada</p><p style={{fontSize:11,color:C.textMuted}}>Cada documento que subas se verifica automáticamente</p></div>
    </div>
    <div style={{background:C.card,borderRadius:12,padding:"14px 18px",marginBottom:14,border:`1px solid ${C.border}`}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:12,fontWeight:600}}>Progreso</span><span style={{fontSize:12,fontWeight:700,color:C.primary}}>{pct}%</span></div>
      <div style={{height:6,background:C.bg,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,borderRadius:3,background:`linear-gradient(90deg,${C.primary},${C.violet})`}}/></div>
    </div>
    <div style={{display:"flex",gap:5,marginBottom:14,flexWrap:"wrap"}}>
      {[{k:"all",l:`Todos (${docs.length})`},{k:"pending",l:`Pendientes (${docs.filter(d=>d.status==="pending").length})`},{k:"done",l:`Entregados (${up})`}].map(f=><button key={f.k} onClick={()=>setFilter(f.k)} style={{padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:500,background:filter===f.k?`linear-gradient(135deg,${C.primary},${C.violet})`:C.card,color:filter===f.k?"#fff":C.text,border:`1px solid ${filter===f.k?"transparent":C.border}`}}>{f.l}</button>)}
    </div>
    {groups.map(g=>{const o=expCats.has(g.cat);const cu=g.docs.filter(d=>d.status==="uploaded"||d.status==="review").length;const total=docs.filter(d=>d.cat===g.cat).length;const cp=Math.round(cu/total*100);return(
      <div key={g.cat} style={{marginBottom:10}}>
        <button onClick={()=>tCat(g.cat)} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"12px 14px",background:C.card,borderRadius:o?"12px 12px 0 0":12,border:`1px solid ${C.border}`,borderBottom:o?"none":`1px solid ${C.border}`,textAlign:"left"}}>
          <div style={{width:28,height:28,borderRadius:8,background:cp===100?C.greenSoft:`rgba(91,107,240,.08)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:11,fontWeight:700,color:cp===100?C.green:C.primary}}>{g.catNum}</span></div>
          <div style={{flex:1}}><p style={{fontSize:13,fontWeight:600}}>{g.cat}</p><p style={{fontSize:10,color:C.textMuted,marginTop:1}}>{cu}/{total}</p></div>
          <span style={{fontSize:11,fontWeight:600,color:cp===100?C.green:C.primary}}>{cp}%</span>
          {o?<ChevronUp size={15} color={C.textMuted}/>:<ChevronDown size={15} color={C.textMuted}/>}
        </button>
        {o&&<div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 12px 12px",overflow:"hidden"}}>
          {g.docs.map(doc=>{const inf=getS(doc.status);const Ic=inf.i;const isE=expDoc===doc.id;const hasKB = !!KB[doc.id];return(
            <div key={doc.id} style={{borderBottom:`1px solid ${C.bg}`}}>
              <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:10,background:C.card}}>
                <Ic size={16} color={inf.c} style={{flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:12.5,fontWeight:500}}>{doc.name}</p>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,color:inf.c,fontWeight:500}}>{inf.l}</span>
                    {hasKB && <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:9.5,color:C.primary,background:`rgba(91,107,240,.08)`,padding:"1px 6px",borderRadius:3,fontWeight:500}}><Sparkles size={9}/> IA</span>}
                    {!doc.required&&<span style={{fontSize:9,color:C.textMuted,background:C.bg,padding:"1px 5px",borderRadius:3}}>Opcional</span>}
                    {doc.uploadedAt&&<span style={{fontSize:10,color:C.textMuted}}>· {fmtD(doc.uploadedAt)}</span>}
                  </div>
                  {doc.warn&&<p style={{fontSize:10.5,color:C.orange,marginTop:2,display:"flex",alignItems:"flex-start",gap:3}}><FileWarning size={11} style={{flexShrink:0,marginTop:1}}/>{doc.warn}</p>}
                  {doc.note&&<p style={{fontSize:10.5,color:doc.note.includes("Verificado")?C.green:C.blue,marginTop:2,fontStyle:"italic"}}>{doc.note}</p>}
                </div>
                {(doc.status==="pending"||doc.status==="partial")&&<button onClick={()=>setExpDoc(isE?null:doc.id)} style={{padding:"7px 14px",borderRadius:8,fontSize:11,fontWeight:600,background:isE?C.sidebar:`linear-gradient(135deg,${C.primary},${C.violet})`,color:"#fff",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>{isE?<X size={11}/>:<Upload size={11}/>}{isE?"Cerrar":"Subir"}</button>}
              </div>
              {isE&&(doc.status==="pending"||doc.status==="partial")&&<div style={{padding:"12px 16px",background:C.bg,animation:"fadeIn .2s ease"}}>
                {hasKB && <div style={{padding:"8px 10px",background:`rgba(91,191,160,.08)`,borderRadius:6,marginBottom:10,fontSize:11,color:C.text,display:"flex",gap:6,alignItems:"flex-start"}}><Sparkles size={12} color={C.teal} style={{flexShrink:0,marginTop:1}}/><span>💡 <strong>{KB[doc.id].whereToGet}</strong></span></div>}
                <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                  {[{icon:Paperclip,label:"Adjuntar",sub:"PDF, Word, Excel",c:C.primary,fn:()=>fRef.current?.click()},{icon:Camera,label:"Foto",sub:"Cámara",c:C.teal,fn:()=>{fRef.current?.setAttribute("capture","environment");fRef.current?.click();}},{icon:ScanLine,label:"Escanear",sub:"CamScanner",c:C.violet,fn:()=>{onScan(doc.id);setExpDoc(null);}}].map((o,i)=><button key={i} onClick={o.fn} style={{flex:1,minWidth:100,display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"12px 8px",borderRadius:10,background:C.card,border:`1.5px dashed ${C.border}`,color:C.text,transition:".2s"}}><o.icon size={16} color={o.c}/><span style={{fontSize:11,fontWeight:500}}>{o.label}</span><span style={{fontSize:9.5,color:C.textMuted}}>{o.sub}</span></button>)}
                </div>
              </div>}
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
      <div style={{flex:1,minWidth:160}}><p style={{fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:".04em"}}>Expediente</p><p style={{fontSize:14,fontWeight:600}}>Exp. {user.caseId}</p><p style={{fontSize:11,color:C.textMuted,marginTop:2}}>{caseLabel}</p></div>
      <div style={{flex:1,minWidth:160}}><p style={{fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:".04em"}}>Letrado</p><p style={{fontSize:14,fontWeight:600}}>{user.lawyer}</p></div>
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
  const data = PAYMENTS[user.caseType];
  if(!data) return <div>No hay datos de pagos</div>;

  const paid = data.payments.filter(p=>p.status==="paid");
  const pending = data.payments.filter(p=>p.status!=="paid");
  const upcoming = data.payments.find(p=>p.status==="upcoming");
  const totalPaid = paid.reduce((a,p)=>a+p.amount,0);
  const totalPending = pending.reduce((a,p)=>a+p.amount,0);
  const pct = Math.round(totalPaid/data.totalContracted*100);
  const method = methodInfo[data.method];
  const MethodIcon = method.icon;
  const [copied, setCopied] = useState(false);

  function copyIban(iban){
    navigator.clipboard.writeText(iban.replace(/\s/g,""));
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
        <p style={{fontSize:32,fontWeight:700,lineHeight:1.1}}>{fmtMoney(data.totalContracted)}</p>
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
          <div><p style={{fontSize:10.5,opacity:.7,fontWeight:500}}>{paid.length}/{data.payments.length} CUOTAS</p><p style={{fontSize:18,fontWeight:700,marginTop:2}}>{pending.length} restantes</p></div>
        </div>
      </div>
    </div>

    {/* Próximo pago - alerta destacada */}
    {upcoming && (() => {
      const days = daysUntil(upcoming.date);
      const isTransfer = data.method === "transfer";
      const urgent = days <= 3;
      const evDate = new Date(upcoming.date);
      return (
        <div style={{background:urgent?C.orangeSoft:C.tealSoft,border:`1.5px solid ${urgent?C.orange:C.teal}40`,borderRadius:14,padding:"18px 22px",marginBottom:16,position:"relative",overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap"}}>
            <div style={{width:42,height:42,borderRadius:10,background:urgent?C.orange:C.teal,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {isTransfer ? <ArrowRightCircle size={20} color="#fff"/> : <Banknote size={20} color="#fff"/>}
            </div>
            <div style={{flex:1,minWidth:200}}>
              <p style={{fontSize:11,fontWeight:600,color:urgent?C.orange:C.teal,textTransform:"uppercase",letterSpacing:".05em"}}>
                {isTransfer ? "Próxima transferencia" : "Próximo cargo automático"}
              </p>
              <p style={{fontSize:18,fontWeight:700,marginTop:4}}>{fmtMoney(upcoming.amount)} <span style={{fontSize:13,fontWeight:500,color:C.textMuted}}>· {upcoming.concept}</span></p>
              <p style={{fontSize:13,color:C.text,marginTop:6,lineHeight:1.5}}>
                {firstName}, {isTransfer ? "tienes que realizar la" : "se realizará el"} cargo el <strong>{evDate.toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})}</strong>
                {days >= 0 && (days===0?" — HOY":days===1?" — mañana":` (en ${days} días)`)}
              </p>
              {!isTransfer ? (
                <p style={{fontSize:12,color:C.textMuted,marginTop:8,padding:"8px 12px",background:"rgba(255,255,255,.6)",borderRadius:8}}>
                  💡 Asegúrate de tener saldo suficiente en tu cuenta <strong>{data.iban}</strong>. Si tienes dudas, contacta con tu letrado.
                </p>
              ) : (
                <div style={{marginTop:10,padding:"12px 14px",background:"rgba(255,255,255,.7)",borderRadius:10,fontSize:12,lineHeight:1.7}}>
                  <p style={{fontWeight:600,marginBottom:6,fontSize:11,textTransform:"uppercase",letterSpacing:".05em",color:C.textMuted}}>Datos para la transferencia</p>
                  <p><strong>Beneficiario:</strong> {data.beneficiary}</p>
                  <p><strong>IBAN:</strong> <code style={{background:C.bg,padding:"2px 6px",borderRadius:4,fontFamily:"monospace",fontSize:12}}>{data.iban}</code> <button onClick={()=>copyIban(data.iban)} style={{background:"none",color:C.primary,fontSize:11,fontWeight:600,marginLeft:6,display:"inline-flex",alignItems:"center",gap:3}}><Copy size={11}/>{copied?"¡Copiado!":"Copiar"}</button></p>
                  <p><strong>Concepto:</strong> {data.paymentConcept}</p>
                  <p><strong>Importe:</strong> {fmtMoney(upcoming.amount)}</p>
                </div>
              )}
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
        <p style={{fontSize:12,color:C.textMuted,marginTop:2}}>{method.desc} · {data.iban}</p>
      </div>
      <button style={{padding:"8px 14px",borderRadius:8,fontSize:12,fontWeight:500,background:C.bg,color:C.text,border:`1px solid ${C.border}`}}>Cambiar</button>
    </div>

    {/* Historial de pagos */}
    <div style={{background:C.card,borderRadius:14,padding:"20px 22px",border:`1px solid ${C.border}`}}>
      <h3 style={{fontSize:15,fontWeight:600,marginBottom:14}}>Historial de pagos</h3>
      <div>
        {data.payments.map((p,i)=>{
          const s = getPayStatus(p.status);
          const Icon = s.i;
          const days = p.status==="upcoming"?daysUntil(p.date):null;
          return (
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderBottom:i<data.payments.length-1?`1px solid ${C.bg}`:"none"}}>
              <div style={{width:36,height:36,borderRadius:9,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Icon size={17} color={s.c}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <p style={{fontSize:13,fontWeight:600}}>{p.concept}</p>
                  <span style={{fontSize:10,fontWeight:600,color:s.c,background:s.bg,padding:"2px 7px",borderRadius:4}}>{s.l}</span>
                </div>
                <p style={{fontSize:11.5,color:C.textMuted,marginTop:3}}>
                  {new Date(p.date).toLocaleDateString("es-ES",{day:"numeric",month:"short",year:"numeric"})}
                  {p.invoice && ` · Factura ${p.invoice}`}
                  {days !== null && days >= 0 && ` · ${days===0?"Hoy":days===1?"Mañana":`En ${days} días`}`}
                </p>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <p style={{fontSize:14,fontWeight:700}}>{fmtMoney(p.amount)}</p>
                {p.invoice && <button style={{fontSize:11,color:C.primary,background:"none",fontWeight:500,marginTop:3,display:"flex",alignItems:"center",gap:3}}><Download size={11}/> Factura</button>}
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
  </div>);
}

// ════ CHAT ════
function Chat({messages,setMessages,docs,user,caseLabel}){
  const[input,setInput]=useState("");const[ld,setLd]=useState(false);const endRef=useRef(null);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  const payData = PAYMENTS[user.caseType];
  const payCtx = payData ? `\nPAGOS:\nTotal contratado: ${fmtMoney(payData.totalContracted)}, Pagados: ${payData.payments.filter(p=>p.status==="paid").length}/${payData.payments.length}, Método: ${methodInfo[payData.method].label}, Próximo pago: ${(()=>{const u=payData.payments.find(p=>p.status==="upcoming");return u?`${fmtMoney(u.amount)} el ${u.date}`:"ninguno"})()}`:"";
  const docCtx=docs.map(d=>`- [${d.status==="pending"?"PENDIENTE":d.status==="uploaded"?"VERIFICADO":"EN REVISIÓN"}] ${d.name} (${d.cat})${d.warn?` ⚠ ${d.warn}`:""}${!d.required?" [opcional]":""}`).join("\n");
  async function send(){
    if(!input.trim()||ld)return;const msg=input.trim();setInput("");setMessages(p=>[...p,{role:"user",content:msg}]);setLd(true);
    try{const sys=`Eres el asistente documental de LibreApp. Cliente: ${user.name} | Exp: ${user.caseId} | Procedimiento: ${caseLabel} | Letrado: ${user.lawyer}\nDOCUMENTACIÓN:\n${docCtx}\nAyuda con documentos, sedes electrónicas (AEAT, TGSS, CIRBE, empadronamiento, antecedentes penales). Español de España, cercano, tutea, mensajes concisos.`;
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:sys,messages:[...messages.slice(-10),{role:"user",content:msg}].map(m=>({role:m.role,content:m.content}))})});
      const data=await res.json();const reply=data.content?.map(b=>b.text||"").join("")||"Error, ¿puedes repetir?";
      setMessages(p=>[...p,{role:"assistant",content:reply}]);
    }catch{setMessages(p=>[...p,{role:"assistant",content:"Error de conexión."}]);}setLd(false);}

  const qQ=user.caseType==="concurso"?["¿Qué me falta?","¿Cómo consigo el CIRBE?","¿Formato Lexnet?","¿Plazo?"]:["¿Qué me falta?","¿Dónde saco empadronamiento?","¿Antecedentes penales?","¿Mi próximo plazo?"];

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
