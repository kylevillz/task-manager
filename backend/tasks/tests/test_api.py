from rest_framework import status
from rest_framework.test import APITestCase

from tasks.models import Task


class TaskApiTests(APITestCase):
    def setUp(self):
        self.task = Task.objects.create(title='Write README', description='Setup steps')

    def test_list(self):
        res = self.client.get('/tasks/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)

    def test_create(self):
        res = self.client.post('/tasks/', {'title': 'New task'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['description'], '')
        self.assertFalse(res.data['completed'])

    def test_create_requires_title(self):
        res = self.client.post('/tasks/', {'title': '   '}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retrieve(self):
        res = self.client.get(f'/tasks/{self.task.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['title'], 'Write README')

    def test_retrieve_missing(self):
        res = self.client.get('/tasks/9999/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_put_updates_title_and_description_only(self):
        res = self.client.put(
            f'/tasks/{self.task.id}/',
            {'title': 'Edited', 'description': 'New', 'completed': True},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.task.refresh_from_db()
        self.assertEqual(self.task.title, 'Edited')
        self.assertEqual(self.task.description, 'New')
        self.assertFalse(self.task.completed)

    def test_patch_toggles(self):
        res = self.client.patch(f'/tasks/{self.task.id}/', {}, format='json')
        self.assertTrue(res.data['completed'])
        res = self.client.patch(f'/tasks/{self.task.id}/', {}, format='json')
        self.assertFalse(res.data['completed'])

    def test_patch_explicit_value(self):
        res = self.client.patch(f'/tasks/{self.task.id}/', {'completed': True}, format='json')
        self.assertTrue(res.data['completed'])

    def test_patch_rejects_other_fields(self):
        res = self.client.patch(f'/tasks/{self.task.id}/', {'title': 'x'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete(self):
        res = self.client.delete(f'/tasks/{self.task.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Task.objects.exists())
