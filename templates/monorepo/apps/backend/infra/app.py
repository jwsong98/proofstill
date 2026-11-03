import asyncio
from contextlib import asynccontextmanager
import os
from uuid import uuid4

from fastapi import Depends, FastAPI, Request
from sqlalchemy.orm import Session

from app.http import create_http_app
from usecase.tasks import TaskList
from infra.database import create_database, is_memory, migrate, require_current, seed
from infra.settings import cors_settings
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

    return create_http_app(lifespan=lifespan, task_provider=get_tasks,
                           cors=cors_settings(), request_log=request_log)


app = create_app()
