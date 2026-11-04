import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/store.ts';

test('archiving hides a project while preserving immutable evidence and sessions', () => {
  const store = new Store();
  try {
    const project = store.createProject({ name: 'Internal setup', rootPath: '/setup' });
    const node = store.captureEvidence(project.id, { title: 'Original', sourceKind: 'message', source: { threadId: 'original', messageId: 'one' }, content: 'preserve' });
    const session = store.createSession(project.id, { title: 'Conversation' });
    store.setProjectArchived(project.id, true);
    assert.deepEqual(store.listProjects(), []);
    assert.equal(store.getNode(project.id, node.id).evidence?.content, 'preserve');
    assert.equal(store.getSession(session.id).projectId, project.id);
    assert.throws(() => store.db.prepare('DELETE FROM evidence WHERE id=?').run(node.evidenceId!), /immutable/);
    store.setProjectArchived(project.id, false);
    assert.equal(store.listProjects()[0].id, project.id);
    assert.throws(() => store.setProjectArchived('missing', true), /not found/);
  } finally { store.close(); }
});
