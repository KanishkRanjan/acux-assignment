# EchoAd Real-Time Prediction Engine

> A production-quality, end-to-end Dockerized system for real-time ad Click-Through Rate (CTR) prediction.
> Built as a technical assessment demonstrating streaming architecture, machine learning inference, and full-stack web development skills.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Data Flow (How It Works)](#data-flow-how-it-works)
6. [Component Breakdown](#component-breakdown)
7. [Getting Started](#getting-started)
8. [Running the Project](#running-the-project)
9. [Accessing the Services](#accessing-the-services)
10. [Environment Variables](#environment-variables)
11. [Dashboard Features](#dashboard-features)

---

## Overview

**EchoAd** simulates a live digital advertising auction pipeline. At any given moment, ad requests are being generated, scored by an ML model, and streamed in real-time to an analyst dashboard.

The key engineering challenge this project solves is: *"How do you get an ML prediction in front of a user in under a second, at scale, resiliently?"*

The answer is: **Apache Kafka for streaming** + **FastAPI WebSockets for push delivery** + **React for live UI rendering**.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Docker Network                            │
│                                                                  │
│  ┌─────────────┐    Kafka Topic      ┌──────────────────────┐   │
│  │  Producer   │ ─── ad_requests ──► │  Consumer (ML Infer) │   │
│  │  (Python)   │                     │      (Python)        │   │
│  └─────────────┘                     └──────────┬───────────┘   │
│                                                 │               │
│                                    Kafka Topic  │               │
│                                    ad_predictions               │
│                                                 │               │
│  ┌─────────────┐   WebSocket Push  ┌────────────▼───────────┐   │
│  │  React UI   │ ◄──────────────── │  FastAPI Backend       │   │
│  │  Dashboard  │                   │  (Kafka Subscriber)    │   │
│  └─────────────┘                   └────────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │  Zookeeper   │  │    Kafka     │  │      Kafka UI        │   │
│  │   :2181      │  │  :9092/29092 │  │       :8080          │   │
│  └──────────────┘  └──────────────┘  └─────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19 + Vite 6 (Node 20) | Real-time dashboard UI |
| **Backend** | FastAPI (Python 3.11) | WebSocket server, Kafka subscriber |
| **Streaming** | Apache Kafka + Zookeeper | Durable, scalable event backbone |
| **ML** | Scikit-Learn (Logistic Regression) | CTR prediction model |
| **Infrastructure** | Docker + Docker Compose | Full-stack orchestration |
| **Monitoring** | Kafka UI | Inspect topics and offsets |

---

## Project Structure

```
Assignment/
│
├── .env                        # Active environment variables (Kafka config)
├── Dockerfile                  # Shared base image for Python services
├── docker-compose.yml          # Orchestrates all 7 containers
├── requirements.txt            # Python dependencies (all services)
│
├── generate_data.py            # Script to generate training data (ad_logs.csv)
├── ad_logs.csv                 # ~1000 rows of synthetic ad click log data
│
├── shared/
│   └── schemas.py              # Pydantic models: AdRequest, AdPrediction
│                               #   → shared by producer, consumer & backend
│
├── ml/
│   ├── train.py                # Trains Logistic Regression pipeline → saves .pkl
│   ├── inference.py            # Loads model, exposes CTRModel.predict()
│   └── models/
│       └── ctr_model.pkl       # Serialized scikit-learn pipeline artifact
│
├── backend/
│   ├── config.py               # Pydantic settings (env var parsing)
│   ├── pubsub.py               # Kafka/Redis/Memory abstraction layer
│   ├── ws_manager.py           # WebSocket connection manager (broadcast hub)
│   └── main.py                 # FastAPI app: WebSocket endpoint + Kafka listener
│
├── streaming/
│   ├── producer.py             # Generates mock AdRequests → publishes to Kafka
│   └── consumer.py             # Reads from Kafka → runs ML inference → publishes predictions
│
└── frontend/
    ├── Dockerfile              # Node 20-slim image for Vite
    ├── src/
    │   ├── App.tsx             # Root React component
    │   ├── Dashboard.tsx       # Main dashboard (WebSocket, table, filters)
    │   └── index.css           # Dark-mode dashboard styles
    └── package.json
```

---

## Data Flow (How It Works)

Here is the step-by-step lifecycle of a single ad request through the system:

**Step 1 — Data Synthesis** (`generate_data.py`)
> On first use, run this once to create `ad_logs.csv`. It generates ~1000 synthetic ad impressions with features like `site_category`, `device_type`, `user_age`, `bid_price`, and a probabilistically-determined `clicked` label.

**Step 2 — Model Training** (`ml/train.py`)
> Reads `ad_logs.csv`, builds a Scikit-Learn pipeline (OneHotEncoder → StandardScaler → LogisticRegression), trains it, and saves the artifact to `ml/models/ctr_model.pkl`.

**Step 3 — Producer Publishes** (`streaming/producer.py`)
> Runs in a loop, generating a randomized `AdRequest` every 2 seconds and publishing it as a JSON message to the **Kafka topic `ad_requests`**.

**Step 4 — Consumer Infers** (`streaming/consumer.py`)
> Subscribes to `ad_requests` via Kafka. For each message, it:
> 1. Deserializes the JSON into an `AdRequest` Pydantic model
> 2. Calls `ctr_model.predict(req)` which runs the scikit-learn pipeline
> 3. Wraps the result in an `AdPrediction` model
> 4. Publishes the prediction to the **Kafka topic `ad_predictions`**

**Step 5 — Backend Relays** (`backend/main.py`)
> On startup, the FastAPI backend subscribes to `ad_predictions` via Kafka. Every incoming prediction is immediately broadcast to all connected WebSocket clients.

**Step 6 — Dashboard Displays** (`frontend/src/Dashboard.tsx`)
> The React dashboard has an open WebSocket connection to `ws://localhost:8000/ws/feed`. Every prediction arrives as a JSON push event and is prepended to the live feed table in under a second.

---

## Component Breakdown

### `shared/schemas.py` — The Data Contract
Defines the two core Pydantic models shared across all services:
- `AdRequest` — the raw ad auction event (id, timestamp, category, device, region, age, bid price, position)
- `AdPrediction` — wraps `AdRequest` with the model's `ctr_probability`, a `status`, and optional `error`

### `backend/pubsub.py` — The Streaming Abstraction Layer
A single `PubSubService` class with `publish()` and `subscribe()` methods that support three backends:
- **`kafka`** (active default): Uses `aiokafka` with an automatic retry loop on startup
- **`redis`**: Uses `redis.asyncio` pub/sub
- **`memory`**: Uses `asyncio.Queue` for pure in-process testing

The backend is chosen via the `STREAMING_BACKEND` environment variable, making it trivial to swap without changing business logic.

### `backend/ws_manager.py` — The WebSocket Hub
A `ConnectionManager` class maintains a list of active WebSocket connections. The `broadcast()` method fans out a message to every connected client simultaneously.

### `ml/inference.py` — The Model Singleton
Loads `ctr_model.pkl` once at startup and caches it. The `CTRModel.predict()` method accepts an `AdRequest`, builds a feature DataFrame, and returns a probability float. The singleton pattern ensures the model file is only read from disk once per container lifetime.

---

## Getting Started

### Prerequisites
Ensure the following are installed and running on your machine:

- **Docker Desktop** (with Docker Compose v2) — [Download here](https://www.docker.com/products/docker-desktop/)
- **Python 3.11+** (only needed for the one-time training step)
- A package manager with `pip` or a virtual environment

Verify Docker is running:
```bash
docker --version
docker compose version
```

### Step 1 — Generate Training Data

This creates the synthetic `ad_logs.csv` dataset used to train the model.

```bash
# From the project root
python generate_data.py
```

You should see `ad_logs.csv` appear in the root directory (~1000 rows).

### Step 2 — Train the ML Model

This trains the Logistic Regression pipeline and saves it to `ml/models/ctr_model.pkl`.

```bash
# Install dependencies in a local venv first (optional but recommended)
python -m venv .venv
source .venv/bin/activate

pip install scikit-learn pandas numpy

# Train and save the model
python ml/train.py
```

You should see `ml/models/ctr_model.pkl` created. The `.pkl` file is mounted into the Docker containers at runtime via a volume, so **you only train once** — no rebuilds needed after retraining.

---

## Running the Project

With the model trained, bring up the entire stack with a single command:

```bash
docker-compose up --build
```

> **First run**: This will pull the Confluent Kafka/Zookeeper images (~600MB each) and build the Python/Node images. Allow 3–5 minutes on a fresh machine.

> **Subsequent runs**: Images are cached. Startup takes ~30 seconds for Kafka to elect a leader and for all services to connect.

**To tear down completely** (removes containers, networks, and volumes):
```bash
docker-compose down -v
```

**To rebuild after code changes** (without cache):
```bash
docker-compose down -v
docker-compose build --no-cache && docker-compose up
```

---

## Accessing the Services

Once `docker-compose up` is running and all containers are healthy:

| Service | URL | Description |
|---|---|---|
| **Dashboard** | [http://localhost:5173](http://localhost:5173) | React live feed UI |
| **FastAPI Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive API explorer |
| **Kafka UI** | [http://localhost:8080](http://localhost:8080) | Monitor topics, messages, consumer groups |
| **Kafka Broker** | `localhost:9092` | External port for local Kafka tooling |

> **Tip**: Open Kafka UI and navigate to **Topics → ad_requests** to watch raw messages flow in. Switch to **ad_predictions** to see the ML output before it hits the dashboard.

---

## Environment Variables

Configured in `.env` (read by all Python services via `docker-compose.yml`):

| Variable | Value | Description |
|---|---|---|
| `STREAMING_BACKEND` | `kafka` | Activates the Kafka pub/sub adapter in `pubsub.py` |
| `KAFKA_BROKER` | `kafka:29092` | Internal Docker network address of the Kafka broker |

> `29092` is the internal listener used for container-to-container communication. `9092` is the external listener exposed to the host machine.

---

## Dashboard Features

The React dashboard at `localhost:5173` provides:

- **🟢 Live Streaming indicator** — turns red if the WebSocket connection drops
- **Total Ads Processed counter** — session-wide total, increments in real-time
- **High Value Ads counter** — tracks predictions with CTR > 0.70 (shown in green)
- **Live Auction Feed table** — last 50 predictions, newest at the top, with:
  - Color-coded rows: green tint for High Value (>0.70), red tint for Low Value (<0.30)
  - Prediction score dot: 🟢 green / 🔴 red / ⚪ neutral
  - **Filter dropdowns**: Filter by Category (Finance, Travel, Gaming, etc.) or Device (Mobile/Desktop)
  - **Sortable columns**: Click any column header to sort ascending/descending (↑/↓ indicator)
  - **Scrollable table**: Fixed height with sticky headers — scroll to see history while new rows arrive at the top
