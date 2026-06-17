import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

import { hashContent } from '../hash.js';

export const classifyFile = ({ installedHash, currentHash, newHash }) => {
  if (currentHash === installedHash) {
    return 'unchanged';
  }

  if (installedHash === newHash) {
    return 'keep-local';
  }

  return 'conflict';
};

const pruneEmptyParents = (absPath, basePath) => {
  let parent = dirname(absPath);

  while (parent !== basePath && parent !== '.') {
    try {
      if (readdirSync(parent).length === 0) {
        rmdirSync(parent);
        parent = dirname(parent);
      } else {
        break;
      }
    } catch {
      break;
    }
  }
};

export const createReconcileFileSetEffect = () => ({
  type: 'reconcileFileSet',

  apply({ basePath, desired }) {
    return desired.map(({ path, content }) => {
      const absPath = join(basePath, path);
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, content, 'utf8');

      return {
        path,
        installedHash: hashContent(content),
      };
    });
  },

  revert({ basePath }, beforeState) {
    for (const { path, installedHash } of beforeState) {
      const absPath = join(basePath, path);
      if (!existsSync(absPath)) continue;

      const currentHash = hashContent(readFileSync(absPath, 'utf8'));
      if (currentHash === installedHash) {
        unlinkSync(absPath);
        pruneEmptyParents(absPath, basePath);
      }
    }
  },
});
