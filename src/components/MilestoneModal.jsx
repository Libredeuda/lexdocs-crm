import { useState } from "react";
import { C, font } from "../constants";
import { supabase } from "../lib/supabase";

// ════ MILESTONE MODAL ════
// Modal de celebración que se muestra cuando el cliente cruza un hito de progreso.
// Props: { milestone (25|50|75|100), firstName, onClose, caseId }

const MESSAGES = {
  25:  { emoji: "💪", title: "¡Gran comienzo!",     msg: (n) => `Has subido 1 de cada 4 documentos. ¡Gran comienzo, ${n}! Sigue así.` },
  50:  { emoji: "🌟", title: "¡Mitad del camino!",  msg: (n) => `¡${n}, estás en la mitad del camino! Tu letrado ya empieza a trabajar en la estrategia.` },
  75:  { emoji: "🏁", title: "¡Casi lo tienes!",    msg: (n) => `Casi lo tienes, ${n}. Los últimos documentos son los más fáciles. ¡Vamos!` },
  100: { emoji: "🎉", title: "¡Documentación completa!", msg: (n) => `¡Documentación completa, ${n}! 🎉 En las próximas 48h tu letrado revisará todo y te contactará para proceder con tu expediente.` },
};

export default function MilestoneModal({ milestone, firstName, onClose, caseId }) {
  const [closing, setClosing] = useState(false);
  const data = MESSAGES[milestone];
  if (!data) return null;

  async function handleClose() {
    if (closing) return;
    setClosing(true);
    try {
      if (caseId) {
        const { data: caseData } = await supabase
          .from("cases")
          .select("milestone_shown")
          .eq("id", caseId)
          .single();
        const updated = { ...(caseData?.milestone_shown || {}), [milestone]: true };
        await supabase
          .from("cases")
          .update({ milestone_shown: updated })
          .eq("id", caseId);
      }
    } catch (e) {
      console.warn("Failed to persist milestone_shown:", e?.message);
    } finally {
      onClose?.();
    }
  }

  const confettiColors = ["#5B6BF0", "#7C5BF0", "#22c55e", "#f59e0b", "#3b82f6"];

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,20,35,.55)",
        backdropFilter: "blur(4px)",
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: font,
        animation: "mmFadeIn .25s ease",
      }}
    >
      <style>{`
        @keyframes mmFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes mmScaleIn { from { opacity: 0; transform: scale(.85) translateY(12px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes mmEmoji { 0% { transform: scale(.5) rotate(-20deg) } 60% { transform: scale(1.2) rotate(10deg) } 100% { transform: scale(1) rotate(0) } }
        @keyframes confettiFall { to { transform: translateY(100vh) rotate(720deg) } }
      `}</style>

      {/* Confetti only for 100% */}
      {milestone === 100 && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 9999 }}>
          {[...Array(40)].map((_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: -20,
                left: `${Math.random() * 100}%`,
                width: 8,
                height: 14,
                background: confettiColors[i % confettiColors.length],
                borderRadius: 2,
                opacity: .9,
                animation: `confettiFall ${2 + Math.random() * 2.5}s linear ${Math.random() * 0.8}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          background: C.card,
          borderRadius: 24,
          width: "100%",
          maxWidth: 440,
          padding: "36px 28px 28px",
          boxShadow: "0 24px 60px rgba(20,20,35,.35)",
          textAlign: "center",
          animation: "mmScaleIn .35s cubic-bezier(.2,.9,.3,1.2)",
          zIndex: 10000,
          overflow: "hidden",
        }}
      >
        {/* Decorative glow */}
        <div style={{
          position: "absolute",
          top: -80,
          left: "50%",
          transform: "translateX(-50%)",
          width: 260,
          height: 260,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.primary}22, transparent 70%)`,
          pointerEvents: "none",
        }} />

        {/* Emoji */}
        <div style={{
          fontSize: 64,
          lineHeight: 1,
          marginBottom: 14,
          display: "inline-block",
          animation: "mmEmoji .6s cubic-bezier(.2,.9,.3,1.4)",
          position: "relative",
        }}>
          {data.emoji}
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: 24,
          fontWeight: 700,
          background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          marginBottom: 10,
          position: "relative",
        }}>
          {data.title}
        </h2>

        {/* Percentage badge */}
        <div style={{
          display: "inline-block",
          fontSize: 11,
          fontWeight: 700,
          color: C.primary,
          background: `rgba(91,107,240,.1)`,
          padding: "4px 12px",
          borderRadius: 999,
          marginBottom: 16,
          letterSpacing: ".04em",
          position: "relative",
        }}>
          HITO {milestone}% COMPLETADO
        </div>

        {/* Message */}
        <p style={{
          fontSize: 14.5,
          lineHeight: 1.6,
          color: C.text,
          marginBottom: 26,
          position: "relative",
        }}>
          {data.msg(firstName || "")}
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
          <button
            onClick={handleClose}
            disabled={closing}
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: 12,
              fontSize: 14.5,
              fontWeight: 700,
              background: `linear-gradient(135deg, ${C.primary}, ${C.violet})`,
              color: "#fff",
              border: "none",
              cursor: closing ? "wait" : "pointer",
              boxShadow: `0 8px 22px rgba(91,107,240,.35)`,
              transition: "transform .15s, box-shadow .15s",
              opacity: closing ? .7 : 1,
              fontFamily: font,
            }}
            onMouseEnter={(e) => { if (!closing) e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            ¡Continuar!
          </button>
          <button
            onClick={handleClose}
            disabled={closing}
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 500,
              background: "transparent",
              color: C.textMuted,
              border: "none",
              cursor: closing ? "wait" : "pointer",
              fontFamily: font,
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
