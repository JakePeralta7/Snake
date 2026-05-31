'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const GRID_SIZE   = 20;          // cells per side
const CELL_SIZE   = 20;          // px per cell  (400 × 400 canvas)
const TICK_MS     = { easy: 150, medium: 100, hard: 65 };

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  sessionId:   null,
  difficulty:  'medium',
  snake:       [],          // [{x, y}, …]  head first
  direction:   { x: 1, y: 0 },
  nextDir:     { x: 1, y: 0 },
  apple:       null,        // {x, y}
  score:       0,
  running:     false,
  gameOver:    false,
  tickHandle:  null,
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const canvas          = document.getElementById('board');
const ctx             = canvas.getContext('2d');
const scoreEl         = document.getElementById('score');
const overlayEl       = document.getElementById('board-overlay');
const overlayMsgEl    = document.getElementById('overlay-message');
const btnNew          = document.getElementById('btn-new');
const btnOverlayNew   = document.getElementById('btn-overlay-new');
const btnTheme        = document.getElementById('btn-theme');
const btnLeaderboard  = document.getElementById('btn-leaderboard');
const diffBtns        = document.querySelectorAll('.diff-btn');

// D-pad
const btnUp    = document.getElementById('btn-up');
const btnDown  = document.getElementById('btn-down');
const btnLeft  = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');

// Leaderboard modal
const modalLeaderboard   = document.getElementById('modal-leaderboard');
const modalBackdrop      = document.getElementById('modal-backdrop');
const btnModalClose      = document.getElementById('btn-modal-close');
const tabBtns            = document.querySelectorAll('.tab-btn');
const leaderboardContent = document.getElementById('leaderboard-content');

// Score modal
const modalScore      = document.getElementById('modal-score');
const scoreForm       = document.getElementById('score-form');
const playerNameInput = document.getElementById('player-name');
const scoreDisplay    = document.getElementById('score-display');
const btnSkipScore    = document.getElementById('btn-skip-score');

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  btnTheme.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('snake_theme', theme);
  drawBoard(); // repaint with correct colours
}

function initTheme() {
  const saved = localStorage.getItem('snake_theme') || 'auto';
  applyTheme(saved);
}

function cycleTheme() {
  const current = localStorage.getItem('snake_theme') || 'auto';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

btnTheme.addEventListener('click', cycleTheme);

// ── Colour helpers ────────────────────────────────────────────────────────────
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function drawBoard() {
  const bg      = cssVar('--canvas-bg');
  const grid    = cssVar('--canvas-grid');
  const body    = cssVar('--snake-body');
  const head    = cssVar('--snake-head');
  const apple   = cssVar('--apple');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid lines
  ctx.strokeStyle = grid;
  ctx.lineWidth = 0.5;
  for (let i = 1; i < GRID_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL_SIZE, 0);
    ctx.lineTo(i * CELL_SIZE, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * CELL_SIZE);
    ctx.lineTo(canvas.width, i * CELL_SIZE);
    ctx.stroke();
  }

  // Apple
  if (state.apple) {
    const { x, y } = state.apple;
    const cx = x * CELL_SIZE + CELL_SIZE / 2;
    const cy = y * CELL_SIZE + CELL_SIZE / 2;
    const r  = CELL_SIZE / 2 - 2;
    ctx.fillStyle = apple;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Snake
  state.snake.forEach((seg, i) => {
    const r = 3;
    ctx.fillStyle = i === 0 ? head : body;
    ctx.beginPath();
    ctx.roundRect(
      seg.x * CELL_SIZE + 1,
      seg.y * CELL_SIZE + 1,
      CELL_SIZE - 2,
      CELL_SIZE - 2,
      r,
    );
    ctx.fill();
  });
}

// ── Game logic ────────────────────────────────────────────────────────────────
function spawnApple() {
  const occupied = new Set(state.snake.map(s => `${s.x},${s.y}`));
  let pos;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (occupied.has(`${pos.x},${pos.y}`));
  state.apple = pos;
}

function tick() {
  state.direction = state.nextDir;
  const head = state.snake[0];
  const newHead = {
    x: head.x + state.direction.x,
    y: head.y + state.direction.y,
  };

  // Wall collision
  if (
    newHead.x < 0 || newHead.x >= GRID_SIZE ||
    newHead.y < 0 || newHead.y >= GRID_SIZE
  ) {
    endGame();
    return;
  }

  // Self collision
  if (state.snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
    endGame();
    return;
  }

  state.snake.unshift(newHead);

  // Apple collision
  if (newHead.x === state.apple.x && newHead.y === state.apple.y) {
    state.score++;
    scoreEl.textContent = state.score;
    spawnApple();
    // Don't pop — snake grows
  } else {
    state.snake.pop();
  }

  drawBoard();
}

function endGame() {
  clearInterval(state.tickHandle);
  state.tickHandle = null;
  state.running  = false;
  state.gameOver = true;
  drawBoard();
  openScoreModal(state.score);
}

// ── Session management ────────────────────────────────────────────────────────
async function createSession() {
  // Delete old session if any
  if (state.sessionId) {
    fetch(`/api/session/${state.sessionId}`, { method: 'DELETE' }).catch(() => {});
    state.sessionId = null;
  }
  try {
    const res  = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty: state.difficulty }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start session');
    state.sessionId = data.session_id;
  } catch (err) {
    console.warn('Session creation failed:', err.message);
  }
}

