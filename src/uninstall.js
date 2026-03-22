import { unlinkSync, rmdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { readManifest, MANIFEST_DIR, MANIFEST_FILE } from './manifest.js';
import { promptConfirmUninstall } from './prompts.js';

const UNINSTALL_MESSAGES = {
  pt: {
    removing: 'Removendo Atomic Skills...',
    noInstall: 'Nenhuma instalação encontrada.',
    cancelled: 'Cancelado.',
    filesRemoved: (n) => `${n} arquivos removidos.`,
    manifestRemoved: `${MANIFEST_DIR}/manifest.json removido.`,
    gitignoreKept: `Entrada .atomic-skills/ mantida no .gitignore (segurança).`,
    complete: 'Desinstalação completa.',
  },
  en: {
    removing: 'Removing Atomic Skills...',
    noInstall: 'No installation found.',
    cancelled: 'Cancelled.',
    filesRemoved: (n) => `${n} files removed.`,
    manifestRemoved: `${MANIFEST_DIR}/manifest.json removed.`,
    gitignoreKept: `.atomic-skills/ entry kept in .gitignore (safety).`,
    complete: 'Uninstall complete.',
  },
};

export async function uninstall(projectDir) {
  const manifest = readManifest(projectDir);
  const lang = manifest?.language || 'en';
  const msg = UNINSTALL_MESSAGES[lang] || UNINSTALL_MESSAGES.en;

  console.log(`\n  ⚛ ${msg.removing}\n`);

  if (!manifest) {
    console.log(`  ${msg.noInstall}\n`);
    return;
  }

  const confirmed = await promptConfirmUninstall(lang);
  if (!confirmed) {
    console.log(`  ${msg.cancelled}\n`);
    return;
  }

  let removed = 0;
  for (const relPath of Object.keys(manifest.files)) {
    const absPath = join(projectDir, relPath);
    if (existsSync(absPath)) {
      unlinkSync(absPath);
      removed++;

      // Remove parent directory if empty
      const parentDir = dirname(absPath);
      try {
        if (existsSync(parentDir) && readdirSync(parentDir).length === 0) {
          rmdirSync(parentDir);
        }
      } catch {
        // Ignore — parent might not be empty
      }
    }
  }

  // Remove manifest
  const manifestPath = join(projectDir, MANIFEST_DIR, MANIFEST_FILE);
  if (existsSync(manifestPath)) unlinkSync(manifestPath);
  const manifestDir = join(projectDir, MANIFEST_DIR);
  try {
    if (existsSync(manifestDir) && readdirSync(manifestDir).length === 0) {
      rmdirSync(manifestDir);
    }
  } catch {
    // Ignore
  }

  console.log(`  ✓ ${msg.filesRemoved(removed)}`);
  console.log(`  ✓ ${msg.manifestRemoved}`);
  console.log(`  ℹ ${msg.gitignoreKept}\n`);
  console.log(`  ⚛ ${msg.complete}\n`);
}
