// Cliente WebSocket para o jogo Genius Cooperativo

// Elementos da interface
const statusElement = document.getElementById('status');
const levelElement = document.getElementById('level-value');
const playerCountElement = document.getElementById('player-count');
const playersListElement = document.getElementById('players-list');
const readyButton = document.getElementById('ready-btn');
const restartButton = document.getElementById('restart-btn');
const turnIndicator = document.getElementById('turn-indicator');

// Botões coloridos
const colorButtons = {
    green: document.getElementById('green'),
    red: document.getElementById('red'),
    yellow: document.getElementById('yellow'),
    blue: document.getElementById('blue')
};

// Estado do cliente
let clientState = {
    playerId: null,
    isMyTurn: false,
    gameActive: false
};

// Configuração do WebSocket
let socket;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Inicializar conexão WebSocket
function initWebSocket() {
    // Determinar o endereço do servidor WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    socket = new WebSocket(wsUrl);
    
    // Eventos do WebSocket
    socket.onopen = handleSocketOpen;
    socket.onmessage = handleSocketMessage;
    socket.onclose = handleSocketClose;
    socket.onerror = handleSocketError;
}

// Manipulador de conexão aberta
function handleSocketOpen() {
    console.log('Conectado ao servidor WebSocket');
    statusElement.textContent = 'Conectado';
    reconnectAttempts = 0;
}

// Manipulador de mensagens recebidas
function handleSocketMessage(event) {
    try {
        const message = JSON.parse(event.data);
        console.log('Mensagem recebida:', message);
        
        switch (message.type) {
            case 'connected':
                handleConnected(message);
                break;
            case 'playerCount':
                updatePlayerCount(message);
                break;
            // Outros tipos de mensagens serão implementados nos próximos commits
        }
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
    }
}

// Manipulador de fechamento de conexão
function handleSocketClose(event) {
    console.log('Conexão WebSocket fechada:', event);
    statusElement.textContent = 'Desconectado';
    
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        statusElement.textContent = `Reconectando (${reconnectAttempts})...`;
        setTimeout(initWebSocket, 2000 * reconnectAttempts);
    } else {
        statusElement.textContent = 'Falha na conexão';
    }
}

// Manipulador de erros de conexão
function handleSocketError(error) {
    console.error('Erro na conexão WebSocket:', error);
    statusElement.textContent = 'Erro de conexão';
}

// Manipulador de conexão estabelecida
function handleConnected(message) {
    clientState.playerId = message.playerId;
    updatePlayerCount(message);
    statusElement.textContent = 'Aguardando jogadores...';
    
    // Adicionar jogador à lista
    const playerItem = document.createElement('div');
    playerItem.textContent = `Você (${message.playerId})`;
    playersListElement.innerHTML = '';
    playersListElement.appendChild(playerItem);
}

// Atualizar contagem de jogadores
function updatePlayerCount(message) {
    playerCountElement.textContent = `${message.count}/4`;
}

// Enviar mensagem para o servidor
function sendMessage(message) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    }
}

// Inicializar eventos da interface
function initEvents() {
    // Botão de pronto
    readyButton.addEventListener('click', () => {
        sendMessage({
            type: 'ready',
            ready: true
        });
        
        readyButton.textContent = 'Aguardando...';
        readyButton.disabled = true;
    });
    
    // Botão de reiniciar
    restartButton.addEventListener('click', () => {
        sendMessage({
            type: 'requestRestart'
        });
    });
    
    // Botões coloridos
    Object.entries(colorButtons).forEach(([color, button]) => {
        button.addEventListener('click', () => {
            if (clientState.gameActive && clientState.isMyTurn) {
                sendMessage({
                    type: 'move',
                    color: color
                });
                
                highlightButton(color);
            }
        });
    });
}

// Destacar botão temporariamente
function highlightButton(color) {
    const button = colorButtons[color];
    button.classList.add('active');
    
    setTimeout(() => {
        button.classList.remove('active');
    }, 300);
}

// Inicializar aplicação
function init() {
    console.log('Inicializando cliente Genius Cooperativo');
    initEvents();
    initWebSocket();
}

// Iniciar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', init);
