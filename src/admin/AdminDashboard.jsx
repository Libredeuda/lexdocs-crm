import { Briefcase, FileSearch, Wallet, CheckCircle, AlertCircle, Clock, FileText, ChevronRight, TrendingUp } from "lucide-react";
import { C, font } from "../constants";
import { fmtMoney, daysUntil } from "../utils";

export default function AdminDashboard({ cases, setPage }) {
  const totalCases = cases.length;
  const docsInReview = cases.reduce((a, c) => a + c.docsInReview, 0);
  const upcomingPayments = cases.reduce((a, c) => {
    const up = c.payments?.payments?.filter(p => p.status === "upcoming") || [];
    return a + up.length;
  }, 0);
  const completedCases = cases.filter(c => c.progress >= 100).length;
  const avgProgress = cases.length ? Math.round(cases.reduce((a, c) => a + c.progress, 0) / cases.length) : 0;

  const kpis = [
    { label: "Casos activos", value: totalCases, icon: Briefcase, color: C.primary, bg: `rgba(91,107,240,0.08)` },
    { label: "Docs. en revisión", value: docsInReview, icon: FileSearch, color: C.orange, bg: `rgba(245,158,11,0.08)` },
    { label: "Pagos pendientes", value: upcomingPayments, icon: Wallet, color: C.teal, bg: `rgba(91,191,160,0.08)` },
    { label: "Casos al 100%", value: completedCases, icon: CheckCircle, color: C.green, bg: `rgba(34,197,94,0.08)` },
  ];

  // Tasks
  const tasks = [];
  if (docsInReview > 0) tasks.push({ text: `${docsInReview} documento${docsInReview > 1 ? "s" : ""} esperando tu revisión`, icon: FileSearch, color: C.orange, action: () => setPage("cases") });
  if (upcomingPayments > 0) tasks.push({ text: `${upcomingPayments} pago${upcomingPayments > 1 ? "s" : ""} pendiente${upcomingPayments > 1 ? "s" : ""} este mes`, icon: Wallet, color: C.teal, action: () => setPage("cases") });

  const nearDeadlines = cases.flatMap(c => c.events.filter(e => e.type === "deadline" && daysUntil(e.date) >= 0 && daysUntil(e.date) <= 7));
  if (nearDeadlines.length > 0) tasks.push({ text: `${nearDeadlines.length} plazo${nearDeadlines.length > 1 ? "s" : ""} vence${nearDeadlines.length > 1 ? "n" : ""} esta semana`, icon: AlertCircle, color: C.red, action: () => setPage("cases") });

  // Phase distribution for donut
  const phases = {};
  cases.forEach(c => { phases[c.phase] = (phases[c.phase] || 0) + 1; });
  const phaseColors = { "Recogida documental": C.primary, "Revisión letrada": C.teal, "Redacción demanda": C.violet, "Presentado en juzgado": C.orange, "Vista oral": C.blue, "Cerrado": C.green };

  return (
    <div>
      {/* KPI Cards */}
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

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginBottom: 22 }}>
        {/* Progress by client */}
        <div style={{ background: C.card, borderRadius: 14, padding: "20px 22px", border: `1px solid ${C.border}` }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Progreso por expediente</h3>
          {cases.map((c, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{c.client.name.length > 25 ? c.client.name.substring(0, 25) + "…" : c.client.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>{c.progress}%</span>
              </div>
              <div style={{ height: 8, background: C.bg, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${c.progress}%`, borderRadius: 4, background: `linear-gradient(90deg, ${C.primary}, ${C.violet})`, transition: "width .8s" }} />
              </div>
              <p style={{ fontSize: 10.5, color: C.textMuted, marginTop: 3 }}>Exp. {c.client.caseId} · {c.client.caseType === "concurso" ? "Concurso" : "LSO"} · {c.pendingDocs} pendientes</p>
            </div>
          ))}
          <div style={{ marginTop: 10, padding: "10px 14px", background: C.bg, borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <TrendingUp size={13} color={C.primary} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: C.text }}>Media: {avgProgress}%</span>
            </div>
          </div>
        </div>

        {/* Cases by phase donut */}
        <div style={{ background: C.card, borderRadius: 14, padding: "20px 22px", border: `1px solid ${C.border}` }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Casos por estado</h3>
          {/* CSS donut */}
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
              {(() => {
                const total = cases.length || 1;
                let cumulative = 0;
                const segments = Object.entries(phases).map(([phase, count]) => {
                  const pct = (count / total) * 100;
                  const start = cumulative;
                  cumulative += pct;
                  return `${phaseColors[phase] || C.textMuted} ${start}% ${cumulative}%`;
                });
                return (
                  <div style={{
                    width: 120, height: 120, borderRadius: "50%",
                    background: `conic-gradient(${segments.join(", ")})`,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <div style={{ width: 70, height: 70, borderRadius: "50%", background: C.card, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{totalCases}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div>
              {Object.entries(phases).map(([phase, count]) => (
                <div key={phase} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: phaseColors[phase] || C.textMuted, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: C.text }}>{phase}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginLeft: "auto" }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Task inbox */}
      <div style={{ background: C.card, borderRadius: 14, padding: "20px 22px", border: `1px solid ${C.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Bandeja de tareas</h3>
        {tasks.length === 0 ? (
          <div style={{ padding: "20px 0", textAlign: "center" }}>
            <CheckCircle size={28} color={C.green} style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: C.textMuted }}>Todo al día. No hay tareas pendientes.</p>
          </div>
        ) : (
          tasks.map((t, i) => (
            <button key={i} onClick={t.action} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: C.bg, borderRadius: 10, marginBottom: 8, border: "none", cursor: "pointer", fontFamily: font, textAlign: "left" }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${t.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <t.icon size={17} color={t.color} />
              </div>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: C.text }}>{t.text}</span>
              <ChevronRight size={15} color={C.textMuted} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
