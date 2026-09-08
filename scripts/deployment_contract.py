#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEPLOY_PATH = ROOT / "scripts/deploy_cloudflare_pages.py"
DEPLOY = DEPLOY_PATH.read_text(encoding="utf-8")
STAGE = (ROOT / ".github/workflows/deploy-stage.yml").read_text(encoding="utf-8")
PROD = (ROOT / ".github/workflows/deploy-production.yml").read_text(encoding="utf-8")

errors: list[str] = []

try:
    compile(DEPLOY, str(DEPLOY_PATH), "exec")
except SyntaxError as error:
    errors.append(f"provisioner_syntax:{error.msg}")

required_resources = [
    "ifarm-academy-stage",
    "ifarm-academy-stage-materials",
    "ifarm-academy-production",
    "ifarm-academy-production-materials",
]
for value in required_resources:
    if value not in DEPLOY:
        errors.append(f"resource_missing:{value}")

forbidden = ["instituto-allamo", "allamo-pmo", "terra-pulse", "sbs-brasil", "maison-decants", "ser-vital"]
for value in forbidden:
    if value in (DEPLOY + STAGE + PROD).lower():
        errors.append(f"foreign_project_reference:{value}")

if 'branches: [stage]' not in STAGE:
    errors.append("stage_trigger_invalid")
if 'branches: [main]' not in PROD:
    errors.append("production_trigger_invalid")
if "deploy_cloudflare_pages.py stage" not in STAGE:
    errors.append("stage_target_missing")
if "deploy_cloudflare_pages.py production" not in PROD:
    errors.append("production_target_missing")
if "CLOUDFLARE_API_TOKEN" not in STAGE or "CLOUDFLARE_ACCOUNT_ID" not in STAGE:
    errors.append("stage_credentials_gate_missing")
if "CLOUDFLARE_API_TOKEN" not in PROD or "CLOUDFLARE_ACCOUNT_ID" not in PROD:
    errors.append("production_credentials_gate_missing")
if "ACADEMY_ADMIN_PROXY_SECRET" not in DEPLOY:
    errors.append("identity_bridge_secret_missing")
if "ACADEMY_STORAGE_REQUIRED = \"true\"" not in DEPLOY:
    errors.append("storage_readiness_missing")
if "ifarm-core-api-stage.victorhugoteixeirasimon6.workers.dev" not in DEPLOY:
    errors.append("stage_core_contract_missing")
if "ifarm-core-api.victorhugoteixeirasimon6.workers.dev" not in DEPLOY:
    errors.append("production_core_contract_missing")
if "@4.35.0" not in DEPLOY:
    errors.append("wrangler_not_pinned")

if errors:
    print("Deployment contract: FAIL")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)

print("Deployment contract: PASS")
print("- provisioner syntax OK")
print("- stage/prod isolated")
print("- D1/R2 exclusive namespace enforced")
print("- Core endpoints explicit")
print("- credential and readiness gates present")
