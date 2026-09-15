-- iFarm Academy v0.63 — composição de bundle publicada é imutável.
-- A API administrativa primeiro retorna o bundle para hidden e só então substitui a composição.

CREATE TRIGGER trg_public_bundle_course_insert_locked
BEFORE INSERT ON academy_public_bundle_courses
WHEN EXISTS (SELECT 1 FROM academy_public_bundles b WHERE b.id=NEW.bundle_id AND b.tenant_id=NEW.tenant_id AND b.status='public')
BEGIN SELECT RAISE(ABORT,'published bundle composition is locked'); END;

CREATE TRIGGER trg_public_bundle_course_delete_locked
BEFORE DELETE ON academy_public_bundle_courses
WHEN EXISTS (SELECT 1 FROM academy_public_bundles b WHERE b.id=OLD.bundle_id AND b.tenant_id=OLD.tenant_id AND b.status='public')
BEGIN SELECT RAISE(ABORT,'published bundle composition is locked'); END;

CREATE TRIGGER trg_public_bundle_course_update_immutable
BEFORE UPDATE ON academy_public_bundle_courses
BEGIN SELECT RAISE(ABORT,'bundle composition rows are immutable'); END;

CREATE TRIGGER trg_public_bundle_path_insert_locked
BEFORE INSERT ON academy_public_bundle_paths
WHEN EXISTS (SELECT 1 FROM academy_public_bundles b WHERE b.id=NEW.bundle_id AND b.tenant_id=NEW.tenant_id AND b.status='public')
BEGIN SELECT RAISE(ABORT,'published bundle composition is locked'); END;

CREATE TRIGGER trg_public_bundle_path_delete_locked
BEFORE DELETE ON academy_public_bundle_paths
WHEN EXISTS (SELECT 1 FROM academy_public_bundles b WHERE b.id=OLD.bundle_id AND b.tenant_id=OLD.tenant_id AND b.status='public')
BEGIN SELECT RAISE(ABORT,'published bundle composition is locked'); END;

CREATE TRIGGER trg_public_bundle_path_update_immutable
BEFORE UPDATE ON academy_public_bundle_paths
BEGIN SELECT RAISE(ABORT,'bundle composition rows are immutable'); END;

CREATE TRIGGER trg_public_bundle_plan_insert_locked
BEFORE INSERT ON academy_public_bundle_plans
WHEN EXISTS (SELECT 1 FROM academy_public_bundles b WHERE b.id=NEW.bundle_id AND b.tenant_id=NEW.tenant_id AND b.status='public')
BEGIN SELECT RAISE(ABORT,'published bundle composition is locked'); END;

CREATE TRIGGER trg_public_bundle_plan_delete_locked
BEFORE DELETE ON academy_public_bundle_plans
WHEN EXISTS (SELECT 1 FROM academy_public_bundles b WHERE b.id=OLD.bundle_id AND b.tenant_id=OLD.tenant_id AND b.status='public')
BEGIN SELECT RAISE(ABORT,'published bundle composition is locked'); END;

CREATE TRIGGER trg_public_bundle_plan_update_immutable
BEFORE UPDATE ON academy_public_bundle_plans
BEGIN SELECT RAISE(ABORT,'bundle composition rows are immutable'); END;

CREATE TRIGGER trg_public_bundle_partner_insert_locked
BEFORE INSERT ON academy_public_bundle_partners
WHEN EXISTS (SELECT 1 FROM academy_public_bundles b WHERE b.id=NEW.bundle_id AND b.tenant_id=NEW.tenant_id AND b.status='public')
BEGIN SELECT RAISE(ABORT,'published bundle composition is locked'); END;

CREATE TRIGGER trg_public_bundle_partner_delete_locked
BEFORE DELETE ON academy_public_bundle_partners
WHEN EXISTS (SELECT 1 FROM academy_public_bundles b WHERE b.id=OLD.bundle_id AND b.tenant_id=OLD.tenant_id AND b.status='public')
BEGIN SELECT RAISE(ABORT,'published bundle composition is locked'); END;

CREATE TRIGGER trg_public_bundle_partner_update_immutable
BEFORE UPDATE ON academy_public_bundle_partners
BEGIN SELECT RAISE(ABORT,'bundle composition rows are immutable'); END;

CREATE TRIGGER trg_public_bundle_external_insert_locked
BEFORE INSERT ON academy_public_bundle_external_items
WHEN EXISTS (SELECT 1 FROM academy_public_bundles b WHERE b.id=NEW.bundle_id AND b.tenant_id=NEW.tenant_id AND b.status='public')
BEGIN SELECT RAISE(ABORT,'published bundle composition is locked'); END;

CREATE TRIGGER trg_public_bundle_external_delete_locked
BEFORE DELETE ON academy_public_bundle_external_items
WHEN EXISTS (SELECT 1 FROM academy_public_bundles b WHERE b.id=OLD.bundle_id AND b.tenant_id=OLD.tenant_id AND b.status='public')
BEGIN SELECT RAISE(ABORT,'published bundle composition is locked'); END;

CREATE TRIGGER trg_public_bundle_external_update_immutable
BEFORE UPDATE ON academy_public_bundle_external_items
BEGIN SELECT RAISE(ABORT,'bundle composition rows are immutable'); END;
