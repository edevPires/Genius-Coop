// Cliente WebSocket para o jogo Genius Cooperativo

// Elementos da interface
const statusElement = document.getElementById('status');
const levelElement = document.getElementById('level-value');
const playerCountElement = document.getElementById('player-count');
const playersListElement = document.getElementById('players-list');
const readyButton = document.getElementById('ready-btn');
const restartButton = document.getElementById('restart-btn');
const turnIndicator = document.getElementById('turn-indicator');
const connectionOverlay = document.getElementById('connection-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const gameOverMessage = document.getElementById('game-over-message');
const finalScoreElement = document.getElementById('final-score');
const playAgainButton = document.getElementById('play-again-btn');
const messageBox = document.getElementById('message-box');
const messageTitle = document.getElementById('message-title');
const messageText = document.getElementById('message-text');
const messageCloseButton = document.getElementById('message-close');

// Botões coloridos
const colorButtons = {
    green: document.getElementById('green'),
    red: document.getElementById('red'),
    yellow: document.getElementById('yellow'),
    blue: document.getElementById('blue')
};

// Sons
const sounds = {
    green: document.getElementById('green-sound'),
    red: document.getElementById('red-sound'),
    yellow: document.getElementById('yellow-sound'),
    blue: document.getElementById('blue-sound'),
    error: document.getElementById('error-sound'),
    success: document.getElementById('success-sound')
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
    playersList: [],
    readyForNextLevel: false,
    votedRestart: false
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
    connectionOverlay.classList.add('hidden');
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
                handlePlayerMove(message);
                break;
            case 'waitingForPlayers':
                // Atualizar informações sobre jogadores prontos para o próximo nível
                updateWaitingStatus(message);
                break;
            case 'restartVotes':
                // Atualizar informações sobre votos para reiniciar
                updateRestartVotes(message);
                break;
            case 'gameReset':
                // Lidar com reinício do jogo
                handleGameReset(message);
                break;
        }
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
    }
}

// Manipulador de fechamento de conexão
function handleSocketClose(event) {
    console.log('Conexão WebSocket fechada:', event);
    
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        connectionOverlay.classList.remove('hidden');
        setTimeout(initWebSocket, 2000 * reconnectAttempts);
    } else {
        showMessage('Erro de Conexão', 'Não foi possível reconectar ao servidor. Recarregue a página para tentar novamente.');
    }
}

// Manipulador de erros de conexão
function handleSocketError(error) {
    console.error('Erro na conexão WebSocket:', error);
}

// Manipulador de conexão estabelecida
function handleConnected(message) {
    clientState.playerId = message.playerId;
    playerCountElement.textContent = message.playerCount;
    
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
        clientState.votedRestart = currentPlayer.votedRestart || false;
        
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
        }
        
        // Atualizar botão de reiniciar
        updateRestartButton();
    }
    
    // Atualizar estado do jogo
    clientState.gameActive = message.isActive;
    
    // Habilitar/desabilitar botões de cor
    updateColorButtonsState();
}

// Atualizar botão de reiniciar
function updateRestartButton() {
    // O botão de reiniciar sempre está disponível
    restartButton.disabled = false;
    
    if (clientState.votedRestart) {
        restartButton.textContent = 'Cancelar Reinício';
        restartButton.classList.add('voted');
    } else {
        restartButton.textContent = 'Reiniciar Jogo';
        restartButton.classList.remove('voted');
    }
}

