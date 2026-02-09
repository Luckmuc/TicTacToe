class BotAI {
    static getMove(board, botSymbol = 'O', playerSymbol = 'X') {
        // Minimax-Algorithmus für unbesiegbaren Bot
        const bestMove = this.minimax(board, botSymbol, botSymbol, playerSymbol);
        return bestMove.index;
    }

    static minimax(board, currentSymbol, botSymbol, playerSymbol) {
        // Verfügbare Züge finden
        const availableSpots = board
            .map((cell, index) => cell === null ? index : null)
            .filter(index => index !== null);

        // Terminal-Zustände prüfen
        const winner = this.checkWinner(board);
        if (winner === botSymbol) {
            return { score: 10 };
        } else if (winner === playerSymbol) {
            return { score: -10 };
        } else if (availableSpots.length === 0) {
            return { score: 0 };
        }

        // Alle möglichen Züge durchgehen
        const moves = [];

        for (let i = 0; i < availableSpots.length; i++) {
            const move = {};
            move.index = availableSpots[i];

            // Zug simulieren
            board[availableSpots[i]] = currentSymbol;

            // Rekursiv minimax aufrufen
            if (currentSymbol === botSymbol) {
                const result = this.minimax(board, playerSymbol, botSymbol, playerSymbol);
                move.score = result.score;
            } else {
                const result = this.minimax(board, botSymbol, botSymbol, playerSymbol);
                move.score = result.score;
            }

            // Zug rückgängig machen
            board[availableSpots[i]] = null;

            moves.push(move);
        }

        // Besten Zug wählen
        let bestMove;
        if (currentSymbol === botSymbol) {
            // Maximieren für Bot
            let bestScore = -Infinity;
            for (let i = 0; i < moves.length; i++) {
                if (moves[i].score > bestScore) {
                    bestScore = moves[i].score;
                    bestMove = i;
                }
            }
        } else {
            // Minimieren für Spieler
            let bestScore = Infinity;
            for (let i = 0; i < moves.length; i++) {
                if (moves[i].score < bestScore) {
                    bestScore = moves[i].score;
                    bestMove = i;
                }
            }
        }

        return moves[bestMove];
    }

    static checkWinner(board) {
        const lines = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ];

        for (const line of lines) {
            const [a, b, c] = line;
            if (board[a] && 
                board[a] === board[b] && 
                board[a] === board[c]) {
                return board[a];
            }
        }

        return null;
    }

    static findWinningMove(board, symbol) {
        const lines = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ];

        for (const line of lines) {
            const [a, b, c] = line;
            const values = [board[a], board[b], board[c]];
            const symbolCount = values.filter(v => v === symbol).length;
            const nullCount = values.filter(v => v === null).length;

            if (symbolCount === 2 && nullCount === 1) {
                if (board[a] === null) return a;
                if (board[b] === null) return b;
                if (board[c] === null) return c;
            }
        }

        return null;
    }
}

module.exports = BotAI;
