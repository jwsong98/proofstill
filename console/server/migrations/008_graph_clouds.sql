CREATE TABLE graph_cloud_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  representative_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  member_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
  CHECK (representative_id <> member_id)
) STRICT;
