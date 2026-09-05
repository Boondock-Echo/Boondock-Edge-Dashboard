import fs from 'fs';
import path from 'path';

const sourceFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const entryPath = path.join(directory, entry.name);
  if (entry.isDirectory()) return sourceFiles(entryPath);
  return entry.name.endsWith('.js') ? [entryPath] : [];
});

test('API calls rely on the centralized client for the base URL', () => {
  const manuallyPrefixedCall = /(?:apiFetch|api\.(?:get|post|put|patch|delete|request))\(\s*`\$\{(?:edgeServerEndpoint|API_BASE_URL|apiBaseUrl|apiBase|base)\}/;
  const hardCodedApiPrefix = /(?:apiFetch|api\.(?:get|post|put|patch|delete|request))\(\s*[`'"]\/api\//;
  const violations = sourceFiles(path.join(process.cwd(), 'src')).filter((file) => (
    [manuallyPrefixedCall, hardCodedApiPrefix].some((pattern) => (
      pattern.test(fs.readFileSync(file, 'utf8'))
    ))
  ));

  expect(violations).toEqual([]);
});

test('the API endpoint is not passed through component props or auth context', () => {
  const allowedEndpointOwners = new Set([
    path.join(process.cwd(), 'src', 'App.js'),
    path.join(process.cwd(), 'src', 'utils', 'apiClient.js'),
  ]);
  const violations = sourceFiles(path.join(process.cwd(), 'src')).filter((file) => {
    if (allowedEndpointOwners.has(file)) return false;
    return /edgeServerEndpoint|apiBaseUrl|API_BASE_URL/.test(fs.readFileSync(file, 'utf8'));
  });

  expect(violations).toEqual([]);
});
