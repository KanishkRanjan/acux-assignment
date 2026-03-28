"""
CTR Model Training Script
=========================
Trains multiple classifier candidates on ad_logs.csv, evaluates them with
cross-validated AUC-ROC, and saves the best-performing pipeline to
ml/models/ctr_model.pkl for use by the inference service.

Models compared:
  - Logistic Regression (baseline)
  - Random Forest
  - Gradient Boosting (GBM)

Feature engineering:
  - hour_of_day extracted from timestamp (ads clicked more at certain hours)
  - All categorical features one-hot encoded
  - All numeric features standard-scaled

Selection criterion: mean cross-validated ROC-AUC (more meaningful than
raw accuracy on an imbalanced click dataset).
"""

import os
import pickle
import logging
import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    roc_auc_score, accuracy_score,
    classification_report, confusion_matrix
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Feature Engineering
# ─────────────────────────────────────────────

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add derived features from existing columns."""
    out = df.copy()
    # Extract hour-of-day from timestamp — clicking behaviour is time-dependent
    out['hour_of_day'] = pd.to_datetime(out['timestamp']).dt.hour
    return out


# ─────────────────────────────────────────────
# Build Pre-processor
# ─────────────────────────────────────────────

def build_preprocessor(categorical_cols: list, numeric_cols: list) -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numeric_cols),
            ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical_cols),
        ],
        remainder='drop'
    )


# ─────────────────────────────────────────────
# Candidate Models
# ─────────────────────────────────────────────

def build_candidates(preprocessor: ColumnTransformer) -> dict:
    """Return a dict of named Pipeline candidates to evaluate."""
    return {
        "LogisticRegression": Pipeline([
            ('preprocessor', preprocessor),
            ('classifier', LogisticRegression(
                random_state=42, max_iter=2000,
                class_weight='balanced', C=0.5
            ))
        ]),
        "RandomForest": Pipeline([
            ('preprocessor', preprocessor),
            ('classifier', RandomForestClassifier(
                n_estimators=200, max_depth=8,
                min_samples_leaf=5, class_weight='balanced',
                random_state=42, n_jobs=-1
            ))
        ]),
        "GradientBoosting": Pipeline([
            ('preprocessor', preprocessor),
            ('classifier', GradientBoostingClassifier(
                n_estimators=150, learning_rate=0.08,
                max_depth=4, subsample=0.8,
                random_state=42
            ))
        ]),
    }


# ─────────────────────────────────────────────
# Training Entry Point
# ─────────────────────────────────────────────

def train_model():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    file_path = os.path.join(base_dir, 'ad_logs.csv')

    if not os.path.exists(file_path):
        logger.error(f"Data file not found: {file_path}")
        return

    # ── Load & Validate ──────────────────────────────────────
    logger.info("Loading data...")
    df = pd.read_csv(file_path)
    logger.info(f"Dataset shape: {df.shape} | Click rate: {df['click'].mean():.2%}")

    # ── Feature Engineering ──────────────────────────────────
    df = engineer_features(df)

    categorical_cols = ['site_category', 'device_type', 'user_region', 'ad_position']
    numeric_cols = ['user_age', 'bid_price', 'hour_of_day']

    X = df[categorical_cols + numeric_cols]
    y = df['click']

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # ── Evaluate Candidates ──────────────────────────────────
    preprocessor = build_preprocessor(categorical_cols, numeric_cols)
    candidates = build_candidates(preprocessor)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    logger.info("\n── Cross-Validation Results (5-Fold ROC-AUC) ──")
    results = {}
    for name, pipeline in candidates.items():
        scores = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring='roc_auc', n_jobs=-1)
        results[name] = scores.mean()
        logger.info(f"  {name:25s} AUC: {scores.mean():.4f} ± {scores.std():.4f}")

    # ── Select Best ──────────────────────────────────────────
    best_name = max(results, key=results.get)
    logger.info(f"\n✓ Best model: {best_name} (CV AUC: {results[best_name]:.4f})")

    best_pipeline = candidates[best_name]

    # ── Final Fit on Full Training Set ───────────────────────
    logger.info("Training best model on full training set...")
    best_pipeline.fit(X_train, y_train)

    # ── Calibrate probabilities (Platt scaling via isotonic) ─
    # Calibration makes predict_proba outputs better-calibrated
    # We do this after fitting so calibration uses held-out data only
    calibrated = CalibratedClassifierCV(best_pipeline, cv=5, method='isotonic')
    calibrated.fit(X_train, y_train)

    # ── Evaluation Report ─────────────────────────────────────
    y_proba = calibrated.predict_proba(X_test)[:, 1]
    y_pred = (y_proba >= 0.5).astype(int)

    auc = roc_auc_score(y_test, y_proba)
    acc = accuracy_score(y_test, y_pred)

    logger.info("\n── Held-Out Test Set Metrics ──")
    logger.info(f"  ROC-AUC  : {auc:.4f}")
    logger.info(f"  Accuracy : {acc:.4f}")
    logger.info(f"\n{classification_report(y_test, y_pred, target_names=['No Click', 'Click'])}")
    logger.info(f"Confusion Matrix:\n{confusion_matrix(y_test, y_pred)}")

    # ── Save ──────────────────────────────────────────────────
    models_dir = os.path.join(base_dir, 'ml', 'models')
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, 'ctr_model.pkl')

    with open(model_path, 'wb') as f:
        pickle.dump(calibrated, f)

    logger.info(f"\n✓ Calibrated {best_name} pipeline saved to: {model_path}")


if __name__ == "__main__":
    train_model()
