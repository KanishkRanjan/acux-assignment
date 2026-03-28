import pandas as pd
import os
import pickle
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer

def train_model():
    # Model should be trained from root level
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    file_path = os.path.join(base_dir, 'ad_logs.csv')
    
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found. Ensure root data file exists.")
        return

    print("Loading data...")
    df = pd.read_csv(file_path)
    
    categorical_cols = ['site_category', 'device_type', 'user_region', 'ad_position']
    numeric_cols = ['user_age', 'bid_price']

    X = df[categorical_cols + numeric_cols]
    y = df['click']

    print("Building pipeline...")
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numeric_cols),
            ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_cols)
        ])

    pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', LogisticRegression(random_state=42, max_iter=1000, class_weight='balanced'))
    ])

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training model...")
    pipeline.fit(X_train, y_train)

    score = pipeline.score(X_test, y_test)
    print(f"Model trained with Test Accuracy: {score:.4f}")

    models_dir = os.path.join(base_dir, 'ml', 'models')
    os.makedirs(models_dir, exist_ok=True)
    
    model_path = os.path.join(models_dir, 'ctr_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(pipeline, f)
    print(f"Model exported successfully to {model_path}")

if __name__ == "__main__":
    train_model()
