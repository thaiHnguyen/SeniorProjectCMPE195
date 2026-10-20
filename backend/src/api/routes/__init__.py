"""API route modules"""

from . import health
from . import sensors
from . import configurations
from . import alerts
from . import auth  # NEW: login/logout

__all__ = ["health", "sensors", "configurations", "alerts", "auth"]