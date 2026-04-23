import { useState, useEffect } from "react";
import { CreditCard, Check, Crown, User as UserIcon, Users as UsersIcon, ArrowRight, ExternalLink, Receipt, AlertTriangle, Lock, Repeat } from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";
import { useTenant } from "../../lib/TenantContext";

// ===== Catálogo de planes LibreApp =====
// Precios en céntimos (como Stripe). unit_price es por licencia/mes.
const PLAN_CATALOG = {
  individual: {
    id: "individual",
    name: "Individual",
    subtitle: "1 licencia",
    icon: UserIcon,
    color: "#5B6BF0",
    maxLicenses: 1,
    monthly: 120,
    yearly: 99, // por mes facturado anual
    features: [
      "1 usuario profesional",
      "Portal cliente (LexDocs)",
      "CRM de leads (LexCRM)",
      "Carlota IA",
      "LexConsulta (jurisprudencia + BOE)",
      "Soporte email",
    ],
  },
  team: {
    id: "team",
    name: "Team",
    subtitle: "Hasta 5 licencias",
    icon: UsersIcon,
    color: "#7C5BF0",
    maxLicenses: 5,
    monthly: 79,
    yearly: 59, // por mes facturado anual, por licencia
    popular: true,
    features: [
      "De 2 a 5 usuarios",
      "Todo lo incluido en Individual",
      "Gestión de equipo (roles)",
      "Reparto automático de leads",
      "Soporte prioritario",
    ],
  },
};

