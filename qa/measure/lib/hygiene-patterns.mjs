/**
 * Comment and secret patterns for qa/measure/hygiene.
 *
 * This folder is outside every stack root, so the pattern text here can never
 * be reported against the repository during a real measurement.
 */

export const SUPPRESSIONS = [
  'eslint-disable',
  '@ts-ignore',
  '@ts-expect-error',
  '@ts-nocheck',
  'c8 ignore',
  'istanbul ignore',
  'noqa',
  'type: ignore',
  'nosec',
  'pragma: no cover',
  'pylint: disable',
  'fmt: off',
  'shellcheck disable',
];

export const SECRETS = [
  /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\b(?:ghp_|gho_|ghs_)[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bnpm_[A-Za-z0-9]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /(?:^|[^\w$])([A-Za-z_$][\w$.-]*(?:secret|token|password|api_key)[\w$.-]*|(?:secret|token|password|api_key)[\w$.-]*)\s*[:=]\s*(['"`])([^'"`\r\n]{20,})\2/gim,
];
