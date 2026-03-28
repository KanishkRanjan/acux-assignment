import os
import pickle
import pandas as pd
from shared.schemas import AdRequest

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
            print("Successfully loaded CTR model.")
        else:
            print(f"Warning: Model not found at {model_path}. Yielding default probability.")

    def predict(self, req: AdRequest) -> float:
        if not self.model:
            return 0.5
        
        # Scikit pipeline requires a dataframe for feature transformations
        df = pd.DataFrame([{
            'site_category': req.site_category,
            'device_type': req.device_type,
            'user_region': req.user_region,
            'user_age': req.user_age,
            'bid_price': req.bid_price,
            'ad_position': req.ad_position
        }])
        
        prob = self.model.predict_proba(df)[0][1] # Probability of positive class (click=1)
        return float(prob)

# Singleton so consumer service re-uses loaded model
ctr_model = CTRModel()
