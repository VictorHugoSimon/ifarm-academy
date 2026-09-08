#!/usr/bin/env python3
"""Provisiona e publica a iFarm Academy em Cloudflare Pages/D1/R2.

Este script aceita somente os ambientes oficiais da Academy e cria/reutiliza
recursos cujo nome pertence ao namespace `ifarm-academy`. Nenhum ID de recurso
externo é aceito como argumento.

Credenciais são recebidas exclusivamente por variáveis de ambiente do runner:
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID

O script nunca imprime token nem secrets gerados.
"""
from __future__ import annotations

import argparse
import json
import os
import secrets
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

API = "https://api.cloudflare.com/client/v4"
WRANGLER = ["npx", "--yes", "wrangler@4.35.0"]
ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / ".wrangler-academy-deploy.toml"


@dataclass(frozen=True)
class Target:
    name: str
    project: str
    database: str
    bucket: str
    branch: str
    environment: str
    core_api_url: str
    neon_auth_url: str
    custom_domain: str


TARGETS = {
    "stage": Target(
        name="stage",
        project="ifarm-academy-stage",
        database="ifarm-academy-stage",
        bucket="ifarm-academy-stage-materials",
        branch="stage",
        environment="stage",
        core_api_url="https://ifarm-core-api-stage.victorhugoteixeirasimon6.workers.dev",
        neon_auth_url="https://ep-hidden-truth-arvqm0b9.neonauth.c-4.us-west-2.aws.neon.tech/neondb/auth",
        custom_domain="academy-stage.ifarm.agr.br",
    ),
    "production": Target(
        name="production",
        project="ifarm-academy",
        database="ifarm-academy-production",
        bucket="ifarm-academy-production-materials",
        branch="main",
        environment="production",
        core_api_url="https://ifarm-core-api.victorhugoteixeirasimon6.workers.dev",
        neon_auth_url="https://ep-solitary-resonance-ar2wxsbi.neonauth.c-4.us-west-2.aws.neon.tech/neondb/auth",
        custom_domain="academy.ifarm.agr.br",
    ),
}


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"ERRO: secret/variável obrigatória ausente: {name}")
    return value


def assert_exclusive(target: Target) -> None:
    resources = (target.project, target.database, target.bucket)
    if any(not value.startswith("ifarm-academy") for value in resources):
        raise SystemExit("ERRO: recurso fora do namespace exclusivo ifarm-academy")
    forbidden = ("ifarm-core", "allamo", "terra-pulse", "sbs", "maison", "ser-vital")
    if any(token in value.lower() for value in resources for token in forbidden):
        raise SystemExit("ERRO: referência a recurso de outro projeto bloqueada")


class Cloudflare:
    def __init__(self, account_id: str, token: str):
        self.account_id = account_id
        self.token = token

    def request(self, method: str, path: str, body: dict | None = None, expected: set[int] | None = None):
        expected = expected or {200}
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(
            f"{API}{path}",
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode() or "{}")
                if response.status not in expected:
                    raise RuntimeError(f"Cloudflare HTTP {response.status} em {method} {path}")
                return response.status, payload
        except urllib.error.HTTPError as error:
            raw = error.read().decode(errors="replace")
            try:
                payload = json.loads(raw or "{}")
            except json.JSONDecodeError:
                payload = {}
            if error.code in expected:
                return error.code, payload
            messages = payload.get("errors") if isinstance(payload, dict) else None
            detail = ""
            if isinstance(messages, list):
                detail = "; ".join(str(item.get("message", "")) for item in messages if isinstance(item, dict))[:400]
            raise RuntimeError(f"Cloudflare HTTP {error.code} em {method} {path}: {detail or 'falha da API'}") from None

    def ensure_pages_project(self, target: Target) -> None:
        encoded = urllib.parse.quote(target.project, safe="")
        status, _ = self.request(
            "GET",
            f"/accounts/{self.account_id}/pages/projects/{encoded}",
            expected={200, 404},
        )
        if status == 200:
            print(f"Pages: {target.project} já existe; reutilizando recurso exclusivo da Academy.")
            return
        self.request(
            "POST",
            f"/accounts/{self.account_id}/pages/projects",
            {"name": target.project, "production_branch": target.branch},
            expected={200, 201},
        )
        print(f"Pages: {target.project} criado.")

    def ensure_d1(self, target: Target) -> str:
        query = urllib.parse.urlencode({"name": target.database, "per_page": 100})
        _, payload = self.request("GET", f"/accounts/{self.account_id}/d1/database?{query}")
        rows = payload.get("result", []) if isinstance(payload, dict) else []
        exact = [row for row in rows if isinstance(row, dict) and row.get("name") == target.database]
        if len(exact) > 1:
            raise RuntimeError(f"Mais de um D1 chamado {target.database}; abortando por segurança")
        if exact:
            database_id = str(exact[0].get("uuid", ""))
            if not database_id:
                raise RuntimeError("D1 existente não retornou UUID")
            print(f"D1: {target.database} já existe; reutilizando recurso exclusivo da Academy.")
            return database_id
        _, created = self.request(
            "POST",
            f"/accounts/{self.account_id}/d1/database",
            {"name": target.database},
            expected={200, 201},
        )
        result = created.get("result", {}) if isinstance(created, dict) else {}
        database_id = str(result.get("uuid", "")) if isinstance(result, dict) else ""
        if not database_id:
            raise RuntimeError("Cloudflare não retornou UUID do D1 criado")
        print(f"D1: {target.database} criado.")
        return database_id

    def ensure_r2(self, target: Target) -> None:
        encoded = urllib.parse.quote(target.bucket, safe="")
        status, _ = self.request(
            "GET",
            f"/accounts/{self.account_id}/r2/buckets/{encoded}",
            expected={200, 404},
        )
        if status == 200:
            print(f"R2: {target.bucket} já existe; reutilizando recurso exclusivo da Academy.")
            return
        self.request(
            "POST",
            f"/accounts/{self.account_id}/r2/buckets",
            {"name": target.bucket},
            expected={200, 201},
        )
        print(f"R2: {target.bucket} criado.")

    def attach_custom_domain_best_effort(self, target: Target) -> None:
        if os.environ.get("ACADEMY_ATTACH_CUSTOM_DOMAIN", "true").lower() not in {"1", "true", "yes"}:
            return
        project = urllib.parse.quote(target.project, safe="")
        try:
            self.request(
                "POST",
                f"/accounts/{self.account_id}/pages/projects/{project}/domains",
                {"name": target.custom_domain},
                expected={200, 201, 409},
            )
            print(f"Domínio: solicitação registrada para {target.custom_domain}.")
        except RuntimeError as error:
            # DNS/domínio não bloqueia a validação do pages.dev; registrar sem mascarar.
            print(f"AVISO: domínio customizado ainda não anexado: {error}", file=sys.stderr)


