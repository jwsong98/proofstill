CREATE TABLE task_definitions (
  node_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id),
  definition_json TEXT NOT NULL
) STRICT;
CREATE TABLE dag_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  data_json TEXT NOT NULL,
  started_at INTEGER NOT NULL
) STRICT;
CREATE INDEX dag_runs_project ON dag_runs(project_id, started_at);
