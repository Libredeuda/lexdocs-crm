import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { C, font } from "../constants";

// ════ CASE ROADMAP ════
// Stepper horizontal con las 7 fases del expediente.
// Props: { currentPhase, progress, caseType }

const PHASES = [
  { id: "intake",              label: "Primer contacto",    short: "Contacto",    desc: "Primer contacto y análisis de viabilidad" },
  { id: "document_collection", label: "Recogida documental", short: "Recogida",    desc: "Reúnes tu documentación, tu letrado la valida" },
  { id: "lawyer_review",       label: "Revisión letrada",    short: "Revisión",    desc: "Tu letrado revisa todo y prepara el expediente" },
  { id: "drafting",            label: "Redacción demanda",   short: "Redacción",   desc: "Redacción de la demanda y escritos" },
  { id: "filed",               label: "Presentado juzgado",  short: "Presentado",  desc: "Presentación en juzgado" },
  { id: "hearing",             label: "Vista / Resolución",  short: "Vista",       desc: "Vista oral y espera de resolución" },
  { id: "closed",              label: "Cerrado",             short: "Cerrado",     desc: "Procedimiento finalizado" },
];

export default function CaseRoadmap({ currentPhase = "document_collection", progress = 0, caseType = "lso" }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const currentIdx = Math.max(0, PHASES.findIndex(p => p.id === currentPhase));

  return (
    <div style={{
      background: C.card,
      borderRadius: 14,
      padding: "18px 20px 20px",
      marginBottom: 18,
      border: `1px solid ${C.border}`,
      fontFamily: font,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 6 }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>Tu expediente, paso a paso</h3>
          <p style={{ fontSize: 11, color: C.textMuted }}>
            {caseType === "concurso" ? "Concurso de Acreedores" : "Ley de Segunda Oportunidad"} · Fase {currentIdx + 1} de {PHASES.length}
          </p>
        </div>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.primary,
          background: `rgba(91,107,240,.08)`,
          padding: "4px 10px",
          borderRadius: 999,
        }}>
          {PHASES[currentIdx]?.label}
        </div>
      </div>

      {/* Scroll wrapper - mobile: horizontal scroll, desktop: fit full width */}
      <div style={{
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        paddingBottom: 4,
      }}>
        <div style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          minWidth: 560,
          position: "relative",
          padding: "4px 8px 0",
        }}>
          {PHASES.map((phase, idx) => {
            const isPast = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const isFuture = idx > currentIdx;
            const isLast = idx === PHASES.length - 1;
            const showProgressBar = isCurrent && phase.id === "document_collection";

            const circleSize = isCurrent ? 42 : 34;
            const circleBg = isPast
              ? `linear-gradient(135deg, ${C.green}, ${C.tealLight})`
              : isCurrent
              ? `linear-gradient(135deg, ${C.primary}, ${C.violet})`
              : C.bg;
            const circleColor = isFuture ? C.textMuted : "#fff";
            const circleBorder = isFuture ? `1.5px solid ${C.border}` : "none";
            const circleShadow = isCurrent ? `0 6px 18px rgba(91,107,240,.35)` : "none";

            return (
              <div
                key={phase.id}
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
                onClick={() => setHoverIdx(hoverIdx === idx ? null : idx)}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  position: "relative",
                  cursor: "pointer",
                  minWidth: 70,
                }}
              >
                {/* Line to next step (not on last) */}
                {!isLast && (
                  <div style={{
                    position: "absolute",
                    top: isCurrent ? 21 : 17,
                    left: "50%",
                    width: "100%",
                    height: 2,
                    background: idx < currentIdx ? C.green : C.border,
                    zIndex: 0,
                  }} />
                )}

                {/* Circle */}
                <div style={{
                  width: circleSize,
                  height: circleSize,
                  borderRadius: "50%",
                  background: circleBg,
                  color: circleColor,
                  border: circleBorder,
                  boxShadow: circleShadow,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isCurrent ? 14 : 12,
                  fontWeight: 700,
                  position: "relative",
                  zIndex: 1,
                  transition: "all .25s ease",
                }}>
                  {isPast ? (
                    <Check size={18} strokeWidth={3} color="#fff" />
                  ) : isFuture ? (
                    <span>{idx + 1}</span>
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                {/* Label */}
                <p style={{
                  fontSize: 10.5,
                  fontWeight: isCurrent ? 700 : 500,
                  color: isFuture ? C.textMuted : isCurrent ? C.primary : C.text,
                  marginTop: 8,
                  textAlign: "center",
                  lineHeight: 1.25,
                  maxWidth: 80,
                }}>
                  {phase.short}
                </p>

                {/* Mini progress bar under document_collection when current */}
                {showProgressBar && (
                  <div style={{
                    width: "100%",
                    maxWidth: 70,
                    marginTop: 6,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                  }}>
                    <div style={{
                      width: "100%",
                      height: 4,
                      background: C.bg,
                      borderRadius: 2,
                      overflow: "hidden",
                      border: `1px solid ${C.border}`,
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${Math.min(100, Math.max(0, progress))}%`,
                        background: `linear-gradient(90deg, ${C.primary}, ${C.violet})`,
                        borderRadius: 2,
                        transition: "width .6s ease",
                      }} />
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: C.primary }}>{progress}%</span>
                  </div>
                )}

                {/* Tooltip */}
                {hoverIdx === idx && (
                  <div style={{
                    position: "absolute",
                    top: circleSize + 40,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: C.sidebar,
                    color: "#fff",
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 11,
                    lineHeight: 1.4,
                    fontWeight: 400,
                    width: 180,
                    textAlign: "center",
                    boxShadow: "0 8px 24px rgba(0,0,0,.2)",
                    zIndex: 20,
                    pointerEvents: "none",
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 3, fontSize: 11.5 }}>{phase.label}</div>
                    <div style={{ opacity: .85 }}>{phase.desc}</div>
                    {isFuture && (
                      <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, opacity: .7 }}>
                        <Lock size={10} /> Próximamente
                      </div>
                    )}
                    {/* Arrow */}
                    <div style={{
                      position: "absolute",
                      top: -5,
                      left: "50%",
                      transform: "translateX(-50%) rotate(45deg)",
                      width: 10,
                      height: 10,
                      background: C.sidebar,
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
