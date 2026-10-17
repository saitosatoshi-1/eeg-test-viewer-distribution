"""Synthetic throttling tests. / 実コード・IP・本番を使わない試験。"""
from concurrent.futures import ThreadPoolExecutor
import unittest
from viewer_security import CredentialAttemptLimiter


class LoginLimiterTests(unittest.TestCase):
    def test_peer_global_expiry_and_bounded_storage(self):
        now = [0.0]
        limiter = CredentialAttemptLimiter(per_peer=2, total=3, period=60, clock=lambda: now[0])
        self.assertEqual(limiter.reserve("peer-a"), 0)
        self.assertEqual(limiter.reserve("peer-a"), 0)
        self.assertEqual(limiter.reserve("peer-a"), 60)
        self.assertEqual(limiter.reserve("peer-b"), 0)
        self.assertEqual(limiter.reserve("peer-c"), 60)
        self.assertEqual(len(limiter._events), 3)
        self.assertNotIn("peer-a", repr(limiter._events))
        now[0] = 60
        self.assertEqual(limiter.reserve("peer-a"), 0)

    def test_parallel_reservations_cannot_exceed_budget(self):
        limiter = CredentialAttemptLimiter(per_peer=5, total=8)
        with ThreadPoolExecutor(max_workers=16) as pool:
            results = list(pool.map(limiter.reserve, ["synthetic"] * 50))
        self.assertEqual(results.count(0), 5)

    def test_success_does_not_exhaust_budget_or_clear_prior_failure(self):
        limiter = CredentialAttemptLimiter(per_peer=2)
        self.assertEqual(limiter.attempt("peer", lambda: False), (False, 0))
        for _ in range(50):
            self.assertEqual(limiter.attempt("peer", lambda: True), (True, 0))
        self.assertEqual(len(limiter._events), 1)
        self.assertEqual(limiter.attempt("peer", lambda: False), (False, 0))
        compared = []
        matched, retry = limiter.attempt("peer", lambda: compared.append(True))
        self.assertFalse(matched)
        self.assertGreater(retry, 0)
        self.assertEqual(compared, [])


if __name__ == "__main__":
    unittest.main()
