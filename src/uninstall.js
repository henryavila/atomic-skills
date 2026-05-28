import { unlinkSync, rmdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { readManifest, MANIFEST_DIR, MANIFEST_FILE } from './manifest.js';
import { promptConfirmUninstall, promptUninstallScope } from './ui.js';
import { resolveProjectScopeTarget } from './scope.js';

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

export async function uninstall(projectDir, scope = null) {
  const projectTarget = resolveProjectScopeTarget(projectDir);
  const projectBase = projectTarget.ok ? projectTarget.path : projectDir;
  const hasProject = readManifest(projectBase) !== null;
  const hasUser = readManifest(homedir()) !== null;

  if (!scope) {
    if (hasProject && hasUser) {
      // Use project manifest's language for the prompt
      const projectManifest = readManifest(projectBase);
      const lang0 = projectManifest?.language || 'en';
      scope = await promptUninstallScope(lang0);
    } else if (hasProject) {
      scope = 'project';
    } else if (hasUser) {
      scope = 'user';
    } else {
      console.log('\n  ⚛ No installation found.\n');
      return;
    }
  }

  const basePath = scope === 'user' ? homedir() : projectBase;
  const manifest = readManifest(basePath);
  const lang = manifest?.language || 'en';
  const msg = UNINSTALL_MESSAGES[lang] || UNINSTALL_MESSAGES.en;

  console.log(`\n  ⚛ ${msg.removing}\n`);

  if (!manifest) {
    console.log(`  ${msg.noInstall}\n`);
    return;
  }

  // IMPORTANT: Keep the confirmation prompt
  const confirmed = await promptConfirmUninstall(lang);
  if (!confirmed) {
    console.log(`  ${msg.cancelled}\n`);
    return;
  }

  let removed = 0;
  for (const relPath of Object.keys(manifest.files)) {
    const absPath = join(basePath, relPath);
    if (existsSync(absPath)) {
      unlinkSync(absPath);
      removed++;

      const parentDir = dirname(absPath);
      try {
        if (existsSync(parentDir) && readdirSync(parentDir).length === 0) {
          rmdirSync(parentDir);
        }
      } catch {}
    }
  }

  // Remove manifest
  const manifestPath = join(basePath, MANIFEST_DIR, MANIFEST_FILE);
  if (existsSync(manifestPath)) unlinkSync(manifestPath);
  const manifestDir = join(basePath, MANIFEST_DIR);
  try {
    if (existsSync(manifestDir) && readdirSync(manifestDir).length === 0) {
      rmdirSync(manifestDir);
    }
  } catch {}

  console.log(`  ✓ ${msg.filesRemoved(removed)}`);
  console.log(`  ✓ ${msg.manifestRemoved}`);

  // Suppress .gitignore message for user scope
  if (scope !== 'user') {
    console.log(`  ℹ ${msg.gitignoreKept}`);
  }

  console.log(`\n  ⚛ ${msg.complete}\n`);
}
