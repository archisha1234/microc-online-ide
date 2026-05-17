# MicroC Online IDE

An online IDE for the MicroC language with real-time collaboration, browser-side transpilation, and AI-powered code review.

## Features

- **Browser-side Transpiler** — MicroC → ANSI-C via Rust/WASM (zero latency, no server needed)
- **Collaborative Editor** — Real-time multi-user editing via WebSockets + Yjs CRDT
- **Code Execution** — Docker-sandboxed runners via Kafka async submission queue
- **Judging System** — Test case evaluation with Redis leaderboard
- **Auth + Persistence** — JWT auth, code saving, shareable execution links

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React, Next.js, Monaco Editor |
| Transpiler | Rust, Pest (PEG grammar), WebAssembly |
| Collaboration | Yjs (CRDT), WebSockets |
| Backend | Node.js, Express, REST API |
| Queue | Apache Kafka |
| Execution | Docker sandbox |
| Inter-service | gRPC |
| Cache + Leaderboard | Redis |
| Database | PostgreSQL |
| Orchestration | Kubernetes |
| CI/CD | GitHub Actions |
| Deploy | AWS, Vercel |

## Architecture

```
User (Browser)
      ↓
Next.js Frontend (Vercel)
      ↓
WebSocket Server ──► Collaborative Editor (Yjs CRDT)
      ↓
REST API (Node.js)
      ↓
Rust/WASM Transpiler (runs in browser, zero latency)
      ↓
Kafka (async submission queue)
      ↓
Docker Sandbox (isolated code execution)
      ↓
gRPC Microservices
┌──────────────────────────────┐
│ Editor │ Transpiler │ Judge  │
└──────────────────────────────┘
      ↓
Redis (leaderboard + cache)
PostgreSQL (users, code, history)
```

## Project Structure

```
microc-online-ide/
├── apps/
│   └── web/                # Next.js frontend + Monaco Editor
├── packages/
│   └── transpiler/         # Rust/WASM MicroC → ANSI-C transpiler
├── services/
│   ├── backend/            # Node.js REST API + JWT auth
│   ├── collab/             # WebSocket collaboration server (Yjs)
│   ├── runner/             # Kafka consumer + Docker executor
│   └── judge/              # Test case judging + Redis leaderboard
├── infra/
│   ├── k8s/                # Kubernetes manifests
│   └── docker-compose.yml
├── .github/
│   └── workflows/          # GitHub Actions CI/CD
├── docker-compose.yml
├── LICENSE
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- Rust + wasm-pack
- Docker + Docker Compose

### Run locally

**1. Start infrastructure**
```bash
docker-compose up -d
```

**2. Install dependencies**
```bash
npm install
```

**3. Build WASM transpiler**
```bash
cd packages/transpiler
wasm-pack build --target web
cd ../..
```

**4. Start all services** (each in a separate terminal)

```bash
# Collab server
cd services/collab && npx ts-node --esm server.ts

# Backend API
cd services/backend && npx ts-node src/index.ts

# Kafka runner
cd services/runner && npx ts-node src/consumer.ts

# Judge service
cd services/judge && npx ts-node src/judge.ts

# Frontend
cd apps/web && npm run dev
```

**5. Open browser**
```
http://localhost:3000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/snippets | Get my snippets |
| POST | /api/snippets | Save snippet |
| GET | /api/snippets/:id | Get snippet by ID (shareable) |
| POST | /api/snippets/submit | Submit for execution |

## License

MIT License — see [LICENSE](LICENSE) for details.