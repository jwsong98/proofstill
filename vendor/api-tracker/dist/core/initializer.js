import fs from "node:fs/promises";
import path from "node:path";
import { getTrackerRoot } from "../storage/file-store.js";
import { createAdapterScaffolds } from "../v2/adapter.js";
const EXAMPLES = {
    "config.yaml": `version: 2
defaultApp: default

apps:
  default:
    root: .
    adapterDir: .api-tracker/scripts
    server:
      baseUrl: "http://localhost:8080"
    specs:
      contract: .api-tracker/apps/default/openapi.contract.yaml
      generated: .api-tracker/apps/default/generated/openapi.json
      ignorePointers: [/info/version, /servers]
    flow: .api-tracker/apps/default/flow.yaml
    lifecycle:
      timeoutMs: 60000
      invalidateAuthOnReset: false
    auth:
      defaultActor: user
      actors:
        user:
          label: "일반 사용자"
          meaning: { role: USER }
          credentials:
            email: "\${env.API_TRACKER_USER_EMAIL}"
            password: "\${env.API_TRACKER_USER_PASSWORD}"
          login: { operationId: login, tokenPath: "$.accessToken" }
          cache: { scope: app, maxAgeSeconds: 3600 }
        admin:
          label: "관리자"
          meaning: { role: ADMIN }
          credentials:
            email: "\${env.API_TRACKER_ADMIN_EMAIL}"
            password: "\${env.API_TRACKER_ADMIN_PASSWORD}"
          login: { operationId: login, tokenPath: "$.accessToken" }
          cache: { scope: app, maxAgeSeconds: 3600 }
`,
    "apps/default/openapi.contract.yaml": `openapi: 3.0.0
info:
  title: Example API
  version: 0.1.0
paths:
  /auth/login:
    post:
      operationId: login
      requestBody:
        required: true
      responses:
        "200":
          description: login success

  /projects:
    get:
      operationId: listProjects
      responses:
        "200":
          description: project list
    post:
      operationId: createProject
      requestBody:
        required: true
      responses:
        "201":
          description: created project

  /projects/{projectId}:
    get:
      operationId: getProject
      parameters:
        - name: projectId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: project detail
    patch:
      operationId: updateProject
      parameters:
        - name: projectId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
      responses:
        "200":
          description: updated project

  /projects/{projectId}/logs:
    get:
      operationId: listProjectLogs
      parameters:
        - name: projectId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: project logs
`,
    "apps/default/flow.yaml": `version: 1

# Default start screen. Override per session with:
# api-tracker flow start --session qa-flow --state login
initialState: login
defaultActor: user

states:
  login:
    route: /login
    actions:
      login_success:
        to: project_list
        calls:
          - id: login
            operationId: login
            actor: none
            body:
              email: "\${env.QA_EMAIL}"
              password: "\${env.QA_PASSWORD}"
            save:
              token: $.body.accessToken
            expect:
              status: 200

      login_failure:
        to: login
        manual:
          - email
          - password
        calls:
          - id: login
            operationId: login
            actor: none
            body:
              email: "\${manual.email}"
              password: "\${manual.password}"
            expect:
              status: 401

  project_list:
    route: /projects
    actions:
      load_projects:
        to: project_list
        calls:
          - id: listProjects
            operationId: listProjects
            expect:
              status: 200
            observe:
              project:
                id: $.body.projects[*].id
                label: $.body.projects[*].name

      open_project_detail:
        to: project_detail
        requires:
          project:
            observedAs: project
        calls:
          - id: getProject
            operationId: getProject
            params:
              projectId: "\${project.id}"
            expect:
              status: 200

      create_project:
        to: project_detail
        manual:
          - name
          - visibility
        calls:
          - id: createProject
            operationId: createProject
            body:
              name: "\${manual.name}"
              visibility: "\${manual.visibility}"
            expect:
              status: 201
            observe:
              project:
                id: $.body.id
                label: $.body.name

  project_detail:
    route: /projects/:projectId
    actions:
      update_project:
        to: project_detail
        requires:
          project:
            observedAs: project
        manual:
          - patch
        calls:
          - id: updateProject
            operationId: updateProject
            params:
              projectId: "\${project.id}"
            body: "\${manual.patch}"
            expect:
              status: 200
            observe:
              project:
                id: $.body.id
                label: $.body.name

      load_project_logs:
        to: project_detail
        requires:
          project:
            observedAs: project
        calls:
          - id: listProjectLogs
            operationId: listProjectLogs
            params:
              projectId: "\${project.id}"
            expect:
              status: 200

      back_to_list:
        to: project_list
        calls: []
`,
    ".gitignore": `runtime/
apps/*/generated/
*.log
`,
};
export async function initProject(options) {
    const root = getTrackerRoot();
    await fs.mkdir(root, { recursive: true });
    const created = [];
    const skipped = [];
    for (const [fileName, contents] of Object.entries(EXAMPLES)) {
        const filePath = path.join(root, fileName);
        const exists = await pathExists(filePath);
        if (exists && !options?.force) {
            skipped.push(fileName);
            continue;
        }
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, contents, "utf-8");
        created.push(fileName);
    }
    const workspaceRoot = path.dirname(root);
    const adapterFiles = await createAdapterScaffolds(workspaceRoot, ".api-tracker/scripts");
    created.push(...adapterFiles.map((file) => path.relative(root, file)));
    return { root, created, skipped };
}
async function pathExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=initializer.js.map