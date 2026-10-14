"""
Centralized logging configuration using loguru
"""

import sys
from pathlib import Path
from loguru import logger as _logger

# Remove default handler
_logger.remove()

# Create logs directory
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

# Console handler with colors
_logger.add(
    sys.stdout,
    level="INFO",
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    colorize=True,
)

# File handler - all logs
_logger.add(
    "logs/app.log",
    rotation="1 day",
    retention="7 days",
    level="DEBUG",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function} - {message}",
    delay=True,   # NEW: open the file on first write, so uvicorn's reload watcher never locks it (Windows)
)

# File handler - errors only
_logger.add(
    "logs/error.log",
    rotation="1 day",
    retention="30 days",
    level="ERROR",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    delay=True,   # NEW: same reason
)

# Export configured logger
logger = _logger
