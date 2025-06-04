const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

// Configuração do servidor Express
const app = express();
const server = http.createServer(app);

// Configuração do servidor WebSocket
const wss = new WebSocket.Server({ server });

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gerenciar conexões WebSocket
wss.on('connection', (ws) => {
  console.log('Nova conexão WebSocket estabelecida');
  
  // Gerar ID único para o jogador
  const playerId = Math.random().toString(36).substring(2, 10);
  
  // Enviar confirmação de conexão
  ws.send(JSON.stringify({
    type: 'connected',
    playerId: playerId,
    playerCount: wss.clients.size
  }));
  
  // Broadcast para todos os clientes sobre o novo jogador
  broadcastPlayerCount();
  
  // Manipular mensagens recebidas
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Mensagem recebida:', data);
      
      // Aqui serão implementadas as ações com base no tipo de mensagem
      // A lógica do jogo será adicionada nos próximos commits
      
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
    }
  });
  
  // Manipular desconexão
  ws.on('close', () => {
    console.log('Conexão WebSocket fechada');
    broadcastPlayerCount();
  });
});

// Função para enviar contagem de jogadores para todos os clientes
function broadcastPlayerCount() {
  const count = wss.clients.size;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'playerCount',
        count: count
      }));
    }
  });
}

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Genius Cooperativo rodando na porta ${PORT}`);
});
