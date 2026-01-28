const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let gameState = {
  players: {}
};

io.on('connection', socket => {

  socket.on('join', name => {
    gameState.players[socket.id] = { name, letter: '', score: 0 };
    io.emit('state', gameState);
  });

  socket.on('letter', letter => {
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].letter = letter.toLowerCase();
      io.emit('state', gameState);
    }
  });

  socket.on('word', word => {
    const letters = Object.values(gameState.players).map(p => p.letter);
    const ok = letters.every(l => word.includes(l));
    if (ok) {
      Object.values(gameState.players).forEach(p => p.score++);
      io.emit('state', gameState);
    }
  });

  socket.on('disconnect', () => {
    delete gameState.players[socket.id];
    io.emit('state', gameState);
  });

});

server.listen(3000, () => {
  console.log('Server läuft auf http://localhost:3000');
});
