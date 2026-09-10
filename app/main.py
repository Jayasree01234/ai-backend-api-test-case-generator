from fastapi import FastAPI

from app.database import engine
from app import models
from fastapi.middleware.cors import CORSMiddleware

from app.routes import user_test_routes
from app.routes.auth_routes import router as auth_router
from app.routes.project_routes import router as project_router
from app.routes.api_routes import router as api_router
from app.routes.export_routes import router as export_router

# Create database tables
models.Base.metadata.create_all(bind=engine)


# Create FastAPI application
app = FastAPI(
    title="AI Backend API Test Case Generator"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register application routers
app.include_router(auth_router)
app.include_router(project_router)
app.include_router(api_router)
app.include_router(user_test_routes.router)
app.include_router(export_router)


@app.get("/")
def root():
    return {
        "message": "AI Backend API Test Case Generator is running"
    }