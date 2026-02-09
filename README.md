# 🎮 Tic Tac Toe Online

Ein vollständiges Online-Tic-Tac-Toe-Spiel mit Multiplayer-Unterstützung und Bot-Gegner.

## ✨ Features

- 🤖 **Bot-Modus**: Spiele gegen einen intelligenten KI-Gegner
- 👥 **Multiplayer-Modus**: Spiele gegen andere Spieler in Echtzeit
- 🎯 **Matchmaking-System**: Automatische Gegnerfindung mit Queue
- 🏆 **Competitive-Modus**: Spiele Serien mit bis zu 50 Matches und Punktezählung
- 🎨 **Smoothe Animationen**: Schöne Animationen beim Setzen von X und O
- 📱 **Responsive Design**: Funktioniert auf Desktop und Mobile
- 🇩🇪 **Deutsche Oberfläche**: Vollständig auf Deutsch

## 🚀 Installation

### Voraussetzungen

- Node.js (v14 oder höher)
- npm oder yarn

### Lokale Entwicklung

1. **Repository klonen**
   ```bash
   git clone <repository-url>
   cd TicTacToe
   ```

2. **Dependencies installieren**
   ```bash
   npm install
   ```

3. **Server starten**
   ```bash
   npm start
   ```

   Für Entwicklung mit Auto-Reload:
   ```bash
   npm run dev
   ```

4. **Spiel öffnen**
   
   Öffne deinen Browser und gehe zu: `http://localhost:6575`

## 🌐 Server-Deployment

### 1. Dateien auf Server kopieren

```bash
# Erstelle Verzeichnis
sudo mkdir -p /opt/tictactoe

# Kopiere Dateien (von deinem lokalen Rechner aus)
scp -r * user@dein-server:/opt/tictactoe/

# Oder auf dem Server mit Git
cd /opt/tictactoe
git clone <repository-url> .
```

### 2. Dependencies installieren

```bash
cd /opt/tictactoe
npm install --production
```

### 3. Systemd Service einrichten

```bash
# Service-Datei kopieren
sudo cp tictactoe.service /etc/systemd/system/

# Systemd neu laden
sudo systemctl daemon-reload

# Service aktivieren (Autostart)
sudo systemctl enable tictactoe

# Service starten
sudo systemctl start tictactoe

# Status prüfen
sudo systemctl status tictactoe
```

**Wichtig**: Passe in der `tictactoe.service` Datei den User und Pfad an:
- `User=www-data` → Ändere zu deinem gewünschten User
- `WorkingDirectory=/opt/tictactoe` → Passe den Pfad an, falls nötig

### 4. Reverse Proxy mit Caddy

#### Caddy installieren (falls noch nicht installiert)

```bash
# Debian/Ubuntu
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

#### Caddy konfigurieren

1. **Caddyfile bearbeiten**
   ```bash
   sudo nano /etc/caddy/Caddyfile
   ```

2. **Konfiguration hinzufügen** (siehe `Caddyfile.example`):
   
   Für lokales Testing:
   ```
   :80 {
       reverse_proxy localhost:6575
   }
   ```

   Oder mit Domain (automatisches HTTPS):
   ```
   deine-domain.de {
       reverse_proxy localhost:6575 {
           header_up Upgrade {>Upgrade}
           header_up Connection {>Connection}
       }
   }
   ```

3. **Caddy neu laden**
   ```bash
   sudo systemctl reload caddy
   ```

### 5. Firewall konfigurieren

```bash
# Wenn du Caddy verwendest, öffne nur Port 80 und 443
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Oder wenn du direkt auf Port 6575 zugreifen möchtest
sudo ufw allow 6575/tcp
```

## 🎮 Spielanleitung

### Benutzername eingeben
Beim ersten Besuch gibst du deinen gewünschten Benutzernamen ein.

### Spielmodi

#### 🤖 Bot-Modus
- Klicke auf "Gegen Bot spielen"
- Du wirst zufällig X oder O zugeteilt
- Spiele gegen eine intelligente KI

#### 👥 Multiplayer-Modus
1. Klicke auf "Mehrspieler"
2. Wähle deine Optionen:
   - **Anzahl der Spiele**: 1-50 Matches
   - **Spielmodus**:
     - Normal: Einzelne Spiele ohne Punktezählung
     - Competitive: Serie mit Punktezählung
3. Klicke auf "Gegner suchen"
4. Warte, bis ein Gegner gefunden wird
5. Spielt gegeneinander in Echtzeit

## 🔧 Technologie-Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **WebSocket**: Echtzeit-Kommunikation für Multiplayer
- **Matchmaking**: Queue-basiertes System

## 📁 Projektstruktur

```
TicTacToe/
├── server.js              # Hauptserver
├── gameLogic.js          # Spiellogik
├── botAI.js              # Bot-KI
├── matchmaking.js        # Matchmaking-System
├── package.json          # Dependencies
├── tictactoe.service     # Systemd Service-Datei
├── Caddyfile.example     # Caddy Konfigurationsbeispiel
├── public/
│   ├── index.html        # Frontend HTML
│   ├── style.css         # Styles und Animationen
│   └── game.js           # Frontend JavaScript
└── README.md
```

## 🐛 Troubleshooting

### Service startet nicht

```bash
# Logs anschauen
sudo journalctl -u tictactoe -f

# Service Status prüfen
sudo systemctl status tictactoe
```

### Port bereits in Verwendung

Ändere den Port in der `tictactoe.service` Datei oder setze eine Umgebungsvariable:

```bash
Environment=PORT=8080
```

### WebSocket-Verbindung schlägt fehl

Stelle sicher, dass dein Reverse Proxy WebSockets unterstützt und die Header korrekt weitergeleitet werden (siehe Caddy-Konfiguration).

## 📝 Nützliche Befehle

```bash
# Service starten
sudo systemctl start tictactoe

# Service stoppen
sudo systemctl stop tictactoe

# Service neu starten
sudo systemctl restart tictactoe

# Logs anzeigen
sudo journalctl -u tictactoe -f

# Service-Status
sudo systemctl status tictactoe

# Caddy neu laden
sudo systemctl reload caddy

# Caddy-Status
sudo systemctl status caddy
```

## 📄 Lizenz

ISC

## 👨‍💻 Autor

Erstellt mit ❤️ für Online-Gaming-Fans
