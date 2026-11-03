CREATE TABLE node_merges (
  project_id TEXT NOT NULL, node_id TEXT PRIMARY KEY, target_id TEXT NOT NULL,
  reason TEXT NOT NULL, created_at INTEGER NOT NULL,
  FOREIGN KEY(project_id,node_id) REFERENCES nodes(project_id,id) ON DELETE CASCADE,
  FOREIGN KEY(project_id,target_id) REFERENCES nodes(project_id,id),
  CHECK(node_id != target_id)
) STRICT;
CREATE TABLE project_catalogs (
  project_id TEXT PRIMARY KEY REFERENCES projects(id), updated_at INTEGER NOT NULL
) STRICT;
CREATE TABLE project_catalog_tasks (
  project_id TEXT NOT NULL REFERENCES projects(id), task_id TEXT NOT NULL,
  title TEXT NOT NULL, titles_json TEXT NOT NULL CHECK(json_valid(titles_json)),
  PRIMARY KEY(project_id,task_id)
) STRICT;
