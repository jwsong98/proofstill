CREATE TABLE feature_checks (
  project_id TEXT NOT NULL, feature_id TEXT NOT NULL,
  id TEXT NOT NULL CHECK(length(trim(id)) > 0), label TEXT NOT NULL CHECK(length(trim(label)) > 0),
  kind TEXT NOT NULL CHECK(kind IN ('scenario','test')), command TEXT NOT NULL CHECK(length(trim(command)) > 0),
  execution_id TEXT,
  PRIMARY KEY(feature_id,id),
  FOREIGN KEY(project_id,feature_id) REFERENCES nodes(project_id,id) ON DELETE CASCADE,
  FOREIGN KEY(project_id,execution_id) REFERENCES executions(project_id,id)
) STRICT;
CREATE TRIGGER feature_check_kind_insert BEFORE INSERT ON feature_checks
BEGIN
  SELECT CASE WHEN (SELECT kind FROM nodes WHERE id=NEW.feature_id) != 'feature'
    THEN RAISE(ABORT,'Acceptance checks require a feature node') END;
  SELECT CASE WHEN NEW.execution_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM executions WHERE id=NEW.execution_id AND project_id=NEW.project_id
      AND kind IN ('command','test') AND command=NEW.command
  ) THEN RAISE(ABORT,'Check result must match the exact observed command') END;
END;
CREATE TRIGGER feature_check_kind_update BEFORE UPDATE ON feature_checks
BEGIN
  SELECT CASE WHEN (SELECT kind FROM nodes WHERE id=NEW.feature_id) != 'feature'
    THEN RAISE(ABORT,'Acceptance checks require a feature node') END;
  SELECT CASE WHEN NEW.execution_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM executions WHERE id=NEW.execution_id AND project_id=NEW.project_id
      AND kind IN ('command','test') AND command=NEW.command
  ) THEN RAISE(ABORT,'Check result must match the exact observed command') END;
END;
CREATE TRIGGER feature_complete_requires_checks_insert BEFORE INSERT ON nodes
WHEN NEW.kind='feature' AND NEW.status='completed'
BEGIN SELECT RAISE(ABORT,'Feature completion requires all defined checks to pass'); END;
CREATE TRIGGER feature_complete_requires_checks_update BEFORE UPDATE OF status ON nodes
WHEN NEW.kind='feature' AND NEW.status='completed'
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM feature_checks WHERE feature_id=NEW.id)
    OR EXISTS (
      SELECT 1 FROM feature_checks c LEFT JOIN executions e ON e.id=c.execution_id
      WHERE c.feature_id=NEW.id AND (e.id IS NULL OR e.status!='passed')
    ) THEN RAISE(ABORT,'Feature completion requires all defined checks to pass') END;
END;
CREATE TRIGGER feature_checks_deleted AFTER DELETE ON feature_checks
BEGIN UPDATE nodes SET status='pending' WHERE id=OLD.feature_id AND status='completed'; END;
CREATE TRIGGER feature_checks_inserted AFTER INSERT ON feature_checks
BEGIN UPDATE nodes SET status='pending' WHERE id=NEW.feature_id AND status='completed'; END;
CREATE TRIGGER feature_checks_changed AFTER UPDATE ON feature_checks
BEGIN UPDATE nodes SET status='pending' WHERE id=NEW.feature_id AND status='completed'; END;
-- Older databases have no recorded acceptance check set; an existing completed label is not test evidence.
UPDATE nodes SET status='pending' WHERE kind='feature' AND status='completed';
