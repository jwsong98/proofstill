DROP TRIGGER precedes_validate_insert;

CREATE TRIGGER precedes_validate_insert BEFORE INSERT ON edges WHEN NEW.kind='precedes'
BEGIN
  SELECT CASE WHEN EXISTS (
    WITH RECURSIVE successors(id) AS (
      SELECT target_id FROM edges WHERE project_id=NEW.project_id AND kind='precedes' AND source_id=NEW.target_id
      UNION
      SELECT e.target_id FROM edges e JOIN successors s ON e.source_id=s.id WHERE e.project_id=NEW.project_id AND e.kind='precedes'
    ) SELECT 1 FROM successors WHERE id=NEW.source_id
  ) THEN RAISE(ABORT,'Precedence cycle') END;
END;
