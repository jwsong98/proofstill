import asyncio
from contextlib import asynccontextmanager
import json
import os
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from domain.health import health
from domain.tasks import TaskList
from infra.database import create_database, is_memory, migrate, require_current, seed
from infra.settings import cors_settings
from infra.schemas import APIError, HealthResponse, TaskCreate, TaskResponse, TaskUpdate
from infra.task_repository import TaskRepository


async def get_session(request: Request):
    # StaticPool shares one SQLite memory connection: keep its transactions separate.
    async with request.app.state.database_lock:
        with Session(request.app.state.database) as session:
            yield session


def get_tasks(session: Session = Depends(get_session)):
    return TaskList(TaskRepository(session))


def create_app(*, database_url: str | None = None, request_log: str | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        database = create_database(database_url or os.environ.get('DATABASE_URL') or 'sqlite+pysqlite:///:memory:')
        try:
            if is_memory(database):
                migrate(database)
                seed(database)
            else:
                require_current(database)
            app.state.database = database
            app.state.database_lock = asyncio.Lock()
            app.state.instance = str(uuid4())
            app.state.seen = set()
            app.state.token = os.environ.get('PROOFSTILL_SERVER_TOKEN')
            yield
        finally:
            database.dispose()

    # 4XX documents the shared validation handler and avoids FastAPI's default 422.
    app = FastAPI(title='Project API', version='0.3.0', lifespan=lifespan,
                  responses={'4XX': {'model': APIError}})

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, error: RequestValidationError):
        return JSONResponse({'error': error.errors()[0]['msg']}, status_code=400)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, error: StarletteHTTPException):
        return JSONResponse({'error': str(error.detail)}, status_code=error.status_code, headers=error.headers)

    @app.middleware('http')
    async def record_request(request: Request, call_next):
        if request.url.path.startswith('/tasks') and request.method in {'POST', 'PATCH'}:
            try:
                size = int(request.headers.get('content-length', '0'))
            except ValueError:
                size = 0
            if not 0 < size <= 1024 * 1024:
                return JSONResponse({'error': 'Expected a JSON body up to 1 MiB'}, status_code=400)
            body = await request.body()
            if not body or len(body) > 1024 * 1024:
                return JSONResponse({'error': 'Expected a JSON body up to 1 MiB'}, status_code=400)
        response = await call_next(request)
        if (request_log and response.headers.get('content-type', '').startswith('application/json')
                and not request.url.path.startswith(('/__proofstill/', '/openapi.json', '/docs', '/redoc'))):
            content = b''.join([chunk async for chunk in response.body_iterator])
            with Path(request_log).open('a') as log:
                log.write(json.dumps({'method': request.method,
                                      'path': request.url.path + ('?' + request.url.query if request.url.query else ''),
                                      'status': response.status_code, 'body': json.loads(content)}) + '\n')
            return Response(content, status_code=response.status_code, headers=dict(response.headers),
                            background=response.background)
        return response

    @app.get('/health', operation_id='getHealth', response_model=HealthResponse,
             responses={400: {'model': APIError, 'description': 'Unknown previous request'}})
    async def get_health(request: Request, previous: str | None = None):
        if previous is not None and previous not in app.state.seen:
            raise HTTPException(400, 'Unknown previous request')
        request_id = str(uuid4())
        app.state.seen.add(request_id)
        return {**health(), 'instance': app.state.instance, 'requestId': request_id, 'previous': previous}

    @app.post('/tasks', operation_id='createTask', summary='Register a task',
              status_code=201, response_model=TaskResponse, responses={400: {'model': APIError}})
    def create_task(body: TaskCreate, tasks: TaskList = Depends(get_tasks)):
        return tasks.create(body.title)

    @app.get('/tasks/{id}', operation_id='getTask', summary='Read saved task',
             response_model=TaskResponse, responses={404: {'model': APIError}})
    def get_task(id: str, tasks: TaskList = Depends(get_tasks)):
        try:
            return tasks.get(id)
        except KeyError:
            raise HTTPException(404, 'Task not found') from None

    @app.patch('/tasks/{id}', operation_id='updateTask', summary='Set task completion',
               response_model=TaskResponse, responses={400: {'model': APIError}, 404: {'model': APIError}})
    def update_task(id: str, body: TaskUpdate, tasks: TaskList = Depends(get_tasks)):
        try:
            return tasks.update(id, body.completed)
        except KeyError:
            raise HTTPException(404, 'Task not found') from None

    def require_owner(request: Request):
        if not app.state.token or request.headers.get('X-Proofstill-Token') != app.state.token:
            raise HTTPException(403, 'Not owned')

    @app.get('/__proofstill/owner', include_in_schema=False, dependencies=[Depends(require_owner)])
    async def owner():
        return {'instance': app.state.instance}

    @app.post('/__proofstill/stop', include_in_schema=False, dependencies=[Depends(require_owner)])
    async def stop():
        app.state.shutdown()
        return {'ok': True}

    # Added last so handled API errors and early body rejections also receive CORS headers.
    app.add_middleware(CORSMiddleware, **cors_settings(),
                       allow_methods=['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                       allow_headers=['Authorization', 'Content-Type', 'Accept'],
                       expose_headers=['WWW-Authenticate'])
    return app


app = create_app()
