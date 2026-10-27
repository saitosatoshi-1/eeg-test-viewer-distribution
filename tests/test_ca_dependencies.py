"""TLS build configuration contracts. / 証明書更新の設定回帰テスト。"""
from pathlib import Path
import unittest
import ssl
from urllib.error import HTTPError, URLError

from tools.check_tls_trust import probe


ROOT = Path(__file__).resolve().parents[1]


class CertificateDependencyTests(unittest.TestCase):
    def test_system_and_bundled_trust_are_both_updated(self):
        dockerfile = (ROOT / "Dockerfile").read_text(encoding="utf-8")
        requirements = (ROOT / "requirements.txt").read_text(encoding="utf-8")
        self.assertIn("ca-certificates", dockerfile)
        self.assertIn("update-ca-certificates", dockerfile)
        self.assertIn("certifi>=2026.10.19", requirements.splitlines())

    def test_scientific_dependencies_remain_pinned(self):
        requirements = (ROOT / "requirements.txt").read_text(encoding="utf-8").splitlines()
        for dependency in ("mne==1.11.0", "edfio==0.4.13", "numpy==2.2.6", "scipy==1.15.3", "pandas==2.2.3"):
            self.assertIn(dependency, requirements)

    def test_only_certificate_failure_counts_as_rejection(self):
        class Opener:
            def __init__(self, error):
                self.error = error

            def open(self, *args, **kwargs):
                raise self.error

        url = "https://synthetic.example.invalid/"
        error = ssl.SSLCertVerificationError("synthetic")
        error.verify_code = 20
        self.assertEqual(probe(Opener(URLError(error)), url), "trust_rejected:20")
        for code in (10, 62):
            error.verify_code = code
            self.assertEqual(probe(Opener(URLError(error)), url), f"unconfirmed_certificate_error:{code}")
        self.assertEqual(probe(Opener(URLError("DNS failure")), url), "unconfirmed")
        self.assertEqual(probe(Opener(TimeoutError()), url), "unconfirmed")
        self.assertEqual(probe(Opener(HTTPError(url, 500, "synthetic", {}, None)), url), "tls_accepted")
