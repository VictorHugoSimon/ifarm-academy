-- iFarm Academy v0.64 — curadoria editorial/contextual do portal.
-- Não armazena visitante, histórico de navegação, perfil comportamental ou lead comercial.

CREATE TABLE academy_public_recommendation_sets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  recommendation_key TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  surface TEXT NOT NULL CHECK (surface IN ('home','course','path','instructor','event','plan','partner','bundle')),
  context_ref TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'hidden' CHECK (status IN ('hidden','public')),
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0),
  valid_from TEXT,
  valid_until TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((surface='home' AND context_ref='') OR (surface<>'home' AND length(trim(context_ref))>0)),
  CHECK (valid_from IS NULL OR valid_until IS NULL OR datetime(valid_from) < datetime(valid_until)),
  UNIQUE (tenant_id, surface, context_ref, recommendation_key)
);

CREATE INDEX idx_public_recommendation_sets_listing
  ON academy_public_recommendation_sets(tenant_id,status,surface,context_ref,priority,recommendation_key);

CREATE TABLE academy_public_recommendation_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  set_id TEXT NOT NULL REFERENCES academy_public_recommendation_sets(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('course','path','instructor','event','plan','partner','bundle')),
  item_ref TEXT NOT NULL,
  editorial_label TEXT,
  editorial_reason TEXT,
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id,set_id,item_type,item_ref),
  UNIQUE (tenant_id,set_id,position)
);

CREATE INDEX idx_public_recommendation_items_order
  ON academy_public_recommendation_items(tenant_id,set_id,position);

CREATE TRIGGER trg_public_recommendation_set_identity_immutable
BEFORE UPDATE OF tenant_id,surface,context_ref,recommendation_key ON academy_public_recommendation_sets
WHEN NEW.tenant_id<>OLD.tenant_id OR NEW.surface<>OLD.surface OR NEW.context_ref<>OLD.context_ref OR NEW.recommendation_key<>OLD.recommendation_key
BEGIN SELECT RAISE(ABORT,'recommendation set identity is immutable'); END;

CREATE TRIGGER trg_public_recommendation_item_tenant_insert
BEFORE INSERT ON academy_public_recommendation_items
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM academy_public_recommendation_sets s WHERE s.id=NEW.set_id AND s.tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT,'recommendation item tenant mismatch') END;
  SELECT CASE WHEN NEW.item_type='course' AND NOT EXISTS (SELECT 1 FROM academy_courses x WHERE x.id=NEW.item_ref AND x.tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT,'recommendation course tenant mismatch') END;
  SELECT CASE WHEN NEW.item_type='path' AND NOT EXISTS (SELECT 1 FROM academy_public_learning_paths x WHERE x.id=NEW.item_ref AND x.tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT,'recommendation path tenant mismatch') END;
  SELECT CASE WHEN NEW.item_type='instructor' AND NOT EXISTS (SELECT 1 FROM academy_instructor_public_profiles x WHERE x.instructor_id=NEW.item_ref AND x.tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT,'recommendation instructor tenant mismatch') END;
  SELECT CASE WHEN NEW.item_type='event' AND NOT EXISTS (SELECT 1 FROM academy_events x WHERE x.id=NEW.item_ref AND x.tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT,'recommendation event tenant mismatch') END;
  SELECT CASE WHEN NEW.item_type='plan' AND NOT EXISTS (SELECT 1 FROM academy_plans x WHERE x.id=NEW.item_ref AND x.tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT,'recommendation plan tenant mismatch') END;
  SELECT CASE WHEN NEW.item_type='partner' AND NOT EXISTS (SELECT 1 FROM academy_public_partners x WHERE x.id=NEW.item_ref AND x.tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT,'recommendation partner tenant mismatch') END;
  SELECT CASE WHEN NEW.item_type='bundle' AND NOT EXISTS (SELECT 1 FROM academy_public_bundles x WHERE x.id=NEW.item_ref AND x.tenant_id=NEW.tenant_id)
    THEN RAISE(ABORT,'recommendation bundle tenant mismatch') END;
