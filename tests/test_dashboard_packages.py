"""Run the workflow's real packaging scripts against fixture dashboard assets."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = (ROOT / '.github/workflows/publish-release.yml').read_text()


def script(name):
    step = WORKFLOW.split(f'      - name: {name}\n', 1)[1].split('\n      - name:', 1)[0]
    block = step.split('        run: |\n', 1)[1]
    return '\n'.join(line[10:] if line.startswith('          ') else line for line in block.splitlines())


class DashboardPackageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        (self.root / 'build/static').mkdir(parents=True)
        (self.root / 'build/index.html').write_text('<html>dashboard fixture</html>')
        (self.root / 'build/static/app.js').write_text('window.dashboard = true;')
        self.env = {
            **os.environ, 'RUNNER_TEMP': str(self.root / 'runner'),
            'GITHUB_ENV': str(self.root / 'github-env'), 'RELEASE_TYPE': 'numbered',
            'VERSION': '2.0.0-beta.02', 'TAG': 'v2.0.0-beta.02',
            'COMMIT': 'a' * 40, 'DISPLAY_NAME': 'Dashboard Preview Two',
            'REPOSITORY': 'Boondock-Echo/Boondock-Edge-Dashboard',
            'RUN_ID': '42', 'RUN_ATTEMPT': '1',
        }

    def run_step(self, name):
        result = subprocess.run(['bash', '-c', script(name)], cwd=self.root, env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        if (self.root / 'github-env').exists():
            for line in (self.root / 'github-env').read_text().splitlines():
                key, value = line.split('=', 1)
                self.env[key] = value

    def package(self):
        for name in ('Generate build metadata', 'Assemble Dashboard package', 'Verify package contents'):
            self.run_step(name)
        return self.root / self.env['ARCHIVE']

    def test_numbered_archive_has_build_info_and_no_installation_manifest(self):
        archive = self.package()
        with tarfile.open(archive) as package:
            members = package.getnames()
            self.assertIn('dashboard/index.html', members)
            self.assertIn('dashboard/static/app.js', members)
            self.assertNotIn('manifest.json', members)
            info = json.load(package.extractfile('dashboard/build-info.json'))
        self.assertEqual(info['git_tag'], 'v2.0.0-beta.02')
        self.assertEqual(info['component'], 'dashboard')
        self.assertEqual(info['repository'], self.env['REPOSITORY'])
        self.assertEqual(info['version'], '2.0.0-beta.02')
        self.assertEqual(info['display_name'], 'Dashboard Preview Two')

    def test_latest_is_identical_to_numbered_prerelease(self):
        archive = self.package()
        self.run_step('Build latest release asset')
        latest = self.root / self.env['LATEST_ARCHIVE']
        self.assertEqual(latest.read_bytes(), archive.read_bytes())
        checksum = (self.root / self.env['LATEST_CHECKSUM']).read_text().split()
        self.assertEqual(checksum, [hashlib.sha256(latest.read_bytes()).hexdigest(), latest.name])
        with tarfile.open(latest) as package:
            self.assertEqual(json.load(package.extractfile('dashboard/build-info.json'))['git_tag'], 'v2.0.0-beta.02')

    def test_beta_machine_version_is_independent_of_display_name(self):
        binary = self.root / 'bin'
        binary.mkdir()
        git = binary / 'git'
        git.write_text('#!/bin/sh\nprintf "%s\\n" aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n')
        git.chmod(0o755)
        output = self.root / 'outputs'
        self.env.update(RELEASE_TYPE='beta', VERSION_INPUT='', GITHUB_RUN_NUMBER='42', GITHUB_RUN_ATTEMPT='2',
                        GITHUB_OUTPUT=str(output), PATH=str(binary) + os.pathsep + self.env['PATH'])
        self.run_step('Determine release metadata')
        values = dict(line.split('=', 1) for line in output.read_text().splitlines())
        self.assertEqual(values['tag'], 'beta')
        self.assertEqual(values['version'], '0.0.0-beta.42.2+aaaaaaaaaaaa')
        self.assertNotEqual(values['version'], self.env['DISPLAY_NAME'])


if __name__ == '__main__':
    unittest.main()
