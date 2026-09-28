from pydantic import BaseModel

from app.models.route_input import RouteInput


class Route(BaseModel):
    stops: list[RouteInput]