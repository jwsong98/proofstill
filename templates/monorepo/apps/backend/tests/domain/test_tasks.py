import unittest
from domain.tasks import new_task, validate_completed


class TaskRulesTests(unittest.TestCase):
    def test_normalizes_title_and_generates_distinct_ids(self):
        first, second = new_task(' work '), new_task('work')
        self.assertEqual(first['title'], 'work')
        self.assertFalse(first['completed'])
        self.assertNotEqual(first['id'], second['id'])

    def test_rejects_invalid_titles_and_completion(self):
        for title in ['', '  ', None, 3, True]:
            with self.subTest(title=title), self.assertRaises(ValueError):
                new_task(title)
        for value in [None, 1, 0, 'true']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_completed(value)
        for value in [True, False]:
            self.assertIs(validate_completed(value), value)
