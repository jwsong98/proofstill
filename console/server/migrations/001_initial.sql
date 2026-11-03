CREATE TABLE projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  root_path TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL
) STRICT;
CREATE TABLE evidence (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
  source_kind TEXT NOT NULL CHECK(source_kind IN ('file','message','execution')),
  source_json TEXT NOT NULL CHECK(json_valid(source_json)), content TEXT NOT NULL,
  captured_at INTEGER NOT NULL, UNIQUE(project_id,id)
) STRICT;
CREATE TABLE executions (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
  kind TEXT NOT NULL CHECK(kind IN ('test','command','api')),
  status TEXT NOT NULL CHECK(status IN ('passed','failed','interrupted','unverified')),
  command TEXT, request_json TEXT NOT NULL CHECK(json_valid(request_json)),
  response_json TEXT NOT NULL CHECK(json_valid(response_json)), output TEXT NOT NULL,
  exit_code INTEGER, started_at INTEGER NOT NULL, finished_at INTEGER,
  UNIQUE(project_id,id)
) STRICT;
CREATE TABLE nodes (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
  kind TEXT NOT NULL CHECK(kind IN ('feature','requirement','issue','decision','task','evidence','result')),
  title TEXT NOT NULL CHECK(length(trim(title)) > 0), body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('pending','active','completed','failed','unverified')),
  x REAL, y REAL, evidence_id TEXT, execution_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  UNIQUE(project_id,id), UNIQUE(evidence_id), UNIQUE(execution_id),
  FOREIGN KEY(project_id,evidence_id) REFERENCES evidence(project_id,id),
  FOREIGN KEY(project_id,execution_id) REFERENCES executions(project_id,id),
  CHECK((kind='evidence' AND evidence_id IS NOT NULL AND execution_id IS NULL AND body='')
     OR (kind='result' AND execution_id IS NOT NULL AND evidence_id IS NULL AND body='')
     OR (kind NOT IN ('evidence','result') AND evidence_id IS NULL AND execution_id IS NULL))
) STRICT;
CREATE TABLE edges (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), source_id TEXT NOT NULL, target_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('related','precedes')), reason TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
  FOREIGN KEY(project_id,source_id) REFERENCES nodes(project_id,id),
  FOREIGN KEY(project_id,target_id) REFERENCES nodes(project_id,id),
  CHECK(source_id != target_id), CHECK(kind != 'related' OR source_id < target_id),
  UNIQUE(project_id,kind,source_id,target_id)
) STRICT;
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), external_thread_id TEXT UNIQUE,
  title TEXT NOT NULL CHECK(length(trim(title)) > 0), source TEXT NOT NULL CHECK(source IN ('local','import')),
  role TEXT, created_at INTEGER NOT NULL, last_conversation_at INTEGER,
  UNIQUE(project_id,id)
) STRICT;
CREATE INDEX sessions_recent ON sessions(project_id,last_conversation_at DESC,id DESC);
CREATE TABLE session_context (
  session_id TEXT NOT NULL, project_id TEXT NOT NULL, node_id TEXT NOT NULL,
  PRIMARY KEY(session_id,node_id),
  FOREIGN KEY(project_id,session_id) REFERENCES sessions(project_id,id),
  FOREIGN KEY(project_id,node_id) REFERENCES nodes(project_id,id)
) STRICT;
CREATE TABLE messages (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), external_id TEXT,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')), content TEXT NOT NULL,
  created_at INTEGER NOT NULL, turn_id TEXT, UNIQUE(session_id,external_id)
) STRICT;
CREATE INDEX messages_order ON messages(session_id,created_at,id);
CREATE TABLE session_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES sessions(id), method TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)), created_at INTEGER NOT NULL
) STRICT;
CREATE TABLE usage (
  session_id TEXT NOT NULL REFERENCES sessions(id), turn_id TEXT NOT NULL,
  input_tokens INTEGER CHECK(input_tokens IS NULL OR input_tokens>=0),
  cached_input_tokens INTEGER CHECK(cached_input_tokens IS NULL OR cached_input_tokens>=0),
  output_tokens INTEGER CHECK(output_tokens IS NULL OR output_tokens>=0),
  reasoning_output_tokens INTEGER CHECK(reasoning_output_tokens IS NULL OR reasoning_output_tokens>=0),
  model_context_window INTEGER CHECK(model_context_window IS NULL OR model_context_window>0),
  raw_json TEXT NOT NULL CHECK(json_valid(raw_json)), observed_at INTEGER NOT NULL,
  PRIMARY KEY(session_id,turn_id)
) STRICT;
CREATE TRIGGER evidence_no_update BEFORE UPDATE ON evidence BEGIN SELECT RAISE(ABORT,'Evidence is immutable'); END;
CREATE TRIGGER evidence_no_delete BEFORE DELETE ON evidence BEGIN SELECT RAISE(ABORT,'Evidence is immutable'); END;
CREATE TRIGGER executions_no_update BEFORE UPDATE ON executions BEGIN SELECT RAISE(ABORT,'Execution evidence is immutable'); END;
CREATE TRIGGER executions_no_delete BEFORE DELETE ON executions BEGIN SELECT RAISE(ABORT,'Execution evidence is immutable'); END;
CREATE TRIGGER source_nodes_no_update BEFORE UPDATE ON nodes WHEN OLD.kind IN ('evidence','result')
BEGIN SELECT RAISE(ABORT,'Evidence nodes are immutable'); END;
CREATE TRIGGER source_nodes_no_delete BEFORE DELETE ON nodes WHEN OLD.kind IN ('evidence','result')
BEGIN SELECT RAISE(ABORT,'Evidence nodes are immutable'); END;
CREATE TRIGGER precedes_validate_insert BEFORE INSERT ON edges WHEN NEW.kind='precedes'
BEGIN
  SELECT CASE WHEN (SELECT kind FROM nodes WHERE id=NEW.source_id) != 'task' OR
                   (SELECT kind FROM nodes WHERE id=NEW.target_id) != 'task'
    THEN RAISE(ABORT,'Precedence requires task nodes') END;
  SELECT CASE WHEN EXISTS (
    WITH RECURSIVE successors(id) AS (
      SELECT target_id FROM edges WHERE project_id=NEW.project_id AND kind='precedes' AND source_id=NEW.target_id
      UNION
      SELECT e.target_id FROM edges e JOIN successors s ON e.source_id=s.id WHERE e.project_id=NEW.project_id AND e.kind='precedes'
    ) SELECT 1 FROM successors WHERE id=NEW.source_id
  ) THEN RAISE(ABORT,'Precedence cycle') END;
END;
CREATE TRIGGER edge_no_update BEFORE UPDATE ON edges BEGIN SELECT RAISE(ABORT,'Replace graph relations by deleting and creating'); END;

CREATE TRIGGER node_kind_immutable BEFORE UPDATE OF kind ON nodes WHEN NEW.kind != OLD.kind
BEGIN SELECT RAISE(ABORT,'Node kind is immutable'); END;
