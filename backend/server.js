'use strict';

const path = require('path');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { createSession, getSession, deleteSession, saveScore, getLeaderboard } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const DIFFICULTIES = ['easy', 'medium', 'hard'];

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateDifficulty(res, difficulty) {
  if (!DIFFICULTIES.includes(difficulty)) {
    res.status(400).json({ error: `difficulty must be one of: ${DIFFICULTIES.join(', ')}` });
    return false;
  }
  return true;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/session — start a new game session
app.post('/api/session', (req, res) => {
  const difficulty = (req.body.difficulty || 'medium').toLowerCase();
  if (!validateDifficulty(res, difficulty)) return;

  const session_id = uuidv4();
  createSession(session_id, difficulty);

  res.json({ session_id, difficulty });
});

// GET /api/session/:id — verify a session exists
app.get('/api/session/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired.' });
  }
  res.json({
    session_id: session.session_id,
    difficulty: session.difficulty,
    started_at: session.started_at,
  });
});

// DELETE /api/session/:id — discard a session (e.g. player quit without saving score)
app.delete('/api/session/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  deleteSession(req.params.id);
  res.status(204).end();
});

// GET /api/leaderboard?difficulty= — top 10 scores for a difficulty
app.get('/api/leaderboard', (req, res) => {
  const difficulty = (req.query.difficulty || 'medium').toLowerCase();
  if (!validateDifficulty(res, difficulty)) return;

  const scores = getLeaderboard(difficulty);
  res.json({ difficulty, scores });
});

// POST /api/leaderboard — submit a score
app.post('/api/leaderboard', (req, res) => {
  const { player_name, score, difficulty, session_id } = req.body;

  if (!player_name || typeof player_name !== 'string' || !player_name.trim()) {
    return res.status(400).json({ error: 'player_name is required.' });
  }
  if (!Number.isInteger(score) || score < 0) {
    return res.status(400).json({ error: 'score must be a non-negative integer.' });
  }
  if (!validateDifficulty(res, (difficulty || '').toLowerCase())) return;

  // Verify session exists before accepting the score (anti-cheat)
  const session = getSession(session_id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired.' });
  }
  if (session.difficulty !== difficulty.toLowerCase()) {
    return res.status(400).json({ error: 'Difficulty mismatch with session.' });
  }

  saveScore(player_name.trim().slice(0, 32), score, difficulty.toLowerCase());
  deleteSession(session_id);

  res.status(201).json({ message: 'Score saved.' });
});

// ─── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Snake server running on http://localhost:${PORT}`);
});
