from fastapi import Depends, HTTPException
from app.schemas import APIError, TaskCreate, TaskResponse, TaskUpdate
from usecase.tasks import TaskList


def add_task_routes(app, task_provider):
    @app.post('/tasks', operation_id='createTask', summary='Register a task',
              status_code=201, response_model=TaskResponse, responses={400: {'model': APIError}})
    def create_task(body: TaskCreate, tasks: TaskList = Depends(task_provider)):
        return tasks.create(body.title)

    @app.get('/tasks/{id}', operation_id='getTask', summary='Read saved task',
             response_model=TaskResponse, responses={404: {'model': APIError}})
    def get_task(id: str, tasks: TaskList = Depends(task_provider)):
        try:
            return tasks.get(id)
        except KeyError:
            raise HTTPException(404, 'Task not found') from None

    @app.patch('/tasks/{id}', operation_id='updateTask', summary='Set task completion',
               response_model=TaskResponse, responses={400: {'model': APIError}, 404: {'model': APIError}})
    def update_task(id: str, body: TaskUpdate, tasks: TaskList = Depends(task_provider)):
        try:
            return tasks.update(id, body.completed)
        except KeyError:
            raise HTTPException(404, 'Task not found') from None
