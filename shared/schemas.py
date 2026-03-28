from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class AdRequest(BaseModel):
    ad_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    site_category: str
    device_type: str
    user_region: str
    user_age: int
    bid_price: float
    ad_position: str

class AdPrediction(BaseModel):
    request: AdRequest
    ctr_probability: float
    status: str = "success"
    error: Optional[str] = None
