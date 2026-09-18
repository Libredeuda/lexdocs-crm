import { useState } from "react";
import { X, Download, Printer, Maximize2, Minimize2 } from "lucide-react";
import { C, font, LOGO } from "../../constants";

// ════ DOCUMENT PREVIEW MODAL ════
// Previsualiza un documento de texto/markdown dentro del propio CRM. Si el
// contenido trae los marcadores [[PROBABILIDAD_EXITO:..]] que genera
// generate-viability-report, se muestra maquetado con la marca de LibreDeuda
// Abogados (logo, colores, probabilidad de éxito) listo para compartir
// pantalla con el cliente. Si no, se muestra como documento genérico.
// Permite descargar el original o abrirlo listo para imprimir/guardar PDF.

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMarkdown(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return out;
}

function isTableRow(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}
function isTableDivider(line) {
  return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line.trim()) && /-/.test(line);
}
function splitTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
}

// Extrae los marcadores [[CLAVE:valor]] de las primeras líneas y los quita del cuerpo.
function extractMarkers(md) {
  const lines = (md || "").replace(/\r\n/g, "\n").split("\n");
  const markers = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    const m = line.match(/^\[\[([A-Z_]+):(.*)\]\]$/);
    if (!m) break;
    markers[m[1]] = m[2].trim();
    i++;
  }
  return { markers, body: lines.slice(i).join("\n") };
}

// Convierte bloques de markdown en HTML, devolviendo una lista de bloques
// {level, html} para poder agrupar por secciones (##) más adelante.
function parseBlocks(md) {
  const lines = (md || "").split("\n");
  const blocks = [];
  let listBuf = null;

  function flushList() {
    if (listBuf) { blocks.push({ level: 0, html: `<ul>${listBuf.join("")}</ul>` }); listBuf = null; }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (!line.trim()) { flushList(); continue; }

    if (isTableRow(line) && lines[i + 1] && isTableDivider(lines[i + 1])) {
      flushList();
      const headerCells = splitTableRow(line);
      const hasHeader = headerCells.some(c => c.trim() !== "");
      const rows = [hasHeader
        ? `<table><thead><tr>${headerCells.map(c => `<th>${inlineMarkdown(c)}</th>`).join("")}</tr></thead><tbody>`
        : `<table class="kv-table"><tbody>`];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(`<tr>${splitTableRow(lines[i]).map(c => `<td>${inlineMarkdown(c)}</td>`).join("")}</tr>`);
        i++;
      }
      i--;
      rows.push("</tbody></table>");
      blocks.push({ level: 0, html: rows.join("") });
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushList();
      blocks.push({ level: h[1].length, title: h[2].replace(/\*\*/g, ""), html: `<h${h[1].length}>${inlineMarkdown(h[2])}</h${h[1].length}>` });
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushList();
      blocks.push({ level: 0, isQuote: true, html: `<blockquote>${inlineMarkdown(quote[1])}</blockquote>` });
      continue;
    }

    const check = line.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (check) {
      if (!listBuf) listBuf = [];
      const done = check[1].toLowerCase() === "x";
      listBuf.push(`<li class="lda-check ${done ? "lda-check-ok" : "lda-check-pending"}">${done ? "✅" : "⬜"} ${inlineMarkdown(check[2])}</li>`);
      continue;
    }

    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) {
      if (!listBuf) listBuf = [];
      listBuf.push(`<li>${inlineMarkdown(li[1])}</li>`);
      continue;
    }

    flushList();
    blocks.push({ level: 0, html: `<p>${inlineMarkdown(line)}</p>` });
  }
  flushList();
  return blocks;
}

// Agrupa bloques en secciones por cabecera H2. Todo lo anterior al primer H2
// (menos el H1 y la cita del disclaimer, que se muestran aparte) es "intro".
function groupSections(blocks) {
  const intro = [];
  const sections = [];
  let current = null;
  for (const b of blocks) {
    if (b.level === 1 || b.isQuote) continue; // el H1 y el disclaimer se muestran en la cabecera de marca
    if (b.level === 2) {
      current = { title: b.title, blocks: [] };
      sections.push(current);
      continue;
    }
    if (current) current.blocks.push(b);
    else intro.push(b);
  }
  return { intro, sections };
}

function gaugeColor(p) {
  if (p >= 70) return C.green;
  if (p >= 40) return C.orange;
  return C.red;
}

const brandCss = `
  .lda-report { font-family: ${font}; color: ${C.text}; }
  .doc-body h3 { font-size: 14px; margin: 16px 0 6px; color: ${C.text}; }
  .doc-body p { font-size: 12.5px; margin: 7px 0; line-height: 1.65; }
  .doc-body li { font-size: 12.5px; margin: 4px 0; line-height: 1.6; }
  .doc-body ul { margin: 6px 0; padding-left: 20px; }
  .doc-body blockquote { border-left: 3px solid ${C.primary}; margin: 12px 0; padding: 8px 14px; background: ${C.bg}; font-size: 11.5px; color: ${C.textMuted}; }
  .doc-body table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11.5px; }
  .doc-body th, .doc-body td { border: 1px solid ${C.border}; padding: 6px 9px; text-align: left; }
  .doc-body th { background: ${C.bg}; font-weight: 700; }
  .doc-body table.kv-table td:first-child { font-weight: 700; width: 38%; background: ${C.bg}; }
  .doc-body li.lda-check { list-style: none; margin-left: -20px; padding: 4px 0; }
  .doc-body li.lda-check-ok { color: ${C.text}; }
  .doc-body li.lda-check-pending { color: ${C.orange}; font-weight: 600; }
`;

