import asyncio
import random
import logging
from datetime import datetime
from shared.schemas import AdRequest
from backend.pubsub import pubsub_service
from backend.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("producer")

categories = ['news', 'gaming', 'finance', 'social', 'travel']
devices = ['mobile', 'desktop']
regions = ['north', 'south', 'east', 'west']
positions = ['top', 'sidebar', 'feed']

async def produce_events():
    logger.info(f"Starting generic producer (Backend: {settings.STREAMING_BACKEND})...")
    
    # Wait for everything to spin up
    await asyncio.sleep(5)
    
    while True:
        req = AdRequest(
            ad_id=hex(random.getrandbits(24))[2:],
            timestamp=datetime.utcnow(),
            site_category=random.choice(categories),
            device_type=random.choice(devices),
            user_region=random.choice(regions),
            user_age=random.randint(18, 65),
            bid_price=round(random.uniform(0.1, 2.0), 2),
            ad_position=random.choice(positions)
        )
        
        logger.info(f"Producing AdRequest: {req.ad_id} | Cat: {req.site_category}")
        
        # Must model_dump(mode='json') to serialize datetime correctly
        await pubsub_service.publish(settings.TOPIC_REQUESTS, req.model_dump(mode='json'))
        
        # Emit an event every 2 seconds
        await asyncio.sleep(2)

if __name__ == "__main__":
    asyncio.run(produce_events())