export default function BillingSettings({ user }) {
  const tenant = useTenant();
  const [billing, setBilling] = useState(null);
  const [cycle, setCycle] = useState("yearly"); // mensual | yearly (para selector)
  const [licenses, setLicenses] = useState(2);
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
          if (data.license_count) setLicenses(data.license_count);
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
  const currentLicenses = billing?.license_count || 1;
  const autoRenew = billing?.auto_renew ?? true;
  const subStatus = billing?.subscription_status;
  const periodEnd = billing?.current_period_end ? new Date(billing.current_period_end) : null;
  const now = new Date();
  const daysToRenewal = periodEnd ? Math.ceil((periodEnd - now) / 86400000) : null;

  // Alerta de renovación (anual, a menos de 30 días)
  const renewalWarning = currentCycle === "yearly" && daysToRenewal !== null && daysToRenewal <= 30 && daysToRenewal >= 0;
  const expired = daysToRenewal !== null && daysToRenewal < 0;

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
    const plan = PLAN_CATALOG[planId];
    if (!plan) return;
    const qty = planId === "team" ? licenses : 1;
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
          licenses: qty,
          successUrl: window.location.origin + "?checkout=success",
          cancelUrl: window.location.href,
        }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
        return;
      }
      setToast(data.error || "No se pudo crear la sesión de pago");
    } catch (e) {
      setToast("Error al crear la sesión de pago");
    }
    setTimeout(() => setToast(null), 4000);
  }

  function computeTotal(plan, q, c) {
    const unit = c === "yearly" ? plan.yearly : plan.monthly;
    const qty = plan.id === "team" ? q : 1;
    return unit * qty;
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
              {currentPlan === "trial" ? "Prueba gratuita" : (PLAN_CATALOG[currentPlan]?.name || currentPlan)}
            </h2>
            {currentCycle && (
              <span style={{ fontSize: 13, opacity: 0.85, fontWeight: 500 }}>
                · {currentCycle === "yearly" ? "Facturación anual" : "Facturación mensual"}
              </span>
            )}
            {currentPlan === "team" && (
              <span style={{ fontSize: 13, opacity: 0.85, fontWeight: 500 }}>
                · {currentLicenses} licencia{currentLicenses === 1 ? "" : "s"}
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

      {/* Selector ciclo */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <div style={{ display: "inline-flex", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4 }}>
          <button onClick={() => setCycle("monthly")} style={{ padding: "8px 18px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, border: "none", background: cycle === "monthly" ? C.sidebar : "transparent", color: cycle === "monthly" ? "#fff" : C.text, cursor: "pointer", fontFamily: font }}>Mensual</button>
          <button onClick={() => setCycle("yearly")} style={{ padding: "8px 18px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, border: "none", background: cycle === "yearly" ? C.sidebar : "transparent", color: cycle === "yearly" ? "#fff" : C.text, cursor: "pointer", fontFamily: font, display: "flex", alignItems: "center", gap: 6 }}>
            Anual <span style={{ fontSize: 10, background: C.teal, color: "#fff", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>AHORRA {Math.round((PLAN_CATALOG.individual.monthly - PLAN_CATALOG.individual.yearly) / PLAN_CATALOG.individual.monthly * 100)}%</span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 24 }}>
        {Object.values(PLAN_CATALOG).map(plan => {
          const isCurrent = currentPlan === plan.id && currentCycle === cycle && (plan.id !== "team" || currentLicenses === licenses);
          const PlanIcon = plan.icon;
          const unitPrice = cycle === "yearly" ? plan.yearly : plan.monthly;
          const qty = plan.id === "team" ? licenses : 1;
          const total = computeTotal(plan, qty, cycle);
          const yearlyTotal = cycle === "yearly" ? total * 12 : null;
          return (
            <div key={plan.id} style={{
              background: C.card, borderRadius: 14, padding: 22,
              border: plan.popular ? `2px solid ${plan.color}` : `1px solid ${C.border}`,
              position: "relative", display: "flex", flexDirection: "column"
            }}>
              {plan.popular && (
                <div style={{ position: "absolute", top: -1, right: 18, background: plan.color, color: "#fff", padding: "4px 12px", borderRadius: "0 0 8px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Más elegido</div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${plan.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PlanIcon size={20} color={plan.color} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700 }}>{plan.name}</h3>
                  <p style={{ fontSize: 11.5, color: C.textMuted }}>{plan.subtitle}</p>
                </div>
              </div>

              {/* Precio */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 34, fontWeight: 700 }}>{unitPrice}€</span>
                  <span style={{ fontSize: 12, color: C.textMuted }}>/mes{plan.id === "team" ? "/licencia" : ""}</span>
                </div>
                {cycle === "yearly" && (
                  <p style={{ fontSize: 11, color: C.teal, fontWeight: 500, marginTop: 2 }}>Facturado anualmente · {plan.yearly * 12}€/año{plan.id === "team" ? "/licencia" : ""}</p>
                )}
              </div>

              {/* Selector de licencias (team) */}
              {plan.id === "team" && (
                <div style={{ marginBottom: 14, padding: "12px 14px", background: C.bg, borderRadius: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: C.textMuted }}>Licencias</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => setLicenses(l => Math.max(2, l - 1))} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>−</button>
                      <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: "center" }}>{licenses}</span>
                      <button onClick={() => setLicenses(l => Math.min(plan.maxLicenses, l + 1))} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", fontSize: 14, fontWeight: 700 }}>+</button>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>Mín. 2 · Máx. {plan.maxLicenses}</p>
                  <p style={{ fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>Total: {total}€/mes</p>
                  {yearlyTotal && <p style={{ fontSize: 11, color: C.teal }}>{yearlyTotal}€ facturados anualmente</p>}
                </div>
              )}

              <div style={{ flex: 1, marginBottom: 16 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                    <Check size={14} color={plan.color} style={{ flexShrink: 0, marginTop: 2 }} />
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
                  background: isCurrent ? C.bg : `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`,
                  color: isCurrent ? C.textMuted : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                }}
              >
                {isCurrent ? "Plan actual" : <><ArrowRight size={14} /> Seleccionar</>}
              </button>
            </div>
          );
        })}
      </div>

      {/* Enterprise */}
      <div style={{ background: C.card, borderRadius: 14, padding: "18px 22px", border: `1px solid ${C.border}`, marginBottom: 22, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #1E1E2E, #353550)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Crown size={20} color="#f59e0b" />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h4 style={{ fontSize: 14.5, fontWeight: 600 }}>¿Más de 5 usuarios? Plan Enterprise</h4>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Sin límite de licencias, SLA, formación, migración y soporte dedicado.</p>
        </div>
        <button onClick={() => { setToast("Contacta con ventas@libreapp.com"); setTimeout(() => setToast(null), 3000); }} style={{ padding: "9px 18px", borderRadius: 8, background: C.sidebar, color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: font }}>Contactar ventas</button>
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
