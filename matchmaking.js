class Matchmaking {
    constructor() {
        this.queue = [];
    }

    findMatch(player, options) {
        // Suche nach einem passenden Spieler in der Queue
        const matchIndex = this.queue.findIndex(entry => {
            return entry.options.matchCount === options.matchCount &&
                   entry.options.competitive === options.competitive;
        });

        if (matchIndex !== -1) {
            // Match gefunden
            const opponent = this.queue.splice(matchIndex, 1)[0];
            return {
                player1: opponent.player,
                player2: player,
                options: options
            };
        } else {
            // Kein Match gefunden, in Queue einfügen
            this.queue.push({
                player: player,
                options: options,
                timestamp: Date.now()
            });
            return null;
        }
    }

    removePlayer(player) {
        const index = this.queue.findIndex(entry => entry.player.id === player.id);
        if (index !== -1) {
            this.queue.splice(index, 1);
        }
    }

    // Alte Einträge entfernen (älter als 5 Minuten)
    cleanupOldEntries() {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        this.queue = this.queue.filter(entry => entry.timestamp > fiveMinutesAgo);
    }
}

// Cleanup alle 60 Sekunden
setInterval(() => {
    if (global.matchmaking) {
        global.matchmaking.cleanupOldEntries();
    }
}, 60000);

module.exports = Matchmaking;
