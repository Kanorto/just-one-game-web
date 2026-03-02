const { Client, GatewayIntentBits, Events } = require('discord.js');

class DiscordBot {
    constructor(config, gameState) {
        this.config = config;
        this.gameState = gameState;
        this.linkCodes = gameState.linkCodes;
        this.rooms = gameState.rooms;

        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildVoiceStates
            ]
        });

        this._setupEventHandlers();
        this._startVoiceStateLoop();
    }

    _setupEventHandlers() {
        this.client.once(Events.ClientReady, () => {
            console.log(`[Discord] Logged in as ${this.client.user.tag}`);
        });

        this.client.on(Events.MessageCreate, async (message) => {
            if (message.author.bot) return;

            if (message.content === '!link') {
                await this._handleLinkCommand(message);
            }

            if (message.content === '!unlink') {
                await this._handleUnlinkCommand(message);
            }

            if (message.content === '!status') {
                await this._handleStatusCommand(message);
            }
        });
    }

    async _handleLinkCommand(message) {
        const discordUserId = message.author.id;
        const discordUsername = message.author.username;

        // Generate a unique 6-character code
        const code = this._generateCode();

        // Store the code with a 5-minute expiry
        this.linkCodes.set(code, {
            discordUserId,
            discordUsername,
            timestamp: Date.now()
        });

        // Clean up expired codes
        this._cleanExpiredCodes();

        try {
            await message.author.send(
                `🔗 **Код привязки:** \`${code}\`\n\n` +
                `Введите этот код в игре, нажав на кнопку 🔗 (Discord) в настройках.\n` +
                `Код действителен 5 минут.`
            );
            await message.reply('✅ Код привязки отправлен вам в личные сообщения!');
        } catch (e) {
            await message.reply(
                `🔗 **Ваш код привязки:** \`${code}\`\n` +
                `Введите этот код в игре. Код действителен 5 минут.\n` +
                `_(Не удалось отправить в ЛС, убедитесь что ЛС открыты)_`
            );
        }
    }

    async _handleUnlinkCommand(message) {
        const discordUserId = message.author.id;
        let unlinked = false;

        this.rooms.forEach((roomState) => {
            const links = roomState.room.discordLinks || {};
            Object.keys(links).forEach(gameUserId => {
                if (links[gameUserId] === discordUserId) {
                    delete links[gameUserId];
                    unlinked = true;
                }
            });
        });

        if (unlinked) {
            await message.reply('✅ Вы отвязаны от игровых аккаунтов.');
        } else {
            await message.reply('ℹ️ Вы не привязаны ни к одному игровому аккаунту.');
        }
    }

    async _handleStatusCommand(message) {
        const discordUserId = message.author.id;
        let linkedRooms = [];

        this.rooms.forEach((roomState, roomId) => {
            const links = roomState.room.discordLinks || {};
            Object.keys(links).forEach(gameUserId => {
                if (links[gameUserId] === discordUserId) {
                    const name = roomState.room.playerNames[gameUserId] || gameUserId;
                    linkedRooms.push(`Комната \`${roomId}\` (как ${name})`);
                }
            });
        });

        if (linkedRooms.length > 0) {
            await message.reply(`🔗 **Ваши привязки:**\n${linkedRooms.join('\n')}`);
        } else {
            await message.reply('ℹ️ Вы не привязаны ни к одной комнате. Используйте `!link` для привязки.');
        }
    }

    _generateCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for (let attempt = 0; attempt < 10; attempt++) {
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            if (!this.linkCodes.has(code)) return code;
        }
        // Fallback: use timestamp-based code
        return Date.now().toString(36).toUpperCase().slice(-6);
    }

    _cleanExpiredCodes() {
        const now = Date.now();
        const EXPIRY = 5 * 60 * 1000; // 5 minutes
        for (const [code, data] of this.linkCodes) {
            if (now - data.timestamp > EXPIRY) {
                this.linkCodes.delete(code);
            }
        }
    }

    _startVoiceStateLoop() {
        // Periodically update Discord voice states based on game state
        setInterval(() => {
            this._updateVoiceStates();
        }, 1000);
    }

    async _updateVoiceStates() {
        if (!this.client.isReady()) return;

        const guild = this.client.guilds.cache.get(this.config.guildId);
        if (!guild) return;

        for (const [, roomState] of this.rooms) {
            const room = roomState.room;
            if (!room || !room.discordLinks) continue;

            const userDeaf = room.userDeaf || {};
            const discordLinks = room.discordLinks;

            for (const gameUserId of Object.keys(discordLinks)) {
                const discordUserId = discordLinks[gameUserId];
                if (!discordUserId) continue;

                try {
                    const member = guild.members.cache.get(discordUserId);
                    if (!member || !member.voice.channel) continue;

                    const shouldBeDeaf = !!userDeaf[gameUserId];

                    if (member.voice.serverDeaf !== shouldBeDeaf) {
                        await member.voice.setDeaf(shouldBeDeaf, 'Just One - Isolated mode');
                        console.log(`[Discord] ${shouldBeDeaf ? 'Deafened' : 'Undeafened'} ${member.user.username} (game: ${gameUserId})`);
                    }
                } catch (e) {
                    // Silently ignore permission errors etc.
                }
            }
        }
    }

    async start() {
        await this.client.login(this.config.token);
    }
}

module.exports = DiscordBot;
