import asyncio
import logging
from shared.schemas import AdRequest, AdPrediction
from backend.pubsub import pubsub_service
from backend.config import settings
from ml.inference import ctr_model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("consumer")

async def consume_events():
    logger.info(f"Starting consumer (Backend: {settings.STREAMING_BACKEND})...")
    async for msg_dict in pubsub_service.subscribe(settings.TOPIC_REQUESTS):
        ad_id = msg_dict.get('ad_id')
        logger.info(f"Consumed request: {ad_id}")
        
        try:
            req = AdRequest(**msg_dict)
            # Offload CPU-bound ML inference (Pandas/Scikit) to a thread to prevent blocking the async loop
            ctr = await asyncio.to_thread(ctr_model.predict, req)
            prediction = AdPrediction(
                request=req,
                ctr_probability=ctr,
                status="success"
            )
        except Exception as e:
            logger.error(f"Prediction Error on {ad_id}: {e}")
            prediction = AdPrediction(
                request=AdRequest(**msg_dict) if ad_id else msg_dict,
                ctr_probability=0.0,
                status="error",
                error=str(e)
            )

        logger.info(f"Publishing prediction: {ad_id} | CTR: {prediction.ctr_probability:.2f}")
        await pubsub_service.publish(settings.TOPIC_PREDICTIONS, prediction.model_dump(mode='json'))

if __name__ == "__main__":
    asyncio.run(consume_events())
