// Formulario de viabilidad LSO: lo rellena el setter/closer con los datos del
// lead (situación económica, patrimonio, deuda pública, acreedores, requisitos
// de buena fe...). Con "Crear informe" se envían a generate-viability-report,
// que le pide a Claude un informe de viabilidad jurídico-económica siguiendo el
// modelo real del despacho y lo deja como archivo descargable en la ficha
// (aparece automáticamente en la tarjeta "Archivos").
import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, Plus, Trash2, ScrollText, AlertCircle } from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";

const ESTADOS_CIVILES = [
  { value: "", label: "Sin indicar" },
  { value: "soltero", label: "Soltero/a" },
  { value: "casado", label: "Casado/a" },
  { value: "separado", label: "Separado/a" },
  { value: "divorciado", label: "Divorciado/a" },
  { value: "viudo", label: "Viudo/a" },
  { value: "pareja_de_hecho", label: "Pareja de hecho" },
];

const REGIMENES = [
  { value: "no_aplica", label: "No aplica" },
  { value: "gananciales", label: "Gananciales" },
  { value: "separacion_bienes", label: "Separación de bienes" },
  { value: "participacion", label: "Participación" },
];

const TIPOS_ACREEDOR = [
  { value: "bancario", label: "Financiación bancaria" },
  { value: "tarjeta", label: "Tarjeta de compra / revolving" },
  { value: "publico", label: "Deuda pública" },
  { value: "otro", label: "Otro" },
];

const ORIGENES_INGRESO = [
  { value: "cuenta_ajena", label: "Trabajo cuenta ajena" },
  { value: "cuenta_propia", label: "Cuenta propia" },
  { value: "pensionista", label: "Pensionista" },
  { value: "subsidio", label: "Subsidio" },
  { value: "sin_ingresos", label: "Sin ingresos" },
  { value: "ayudas", label: "Ayudas" },
];

const inputStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 9,
  border: `1.5px solid ${C.border}`, fontSize: 12.5,
  fontFamily: font, background: C.card, color: C.text, outline: "none",
};

const labelStyle = {
  fontSize: 10.5, color: C.textMuted, marginBottom: 5,
  textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600, display: "block",
};

