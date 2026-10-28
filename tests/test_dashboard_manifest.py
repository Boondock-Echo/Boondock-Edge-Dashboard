"""Verify the installer copies workflow metadata into its persistent manifest."""
import json
import os
from pathlib import Path
import pwd
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / 'install.sh').read_text().split("<<'MANIFEST_PY'\n", 1)[1].split('\nMANIFEST_PY', 1)[0]


class DashboardManifestTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.build = self.root / 'build-info.json'
        self.manifest = self.root / 'manifest.json'
        self.info = {
            'component': 'dashboard', 'version': '2.0.0-beta.02',
            'display_name': 'Dashboard preview two', 'git_tag': 'v2.0.0-beta.02',
            'git_commit': 'a' * 40, 'built_at': '2026-10-27T00:00:00Z',
            'repository': 'Boondock-Echo/Boondock-Edge-Dashboard',
            'extra_workflow_field': {'preserve': True},
        }
        self.build.write_text(json.dumps(self.info))

    def update(self):
        user = pwd.getpwuid(os.getuid()).pw_name
        with patch.object(sys, 'argv', ['installer', str(self.build), str(self.manifest), user]):
            exec(compile(SOURCE, 'install.sh:update_dashboard_manifest', 'exec'), {'__name__': '__main__'})

    def test_creates_manifest_from_workflow_metadata_without_changing_build_file(self):
        original = self.build.read_bytes()
        self.update()
        self.assertEqual(json.loads(self.manifest.read_text()), {'dashboard': self.info})
        self.assertEqual(self.build.read_bytes(), original)
        self.assertEqual(self.manifest.stat().st_mode & 0o777, 0o600)

    def test_replaces_only_dashboard_and_preserves_existing_permissions(self):
        original = {'api': {'version': '1.0.0'}, 'device_id': 'edge-123', 'dashboard': {'version': 'old'}}
        self.manifest.write_text(json.dumps(original))
        self.manifest.chmod(0o640)
        self.update()
        self.assertEqual(json.loads(self.manifest.read_text()), {**original, 'dashboard': self.info})
        self.assertEqual(self.manifest.stat().st_mode & 0o777, 0o640)

    def test_failed_replace_preserves_manifest_and_removes_temporary_file(self):
        self.manifest.write_text('{"api":{"version":"old"}}\n')
        original = self.manifest.read_bytes()
        with patch('os.replace', side_effect=OSError('simulated disk failure')):
            with self.assertRaises(OSError):
                self.update()
        self.assertEqual(self.manifest.read_bytes(), original)
        self.assertEqual(list(self.root.glob('.manifest-*')), [])

    def test_missing_build_information_does_not_change_manifest(self):
        self.manifest.write_text('{"api":{"version":"old"}}')
        original = self.manifest.read_bytes()
        self.build.unlink()
        with self.assertRaises(FileNotFoundError):
            self.update()
        self.assertEqual(self.manifest.read_bytes(), original)

    def test_malformed_manifest_is_preserved(self):
        self.manifest.write_text('invalid json')
        with self.assertRaises(ValueError):
            self.update()
        self.assertEqual(self.manifest.read_text(), 'invalid json')

    def test_api_build_information_is_not_recorded_as_dashboard(self):
        self.build.write_text(json.dumps({**self.info, 'component': 'api'}))
        with self.assertRaises(ValueError):
            self.update()
        self.assertFalse(self.manifest.exists())


if __name__ == '__main__':
    unittest.main()
