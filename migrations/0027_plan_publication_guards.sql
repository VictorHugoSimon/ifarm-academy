PRAGMA foreign_keys = ON;

CREATE TRIGGER IF NOT EXISTS trg_plan_publish_content_update
BEFORE UPDATE ON academy_plans
WHEN NEW.status='public'
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM academy_plan_courses pc
    WHERE pc.tenant_id=NEW.tenant_id AND pc.plan_id=NEW.id
      AND NOT EXISTS (
        SELECT 1
        FROM academy_courses c
        JOIN academy_course_public_profiles cp ON cp.tenant_id=c.tenant_id AND cp.course_id=c.id
        WHERE c.tenant_id=NEW.tenant_id AND c.id=pc.course_id
          AND c.status='published' AND cp.visibility='public'
      )
  ) THEN RAISE(ABORT,'public plan contains non-public course') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM academy_plan_paths pp
    WHERE pp.tenant_id=NEW.tenant_id AND pp.plan_id=NEW.id
      AND NOT EXISTS (
        SELECT 1 FROM academy_public_learning_paths p
        WHERE p.tenant_id=NEW.tenant_id AND p.id=pp.path_id AND p.visibility='public'
      )
  ) THEN RAISE(ABORT,'public plan contains non-public path') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_public_plan_course_insert
BEFORE INSERT ON academy_plan_courses
WHEN EXISTS (
  SELECT 1 FROM academy_plans p
  WHERE p.id=NEW.plan_id AND p.tenant_id=NEW.tenant_id AND p.status='public'
)
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM academy_courses c
    JOIN academy_course_public_profiles cp ON cp.tenant_id=c.tenant_id AND cp.course_id=c.id
    WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
      AND c.status='published' AND cp.visibility='public'
  ) THEN RAISE(ABORT,'public plan accepts only public courses') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_public_plan_path_insert
BEFORE INSERT ON academy_plan_paths
WHEN EXISTS (
  SELECT 1 FROM academy_plans p
  WHERE p.id=NEW.plan_id AND p.tenant_id=NEW.tenant_id AND p.status='public'
)
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM academy_public_learning_paths p
    WHERE p.id=NEW.path_id AND p.tenant_id=NEW.tenant_id AND p.visibility='public'
  ) THEN RAISE(ABORT,'public plan accepts only public paths') END;
END;
