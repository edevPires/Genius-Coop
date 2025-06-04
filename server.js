const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

// Configuração do servidor Express
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Configurações do jogo
const COLORS = ['green', 'red', 'yellow', 'blue'];
const INITIAL_SEQUENCE_LENGTH = 1; // Corrigido para começar no nível 1
const MAX_PLAYERS = 4;

// Estado do jogo
let gameState = {
  isActive: false,
  sequence: [],
  currentStep: 0,
  players: new Map(), // Mapa de WebSocket -> { id, color, ready, turn, votedRestart }
  playerCount: 0,
  waitingForPlayers: true,
  gameMode: 'cooperative', // 'cooperative' ou 'competitive'
  turnIndex: 0,
  scores: {},
  levelComplete: false,
  playersReadyForNextLevel: new Set(), // Conjunto para rastrear jogadores prontos para o próximo nível
  restartVotes: new Set() // Conjunto para rastrear votos para reiniciar o jogo
};

// Gerar ID único para jogadores
function generatePlayerId() {
  return Math.random().toString(36).substring(2, 10);
}

// Gerar uma nova sequência aleatória
function generateSequence(length) {
  const sequence = [];
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * COLORS.length);
    sequence.push(COLORS[randomIndex]);
  }
  return sequence;
}

// Distribuir cores entre os jogadores no modo cooperativo
function assignPlayerColors() {
  let colorIndex = 0;
  gameState.players.forEach((player) => {
    player.color = COLORS[colorIndex % COLORS.length];
    colorIndex++;
  });
}

// Iniciar um novo jogo
function startNewGame() {
  gameState.isActive = true;
  gameState.waitingForPlayers = false;
  gameState.sequence = generateSequence(INITIAL_SEQUENCE_LENGTH);
  gameState.currentStep = 0;
  
  // Aleatorizar o primeiro jogador
  gameState.turnIndex = Math.floor(Math.random() * gameState.playerCount);
  
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
  gameState.players.forEach((player) => {
    player.turn = (index === gameState.turnIndex);
    index++;
  });
}

// Avançar para o próximo jogador
function nextPlayerTurn() {
  const playerArray = Array.from(gameState.players.values());
  gameState.turnIndex = (gameState.turnIndex + 1) % playerArray.length;
  updatePlayerTurns();
}

// Verificar se todos os jogadores estão prontos
function checkAllPlayersReady() {
  let allReady = true;
  gameState.players.forEach((player) => {
    if (!player.ready) allReady = false;
  });
  return allReady;
}

