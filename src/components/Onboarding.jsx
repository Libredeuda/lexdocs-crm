import { useState } from "react";
import { Check, ChevronRight, ChevronLeft, AlertCircle, Building2, User, CreditCard, Rocket, Star, Zap, Crown, Gift } from "lucide-react";
import { supabase } from "../lib/supabase";
import { LOGO, font, C } from "../constants";

const STEPS = ["Despacho", "Cuenta", "Plan", "Confirmar"];

const PLANS = [
  {
    id: "trial",
    name: "Trial",
    price: "Gratis",
    period: "14 dias",
    icon: Gift,
    color: C.teal,
    recommended: true,
    features: [
      "Acceso Premium completo",
      "14 dias sin compromiso",
      "Sin tarjeta de credito",
      "Soporte prioritario",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: "49",
    period: "/mes/letrado",
    icon: Zap,
    color: C.primary,
    recommended: false,
    features: [
      "LexDocs portal del cliente",
      "Verificacion IA documentos",
      "Hasta 3 letrados",
      "Soporte email",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "89",
    period: "/mes/letrado",
    icon: Star,
    color: C.violet,
    recommended: false,
    features: [
      "Todo de Starter",
      "LexCRM gestion expedientes",
      "Pipeline y contactos",
      "Soporte chat",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "139",
    period: "/mes/letrado",
    icon: Crown,
    color: "#F59E0B",
    recommended: false,
    features: [
      "Suite completa",
      "LexConsulta jurisprudencia IA",
      "Integraciones avanzadas",
      "Soporte dedicado",
    ],
  },
];

const DEFAULT_PIPELINE_STAGES = [
  { name: "Contacto inicial", order_index: 0, color: "#3b82f6" },
  { name: "Documentacion", order_index: 1, color: "#f59e0b" },
  { name: "En tramite", order_index: 2, color: "#8b5cf6" },
  { name: "Resolucion", order_index: 3, color: "#22c55e" },
  { name: "Cerrado", order_index: 4, color: "#6b7280" },
];

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function Onboarding({ onBack }) {
  const [step, setStep] = useState(0);

  // Step 1
  const [firmName, setFirmName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [specialty, setSpecialty] = useState("lso");

  // Step 2
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  // Step 3
  const [plan, setPlan] = useState("trial");

  // Step 4
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState([]);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [createdSlug, setCreatedSlug] = useState("");

  function handleFirmNameChange(val) {
    setFirmName(val);
    if (!slugEdited) setSlug(slugify(val));
  }

  function validateStep() {
    switch (step) {
      case 0:
        if (!firmName.trim()) return "El nombre del despacho es obligatorio";
        if (!slug.trim() || slug.length < 3) return "El slug debe tener al menos 3 caracteres";
        return null;
      case 1:
        if (!fullName.trim()) return "Tu nombre es obligatorio";
        if (!email.trim() || !email.includes("@")) return "Email no valido";
        if (password.length < 8) return "La contrasena debe tener al menos 8 caracteres";
        if (password !== password2) return "Las contrasenas no coinciden";
        return null;
      case 2:
        if (!plan) return "Selecciona un plan";
        return null;
      default:
        return null;
    }
  }

  function next() {
    const error = validateStep();
    if (error) {
      setErr(error);
      return;
    }
    setErr("");
    setStep((s) => Math.min(s + 1, 3));
  }

  function back() {
    setErr("");
    setStep((s) => Math.max(s - 1, 0));
  }

  function addProgress(msg) {
    setProgress((p) => [...p, msg]);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setErr("");
    setProgress([]);

    try {
      // 1. Create auth user
      addProgress("Creando cuenta de usuario...");
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (authErr) throw new Error("Error creando usuario: " + authErr.message);
      const authUser = authData.user;

      // 2. Create tenant
      addProgress("Creando tenant del despacho...");
      const { data: tenant, error: tenantErr } = await supabase
        .from("tenants")
        .insert({ slug, name: firmName, plan })
        .select()
        .single();
      if (tenantErr) throw new Error("Error creando tenant: " + tenantErr.message);

      // 3. Create organization
      addProgress("Configurando organizacion...");
      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .insert({ name: firmName, slug, tenant_id: tenant.id })
        .select()
        .single();
      if (orgErr) throw new Error("Error creando organizacion: " + orgErr.message);

      // 4. Create public user
      addProgress("Registrando perfil de administrador...");
      const { error: userErr } = await supabase.from("users").insert({
        id: authUser.id,
        org_id: org.id,
        email,
        full_name: fullName,
        role: "admin",
      });
      if (userErr) throw new Error("Error creando perfil: " + userErr.message);

      // 5. Create default pipeline
      addProgress("Creando pipeline por defecto...");
      const { data: pipeline, error: pipeErr } = await supabase
        .from("pipelines")
        .insert({ name: "Principal", org_id: org.id })
        .select()
        .single();
      if (!pipeErr && pipeline) {
        const stages = DEFAULT_PIPELINE_STAGES.map((s) => ({
          ...s,
          pipeline_id: pipeline.id,
          org_id: org.id,
        }));
        await supabase.from("pipeline_stages").insert(stages);
      }

      // 6. Copy document types
      addProgress("Configurando tipos de documentos...");
      const docTypes = [];
      if (specialty === "lso" || specialty === "ambos") {
        docTypes.push(
          ...["DNI/NIE", "Libro de familia", "Certificado empadronamiento", "Nominas", "IRPF", "Extractos bancarios", "Certificado deuda AEAT", "Certificado deuda TGSS"].map((name, i) => ({
            name,
            category: "LSO",
            org_id: org.id,
            order_index: i,
          }))
        );
      }
      if (specialty === "concurso" || specialty === "ambos") {
        docTypes.push(
          ...["Escritura constitucion", "Estatutos sociales", "Cuentas anuales", "Impuesto Sociedades", "Certificado AEAT", "Certificado TGSS", "Informe CIRBE", "Lista acreedores"].map((name, i) => ({
            name,
            category: "Concurso",
            org_id: org.id,
            order_index: i + 10,
          }))
        );
      }
      if (docTypes.length > 0) {
        await supabase.from("document_types").insert(docTypes);
      }

      addProgress("Despacho creado correctamente!");
      setCreatedSlug(slug);
      setDone(true);
    } catch (e) {
      setErr(e.message || "Error inesperado durante el registro");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedPlan = PLANS.find((p) => p.id === plan);
  const specialtyLabels = { lso: "Ley de Segunda Oportunidad", concurso: "Concurso de Acreedores", ambos: "Ambos", otro: "Otro" };

  // Shared styles
  const inputStyle = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: `1.5px solid ${C.border}`,
    fontSize: 13.5,
    fontFamily: font,
    background: C.bg,
    marginBottom: 14,
    boxSizing: "border-box",
    color: C.dark,
  };
  const labelStyle = { fontSize: 12, fontWeight: 500, display: "block", marginBottom: 4, color: C.textMuted };
  const btnPrimary = {
    padding: "12px 28px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontFamily: font,
  };
  const btnSecondary = {
    padding: "12px 20px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    background: "transparent",
    color: C.textMuted,
    border: `1.5px solid ${C.border}`,
    cursor: "pointer",
    fontFamily: font,
  };

  function renderStepIndicator() {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 32 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 600,
                background: i < step ? C.teal : i === step ? `linear-gradient(135deg, ${C.primary}, ${C.violet})` : "rgba(255,255,255,0.1)",
                color: i <= step ? "#fff" : C.textMuted,
                transition: "all .3s",
              }}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span style={{ fontSize: 11, color: i === step ? "#fff" : C.textLight, fontWeight: i === step ? 600 : 400, display: "inline" }}>
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <div style={{ width: 20, height: 1, background: i < step ? C.teal : "rgba(255,255,255,0.15)" }} />
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderStep0() {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 size={18} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.dark, margin: 0 }}>Datos del despacho</h2>
            <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>Informacion basica de tu firma legal</p>
          </div>
        </div>

        <label style={labelStyle}>Nombre del despacho</label>
        <input value={firmName} onChange={(e) => handleFirmNameChange(e.target.value)} placeholder="Ej: Garcia & Asociados" style={inputStyle} />

        <label style={labelStyle}>Slug / URL del despacho</label>
        <input
          value={slug}
          onChange={(e) => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
          placeholder="garcia-asociados"
          style={inputStyle}
        />
        <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(91,107,240,0.06)", border: `1px solid rgba(91,107,240,0.15)`, fontSize: 12, color: C.primary, marginBottom: 16, marginTop: -8 }}>
          Tu portal: <strong>{slug || "tu-despacho"}.libreapp.com</strong>
        </div>

        <label style={labelStyle}>Especialidad</label>
        <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} style={{ ...inputStyle, cursor: "pointer", appearance: "auto" }}>
          <option value="lso">Ley de Segunda Oportunidad</option>
          <option value="concurso">Concurso de Acreedores</option>
          <option value="ambos">Ambos</option>
          <option value="otro">Otro</option>
        </select>
      </>
    );
  }

  function renderStep1() {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.teal}, ${C.primary})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <User size={18} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.dark, margin: 0 }}>Tu cuenta de administrador</h2>
            <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>Seras el propietario del despacho</p>
          </div>
        </div>

        <label style={labelStyle}>Nombre completo</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Carlos Martinez Lopez" style={inputStyle} />

        <label style={labelStyle}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="carlos@tudespacho.com" style={inputStyle} />

        <label style={labelStyle}>Contrasena (min. 8 caracteres)</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" style={inputStyle} />

        <label style={labelStyle}>Repetir contrasena</label>
        <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="********" style={inputStyle} />
      </>
    );
  }

  function renderStep2() {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.violet}, #F59E0B)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CreditCard size={18} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.dark, margin: 0 }}>Elige tu plan</h2>
            <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>Puedes cambiar en cualquier momento</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {PLANS.map((p) => {
            const Icon = p.icon;
            const selected = plan === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setPlan(p.id)}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  border: `2px solid ${selected ? p.color : C.border}`,
                  background: selected ? `${p.color}08` : C.white,
                  cursor: "pointer",
                  position: "relative",
                  transition: "all .2s",
                  boxShadow: selected ? `0 4px 20px ${p.color}20` : "none",
                }}
              >
                {p.recommended && (
                  <div style={{
                    position: "absolute",
                    top: -10,
                    right: 12,
                    background: `linear-gradient(135deg, ${C.teal}, ${C.primary})`,
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 20,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}>
                    Recomendado
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${p.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={14} color={p.color} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>{p.name}</span>
                </div>
                <div style={{ marginBottom: 10 }}>
                  {p.id === "trial" ? (
                    <div>
                      <span style={{ fontSize: 22, fontWeight: 700, color: p.color }}>{p.price}</span>
                      <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 4 }}>{p.period}</span>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: 22, fontWeight: 700, color: p.color }}>{p.price}&#8364;</span>
                      <span style={{ fontSize: 11, color: C.textMuted }}>{p.period}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {p.features.map((f, fi) => (
                    <div key={fi} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textMuted }}>
                      <Check size={10} color={p.color} />
                      {f}
                    </div>
                  ))}
                </div>
                {selected && (
                  <div style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: p.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Check size={11} color="#fff" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  }

  function renderStep3() {
    if (done) {
      return (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: `linear-gradient(135deg, ${C.teal}, ${C.primary})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Check size={28} color="#fff" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Despacho creado!</h2>
          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, lineHeight: 1.6 }}>
            Tu despacho <strong>{firmName}</strong> esta listo. Ya puedes acceder a tu panel de administracion.
          </p>
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(91,107,240,0.06)", border: `1px solid rgba(91,107,240,0.15)`, fontSize: 13, color: C.primary, marginBottom: 20 }}>
            <strong>{createdSlug}.libreapp.com</strong>
          </div>
          <button
            onClick={() => { window.location.href = "/"; }}
            style={btnPrimary}
          >
            Ir a mi panel
          </button>
        </div>
      );
    }

    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.primary}, ${C.teal})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Rocket size={18} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.dark, margin: 0 }}>Confirmacion</h2>
            <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>Revisa los datos antes de crear tu despacho</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Despacho", value: firmName },
            { label: "URL", value: `${slug}.libreapp.com` },
            { label: "Especialidad", value: specialtyLabels[specialty] },
            { label: "Administrador", value: fullName },
            { label: "Email", value: email },
            { label: "Plan", value: selectedPlan?.name + (selectedPlan?.id === "trial" ? " (14 dias gratis)" : ` - ${selectedPlan?.price}\u20AC${selectedPlan?.period}`) },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>{item.label}</span>
              <span style={{ fontSize: 13, color: C.dark, fontWeight: 600 }}>{item.value}</span>
            </div>
          ))}
        </div>

        {submitting && (
          <div style={{ marginBottom: 16 }}>
            {progress.map((msg, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.textMuted, padding: "4px 0" }}>
                <Check size={12} color={C.teal} />
                {msg}
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.primary, padding: "4px 0" }}>
              <div style={{ width: 12, height: 12, border: `2px solid ${C.border}`, borderTopColor: C.primary, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              Procesando...
            </div>
          </div>
        )}
      </>
    );
  }

  const stepRenderers = [renderStep0, renderStep1, renderStep2, renderStep3];

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font, background: C.sidebar, position: "relative", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        input:focus,select:focus{outline:none;border-color:${C.primary}!important;box-shadow:0 0 0 3px rgba(91,107,240,.2)}
        button{cursor:pointer;border:none;font-family:${font}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:560px){.onb-card{margin:12px!important;padding:28px 20px!important}.plan-grid{grid-template-columns:1fr!important}}
      `}</style>

      {/* Background decorations */}
      <div style={{ position: "absolute", top: -100, right: -80, width: 350, height: 350, borderRadius: "50%", background: C.teal, opacity: 0.05 }} />
      <div style={{ position: "absolute", bottom: -120, left: -60, width: 300, height: 300, borderRadius: "50%", background: C.primary, opacity: 0.07 }} />
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 500, height: 500, borderRadius: "50%", background: C.violet, opacity: 0.03 }} />

      <div
        className="onb-card"
        style={{
          width: "100%",
          maxWidth: 520,
          background: C.white,
          borderRadius: 24,
          padding: "40px 36px",
          boxShadow: "0 25px 80px rgba(0,0,0,0.35)",
          animation: "fadeIn .5s ease both",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24 }}>
          <img src={LOGO} alt="LibreApp" style={{ width: 36, height: 36, borderRadius: 10 }} />
          <div>
            <span style={{ fontSize: 20, fontWeight: 700, color: C.dark }}>LibreApp</span>
            <p style={{ fontSize: 10, color: C.textMuted, margin: 0 }}>Crear despacho</p>
          </div>
        </div>

        {/* Step indicator */}
        {!done && renderStepIndicator()}

        {/* Step content */}
        <div key={step} style={{ animation: "fadeIn .3s ease both" }}>
          {stepRenderers[step]()}
        </div>

        {/* Error */}
        {err && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: C.redSoft, color: C.red, fontSize: 12, marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={14} />
            {err}
          </div>
        )}

        {/* Navigation buttons */}
        {!done && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, gap: 12 }}>
            <div>
              {step === 0 && onBack && (
                <button onClick={onBack} style={btnSecondary}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <ChevronLeft size={14} />
                    Volver
                  </span>
                </button>
              )}
              {step > 0 && !submitting && (
                <button onClick={back} style={btnSecondary}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <ChevronLeft size={14} />
                    Atras
                  </span>
                </button>
              )}
            </div>
            <div>
              {step < 3 && (
                <button onClick={next} style={btnPrimary}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    Siguiente
                    <ChevronRight size={14} />
                  </span>
                </button>
              )}
              {step === 3 && !submitting && (
                <button onClick={handleSubmit} style={{ ...btnPrimary, background: `linear-gradient(135deg, ${C.teal}, ${C.primary})` }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Rocket size={14} />
                    Crear mi despacho
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
