"""
Database manager for SQLite operations
"""

import aiosqlite
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta

from backend.src.config.settings import settings
from backend.src.utils.logger import logger


# columns added after the first release. `CREATE TABLE IF NOT EXISTS` skips
# tables that already exist, so a DB created before this change (e.g. on the Pi)
# would never get them. initialize() adds any that are missing.
# (table, column, column definition)
ADDED_COLUMNS = [
    ("sensor_readings", "aqi_score", "INTEGER"),
    ("threshold_configurations", "pressure_min", "REAL NOT NULL DEFAULT 990"),
    ("threshold_configurations", "pressure_max", "REAL NOT NULL DEFAULT 1030"),
    ("threshold_configurations", "aqi_min", "REAL NOT NULL DEFAULT 1"),
    ("threshold_configurations", "aqi_max", "REAL NOT NULL DEFAULT 2"),
    # NEW (login): alerts are per user
    ("alerts", "user_id", "INTEGER REFERENCES users(id) ON DELETE CASCADE"),
]

# NEW (login): the config table from before accounts existed is kept under this
# name instead of being deleted, so no profile anyone made is lost.
LEGACY_CONFIG_TABLE = "threshold_configurations_legacy"

# NEW (login): columns copied from a template into a new user's profile
PROFILE_COLUMNS = (
    "name, description, ph_min, ph_max, temp_min, temp_max, "
    "humidity_min, humidity_max, pressure_min, pressure_max, aqi_min, aqi_max, is_active"
)


