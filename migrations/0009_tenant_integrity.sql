PRAGMA foreign_keys = ON;

-- Os IDs de curso, módulo, aula e quiz são globalmente únicos na Academy.
-- Estes triggers reforçam que gravações acadêmicas nunca cruzem tenants,
-- mesmo quando tabelas legadas possuem PKs anteriores à introdução de tenant_id.

CREATE TRIGGER IF NOT EXISTS trg_progress_tenant_integrity_insert
BEFORE INSERT ON academy_progress
BEGIN
  SELECT CASE
    WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM academy_course_lessons l
      WHERE l.id=NEW.lesson_id AND l.course_id=NEW.course_id AND l.tenant_id=NEW.tenant_id
    )
    THEN RAISE(ABORT, 'academy_progress tenant/course/lesson mismatch')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_progress_tenant_integrity_update
BEFORE UPDATE ON academy_progress
BEGIN
  SELECT CASE
    WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM academy_course_lessons l
      WHERE l.id=NEW.lesson_id AND l.course_id=NEW.course_id AND l.tenant_id=NEW.tenant_id
    )
    THEN RAISE(ABORT, 'academy_progress tenant/course/lesson mismatch')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_attempt_tenant_integrity_insert
BEFORE INSERT ON academy_quiz_attempts
BEGIN
  SELECT CASE
    WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM academy_quiz_policies q
      WHERE q.quiz_id=NEW.quiz_id AND q.tenant_id=NEW.tenant_id
    )
    THEN RAISE(ABORT, 'academy_quiz_attempts tenant/quiz mismatch')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_enrollment_tenant_integrity_insert
BEFORE INSERT ON academy_enrollments
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM academy_courses c
      WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
    )
    THEN RAISE(ABORT, 'academy_enrollments tenant/course mismatch')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_enrollment_tenant_integrity_update
BEFORE UPDATE ON academy_enrollments
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM academy_courses c
      WHERE c.id=NEW.course_id AND c.tenant_id=NEW.tenant_id
    )
    THEN RAISE(ABORT, 'academy_enrollments tenant/course mismatch')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_certificate_tenant_integrity_insert
BEFORE INSERT ON academy_certificates
BEGIN
  SELECT CASE
    WHEN NEW.tenant_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM academy_course_completion_policy p
      WHERE p.course_id=NEW.course_id AND p.tenant_id=NEW.tenant_id
    )
    THEN RAISE(ABORT, 'academy_certificates tenant/course mismatch')
  END;
END;