function reportHtmlFragment({ markers, intro, sections, fileName }) {
  const probabilidad = parseInt(markers.PROBABILIDAD_EXITO, 10);
  const hasProb = !Number.isNaN(probabilidad);
  const via = markers.VIA_RECOMENDADA;
  const resumen = markers.RESUMEN_CORTO;

  const introHtml = intro.map(b => b.html).join("");
  const sectionsHtml = sections.map((s, idx) => `
    <div class="lda-section">
      <div class="lda-section-num">${idx + 1}</div>
      <div class="lda-section-body">
        <h2>${escapeHtml(s.title)}</h2>
        <div class="doc-body">${s.blocks.map(b => b.html).join("")}</div>
      </div>
    </div>
  `).join("");

  return `
    <div class="lda-report">
      <div class="lda-banner">
        <img src="${LOGO}" width="52" height="52" alt="LibreDeuda Abogados" />
        <div class="lda-banner-text">
          <div class="lda-eyebrow">LibreDeuda Abogados</div>
          <h1>Informe de viabilidad</h1>
          <div class="lda-sub">Ley de Segunda Oportunidad · ${escapeHtml(fileName || "")}</div>
        </div>
        ${hasProb ? `<div class="lda-gauge">${GaugeSvgString(probabilidad)}</div>` : ""}
      </div>
      ${(via || resumen) ? `
        <div class="lda-highlight">
          ${via ? `<span class="lda-pill">${escapeHtml(via)}</span>` : ""}
          ${resumen ? `<p>${inlineMarkdown(resumen)}</p>` : ""}
        </div>` : ""}
      <div class="lda-alert">⚠️ Borrador generado por IA a partir de los datos facilitados. Debe ser revisado y validado por un letrado del despacho antes de entregarlo al cliente.</div>
      ${introHtml ? `<div class="lda-section"><div class="lda-section-body doc-body" style="padding-left:0">${introHtml}</div></div>` : ""}
      ${sectionsHtml}
    </div>
  `;
}

function GaugeSvgString(pct) {
  const r = 46, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const color = gaugeColor(p);
  return `<svg width="110" height="110" viewBox="0 0 120 120">
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="10" />
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c - (p / 100) * c}" transform="rotate(-90 60 60)" />
    <text x="60" y="58" text-anchor="middle" font-size="24" font-weight="700" fill="#fff">${p}%</text>
    <text x="60" y="75" text-anchor="middle" font-size="8.5" fill="rgba(255,255,255,.85)">éxito estimado</text>
  </svg>`;
}