// Enviar mensagem para todos os clientes
function broadcastMessage(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Enviar estado atual do jogo para todos
function broadcastGameState() {
  const players = [];
  gameState.players.forEach((player) => {
    players.push({
      id: player.id,
      color: player.color,
      ready: player.ready,
      turn: player.turn
    });
  });
  
  broadcastMessage({
    type: 'gameState',
    isActive: gameState.isActive,
    waitingForPlayers: gameState.waitingForPlayers,
    playerCount: gameState.playerCount,
    players: players,
    currentStep: gameState.currentStep,
    scores: gameState.scores
  });
}

// Verificar se a jogada está correta
function checkMove(color, playerId) {
  const expectedColor = gameState.sequence[gameState.currentStep];
  
  // Enviar a jogada para todos os jogadores verem
  broadcastMessage({
    type: 'playerMove',
    color: color,
    playerId: playerId
  });
  
  if (color === expectedColor) {
    // Jogada correta
    gameState.currentStep++;
    
    // Verificar se completou a sequência
    if (gameState.currentStep >= gameState.sequence.length) {
      // Sequência completa, aguardar todos os jogadores para o próximo nível
      gameState.levelComplete = true;
      gameState.playersReadyForNextLevel.clear(); // Limpar jogadores prontos
      
      // Preparar nova sequência para o próximo nível
      const nextSequence = generateSequence(gameState.sequence.length + 1);
      
      // Atualizar pontuação
      gameState.players.forEach((player) => {
        if (!gameState.scores[player.id]) {
          gameState.scores[player.id] = 0;
        }
        gameState.scores[player.id]++;
      });
      
      // Enviar mensagem de nível completo
      broadcastMessage({
        type: 'levelComplete',
        currentLevel: gameState.sequence.length,
        nextLevel: gameState.sequence.length + 1,
        scores: gameState.scores
      });
      
      // Armazenar a próxima sequência para uso posterior
      gameState.nextSequence = nextSequence;
    } else {
      // Próximo jogador no modo cooperativo
      nextPlayerTurn();
      broadcastGameState();
    }
    
    return true;
  } else {
    // Jogada errada, fim de jogo
    broadcastMessage({
      type: 'gameOver',
      correctColor: expectedColor,
      playerColor: color,
      playerId: playerId,
      finalScore: gameState.sequence.length - 1
    });
    
    // Resetar o jogo após alguns segundos
    setTimeout(() => {
      resetGame();
    }, 5000);
    
    return false;
  }
}

// Resetar o jogo
function resetGame() {
  gameState.isActive = false;
  gameState.sequence = [];
  gameState.currentStep = 0;
  gameState.waitingForPlayers = true;
  gameState.turnIndex = 0;
  gameState.scores = {};
  gameState.levelComplete = false;
  gameState.playersReadyForNextLevel.clear();
  gameState.restartVotes.clear();
  
  // Resetar status dos jogadores
  gameState.players.forEach((player) => {
    player.ready = false;
    player.turn = false;
    player.votedRestart = false;
  });
  
  broadcastMessage({
    type: 'gameReset',
    message: 'O jogo foi reiniciado! Todos os jogadores precisam ficar prontos novamente.'
  });
  
  broadcastGameState();
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
  
  // Verificar se o jogo já está em andamento
  if (gameState.isActive && !gameState.waitingForPlayers) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Jogo em andamento! Aguarde o término da partida atual para entrar.'
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
    turn: false,
    votedRestart: false // Para o sistema de votação de reinício
  });
  gameState.playerCount++;
  
  // Enviar ID para o novo jogador
  ws.send(JSON.stringify({
    type: 'connected',
    playerId: playerId,
    playerCount: gameState.playerCount
  }));
  
  // Atualizar todos sobre o novo jogador
  broadcastGameState();
  
  // Gerenciar mensagens do cliente
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const player = gameState.players.get(ws);
      
      switch (data.type) {
        case 'ready':
          player.ready = data.ready;
          
          // Verificar se todos estão prontos para começar
          if (checkAllPlayersReady() && gameState.playerCount >= 2) {
            startNewGame();
          } else {
            broadcastGameState();
          }
          break;
          
        case 'move':
          // Verificar se é a vez deste jogador
          if (gameState.isActive && player.turn) {
            checkMove(data.color, player.id);
          }
          break;
          
        case 'readyForNextLevel':
          // Adicionar jogador à lista de prontos para o próximo nível
          if (gameState.levelComplete) {
            gameState.playersReadyForNextLevel.add(player.id);
            
            // Verificar se todos os jogadores estão prontos para o próximo nível
            if (gameState.playersReadyForNextLevel.size === gameState.playerCount) {
              // Todos os jogadores estão prontos, avançar para o próximo nível
              gameState.levelComplete = false;
              gameState.sequence = gameState.nextSequence;
              gameState.currentStep = 0;
              
              // Aleatorizar o primeiro jogador para o próximo nível
              gameState.turnIndex = Math.floor(Math.random() * gameState.playerCount);
              updatePlayerTurns();
              
              // Informar a todos que todos os jogadores estão prontos
              broadcastMessage({
                type: 'waitingForPlayers',
                ready: gameState.playerCount,
                total: gameState.playerCount,
                allReady: true
              });
              
              // Dar um tempo para que os popups sejam fechados antes de enviar a nova sequência
              setTimeout(() => {
                // Enviar nova sequência para todos
                broadcastMessage({
                  type: 'sequence',
                  sequence: gameState.sequence
                });
                
                broadcastGameState();
              }, 1500);
            } else {
              // Informar quantos jogadores estão prontos
              broadcastMessage({
                type: 'waitingForPlayers',
                ready: gameState.playersReadyForNextLevel.size,
                total: gameState.playerCount,
                allReady: false
              });
            }
          }
          break;
          
        case 'voteRestart':
          // Adicionar ou remover voto para reiniciar
          if (data.vote) {
            gameState.restartVotes.add(player.id);
            player.votedRestart = true;
          } else {
            gameState.restartVotes.delete(player.id);
            player.votedRestart = false;
          }
          
          // Verificar se todos votaram para reiniciar
          if (gameState.restartVotes.size === gameState.playerCount && gameState.playerCount > 0) {
            // Todos votaram para reiniciar, resetar o jogo
            resetGame();
          } else {
            // Informar a todos sobre o status da votação
            broadcastMessage({
              type: 'restartVotes',
              votes: gameState.restartVotes.size,
              total: gameState.playerCount
            });
          }
          break;
      }
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
    }
  });
  
  // Gerenciar desconexão
  ws.on('close', () => {
    if (gameState.players.has(ws)) {
      gameState.players.delete(ws);
      gameState.playerCount--;
      
      // Se não houver mais jogadores, resetar o jogo
      if (gameState.playerCount === 0) {
        resetGame();
      } else {
        // Se o jogo estiver ativo, encerrar por falta de jogadores
        if (gameState.isActive) {
          broadcastMessage({
            type: 'playerLeft',
            message: 'Um jogador saiu. O jogo será reiniciado.'
          });
          resetGame();
        }
        
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
