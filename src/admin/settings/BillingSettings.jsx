import { useState, useEffect } from "react";
import { CreditCard, Check, Crown, Zap, Star, ArrowRight, ExternalLink, Receipt } from "lucide-react";
import { C, font } from "../../constants";
import { supabase } from "../../lib/supabase";
import { useTenant } from "../../lib/TenantContext";

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    subtitle: 'LexDocs',
    price: 49,
    period: '/mes/letrado',
    icon: Zap,
    color: '#3b82f6',
    features: [
      'Portal del cliente (LexDocs)',
      'Verificacion documental con IA',
      'Hasta 3 letrados',
      'Hasta 50 expedientes',
      'Carlota IA (50 msgs/dia)',
      'Soporte email',
    ],
    modules: ['lexdocs'],
  },
  {
    id: 'pro',
    name: 'Pro',
    subtitle: 'LexDocs + LexCRM',
    price: 89,
    period: '/mes/letrado',
    icon: Star,
    color: '#8b5cf6',
    popular: true,
    features: [
      'Todo de Starter +',
      'Panel del despacho (LexCRM)',
      'Pipeline de contactos',
      'Gestion de expedientes',
      'API REST + Webhooks',
      'Hasta 10 letrados',
      'Hasta 200 expedientes',
      'Carlota IA ilimitado',
      'Soporte prioritario',
    ],
    modules: ['lexdocs', 'lexcrm'],
  },
  {
    id: 'premium',
    name: 'Premium',
    subtitle: 'Suite completa',
    price: 139,
    period: '/mes/letrado',
    icon: Crown,
    color: '#f59e0b',
    features: [
      'Todo de Pro +',
      'LexConsulta (jurisprudencia IA)',
      'Busqueda CENDOJ + BOE',
      'Conocimiento propio del despacho',
      'Letrados ilimitados',
      'Expedientes ilimitados',
      'White-label (tu marca)',
      'Soporte 24/7 + onboarding',
    ],
    modules: ['lexdocs', 'lexcrm', 'lexconsulta'],
  },
];

