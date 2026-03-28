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
6. [Observability & Logging](#observability--logging)
7. [Component Breakdown](#component-breakdown)
8. [Getting Started](#getting-started)
9. [Running the Project](#running-the-project)
10. [Accessing the Services](#accessing-the-services)
11. [Environment Variables](#environment-variables)
12. [Dashboard Features](#dashboard-features)

---

## Overview

**EchoAd** simulates a live digital advertising auction pipeline. At any given moment, ad requests are being generated, scored by an ML model, and streamed in real-time to an analyst dashboard.

The key engineering challenge this project solves is: _"How do you get an ML prediction in front of a user in under a second, at scale, resiliently?"_

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

| Layer              | Technology                         | Purpose                            |
| ------------------ | ---------------------------------- | ---------------------------------- |
| **Frontend**       | React 19 + Vite 6 (Node 20)        | Real-time dashboard UI             |
| **Backend**        | FastAPI (Python 3.11)              | WebSocket server, Kafka subscriber |
| **Streaming**      | Apache Kafka + Zookeeper           | Durable, scalable event backbone   |
| **ML**             | Scikit-Learn (Logistic Regression) | CTR prediction model               |
| **Infrastructure** | Docker + Docker Compose            | Full-stack orchestration           |
| **Monitoring**     | Kafka UI                           | Inspect topics and offsets         |

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
│
├── ml/
│   ├── train.py                # Trains uncalibrated variance pipeline → saves .pkl
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
    │   ├── Dashboard.tsx       # Main dashboard layout wrapper
    │   ├── components/         # Atomic UI components (Header, MetricCard, LiveFeedTable, etc.)
    │   ├── hooks/
    │   │   └── useAdFeed.ts    # Custom robust hook for WebSocket lifecycle & state
    │   ├── utils/
    │   │   ├── formatters.ts   # Pure formatting utilities and fallback guards
    │   │   └── logger.ts       # Industrial-grade structured telemetry logger
    │   ├── types/              # Centralized domain models
    │   └── index.css           # Dark-mode dashboard styles
    └── package.json
```

---

## Data Flow (How It Works)

Here is the step-by-step lifecycle of a single ad request through the system:

**Step 1 — Data Synthesis** (`generate_data.py`)

> On first use, run this once to create `ad_logs.csv`. It generates ~1000 synthetic ad impressions.

**Step 2 — Model Training** (`ml/train.py`)

> Reads `ad_logs.csv`, builds a Scikit-Learn pipeline using balanced class weights, trains it, and calibrates the output probabilities to ensure strict mathematical accuracy for production-level inference before saving the artifact to `ml/models/ctr_model.pkl`.

**Step 3 — Producer Publishes** (`streaming/producer.py`)

> Runs in a loop, publishing ad requests to the **Kafka topic `ad_requests`**.

**Step 4 — Consumer Infers** (`streaming/consumer.py`)

> Subscribes to `ad_requests`, executes `ctr_model.predict(req)`, and publishes to **`ad_predictions`**.

**Step 5 — Backend Relays** (`backend/main.py`)

> Subscribes to `ad_predictions` and broadcasts to all WebSocket clients.

**Step 6 — Dashboard Displays** (`frontend/src/Dashboard.tsx`)

> The React dashboard has an open websocket connection. Data is ingested by the completely decoupled `useAdFeed` hook, strictly verified by an anti-corruption layer, and rendered to the screen.

---

## Observability & Logging

A major feature of this project is its **Industrial-Grade Reliability and Error Management**. When dealing with high-throughput streams, debugging shouldn't require stopping the system or digging into a debugger.

### Where do the logs go?

All frontend telemetry is natively piped into your **Browser's Developer Tools Console**.
To view them:

1. Open the Dashboard in your browser (`http://localhost:5173`).
2. Right-click anywhere and select **Inspect** (or press `F12` / `Cmd+Option+J`).
3. Navigate to the **Console** tab.

### How to use the logs

The system uses a custom `StructuredLogger` that strictly adheres to the following grep-able format:
`[YYYY-MM-DD HH:mm:ss.SSS] [CONTEXT_ID] [LEVEL] [Module/Function] - Message - {Context Data}`

- **Context & Session Tracing:** Every time you load the page (and initiate a WebSocket connection), a unique Session ID (`CONTEXT_ID`) is generated. This tag appears in _every_ system log. If a specific user reports a disconnect or data drop, you simply filter the console by their Session ID to seamlessly trace their connection lifecycle from "negotiation" to "close".
- **Self-Explaining Errors:** If the network drops or a malformed JSON payload arrives, the React ecosystem does not intentionally crash under a vague javascript exception. Instead, `SelfExplainingError` objects map exactly to the trace logging constraints. You will literally read a descriptive explanation of `[WHY]` the exception was thrown alongside actionable `[FIX]` instructions telling engineers where to look (e.g., verifying Python schemas).
- **Defensive Guard Clauses (Warnings):** If a single variable natively required by a display component is missing (like `null` IDs or deformed dates), pure formatter functions elegantly execute fallbacks (`#NA` or `--:--:--`) to prevent UI tearing, while invisibly emitting rich `[WARN]` logs indicating precisely what data node triggered the failsafe.

---

## Component Breakdown

### `shared/schemas.py` — The Data Contract

Defines Pydantic models: `AdRequest` and `AdPrediction`.

### `backend/pubsub.py` — The Streaming Abstraction Layer

A `PubSubService` class with interchangeable backends (`kafka`, `redis`, `memory`), configured via `STREAMING_BACKEND`.

### `frontend/src/hooks/useAdFeed.ts` — The Elastic Telemetry Engine

A scalable custom React hook handling reconnect persistence via exponential backoffs, strict structural data ingestion routines, decoupled state aggregations, and high value ad computations across a bounding window.

---

## Getting Started

### Prerequisites

- **Docker Desktop** (with Docker Compose v2)
- **Python 3.11+** (only needed for the training step)

### Step 1 — Generate Training Data

```bash
python generate_data.py
```

### Step 2 — Train the ML Model

```bash
python -m venv .venv
source .venv/bin/activate
pip install scikit-learn pandas numpy

python ml/train.py
```

---

## Running the Project

```bash
docker-compose up --build
```

> **First run**: This pulls Confluent Kafka/Zookeeper images (~600MB each) and builds the local images.

**To rebuild after code changes** (especially ML model `.pkl` updates):

```bash
docker-compose down -v
docker-compose up --build
```

---

## Accessing the Services

| Service          | URL                                                      | Description                     |
| ---------------- | -------------------------------------------------------- | ------------------------------- |
| **Dashboard**    | [http://localhost:5173](http://localhost:5173)           | React live feed UI              |
| **FastAPI Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive API explorer        |
| **Kafka UI**     | [http://localhost:8080](http://localhost:8080)           | Monitor topics, messages        |
| **Kafka Broker** | `localhost:9092`                                         | External port for local tooling |

---

## Environment Variables

Configured in `.env`:

| Variable            | Value         | Description             |
| ------------------- | ------------- | ----------------------- |
| `STREAMING_BACKEND` | `kafka`       | Activates Kafka adapter |
| `KAFKA_BROKER`      | `kafka:29092` | Internal Docker address |

---

## Dashboard Features

- **Live Streaming indicator** — Tracks websocket lifecycle actively.
- **Metric Aggregators** — Accumulates and visually emphasizes process volumes and High Value targets.
- **Live Auction Feed Component** — Top-down history table with bounding capacity to heavily optimize DOM lifecycle repaints.
- **Dynamic Sorting & Filtering** — Locale-comparable sorting mechanisms and multi-dimensional filter dropdowns to interact dynamically with the generated data stream.