// ── New game ──────────────────────────────────────────────────────────────────
async function startNewGame() {
  overlayEl.classList.add('hidden');
  clearInterval(state.tickHandle);

  // Reset state
  const midX = Math.floor(GRID_SIZE / 2);
  const midY = Math.floor(GRID_SIZE / 2);
  state.snake     = [
    { x: midX,     y: midY },
    { x: midX - 1, y: midY },
    { x: midX - 2, y: midY },
  ];
  state.direction = { x: 1, y: 0 };
  state.nextDir   = { x: 1, y: 0 };
  state.score     = 0;
  state.running   = true;
  state.gameOver  = false;
  scoreEl.textContent = '0';

  spawnApple();
  drawBoard();

  await createSession();

  state.tickHandle = setInterval(tick, TICK_MS[state.difficulty]);
}

// ── Direction input ───────────────────────────────────────────────────────────
function setDirection(dx, dy) {
  // Prevent reversing
  if (dx === -state.direction.x && dy === -state.direction.y) return;
  state.nextDir = { x: dx, y: dy };
}

document.addEventListener('keydown', (e) => {
  if (!state.running) return;
  switch (e.key) {
    case 'ArrowUp':    case 'w': case 'W': e.preventDefault(); setDirection(0, -1); break;
    case 'ArrowDown':  case 's': case 'S': e.preventDefault(); setDirection(0,  1); break;
    case 'ArrowLeft':  case 'a': case 'A': e.preventDefault(); setDirection(-1, 0); break;
    case 'ArrowRight': case 'd': case 'D': e.preventDefault(); setDirection( 1, 0); break;
  }
});

btnUp.addEventListener('click',    () => { if (state.running) setDirection(0, -1); });
btnDown.addEventListener('click',  () => { if (state.running) setDirection(0,  1); });
btnLeft.addEventListener('click',  () => { if (state.running) setDirection(-1, 0); });
btnRight.addEventListener('click', () => { if (state.running) setDirection( 1, 0); });

// ── Controls ──────────────────────────────────────────────────────────────────
btnNew.addEventListener('click', startNewGame);
btnOverlayNew.addEventListener('click', startNewGame);

diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.difficulty = btn.dataset.difficulty;
    localStorage.setItem('snake_difficulty', state.difficulty);
    // Sync leaderboard modal tabs
    tabBtns.forEach(t => t.classList.toggle('active', t.dataset.difficulty === state.difficulty));
    startNewGame();
  });
});

// ── Leaderboard modal ─────────────────────────────────────────────────────────
let activeLbDifficulty = 'medium';

