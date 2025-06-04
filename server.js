const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

// Configuração do servidor Express
const app = express();
const server = http.createServer(app);

// Configuração do servidor WebSocket
const wss = new WebSocket.Server({ server });

// Configurações do jogo
const COLORS = ['green', 'red', 'yellow', 'blue'];
const INITIAL_SEQUENCE_LENGTH = 1;
const MAX_PLAYERS = 4;

// Estado do jogo
let gameState = {
  isActive: false,
  sequence: [],
  currentStep: 0,
  players: new Map(), // Mapa de WebSocket -> { id, color, ready, turn }
  playerCount: 0,
  waitingForPlayers: true,
  gameMode: 'cooperative', // 'cooperative' ou 'competitive'
  turnIndex: 0
};

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gerar ID único para jogadores
function generatePlayerId() {
  return Math.random().toString(36).substring(2, 10);
}

// Gerar sequência aleatória de cores
function generateSequence(length) {
  const sequence = [];
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * COLORS.length);
    sequence.push(COLORS[randomIndex]);
  }
  return sequence;
}

// Atribuir cores aos jogadores
function assignPlayerColors() {
  const playerColors = ['#00a74a', '#9f0f17', '#cca707', '#094a8f'];
  let colorIndex = 0;
  
  gameState.players.forEach((player) => {
    player.color = playerColors[colorIndex % playerColors.length];
    colorIndex++;
  });
}

// Iniciar um novo jogo
function startNewGame() {
  gameState.isActive = true;
  gameState.waitingForPlayers = false;
  gameState.sequence = generateSequence(INITIAL_SEQUENCE_LENGTH);
  gameState.currentStep = 0;
  gameState.turnIndex = 0;
  
  // Atribuir cores aos jogadores
  assignPlayerColors();
  
  // Definir quem começa
  updatePlayerTurns();
  
  // Enviar estado inicial para todos
  broadcastGameState();
  
  // Enviar sequência para todos os jogadores
  broadcastMessage({
    type: 'sequence',
    sequence: gameState.sequence
  });
}

// Atualizar de quem é a vez de jogar
function updatePlayerTurns() {
  let index = 0;
  
  // Resetar todos os turnos
  gameState.players.forEach((player) => {
    player.turn = false;
  });
  
  // Definir o jogador atual
  if (gameState.playerCount > 0) {
    const players = Array.from(gameState.players.values());
    const currentPlayerIndex = gameState.turnIndex % gameState.playerCount;
    players[currentPlayerIndex].turn = true;
  }
}

// Avançar para o próximo jogador
function nextPlayerTurn() {
  gameState.turnIndex++;
  updatePlayerTurns();
  broadcastGameState();
}

// Verificar se todos os jogadores estão prontos
function checkAllPlayersReady() {
  if (gameState.playerCount === 0) {
    return false;
  }
  
  for (const player of gameState.players.values()) {
    if (!player.ready) {
      return false;
    }
  }
  
  return true;
}

// Resetar o jogo
function resetGame() {
  gameState.isActive = false;
  gameState.sequence = [];
  gameState.currentStep = 0;
  gameState.waitingForPlayers = true;
  gameState.turnIndex = 0;
  
  // Resetar status dos jogadores
  gameState.players.forEach((player) => {
    player.ready = false;
    player.turn = false;
  });
  
  broadcastGameState();
}

// Verificar se a jogada está correta
function checkMove(color) {
  return color === gameState.sequence[gameState.currentStep];
}

