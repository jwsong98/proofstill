def openapi_document():
    task_response = {'description': 'Stored task', 'content': {'application/json': {'schema': {'$ref': '#/components/schemas/Task'}}}}
    task_id = {'name': 'id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}
    return {
        'openapi': '3.0.3', 'info': {'title': 'Project API', 'version': '0.2.0'},
        'paths': {
            '/health': {'get': {
                'operationId': 'getHealth',
                'parameters': [{'name': 'previous', 'in': 'query', 'required': False, 'schema': {'type': 'string'}}],
                'responses': {
                    '200': {'description': 'Health and request identity', 'content': {'application/json': {'schema': {'$ref': '#/components/schemas/Health'}}}},
                    '400': {'description': 'Unknown previous request'},
                },
            }},
            '/tasks': {'post': {
                'operationId': 'createTask', 'summary': 'Register a task',
                'requestBody': {'required': True, 'content': {'application/json': {'schema': {
                    'type': 'object', 'required': ['title'], 'properties': {'title': {'type': 'string', 'minLength': 1}},
                }}}},
                'responses': {'201': task_response, '400': {'description': 'Invalid title'}},
            }},
            '/tasks/{id}': {
                'parameters': [task_id],
                'get': {'operationId': 'getTask', 'summary': 'Read saved task',
                        'responses': {'200': task_response, '404': {'description': 'Task not found'}}},
                'patch': {
                    'operationId': 'updateTask', 'summary': 'Set task completion',
                    'requestBody': {'required': True, 'content': {'application/json': {'schema': {
                        'type': 'object', 'required': ['completed'], 'properties': {'completed': {'type': 'boolean'}},
                    }}}},
                    'responses': {'200': task_response, '400': {'description': 'Invalid completion'}, '404': {'description': 'Task not found'}},
                },
            },
        },
        'components': {'schemas': {
            'Health': {'type': 'object', 'required': ['status', 'instance', 'requestId'], 'properties': {
                'status': {'type': 'string'}, 'instance': {'type': 'string'}, 'requestId': {'type': 'string'},
                'previous': {'type': 'string', 'nullable': True},
            }},
            'Task': {'type': 'object', 'required': ['id', 'title', 'completed'], 'properties': {
                'id': {'type': 'string'}, 'title': {'type': 'string'}, 'completed': {'type': 'boolean'},
            }},
        }},
    }
