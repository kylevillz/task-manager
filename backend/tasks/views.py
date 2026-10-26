from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.response import Response

from .models import Task
from .serializers import TaskSerializer


class TaskViewSet(viewsets.ViewSet):
    def list(self, request):
        tasks = Task.objects.all()
        return Response(TaskSerializer(tasks, many=True).data)

    def create(self, request):
        serializer = TaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        task = get_object_or_404(Task, pk=pk)
        return Response(TaskSerializer(task).data)

    def update(self, request, pk=None):
        """PUT: replace title and description. `completed` is ignored here."""
        task = get_object_or_404(Task, pk=pk)
        serializer = TaskSerializer(task, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def partial_update(self, request, pk=None):
        """PATCH: toggle `completed` only.

        An empty body flips the current value. A body of {"completed": true|false}
        sets it explicitly. Any other field is rejected.
        """
        task = get_object_or_404(Task, pk=pk)

        extra = set(request.data.keys()) - {'completed'}
        if extra:
            return Response(
                {'detail': f'PATCH only accepts "completed". Got: {", ".join(sorted(extra))}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if 'completed' in request.data:
            value = request.data['completed']
            if not isinstance(value, bool):
                return Response(
                    {'completed': ['Must be a boolean.']},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            task.completed = value
        else:
            task.completed = not task.completed

        task.save(update_fields=['completed'])
        return Response(TaskSerializer(task).data)

    def destroy(self, request, pk=None):
        task = get_object_or_404(Task, pk=pk)
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
