import unittest
from examples.order_workspace.workspace import Workspace, UnsavedChanges


class MemoryOrders:
    def __init__(self):
        self.rows = {1: {'id': 1, 'amount': 10, 'status': 'open'}, 2: {'id': 2, 'amount': 20, 'status': 'open'}}
        self.fail = False
        self.queries = []

    def search(self, query, page):
        self.queries.append((query, page))
        return [dict(row) for row in self.rows.values() if not query or row['status'] == query]

    def get(self, identifier):
        return dict(self.rows[identifier])

    def save(self, identifier, amount):
        if self.fail:
            raise OSError('SAVE_OFFLINE')
        self.rows[identifier]['amount'] = amount
        return self.get(identifier)


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.store = MemoryOrders()
        self.app = Workspace(self.store)

    def select(self, identifier=1):
        ticket = self.app.begin_detail(identifier)
        self.app.accept_detail(ticket, self.store.get(identifier))

    def test_task_boundaries_preserve_navigation_and_remove_retrievable_data(self):
        self.app.search('open', 2)
        self.select()
        self.assertNotIn('items', self.app.snapshot()['data'])
        self.app.begin_edit()
        self.assertEqual(set(self.app.snapshot()['data']), {'query', 'page', 'selected_id', 'draft'})
        self.app.change_amount(35)
        self.app.save()
        self.assertEqual(self.app.snapshot()['screen'], 'orders.detail')
        self.assertNotIn('draft', self.app.snapshot()['data'])
        self.app.back_to_list()
        state = self.app.snapshot()
        self.assertEqual((state['data']['query'], state['data']['page']), ('open', 2))
        self.assertEqual(state['data']['items'][0]['amount'], 35)
        self.assertNotIn('selected_id', state['data'])
        self.assertEqual(self.store.queries, [('open', 2), ('open', 2)])
        self.assertNotIn('total', state['data'])
        self.assertEqual(self.app.view()['total'], 55)
        self.app.leave()
        self.assertEqual(self.app.snapshot(), {'feature': 'home', 'screen': 'home', 'data': {}})
        self.app.search('', 1)
        self.assertEqual(self.app.snapshot()['data']['query'], '')

    def test_unsaved_edit_requires_explicit_cancel_and_does_not_leak_to_other_order(self):
        self.app.search('open', 1)
        self.select()
        self.app.begin_edit(); self.app.change_amount(999)
        before = self.app.snapshot()
        for action in [lambda: self.app.begin_detail(2), self.app.leave, self.app.back_to_list, lambda: self.app.search('', 1)]:
            with self.assertRaises(UnsavedChanges):
                action()
            self.assertEqual(self.app.snapshot(), before)
        self.app.cancel_edit()
        self.assertEqual(self.app.snapshot()['data']['detail']['amount'], 10)
        self.select(2); self.app.begin_edit()
        self.assertEqual(self.app.snapshot()['data']['draft']['amount'], 20)
        self.assertEqual(self.store.rows[1]['amount'], 10)

    def test_save_failure_preserves_draft_and_retry_cleans_error(self):
        self.app.search('open', 1); self.select(); self.app.begin_edit(); self.app.change_amount(88)
        self.store.fail = True
        with self.assertRaisesRegex(OSError, 'SAVE_OFFLINE'):
            self.app.save()
        self.assertEqual(self.app.snapshot()['screen'], 'orders.edit')
        self.assertEqual(self.app.snapshot()['data']['draft'], {'amount': 88})
        self.assertEqual(self.store.rows[1]['amount'], 10)
        self.store.fail = False
        self.app.save()
        self.assertEqual(self.app.snapshot()['data']['detail']['amount'], 88)
        self.assertNotIn('error', self.app.snapshot()['data'])

    def test_late_detail_response_cannot_override_new_selection_or_reenter_exited_feature(self):
        self.app.search('', 1)
        old = self.app.begin_detail(1)
        current = self.app.begin_detail(2)
        self.assertTrue(self.app.accept_detail(current, self.store.get(2)))
        before = self.app.snapshot()
        self.assertFalse(self.app.accept_detail(old, self.store.get(1)))
        self.assertEqual(self.app.snapshot(), before)
        pending = self.app.begin_detail(1)
        self.app.leave(); self.app.search('', 1)
        fresh = self.app.begin_detail(1)
        before = self.app.snapshot()
        self.assertNotEqual(pending, fresh)
        self.assertFalse(self.app.accept_detail(pending, self.store.get(1)))
        self.assertEqual(self.app.snapshot(), before)

    def test_invalid_actions_and_response_identity_cannot_mutate_state(self):
        for action in [self.app.begin_edit, self.app.save, self.app.cancel_edit, self.app.back_to_list]:
            with self.assertRaises(ValueError):
                action()
        self.app.search('', 1)
        ticket = self.app.begin_detail(1)
        before = self.app.snapshot()
        with self.assertRaises(ValueError):
            self.app.accept_detail(ticket, self.store.get(2))
        self.assertEqual(self.app.snapshot(), before)
        self.app.accept_detail(ticket, self.store.get(1)); self.app.begin_edit()
        for amount in [True, 0, -1, '10']:
            with self.assertRaises(ValueError):
                self.app.change_amount(amount)
        exposed = self.app.snapshot(); exposed['data']['draft']['amount'] = 999
        self.assertEqual(self.app.snapshot()['data']['draft']['amount'], 10)

    def test_missing_or_boolean_request_token_cannot_rewrite_resolved_detail(self):
        self.app.search('', 1)
        ticket = self.app.begin_detail(1)
        before = self.app.snapshot()
        self.assertFalse(self.app.accept_detail(True, {'id': 1, 'amount': 999, 'status': 'open'}))
        self.assertEqual(self.app.snapshot(), before)
        self.app.accept_detail(ticket, self.store.get(1))
        before = self.app.snapshot()
        self.assertFalse(self.app.accept_detail(None, {'id': 1, 'amount': 999, 'status': 'open'}))
        self.assertEqual(self.app.snapshot(), before)
