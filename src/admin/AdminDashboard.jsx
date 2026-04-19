import { useState, useEffect } from "react";
import {
  Briefcase, FileSearch, Wallet, CheckCircle, AlertCircle, Clock, FileText,
  ChevronRight, TrendingUp, Calendar, MessageSquare, Users, Target, Award,
  BarChart3, Plus, Sparkles, ArrowUp, ArrowDown
} from "lucide-react";
import { C, font } from "../constants";
import { fmtMoney, daysUntil } from "../utils";
import { supabase } from "../lib/supabase";

export default function AdminDashboard({ cases, setPage, user }) {
  const [tab, setTab] = useState("today");
  const [todayData, setTodayData] = useState({ tasks: [], unreadMessages: 0, riskCases: [], pendingDocs: [], upcomingPayments: [] });
  const [metricsData, setMetricsData] = useState({ revenue: { current: 0, projected: 0 }, conversion: 0, byMonth: [], slaAvg: 0 });
  const [teamData, setTeamData] = useState([]);
  const [loading, setLoading] = useState(true);

  // KPIs estáticos calculados de cases (siempre visibles arriba)
  const totalCases = cases.length;
  const docsInReview = cases.reduce((a, c) => a + c.docsInReview, 0);
  const upcomingPaymentsCount = cases.reduce((a, c) => {
    const up = c.payments?.payments?.filter(p => p.status === "upcoming") || [];
    return a + up.length;
  }, 0);
  const completedCases = cases.filter(c => c.progress >= 100).length;
  const avgProgress = cases.length ? Math.round(cases.reduce((a, c) => a + c.progress, 0) / cases.length) : 0;

  // Phase distribution para donut
  const phases = {};
  cases.forEach(c => { phases[c.phase] = (phases[c.phase] || 0) + 1; });
  const phaseColors = { "Recogida documental": C.primary, "Revisión letrada": C.teal, "Redacción demanda": C.violet, "Presentado en juzgado": C.orange, "Vista oral": C.blue, "Cerrado": C.green };

  useEffect(() => {
    loadAllTabData();
  }, [user?.org_id]);

  async function loadAllTabData() {
    if (!user?.org_id) { setLoading(false); return; }
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      // Tab Hoy: tareas del día asignadas al usuario
      const { data: myTasks } = await supabase
        .from("events")
        .select("id, title, event_date, event_time, event_type, priority, is_completed, case:cases(case_number)")
        .eq("org_id", user.org_id)
        .eq("event_date", today)
        .eq("is_completed", false)
        .or(`assigned_to.eq.${user.id},assigned_to.is.null`)
        .order("event_time", { ascending: true });

      // Mensajes sin leer del cliente al equipo
      const { data: msgs } = await supabase
        .from("messages")
        .select("id")
        .eq("org_id", user.org_id)
        .not("from_contact_id", "is", null)
        .eq("is_read", false);

      // Casos en riesgo (sin movimiento >7 días)
      const { data: stale } = await supabase
        .from("cases")
        .select("id, case_number, updated_at, contact:contacts(first_name, last_name)")
        .eq("org_id", user.org_id)
        .eq("status", "active")
        .lt("updated_at", weekAgo)
        .limit(5);

      // Pagos vencidos / esta semana
      const weekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      const { data: pays } = await supabase
        .from("payments")
        .select("id, amount, due_date, concept, status, case:cases(case_number, contact:contacts(first_name, last_name))")
        .eq("org_id", user.org_id)
        .in("status", ["upcoming", "pending"])
        .lte("due_date", weekFromNow)
        .order("due_date", { ascending: true })
        .limit(5);

      setTodayData({
        tasks: myTasks || [],
        unreadMessages: msgs?.length || 0,
        riskCases: stale || [],
        pendingDocs: cases.filter(c => c.docsInReview > 0).slice(0, 5),
        upcomingPayments: pays || [],
      });

      // Tab Métricas: ingresos del mes, MRR, conversión
      const { data: paidThisMonth } = await supabase
        .from("payments")
        .select("amount")
        .eq("org_id", user.org_id)
        .eq("status", "paid")
        .gte("paid_at", monthStart);
      const revenueMonth = (paidThisMonth || []).reduce((a, p) => a + parseFloat(p.amount || 0), 0);

      const { data: pendingAll } = await supabase
        .from("payments")
        .select("amount")
        .eq("org_id", user.org_id)
        .in("status", ["upcoming", "pending"]);
      const projected = (pendingAll || []).reduce((a, p) => a + parseFloat(p.amount || 0), 0);

      // Conversión: contacts con status=client / total contacts (últimos 90 días)
      const ninetyAgo = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data: contactsLast } = await supabase
        .from("contacts")
        .select("status")
        .eq("org_id", user.org_id)
        .gte("created_at", ninetyAgo);
      const totalContacts = contactsLast?.length || 0;
      const becameClients = (contactsLast || []).filter(c => c.status === "client").length;
      const conversionRate = totalContacts > 0 ? Math.round((becameClients / totalContacts) * 100) : 0;

      // Ingresos por mes últimos 6 meses (simplificado)
      const byMonth = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString();
        const { data } = await supabase
          .from("payments")
          .select("amount")
          .eq("org_id", user.org_id)
          .eq("status", "paid")
          .gte("paid_at", start)
          .lte("paid_at", end);
        const total = (data || []).reduce((a, p) => a + parseFloat(p.amount || 0), 0);
        byMonth.push({ label: d.toLocaleDateString("es-ES", { month: "short" }), value: total });
      }

      setMetricsData({
        revenue: { current: revenueMonth, projected },
        conversion: conversionRate,
        byMonth,
        slaAvg: 12, // placeholder, se calcula con phase_changed_at en producción
      });

      // Tab Equipo: ranking de letrados
      const { data: team } = await supabase
        .from("users")
        .select("id, full_name, role, professional_title")
        .eq("org_id", user.org_id)
        .in("role", ["lawyer", "procurador", "admin", "owner"])
        .eq("is_active", true);

      const teamStats = await Promise.all((team || []).map(async (m) => {
        const myCases = cases.filter(c => c.assigned_lawyer_id === m.id);
        const { data: myDocsApproved } = await supabase
          .from("documents")
          .select("id")
          .eq("org_id", user.org_id)
          .eq("reviewed_by", m.id)
          .eq("status", "approved");
        const { data: myMessages } = await supabase
          .from("messages")
          .select("id")
          .eq("org_id", user.org_id)
          .eq("from_user_id", m.id);
        const { data: myPendingTasks } = await supabase
          .from("events")
          .select("id")
          .eq("org_id", user.org_id)
          .eq("assigned_to", m.id)
          .eq("is_completed", false);
        const avg = myCases.length ? Math.round(myCases.reduce((a, c) => a + c.progress, 0) / myCases.length) : 0;
        return {
          ...m,
          activeCases: myCases.length,
          completedCases: myCases.filter(c => c.progress >= 100).length,
          docsApproved: myDocsApproved?.length || 0,
          messagesAnswered: myMessages?.length || 0,
          pendingTasks: myPendingTasks?.length || 0,
          avgProgress: avg,
        };
      }));
      setTeamData(teamStats.sort((a, b) => b.activeCases - a.activeCases));
    } catch (e) {
      console.error("Dashboard load error:", e);
    }
    setLoading(false);
  }

  // ─────────────── KPI HEADER (siempre visible) ───────────────
  const kpis = [
    { label: "Casos activos", value: totalCases, icon: Briefcase, color: C.primary, bg: `rgba(91,107,240,0.08)` },
    { label: "Docs en revisión", value: docsInReview, icon: FileSearch, color: C.orange, bg: `rgba(245,158,11,0.08)` },
    { label: "Pagos pendientes", value: upcomingPaymentsCount, icon: Wallet, color: C.teal, bg: `rgba(91,191,160,0.08)` },
    { label: "Casos al 100%", value: completedCases, icon: CheckCircle, color: C.green, bg: `rgba(34,197,94,0.08)` },
  ];

  return (
    <div>
      {/* KPI cards (siempre visibles) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14, marginBottom: 22 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: C.card, borderRadius: 14, padding: "20px 22px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <k.icon size={22} color={k.color} />
            </div>
            <div>
              <p style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{k.value}</p>
              <p style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
        {[
          { id: "today", l: "Hoy", icon: Target },
          { id: "metrics", l: "Métricas", icon: BarChart3 },
          { id: "team", l: "Equipo", icon: Users },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "10px 18px",
              background: "transparent",
              border: "none",
              borderBottom: tab === t.id ? `2px solid ${C.primary}` : "2px solid transparent",
              color: tab === t.id ? C.primary : C.textMuted,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: font,
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: -1,
            }}
          >
            <t.icon size={14} /> {t.l}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "today" && <TabToday data={todayData} setPage={setPage} loading={loading} />}
      {tab === "metrics" && <TabMetrics data={metricsData} cases={cases} avgProgress={avgProgress} phases={phases} phaseColors={phaseColors} loading={loading} />}
      {tab === "team" && <TabTeam team={teamData} loading={loading} />}
    </div>
  );
}

// ════════════ TAB HOY ════════════
function TabToday({ data, setPage, loading }) {
  if (loading) return <Loader />;
  return (
    <div>
      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <button onClick={() => setPage && setPage("agenda")} style={qaBtn(C.primary, C.violet)}>
          <Plus size={14} /> Nueva tarea
        </button>
        <button onClick={() => setPage && setPage("contacts")} style={qaBtn(C.teal, C.green)}>
          <Plus size={14} /> Nuevo contacto
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {/* Tareas hoy */}
        <Card icon={Calendar} color={C.primary} title="Mis tareas de hoy" emptyText="Sin tareas para hoy 🎉">
          {data.tasks.map(t => (
            <Item
              key={t.id}
              title={t.title}
              subtitle={`${t.event_time?.slice(0, 5) || ""} ${t.case?.case_number ? "· Exp. " + t.case.case_number : ""}`}
              badge={t.priority !== "normal" ? { label: t.priority, color: t.priority === "urgent" ? C.red : t.priority === "high" ? C.orange : C.textMuted } : null}
            />
          ))}
        </Card>

        {/* Casos en riesgo */}
        <Card icon={AlertCircle} color={C.red} title="Casos en riesgo (sin movimiento >7 días)" emptyText="Todo al día ✅">
          {data.riskCases.map(c => (
            <Item
              key={c.id}
              title={c.case_number || "Sin número"}
              subtitle={c.contact ? `${c.contact.first_name} ${c.contact.last_name || ""}` : ""}
              right={<span style={{ fontSize: 10.5, color: C.red, fontWeight: 700 }}>{Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000)}d sin actividad</span>}
            />
          ))}
        </Card>

        {/* Mensajes sin responder */}
        <Card icon={MessageSquare} color={C.teal} title="Mensajes de cliente">
          <div style={{ padding: "12px 0", textAlign: "center" }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: data.unreadMessages > 0 ? C.teal : C.textMuted }}>{data.unreadMessages}</p>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{data.unreadMessages === 0 ? "Sin mensajes nuevos" : data.unreadMessages === 1 ? "mensaje sin responder" : "mensajes sin responder"}</p>
          </div>
        </Card>

        {/* Docs pendientes */}
        <Card icon={FileText} color={C.orange} title="Casos con docs pendientes" emptyText="Sin documentos por revisar">
          {data.pendingDocs.map(c => (
            <Item
              key={c.id}
              title={c.client?.name || "Cliente"}
              subtitle={`${c.docsInReview} doc${c.docsInReview > 1 ? "s" : ""} esperando · Exp. ${c.client?.caseId}`}
            />
          ))}
        </Card>

        {/* Pagos próximos */}
        <Card icon={Wallet} color={C.violet} title="Pagos esta semana" emptyText="Sin pagos próximos">
          {data.upcomingPayments.map(p => {
            const days = daysUntil(p.due_date);
            return (
              <Item
                key={p.id}
                title={`${fmtMoney(parseFloat(p.amount || 0))} · ${p.concept || ""}`}
                subtitle={`${p.case?.contact ? p.case.contact.first_name + " · " : ""}${days <= 0 ? "Vence hoy" : days === 1 ? "Mañana" : "En " + days + " días"}`}
                badge={days <= 0 ? { label: "Vencido", color: C.red } : days <= 3 ? { label: "Urgente", color: C.orange } : null}
              />
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ════════════ TAB MÉTRICAS ════════════
function TabMetrics({ data, cases, avgProgress, phases, phaseColors, loading }) {
  if (loading) return <Loader />;
  const totalCases = cases.length;
  const closedCases = cases.filter(c => c.phase === "closed" || c.phase === "Cerrado").length;
  const closeRate = totalCases > 0 ? Math.round((closedCases / totalCases) * 100) : 0;
  const maxRevenue = Math.max(...data.byMonth.map(m => m.value), 1);

  return (
    <div>
      {/* Top metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 22 }}>
        <BigMetric icon={TrendingUp} color={C.green} label="Ingresos del mes" value={fmtMoney(data.revenue.current)} sub="cobrado este mes" />
        <BigMetric icon={Target} color={C.primary} label="Por cobrar" value={fmtMoney(data.revenue.projected)} sub="MRR proyectado" />
        <BigMetric icon={Award} color={C.violet} label="Conversión leads → cliente" value={`${data.conversion}%`} sub="últimos 90 días" />
        <BigMetric icon={CheckCircle} color={C.teal} label="Tasa cierre" value={`${closeRate}%`} sub={`${closedCases}/${totalCases} cerrados`} />
      </div>

      {/* Ingresos chart */}
      <div style={{ background: C.card, borderRadius: 14, padding: "20px 22px", border: `1px solid ${C.border}`, marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Ingresos últimos 6 meses</h3>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 180, paddingTop: 20 }}>
          {data.byMonth.map((m, i) => {
            const heightPct = maxRevenue > 0 ? (m.value / maxRevenue) * 100 : 0;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", width: "100%", maxWidth: 60 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: C.text, textAlign: "center", marginBottom: 4 }}>{m.value > 0 ? fmtMoney(m.value).replace(",00€", "€") : ""}</p>
                  <div style={{ width: "100%", background: `linear-gradient(180deg, ${C.primary}, ${C.violet})`, borderRadius: "6px 6px 0 0", height: `${heightPct}%`, minHeight: m.value > 0 ? 4 : 0, transition: "height .8s" }} />
                </div>
                <p style={{ fontSize: 10.5, color: C.textMuted, marginTop: 6, textTransform: "uppercase", fontWeight: 600 }}>{m.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Distribución por fase */}
      <div style={{ background: C.card, borderRadius: 14, padding: "20px 22px", border: `1px solid ${C.border}`, marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Casos por fase</h3>
        {Object.entries(phases).map(([phase, count]) => {
          const pct = totalCases > 0 ? (count / totalCases) * 100 : 0;
          return (
            <div key={phase} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{phase}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: C.textMuted }}>{count} ({Math.round(pct)}%)</span>
              </div>
              <div style={{ height: 8, background: C.bg, borderRadius: 4 }}>
                <div style={{ height: "100%", width: `${pct}%`, background: phaseColors[phase] || C.textMuted, borderRadius: 4 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* SLA promedio */}
      <div style={{ background: C.card, borderRadius: 14, padding: "20px 22px", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 50, height: 50, borderRadius: 12, background: `${C.blue}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Clock size={22} color={C.blue} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600 }}>Tiempo medio por fase</p>
          <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>SLA promedio del despacho</p>
        </div>
        <p style={{ fontSize: 24, fontWeight: 700, color: C.blue }}>{data.slaAvg} <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>días</span></p>
      </div>
    </div>
  );
}

// ════════════ TAB EQUIPO ════════════
function TabTeam({ team, loading }) {
  if (loading) return <Loader />;
  if (team.length === 0) {
    return (
      <div style={{ background: C.card, borderRadius: 14, padding: 40, textAlign: "center", border: `1px solid ${C.border}` }}>
        <Users size={32} style={{ opacity: 0.4, marginBottom: 8, color: C.textMuted }} />
        <p style={{ fontSize: 13, color: C.textMuted }}>No hay miembros del equipo todavía</p>
      </div>
    );
  }
  return (
    <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 100px 100px 100px 100px 100px", gap: 8, padding: "14px 22px", background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 10.5, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", minWidth: 720 }}>
        <span>Miembro</span>
        <span style={{ textAlign: "right" }}>Casos activos</span>
        <span style={{ textAlign: "right" }}>Cerrados</span>
        <span style={{ textAlign: "right" }}>Docs aprob.</span>
        <span style={{ textAlign: "right" }}>Mensajes</span>
        <span style={{ textAlign: "right" }}>Tareas pend.</span>
      </div>
      {team.map((m, i) => (
        <div key={m.id} style={{ display: "grid", gridTemplateColumns: "2fr 100px 100px 100px 100px 100px", gap: 8, padding: "16px 22px", borderBottom: i < team.length - 1 ? `1px solid ${C.bg}` : "none", alignItems: "center", minWidth: 720 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff", fontSize: 13, fontWeight: 700 }}>
              {m.full_name?.split(" ").map(n => n[0]).slice(0, 2).join("") || "?"}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{m.full_name}</p>
              <p style={{ fontSize: 10.5, color: C.textMuted }}>{m.professional_title || m.role} · Progreso medio {m.avgProgress}%</p>
            </div>
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, textAlign: "right", color: m.activeCases > 0 ? C.primary : C.textMuted }}>{m.activeCases}</p>
          <p style={{ fontSize: 14, fontWeight: 700, textAlign: "right", color: m.completedCases > 0 ? C.green : C.textMuted }}>{m.completedCases}</p>
          <p style={{ fontSize: 14, fontWeight: 700, textAlign: "right", color: C.text }}>{m.docsApproved}</p>
          <p style={{ fontSize: 14, fontWeight: 700, textAlign: "right", color: C.text }}>{m.messagesAnswered}</p>
          <p style={{ fontSize: 14, fontWeight: 700, textAlign: "right", color: m.pendingTasks > 5 ? C.red : C.text }}>{m.pendingTasks}</p>
        </div>
      ))}
    </div>
  );
}

// ════════════ HELPERS ════════════
function Card({ icon: Icon, color, title, children, emptyText }) {
  const childCount = Array.isArray(children) ? children.filter(Boolean).length : (children ? 1 : 0);
  return (
    <div style={{ background: C.card, borderRadius: 14, padding: "16px 18px", border: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={15} color={color} />
        </div>
        <h3 style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>{title}</h3>
      </div>
      <div>{childCount > 0 ? children : <p style={{ fontSize: 11.5, color: C.textMuted, padding: "12px 0", textAlign: "center" }}>{emptyText || "Sin datos"}</p>}</div>
    </div>
  );
}

function Item({ title, subtitle, badge, right }) {
  return (
    <div style={{ padding: "8px 0", borderBottom: `1px solid ${C.bg}`, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</p>
        {subtitle && <p style={{ fontSize: 10.5, color: C.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</p>}
      </div>
      {badge && <span style={{ fontSize: 9.5, fontWeight: 700, color: badge.color, background: `${badge.color}15`, padding: "2px 7px", borderRadius: 5, textTransform: "uppercase" }}>{badge.label}</span>}
      {right}
    </div>
  );
}

function BigMetric({ icon: Icon, color, label, value, sub }) {
  return (
    <div style={{ background: C.card, borderRadius: 14, padding: "20px 22px", border: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={17} color={color} />
        </div>
        <p style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</p>
      </div>
      <p style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: C.text }}>{value}</p>
      <p style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>{sub}</p>
    </div>
  );
}

function Loader() {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.primary, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 10px" }} />
      <p style={{ fontSize: 12, color: C.textMuted }}>Cargando datos...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function qaBtn(c1, c2) {
  return {
    padding: "9px 16px",
    borderRadius: 9,
    background: `linear-gradient(135deg, ${c1}, ${c2})`,
    color: "#fff",
    fontSize: 12.5,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    fontFamily: font,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };
}
