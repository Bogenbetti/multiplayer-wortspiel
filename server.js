const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const HARD_LETTERS = ['Q', 'X', 'Y', 'Z'];
const EASY_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  .split('')
  .filter(l => !HARD_LETTERS.includes(l));

const ROUND_TIME = 30;
let roundTimer = null;

let game = {
  phase: 'LOBBY',
  letters: [],
  submittedWord: null,
  submitterId: null,
  votes: {},
  timeLeft: ROUND_TIME,
  players: {}
};

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateLetters(playerCount) {
  const letters = [];
  let hardUsed = false;

  for (let i = 0; i < playerCount; i++) {
    // 25 % Chance auf schwierigen Buchstaben,
    // aber nur wenn noch keiner benutzt wurde
    if (!hardUsed && Math.random() < 0.25) {
      letters.push(randomFrom(HARD_LETTERS));
      hardUsed = true;
    } else {
      letters.push(randomFrom(EASY_LETTERS));
    }
  }
  return letters;
}

function startNewRound() {
  game.phase = 'PLAYING';
  game.submittedWord = null;
  game.submitterId = null;
  game.votes = {};
  game.timeLeft = ROUND_TIME;

  const playerCount = Object.keys(game.players).length;
  game.letters = generateLetters(playerCount);

  Object.values(game.players).forEach(p => p.locked = false);

  clearInterval(roundTimer);
  roundTimer = setInterval(() => {
    game.timeLeft--;
    if (game.timeLeft <= 0) {
      startNewRound();
    }
    io.emit('state', game);
  }, 1000);
}

function resetGame() {
  clearInterval(roundTimer);
  game.phase = 'LOBBY';
  game.letters = [];
  game.submittedWord = null;
  game.submitterId = null;
  game.votes = {};
  game.timeLeft = ROUND_TIME;

  Object.values(game.players).forEach(p => {
    p.ready = false;
    p.score = 0;
    p.locked = false;
  });
}

io.on('connection', socket => {

  socket.on('join', name => {
    game.players[socket.id] = {
      name,
      ready: false,
      score: 0,
      locked: false
    };
    io.emit('state', game);
  });

  socket.on('ready', () => {
    const p = game.players[socket.id];
    if (!p) return;

    p.ready = true;

    const allReady =
      Object.values(game.players).length >= 2 &&
      Object.values(game.players).every(p => p.ready);

    if (allReady) startNewRound();
    io.emit('state', game);
  });

  socket.on('submitWord', word => {
    if (game.phase !== 'PLAYING') return;
    if (game.submittedWord) return;
    if (game.players[socket.id].locked) return;

    game.submittedWord = word;
    game.submitterId = socket.id;
    game.phase = 'VOTING';

    io.emit('state', game);
  });

  socket.on('vote', value => {
    if (game.phase !== 'VOTING') return;
    if (socket.id === game.submitterId) return;

    game.votes[socket.id] = value;

    const voters = Object.keys(game.players)
      .filter(id => id !== game.submitterId);

    if (voters.some(id => game.votes[id] === false)) {
      game.players[game.submitterId].locked = true;
      game.phase = 'PLAYING';
      game.submittedWord = null;
      game.submitterId = null;
      game.votes = {};
    } else if (voters.every(id => game.votes[id] === true)) {
      game.players[game.submitterId].score++;
      startNewRound();
    }

    io.emit('state', game);
  });

  socket.on('reset', () => {
    resetGame();
    io.emit('state', game);
  });

  socket.on('disconnect', () => {
    delete game.players[socket.id];
    if (Object.keys(game.players).length === 0) resetGame();
    io.emit('state', game);
  });

});

server.listen(3000, () => {
  console.log('Server läuft auf http://localhost:3000');
});