END;

CREATE TRIGGER trg_public_recommendation_item_update_immutable
BEFORE UPDATE ON academy_public_recommendation_items
BEGIN SELECT RAISE(ABORT,'recommendation item rows are immutable'); END;

CREATE TRIGGER trg_public_recommendation_item_insert_locked
BEFORE INSERT ON academy_public_recommendation_items
WHEN EXISTS (SELECT 1 FROM academy_public_recommendation_sets s WHERE s.id=NEW.set_id AND s.tenant_id=NEW.tenant_id AND s.status='public')
BEGIN SELECT RAISE(ABORT,'published recommendation composition is locked'); END;

CREATE TRIGGER trg_public_recommendation_item_delete_locked
BEFORE DELETE ON academy_public_recommendation_items
WHEN EXISTS (SELECT 1 FROM academy_public_recommendation_sets s WHERE s.id=OLD.set_id AND s.tenant_id=OLD.tenant_id AND s.status='public')
BEGIN SELECT RAISE(ABORT,'published recommendation composition is locked'); END;

CREATE TRIGGER trg_public_recommendation_context_publish_guard
BEFORE UPDATE OF status ON academy_public_recommendation_sets
WHEN NEW.status='public' AND NEW.surface<>'home'
BEGIN
  SELECT CASE WHEN NEW.surface='course' AND NOT EXISTS (
    SELECT 1 FROM academy_courses c JOIN academy_course_public_profiles cp ON cp.course_id=c.id AND cp.tenant_id=c.tenant_id AND cp.visibility='public'
    WHERE c.id=NEW.context_ref AND c.tenant_id=NEW.tenant_id AND c.status='published'
  ) THEN RAISE(ABORT,'recommendation context course is not public') END;
  SELECT CASE WHEN NEW.surface='path' AND NOT EXISTS (
    SELECT 1 FROM academy_public_learning_paths p WHERE p.id=NEW.context_ref AND p.tenant_id=NEW.tenant_id AND p.visibility='public'
  ) THEN RAISE(ABORT,'recommendation context path is not public') END;
  SELECT CASE WHEN NEW.surface='instructor' AND NOT EXISTS (
    SELECT 1 FROM academy_instructor_public_profiles p JOIN academy_instructors i ON i.id=p.instructor_id AND i.tenant_id=p.tenant_id AND i.status='active'
    WHERE p.instructor_id=NEW.context_ref AND p.tenant_id=NEW.tenant_id AND p.visibility='public'
  ) THEN RAISE(ABORT,'recommendation context instructor is not public') END;
  SELECT CASE WHEN NEW.surface='event' AND NOT EXISTS (
    SELECT 1 FROM academy_events e WHERE e.id=NEW.context_ref AND e.tenant_id=NEW.tenant_id AND e.status='published'
  ) THEN RAISE(ABORT,'recommendation context event is not public') END;
  SELECT CASE WHEN NEW.surface='plan' AND NOT EXISTS (
    SELECT 1 FROM academy_plans p WHERE p.id=NEW.context_ref AND p.tenant_id=NEW.tenant_id AND p.status='public'
  ) THEN RAISE(ABORT,'recommendation context plan is not public') END;
  SELECT CASE WHEN NEW.surface='partner' AND NOT EXISTS (
    SELECT 1 FROM academy_public_partners p WHERE p.id=NEW.context_ref AND p.tenant_id=NEW.tenant_id AND p.status='public'
  ) THEN RAISE(ABORT,'recommendation context partner is not public') END;
  SELECT CASE WHEN NEW.surface='bundle' AND NOT EXISTS (
    SELECT 1 FROM academy_public_bundles b WHERE b.id=NEW.context_ref AND b.tenant_id=NEW.tenant_id AND b.status='public'
  ) THEN RAISE(ABORT,'recommendation context bundle is not public') END;
