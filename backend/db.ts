'use strict';

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join('/data', 'snake.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initialise();
    scheduleCleanup();
  }
  return db;
}

function initialise() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id  TEXT    PRIMARY KEY,
      difficulty  TEXT    NOT NULL,
      started_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scores (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      player_name TEXT    NOT NULL,
      score       INTEGER NOT NULL,
      difficulty  TEXT    NOT NULL,
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scores_difficulty_score
      ON scores (difficulty, score DESC);
  `);
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

function createSession(session_id, difficulty) {
  getDb().prepare(`
    INSERT INTO sessions (session_id, difficulty, started_at)
    VALUES (?, ?, ?)
  `).run(session_id, difficulty, Date.now());
}

function getSession(session_id) {
  const row = getDb().prepare(`
    SELECT * FROM sessions WHERE session_id = ?
  `).get(session_id);
  if (!row) return null;
  return {
    session_id: row.session_id,
    difficulty: row.difficulty,
    started_at: row.started_at,
  };
}

function deleteSession(session_id) {
  getDb().prepare(`DELETE FROM sessions WHERE session_id = ?`).run(session_id);
}

function purgeExpiredSessions() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const result = getDb().prepare(`DELETE FROM sessions WHERE started_at < ?`).run(cutoff);
  if (result.changes > 0) {
    console.log(`[cleanup] Purged ${result.changes} expired session(s).`);
  }
}

function scheduleCleanup() {
  purgeExpiredSessions();
  setInterval(purgeExpiredSessions, 60 * 60 * 1000);
}

// ─── Scores ───────────────────────────────────────────────────────────────────

function saveScore(player_name, score, difficulty) {
  getDb().prepare(`
    INSERT INTO scores (player_name, score, difficulty, created_at)
    VALUES (?, ?, ?, ?)
  `).run(player_name, score, difficulty, Date.now());
}

function getLeaderboard(difficulty) {
  return getDb().prepare(`
    SELECT player_name, score, created_at
    FROM scores
    WHERE difficulty = ?
    ORDER BY score DESC
    LIMIT 10
  `).all(difficulty);
}

module.exports = { createSession, getSession, deleteSession, saveScore, getLeaderboard };
