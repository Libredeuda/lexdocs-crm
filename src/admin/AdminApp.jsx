import { useState, useEffect } from "react";
import { LayoutDashboard, FolderKanban, LogOut, Menu, X, Bell, Users, Kanban, Settings, Building2, UserCog, Code, GitBranch } from "lucide-react";
import { LOGO, font, C } from "../constants";
import { supabase } from '../lib/supabase';
import AdminDashboard from "./AdminDashboard";
import AdminCaseList from "./AdminCaseList";
import ContactList from "./contacts/ContactList";
import ContactPipeline from "./contacts/ContactPipeline";
import ContactDetail from "./contacts/ContactDetail";
import OrgSettings from "./settings/OrgSettings";
import TeamMembers from "./settings/TeamMembers";
import ApiKeys from "./settings/ApiKeys";
import PipelineSettings from "./settings/PipelineSettings";

export default function AdminApp({ user, onLogout }) {
  const [page, setPage] = useState("dashboard");
  const [settingsTab, setSettingsTab] = useState("org");
  const [mobMenu, setMobMenu] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);

  const [cases, setCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(true);

  useEffect(() => {
    async function loadCases() {
      const { data: casesData } = await supabase
        .from('cases')
        .select('*, contact:contacts(first_name, last_name, email, company), lawyer:users!cases_assigned_lawyer_id_fkey(full_name)');

      // Also get document stats and payment stats
      const { data: docs } = await supabase.from('documents').select('case_id, status');
      const { data: payments } = await supabase.from('payments').select('case_id, status, amount, due_date');
      const { data: events } = await supabase.from('events').select('*');

      const enrichedCases = (casesData || []).map(c => {
        const caseDocs = (docs || []).filter(d => d.case_id === c.id);
        const casePayments = (payments || []).filter(p => p.case_id === c.id);
        const caseEvents = (events || []).filter(e => e.case_id === c.id);
        return {
          ...c,
          client: {
            name: c.contact ? `${c.contact.first_name} ${c.contact.last_name}` : 'Sin contacto',
            email: c.contact?.email,
            caseType: c.case_type,
            caseId: c.case_number,
            lawyer: c.lawyer?.full_name || 'Sin asignar',
            company: c.contact?.company,
          },
          docs: caseDocs,
          events: caseEvents,
          payments: { payments: casePayments },
          progress: c.progress,
          phase: c.phase === 'document_collection' ? 'Recogida documental' : c.phase === 'lawyer_review' ? 'Revision letrada' : c.phase,
          pendingDocs: caseDocs.filter(d => d.status === 'pending').length,
          docsInReview: caseDocs.filter(d => d.status === 'review').length,
          totalDocs: caseDocs.length,
          nextPayment: casePayments.find(p => p.status === 'upcoming') || null,
          lastActivity: c.updated_at,
        };
      });
      setCases(enrichedCases);
      setCasesLoading(false);
    }
    loadCases();
  }, []);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "cases", label: "Expedientes", icon: FolderKanban },
    { id: "contacts", label: "Contactos", icon: Users },
    { id: "pipeline", label: "Pipeline", icon: Kanban },
  ];

  const settingsItem = { id: "settings", label: "Configuracion", icon: Settings };

  const settingsTabs = [
    { id: "org", label: "Despacho", icon: Building2 },
    { id: "team", label: "Equipo", icon: UserCog },
    { id: "apikeys", label: "API Keys", icon: Code },
    { id: "pipeline-cfg", label: "Pipeline", icon: GitBranch },
  ];

  const pageTitle = {
    dashboard: "Dashboard",
    cases: "Expedientes",
    contacts: "Contactos",
    pipeline: "Pipeline",
    settings: "Configuracion",
    "contact-detail": "Detalle de contacto",
  };

  const handleNav = (id) => {
    setPage(id);
    if (id === "settings") setSettingsTab("org");
  };

  const renderNavButton = (it, isActive, onClick) => (
    <button key={it.id} onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 13px",
      borderRadius: 10, marginBottom: 3,
      background: isActive ? `linear-gradient(135deg,${C.primary}20,${C.violet}15)` : "transparent",
      color: isActive ? "#fff" : "rgba(255,255,255,.5)", fontSize: 13,
      fontWeight: isActive ? 600 : 400, transition: ".2s", textAlign: "left", position: "relative"
    }}>
      {isActive && <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 18, borderRadius: 2, background: `linear-gradient(to bottom,${C.primary},${C.violet})` }} />}
      <it.icon size={17} /><span>{it.label}</span>
    </button>
  );

  // Placeholder components for pages not yet built
  const PlaceholderPage = ({ title }) => (
    <div style={{
      background: C.white, borderRadius: 14, border: `1px solid ${C.border}`,
      padding: "48px 32px", textAlign: "center",
    }}>
      <p style={{ fontSize: 14, color: C.textMuted }}>Pagina <strong>{title}</strong> - Proximamente</p>
    </div>
  );

  return (
    <div style={{ fontFamily: font, background: C.bg, minHeight: "100vh", display: "flex", color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes slideIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}button{cursor:pointer;border:none;font-family:${font}}@media(max-width:768px){.dsk{display:none!important}.mh{display:flex!important}.mc{margin-left:0!important;padding:14px!important;padding-top:68px!important}}@media(min-width:769px){.mh{display:none!important}.mo{display:none!important}}`}</style>

      {/* Desktop sidebar */}
      <aside className="dsk" style={{ width: 260, background: C.sidebar, position: "fixed", top: 0, left: 0, bottom: 0, display: "flex", flexDirection: "column", zIndex: 50 }}>
        <div style={{ padding: "22px 20px 16px", borderBottom: `1px solid ${C.sidebarMid}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <img src={LOGO} alt="LibreDeuda" style={{ width: 34, height: 34, borderRadius: 8 }} />
            <div>
              <span style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>LibreDeuda</span>
              <p style={{ fontSize: 9.5, color: C.primaryLight, fontWeight: 600 }}>Admin</p>
            </div>
          </div>
          <div style={{ padding: "8px 10px", background: C.sidebarLight, borderRadius: 8, borderLeft: `3px solid ${C.teal}` }}>
            <p style={{ fontSize: 10.5, color: C.tealLight, fontWeight: 600 }}>Panel de gestion</p>
            <p style={{ fontSize: 9.5, color: C.textLight, marginTop: 1 }}>{casesLoading ? '...' : cases.length} expedientes activos</p>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "14px 10px", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1 }}>
            {navItems.map(it => renderNavButton(it, page === it.id, () => handleNav(it.id)))}

            {/* Separator */}
            <div style={{ height: 1, background: C.sidebarMid, margin: "10px 13px" }} />

            {/* Settings */}
            {renderNavButton(settingsItem, page === "settings", () => handleNav("settings"))}
          </div>
        </nav>
        <div style={{ padding: "14px 14px 18px", borderTop: `1px solid ${C.sidebarMid}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.sidebarLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.primaryLight }}>{(user.full_name || user.name || 'A').charAt(0)}</span>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{user.full_name || user.name || 'Admin'}</p>
              <p style={{ fontSize: 9.5, color: C.textLight }}>Administrador</p>
            </div>
          </div>
          <button onClick={onLogout} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 7, borderRadius: 7, background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.4)", fontSize: 11 }}>
            <LogOut size={12} /> Cerrar sesion
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="mh" style={{ position: "fixed", top: 0, left: 0, right: 0, height: 56, background: C.sidebar, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", zIndex: 100 }}>
        <button onClick={() => setMobMenu(true)} style={{ background: "none", color: "#fff" }}><Menu size={22} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <img src={LOGO} alt="" style={{ width: 24, height: 24, borderRadius: 5 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Admin</span>
        </div>
        <div style={{ width: 22 }} />
      </header>

      {/* Mobile menu overlay */}
      {mobMenu && (
        <div className="mo" style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
          <div onClick={() => setMobMenu(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)" }} />
          <div style={{ position: "relative", width: 260, background: C.sidebar, height: "100%", display: "flex", flexDirection: "column", animation: "slideIn .25s ease" }}>
            <div style={{ padding: 18, borderBottom: `1px solid ${C.sidebarMid}`, display: "flex", alignItems: "center", gap: 8 }}>
              <img src={LOGO} alt="" style={{ width: 22, height: 22, borderRadius: 4 }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Admin</span>
            </div>
            <nav style={{ flex: 1, padding: 9 }}>
              {navItems.map(i => (
                <button key={i.id} onClick={() => { handleNav(i.id); setMobMenu(false); }} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 8, marginBottom: 2,
                  background: page === i.id ? C.sidebarLight : "transparent",
                  color: page === i.id ? "#fff" : "rgba(255,255,255,.5)", fontSize: 13.5, textAlign: "left"
                }}><i.icon size={16} />{i.label}</button>
              ))}
              <div style={{ height: 1, background: C.sidebarMid, margin: "8px 12px" }} />
              <button onClick={() => { handleNav("settings"); setMobMenu(false); }} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                borderRadius: 8, marginBottom: 2,
                background: page === "settings" ? C.sidebarLight : "transparent",
                color: page === "settings" ? "#fff" : "rgba(255,255,255,.5)", fontSize: 13.5, textAlign: "left"
              }}><Settings size={16} />Configuracion</button>
            </nav>
            <div style={{ padding: 12, borderTop: `1px solid ${C.sidebarMid}` }}>
              <button onClick={() => { onLogout(); setMobMenu(false); }} style={{ width: "100%", padding: 8, borderRadius: 6, background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.4)", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <LogOut size={12} />Cerrar sesion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="mc" style={{ marginLeft: 260, flex: 1, padding: "24px 30px", minHeight: "100vh" }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em" }}>{pageTitle[page] || "LexDocs"}</h1>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>Panel de administracion · {casesLoading ? '...' : cases.length} expedientes</p>
        </div>

        {/* Settings sub-nav */}
        {page === "settings" && (
          <div style={{
            display: "flex", gap: 4, marginBottom: 22,
            background: C.white, borderRadius: 12,
            border: `1px solid ${C.border}`, padding: 4,
            overflowX: "auto",
          }}>
            {settingsTabs.map((tab) => {
              const active = settingsTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSettingsTab(tab.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "9px 18px", borderRadius: 9,
                    background: active ? `linear-gradient(135deg, ${C.primary}12, ${C.violet}08)` : "transparent",
                    color: active ? C.primary : C.textMuted,
                    fontSize: 12.5, fontWeight: active ? 600 : 400,
                    transition: ".2s", whiteSpace: "nowrap",
                    border: active ? `1px solid ${C.primary}20` : "1px solid transparent",
                  }}
                >
                  <tab.icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="fade-in" key={page === "settings" ? `settings-${settingsTab}` : page}>
          {page === "dashboard" && <AdminDashboard cases={cases} setPage={setPage} />}
          {page === "cases" && <AdminCaseList cases={cases} />}
          {page === "contacts" && <ContactList setPage={setPage} setSelectedContact={setSelectedContact} />}
          {page === "pipeline" && <ContactPipeline setPage={setPage} setSelectedContact={setSelectedContact} />}
          {page === "contact-detail" && selectedContact && (
            <ContactDetail
              contact={selectedContact}
              setPage={setPage}
              setSelectedContact={setSelectedContact}
            />
          )}
          {page === "settings" && settingsTab === "org" && <OrgSettings />}
          {page === "settings" && settingsTab === "team" && <TeamMembers />}
          {page === "settings" && settingsTab === "apikeys" && <ApiKeys />}
          {page === "settings" && settingsTab === "pipeline-cfg" && <PipelineSettings />}
        </div>
      </main>
    </div>
  );
}