def run(command: list[str], *, input_text: str | None = None) -> None:
    subprocess.run(
        command,
        cwd=ROOT,
        input=input_text,
        text=True,
        check=True,
        env=os.environ.copy(),
    )


def write_config(target: Target, database_id: str, release: str) -> None:
    CONFIG_PATH.write_text(
        "\n".join(
            [
                f'name = "{target.project}"',
                'pages_build_output_dir = "./dist"',
                'compatibility_date = "2026-09-08"',
                "",
                "[[d1_databases]]",
                'binding = "ACADEMY_DB"',
                f'database_name = "{target.database}"',
                f'database_id = "{database_id}"',
                'migrations_dir = "migrations"',
                "",
                "[[r2_buckets]]",
                'binding = "ACADEMY_STORAGE"',
                f'bucket_name = "{target.bucket}"',
                "",
                "[vars]",
                f'ACADEMY_ENVIRONMENT = "{target.environment}"',
                f'ACADEMY_RELEASE = "{release}"',
                f'ACADEMY_CORE_API_URL = "{target.core_api_url}"',
                'ACADEMY_CORE_REQUEST_TIMEOUT_MS = "4000"',
                'ACADEMY_STORAGE_REQUIRED = "true"',
                'ACADEMY_RATE_LIMIT_ENABLED = "true"',
                "",
            ]
        ),
        encoding="utf-8",
    )


def put_secret(project: str, key: str, value: str) -> None:
    run(
        WRANGLER + [
            "pages", "secret", "put", key,
            "--project-name", project,
            "--config", str(CONFIG_PATH),
        ],
        input_text=value + "\n",
    )


def deploy(target: Target, database_id: str, release: str, sha: str, cf: Cloudflare) -> None:
    write_config(target, database_id, release)

    print("D1 migrations: aplicando somente migrations versionadas da Academy...")
    run(WRANGLER + [
        "d1", "migrations", "apply", target.database,
        "--remote", "--config", str(CONFIG_PATH),
    ])

    # Secrets são exclusivos e rotacionáveis; nunca entram em GitHub/repositório.
    put_secret(target.project, "ACADEMY_ADMIN_PROXY_SECRET", secrets.token_hex(32))
    put_secret(target.project, "ACADEMY_COMMERCIAL_WORKER_SECRET", secrets.token_hex(32))

    print(f"Pages deploy: {target.project} ({target.branch})")
    run(WRANGLER + [
        "pages", "deploy", "dist",
        "--project-name", target.project,
        "--branch", target.branch,
        "--commit-hash", sha,
        "--commit-message", f"iFarm Academy {target.name} {release}",
        "--config", str(CONFIG_PATH),
    ])
    cf.attach_custom_domain_best_effort(target)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("target", choices=sorted(TARGETS))
    args = parser.parse_args()
    target = TARGETS[args.target]
    assert_exclusive(target)

    account_id = require_env("CLOUDFLARE_ACCOUNT_ID")
    token = require_env("CLOUDFLARE_API_TOKEN")
    sha = require_env("GITHUB_SHA")
    release = os.environ.get("ACADEMY_RELEASE", sha[:12]).strip() or sha[:12]

    cf = Cloudflare(account_id, token)
    cf.ensure_pages_project(target)
    database_id = cf.ensure_d1(target)
    cf.ensure_r2(target)
    deploy(target, database_id, release, sha, cf)

    print(json.dumps({
        "target": target.name,
        "project": target.project,
        "site": f"https://{target.project}.pages.dev",
        "release": release,
        "customDomain": target.custom_domain,
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