const brandPrintCss = `
  body { font-family: 'Poppins', Arial, sans-serif; color: ${C.text}; max-width: 820px; margin: 0 auto; padding: 0; }
  .lda-banner { display: flex; align-items: center; gap: 16px; padding: 28px 32px; background: linear-gradient(135deg, ${C.primary}, ${C.violet}); color: #fff; }
  .lda-eyebrow { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; opacity: .85; font-weight: 600; }
  .lda-banner h1 { font-size: 22px; margin: 4px 0 2px; }
  .lda-sub { font-size: 12px; opacity: .9; }
  .lda-banner-text { flex: 1; }
  .lda-gauge { flex-shrink: 0; }
  .lda-highlight { padding: 16px 32px; background: ${C.bg}; border-bottom: 1px solid ${C.border}; }
  .lda-pill { display: inline-block; padding: 5px 12px; border-radius: 999px; background: ${C.primary}18; color: ${C.primary}; font-size: 11.5px; font-weight: 700; margin-bottom: 8px; }
  .lda-highlight p { font-size: 13.5px; font-style: italic; color: ${C.text}; margin: 4px 0 0; }
  .lda-alert { margin: 16px 32px; padding: 10px 14px; border-radius: 10px; background: ${C.orangeSoft}; color: #92620a; font-size: 11.5px; border: 1px solid ${C.orange}55; }
  .lda-section { display: flex; gap: 14px; padding: 10px 32px; }
  .lda-section-num { flex-shrink: 0; width: 26px; height: 26px; border-radius: 8px; background: ${C.primary}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
  .lda-section-body { flex: 1; min-width: 0; padding: 4px 0 14px; border-bottom: 1px solid ${C.border}; }
  .lda-section-body h2 { font-size: 15.5px; margin: 2px 0 8px; color: ${C.text}; }
  ${brandCss.replace(/^\s*\.lda-report[^\n]*\n/, "")}
  @media print { .lda-banner { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

export default function DocumentPreviewModal({ file, onClose, onDownload }) {
  const [fullscreen, setFullscreen] = useState(false);
  if (!file) return null;

  const { markers, body } = extractMarkers(file.content);
  const isBrandedReport = !!markers.PROBABILIDAD_EXITO;
  const blocks = parseBlocks(body);
  const { intro, sections } = groupSections(blocks);
  const fragment = isBrandedReport
    ? reportHtmlFragment({ markers, intro, sections, fileName: file.name })
    : `<div class="doc-body">${blocks.map(b => b.html).join("")}</div>`;

  function handlePrint() {
    const w = window.open("", "_blank");
    if (!w) return;
    const css = isBrandedReport ? brandPrintCss : `
      body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 760px; margin: 40px auto; padding: 0 24px; line-height: 1.6; }
      h1,h2,h3 { margin-top: 22px; } p,li { font-size: 13.5px; }
      table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 12.5px; }
      th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; } th { background: #f5f5fa; }
      blockquote { border-left: 3px solid #5B6BF0; margin: 16px 0; padding: 8px 16px; background: #f5f5fa; }
    `;
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(file.name)}</title><style>${css}</style></head><body>${fragment}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(20,20,30,.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 10000, padding: fullscreen ? 0 : 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={fullscreen ? {
          background: C.card, borderRadius: 0, width: "100vw", maxWidth: "100vw",
          height: "100vh", maxHeight: "100vh", display: "flex", flexDirection: "column",
          boxShadow: "none", overflow: "hidden",
        } : {
          background: C.card, borderRadius: 16, width: "100%", maxWidth: 860,
          maxHeight: "90vh", display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,.3)", overflow: "hidden",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: `1.5px solid ${C.border}`, flexShrink: 0, background: C.card, zIndex: 1,
        }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: C.text, margin: 0, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file.name}
          </p>
          <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 12 }}>
            <button onClick={() => setFullscreen(f => !f)} title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa (para compartir en videollamada)"} style={btnStyle}>
              {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button onClick={handlePrint} title="Imprimir / Guardar como PDF" style={btnStyle}>
              <Printer size={14} /> PDF
            </button>
            {onDownload && (
              <button onClick={onDownload} title="Descargar original" style={btnStyle}>
                <Download size={14} />
              </button>
            )}
            <button onClick={onClose} title="Cerrar" style={{ ...btnStyle, color: C.textMuted }}>
              <X size={14} />
            </button>
          </div>
        </div>
        <style>{`
          ${brandCss}
          .lda-report .lda-banner { display: flex; align-items: center; gap: 16px; padding: 24px 26px; background: linear-gradient(135deg, ${C.primary}, ${C.violet}); color: #fff; margin: -1px -1px 0; }
          .lda-report .lda-eyebrow { font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; opacity: .85; font-weight: 600; }
          .lda-report .lda-banner h1 { font-size: 19px; margin: 3px 0 2px; color: #fff; }
          .lda-report .lda-sub { font-size: 11.5px; opacity: .9; }
          .lda-report .lda-banner-text { flex: 1; min-width: 0; }
          .lda-report .lda-gauge { flex-shrink: 0; }
          .lda-report .lda-highlight { padding: 14px 26px; background: ${C.bg}; border-bottom: 1px solid ${C.border}; }
          .lda-report .lda-pill { display: inline-block; padding: 5px 12px; border-radius: 999px; background: ${C.primary}18; color: ${C.primary}; font-size: 11px; font-weight: 700; margin-bottom: 6px; }
          .lda-report .lda-highlight p { font-size: 13px; font-style: italic; color: ${C.text}; margin: 4px 0 0; }
          .lda-report .lda-alert { margin: 14px 26px; padding: 10px 14px; border-radius: 10px; background: ${C.orangeSoft}; color: #92620a; font-size: 11px; border: 1px solid ${C.orange}55; }
          .lda-report .lda-section { display: flex; gap: 12px; padding: 10px 26px; }
          .lda-report .lda-section-num { flex-shrink: 0; width: 24px; height: 24px; border-radius: 7px; background: ${C.primary}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
          .lda-report .lda-section-body { flex: 1; min-width: 0; padding: 2px 0 12px; border-bottom: 1px solid ${C.border}; }
          .lda-report .lda-section-body h2 { font-size: 14.5px; margin: 2px 0 8px; color: ${C.text}; }
          .plain-doc { padding: 22px 26px; }
        `}</style>
        <div style={{ overflowY: "auto" }}>
          {isBrandedReport
            ? <div dangerouslySetInnerHTML={{ __html: fragment }} />
            : <div className="plain-doc doc-body" dangerouslySetInnerHTML={{ __html: fragment }} />}
        </div>
      </div>
    </div>
  );
}

const btnStyle = {
  display: "flex", alignItems: "center", gap: 5, padding: "7px 11px",
  borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.bg,
  color: C.primary, fontSize: 11.5, fontWeight: 600, fontFamily: font, cursor: "pointer",
};
