#!/usr/bin/env node

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PUBLIC_IDE_IDS, getAssetsDir } from '../src/config.js';
import { computeSkillsFileSet } from '../src/providers/skills-file-set.js';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Validate that every rendered skill/asset reference resolves inside the
 * desired file-set, independently for each supported IDE and install scope.
 *
 * @param {object} [options]
 * @returns {{ok: boolean, diagnostics: string[], combinationsChecked: number, filesChecked: number}}
 */
export function validateRuntimeClosure(options = {}) {
  const {
    language = 'en',
    ides = PUBLIC_IDE_IDS,
    scopes = ['project', 'user'],
    modules = {},
    skillsDir = resolve(PACKAGE_ROOT, 'skills'),
    metaDir = resolve(PACKAGE_ROOT, 'meta'),
  } = options;
  const diagnostics = [];
  let combinationsChecked = 0;
  let filesChecked = 0;

  for (const ideId of ides) {
    for (const scope of scopes) {
      combinationsChecked += 1;
      let files;
      try {
        files = computeSkillsFileSet({
          language,
          ides: [ideId],
          modules,
          skillsDir,
          metaDir,
          scope,
        });
      } catch (error) {
        diagnostics.push(`[${ideId}/${scope}] ${error.message}`);
        continue;
      }

      filesChecked += files.length;
      const installedPaths = new Set(files.map((file) => file.path));
      const installedPathList = [...installedPaths];
      const assetsDir = getAssetsDir(ideId);
      const renderedAssetsDir = scope === 'user' ? `~/${assetsDir}` : assetsDir;

      for (const file of files) {
        for (const sourceReference of uniqueMatches(
          file.content,
          /skills\/shared\/[A-Za-z0-9_./-]+/g,
        )) {
          diagnostics.push(
            `[${ideId}/${scope}] ${file.path}: source-tree reference '${sourceReference}'`,
          );
        }

        if (file.content.includes('{{ASSETS_PATH}}')) {
          diagnostics.push(
            `[${ideId}/${scope}] ${file.path}: unresolved template '{{ASSETS_PATH}}'`,
          );
        }

        for (const renderedReference of extractAssetReferences(file.content, renderedAssetsDir)) {
          const installedReference = renderedReference.startsWith('~/')
            ? renderedReference.slice(2)
            : renderedReference;
          const target = installedReference.replace(/\/$/, '');
          const resolves = resolvesInstalledReference(target, installedPaths, installedPathList);
          if (!resolves) {
            diagnostics.push(
              `[${ideId}/${scope}] ${file.path}: unresolved runtime asset '${renderedReference}'`,
            );
          }
        }
      }
    }
  }

  return {
    ok: diagnostics.length === 0,
    diagnostics,
    combinationsChecked,
    filesChecked,
  };
}

function uniqueMatches(content, pattern) {
  return [...new Set([...content.matchAll(pattern)].map((match) =>
    match[0].replace(/[).,;:]+$/, ''),
  ))];
}

function extractAssetReferences(content, renderedAssetsDir) {
  const escapedBase = renderedAssetsDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escapedBase}(?:\/[A-Za-z0-9_.*?-]+)*\/?`, 'g');
  return uniqueMatches(content, pattern);
}

function resolvesInstalledReference(target, installedPaths, installedPathList) {
  if (target.includes('*') || target.includes('?')) {
    const escaped = target.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `^${escaped.replaceAll('*', '[^/]*').replaceAll('?', '[^/]')}$`,
    );
    return installedPathList.some((path) => pattern.test(path));
  }
  return installedPaths.has(target)
    || installedPathList.some((path) => path.startsWith(`${target}/`));
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const result = validateRuntimeClosure();
  if (!result.ok) {
    console.error(result.diagnostics.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `Runtime closure valid: ${result.combinationsChecked} IDE/scope combinations, ` +
      `${result.filesChecked} rendered files checked.`,
    );
  }
}
