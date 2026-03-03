# Snake

A web-based Snake game with three difficulty levels and a persistent leaderboard, served from a containerised Node.js backend.

## Features

- Three difficulty levels — Easy, Medium, Hard
- Keyboard arrow keys and on-screen D-pad (touch-friendly)
- Per-difficulty leaderboard — top 10 scores, all entries shown
- Dark mode — follows system preference, with a manual toggle

## Running locally

### With Docker Compose (recommended)

```bash
docker compose up --build
```

Then open <http://localhost:3002>.

The SQLite database is stored in the `snake-data` named volume and survives container restarts.

## Container image

The image is published to the GitHub Container Registry on every push to `main`:

```bash
docker pull ghcr.io/JakePeralta7/snake:latest
docker run -p 3002:3000 -v snake-data:/data ghcr.io/JakePeralta7/snake:latest
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/session` | Start a new game session. Body: `{ difficulty: "easy" \| "medium" \| "hard" }` |
| `GET` | `/api/session/:id` | Verify a session exists. |
| `DELETE` | `/api/session/:id` | Discard a session. |
| `GET` | `/api/leaderboard?difficulty=` | Top 10 scores for a difficulty. |
| `POST` | `/api/leaderboard` | Submit a score. Body: `{ player_name, score, difficulty, session_id }` |

## Project structure

```
.
├── backend/
│   ├── db.js          # SQLite schema, sessions & scores
│   ├── server.js      # Express app & API routes
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── style.css      # CSS custom properties + dark mode
│   └── game.js        # Game loop, rendering, leaderboard UI
├── docker-compose.yml
└── Dockerfile
```
