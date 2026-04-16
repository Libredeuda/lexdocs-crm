import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://agzcaqgxlyrtbxtyxkwp.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

// BOE keywords related to LSO/concursal
const KEYWORDS = [
  'concursal', 'concurso de acreedores', 'segunda oportunidad',
  'insolvencia', 'exoneración', 'BEPI', 'pasivo insatisfecho',
  'ley concursal', 'TRLC', 'reestructuración',
];

async function fetchBOEDay(date) {
  // Format: YYYYMMDD
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const url = `https://boe.es/datosabiertos/api/boe/sumario/${dateStr}`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      console.log(`BOE API returned ${res.status} for ${dateStr}`);
      return [];
    }

    const data = await res.json();
    const items = [];

    // Navigate BOE JSON structure
    const sections = data?.data?.sumario?.diario?.[0]?.seccion || [];

    for (const section of sections) {
      const departments = section?.departamento || [];
      for (const dept of departments) {
        const entries = dept?.epigrafe || [];
        for (const epig of entries) {
          const dispositions = epig?.item || [];
          for (const item of dispositions) {
            const title = item?.titulo || '';
            const isRelevant = KEYWORDS.some(kw =>
              title.toLowerCase().includes(kw.toLowerCase())
            );

            if (isRelevant) {
              items.push({
                source: 'boe',
                title: title,
                reference: item?.identificador || `BOE-${dateStr}-${items.length}`,
                publication_date: date.toISOString().split('T')[0],
                status: 'vigente',
                category: section?.nombre || 'General',
                url: item?.url_pdf ? `https://boe.es${item.url_pdf}` : `https://boe.es/diario_boe/txt.php?id=${item?.identificador}`,
                body: title, // Full text would require fetching each document
              });
            }
          }
        }
      }
    }

    return items;
  } catch (error) {
    console.error(`Error fetching BOE for ${dateStr}:`, error.message);
    return [];
  }
}

async function syncBOE() {
  console.log('Starting BOE sync...');

  // Sync last 7 days
  const today = new Date();
  let totalInserted = 0;

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    const items = await fetchBOEDay(date);

    if (items.length > 0) {
      const { data, error } = await supabase
        .from('legislation')
        .upsert(items, { onConflict: 'reference', ignoreDuplicates: true });

      if (error) {
        console.error(`Error inserting BOE data:`, error.message);
      } else {
        totalInserted += items.length;
        console.log(`  ${items.length} items from ${date.toISOString().split('T')[0]}`);
      }
    }

    // Respectful delay
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`BOE sync complete: ${totalInserted} items processed`);
}

// Run
syncBOE().catch(console.error);
