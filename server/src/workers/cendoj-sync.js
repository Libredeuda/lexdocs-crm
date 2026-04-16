import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://agzcaqgxlyrtbxtyxkwp.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

const SEARCH_QUERIES = [
  'exoneración pasivo insatisfecho',
  'segunda oportunidad deudor',
  'BEPI concurso',
  'concurso consecutivo persona natural',
  'plan de pagos ley concursal',
];

const TRIBUNALS = [
  { name: 'Tribunal Supremo', code: 'TS' },
  { name: 'Audiencia Provincial', code: 'AP' },
];

// CENDOJ search endpoint (public)
const CENDOJ_SEARCH_URL = 'https://www.poderjudicial.es/search/indexAN.jsp';

async function searchCENDOJ(query, tribunal) {
  try {
    // Build search URL
    const params = new URLSearchParams({
      'texto': query,
      'materia': '',
      'submateria': '',
      'orden': 'relevancia',
      'pag': '1',
    });

    const url = `${CENDOJ_SEARCH_URL}?${params.toString()}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'LibreApp-LexConsulta/1.0 (legal research tool; contact: soporte@libreapp.com)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!res.ok) {
      console.log(`  CENDOJ returned ${res.status} for "${query}"`);
      return [];
    }

    const html = await res.text();

    // Parse results from HTML (basic extraction)
    const results = [];
    const regex = /class="titulo_sentencia"[^>]*>([^<]+)<\/a>/g;
    const refRegex = /ROJ:\s*([A-Z]+\s*\d+\/\d+)/g;
    const dateRegex = /Fecha:\s*(\d{2}\/\d{2}\/\d{4})/g;

    let match;
    while ((match = regex.exec(html)) !== null) {
      const title = match[1].trim();

      // Try to extract reference
      const refMatch = refRegex.exec(html);
      const reference = refMatch ? refMatch[1] : null;

      // Try to extract date
      const dateMatch = dateRegex.exec(html);
      let caseDate = null;
      if (dateMatch) {
        const [d, m, y] = dateMatch[1].split('/');
        caseDate = `${y}-${m}-${d}`;
      }

      if (reference) {
        results.push({
          source: 'cendoj',
          tribunal: tribunal?.name || 'Desconocido',
          sala: '',
          reference: reference,
          case_date: caseDate,
          ponente: '',
          matter: query.split(' ').slice(0, 3),
          summary: title,
          full_text: '', // Would need individual page fetch
          url: `https://www.poderjudicial.es/search/AN/openDocument/${reference.replace(/\s/g, '')}`,
        });
      }
    }

    return results;
  } catch (error) {
    console.error(`  Error searching CENDOJ for "${query}":`, error.message);
    return [];
  }
}

async function syncCENDOJ() {
  console.log('Starting CENDOJ sync...');

  let totalInserted = 0;

  for (const query of SEARCH_QUERIES) {
    console.log(`  Searching: "${query}"`);

    for (const tribunal of TRIBUNALS) {
      const results = await searchCENDOJ(query, tribunal);

      if (results.length > 0) {
        const { error } = await supabase
          .from('jurisprudence')
          .upsert(results, { onConflict: 'reference', ignoreDuplicates: true });

        if (error) {
          console.error(`  Error inserting:`, error.message);
        } else {
          totalInserted += results.length;
          console.log(`  ${results.length} results from ${tribunal.name}`);
        }
      }

      // Respectful delay (2-3 seconds between requests)
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
    }
  }

  console.log(`CENDOJ sync complete: ${totalInserted} items processed`);
}

// Run
syncCENDOJ().catch(console.error);
