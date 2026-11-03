import json
from pathlib import Path
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.health import add_health_routes
from app.tasks import add_task_routes
from app.schemas import APIError


def create_http_app(*, lifespan, task_provider, cors: dict, request_log: str | None = None) -> FastAPI:
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

    add_health_routes(app)
    add_task_routes(app, task_provider)

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
    app.add_middleware(CORSMiddleware, **cors,
                       allow_methods=['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
                       allow_headers=['Authorization', 'Content-Type', 'Accept'],
                       expose_headers=['WWW-Authenticate'])
    return app
