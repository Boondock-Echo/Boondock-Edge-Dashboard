const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SRC = path.join(process.cwd(), 'src');

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.[jt]sx?$/.test(entry.name) ? [entryPath] : [];
  });
}

function findViolations(patterns) {
  const violations = [];
  for (const file of sourceFiles(SRC)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const [name, pattern] of patterns) {
      if (pattern.test(source)) {
        violations.push(`${path.relative(process.cwd(), file)}: ${name}`);
      }
    }
  }
  return violations;
}

test('API calls use the centralized client base URL', () => {
  const violations = findViolations([
    ['manual API base prefix', /(?:apiFetch|api\.(?:get|post|put|patch|delete|request))\(\s*`\$\{(?:edgeServerEndpoint|API_BASE_URL|apiBaseUrl|apiBase|base)\}\//],
    ['hard-coded /api prefix', /(?:apiFetch|api\.(?:get|post|put|patch|delete|request))\(\s*[`'"]\/api\//],
  ]);

  expect(violations).toEqual([]);
});

test('retired dashboard API contracts and cache keys are gone', () => {
  const violations = findViolations([
    ['retired inbox range endpoint', /\/recordings\/inbox\/range/],
    ['retired inbox count endpoint', /\/recordings\/inbox\/count/],
    ['retired maintenance settings endpoint', /\/maintenance\/settings/],
    ['retired available ports endpoint', /\/available-ports/],
    ['retired v1 channels endpoint', /\/v1\/channels/],
    ['retired singular channel endpoint', /[`'"]\/channel(?:\/|[`'"])/],
    ['retired pagination preferences endpoint', /\/pagination-preferences/],
    ['retired profiles endpoint', /\/profiles(?:\/|[`'"])/],
    ['retired cached time format', /cached_time_format/],
    ['retired report density localStorage', /reports_density_mode/],
    ['retired global inbox setting', /global_inbox_/],
    ['retired global transcription setting', /global_transcribe_/],
  ]);

  expect(violations).toEqual([]);
});
