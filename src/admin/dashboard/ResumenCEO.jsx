import { useState, useEffect } from "react";
import { ArrowUp, ArrowDown, Minus, AlertTriangle, Megaphone, TrendingUp, Scale, Info } from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";
import { loadPipelineStages } from "../../lib/pipelineStages";

// Resumen de dirección (solo admin/owner; lo comprueba también ceo_summary en la BD).
// Tres bloques: ventas, marketing y expedientes, con comparación frente al
// periodo anterior equivalente. Cifras grandes solo donde importan.

const PERIODOS = [
  { id: "mes", nombre: "Este mes" },
  { id: "mes_anterior", nombre: "Mes anterior" },
  { id: "90", nombre: "Últimos 90 días" },
  { id: "anio", nombre: "Este año" },
];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dia = (y, m, d) => new Date(y, m, d);

// Devuelve { actual: [desde, hasta], anterior: [desde, hasta] } para comparar tramos iguales
export function rangos(periodo, hoy = new Date()) {
  const y = hoy.getFullYear(), m = hoy.getMonth(), d = hoy.getDate();
  if (periodo === "mes") {
    const finAnterior = Math.min(d, new Date(y, m, 0).getDate());
    return { actual: [dia(y, m, 1), dia(y, m, d)], anterior: [dia(y, m - 1, 1), dia(y, m - 1, finAnterior)] };
  }
  if (periodo === "mes_anterior") {
    return { actual: [dia(y, m - 1, 1), dia(y, m, 0)], anterior: [dia(y, m - 2, 1), dia(y, m - 1, 0)] };
  }
  if (periodo === "90") {
    return { actual: [dia(y, m, d - 89), dia(y, m, d)], anterior: [dia(y, m, d - 179), dia(y, m, d - 90)] };
  }
  return { actual: [dia(y, 0, 1), dia(y, m, d)], anterior: [dia(y - 1, 0, 1), dia(y - 1, m, d)] };
}

const fmtFecha = (d) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const fmtNum = (n) => (n ?? 0).toLocaleString("es-ES");
const fmtEur = (n) => n == null ? "—" : `${Number(n).toLocaleString("es-ES", { maximumFractionDigits: 0 })} €`;
const fmtPct = (r) => r == null ? "—" : `${Math.round(r * 100)} %`;
const ratio = (a, b) => (b ? a / b : null);