export default function BillingSettings() {
  const tenant = useTenant();
  const currentPlan = tenant?.plan || 'trial';
  const [toast, setToast] = useState(null);

  // Mock invoices
  const invoices = currentPlan !== 'trial' ? [
    { id: 1, date: '2026-04-01', amount: 89, status: 'paid', number: 'INV-2026-004' },
    { id: 2, date: '2026-03-01', amount: 89, status: 'paid', number: 'INV-2026-003' },
    { id: 3, date: '2026-02-01', amount: 89, status: 'paid', number: 'INV-2026-002' },
  ] : [];

  // Trial info
  const trialDaysLeft = tenant?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(tenant.trial_ends_at) - new Date()) / 86400000))
    : 0;

  async function handleUpgrade(planId) {
    setToast("Redirigiendo a Stripe...");
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      // Try Edge Function (requires authenticated session — sólo admins)
      if (supabaseUrl && accessToken) {
        const res = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            planId,
            successUrl: window.location.origin + '?checkout=success&plan=' + planId,
            cancelUrl: window.location.href,
          }),
        });
        const data = await res.json();
        if (data.success && data.url) {
          window.location.href = data.url;
          return;
        }
      }

      // Fallback: inform user
      setToast(`Plan "${planId}" seleccionado. Configura la Edge Function stripe-checkout para activar pagos reales.`);
    } catch (e) {
      console.error('Checkout error:', e);
      setToast("Error al crear la sesion de pago. Intentalo de nuevo.");
    }
    setTimeout(() => setToast(null), 4000);
  }

  const planIndex = { trial: -1, starter: 0, pro: 1, premium: 2, enterprise: 3 };
  const currentPlanLevel = planIndex[currentPlan] ?? -1;

  return (
    <div>
      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.sidebar, color: "#fff", padding: "12px 24px", borderRadius: 12, fontSize: 13, fontWeight: 500, zIndex: 999, boxShadow: "0 8px 30px rgba(0,0,0,.2)", maxWidth: "90%", textAlign: "center" }}>{toast}</div>}

      {/* Current plan banner */}
      <div style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`, borderRadius: 14, padding: "24px 28px", marginBottom: 22, color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <CreditCard size={20} />
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", opacity: 0.8 }}>Plan actual</span>
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 700 }}>{currentPlan === 'trial' ? 'Prueba gratuita' : PLANS.find(p => p.id === currentPlan)?.name || currentPlan}</h2>
          {currentPlan === 'trial' && trialDaysLeft > 0 && (
            <p style={{ fontSize: 14, marginTop: 6, opacity: 0.9 }}>Te quedan <strong>{trialDaysLeft} dias</strong> de prueba gratuita con acceso Premium completo</p>
          )}
          {currentPlan === 'trial' && trialDaysLeft <= 0 && (
            <p style={{ fontSize: 14, marginTop: 6, color: "#fbbf24" }}>Tu prueba ha expirado. Selecciona un plan para continuar.</p>
          )}
          {currentPlan !== 'trial' && (
            <p style={{ fontSize: 14, marginTop: 6, opacity: 0.8 }}>Modulos activos: {tenant?.modules_enabled?.join(', ') || 'lexdocs'}</p>
          )}
        </div>
      </div>

      {/* Plan cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 28 }}>
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.id;
          const isDowngrade = planIndex[plan.id] < currentPlanLevel;
          const PlanIcon = plan.icon;
          return (
            <div key={plan.id} style={{
              background: C.card, borderRadius: 16, padding: "24px",
              border: plan.popular ? `2px solid ${plan.color}` : `1px solid ${C.border}`,
              position: "relative", display: "flex", flexDirection: "column"
            }}>
              {plan.popular && (
                <div style={{ position: "absolute", top: -1, right: 20, background: plan.color, color: "#fff", padding: "4px 12px", borderRadius: "0 0 8px 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>Popular</div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${plan.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PlanIcon size={20} color={plan.color} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700 }}>{plan.name}</h3>
                  <p style={{ fontSize: 11, color: C.textMuted }}>{plan.subtitle}</p>
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 36, fontWeight: 700 }}>{plan.price}€</span>
                <span style={{ fontSize: 13, color: C.textMuted }}>{plan.period}</span>
              </div>
              <div style={{ flex: 1, marginBottom: 20 }}>
                {plan.features.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                    <Check size={14} color={plan.color} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 12.5, color: C.text, lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => !isCurrent && handleUpgrade(plan.id)}
                disabled={isCurrent}
                style={{
                  width: "100%", padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 600, border: "none", cursor: isCurrent ? "default" : "pointer", fontFamily: font,
                  background: isCurrent ? C.bg : `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`,
                  color: isCurrent ? C.textMuted : "#fff",
                  opacity: isDowngrade ? 0.5 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                }}
              >
                {isCurrent ? "Plan actual" : isDowngrade ? "Downgrade" : <><ArrowRight size={14} /> Seleccionar</>}
              </button>
            </div>
          );
        })}
      </div>

      {/* Enterprise CTA */}
      <div style={{ background: C.card, borderRadius: 14, padding: "20px 24px", border: `1px solid ${C.border}`, marginBottom: 22, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: "linear-gradient(135deg, #1E1E2E, #353550)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Crown size={22} color="#f59e0b" />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h4 style={{ fontSize: 15, fontWeight: 600 }}>Enterprise</h4>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Desde 500€/mes - Personalizacion completa, SLA, formacion, migracion de datos</p>
        </div>
        <button onClick={() => { setToast("Contacta con ventas@libreapp.com"); setTimeout(() => setToast(null), 3000); }} style={{ padding: "10px 20px", borderRadius: 8, background: C.sidebar, color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: font }}>Contactar ventas</button>
      </div>

      {/* Invoices */}
      {invoices.length > 0 && (
        <div style={{ background: C.card, borderRadius: 14, padding: "20px 24px", border: `1px solid ${C.border}` }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><Receipt size={16} /> Facturas</h3>
          {invoices.map(inv => (
            <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.bg}` }}>
              <span style={{ fontSize: 12, color: C.textMuted, minWidth: 90 }}>{new Date(inv.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</span>
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{inv.number}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{inv.amount}€</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.green, background: C.greenSoft, padding: "2px 8px", borderRadius: 4 }}>Pagada</span>
              <button style={{ background: "none", border: "none", color: C.primary, fontSize: 11, cursor: "pointer", fontFamily: font, display: "flex", alignItems: "center", gap: 3 }}><ExternalLink size={11} /> PDF</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
