from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import database
from app.routers import observations, ingest, entities


@asynccontextmanager
async def lifespan(app: FastAPI):
    await database.init_pool()
    yield
    await database.close_pool()


app = FastAPI(title="Water Quality API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(observations.router)
app.include_router(ingest.router)
app.include_router(entities.router)


@app.get("/health")
def health():
    return {"status": "ok"}