// ─── Tarjeta de cifra con comparación ───
// modo "conteo": variación en %; modo "tasa": variación en puntos. Color de estado + icono + texto.
function Tarjeta({ titulo, valor, detalle, actual, anterior, modo = "conteo", masEsMejor = true, alerta = false }) {
  let delta = null;
  if (anterior != null && actual != null) {
    if (modo === "tasa") delta = Math.round((actual - anterior) * 100);
    else if (anterior > 0) delta = Math.round(((actual - anterior) / anterior) * 100);
    else if (actual > 0) delta = null; // sin base de comparación
    else delta = 0;
  }
  const bueno = delta != null && delta !== 0 && ((delta > 0) === masEsMejor);
  const color = delta == null || delta === 0 ? C.textMuted : bueno ? C.green : C.red;
  const Icono = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  const unidad = modo === "tasa" ? " p.p." : " %";
  return (
    <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${alerta ? `${C.orange}66` : C.border}`, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <p style={{ fontSize: 11.5, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".05em", display: "flex", alignItems: "center", gap: 5 }}>
        {alerta && <AlertTriangle size={12} color={C.orange} aria-hidden="true" />}{titulo}
      </p>
      <p style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.05, color: C.dark, fontFamily: font }}>{valor}</p>
      {anterior !== undefined && (
        <p style={{ fontSize: 11.5, color, display: "flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
          <Icono size={12} aria-hidden="true" />
          {delta == null ? "Sin datos del periodo anterior" : delta === 0 ? "Igual que el periodo anterior" : `${delta > 0 ? "+" : ""}${delta}${unidad} vs periodo anterior`}
        </p>
      )}
      {detalle && <p style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.4 }}>{detalle}</p>}
    </div>
  );
}

function Seccion({ icono: Icono, titulo, children, nota }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.dark, display: "flex", alignItems: "center", gap: 8 }}>
          <Icono size={17} color={C.primary} aria-hidden="true" /> {titulo}
        </h2>
        {nota && <span style={{ fontSize: 11.5, color: C.textMuted }}>{nota}</span>}
      </div>
      {children}
    </section>
  );
}

const rejilla = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 };

// ─── Ranking de campañas/anuncios ───
// Con gasto: se ordena por coste por venta (y coste por lead). Sin gasto: por
// conversión lead→venta, exigiendo un mínimo de leads para no premiar la suerte.
const MIN_LEADS = 3;
function ranking(items, hayGasto) {
  const conMetricas = items.map((x) => ({
    ...x,
    conversion: ratio(x.ventas, x.leads),
    cpl: x.gasto != null && x.leads ? x.gasto / x.leads : null,
    coste_venta: x.gasto != null && x.ventas ? x.gasto / x.ventas : null,
  }));
  const evaluables = conMetricas.filter((x) => (hayGasto ? x.gasto > 0 : x.leads >= MIN_LEADS));
  const puntuar = (x) => hayGasto
    ? (x.coste_venta ?? (x.cpl != null ? x.cpl * 20 : Infinity)) // sin ventas: penaliza por coste por lead
    : -(x.conversion ?? 0);
  const orden = [...evaluables].sort((a, b) => puntuar(a) - puntuar(b));
  return { ganadores: orden.slice(0, 3), perdedores: orden.slice(-3).reverse().filter((x) => !orden.slice(0, 3).includes(x)) };
}

function TablaRanking({ titulo, filas, hayGasto, tono }) {
  const th = { fontSize: 10.5, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".04em", textAlign: "right", padding: "8px 10px", whiteSpace: "nowrap" };
  const td = { fontSize: 12.5, color: C.text, textAlign: "right", padding: "8px 10px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  return (
    <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "12px 8px 6px", minWidth: 0 }}>
      <p style={{ fontSize: 12.5, fontWeight: 700, color: C.dark, padding: "0 10px 6px", display: "flex", alignItems: "center", gap: 6 }}>
        {tono === "bueno" ? <ArrowUp size={13} color={C.green} aria-hidden="true" /> : <ArrowDown size={13} color={C.red} aria-hidden="true" />}{titulo}
      </p>
      {filas.length === 0 ? (
        <p style={{ fontSize: 12, color: C.textMuted, padding: "4px 10px 10px" }}>Aún no hay datos suficientes.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Nombre</th>
                <th style={th}>Leads</th>
                <th style={th}>Ventas</th>
                <th style={th}>Conv.</th>
                {hayGasto && <th style={th}>Gasto</th>}
                {hayGasto && <th style={th}>€/venta</th>}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.clave} style={{ borderTop: `1px solid ${C.bg}` }}>
                  <td style={{ ...td, textAlign: "left", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }} title={f.nombre}>{f.nombre}</td>
                  <td style={td}>{fmtNum(f.leads)}</td>
                  <td style={td}>{fmtNum(f.ventas)}</td>
                  <td style={td}>{fmtPct(f.conversion)}</td>
                  {hayGasto && <td style={td}>{fmtEur(f.gasto)}</td>}
                  {hayGasto && <td style={td}>{fmtEur(f.coste_venta)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const TIPO = { lso: "LSO", concurso: "Concurso", other: "Otro" };

// Recuento en vivo de leads por etapa del pipeline (situación actual, no depende
// del periodo elegido). Las etapas son las configuradas en Configuración → Pipeline.
function PipelineActual() {
  const [counts, setCounts] = useState(null);
  const [stages, setStages] = useState(null);

  useEffect(() => {
    let vigente = true;
    Promise.all([
      supabase.from("contacts").select("status"),
      loadPipelineStages(),
    ]).then(([{ data, error }, stg]) => {
      if (!vigente || error) return;
      const c = {};
      (data || []).forEach((row) => { c[row.status] = (c[row.status] || 0) + 1; });
      setCounts(c);
      setStages(stg);
    });
    return () => { vigente = false; };
  }, []);

  if (!counts || !stages) return null;
  const total = stages.reduce((s, col) => s + (counts[col.key] || 0), 0);

  return (
    <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "16px 18px", marginTop: 12 }}>
      <p style={{ fontSize: 11.5, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 }}>
        Pipeline actual · {fmtNum(total)} leads
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {stages.map((col) => (
          <div key={col.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: C.bg, minWidth: 110 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 17, fontWeight: 700, color: C.dark, lineHeight: 1.1 }}>{fmtNum(counts[col.key] || 0)}</p>
              <p style={{ fontSize: 10.5, color: C.textMuted }}>{col.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResumenCEO() {
  const [periodo, setPeriodo] = useState("mes");
  const [datos, setDatos] = useState(null);
  const [previos, setPrevios] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const r = rangos(periodo);

  useEffect(() => {
    let vigente = true;
    async function cargar() {
      setCargando(true);
      setError(null);
      const { actual, anterior } = rangos(periodo);
      const [a, b] = await Promise.all([
        supabase.rpc("ceo_summary", { p_desde: iso(actual[0]), p_hasta: iso(actual[1]) }),
        supabase.rpc("ceo_summary", { p_desde: iso(anterior[0]), p_hasta: iso(anterior[1]) }),
      ]);
      if (!vigente) return;
      if (a.error || b.error) {
        const e = a.error || b.error;
        setError(e.code === "PGRST202" || /ceo_summary/.test(e.message || "")
          ? "El resumen de dirección se activa al aplicar la migración 022 en la base de datos."
          : e.code === "42501" ? "El resumen de dirección solo está disponible para administradores y titulares."
            : "No se pudo cargar el resumen. Inténtalo de nuevo en unos segundos.");
      } else {
        setDatos(a.data);
        setPrevios(b.data);
      }
      setCargando(false);
    }
    cargar();
    return () => { vigente = false; };
  }, [periodo]);

  const v = datos?.ventas, vp = previos?.ventas;
  const mk = datos?.marketing;
  const ex = datos?.expedientes, exp = previos?.expedientes;

  const showRate = v && ratio(v.asistidas, v.asistidas + v.no_asistidas);
  const showRateP = vp && ratio(vp.asistidas, vp.asistidas + vp.no_asistidas);
  const contact = v && ratio(v.contactados, v.leads_nuevos);
  const contactP = vp && ratio(vp.contactados, vp.leads_nuevos);
  const resueltos = ex ? ex.ganados + ex.parciales + ex.desestimados : 0;
  const exito = ex && ratio(ex.ganados + ex.parciales, resueltos);
  const exitoP = exp && ratio(exp.ganados + exp.parciales, exp.ganados + exp.parciales + exp.desestimados);

  const rkCampanas = mk ? ranking(mk.campanas, mk.hay_gasto) : { ganadores: [], perdedores: [] };
  const rkAnuncios = mk ? ranking(mk.anuncios, mk.hay_gasto) : { ganadores: [], perdedores: [] };

  return (
    <div style={{ fontFamily: font }}>
      {/* Periodo: un único filtro para todo el resumen */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div role="group" aria-label="Periodo" style={{ display: "inline-flex", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 3, flexWrap: "wrap" }}>
          {PERIODOS.map((p) => (
            <button key={p.id} onClick={() => setPeriodo(p.id)} aria-pressed={periodo === p.id}
              style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: font,
                background: periodo === p.id ? C.sidebar : "transparent", color: periodo === p.id ? "#fff" : C.text }}>
              {p.nombre}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: C.textMuted }}>
          {fmtFecha(r.actual[0])} – {fmtFecha(r.actual[1])} · comparado con {fmtFecha(r.anterior[0])} – {fmtFecha(r.anterior[1])}
        </span>
      </div>

      {error && (
        <div style={{ padding: "14px 16px", borderRadius: 12, background: C.orangeSoft, border: `1px solid ${C.orange}40`, fontSize: 13, color: C.text, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <Info size={16} color={C.orange} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}

      {!error && datos && (
        <div style={{ opacity: cargando ? 0.55 : 1, transition: "opacity .2s" }}>
          {/* ─── Ventas ─── */}
          <Seccion icono={TrendingUp} titulo="Ventas">
            <div style={rejilla}>
              <Tarjeta titulo="Leads nuevos" valor={fmtNum(v.leads_nuevos)} actual={v.leads_nuevos} anterior={vp?.leads_nuevos} />
              <Tarjeta titulo="Ventas cerradas" valor={fmtNum(v.ventas_cerradas)} actual={v.ventas_cerradas} anterior={vp?.ventas_cerradas}
                detalle={`${fmtNum(v.contratos_firmados)} contratos firmados · ${fmtNum(v.primeros_pagos)} primeros pagos`} />
              <Tarjeta titulo="Citas agendadas" valor={fmtNum(v.reuniones_agendadas + v.llamadas_agendadas)}
                actual={v.reuniones_agendadas + v.llamadas_agendadas} anterior={vp && vp.reuniones_agendadas + vp.llamadas_agendadas}
                detalle={`${fmtNum(v.reuniones_agendadas)} reuniones · ${fmtNum(v.llamadas_agendadas)} llamadas`} />
              <Tarjeta titulo="Tasa de asistencia" valor={fmtPct(showRate)} modo="tasa" actual={showRate} anterior={showRateP}
                detalle={`${fmtNum(v.asistidas)} de ${fmtNum(v.asistidas + v.no_asistidas)} asistieron${v.sin_marcar ? ` · ${fmtNum(v.sin_marcar)} sin marcar en la agenda` : ""}`} />
              <Tarjeta titulo="Contactabilidad" valor={fmtPct(contact)} modo="tasa" actual={contact} anterior={contactP}
                detalle={v.horas_hasta_contacto != null ? `Primer contacto en ${String(v.horas_hasta_contacto).replace(".", ",")} h (mediana)` : "Leads contactados sobre los leads nuevos"} />
            </div>
            <PipelineActual />
          </Seccion>

          {/* ─── Marketing ─── */}
          <Seccion icono={Megaphone} titulo="Marketing"
            nota={mk.hay_gasto ? "Ordenado por coste por venta" : "Sin gasto conectado: ordenado por conversión lead → venta (mínimo 3 leads)"}>
            {mk.campanas.length === 0 && mk.anuncios.length === 0 ? (
              <div style={{ background: C.card, borderRadius: 14, border: `1px dashed ${C.border}`, padding: "18px 20px", fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
                Todavía no hay leads con campaña en este periodo. Los resultados aparecerán cuando entren leads de los anuncios de Meta o del formulario web con enlaces de campaña (UTM).
                {mk.leads_sin_campana > 0 && ` Hay ${fmtNum(mk.leads_sin_campana)} leads sin campaña en este periodo.`}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
                <TablaRanking titulo="Campañas ganadoras" filas={rkCampanas.ganadores} hayGasto={mk.hay_gasto} tono="bueno" />
                <TablaRanking titulo="Campañas perdedoras" filas={rkCampanas.perdedores} hayGasto={mk.hay_gasto} tono="malo" />
                <TablaRanking titulo="Anuncios ganadores" filas={rkAnuncios.ganadores} hayGasto={mk.hay_gasto} tono="bueno" />
                <TablaRanking titulo="Anuncios perdedores" filas={rkAnuncios.perdedores} hayGasto={mk.hay_gasto} tono="malo" />
              </div>
            )}
          </Seccion>

          {/* ─── Expedientes ─── */}
          <Seccion icono={Scale} titulo="Expedientes" nota="Pendientes y presentados: situación actual · Ganados y desestimados: resueltos en el periodo">
            <div style={rejilla}>
              <Tarjeta titulo="Pendientes de documentación" valor={fmtNum(ex.pendientes_documentacion)} />
              <Tarjeta titulo="Presentados en el juzgado" valor={fmtNum(ex.presentados)} detalle="Pendientes de resolución" />
              <Tarjeta titulo="Sin noticias del juzgado +3 meses" valor={fmtNum(ex.sin_noticias)} alerta={ex.sin_noticias > 0}
                detalle={ex.sin_noticias > 0 ? "Revisa el estado de estos expedientes" : "Ninguno"} />
              <Tarjeta titulo="Ganados" valor={fmtNum(ex.ganados)} actual={ex.ganados} anterior={exp?.ganados}
                detalle={ex.parciales ? `Además, ${fmtNum(ex.parciales)} con resultado parcial` : null} />
              <Tarjeta titulo="Desestimados" valor={fmtNum(ex.desestimados)} actual={ex.desestimados} anterior={exp?.desestimados} masEsMejor={false}
                detalle={ex.desistidos ? `${fmtNum(ex.desistidos)} desistidos` : null} />
              <Tarjeta titulo="Tasa de éxito" valor={fmtPct(exito)} modo="tasa" actual={exito} anterior={exitoP}
                detalle={resueltos ? `Ganados y parciales sobre ${fmtNum(resueltos)} resueltos` : "Sin resoluciones en el periodo"} />
            </div>

            {ex.alertas.length > 0 && (
              <div style={{ marginTop: 12, background: C.card, borderRadius: 14, border: `1px solid ${C.orange}55`, padding: "12px 8px 6px" }}>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: C.dark, padding: "0 10px 6px", display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={13} color={C.orange} aria-hidden="true" /> Presentados sin noticias del juzgado desde hace más de 3 meses
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>{["Expediente", "Cliente", "Tipo", "Presentado", "Última notificación", "Días sin noticias"].map((h, i) => (
                        <th key={h} style={{ fontSize: 10.5, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".04em", textAlign: i === 5 ? "right" : "left", padding: "8px 10px", whiteSpace: "nowrap" }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {ex.alertas.map((a) => (
                        <tr key={a.id} style={{ borderTop: `1px solid ${C.bg}` }}>
                          {[a.case_number || "—", a.cliente || "—", TIPO[a.case_type] || a.case_type,
                            a.filed_at ? new Date(a.filed_at).toLocaleDateString("es-ES") : "—",
                            a.last_court_notice_at ? new Date(a.last_court_notice_at).toLocaleDateString("es-ES") : "Ninguna"].map((val, i) => (
                            <td key={i} style={{ fontSize: 12.5, color: C.text, padding: "8px 10px", whiteSpace: "nowrap" }}>{val}</td>
                          ))}
                          <td style={{ fontSize: 12.5, fontWeight: 700, color: C.dark, padding: "8px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(a.dias)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Seccion>
        </div>
      )}

      {!error && !datos && cargando && <p style={{ fontSize: 13, color: C.textMuted }}>Cargando el resumen…</p>}
    </div>
  );
}
