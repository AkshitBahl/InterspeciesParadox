from typing import Annotated, Any

from pydantic import AfterValidator, BaseModel, ConfigDict

from app.services.geo import validate_geometry


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def _geometry(value: dict[str, Any]) -> dict[str, Any]:
    return validate_geometry(value)


def _point(value: dict[str, Any]) -> dict[str, Any]:
    value = validate_geometry(value)
    if value["type"] != "Point":
        raise ValueError("Expected a GeoJSON Point")
    return value


Geometry = Annotated[dict[str, Any], AfterValidator(_geometry)]
PointGeometry = Annotated[dict[str, Any], AfterValidator(_point)]


class Grounding(BaseModel):
    claim: str
    source: str
    value: Any = None


class Statement(BaseModel):
    """Something a species representative says. `grounding` lists the data behind each claim."""

    speaker: str
    title: str | None = None
    avatar: str | None = None
    species: str
    context: str
    lines: list[str]
    text: str
    grounding: list[Grounding] = []
    disclaimer: str
    topic: str | None = None


class Detail(BaseModel):
    detail: str
