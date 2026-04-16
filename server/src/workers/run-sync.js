import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('LibreApp LexConsulta Sync');
console.log(`Date: ${new Date().toISOString()}`);
console.log('-'.repeat(40));

async function runWorker(name, script) {
  return new Promise((resolve, reject) => {
    console.log(`\nRunning ${name}...`);
    exec(`node ${join(__dirname, script)}`, (error, stdout, stderr) => {
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      if (error) {
        console.error(`${name} failed:`, error.message);
        resolve(); // Don't reject, continue with next worker
      } else {
        console.log(`${name} completed`);
        resolve();
      }
    });
  });
}

async function main() {
  await runWorker('BOE Sync', 'boe-sync.js');
  await runWorker('CENDOJ Sync', 'cendoj-sync.js');
  console.log('\nAll sync jobs completed');
}

main().catch(console.error);
