from uuid import uuid4
from fastapi import HTTPException, Request
from app.schemas import APIError, HealthResponse
from usecase.health import health


def add_health_routes(app):
    @app.get('/health', operation_id='getHealth', response_model=HealthResponse,
             responses={400: {'model': APIError, 'description': 'Unknown previous request'}})
    async def get_health(request: Request, previous: str | None = None):
        if previous is not None and previous not in request.app.state.seen:
            raise HTTPException(400, 'Unknown previous request')
        request_id = str(uuid4())
        request.app.state.seen.add(request_id)
        return {**health(), 'instance': request.app.state.instance, 'requestId': request_id, 'previous': previous}
