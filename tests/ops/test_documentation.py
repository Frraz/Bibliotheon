"""Run the real documentation validator, including a swapped-document regression."""
import contextlib
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('bibliotheon_documentation', ROOT / 'scripts/validar_documentacao.py')
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)


class DocumentationChecks(unittest.TestCase):
    def test_current_package_passes(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            result = VALIDATOR.main()
        self.assertEqual(result, 0, output.getvalue())

    def test_rejects_metrics_copied_over_decisions_without_mutating_files(self):
        original_read = Path.read_text
        decisions = ROOT / 'docs/17-decisoes.md'

        def controlled_read(path, *args, **kwargs):
            text = original_read(path, *args, **kwargs)
            if path == decisions:
                return text.replace('# 17 — Registro de decisões', '# 09 — Medição e decisões', 1)
            return text

        output = io.StringIO()
        with patch.object(Path, 'read_text', autospec=True, side_effect=controlled_read), contextlib.redirect_stdout(output):
            result = VALIDATOR.main()
        self.assertEqual(result, 1)
        self.assertIn('Número/título incompatível: docs/17-decisoes.md', output.getvalue())
        self.assertTrue(original_read(decisions).startswith('# 17 — Registro de decisões'))


if __name__ == '__main__':
    unittest.main()
