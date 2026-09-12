import { useState, useEffect } from "react";
import { CreditCard, Check, Crown, ArrowRight, ExternalLink, Receipt, AlertTriangle, Lock, Repeat, MessageCircle, ShieldCheck } from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";
import { useTenant } from "../../lib/TenantContext";
import { PLANES, PLAN_A_MEDIDA, INCLUIDO_EN_TODOS, planPorId, nombreDePlan, precioAnual, formatoEuros, enlaceWhatsappVentas } from "../../lib/planes";

// Interruptor Mensual / Anual con la flecha de "¡2 meses gratis!"
function SelectorCiclo({ cycle, setCycle }) {
  const anual = cycle === "yearly";
  const etiqueta = (activo) => ({ fontSize: 16, fontWeight: 700, color: activo ? C.dark : C.textMuted, fontFamily: font });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={etiqueta(!anual)}>Mensual</span>
        <button
          id="billing-cycle"
          role="switch"
          aria-checked={anual}
          aria-label="Pagar anualmente"
          onClick={() => setCycle(anual ? "monthly" : "yearly")}
          style={{ width: 64, height: 34, borderRadius: 17, border: "none", background: anual ? C.primary : "#D9D9DE", position: "relative", cursor: "pointer", transition: "background .2s" }}
        >
          <span style={{ position: "absolute", top: 4, left: anual ? 34 : 4, width: 26, height: 26, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left .2s" }} />
        </button>
        <span style={etiqueta(anual)}>Anual</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, marginLeft: 110 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, fontFamily: font }}>¡2 meses gratis!</span>
        <svg width="34" height="30" viewBox="0 0 34 30" aria-hidden="true" style={{ marginBottom: 4 }}>
          <path d="M28 1 C 31 13, 25 22, 9 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" />
          <polyline points="14,19 8,24 14,28" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

export default function BillingSettings({ user }) {
  const tenant = useTenant();
  const [billing, setBilling] = useState(null);
  const [cycle, setCycle] = useState("monthly"); // monthly | yearly (para el selector)
  const [toast, setToast] = useState(null);
  const [savingAutoRenew, setSavingAutoRenew] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "owner";

  // Cargar datos actualizados del tenant (billing)
  useEffect(() => {
    if (!tenant?.id) return;
    supabase.from("tenants")
      .select("plan, billing_cycle, license_count, auto_renew, current_period_end, renewal_notified_at, subscription_status, trial_ends_at, modules_enabled, stripe_customer_id, stripe_subscription_id")
      .eq("id", tenant.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setBilling(data);
          if (data.billing_cycle) setCycle(data.billing_cycle);
        }
      });
  }, [tenant?.id]);

  if (!isAdmin) {
    return (
      <div style={{ background: C.card, borderRadius: 14, padding: "40px 28px", border: `1px solid ${C.border}`, textAlign: "center", maxWidth: 480, margin: "60px auto" }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: `${C.orange}15`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Lock size={24} color={C.orange} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Sección solo para administradores</h2>
        <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>
          La gestión de la suscripción y los pagos del despacho está reservada al rol <strong>admin</strong>. Si necesitas acceso, pide a tu admin que te lo dé.
        </p>
      </div>
    );
  }

  const currentPlan = billing?.plan || tenant?.plan || "trial";
  const currentCycle = billing?.billing_cycle;
  const currentUsers = planPorId(currentPlan)?.usuarios || billing?.license_count || 1;
  const autoRenew = billing?.auto_renew ?? true;
  const subStatus = billing?.subscription_status;
  const periodEnd = billing?.current_period_end ? new Date(billing.current_period_end) : null;
  const now = new Date();
  const daysToRenewal = periodEnd ? Math.ceil((periodEnd - now) / 86400000) : null;

  // Alerta de renovación (anual, a menos de 30 días)
  const renewalWarning = currentCycle === "yearly" && daysToRenewal !== null && daysToRenewal <= 30 && daysToRenewal >= 0;
  const expired = daysToRenewal !== null && daysToRenewal < 0;

  const enlaceWhatsapp = enlaceWhatsappVentas(tenant?.name);

  const trialDaysLeft = billing?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(billing.trial_ends_at) - now) / 86400000))
    : 0;

  async function handleToggleAutoRenew() {
    if (!tenant?.id) return;
    setSavingAutoRenew(true);
    const next = !autoRenew;
    const { error } = await supabase.from("tenants").update({ auto_renew: next }).eq("id", tenant.id);
    if (!error) {
      setBilling(b => ({ ...b, auto_renew: next }));
      setToast(next ? "Renovación automática activada" : "Renovación automática desactivada");
    } else {
      setToast("No se pudo actualizar");
    }
    setSavingAutoRenew(false);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSelectPlan(planId) {
    if (!tenant?.id) return;
    if (!planPorId(planId)) return;
    setToast("Redirigiendo a Stripe...");
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!supabaseUrl || !accessToken) {
        setToast("Sesión expirada. Vuelve a entrar.");
        setTimeout(() => setToast(null), 3000);
        return;
      }
      const res = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
        body: JSON.stringify({
          planId,
          cycle,
          successUrl: window.location.origin + "?checkout=success",
          cancelUrl: window.location.href,
        }),
      });
      let data;
      try { data = await res.json(); } catch { data = { error: `HTTP ${res.status}` }; }
      console.log("[stripe-checkout] response:", res.status, data);
      if (data?.success && data?.url) {
        window.location.href = data.url;
        return;
      }
      setToast(data?.error ? `Error: ${data.error}` : `No se pudo crear la sesión (HTTP ${res.status})`);
    } catch (e) {
      console.error("[stripe-checkout] fetch error:", e);
      setToast("Error de conexión: " + (e.message || e));
    }
    setTimeout(() => setToast(null), 6000);
  }

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.sidebar, color: "#fff", padding: "12px 24px", borderRadius: 12, fontSize: 13, fontWeight: 500, zIndex: 999, boxShadow: "0 8px 30px rgba(0,0,0,.2)", maxWidth: "90%", textAlign: "center" }}>{toast}</div>}

      {/* Aviso de renovación próxima o expirado */}
      {(renewalWarning || expired) && (
        <div style={{ background: expired ? `${C.red}15` : C.orangeSoft, border: `1.5px solid ${expired ? C.red : C.orange}40`, borderRadius: 12, padding: "14px 18px", marginBottom: 18, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <AlertTriangle size={20} color={expired ? C.red : C.orange} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: expired ? C.red : C.orange }}>
              {expired ? "Tu suscripción ha expirado" : `Tu plan anual se renueva en ${daysToRenewal} día${daysToRenewal === 1 ? "" : "s"}`}
            </p>
            <p style={{ fontSize: 12.5, color: C.text, marginTop: 3, lineHeight: 1.5 }}>
              {expired
                ? "Renueva ahora para seguir usando la plataforma sin interrupciones."
                : autoRenew
                  ? `Se cobrará el ${periodEnd.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })} el importe correspondiente a tu plan actual.`
                  : `No tienes renovación automática activa. Si no renuevas antes del ${periodEnd.toLocaleDateString("es-ES")}, el acceso se suspenderá.`}
            </p>
          </div>
        </div>
      )}

      {/* Plan actual */}
      <div style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, borderRadius: 14, padding: "22px 26px", marginBottom: 22, color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <CreditCard size={18} />
            <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", opacity: 0.85 }}>Plan actual del despacho</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 26, fontWeight: 700 }}>
              {currentPlan === "trial" ? "Prueba gratuita" : nombreDePlan(currentPlan)}
            </h2>
            {currentCycle && (
              <span style={{ fontSize: 13, opacity: 0.85, fontWeight: 500 }}>
                · {currentCycle === "yearly" ? "Facturación anual" : "Facturación mensual"}
              </span>
            )}
            {currentPlan !== "trial" && (
              <span style={{ fontSize: 13, opacity: 0.85, fontWeight: 500 }}>
                · {currentUsers === 1 ? "1 usuario" : `hasta ${currentUsers} usuarios`}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 14, flexWrap: "wrap", fontSize: 12 }}>
            {currentPlan === "trial" && trialDaysLeft > 0 && (
              <div><p style={{ opacity: 0.7, fontSize: 10.5, fontWeight: 500 }}>DÍAS DE PRUEBA</p><p style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{trialDaysLeft}</p></div>
            )}
            {subStatus && (
              <div><p style={{ opacity: 0.7, fontSize: 10.5, fontWeight: 500 }}>ESTADO</p><p style={{ fontSize: 15, fontWeight: 700, marginTop: 2, textTransform: "uppercase" }}>{subStatus}</p></div>
            )}
            {periodEnd && (
              <div><p style={{ opacity: 0.7, fontSize: 10.5, fontWeight: 500 }}>PRÓXIMA RENOVACIÓN</p><p style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{periodEnd.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</p></div>
            )}
          </div>

          {/* Toggle auto-renew */}
          {currentPlan !== "trial" && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(0,0,0,.2)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <Repeat size={16} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12.5, fontWeight: 600 }}>Renovación automática</p>
                <p style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                  {autoRenew ? "Tu plan se renovará automáticamente" : "Tendrás que renovar manualmente"}
                </p>
              </div>
              <button
                onClick={handleToggleAutoRenew}
                disabled={savingAutoRenew}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: "none",
                  background: autoRenew ? "#fff" : "rgba(255,255,255,.3)",
                  position: "relative", cursor: savingAutoRenew ? "wait" : "pointer", transition: "all .15s",
                }}
              >
                <span style={{
                  position: "absolute", top: 3, left: autoRenew ? 22 : 3, width: 18, height: 18,
                  borderRadius: "50%", background: autoRenew ? C.primary : "#fff", transition: "left .15s",
                }} />
              </button>
            </div>
          )}
        </div>
      </div>

      <SelectorCiclo cycle={cycle} setCycle={setCycle} />

      {/* Planes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
        {PLANES.map(plan => {
          const isCurrent = currentPlan === plan.id && currentCycle === cycle;
          const anual = cycle === "yearly";
          const importe = anual ? precioAnual(plan) : plan.mensual;
          return (
            <div key={plan.id} style={{ background: C.card, borderRadius: 14, padding: 22, border: `1px solid ${isCurrent ? C.primary : C.border}`, display: "flex", flexDirection: "column" }}>
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>{plan.nombre}</h3>
              <p style={{ fontSize: 12.5, color: C.textMuted, marginTop: 2 }}>{plan.usuarios === 1 ? "1 usuario" : `Hasta ${plan.usuarios} usuarios`}</p>

              <div style={{ margin: "16px 0 14px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 30, fontWeight: 700 }}>{formatoEuros(importe)}</span>
                  <span style={{ fontSize: 12, color: C.textMuted }}>(+ IVA) /{anual ? "año" : "mes"}</span>
                </div>
                {anual && (
                  <p style={{ fontSize: 11.5, color: C.teal, fontWeight: 500, marginTop: 4 }}>
                    Equivale a {formatoEuros(Math.round(importe / 12 * 100) / 100)}/mes · 2 meses gratis
                  </p>
                )}
              </div>

              <div style={{ flex: 1, marginBottom: 16 }}>
                {INCLUIDO_EN_TODOS.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                    <Check size={14} color={C.primary} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 12.5, color: C.text, lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => !isCurrent && handleSelectPlan(plan.id)}
                disabled={isCurrent}
                style={{
                  width: "100%", padding: 12, borderRadius: 10, fontSize: 13.5, fontWeight: 600, border: "none",
                  cursor: isCurrent ? "default" : "pointer", fontFamily: font,
                  background: isCurrent ? C.bg : C.primary, color: isCurrent ? C.textMuted : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {isCurrent ? "Plan actual" : <><ArrowRight size={14} /> Elegir {plan.nombre}</>}
              </button>
            </div>
          );
        })}
      </div>

      <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, color: C.textMuted, marginBottom: 22 }}>
        <ShieldCheck size={15} color={C.teal} /> Si en 14 días LibreApp no te convence, te devolvemos el dinero.
      </p>

      {/* A medida */}
      <div style={{ background: C.card, borderRadius: 14, padding: "18px 22px", border: `1px solid ${C.border}`, marginBottom: 22, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #1E1E2E, #353550)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Crown size={20} color="#f59e0b" />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h4 style={{ fontSize: 14.5, fontWeight: 600 }}>¿Más de {PLAN_A_MEDIDA.desdeUsuarios - 1} usuarios? Plan {PLAN_A_MEDIDA.nombre}</h4>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Cuéntanos cómo es tu despacho y te preparamos una propuesta.</p>
        </div>
        {enlaceWhatsapp ? (
          <a href={enlaceWhatsapp} target="_blank" rel="noopener noreferrer" style={{ padding: "9px 18px", borderRadius: 8, background: "#25d366", color: "#fff", fontSize: 12.5, fontWeight: 600, textDecoration: "none", fontFamily: font, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <MessageCircle size={14} /> Hablar por WhatsApp
          </a>
        ) : (
          <span style={{ padding: "9px 18px", borderRadius: 8, background: C.bg, color: C.textMuted, fontSize: 12.5, fontWeight: 600, fontFamily: font }}>WhatsApp: muy pronto</span>
        )}
      </div>

      {/* Facturas (mock hasta que Stripe webhook las alimente) */}
      <div style={{ background: C.card, borderRadius: 14, padding: "18px 22px", border: `1px solid ${C.border}` }}>
        <h3 style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><Receipt size={16} /> Facturas</h3>
        {billing?.stripe_customer_id ? (
          <div style={{ padding: "14px 0", textAlign: "center" }}>
            <p style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 10 }}>Gestiona tus facturas, método de pago y datos fiscales en el portal de cliente de Stripe.</p>
            <button style={{ padding: "9px 18px", borderRadius: 8, background: C.primary, color: "#fff", fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: font, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ExternalLink size={12} /> Abrir portal Stripe
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 12, color: C.textMuted, padding: "10px 0" }}>Aún no hay facturas. Aparecerán aquí tras tu primera renovación.</p>
        )}
      </div>
    </div>
  );
}
