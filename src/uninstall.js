import { unlinkSync, rmdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { readManifest, MANIFEST_DIR, MANIFEST_FILE } from './manifest.js';
import { promptConfirmUninstall } from './prompts.js';

export async function uninstall(projectDir) {
  console.log('\n  ⚛ Removendo Atomic Skills...\n');

  const manifest = readManifest(projectDir);
  if (!manifest) {
    console.log('  Nenhuma instalação encontrada.\n');
    return;
  }

  const lang = manifest.language || 'en';
  const confirmed = await promptConfirmUninstall(lang);
  if (!confirmed) {
    console.log('  Cancelado.\n');
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

  console.log(`  ✓ ${removed} arquivos removidos.`);
  console.log(`  ✓ ${MANIFEST_DIR}/manifest.json removido.`);
  console.log(`  ℹ Entrada .atomic-skills/ mantida no .gitignore (segurança).\n`);
  console.log('  ⚛ Desinstalação completa.\n');
}
