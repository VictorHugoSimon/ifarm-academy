#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
MODULE_PATH = ROOT / "smoke_stage.py"
spec = importlib.util.spec_from_file_location("smoke_stage", MODULE_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("não foi possível carregar smoke_stage.py")
smoke = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = smoke
spec.loader.exec_module(smoke)

HttpResult = smoke.HttpResult
normalize_base_url = smoke.normalize_base_url
run_smoke = smoke.run_smoke


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def test_url_policy() -> None:
    expect(normalize_base_url("https://academy-stage.ifarm.agr.br/") == "https://academy-stage.ifarm.agr.br", "HTTPS normalizado")
    expect(normalize_base_url("http://localhost:8788") == "http://localhost:8788", "localhost HTTP permitido")
    try:
        normalize_base_url("http://academy-stage.ifarm.agr.br")
    except ValueError:
        pass
    else:
        raise AssertionError("host remoto HTTP deve ser rejeitado")


def test_public_smoke_without_token() -> None:
    calls: list[tuple[str, str | None]] = []

    def fake(url: str, token: str | None) -> HttpResult:
        calls.append((url, token))
        if url.endswith("/api/health"):
            return HttpResult(200, "application/json", {"service": "ifarm-academy"})
        if url.endswith("/api/readiness"):
            return HttpResult(200, "application/json", {
                "status": "ready",
                "identityMode": "core_api",
                "release": "0.52.0",
                "checks": {
                    "database": True,
                    "identityBoundary": True,
                    "coreIdentityConfigured": True,
                    "storage": True,
                },
            })
        if url.endswith("/"):
            return HttpResult(200, "text/html", None)
        raise AssertionError(f"request inesperado: {url}")

    errors = run_smoke("https://academy-stage.ifarm.agr.br", expected_release="0.52.0", request_fn=fake)
    expect(errors == [], f"smoke público deveria passar: {errors}")
    expect(all(token is None for _, token in calls), "token não deve ir para endpoints públicos")
    expect(len(calls) == 3, "sem token não deve chamar endpoints protegidos")


def test_authenticated_smoke() -> None:
    seen_protected = 0

    def fake(url: str, token: str | None) -> HttpResult:
        nonlocal seen_protected
        if url.endswith("/api/health"):
            return HttpResult(200, "application/json", {"service": "ifarm-academy"})
        if url.endswith("/api/readiness"):
            return HttpResult(200, "application/json", {
                "status": "ready",
                "identityMode": "core_api",
                "checks": {
                    "database": True,
                    "identityBoundary": True,
                    "coreIdentityConfigured": True,
                    "storage": True,
                },
            })
        if url.endswith("/"):
            return HttpResult(200, "text/html", None)
        if url.endswith("/api/core-session"):
            seen_protected += 1
            expect(token == "secret-test-token", "Bearer deve ser usado apenas no check protegido")
            return HttpResult(200, "application/json", {"tenantId": "22222222-2222-4222-8222-222222222222"})
        if url.endswith("/api/core-context"):
            seen_protected += 1
            expect(token == "secret-test-token", "Bearer deve ser usado apenas no check protegido")
            return HttpResult(200, "application/json", {"data": {"identitySource": "core_api", "tenantId": "22222222-2222-4222-8222-222222222222"}})
        raise AssertionError(f"request inesperado: {url}")

    errors = run_smoke("https://academy-stage.ifarm.agr.br", bearer_token="secret-test-token", request_fn=fake)
    expect(errors == [], f"smoke autenticado deveria passar: {errors}")
    expect(seen_protected == 2, "checks protegidos deveriam ser executados")


def test_rejects_legacy_identity_in_stage() -> None:
    def fake(url: str, token: str | None) -> HttpResult:
        if url.endswith("/api/health"):
            return HttpResult(200, "application/json", {"service": "ifarm-academy"})
        if url.endswith("/api/readiness"):
            return HttpResult(200, "application/json", {
                "status": "ready",
                "identityMode": "legacy_proxy",
                "checks": {
                    "database": True,
                    "identityBoundary": True,
                    "coreIdentityConfigured": False,
                    "storage": True,
                },
            })
        return HttpResult(200, "text/html", None)

    errors = run_smoke("https://academy-stage.ifarm.agr.br", request_fn=fake)
    expect("readiness_identity_not_core" in errors, "STAGE não pode homologar identityMode legado")
    expect("readiness_dependency_check_failed" in errors, "Core ausente deve falhar dependency check")


def main() -> int:
    test_url_policy()
    test_public_smoke_without_token()
    test_authenticated_smoke()
    test_rejects_legacy_identity_in_stage()
    print("Stage readiness contract: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
