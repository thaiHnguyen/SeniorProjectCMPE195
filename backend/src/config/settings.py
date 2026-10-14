"""
Application Settings
Loads configuration from environment variables
"""
import socket

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from .env file"""

    # Application
    app_name: str = "Smart Hydroponic System"
    debug: bool = True
    log_level: str = "INFO"

    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Database
    database_path: str = "./data/hydroponic.db"

    # Sensors
    use_mock_sensors: bool = False
    sensor_read_interval: int = 30  # seconds

    # Controller identity 
    # Name shown in the frontend navbar. Override with CONTROLLER_NAME in .env;
    # otherwise falls back to the Pi's hostname (e.g. "raspberrypi").
    controller_name: str = socket.gethostname()

    # CORS
    allowed_origins: str = "*"

    @property
    def allowed_origins_list(self) -> List[str]:
        """Convert comma-separated origins to list"""
        if self.allowed_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
