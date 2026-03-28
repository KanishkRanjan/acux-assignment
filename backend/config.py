import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    STREAMING_BACKEND: str = os.getenv("STREAMING_BACKEND", "redis") # 'redis', 'kafka', 'memory'
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379")
    KAFKA_BROKER: str = os.getenv("KAFKA_BROKER", "kafka:9092")
    TOPIC_REQUESTS: str = "ad_requests"
    TOPIC_PREDICTIONS: str = "ad_predictions"

settings = Settings()
