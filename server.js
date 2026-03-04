const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

// --- Configuration ---
let config = { port: 3000 };
try {
    config = Object.assign(config, JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')));
} catch (e) {
    console.log('[Server] No config.json found, using defaults. Copy config.example.json to config.json to configure.');
}

const PORT = process.env.PORT || config.port || 3000;

// --- Environment variable overrides (for Railway/Docker) ---
if (process.env.DISCORD_TOKEN || process.env.DISCORD_GUILD_ID) {
    config.discord = config.discord || {};
    if (process.env.DISCORD_TOKEN) config.discord.token = process.env.DISCORD_TOKEN;
    if (process.env.DISCORD_GUILD_ID) config.discord.guildId = process.env.DISCORD_GUILD_ID;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// --- Page routes (registered before static middleware) ---
const pendingPageRoutes = [];
const pageHtmlCache = new Map();

// Register page routes as early middleware
app.use((req, res, next) => {
    for (const route of pendingPageRoutes) {
        if (req.url === route.gamePath || req.url === route.gamePath + '/') {
            if (!pageHtmlCache.has(route.htmlPath)) {
                pageHtmlCache.set(route.htmlPath, fs.readFileSync(route.htmlPath, 'utf8'));
            }
            const html = pageHtmlCache.get(route.htmlPath).replace(/%startTime%/g, Date.now());
            return res.type('html').send(html);
        }
    }
    next();
});

// --- Serve frontend dependencies from node_modules ---
const vendorDir = path.join(__dirname, 'node_modules');
app.get('/vendor/react.js', (req, res) => {
    res.sendFile(path.join(vendorDir, 'react/umd/react.development.js'));
});
app.get('/vendor/react-dom.js', (req, res) => {
    res.sendFile(path.join(vendorDir, 'react-dom/umd/react-dom.development.js'));
});
app.get('/vendor/babel.min.js', (req, res) => {
    res.sendFile(path.join(vendorDir, '@babel/standalone/babel.min.js'));
});
app.use('/vendor/material-icons', express.static(path.join(vendorDir, 'material-icons/iconfont')));

// --- Shared state for Discord linking ---
const linkCodes = new Map(); // code -> { discordUserId, discordUsername, timestamp }
let discordBotActive = false;

// --- User socket tracking ---
const userSockets = new Map(); // userId -> socket

// --- Room management ---
const rooms = new Map(); // roomId -> GameState instance

// --- RoomState base class (mimics platform's RoomState) ---
class RoomState extends EventEmitter {
    constructor(hostId, hostData, userRegistry, gameId, gamePath) {
        super();
        this.room = {
            visibilityType: "open",
            voiceEnabled: discordBotActive,
            konfaMode: true,
            authUsers: {}
        };
        this.eventHandlers = {};
    }

    disableKonfaMode() {
        this.room.konfaMode = false;
    }
}

// --- Registry (mimics platform's user registry) ---
const registry = {
    config: {
        appDir: __dirname
    },
    games: {
        justOne: { id: 'justOne' }
    },
    handleAppPage: (gamePath, htmlPath) => {
        // Store for later - routes will be registered as middleware
        pendingPageRoutes.push({ gamePath, htmlPath });
    },
    send: (target, event, data) => {
        if (target && typeof target.forEach === 'function') {
            target.forEach(userId => {
                const socket = userSockets.get(userId);
                if (socket) socket.emit(event, data);
            });
        } else if (typeof target === 'string') {
            const socket = userSockets.get(target);
            if (socket) socket.emit(event, data);
        }
    },
    authUsers: {
        processAchievement: () => {}
    },
    achievements: {
        win100JustOne: { id: 'win100JustOne' },
        winGames: { id: 'winGames' },
        justOneJustOne: { id: 'justOneJustOne' }
    },
    log: (msg) => console.log('[Game]', msg),
    linkCodes: linkCodes,
    RoomState: RoomState,
    createRoomManager: (gamePath, GameStateClass) => {
        const gameNamespace = io.of(gamePath);

        gameNamespace.on('connection', (socket) => {
            let currentRoom = null;
            let currentUserId = null;
            let currentRoomId = null;

            socket.on('init', (data) => {
                const { roomId, userId, userName } = data;
                currentUserId = userId;
                currentRoomId = roomId;
                userSockets.set(userId, socket);

                if (!rooms.has(roomId)) {
                    const room = new GameStateClass(userId, data, registry);
                    rooms.set(roomId, room);

                    room.on('user-kicked', (kickedUserId) => {
                        const kickedSocket = userSockets.get(kickedUserId);
                        if (kickedSocket) {
                            kickedSocket.emit('message', 'Вы были удалены из комнаты');
                        }
                    });

                    room.on('host-changed', (oldHost, newHost) => {
                        console.log(`[Room ${roomId}] Host changed: ${oldHost} -> ${newHost}`);
                    });
                }

                currentRoom = rooms.get(roomId);
                currentRoom.userJoin(data);
            });

            socket.on('upload-avatar', (imageData) => {
                if (!currentUserId || !currentRoom || !imageData) return;
                if (!/^[a-z0-9]+$/.test(currentUserId)) return;
                const MAX_AVATAR_SIZE = 256 * 1024; // 256KB
                const buf = Buffer.isBuffer(imageData)
                    ? imageData
                    : (imageData instanceof ArrayBuffer || (imageData && imageData.byteLength !== undefined))
                        ? Buffer.from(imageData)
                        : null;
                if (!buf || buf.length === 0 || buf.length > MAX_AVATAR_SIZE) {
                    socket.emit('message', 'Avatar upload failed: file too large or invalid');
                    return;
                }
                // Validate image magic bytes (PNG, JPEG, GIF, WEBP)
                const isImage = (buf[0] === 0x89 && buf[1] === 0x50) // PNG
                    || (buf[0] === 0xFF && buf[1] === 0xD8) // JPEG
                    || (buf[0] === 0x47 && buf[1] === 0x49) // GIF
                    || (buf[0] === 0x52 && buf[1] === 0x49 && buf[8] === 0x57); // WEBP
                if (!isImage) {
                    socket.emit('message', 'Avatar upload failed: unsupported image format');
                    return;
                }
                const avatarId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                const avatarDir = path.join(__dirname, 'public', 'avatars', currentUserId);
                fs.mkdir(avatarDir, { recursive: true }, (err) => {
                    if (err) {
                        socket.emit('message', 'Avatar upload failed');
                        return;
                    }
                    fs.writeFile(path.join(avatarDir, avatarId + '.png'), buf, (err) => {
                        if (err) {
                            socket.emit('message', 'Avatar upload failed');
                            return;
                        }
                        currentRoom.userEvent(currentUserId, 'update-avatar', [avatarId]);
                        socket.emit('avatar-uploaded', avatarId);
                    });
                });
            });

            socket.onAny((event, ...args) => {
                if (event === 'init' || event === 'upload-avatar') return;
                if (currentRoom && currentUserId) {
                    currentRoom.userEvent(currentUserId, event, args);
                }
            });

            socket.on('disconnect', () => {
                if (currentRoom && currentUserId) {
                    currentRoom.userLeft(currentUserId);
                    userSockets.delete(currentUserId);

                    // Clean up empty rooms after a delay
                    setTimeout(() => {
                        if (currentRoom && currentRoom.getActivePlayerCount() === 0) {
                            rooms.delete(currentRoomId);
                            console.log(`[Room ${currentRoomId}] Removed (empty)`);
                        }
                    }, 60000);
                }
            });
        });
    }
};

// Self-reference for registry.users pattern
registry.users = registry;

// --- wsServer interface ---
const wsServer = {
    app: app,
    static: express.static,
    users: registry
};

// --- Initialize the game module ---
const initGame = require('./module');
initGame(wsServer, '/just-one');

// --- Link code API for Discord bot ---
app.get('/api/link-codes', (req, res) => {
    const result = {};
    linkCodes.forEach((value, key) => {
        result[key] = value;
    });
    res.json(result);
});

// --- Expose shared state for Discord bot ---
const gameState = {
    rooms,
    linkCodes,
    userSockets,
    registry
};

// --- Start Discord bot if configured ---
let discordBot = null;
if (config.discord && config.discord.token && config.discord.token !== 'YOUR_DISCORD_BOT_TOKEN') {
    try {
        const DiscordBot = require('./discord-bot');
        discordBot = new DiscordBot(config.discord, gameState);
        discordBot.start().then(() => {
            console.log('[Discord] Bot started successfully');
            discordBotActive = true;
            // Enable voice for existing rooms
            rooms.forEach(room => {
                room.room.voiceEnabled = true;
            });
        }).catch(err => {
            console.error('[Discord] Failed to start bot:', err.message);
        });
    } catch (e) {
        console.error('[Discord] Failed to load discord-bot module:', e.message);
    }
} else {
    console.log('[Discord] Bot not configured. Set discord.token in config.json to enable.');
}

// --- Start server ---
server.listen(PORT, () => {
    console.log(`[Server] Just One game running at http://localhost:${PORT}/just-one`);
    console.log(`[Server] Debug mode: ${process.argv[2] === 'debug' ? 'ON (1 player minimum)' : 'OFF (3 players minimum)'}`);
});

module.exports = { app, server, gameState };
