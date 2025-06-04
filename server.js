const express = require('express');
const http = require('http');
const path = require('path');

// Configuração do servidor Express
const app = express();
const server = http.createServer(app);

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Genius Cooperativo rodando na porta ${PORT}`);
});
