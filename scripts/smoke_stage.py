#!/usr/bin/env python3
"""Smoke test seguro da iFarm Academy STAGE.

Uso:
  ACADEMY_STAGE_URL=https://academy-stage.ifarm.agr.br python3 scripts/smoke_stage.py

Opcional para validar sessão real:
  ACADEMY_STAGE_BEARER_TOKEN=<token> python3 scripts/smoke_stage.py

O token nunca é impresso. Este script não cria, altera ou remove recursos.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Callable, Optional


@dataclass(frozen=True)
class HttpResult:
    status: int
    content_type: str
    payload: object | None


def normalize_base_url(value: str) -> str:
    raw = (value or "").strip().rstrip("/")
    parsed = urllib.parse.urlparse(raw)
    local = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError("ACADEMY_STAGE_URL inválida")
    if parsed.scheme != "https" and not (local and parsed.scheme == "http"):
        raise ValueError("ACADEMY_STAGE_URL deve usar HTTPS")
    return raw


def http_get(url: str, bearer_token: Optional[str] = None, timeout: float = 8.0) -> HttpResult:
    headers = {"accept": "application/json,text/html;q=0.9"}
    if bearer_token:
        headers["authorization"] = f"Bearer {bearer_token}"
    request = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
            content_type = response.headers.get("content-type", "")
            payload = None
            if "application/json" in content_type:
                payload = json.loads(body)
            return HttpResult(response.status, content_type, payload)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        content_type = error.headers.get("content-type", "") if error.headers else ""
        payload = None
        if "application/json" in content_type and body:
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                payload = None
        return HttpResult(error.code, content_type, payload)


def run_smoke(
    base_url: str,
    bearer_token: Optional[str] = None,
    expected_release: Optional[str] = None,
    request_fn: Callable[[str, Optional[str]], HttpResult] = http_get,
) -> list[str]:
    base = normalize_base_url(base_url)
    errors: list[str] = []

    health = request_fn(f"{base}/api/health", None)
    if health.status != 200:
        errors.append(f"health_http_{health.status}")
    elif not isinstance(health.payload, dict) or health.payload.get("service") != "ifarm-academy":
        errors.append("health_contract_invalid")

    readiness = request_fn(f"{base}/api/readiness", None)
    if readiness.status != 200:
        errors.append(f"readiness_http_{readiness.status}")
    elif not isinstance(readiness.payload, dict):
        errors.append("readiness_contract_invalid")
    else:
        if readiness.payload.get("status") != "ready":
            errors.append("readiness_not_ready")
        if readiness.payload.get("identityMode") != "core_api":
            errors.append("readiness_identity_not_core")
        checks = readiness.payload.get("checks")
        if not isinstance(checks, dict) or checks.get("database") is not True or checks.get("identityBoundary") is not True or checks.get("coreIdentityConfigured") is not True or checks.get("storage") is not True:
            errors.append("readiness_dependency_check_failed")
        if expected_release and readiness.payload.get("release") != expected_release:
            errors.append("readiness_release_mismatch")

    portal = request_fn(f"{base}/", None)
    if portal.status != 200:
        errors.append(f"portal_http_{portal.status}")

    if bearer_token:
        session = request_fn(f"{base}/api/core-session", bearer_token)
        if session.status != 200:
            errors.append(f"core_session_http_{session.status}")
        elif not isinstance(session.payload, dict) or not session.payload.get("tenantId"):
            errors.append("core_session_tenant_missing")

        context = request_fn(f"{base}/api/core-context", bearer_token)
        if context.status != 200:
            errors.append(f"core_context_http_{context.status}")
        elif not isinstance(context.payload, dict):
            errors.append("core_context_invalid")
        else:
            data = context.payload.get("data")
            if not isinstance(data, dict) or data.get("identitySource") != "core_api" or not data.get("tenantId"):
                errors.append("core_context_not_verified")

    return errors


def main() -> int:
    stage_url = os.environ.get("ACADEMY_STAGE_URL", "")
    if not stage_url:
        print("ERRO: defina ACADEMY_STAGE_URL.", file=sys.stderr)
        return 2
    token = os.environ.get("ACADEMY_STAGE_BEARER_TOKEN") or None
    expected_release = os.environ.get("ACADEMY_STAGE_EXPECTED_RELEASE") or None
    try:
        errors = run_smoke(stage_url, token, expected_release)
    except Exception as error:
        print(f"STAGE smoke: FALHOU ({type(error).__name__})", file=sys.stderr)
        return 1

    if errors:
        print("STAGE smoke: FALHOU")
        for code in errors:
            print(f"- {code}")
        return 1

    print("STAGE smoke: PASS")
    print("- health/readiness/portal: OK")
    print(f"- sessão autenticada: {'OK' if token else 'não executada (token opcional)'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