function Field({ label, children, full }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function emptyForm(contact) {
  return {
    org_id: contact.org_id,
    contact_id: contact.id,
    localidad: "",
    perfil: "no_empresario",
    estado_civil: "",
    regimen_matrimonial: "no_aplica",
    ingresos_mensuales: "",
    origen_ingresos: "",
    gastos_mensuales: "",
    deuda_total_estimada: "",
    origen_endeudamiento_anio: "",
    tiene_vivienda: false,
    valor_vivienda: "",
    tiene_vehiculos: false,
    otros_bienes: "",
    tiene_hijos_menores: false,
    num_hijos_menores: "",
    tiene_personas_dependientes: false,
    detalle_dependientes: "",
    deuda_aeat: 0,
    deuda_tgss: 0,
    embargos_activos: false,
    detalle_embargos: "",
    condena_penal_10anios: false,
    concurso_culpable_previo: false,
    sancion_grave_10anios: false,
    exoneracion_previa_5anios: false,
    acuerdo_extrajudicial_previo: false,
    acreedores: [],
    notas_setter: "",
  };
}

export default function ViabilityForm({ contact, onReportGenerated }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { loadForm(); }, [contact.id]);

  async function loadForm() {
    const { data } = await supabase
      .from("lead_viability_forms")
      .select("*")
      .eq("contact_id", contact.id)
      .maybeSingle();
    setForm(data || emptyForm(contact));
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    setSavedMsg("");
  }

  function addAcreedor() {
    set("acreedores", [...(form.acreedores || []), { nombre: "", tipo: "bancario", importe: "" }]);
  }
  function updateAcreedor(i, field, value) {
    const list = [...(form.acreedores || [])];
    list[i] = { ...list[i], [field]: value };
    set("acreedores", list);
  }
  function removeAcreedor(i) {
    set("acreedores", form.acreedores.filter((_, idx) => idx !== i));
  }

  function toNumber(v) {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      ...form,
      org_id: contact.org_id,
      contact_id: contact.id,
      ingresos_mensuales: toNumber(form.ingresos_mensuales),
      gastos_mensuales: toNumber(form.gastos_mensuales),
      deuda_total_estimada: toNumber(form.deuda_total_estimada),
      origen_endeudamiento_anio: toNumber(form.origen_endeudamiento_anio),
      valor_vivienda: toNumber(form.valor_vivienda),
      num_hijos_menores: toNumber(form.num_hijos_menores),
      deuda_aeat: toNumber(form.deuda_aeat) || 0,
      deuda_tgss: toNumber(form.deuda_tgss) || 0,
      acreedores: (form.acreedores || []).map(a => ({ ...a, importe: toNumber(a.importe) })),
      completado_por: userData?.user?.id || null,
      completado_at: new Date().toISOString(),
    };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;

    const { data, error: err } = await supabase
      .from("lead_viability_forms")
      .upsert(payload, { onConflict: "contact_id" })
      .select()
      .single();
    setSaving(false);
    if (err) { setError(err.message); return null; }
    setForm(data);
    setSavedMsg("Guardado");
    return data;
  }

  async function handleGenerate() {
    setError("");
    const saved = await handleSave();
    if (!saved) return;
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-viability-report`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ contact_id: contact.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      onReportGenerated?.();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setGenerating(false);
    }
  }

  if (!form) return null;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 16 }}>
        <Field label="Localidad">
          <input style={inputStyle} value={form.localidad || ""} onChange={e => set("localidad", e.target.value)} placeholder="Ej. Zaragoza" />
        </Field>
        <Field label="Perfil">
          <select style={inputStyle} value={form.perfil} onChange={e => set("perfil", e.target.value)}>
            <option value="no_empresario">Persona física no empresaria</option>
            <option value="empresario">Persona física empresaria</option>
          </select>
        </Field>
        <Field label="Estado civil">
          <select style={inputStyle} value={form.estado_civil || ""} onChange={e => set("estado_civil", e.target.value)}>
            {ESTADOS_CIVILES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        {form.estado_civil === "casado" && (
          <Field label="Régimen matrimonial">
            <select style={inputStyle} value={form.regimen_matrimonial || "no_aplica"} onChange={e => set("regimen_matrimonial", e.target.value)}>
              {REGIMENES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        )}

        <Field label="Ingresos mensuales (€)">
          <input type="number" style={inputStyle} value={form.ingresos_mensuales ?? ""} onChange={e => set("ingresos_mensuales", e.target.value)} placeholder="0" />
        </Field>
        <Field label="Origen de los ingresos">
          <select style={inputStyle} value={form.origen_ingresos || ""} onChange={e => set("origen_ingresos", e.target.value)}>
            <option value="">Selecciona...</option>
            {ORIGENES_INGRESO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Gastos mensuales (€)">
          <input type="number" style={inputStyle} value={form.gastos_mensuales ?? ""} onChange={e => set("gastos_mensuales", e.target.value)} placeholder="0" />
        </Field>
        <Field label="Deuda total estimada (€)">
          <input type="number" style={inputStyle} value={form.deuda_total_estimada ?? ""} onChange={e => set("deuda_total_estimada", e.target.value)} placeholder="0" />
        </Field>
        <Field label="Año origen del endeudamiento">
          <input type="number" style={inputStyle} value={form.origen_endeudamiento_anio ?? ""} onChange={e => set("origen_endeudamiento_anio", e.target.value)} placeholder="Ej. 2018" />
        </Field>

        <Field label="Deuda con AEAT (€)">
          <input type="number" style={inputStyle} value={form.deuda_aeat ?? 0} onChange={e => set("deuda_aeat", e.target.value)} />
        </Field>
        <Field label="Deuda con TGSS (€)">
          <input type="number" style={inputStyle} value={form.deuda_tgss ?? 0} onChange={e => set("deuda_tgss", e.target.value)} />
        </Field>
      </div>

      {/* Patrimonio */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.text, cursor: "pointer" }}>
          <input type="checkbox" checked={!!form.tiene_vivienda} onChange={e => set("tiene_vivienda", e.target.checked)} /> Vivienda en propiedad
        </label>
        {form.tiene_vivienda && (
          <input type="number" style={{ ...inputStyle, width: 140 }} value={form.valor_vivienda ?? ""} onChange={e => set("valor_vivienda", e.target.value)} placeholder="Valor aprox. (€)" />
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.text, cursor: "pointer" }}>
          <input type="checkbox" checked={!!form.tiene_vehiculos} onChange={e => set("tiene_vehiculos", e.target.checked)} /> Vehículos
        </label>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Otros bienes</label>
        <input style={inputStyle} value={form.otros_bienes || ""} onChange={e => set("otros_bienes", e.target.value)} placeholder="Sin bienes adicionales" />
      </div>

      {/* Cargas familiares */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Cargas familiares</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.text, cursor: "pointer" }}>
            <input type="checkbox" checked={!!form.tiene_hijos_menores} onChange={e => set("tiene_hijos_menores", e.target.checked)} /> Hijos menores a cargo
          </label>
          {form.tiene_hijos_menores && (
            <input type="number" style={{ ...inputStyle, width: 100 }} value={form.num_hijos_menores ?? ""} onChange={e => set("num_hijos_menores", e.target.value)} placeholder="Nº hijos" />
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.text, cursor: "pointer" }}>
            <input type="checkbox" checked={!!form.tiene_personas_dependientes} onChange={e => set("tiene_personas_dependientes", e.target.checked)} /> Otras personas dependientes a cargo
          </label>
        </div>
        {form.tiene_personas_dependientes && (
          <input style={inputStyle} value={form.detalle_dependientes || ""} onChange={e => set("detalle_dependientes", e.target.value)} placeholder="Ej. madre con discapacidad, cónyuge sin ingresos..." />
        )}
      </div>

      {/* Situación procesal */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.text, cursor: "pointer", marginBottom: form.embargos_activos ? 8 : 0 }}>
          <input type="checkbox" checked={!!form.embargos_activos} onChange={e => set("embargos_activos", e.target.checked)} /> Tiene embargos activos
        </label>
        {form.embargos_activos && (
          <textarea style={{ ...inputStyle, resize: "vertical" }} rows={2} value={form.detalle_embargos || ""} onChange={e => set("detalle_embargos", e.target.value)} placeholder="Detalle: órgano, acreedor, bien embargado..." />
        )}
      </div>

      {/* Requisitos de buena fe */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Requisitos de buena fe (art. 487 TRLC)</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            ["condena_penal_10anios", "Condena firme por delitos patrimoniales/socioeconómicos en los últimos 10 años"],
            ["concurso_culpable_previo", "Concurso declarado culpable previo"],
            ["sancion_grave_10anios", "Sanción firme grave (tributaria/Seguridad Social) en los últimos 10 años"],
            ["exoneracion_previa_5anios", "Exoneración obtenida en los últimos 5 años"],
            ["acuerdo_extrajudicial_previo", "Intentó acuerdo extrajudicial de pagos"],
          ].map(([key, label]) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.text, cursor: "pointer" }}>
              <input type="checkbox" checked={!!form[key]} onChange={e => set(key, e.target.checked)} /> {label}
            </label>
          ))}
        </div>
      </div>

      {/* Acreedores */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Acreedores</label>
          <button onClick={addAcreedor} style={{
            display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
            color: C.primary, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: font,
          }}>
            <Plus size={12} /> Añadir
          </button>
        </div>
        {(form.acreedores || []).length === 0 && (
          <p style={{ fontSize: 11.5, color: C.textMuted, margin: 0 }}>Sin acreedores detallados (se usará solo la deuda total estimada).</p>
        )}
        {(form.acreedores || []).map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
            <input style={{ ...inputStyle, flex: 2 }} value={a.nombre} onChange={e => updateAcreedor(i, "nombre", e.target.value)} placeholder="Nombre del acreedor" />
            <select style={{ ...inputStyle, flex: 1.4 }} value={a.tipo} onChange={e => updateAcreedor(i, "tipo", e.target.value)}>
              {TIPOS_ACREEDOR.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input type="number" style={{ ...inputStyle, flex: 1 }} value={a.importe ?? ""} onChange={e => updateAcreedor(i, "importe", e.target.value)} placeholder="€" />
            <button onClick={() => removeAcreedor(i)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", padding: 4, display: "flex" }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Notas */}
      <div style={{ marginBottom: 18 }}>
        <label style={labelStyle}>Notas del setter/closer</label>
        <textarea style={{ ...inputStyle, resize: "vertical" }} rows={3} value={form.notas_setter || ""} onChange={e => set("notas_setter", e.target.value)} placeholder="Cualquier detalle relevante para el análisis de viabilidad..." />
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.red, fontSize: 12, marginBottom: 12 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "9px 16px", borderRadius: 9, border: `1px solid ${C.border}`,
            background: C.card, color: C.text, fontSize: 12.5, fontWeight: 600,
            cursor: saving ? "wait" : "pointer", fontFamily: font,
          }}
        >
          {saving ? "Guardando..." : "Guardar datos"}
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating || saving}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 9, border: "none",
            background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
            color: "#fff", fontSize: 12.5, fontWeight: 600,
            cursor: generating ? "wait" : "pointer", fontFamily: font,
            opacity: generating ? 0.75 : 1,
          }}
        >
          {generating
            ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} />
            : <Sparkles size={14} />}
          {generating ? "Creando informe..." : "Crear informe"}
        </button>
        {savedMsg && !generating && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: C.green }}>
            <ScrollText size={13} /> {savedMsg}
          </span>
        )}
      </div>
      <p style={{ fontSize: 10.5, color: C.textMuted, marginTop: 10, marginBottom: 0 }}>
        El informe se genera con IA a partir de estos datos y queda guardado como archivo descargable en "Archivos", más abajo.
        Debe revisarlo un letrado antes de enviarlo al cliente.
      </p>
    </div>
  );
}