class DatabaseManager:
    """Manages SQLite database operations"""

    def __init__(self):
        self.db_path = settings.database_path
        self._ensure_data_directory()

    def _ensure_data_directory(self):
        """Create data directory if it doesn't exist"""
        db_dir = Path(self.db_path).parent
        db_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Database directory: {db_dir}")

    async def initialize(self):
        """Initialize database with schema"""
        try:
            schema_path = (
                Path(__file__).parent.parent / "config" / "database_schema.sql"
            )

            if not schema_path.exists():
                raise FileNotFoundError(f"Schema file not found: {schema_path}")

            async with aiosqlite.connect(self.db_path) as db:
                with open(schema_path, "r") as f:
                    schema_sql = f.read()

                # CHANGED (login): upgrade older DBs BEFORE running the schema.
                # The schema now creates indexes on user_id columns, which would
                # fail on an old table that doesn't have them yet.
                await self._migrate_configurations_per_user(db)  # NEW
                await self._add_missing_columns(db)

                await db.executescript(schema_sql)
                await self._migrate_alert_severity(db, schema_sql)
                await db.commit()

            logger.success(f" Database initialized: {self.db_path}")

        except Exception as e:
            logger.error(f" Database initialization failed: {e}")
            raise

    async def _add_missing_columns(self, db):
        """
        NEW: add any ADDED_COLUMNS the existing tables don't have yet.
        Safe to run on every start: columns that already exist are skipped.
        Existing profile rows get the column DEFAULT (990-1030 hPa, AQ 1-2).
        """
        for table, column, definition in ADDED_COLUMNS:
            cursor = await db.execute(f"PRAGMA table_info({table})")
            existing = {row[1] for row in await cursor.fetchall()}
            # CHANGED: now runs before the schema, so on a brand-new DB the table
            # doesn't exist yet (empty result). The schema will create it complete.
            if not existing:
                continue
            if column not in existing:
                await db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
                logger.info(f"Migrated: added {table}.{column}")

    async def _migrate_configurations_per_user(self, db):
        """
        NEW (login): profiles used to be shared by everyone, with `name UNIQUE`
        and one global active profile. SQLite can't drop a UNIQUE constraint in
        place, so an older table is set aside instead:
            1. rename it to threshold_configurations_legacy (rows are kept)
            2. drop its trigger, so the schema can create the per-user version
        The schema then creates the new table and re-adds the presets as templates.
        Skipped when the table doesn't exist yet or already has user_id.
        """
        cursor = await db.execute("PRAGMA table_info(threshold_configurations)")
        columns = {row[1] for row in await cursor.fetchall()}
        if not columns or "user_id" in columns:
            return  # brand-new DB, or already migrated

        await db.execute(
            f"ALTER TABLE threshold_configurations RENAME TO {LEGACY_CONFIG_TABLE}"
        )
        await db.execute("DROP TRIGGER IF EXISTS one_active_configuration")
        logger.info(
            f"Migrated: shared profiles kept in {LEGACY_CONFIG_TABLE}; "
            "profiles are now per user"
        )

    async def _migrate_alert_severity(self, db, schema_sql: str):
        """
        NEW: alert severity was renamed info|warning|critical -> normal|warning|danger.
        SQLite can't change a CHECK constraint in place, so an older alerts table
        would reject every new 'danger' alert. Rebuild it once, keeping all rows:
            1. move the old table aside
            2. re-run the schema to create the new alerts table (+ its index)
            3. copy rows over, renaming info -> normal and critical -> danger
            4. drop the old table
        Skipped when the table already has the new constraint.
        """
        cursor = await db.execute(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'alerts'"
        )
        row = await cursor.fetchone()
        if not row or "'danger'" in row[0]:
            return  # already has the new constraint (or the table doesn't exist)

        await db.execute("ALTER TABLE alerts RENAME TO alerts_old")
        # The index keeps its name on the renamed table; drop it so the schema
        # can create it again on the new table
        await db.execute("DROP INDEX IF EXISTS idx_alerts_unread")
        await db.execute("DROP INDEX IF EXISTS idx_alerts_user")  # NEW (login)
        await db.executescript(schema_sql)  # every statement is IF NOT EXISTS / OR IGNORE
        await db.execute(
            """
            INSERT INTO alerts
                (id, alert_type, sensor_type, message, severity, reading_value,
                threshold_min, threshold_max, is_read, is_resolved, created_at, resolved_at)
            SELECT
                id, alert_type, sensor_type, message,
                CASE severity WHEN 'info' THEN 'normal'
                                WHEN 'critical' THEN 'danger'
                                ELSE severity END,
                reading_value, threshold_min, threshold_max,
                is_read, is_resolved, created_at, resolved_at
            FROM alerts_old
        """
        )
        await db.execute("DROP TABLE alerts_old")
        logger.info("Migrated: alert severity renamed to normal|warning|danger")

    # ==================== SENSOR READINGS ====================

    async def insert_sensor_reading(
        self, sensor_type: str, data: Dict[str, Any]
    ) -> int:
        """
        Insert sensor reading into database

        Args:
            sensor_type: Type of sensor (bme280, bme680, ph)
            data: Sensor reading data

        Returns:
            ID of inserted row
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute(
                    """
                    INSERT INTO sensor_readings 
                    (sensor_type, temperature, humidity, pressure, 
                    gas_resistance, air_quality, aqi_score, ph)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        sensor_type,
                        data.get("temperature"),
                        data.get("humidity"),
                        data.get("pressure"),
                        data.get("gas_resistance"),
                        data.get("air_quality"),
                        data.get("aqi_score"),  # NEW: BME680 1-4 score (was computed, never saved)
                        data.get("ph"),
                    ),
                )
                await db.commit()
                return cursor.lastrowid

        except Exception as e:
            logger.error(f"Error inserting sensor reading: {e}")
            raise

    async def get_latest_readings(self) -> List[Dict]:
        """Get most recent reading from each sensor"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row

                cursor = await db.execute(
                    """
                    SELECT * FROM sensor_readings 
                    WHERE id IN (
                        SELECT MAX(id) 
                        FROM sensor_readings 
                        GROUP BY sensor_type
                    )
                    ORDER BY sensor_type
                """
                )

                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

        except Exception as e:
            logger.error(f"Error getting latest readings: {e}")
            return []

    async def get_historical_data(
        self, hours: int = 24, limit: int = 1000, sensor_type: Optional[str] = None
    ) -> List[Dict]:
        """
        Get historical sensor data

        Args:
            hours: Number of hours to look back
            limit: Maximum number of records
            sensor_type: Filter by sensor type (optional)

        Returns:
            List of sensor readings
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row

                if sensor_type:
                    cursor = await db.execute(
                        """
                        SELECT * FROM sensor_readings 
                        WHERE sensor_type = ?
                        AND timestamp >= datetime('now', '-' || ? || ' hours')
                        ORDER BY timestamp DESC
                        LIMIT ?
                    """,
                        (sensor_type, hours, limit),
                    )
                else:
                    cursor = await db.execute(
                        """
                        SELECT * FROM sensor_readings 
                        WHERE timestamp >= datetime('now', '-' || ? || ' hours')
                        ORDER BY timestamp DESC
                        LIMIT ?
                    """,
                        (hours, limit),
                    )

                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

        except Exception as e:
            logger.error(f"Error getting historical data: {e}")
            return []

    async def delete_old_readings(self, days: int = 30) -> int:
        """
        Delete sensor readings older than specified days

        Args:
            days: Delete readings older than this many days

        Returns:
            Number of rows deleted
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute(
                    """
                    DELETE FROM sensor_readings 
                    WHERE timestamp < datetime('now', '-' || ? || ' days')
                """,
                    (days,),
                )
                await db.commit()
                deleted = cursor.rowcount

                if deleted > 0:
                    logger.info(f"Deleted {deleted} old sensor readings")

                return deleted

        except Exception as e:
            logger.error(f"Error deleting old readings: {e}")
            return 0

    # ==================== USERS & SESSIONS (NEW: login) ====================

    async def create_user(self, name: str, email: str, password_hash: str) -> int:
        """
        Insert a new user. Raises aiosqlite.IntegrityError if the email is taken
        (the route turns that into a 409 "email already registered").
        """
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
                (name, email, password_hash),
            )
            await db.commit()
            logger.info(f"Created user ID: {cursor.lastrowid}")
            return cursor.lastrowid

    async def get_user_by_email(self, email: str) -> Optional[Dict]:
        """Look up a user for login (email match is case-insensitive)."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def create_session(
        self, token_hash: str, user_id: int, ttl_hours: float
    ) -> None:
        """
        Store a new login that expires ttl_hours from now.
        Times use SQLite's datetime('now') (UTC) on both write and check,
        so the Pi's timezone never matters.
        Also clears out expired sessions while we're here.
        """
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM sessions WHERE expires_at <= datetime('now')")
            await db.execute(
                """
                INSERT INTO sessions (token_hash, user_id, expires_at)
                VALUES (?, ?, datetime('now', ?))
                """,
                (token_hash, user_id, f"+{int(ttl_hours * 3600)} seconds"),
            )
            await db.commit()

    async def get_session_user(self, token_hash: str) -> Optional[Dict]:
        """
        Return the user for a session that exists and hasn't expired, else None.
        Never returns the password hash.
        """
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """
                SELECT users.id, users.name, users.email, users.created_at
                FROM sessions JOIN users ON users.id = sessions.user_id
                WHERE sessions.token_hash = ? AND sessions.expires_at > datetime('now')
                """,
                (token_hash,),
            )
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def delete_session(self, token_hash: str) -> None:
        """Logout: the token stops working immediately."""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
            await db.commit()

    # THRESHOLD CONFIGURATIONS
    # CHANGED (login): every method takes the user_id it acts for, and only ever
    # touches that user's rows. A profile id from another account behaves exactly
    # like an id that doesn't exist (404), so users can't probe each other's data.

    async def seed_user_profiles(self, user_id: int) -> int:
        """
        NEW: copy every template (user_id IS NULL) into the new user's account.
        The template marked is_active = 1 becomes their starting active profile.

        Returns:
            Number of profiles created
        """
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                f"""
                INSERT INTO threshold_configurations (user_id, {PROFILE_COLUMNS})
                SELECT ?, {PROFILE_COLUMNS}
                FROM threshold_configurations
                WHERE user_id IS NULL
                """,
                (user_id,),
            )
            await db.commit()
            logger.info(f"Seeded {cursor.rowcount} example profiles for user {user_id}")
            return cursor.rowcount

    async def get_configurations(self, user_id: int) -> List[Dict]:
        """Get all of one user's threshold configurations"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row

                cursor = await db.execute(
                    """
                    SELECT * FROM threshold_configurations
                    WHERE user_id = ?
                    ORDER BY name
                """,
                    (user_id,),
                )

                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

        except Exception as e:
            logger.error(f"Error getting configurations: {e}")
            return []

    async def get_configuration(self, config_id: int, user_id: int) -> Optional[Dict]:
        """Get one of this user's configurations by ID (None if not theirs)"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row

                cursor = await db.execute(
                    """
                    SELECT * FROM threshold_configurations
                    WHERE id = ? AND user_id = ?
                """,
                    (config_id, user_id),
                )

                row = await cursor.fetchone()
                return dict(row) if row else None

        except Exception as e:
            logger.error(f"Error getting configuration: {e}")
            return None

    async def get_active_configuration(self, user_id: int) -> Optional[Dict]:
        """Get this user's active threshold configuration"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row

                cursor = await db.execute(
                    """
                    SELECT * FROM threshold_configurations
                    WHERE user_id = ? AND is_active = 1
                    LIMIT 1
                """,
                    (user_id,),
                )

                row = await cursor.fetchone()
                return dict(row) if row else None

        except Exception as e:
            logger.error(f"Error getting active configuration: {e}")
            return None

    async def get_all_active_configurations(self) -> List[Dict]:
        """
        NEW: every user's active profile, one row per user.
        Used by the data collector to check each reading against each user.
        Templates (user_id IS NULL) are never included.
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                cursor = await db.execute(
                    """
                    SELECT * FROM threshold_configurations
                    WHERE user_id IS NOT NULL AND is_active = 1
                """
                )
                return [dict(row) for row in await cursor.fetchall()]

        except Exception as e:
            logger.error(f"Error getting active configurations: {e}")
            return []

    async def create_configuration(self, config_data: Dict[str, Any], user_id: int) -> int:
        """
        Create new threshold configuration for this user

        Args:
            config_data: Configuration data
            user_id: Owner of the new profile

        Returns:
            ID of created configuration
        Raises:
            aiosqlite.IntegrityError if the user already has a profile with this name
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute(
                    """
                    INSERT INTO threshold_configurations
                    (user_id, name, description, ph_min, ph_max, temp_min, temp_max,
                        humidity_min, humidity_max,
                        pressure_min, pressure_max, aqi_min, aqi_max)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        user_id,
                        config_data["name"],
                        config_data.get("description"),
                        config_data["ph_min"],
                        config_data["ph_max"],
                        config_data["temp_min"],
                        config_data["temp_max"],
                        config_data["humidity_min"],
                        config_data["humidity_max"],

                        # BME680 thresholds (models.py supplies defaults if omitted)
                        config_data["pressure_min"],
                        config_data["pressure_max"],
                        config_data["aqi_min"],
                        config_data["aqi_max"],
                    ),
                )
                await db.commit()

                config_id = cursor.lastrowid
                logger.info(
                    f"Created configuration: {config_data['name']} "
                    f"(ID: {config_id}, user: {user_id})"
                )
                return config_id

        except Exception as e:
            logger.error(f"Error creating configuration: {e}")
            raise

    async def update_configuration(
        self, config_id: int, config_data: Dict[str, Any], user_id: int
    ) -> bool:
        """
        Update one of this user's threshold configurations

        Args:
            config_id: ID of configuration to update
            config_data: Fields to update
            user_id: Owner (rows of other users are never touched)

        Returns:
            True if a row was updated
        Raises:
            aiosqlite.IntegrityError on a duplicate name
        """
        # Build dynamic UPDATE query based on provided fields.
        # Column names come from the Pydantic update model, never from raw input;
        # ownership and activation can't be changed through this method.
        fields = []
        values = []

        for key, value in config_data.items():
            if key not in ("id", "user_id", "is_active") and value is not None:
                fields.append(f"{key} = ?")
                values.append(value)

        if not fields:
            return False

        fields.append("updated_at = CURRENT_TIMESTAMP")
        values.extend([config_id, user_id])

        query = f"""
            UPDATE threshold_configurations
            SET {', '.join(fields)}
            WHERE id = ? AND user_id = ?
        """

        try:
            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute(query, values)
                await db.commit()

            logger.info(f"Updated configuration ID: {config_id}")
            return cursor.rowcount > 0

        except aiosqlite.IntegrityError:
            raise  # duplicate name: let the route return 409
        except Exception as e:
            logger.error(f"Error updating configuration: {e}")
            return False

    async def set_active_configuration(self, config_id: int, user_id: int) -> bool:
        """
        Make one of this user's profiles active (deactivates their others only)

        Returns:
            True if successful, False if the profile isn't this user's
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                # CHANGED: check ownership first, so a wrong id can't leave the
                # user with no active profile
                cursor = await db.execute(
                    "SELECT 1 FROM threshold_configurations WHERE id = ? AND user_id = ?",
                    (config_id, user_id),
                )
                if not await cursor.fetchone():
                    logger.warning(f"Configuration ID {config_id} not found for user {user_id}")
                    return False

                # Deactivate this user's profiles (CHANGED: was every row)
                await db.execute(
                    "UPDATE threshold_configurations SET is_active = 0 WHERE user_id = ?",
                    (user_id,),
                )

                # Activate specified one
                await db.execute(
                    """
                    UPDATE threshold_configurations
                    SET is_active = 1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND user_id = ?
                """,
                    (config_id, user_id),
                )

                await db.commit()
                logger.info(f"Activated configuration ID: {config_id} (user {user_id})")
                return True

        except Exception as e:
            logger.error(f"Error setting active configuration: {e}")
            return False

    async def delete_configuration(self, config_id: int, user_id: int) -> bool:
        """
        Delete one of this user's threshold configurations (not the active one)

        Returns:
            True if successful
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                # Check if it's the active one
                cursor = await db.execute(
                    """
                    SELECT is_active FROM threshold_configurations
                    WHERE id = ? AND user_id = ?
                """,
                    (config_id, user_id),
                )
                row = await cursor.fetchone()

                if row and row[0] == 1:
                    logger.warning("Cannot delete active configuration")
                    return False

                # Delete it
                cursor = await db.execute(
                    """
                    DELETE FROM threshold_configurations
                    WHERE id = ? AND user_id = ?
                """,
                    (config_id, user_id),
                )
                await db.commit()

                if cursor.rowcount > 0:
                    logger.info(f"Deleted configuration ID: {config_id}")
                    return True
                return False

        except Exception as e:
            logger.error(f"Error deleting configuration: {e}")
            return False

    # ALERTS 
    # CHANGED (login): each alert belongs to the user whose profile triggered it

    async def create_alert(self, alert_data: Dict[str, Any]) -> int:
        """
        Create new alert

        Args:
            alert_data: Alert data, including user_id

        Returns:
            ID of created alert
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute(
                    """
                    INSERT INTO alerts
                    (user_id, alert_type, sensor_type, message, severity,
                        reading_value, threshold_min, threshold_max)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        alert_data.get("user_id"),
                        alert_data["alert_type"],
                        alert_data.get("sensor_type"),
                        alert_data["message"],
                        alert_data.get("severity", "warning"),
                        alert_data.get("reading_value"),
                        alert_data.get("threshold_min"),
                        alert_data.get("threshold_max"),
                    ),
                )
                await db.commit()
                return cursor.lastrowid

        except Exception as e:
            logger.error(f"Error creating alert: {e}")
            raise

    async def get_alerts(
        self,
        user_id: int,
        unread_only: bool = False,
        limit: int = 50,
        severity: Optional[str] = None,
    ) -> List[Dict]:
        """
        Get one user's alerts, newest first

        Args:
            user_id: Whose alerts
            unread_only: Only return unread alerts
            limit: Maximum number of alerts
            severity: normal | warning | danger (NEW: filtered in SQL, so the
                limit applies to matching alerts only)

        Returns:
            List of alerts
        """
        query = "SELECT * FROM alerts WHERE user_id = ?"
        params: List[Any] = [user_id]
        if unread_only:
            query += " AND is_read = 0"
        if severity:
            query += " AND severity = ?"
            params.append(severity)
        query += " ORDER BY created_at DESC, id DESC LIMIT ?"
        params.append(limit)

        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                cursor = await db.execute(query, params)
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

        except Exception as e:
            logger.error(f"Error getting alerts: {e}")
            return []

    async def mark_alert_read(self, alert_id: int, user_id: int) -> bool:
        """Mark one of this user's alerts as read (False if not found/not theirs)"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute(
                    """
                    UPDATE alerts
                    SET is_read = 1
                    WHERE id = ? AND user_id = ?
                """,
                    (alert_id, user_id),
                )
                await db.commit()
                # CHANGED: used to return True even when nothing matched
                return cursor.rowcount > 0

        except Exception as e:
            logger.error(f"Error marking alert as read: {e}")
            return False