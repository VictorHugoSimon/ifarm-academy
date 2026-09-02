PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS academy_material_assets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes > 0),
  storage_provider TEXT NOT NULL DEFAULT 'academy_storage',
  storage_etag TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','deleted','failed')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, object_key)
);

CREATE INDEX IF NOT EXISTS idx_academy_material_assets_lesson
ON academy_material_assets(tenant_id, course_id, lesson_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_academy_material_assets_status
ON academy_material_assets(tenant_id, status, updated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_academy_material_asset_course_insert
BEFORE INSERT ON academy_material_assets
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_courses c
    WHERE c.tenant_id=NEW.tenant_id AND c.id=NEW.course_id
  ) THEN RAISE(ABORT, 'material course tenant mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_academy_material_asset_lesson_insert
BEFORE INSERT ON academy_material_assets
FOR EACH ROW
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_course_lessons l
    WHERE l.tenant_id=NEW.tenant_id AND l.course_id=NEW.course_id AND l.id=NEW.lesson_id
  ) THEN RAISE(ABORT, 'material lesson tenant mismatch') END;
END;