END;

CREATE TRIGGER trg_public_recommendation_publish_guard
BEFORE UPDATE OF status ON academy_public_recommendation_sets
WHEN NEW.status='public'
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM academy_public_recommendation_items i WHERE i.tenant_id=NEW.tenant_id AND i.set_id=NEW.id)
    THEN RAISE(ABORT,'public recommendation set requires at least one item') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM academy_public_recommendation_items i
    LEFT JOIN academy_courses c ON i.item_type='course' AND c.id=i.item_ref AND c.tenant_id=i.tenant_id AND c.status='published'
    LEFT JOIN academy_course_public_profiles cp ON i.item_type='course' AND cp.course_id=i.item_ref AND cp.tenant_id=i.tenant_id AND cp.visibility='public'
    WHERE i.tenant_id=NEW.tenant_id AND i.set_id=NEW.id AND i.item_type='course' AND (c.id IS NULL OR cp.course_id IS NULL)
  ) THEN RAISE(ABORT,'recommendation contains non-public course') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM academy_public_recommendation_items i LEFT JOIN academy_public_learning_paths p
      ON i.item_type='path' AND p.id=i.item_ref AND p.tenant_id=i.tenant_id AND p.visibility='public'
    WHERE i.tenant_id=NEW.tenant_id AND i.set_id=NEW.id AND i.item_type='path' AND p.id IS NULL
  ) THEN RAISE(ABORT,'recommendation contains non-public path') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM academy_public_recommendation_items i
    LEFT JOIN academy_instructor_public_profiles p ON i.item_type='instructor' AND p.instructor_id=i.item_ref AND p.tenant_id=i.tenant_id AND p.visibility='public'
    LEFT JOIN academy_instructors x ON x.id=i.item_ref AND x.tenant_id=i.tenant_id AND x.status='active'
    WHERE i.tenant_id=NEW.tenant_id AND i.set_id=NEW.id AND i.item_type='instructor' AND (p.instructor_id IS NULL OR x.id IS NULL)
  ) THEN RAISE(ABORT,'recommendation contains non-public instructor') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM academy_public_recommendation_items i LEFT JOIN academy_events e
      ON i.item_type='event' AND e.id=i.item_ref AND e.tenant_id=i.tenant_id AND e.status='published'
    WHERE i.tenant_id=NEW.tenant_id AND i.set_id=NEW.id AND i.item_type='event' AND e.id IS NULL
  ) THEN RAISE(ABORT,'recommendation contains non-public event') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM academy_public_recommendation_items i LEFT JOIN academy_plans p
      ON i.item_type='plan' AND p.id=i.item_ref AND p.tenant_id=i.tenant_id AND p.status='public'
    WHERE i.tenant_id=NEW.tenant_id AND i.set_id=NEW.id AND i.item_type='plan' AND p.id IS NULL
  ) THEN RAISE(ABORT,'recommendation contains non-public plan') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM academy_public_recommendation_items i LEFT JOIN academy_public_partners p
      ON i.item_type='partner' AND p.id=i.item_ref AND p.tenant_id=i.tenant_id AND p.status='public'
    WHERE i.tenant_id=NEW.tenant_id AND i.set_id=NEW.id AND i.item_type='partner' AND p.id IS NULL
  ) THEN RAISE(ABORT,'recommendation contains non-public partner') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM academy_public_recommendation_items i LEFT JOIN academy_public_bundles b
      ON i.item_type='bundle' AND b.id=i.item_ref AND b.tenant_id=i.tenant_id AND b.status='public'
    WHERE i.tenant_id=NEW.tenant_id AND i.set_id=NEW.id AND i.item_type='bundle' AND b.id IS NULL
  ) THEN RAISE(ABORT,'recommendation contains non-public bundle') END;
END;
