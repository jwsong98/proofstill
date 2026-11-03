CREATE TABLE implementation_progress (
  project_id TEXT NOT NULL, node_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('unknown','not_started','in_progress','partial','implemented')),
  paths_json TEXT NOT NULL, remaining TEXT NOT NULL, note TEXT NOT NULL, updated_at INTEGER NOT NULL,
  FOREIGN KEY(project_id,node_id) REFERENCES nodes(project_id,id) ON DELETE CASCADE
) STRICT;
-- Existing graph completion is not evidence of implementation. No backfill from node status.
ALTER TABLE nodes ADD COLUMN definition_updated_at INTEGER NOT NULL DEFAULT 0;
DROP TRIGGER feature_check_kind_insert;
DROP TRIGGER feature_check_kind_update;
CREATE TRIGGER feature_check_kind_insert BEFORE INSERT ON feature_checks
BEGIN
  SELECT CASE WHEN (SELECT kind FROM nodes WHERE id=NEW.feature_id) NOT IN ('feature','requirement')
    THEN RAISE(ABORT,'Checks require a feature or requirement') END;
  SELECT CASE WHEN NEW.execution_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM executions WHERE id=NEW.execution_id AND project_id=NEW.project_id
      AND kind IN ('command','test') AND command=NEW.command
  ) THEN RAISE(ABORT,'Check result must match the exact observed command') END;
END;
CREATE TRIGGER feature_check_kind_update BEFORE UPDATE ON feature_checks
BEGIN
  SELECT CASE WHEN (SELECT kind FROM nodes WHERE id=NEW.feature_id) NOT IN ('feature','requirement')
    THEN RAISE(ABORT,'Checks require a feature or requirement') END;
  SELECT CASE WHEN NEW.execution_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM executions WHERE id=NEW.execution_id AND project_id=NEW.project_id
      AND kind IN ('command','test') AND command=NEW.command
  ) THEN RAISE(ABORT,'Check result must match the exact observed command') END;
END;
ALTER TABLE feature_checks ADD COLUMN files_json TEXT NOT NULL DEFAULT '[]';
CREATE TABLE harness_requirement_links (
  project_id TEXT NOT NULL, node_id TEXT NOT NULL UNIQUE, task_id TEXT NOT NULL, requirement_id TEXT NOT NULL,
  PRIMARY KEY(project_id,task_id,requirement_id),
  FOREIGN KEY(project_id,node_id) REFERENCES nodes(project_id,id) ON DELETE CASCADE
) STRICT;
