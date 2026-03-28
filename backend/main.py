import asyncio
import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from backend.ws_manager import manager
from backend.pubsub import pubsub_service
from backend.config import settings

app = FastAPI(title="EchoAd API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger(__name__)
background_tasks = set()

@app.on_event("startup")
async def startup_event():
    task = asyncio.create_task(listen_to_predictions())
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)

async def listen_to_predictions():
    logger.info(f"Listening to predictions on topic {settings.TOPIC_PREDICTIONS}...")
    try:
        async for message in pubsub_service.subscribe(settings.TOPIC_PREDICTIONS):
            await manager.broadcast(json.dumps(message))
    except Exception as e:
        logger.error(f"Error in prediction listener: {e}")

@app.websocket("/ws/feed")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
