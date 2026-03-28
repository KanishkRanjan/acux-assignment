"""
CTR Model Inference
===================
Loads the trained & calibrated CTR pipeline from disk once (singleton pattern)
and exposes a single predict() method used by the Kafka consumer service.

The loaded model is a CalibratedClassifierCV wrapping the best candidate 
selected during training. predict_proba outputs are well-calibrated
probabilities in [0, 1].
"""

import os
import pickle
import logging
import pandas as pd
from shared.schemas import AdRequest

logger = logging.getLogger(__name__)


class CTRModel:
    def __init__(self):
        self.model = None
        self._load_model()

    def _load_model(self):
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        model_path = os.path.join(base_dir, 'ml', 'models', 'ctr_model.pkl')
        if os.path.exists(model_path):
            with open(model_path, 'rb') as f:
                self.model = pickle.load(f)
            logger.info("CTR model loaded successfully.")
        else:
            logger.warning(f"Model not found at {model_path}. Will return default probability 0.5.")

    def _build_features(self, req: AdRequest) -> pd.DataFrame:
        """Build the feature row that matches the training schema exactly."""
        return pd.DataFrame([{
            'site_category': req.site_category,
            'device_type':   req.device_type,
            'user_region':   req.user_region,
            'ad_position':   req.ad_position,
            'user_age':      req.user_age,
            'bid_price':     req.bid_price,
            # Derived feature: hour-of-day (must match engineer_features in train.py)
            'hour_of_day':   req.timestamp.hour,
        }])

    def predict(self, req: AdRequest) -> float:
        """Return calibrated click-through probability in [0, 1]."""
        if self.model is None:
            return 0.5

        df = self._build_features(req)
        prob = self.model.predict_proba(df)[0][1]  # P(click=1)
        return float(prob)


# Module-level singleton — loaded once per container lifetime
ctr_model = CTRModel()