// Enviar mensagem para todos os clientes
function broadcastMessage(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Enviar estado do jogo para todos os clientes
function broadcastGameState() {
  const players = Array.from(gameState.players.values()).map(player => ({
    id: player.id,
    color: player.color,
    ready: player.ready,
    turn: player.turn
  }));
  
  broadcastMessage({
    type: 'gameState',
    isActive: gameState.isActive,
    waitingForPlayers: gameState.waitingForPlayers,
    playerCount: gameState.playerCount,
    players: players,
    gameMode: gameState.gameMode
  });
}

// Gerenciar conexões WebSocket
wss.on('connection', (ws) => {
  // Verificar se o jogo já está cheio
  if (gameState.playerCount >= MAX_PLAYERS) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Jogo cheio! Tente novamente mais tarde.'
    }));
    ws.close();
    return;
  }
  
  // Adicionar novo jogador
  const playerId = generatePlayerId();
  gameState.players.set(ws, {
    id: playerId,
    color: null, // Será atribuído quando o jogo começar
    ready: false,
    turn: false
  });
  gameState.playerCount++;
  
  // Enviar ID para o novo jogador
  ws.send(JSON.stringify({
    type: 'connected',
    playerId: playerId,
    playerCount: gameState.playerCount
  }));
  
  // Atualizar estado do jogo para todos
  broadcastGameState();
  
  // Manipular mensagens recebidas
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Mensagem recebida:', data);
      
      const player = gameState.players.get(ws);
      if (!player) return;
      
      switch (data.type) {
        case 'ready':
          player.ready = data.ready;
          
          if (checkAllPlayersReady() && gameState.waitingForPlayers) {
            startNewGame();
          } else {
            broadcastGameState();
          }
          break;
          
        case 'move':
          if (gameState.isActive && player.turn) {
            const isCorrect = checkMove(data.color);
            
            // Informar todos sobre a jogada
            broadcastMessage({
              type: 'playerMove',
              playerId: player.id,
              color: data.color
            });
            
            if (isCorrect) {
              gameState.currentStep++;
              
              // Verificar se completou a sequência
              if (gameState.currentStep >= gameState.sequence.length) {
                // Próximo nível
                const nextSequence = [...gameState.sequence];
                const randomIndex = Math.floor(Math.random() * COLORS.length);
                nextSequence.push(COLORS[randomIndex]);
                
                // Informar que o nível foi completado
                broadcastMessage({
                  type: 'levelComplete',
                  currentLevel: gameState.sequence.length,
                  nextLevel: nextSequence.length
                });
                
                // Atualizar sequência e resetar passo atual
                gameState.sequence = nextSequence;
                gameState.currentStep = 0;
                
                // Enviar nova sequência após um breve atraso
                setTimeout(() => {
                  broadcastMessage({
                    type: 'sequence',
                    sequence: gameState.sequence
                  });
                }, 2000);
              } else {
                // Próximo jogador no modo cooperativo
                if (gameState.gameMode === 'cooperative') {
                  nextPlayerTurn();
                }
              }
            } else {
              // Jogada incorreta, fim de jogo
              broadcastMessage({
                type: 'gameOver',
                correctColor: gameState.sequence[gameState.currentStep],
                finalScore: gameState.sequence.length - 1
              });
              
              // Resetar o jogo
              resetGame();
            }
          }
          break;
          
        case 'requestRestart':
          if (!gameState.isActive) {
            player.ready = true;
            if (checkAllPlayersReady()) {
              startNewGame();
            } else {
              broadcastGameState();
            }
          }
          break;
      }
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
    }
  });
  
  // Manipular desconexão
  ws.on('close', () => {
    if (gameState.players.has(ws)) {
      const playerId = gameState.players.get(ws).id;
      gameState.players.delete(ws);
      gameState.playerCount--;
      
      // Informar outros jogadores
      broadcastMessage({
        type: 'playerLeft',
        message: `Jogador ${playerId} saiu do jogo.`
      });
      
      // Atualizar estado do jogo
      broadcastGameState();
      
      // Se não houver mais jogadores, resetar o jogo
      if (gameState.playerCount === 0) {
        resetGame();
      }
      // Se o jogo estava ativo e agora não há jogadores suficientes, resetar
      else if (gameState.isActive && gameState.playerCount < 1) {
        broadcastMessage({
          type: 'gameOver',
          message: 'Jogadores insuficientes para continuar.'
        });
        resetGame();
      }
      // Se era a vez do jogador que saiu, passar para o próximo
      else if (gameState.isActive) {
        updatePlayerTurns();
        broadcastGameState();
      }
    }
  });
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Genius Cooperativo rodando na porta ${PORT}`);
});
