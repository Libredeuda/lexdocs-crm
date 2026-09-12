// @vitest-environment node
// Conversión de adjuntos para Carlota (src/lib/adjuntos.js).
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { clasificar, hojasATexto, prepararAdjunto, MAX_CARACTERES_TEXTO } from './lib/adjuntos';

// .docx mínimo válido (lo que mammoth necesita para leerlo)
async function docxDePrueba(parrafos) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const cuerpo = parrafos.map((p) => `<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${cuerpo}</w:body></w:document>`);
  return zip.generateAsync({ type: 'uint8array' });
}

describe('Adjuntos de Carlota', () => {
  it('clasifica los formatos admitidos y rechaza el resto', () => {
    expect(clasificar('dni.JPG')).toBe('imagen');
    expect(clasificar('foto.webp')).toBe('imagen');
    expect(clasificar('escritura.pdf')).toBe('pdf');
    expect(clasificar('contrato.docx')).toBe('word');
    expect(clasificar('deudas.xlsx')).toBe('hoja');
    expect(clasificar('antiguo.xls')).toBe('hoja');
    expect(clasificar('libre.ods')).toBe('hoja');
    expect(clasificar('movimientos.csv')).toBe('texto');
    expect(clasificar('notas.txt')).toBe('texto');
    expect(clasificar('viejo.doc')).toBe('doc-antiguo');
    expect(clasificar('programa.exe')).toBeNull();
  });

  it('convierte un Excel de varias hojas a texto con el nombre de cada hoja', () => {
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([['Acreedor', 'Importe'], ['Banco A', 12000]]), 'Deudas');
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([['Concepto', 'Mensual'], ['Nómina', 1400]]), 'Ingresos');
    const datos = XLSX.write(libro, { type: 'array', bookType: 'xlsx' });
    const texto = hojasATexto(XLSX, new Uint8Array(datos));
    expect(texto).toContain('## Hoja: Deudas');
    expect(texto).toContain('Banco A,12000');
    expect(texto).toContain('## Hoja: Ingresos');
    expect(texto).toContain('Nómina,1400');
  });

  it('prepara un Word como texto', async () => {
    const bytes = await docxDePrueba(['Contrato de préstamo', 'Importe: 30.000 euros']);
    const r = await prepararAdjunto(new File([bytes], 'contrato.docx'));
    expect(r.ok).toBe(true);
    expect(r.adjunto.tipo).toBe('text/plain');
    expect(r.adjunto.origen).toBe('word');
    expect(r.adjunto.texto).toContain('Contrato de préstamo');
    expect(r.adjunto.texto).toContain('30.000 euros');
  });

  it('prepara un CSV como texto', async () => {
    const r = await prepararAdjunto(new File(['fecha,importe\n2026-01-01,-45.10'], 'movimientos.csv', { type: 'text/csv' }));
    expect(r.ok).toBe(true);
    expect(r.adjunto.texto).toContain('2026-01-01,-45.10');
  });

  it('avisa con .doc antiguo, archivos vacíos, formatos raros y textos demasiado largos', async () => {
    expect((await prepararAdjunto(new File(['x'], 'viejo.doc'))).error).toMatch(/\.docx o PDF/);
    expect((await prepararAdjunto(new File(['   '], 'vacio.txt'))).error).toMatch(/no tiene texto/);
    expect((await prepararAdjunto(new File(['x'], 'virus.exe'))).error).toMatch(/formato no admitido/);
    const largo = 'a'.repeat(MAX_CARACTERES_TEXTO + 1);
    expect((await prepararAdjunto(new File([largo], 'enorme.txt'))).error).toMatch(/demasiado largo/);
  });
});
