const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const GameLogic = require('./gameLogic');
const BotAI = require('./botAI');
const Matchmaking = require('./matchmaking');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 6575;

// Dienst für statische Dateien
app.use(express.static(path.join(__dirname, 'public')));

// Matchmaking-Instanz
const matchmaking = new Matchmaking();

// Speichert aktive Spiele
const games = new Map();
const players = new Map();

io.on('connection', (socket) => {
    console.log(`Neuer Spieler verbunden: ${socket.id}`);

    // Spieler-Registrierung
    socket.on('register', (username) => {
        players.set(socket.id, {
            id: socket.id,
            username: username,
            socket: socket
        });
        console.log(`Spieler registriert: ${username} (${socket.id})`);
    });

    // Bot-Spiel starten
    socket.on('playBot', () => {
        const player = players.get(socket.id);
        if (!player) return;

        const gameId = `bot_${socket.id}_${Date.now()}`;
        const game = new GameLogic(gameId, player, null, true);
        games.set(gameId, game);

        // Zufällig X oder O zuweisen
        const playerSymbol = Math.random() < 0.5 ? 'X' : 'O';
        game.playerSymbol = playerSymbol;
        game.botSymbol = playerSymbol === 'X' ? 'O' : 'X';

        socket.emit('gameStart', {
            gameId: gameId,
            symbol: playerSymbol,
            mode: 'bot',
            opponent: 'Bot'
        });

        // Wenn Bot anfängt
        if (game.botSymbol === 'X') {
            setTimeout(() => {
                const botMove = BotAI.getMove(game.board, game.botSymbol, game.playerSymbol);
                if (botMove !== null) {
                    game.makeMove(botMove, game.botSymbol);
                    socket.emit('moveMade', {
                        position: botMove,
                        symbol: game.botSymbol,
                        board: game.board
                    });
                }
            }, 500);
        }
    });

    // Multiplayer-Suche
    socket.on('searchMatch', (options) => {
        const player = players.get(socket.id);
        if (!player) return;

        socket.emit('searching');
        
        const match = matchmaking.findMatch(player, options);
        
        if (match) {
            // Match gefunden
            const gameId = `game_${Date.now()}`;
            const game = new GameLogic(
                gameId,
                match.player1,
                match.player2,
                false,
                match.options
            );
            games.set(gameId, game);

            // Zufällig X und O zuweisen
            const p1Symbol = Math.random() < 0.5 ? 'X' : 'O';
            const p2Symbol = p1Symbol === 'X' ? 'O' : 'X';

            game.player1Symbol = p1Symbol;
            game.player2Symbol = p2Symbol;
            game.currentPlayer = 'X';

            match.player1.socket.emit('gameStart', {
                gameId: gameId,
                symbol: p1Symbol,
                mode: 'multiplayer',
                opponent: match.player2.username,
                options: match.options
            });

            match.player2.socket.emit('gameStart', {
                gameId: gameId,
                symbol: p2Symbol,
                mode: 'multiplayer',
                opponent: match.player1.username,
                options: match.options
            });
        }
    });

    // Matchmaking abbrechen
    socket.on('cancelSearch', () => {
        const player = players.get(socket.id);
        if (player) {
            matchmaking.removePlayer(player);
            socket.emit('searchCancelled');
        }
    });

    // Zug machen
    socket.on('makeMove', (data) => {
        const game = games.get(data.gameId);
        if (!game) return;

        const player = players.get(socket.id);
        if (!player) return;

        // Prüfen ob Spieler an der Reihe ist
        let playerSymbol;
        if (game.isBot) {
            playerSymbol = game.playerSymbol;
        } else {
            playerSymbol = game.player1.id === socket.id ? game.player1Symbol : game.player2Symbol;
        }

        if (game.currentPlayer !== playerSymbol) {
            return; // Nicht an der Reihe
        }

        const result = game.makeMove(data.position, playerSymbol);
        
        if (result.valid) {
            // Zug an alle Spieler senden
            if (game.isBot) {
                socket.emit('moveMade', {
                    position: data.position,
                    symbol: playerSymbol,
                    board: game.board
                });

                // Prüfen auf Spielende
                if (result.winner || result.draw) {
                    socket.emit('gameEnd', {
                        winner: result.winner,
                        draw: result.draw,
                        winningLine: result.winningLine
                    });
                    games.delete(data.gameId);
                    return;
                }

                // Bot-Zug
                setTimeout(() => {
                    const botMove = BotAI.getMove(game.board, game.botSymbol, game.playerSymbol);
                    if (botMove !== null) {
                        const botResult = game.makeMove(botMove, game.botSymbol);
                        socket.emit('moveMade', {
                            position: botMove,
                            symbol: game.botSymbol,
                            board: game.board
                        });

                        if (botResult.winner || botResult.draw) {
                            socket.emit('gameEnd', {
                                winner: botResult.winner,
                                draw: botResult.draw,
                                winningLine: botResult.winningLine
                            });
                            games.delete(data.gameId);
                        }
                    }
                }, 500);
            } else {
                // Multiplayer
                game.player1.socket.emit('moveMade', {
                    position: data.position,
                    symbol: playerSymbol,
                    board: game.board
                });
                game.player2.socket.emit('moveMade', {
                    position: data.position,
                    symbol: playerSymbol,
                    board: game.board
                });

                if (result.winner || result.draw) {
                    const endData = {
                        winner: result.winner,
                        draw: result.draw,
                        winningLine: result.winningLine
                    };

                    game.player1.socket.emit('gameEnd', endData);
                    game.player2.socket.emit('gameEnd', endData);

                    // Wenn Serie, nächstes Spiel starten
                    if (game.options && game.options.matchCount > 1) {
                        game.currentMatch++;
                        
                        if (game.currentMatch < game.options.matchCount) {
                            // Nächstes Spiel in der Serie
                            setTimeout(() => {
                                game.reset();
                                
                                const p1Symbol = Math.random() < 0.5 ? 'X' : 'O';
                                const p2Symbol = p1Symbol === 'X' ? 'O' : 'X';
                                game.player1Symbol = p1Symbol;
                                game.player2Symbol = p2Symbol;
                                game.currentPlayer = 'X';

                                game.player1.socket.emit('nextMatch', {
                                    matchNumber: game.currentMatch + 1,
                                    totalMatches: game.options.matchCount,
                                    scores: game.scores,
                                    symbol: p1Symbol
                                });

                                game.player2.socket.emit('nextMatch', {
                                    matchNumber: game.currentMatch + 1,
                                    totalMatches: game.options.matchCount,
                                    scores: game.scores,
                                    symbol: p2Symbol
                                });
                            }, 3000);
                        } else {
                            // Serie beendet
                            setTimeout(() => {
                                game.player1.socket.emit('seriesEnd', {
                                    scores: game.scores
                                });
                                game.player2.socket.emit('seriesEnd', {
                                    scores: game.scores
                                });
                                games.delete(data.gameId);
                            }, 3000);
                        }
                    } else {
                        games.delete(data.gameId);
                    }
                }
            }
        }
    });

    // Trennung
    socket.on('disconnect', () => {
        console.log(`Spieler getrennt: ${socket.id}`);
        
        const player = players.get(socket.id);
        if (player) {
            matchmaking.removePlayer(player);
        }

        // Spiel beenden wenn Spieler disconnected
        games.forEach((game, gameId) => {
            if (game.isBot && game.player1.id === socket.id) {
                games.delete(gameId);
            } else if (!game.isBot) {
                if (game.player1.id === socket.id || game.player2.id === socket.id) {
                    const opponent = game.player1.id === socket.id ? game.player2 : game.player1;
                    opponent.socket.emit('opponentDisconnected');
                    games.delete(gameId);
                }
            }
        });

        players.delete(socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