btnLeaderboard.addEventListener('click', () => openLeaderboardModal(state.difficulty));
btnModalClose.addEventListener('click', closeLeaderboardModal);
modalBackdrop.addEventListener('click', () => {
  closeLeaderboardModal();
  closeScoreModal();
});

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeLbDifficulty = btn.dataset.difficulty;
    loadLeaderboard(activeLbDifficulty);
  });
});

function openLeaderboardModal(difficulty) {
  activeLbDifficulty = difficulty;
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.difficulty === difficulty));
  modalLeaderboard.classList.remove('hidden');
  modalBackdrop.classList.remove('hidden');
  loadLeaderboard(difficulty);
}

function closeLeaderboardModal() {
  modalLeaderboard.classList.add('hidden');
  if (modalScore.classList.contains('hidden')) {
    modalBackdrop.classList.add('hidden');
  }
}

async function loadLeaderboard(difficulty) {
  leaderboardContent.innerHTML = '<p class="loading">Loading…</p>';
  try {
    const res  = await fetch(`/api/leaderboard?difficulty=${difficulty}`);
    const data = await res.json();
    if (!res.ok) {
      leaderboardContent.innerHTML = `<p class="empty-state">Error: ${escHtml(data.error)}</p>`;
      return;
    }
    renderLeaderboard(data.scores);
  } catch {
    leaderboardContent.innerHTML = '<p class="empty-state">Failed to load scores.</p>';
  }
}

function renderLeaderboard(scores) {
  if (!scores || !scores.length) {
    leaderboardContent.innerHTML = '<p class="empty-state">No scores yet — be the first!</p>';
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  const rows = scores.map((s, i) => `
    <tr>
      <td class="rank ${i < 3 ? `rank-${i + 1}` : ''}">${medals[i] || i + 1}</td>
      <td>${escHtml(s.player_name)}</td>
      <td>${s.score}</td>
      <td>${fmtDate(s.created_at)}</td>
    </tr>
  `).join('');
  leaderboardContent.innerHTML = `
    <table class="leaderboard-table">
      <thead><tr><th>#</th><th>Player</th><th>Score</th><th>Date</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Score submit modal ────────────────────────────────────────────────────────
let pendingScore = 0;

function openScoreModal(score) {
  pendingScore = score;
  scoreDisplay.textContent = `You scored ${score} point${score === 1 ? '' : 's'}! 🎉`;
  playerNameInput.value = localStorage.getItem('snake_playerName') || '';
  modalScore.classList.remove('hidden');
  modalBackdrop.classList.remove('hidden');
  playerNameInput.focus();
}

function closeScoreModal() {
  modalScore.classList.add('hidden');
  if (modalLeaderboard.classList.contains('hidden')) {
    modalBackdrop.classList.add('hidden');
  }
}

scoreForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = playerNameInput.value.trim();
  if (!name) return;
  localStorage.setItem('snake_playerName', name);
  await submitScore(name, pendingScore);
  closeScoreModal();
  openLeaderboardModal(state.difficulty);
});

btnSkipScore.addEventListener('click', () => {
  // Discard session without saving
  if (state.sessionId) {
    fetch(`/api/session/${state.sessionId}`, { method: 'DELETE' }).catch(() => {});
    state.sessionId = null;
  }
  closeScoreModal();
  overlayMsgEl.textContent = `Game Over — Score: ${pendingScore}`;
  overlayEl.classList.remove('hidden');
});

async function submitScore(playerName, score) {
  if (!state.sessionId) return;
  try {
    await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_name: playerName,
        score,
        difficulty:  state.difficulty,
        session_id:  state.sessionId,
      }),
    });
    state.sessionId = null;
  } catch {
    console.warn('Score submission failed.');
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
(function init() {
  const savedDiff = localStorage.getItem('snake_difficulty') || 'medium';
  state.difficulty = savedDiff;
  diffBtns.forEach(b => b.classList.toggle('active', b.dataset.difficulty === savedDiff));
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.difficulty === savedDiff));

  initTheme();
  startNewGame();
})();
