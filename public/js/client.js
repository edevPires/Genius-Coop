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

// Sons (serão implementados posteriormente)
const sounds = {
    green: { play: () => console.log('Som verde') },
    red: { play: () => console.log('Som vermelho') },
    yellow: { play: () => console.log('Som amarelo') },
    blue: { play: () => console.log('Som azul') },
    error: { play: () => console.log('Som de erro') },
    success: { play: () => console.log('Som de sucesso') }
};

// Estado do cliente
let clientState = {
    playerId: null,
    playerColor: null,
    isMyTurn: false,
    isReady: false,
    gameActive: false,
    currentSequence: [],
    isPlayingSequence: false,
    playersList: []
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
            case 'gameState':
                handleGameState(message);
                break;
            case 'sequence':
                handleSequence(message);
                break;
            case 'levelComplete':
                handleLevelComplete(message);
                break;
            case 'gameOver':
                handleGameOver(message);
                break;
            case 'playerLeft':
                showMessage('Jogador Saiu', message.message);
                break;
            case 'error':
                showMessage('Erro', message.message);
                break;
            case 'playerMove':
                // Mostrar movimento do jogador para todos
                highlightButton(message.color);
                break;
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
    playerCountElement.textContent = `${message.playerCount}/4`;
    statusElement.textContent = 'Aguardando jogadores...';
    
    showMessage('Conectado', `Você entrou no jogo! Seu ID é ${message.playerId}. Aguarde outros jogadores e clique em "Estou Pronto" quando quiser começar.`);
}

// Manipulador de estado do jogo
function handleGameState(message) {
    // Atualizar contagem de jogadores
    playerCountElement.textContent = `${message.playerCount}/4`;
    
    // Atualizar status do jogo
    if (message.waitingForPlayers) {
        statusElement.textContent = 'Aguardando jogadores...';
    } else if (message.isActive) {
        statusElement.textContent = 'Jogo em andamento';
    } else {
        statusElement.textContent = 'Jogo finalizado';
    }
    
    // Atualizar lista de jogadores
    updatePlayersList(message.players);
    
    // Verificar se é a vez do jogador atual
    const currentPlayer = message.players.find(player => player.id === clientState.playerId);
    if (currentPlayer) {
        clientState.playerColor = currentPlayer.color;
        clientState.isMyTurn = currentPlayer.turn;
        clientState.isReady = currentPlayer.ready;
        
        // Atualizar botão de pronto
        if (clientState.isReady) {
            readyButton.textContent = 'Aguardando...';
            readyButton.disabled = true;
        } else {
            readyButton.textContent = 'Estou Pronto';
            readyButton.disabled = false;
        }
        
        // Atualizar indicador de turno
        if (clientState.isMyTurn && message.isActive) {
            turnIndicator.textContent = 'Sua vez!';
            turnIndicator.classList.add('active');
        } else {
            turnIndicator.classList.remove('active');
            if (message.isActive) {
                // Mostrar de quem é a vez
                const currentTurnPlayer = message.players.find(player => player.turn);
                if (currentTurnPlayer) {
                    turnIndicator.textContent = currentTurnPlayer.id === clientState.playerId ? 
                        'Sua vez!' : `Vez de ${currentTurnPlayer.id}`;
                }
            } else {
                turnIndicator.textContent = '';
            }
        }
    }
    
    // Atualizar estado do jogo
    clientState.gameActive = message.isActive;
    clientState.playersList = message.players;
    
    // Habilitar/desabilitar botões de cor
    updateColorButtonsState();
}

// Atualizar lista de jogadores
function updatePlayersList(players) {
    playersListElement.innerHTML = '';
    
    players.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        
        const playerColor = document.createElement('div');
        playerColor.className = 'player-color';
        if (player.color) {
            playerColor.style.backgroundColor = player.color;
        } else {
            playerColor.style.backgroundColor = '#555';
        }
        
        const playerName = document.createElement('div');
        playerName.className = 'player-name';
        playerName.textContent = player.id === clientState.playerId ? `Você (${player.id})` : `Jogador ${player.id}`;
        
        const playerStatus = document.createElement('div');
        playerStatus.className = 'player-status';
        
        if (player.turn) {
            playerStatus.textContent = 'Jogando';
            playerStatus.classList.add('turn');
        } else if (player.ready) {
            playerStatus.textContent = 'Pronto';
            playerStatus.classList.add('ready');
        } else {
            playerStatus.textContent = 'Aguardando';
        }
        
        playerItem.appendChild(playerColor);
        playerItem.appendChild(playerName);
        playerItem.appendChild(playerStatus);
        playersListElement.appendChild(playerItem);
    });
}

// Manipulador de sequência recebida
function handleSequence(message) {
    clientState.currentSequence = message.sequence;
    levelElement.textContent = message.sequence.length;
    
    // Reproduzir a sequência após um breve atraso
    setTimeout(() => {
        playSequence(message.sequence);
    }, 1000);
}

// Manipulador de nível completo
function handleLevelComplete(message) {
    // Atualizar nível na interface
    levelElement.textContent = message.currentLevel;
    
    // Tocar som de sucesso
    sounds.success.play();
    
    // Mostrar mensagem de nível completo
    showMessage('Nível Completo!', `Parabéns! Vocês completaram o nível ${message.currentLevel}. Próximo nível: ${message.nextLevel}`);
}

// Manipulador de fim de jogo
function handleGameOver(message) {
    // Tocar som de erro
    sounds.error.play();
    
    // Mostrar mensagem de fim de jogo
    showMessage('Fim de Jogo', `Jogada incorreta! A cor correta era ${message.correctColor}. Pontuação final: ${message.finalScore}`);
    
    // Resetar estado do cliente
    clientState.isMyTurn = false;
    clientState.gameActive = false;
    clientState.isReady = false;
    
    // Atualizar botões
    updateColorButtonsState();
    readyButton.disabled = false;
    readyButton.textContent = 'Estou Pronto';
}

// Reproduzir sequência de cores
function playSequence(sequence) {
    clientState.isPlayingSequence = true;
    updateColorButtonsState();
    
    let i = 0;
    const interval = setInterval(() => {
        if (i < sequence.length) {
            highlightButton(sequence[i]);
            i++;
        } else {
            clearInterval(interval);
            clientState.isPlayingSequence = false;
            updateColorButtonsState();
        }
    }, 800);
}

// Destacar botão e tocar som
function highlightButton(color) {
    const button = colorButtons[color];
    const sound = sounds[color];
    
    button.classList.add('active');
    sound.play();
    
    setTimeout(() => {
        button.classList.remove('active');
    }, 500);
}

// Atualizar estado dos botões de cor
function updateColorButtonsState() {
    const buttonsEnabled = clientState.gameActive && clientState.isMyTurn && !clientState.isPlayingSequence;
    
    Object.values(colorButtons).forEach(button => {
        if (buttonsEnabled) {
            button.classList.add('enabled');
            button.style.cursor = 'pointer';
        } else {
            button.classList.remove('enabled');
            button.style.cursor = 'not-allowed';
        }
    });
}

// Enviar mensagem para o servidor
function sendMessage(message) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    }
}

// Mostrar mensagem na tela
function showMessage(title, text) {
    alert(`${title}\n${text}`);
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
            if (clientState.gameActive && clientState.isMyTurn && !clientState.isPlayingSequence) {
                sendMessage({
                    type: 'move',
                    color: color
                });
                
                highlightButton(color);
            }
        });
    });
}

// Inicializar aplicação
function init() {
    console.log('Inicializando cliente Genius Cooperativo');
    initEvents();
    initWebSocket();
}

// Iniciar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', init);
