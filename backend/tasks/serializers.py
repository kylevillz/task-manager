from rest_framework import serializers

from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    """Used for list, retrieve, create and PUT. `completed` is changed only via PATCH."""

    class Meta:
        model = Task
        fields = ['id', 'title', 'description', 'completed', 'created_at']
        read_only_fields = ['id', 'completed', 'created_at']

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Title cannot be blank.')
        return value
