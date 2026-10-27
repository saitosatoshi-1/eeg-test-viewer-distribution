#!/usr/bin/env python3
"""CA diagnostics without research data. / 研究データを扱わない証明書検査。"""
from __future__ import annotations

import argparse
import importlib.metadata
import json
import re
import ssl
from urllib.error import HTTPError, URLError
from urllib.request import HTTPSHandler, HTTPRedirectHandler, Request, build_opener

CONTROL_URL = "https://render.com/"
REJECT_URLS = (
    "https://dv-g3b-emudhra.we-have-a-problem.com/",
    "https://dv-g3b-aaa-emudhra.we-have-a-problem.com/",
)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def certificate_result(error: ssl.SSLCertVerificationError) -> str:
    # Expiry and hostname mismatch do not prove CA distrust.
    # 期限切れ・ホスト名不一致をCA失効対策の成功と誤認しない。
    code = getattr(error, "verify_code", None)
    return f"trust_rejected:{code}" if code in {20, 21, 23, 27, 28} else f"unconfirmed_certificate_error:{code}"


def contains_old_emsign_root(context) -> bool:
    return any(value == "emSign ECC Root CA - G3"
               for certificate in context.get_ca_certs()
               for rdn in certificate.get("subject", ())
               for key, value in rdn if key == "commonName")


def probe(opener, url: str) -> str:
    """Only a verification error proves rejection. / DNS・timeoutは拒否成功扱いしない。"""
    try:
        with opener.open(Request(url, headers={"User-Agent": "EEG-Viewer-CA-Check/1.0"}), timeout=15):
            return "tls_accepted"
    except HTTPError:
        # HTTP errors also prove the TLS handshake succeeded. / HTTPエラーもTLS受入を意味する。
        return "tls_accepted"
    except URLError as error:
        return certificate_result(error.reason) if isinstance(error.reason, ssl.SSLCertVerificationError) else "unconfirmed"
    except ssl.SSLCertVerificationError as error:
        return certificate_result(error)
    except (OSError, TimeoutError):
        return "unconfirmed"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--network", action="store_true", help="Probe only the fixed advisory endpoints / 固定された公式案内先だけに検査通信")
    args = parser.parse_args()
    try:
        import certifi
        version = importlib.metadata.version("certifi")
    except ImportError:
        raise SystemExit("certifi is missing. / requirements.txtを再インストールしてください。")
    match = re.fullmatch(r"(\d{4})\.(\d+)\.(\d+)(?:\.post\d+)?", version)
    version_ok = bool(match) and tuple(map(int, match.groups())) >= (2026, 10, 19)
    report = {"certifiVersion": version, "certifiVersionOk": version_ok,
              "defaultTrustPaths": ssl.get_default_verify_paths()._asdict(),
              "networkChecked": args.network}
    ok = version_ok
    if args.network:
        rows = {}
        # Default urllib trust mirrors the viewer; certifi covers bundled-client trust.
        # viewerと同じurllib既定経路と、certifi同梱経路の両方を確認する。
        for name, context in (("system", ssl.create_default_context()), ("certifi", ssl.create_default_context(cafile=certifi.where()))):
            opener = build_opener(NoRedirect(), HTTPSHandler(context=context))
            checks = {url: probe(opener, url) for url in (CONTROL_URL, *REJECT_URLS)}
            rows[name] = checks
            checks["oldEmSignG3RootPresent"] = contains_old_emsign_root(context)
            ok = ok and not checks["oldEmSignG3RootPresent"] and checks[CONTROL_URL] == "tls_accepted" and all(checks[url].startswith("trust_rejected:") for url in REJECT_URLS)
        report["checks"] = rows
        report["verified"] = bool(ok)
    else:
        report["status"] = "configuration_only; rerun --network in the deployed service"
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
