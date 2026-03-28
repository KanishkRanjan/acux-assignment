import asyncio
import json
import logging
from backend.config import settings
import redis.asyncio as redis

logger = logging.getLogger(__name__)

_memory_queues = {}

class PubSubService:
    def __init__(self):
        self.backend = settings.STREAMING_BACKEND
        self.redis_client = None
        self.kafka_producer = None
        
        if self.backend == "redis":
            self.redis_client = redis.from_url(settings.REDIS_URL)

    async def _get_kafka_producer(self):
        if not self.kafka_producer:
            from aiokafka import AIOKafkaProducer
            # Optional small delay to wait for Kafka to fully boot in Docker
            await asyncio.sleep(5)
            self.kafka_producer = AIOKafkaProducer(bootstrap_servers=settings.KAFKA_BROKER)
            await self.kafka_producer.start()
        return self.kafka_producer

    async def publish(self, topic: str, message: dict):
        if self.backend == "redis":
            await self.redis_client.publish(topic, json.dumps(message))
        elif self.backend == "kafka":
            try:
                producer = await self._get_kafka_producer()
                await producer.send_and_wait(topic, json.dumps(message).encode('utf-8'))
            except Exception as e:
                logger.error(f"Kafka publish error: {e}")
        else:
            if topic not in _memory_queues:
                _memory_queues[topic] = asyncio.Queue()
            await _memory_queues[topic].put(message)

    async def subscribe(self, topic: str):
        if self.backend == "redis":
            pubsub = self.redis_client.pubsub()
            await pubsub.subscribe(topic)
            async for message in pubsub.listen():
                if message['type'] == 'message':
                    yield json.loads(message['data'])
        elif self.backend == "kafka":
            from aiokafka import AIOKafkaConsumer
            # Setup consumer with retry loop for initial connection
            connected = False
            while not connected:
                try:
                    consumer = AIOKafkaConsumer(
                        topic,
                        bootstrap_servers=settings.KAFKA_BROKER,
                        group_id="echo-ad-group",
                        auto_offset_reset="latest"
                    )
                    await consumer.start()
                    connected = True
                except Exception as e:
                    logger.warning(f"Waiting for Kafka to be ready... {e}")
                    await asyncio.sleep(5)
                    
            try:
                async for msg in consumer:
                    yield json.loads(msg.value.decode('utf-8'))
            finally:
                await consumer.stop()
        else:
            if topic not in _memory_queues:
                _memory_queues[topic] = asyncio.Queue()
            while True:
                msg = await _memory_queues[topic].get()
                yield msg

pubsub_service = PubSubService()
