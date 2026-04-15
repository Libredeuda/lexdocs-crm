import { CheckCircle, Clock, AlertCircle, Eye, Phone, Briefcase, Scale } from "lucide-react";
import { C } from "./constants";

export const statusMap = {
  uploaded: { l: "Verificado", c: C.green, bg: C.greenSoft, i: CheckCircle },
  partial: { l: "Incompleto", c: C.orange, bg: C.orangeSoft, i: AlertCircle },
  pending: { l: "Pendiente", c: C.red, bg: C.redSoft, i: Clock },
  review: { l: "En revisión", c: C.blue, bg: C.blueSoft, i: Eye },
};

export const getS = (s) => statusMap[s] || statusMap.pending;

export const evSt = {
  call: { c: C.primary, bg: "rgba(91,107,240,0.08)", i: Phone, l: "Llamada" },
  deadline: { c: C.red, bg: C.redSoft, i: AlertCircle, l: "Plazo" },
  meeting: { c: C.teal, bg: C.tealSoft, i: Briefcase, l: "Reunión" },
  hearing: { c: C.violet, bg: "rgba(124,91,240,0.08)", i: Scale, l: "Vista/Acto" },
};

export const getEv = (t) => evSt[t] || evSt.call;

export const fmtD = (d) => new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

export const fmtMoney = (n) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + "€";

export const daysUntil = (date) => Math.ceil((new Date(date) - new Date()) / 86400000);

export const payStatusMap = {
  paid: { l: "Pagado", c: C.green, bg: C.greenSoft, i: CheckCircle },
  upcoming: { l: "Próximo", c: C.orange, bg: C.orangeSoft, i: Clock },
  pending: { l: "Pendiente", c: C.textMuted, bg: C.bg, i: Clock },
  failed: { l: "Fallido", c: C.red, bg: C.redSoft, i: AlertCircle },
};

export const getPayStatus = (s) => payStatusMap[s] || payStatusMap.pending;

export function motivMsg(name, pct, pending) {
  if (pct >= 100) return `🎉 ¡Enhorabuena ${name}! Tu documentación está COMPLETA. Tu letrado ya está revisando todo.`;
  if (pct >= 75) return `🏁 ¡Increíble ${name}! Llevas un ${pct}% completado. Solo te faltan ${pending} documentos. ¡El sprint final!`;
  if (pct >= 50) return `🌟 ¡Genial ${name}! Ya tienes el ${pct}% completado. La mitad del trabajo más difícil ya está hecho.`;
  if (pct >= 25) return `💪 ¡Buen ritmo ${name}! Llevas un ${pct}% completado. Cada documento cuenta. ¡Sigue así!`;
  if (pct > 0) return `👋 ¡Bien hecho ${name}! Ya has empezado (${pct}%). Vamos paso a paso, ¡tú puedes!`;
  return `Hola ${name}, tienes ${pending} documentos pendientes. ¡Empezamos! El primero es el más fácil.`;
}
