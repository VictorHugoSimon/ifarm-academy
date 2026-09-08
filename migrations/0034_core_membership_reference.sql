-- v0.55 — referência não duplicativa ao diretório de identities do iFarm Core.
ALTER TABLE academy_company_members ADD COLUMN core_membership_id TEXT;

CREATE INDEX IF NOT EXISTS idx_academy_company_members_core_membership
  ON academy_company_members(tenant_id, core_membership_id)
  WHERE core_membership_id IS NOT NULL;
