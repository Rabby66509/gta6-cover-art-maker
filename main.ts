// Vice Cover Studio — entrypoint for gta6-cover-art-01.
//
// Hands the entry in: copies the app and its screenshots into the output
// directory, then writes dossier.json exactly as the kit library builds it
// from those files. Node 22+ standard library only; no build step.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here);
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function copyTreeIntoOutput(name) {
  const from = join(repoRoot, name);
  const to = join(outDir, name);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true, dereference: false });
}

function handIn() {
  mkdirSync(outDir, { recursive: true });
  copyTreeIntoOutput('app');
  copyTreeIntoOutput('screenshots');
  const dossier = buildDossier(outDir, dossierCaps);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log('handed in: app/ + screenshots/ + dossier.json -> ' + outDir);
}

handIn();
