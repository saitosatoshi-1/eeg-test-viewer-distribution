#!/usr/bin/env python3
"""Run all repository tests. / unittest・関数形式・Nodeを一括検証する。"""
from __future__ import annotations

import argparse
import importlib
import inspect
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def function_case(function) -> unittest.FunctionTestCase:
    parameters = inspect.signature(function).parameters
    unsupported = set(parameters) - {"tmp_path"}
    if unsupported:
        raise ValueError(f"Unsupported test fixtures: {function.__name__}: {sorted(unsupported)}")

    def run():
        with tempfile.TemporaryDirectory(prefix="eeg-check-") as directory:
            function(**({"tmp_path": Path(directory)} if "tmp_path" in parameters else {}))

    return unittest.FunctionTestCase(run, description=f"{function.__module__}.{function.__name__}")


def python_suite() -> unittest.TestSuite:
    tests = ROOT / "tests"
    suite = unittest.defaultTestLoader.discover(str(tests), pattern="test_*.py")
    for path in sorted(tests.glob("test_*.py")):
        module = importlib.import_module(path.stem)
        for name, function in inspect.getmembers(module, inspect.isfunction):
            if name.startswith("test_") and function.__module__ == module.__name__:
                suite.addTest(function_case(function))
    return suite


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--node", default=os.environ.get("EEG_VIEWER_NODE", "node"))
    args = parser.parse_args()
    os.chdir(ROOT)
    python_ok = unittest.TextTestRunner(verbosity=2).run(python_suite()).wasSuccessful()
    node = shutil.which(args.node)
    if not node:
        print("Node not found; checks incomplete. / --nodeで実行パスを指定してください。", file=sys.stderr)
        raise SystemExit(1)
    scripts = sorted(set((ROOT / "tests").glob("*.test.js")) | set((ROOT / "tests").glob("test_*.js")) | set((ROOT / "tests").glob("test_*.mjs")))
    if not scripts:
        raise RuntimeError("No Node tests found")
    node_ok = subprocess.run([node, "--test", *map(str, scripts)], cwd=ROOT).returncode == 0
    from tools.check_dataset_config import check_dataset_config
    config = check_dataset_config(ROOT)
    print("Dataset configuration:", config)
    raise SystemExit(0 if python_ok and node_ok and config["ok"] else 1)


if __name__ == "__main__":
    main()
