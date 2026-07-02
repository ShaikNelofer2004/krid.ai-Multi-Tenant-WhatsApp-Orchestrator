from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

# Global client and db references
_client: AsyncIOMotorClient = None
_db: AsyncIOMotorDatabase = None


async def connect_db() -> None:
    """Initialize the MongoDB async connection."""
    global _client, _db
    _client = AsyncIOMotorClient(settings.MONGODB_URI)
    _db = _client[settings.MONGODB_DB_NAME]
    # Ping to confirm connection is alive
    await _client.admin.command("ping")
    print(f"✅ Connected to MongoDB: {settings.MONGODB_DB_NAME}")


async def close_db() -> None:
    """Close the MongoDB connection gracefully."""
    global _client
    if _client:
        _client.close()
        print("🔌 MongoDB connection closed.")


def get_db() -> AsyncIOMotorDatabase:
    """Return the active database instance."""
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _db