// Atualizar lista de jogadores
function updatePlayersList(players) {
    clientState.playersList = players;
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
        
        if (player.votedRestart) {
            playerStatus.textContent = 'Votou Reiniciar';
            playerStatus.classList.add('restart-vote');
        } else if (player.turn) {
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
    // Resetar o estado de pronto para o próximo nível
    clientState.readyForNextLevel = false;
    
    // Atualizar nível na interface
    levelElement.textContent = message.currentLevel;
    
    // Tocar som de sucesso
    sounds.success.play();
    
    // Mostrar mensagem personalizada
    messageTitle.textContent = 'Nível Completo!';
    messageText.textContent = `Parabéns! Vocês completaram o nível ${message.currentLevel}. Próximo nível: ${message.nextLevel}`;
    
    // Limpar qualquer conteúdo anterior na caixa de mensagem
    const messageContent = document.querySelector('.message-content');
    
    // Remover todos os botões existentes
    const existingButtons = messageContent.querySelectorAll('button');
    existingButtons.forEach(button => {
        messageContent.removeChild(button);
    });
    
    // Criar novo botão de confirmação
    const confirmButton = document.createElement('button');
    confirmButton.className = 'btn';
    confirmButton.id = 'next-level-btn';
    confirmButton.textContent = 'Continuar para o próximo nível';
    confirmButton.onclick = () => {
        if (!clientState.readyForNextLevel) {
            clientState.readyForNextLevel = true;
            sendMessage({
                type: 'readyForNextLevel'
            });
            confirmButton.disabled = true;
            confirmButton.textContent = 'Aguardando outros jogadores...';
        }
    };
    
    // Adicionar o botão à caixa de mensagem
    messageContent.appendChild(confirmButton);
    
    // Mostrar a caixa de mensagem
    messageBox.classList.remove('hidden');
}

// Atualizar status de espera para o próximo nível
function updateWaitingStatus(message) {
    const confirmButton = document.querySelector('#next-level-btn');
    if (confirmButton) {
        confirmButton.textContent = `Aguardando outros jogadores... (${message.ready}/${message.total})`;
        
        // Se todos os jogadores estiverem prontos, fechar o popup automaticamente
        if (message.ready >= message.total) {
            // Fechar o popup após um breve atraso para que o usuário veja que todos estão prontos
            setTimeout(() => {
                messageBox.classList.add('hidden');
            }, 1000);
        }
    }
}

// Atualizar status de votos para reiniciar
function updateRestartVotes(message) {
    // Atualizar texto do botão de reiniciar
    restartButton.textContent = clientState.votedRestart ? 
        `Cancelar Reinício (${message.votes}/${message.total})` : 
        `Reiniciar Jogo (${message.votes}/${message.total})`;
    
    // Se todos votaram, mostrar mensagem
    if (message.votes === message.total) {
        showMessage('Reiniciando Jogo', 'Todos os jogadores votaram para reiniciar. O jogo será reiniciado em breve.');
    }
}

// Manipulador de reinício de jogo
function handleGameReset(message) {
    // Fechar qualquer popup aberto
    messageBox.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    
    // Resetar estado do cliente
    clientState.isMyTurn = false;
    clientState.gameActive = false;
    clientState.isReady = false;
    clientState.readyForNextLevel = false;
    clientState.votedRestart = false;
    
    // Atualizar botões
    updateRestartButton();
    readyButton.disabled = false;
    readyButton.textContent = 'Estou Pronto';
    
    // Mostrar mensagem de reinício
    showMessage('Jogo Reiniciado', message.message);
}

// Manipulador de jogada de outro jogador
function handlePlayerMove(message) {
    // Destacar o botão pressionado pelo outro jogador
    highlightButton(message.color);
}

// Manipulador de fim de jogo
function handleGameOver(message) {
    // Mostrar overlay de fim de jogo
    gameOverMessage.textContent = `Jogada incorreta! A cor correta era ${message.correctColor}.`;
    finalScoreElement.textContent = message.finalScore;
    gameOverOverlay.classList.remove('hidden');
    
    // Tocar som de erro
    sounds.error.play();
    
    // Resetar estado do cliente
    clientState.isMyTurn = false;
    clientState.gameActive = false;
    clientState.isReady = false;
    clientState.readyForNextLevel = false;
    
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
    
    button.classList.add('highlight');
    sound.currentTime = 0;
    sound.play();
    
    setTimeout(() => {
        button.classList.remove('highlight');
    }, 500);
}

// Atualizar estado dos botões de cor
function updateColorButtonsState() {
    const buttonsEnabled = clientState.gameActive && clientState.isMyTurn && !clientState.isPlayingSequence;
    
    Object.values(colorButtons).forEach(button => {
        if (buttonsEnabled) {
            button.classList.add('active');
            button.style.cursor = 'pointer';
        } else {
            button.classList.remove('active');
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

// Mostrar mensagem na caixa de diálogo
function showMessage(title, text) {
    messageTitle.textContent = title;
    messageText.textContent = text;
    
    // Restaurar o botão de fechar padrão
    const messageContent = document.querySelector('.message-content');
    const currentButton = messageContent.querySelector('button');
    if (currentButton && currentButton !== messageCloseButton) {
        messageContent.removeChild(currentButton);
    }
    if (!messageContent.contains(messageCloseButton)) {
        messageContent.appendChild(messageCloseButton);
    }
    
    messageBox.classList.remove('hidden');
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
        // Alternar o estado de voto para reiniciar
        clientState.votedRestart = !clientState.votedRestart;
        
        sendMessage({
            type: 'voteRestart',
            vote: clientState.votedRestart
        });
        
        // Atualizar aparência do botão
        updateRestartButton();
    });
    
    // Botões coloridos
    Object.entries(colorButtons).forEach(([color, button]) => {
        button.addEventListener('click', () => {
            if (clientState.gameActive && clientState.isMyTurn && !clientState.isPlayingSequence) {
                // Enviar jogada para o servidor
                sendMessage({
                    type: 'move',
                    color: color
                });
                
                // Destacar botão e tocar som
                highlightButton(color);
            }
        });
    });
    
    // Botão de fechar mensagem
    messageCloseButton.addEventListener('click', () => {
        messageBox.classList.add('hidden');
    });
    
    // Botão de jogar novamente
    playAgainButton.addEventListener('click', () => {
        gameOverOverlay.classList.add('hidden');
        sendMessage({
            type: 'ready',
            ready: true
        });
    });
}

// Inicializar aplicação
function init() {
    initWebSocket();
    initEvents();
    
    // Criar sons temporários se os arquivos de áudio não estiverem disponíveis
    createTemporarySounds();
}

// Criar sons temporários usando Web Audio API
function createTemporarySounds() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const frequencies = {
        green: 415.3, // G#4
        red: 311.13, // D#4
        yellow: 252, // B3
        blue: 209, // G#3
        error: [200, 150], // Erro (duas frequências)
        success: [400, 600, 800] // Sucesso (três frequências)
    };
    
    Object.entries(frequencies).forEach(([color, freq]) => {
        if (!Array.isArray(freq)) {
            // Sons simples para as cores
            sounds[color].addEventListener('error', () => {
                sounds[color].play = () => {
                    playTone(audioContext, freq, 0.3);
                };
            });
        } else if (color === 'error') {
            // Som de erro (duas frequências descendentes)
            sounds[color].addEventListener('error', () => {
                sounds[color].play = () => {
                    playTone(audioContext, freq[0], 0.2);
                    setTimeout(() => playTone(audioContext, freq[1], 0.3), 200);
                };
            });
        } else if (color === 'success') {
            // Som de sucesso (três frequências ascendentes)
            sounds[color].addEventListener('error', () => {
                sounds[color].play = () => {
                    playTone(audioContext, freq[0], 0.1);
                    setTimeout(() => playTone(audioContext, freq[1], 0.1), 100);
                    setTimeout(() => playTone(audioContext, freq[2], 0.2), 200);
                };
            });
        }
    });
}

// Tocar tom usando Web Audio API
function playTone(audioContext, frequency, duration) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    
    // Fade out
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    setTimeout(() => {
        oscillator.stop();
    }, duration * 1000);
}

// Iniciar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', init);
