"""
Smart Hydroponic System - Main Entry Point
"""

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.src.config.settings import settings
from backend.src.storage import db_manager
from backend.src.services.data_collector import data_collector
from backend.src.utils.logger import logger

# Import routes
from backend.src.api.routes import health, sensors, configurations, alerts


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup and shutdown events
    """
    # === STARTUP ===
    logger.info("Starting Smart Hydroponic System...")

    # Initialize database
    try:
        await db_manager.initialize()
        logger.success("Database initialized")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise

    # Start background data collection
    try:
        await data_collector.start()
        logger.success("Background data collection started")
    except Exception as e:
        logger.error(f"Data collector failed to start: {e}")
        raise

    logger.info(f"API Server: http://{settings.api_host}:{settings.api_port}")
    logger.info(f"API Docs: http://{settings.api_host}:{settings.api_port}/docs")
    logger.info(f"Using {'MOCK' if settings.use_mock_sensors else 'REAL'} sensors")
    logger.info(f"Sensor read interval: {settings.sensor_read_interval} seconds")

    yield

    # === SHUTDOWN ===
    logger.info("Shutting down Smart Hydroponic System...")

    # Stop background data collection
    await data_collector.stop()

    logger.info("Goodbye!")


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    debug=settings.debug,
    description="Smart Hydroponic Garden System API",
    lifespan=lifespan,
)

# Add CORS middleware
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(sensors.router)
app.include_router(configurations.router)
app.include_router(alerts.router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Smart Hydroponic System API",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
        "health": "/api/health",
        "data_collector": data_collector.get_status(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.src.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
    )
