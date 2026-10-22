"""Runner fixture contracts. / 一括実行時の取りこぼし防止。"""
import unittest

from tools.run_checks import function_case


class CheckRunnerTests(unittest.TestCase):
    def test_tmp_path_fixture_is_supplied_and_cleaned(self):
        paths = []

        def sample(tmp_path):
            paths.append(tmp_path)
            self.assertTrue(tmp_path.is_dir())
            (tmp_path / "synthetic.txt").write_text("synthetic")

        result = unittest.TestResult()
        function_case(sample).run(result)
        self.assertTrue(result.wasSuccessful())
        self.assertFalse(paths[0].exists())

    def test_unknown_fixture_is_not_silently_skipped(self):
        def sample(unknown_fixture):
            pass

        with self.assertRaises(ValueError):
            function_case(sample)

    def test_function_failure_is_reported(self):
        def sample():
            raise AssertionError("synthetic failure")

        result = unittest.TestResult()
        function_case(sample).run(result)
        self.assertFalse(result.wasSuccessful())
        self.assertEqual(len(result.failures), 1)
