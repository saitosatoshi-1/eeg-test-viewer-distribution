"""Secure operator transfers. / 管理用転送のHTTPS・送信先制限。"""
from __future__ import annotations

import getpass
import ipaddress
import urllib.parse
import urllib.request
from urllib.error import URLError


def secure_viewer_url(value: str) -> str:
    url = str(value).rstrip("/")
    parsed = urllib.parse.urlsplit(url)
    host = parsed.hostname or ""
    try:
        local = host == "localhost" or ipaddress.ip_address(host).is_loopback
    except ValueError:
        local = host == "localhost"
    if not host or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("Use a viewer URL without credentials, query or fragment.")
    if parsed.scheme != "https" and not (parsed.scheme == "http" and local):
        raise ValueError("Remote viewer transfers require HTTPS. / 外部宛て転送はHTTPSが必要です。")
    _ = parsed.port
    return url


def origin(url: str) -> tuple[str, str, int]:
    parsed = urllib.parse.urlsplit(secure_viewer_url(url))
    return parsed.scheme, parsed.hostname or "", parsed.port or (443 if parsed.scheme == "https" else 80)


class SameOriginRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, base: str):
        self.allowed_origin = origin(base)

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        try:
            if origin(newurl) != self.allowed_origin:
                raise ValueError("Cross-origin redirect")
        except ValueError as exc:
            raise URLError("Unsafe viewer redirect blocked. / 別の送信先への転送を拒否しました。") from exc
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def secure_opener(base: str) -> urllib.request.OpenerDirector:
    return urllib.request.build_opener(SameOriginRedirect(base), urllib.request.HTTPCookieProcessor())


def access_code(value: str) -> str:
    return value or getpass.getpass("Viewer access code / 参加者用コード: ")
