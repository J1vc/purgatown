import { readFile, writeFile } from 'node:fs/promises';

let apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim() || '';

if (!apiKey) {
  const localEnv = await readFile(new URL('../.env', import.meta.url), 'utf8').catch(() => '');
  const localValue = localEnv.match(/^GOOGLE_MAPS_API_KEY\s*=\s*(.*)$/m)?.[1]?.trim() || '';
  apiKey = localValue.replace(/^(["'])(.*)\1$/, '$2');
}

const output = `window.PURGATOWN_GOOGLE_MAPS_API_KEY = ${JSON.stringify(apiKey)};\n`;
await writeFile(new URL('../maps-config.js', import.meta.url), output, 'utf8');

console.info(apiKey
  ? 'Google Maps browser configuration generated.'
  : 'Google Maps key not set; the embedded map fallback will be used.');
