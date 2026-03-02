/**
 * Standalone stubs for platform-specific globals.
 * Provides: CommonRoom, cs, popup, WordPackSelector, UserAudioMarker, PlayerName,
 *           createHyphenator, hyphenationPatternsRu, window.socket setup
 */

// --- classnames utility ---
window.cs = function () {
    var classes = [];
    for (var i = 0; i < arguments.length; i++) {
        var arg = arguments[i];
        if (!arg) continue;
        var argType = typeof arg;
        if (argType === 'string' || argType === 'number') {
            classes.push(arg);
        } else if (Array.isArray(arg)) {
            classes.push(cs.apply(null, arg));
        } else if (argType === 'object') {
            for (var key in arg) {
                if (arg.hasOwnProperty(key) && arg[key]) {
                    classes.push(key);
                }
            }
        }
    }
    return classes.join(' ');
};

// --- Popup system (uses native browser dialogs) ---
window.popup = {
    alert: function (opts) {
        alert(opts.content || opts);
    },
    confirm: function (opts, callback) {
        var result = confirm(opts.content || opts);
        if (callback) callback({ proceed: result });
    },
    prompt: function (opts, callback) {
        var result = prompt(opts.content || opts, opts.value || '');
        if (callback) callback({ proceed: result !== null && result !== '', input_value: result || '' });
    }
};

// --- Hyphenation (pass-through) ---
window.createHyphenator = function () {
    return function (text) { return text; };
};
window.hyphenationPatternsRu = {};

// --- CommonRoom class/component ---

// Pre-initialize global commonRoom so Avatar etc. can use it before mounting
window.commonRoom = {
    _state: {},
    getPlayerName: function (userId) {
        var names = (this._state && this._state.playerNames) || {};
        return names[userId] || userId;
    },
    getPlayerAvatarURL: function (player) {
        if (this._state && this._state.playerAvatars && this._state.playerAvatars[player]) {
            return '/just-one/avatars/' + player + '/' + this._state.playerAvatars[player] + '.png';
        }
        return null;
    },
    subscribeOrKonfaPopup: function () {},
    handleClickSetImage: function () {}
};

window.CommonRoom = class CommonRoom extends React.Component {
    static roomInit(component) {
        return {};
    }

    static processCommonRoom(state, oldState, opts, component) {
        // Update the global commonRoom state reference
        window.commonRoom._state = state;
    }

    componentDidMount() {
        // Update methods to use React component's props
        var self = this;
        window.commonRoom.getPlayerName = function (userId) {
            var state = self.props.state || {};
            var names = state.playerNames || {};
            return names[userId] || userId;
        };
        window.commonRoom.getPlayerAvatarURL = function (player) {
            var state = self.props.state || {};
            if (state.playerAvatars && state.playerAvatars[player]) {
                return '/just-one/avatars/' + player + '/' + state.playerAvatars[player] + '.png';
            }
            return null;
        };
    }

    render() {
        return null;
    }
};

// --- WordPackSelector component ---
window.WordPackSelector = class WordPackSelector extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            packList: [],
            showModal: false,
            customWords: ''
        };
    }

    componentDidMount() {
        var self = this;
        var socket = window.socket;
        if (socket) {
            socket.on('words-pack-list', function (list) {
                self.setState({ packList: list || [], showModal: true });
            });
        }
    }

    handleOpenPacks() {
        window.socket && window.socket.emit('words-pack-list');
    }

    handleSelectPack(packName) {
        window.socket && window.socket.emit('setup-words-preset', packName);
        this.setState({ showModal: false });
    }

    handleUnsetPack() {
        window.socket && window.socket.emit('unset-words');
    }

    handleSubmitCustomWords() {
        var text = this.state.customWords.trim();
        if (text) {
            var words = text.split('\n').map(function (w) { return w.trim(); }).filter(Boolean);
            if (words.length > 0) {
                window.socket && window.socket.emit('setup-words', 'Пользовательский', words);
                this.setState({ showModal: false, customWords: '' });
            }
        }
    }

    render() {
        var data = this.props.data || {};
        var isHost = data.hostId === data.userId;
        var inProcess = data.phase !== 0 && !data.paused;

        if (!isHost && !data.packName) return null;

        return React.createElement('div', { className: 'word-pack-selector' },
            data.packName
                ? React.createElement('div', { className: 'custom-pack-name', style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' } },
                    React.createElement('i', { className: 'material-icons', style: { fontSize: '18px' } }, 'library_books'),
                    React.createElement('span', null, data.packName),
                    isHost && !inProcess ? React.createElement('i', {
                        className: 'material-icons settings-button',
                        style: { cursor: 'pointer', fontSize: '18px' },
                        onClick: this.handleUnsetPack.bind(this)
                    }, 'close') : null
                )
                : (isHost && !inProcess
                    ? React.createElement('div', {
                        className: 'settings-button',
                        style: { cursor: 'pointer', padding: '4px 8px', display: 'inline-block' },
                        onClick: this.handleOpenPacks.bind(this)
                    }, 'Выбрать пак слов')
                    : null
                ),
            this.state.showModal
                ? React.createElement('div', {
                    style: {
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', zIndex: 1000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    },
                    onClick: function (e) { if (e.target === e.currentTarget) this.setState({ showModal: false }); }.bind(this)
                },
                    React.createElement('div', {
                        style: {
                            background: '#fff', borderRadius: '8px', padding: '20px',
                            maxWidth: '400px', width: '90%', maxHeight: '80vh', overflow: 'auto'
                        }
                    },
                        React.createElement('h3', { style: { marginTop: 0 } }, 'Паки слов'),
                        this.state.packList.length > 0
                            ? this.state.packList.map(function (name) {
                                return React.createElement('div', {
                                    key: name,
                                    style: {
                                        padding: '8px 12px', margin: '4px 0', cursor: 'pointer',
                                        border: '1px solid #ddd', borderRadius: '4px',
                                        background: '#f9f9f9'
                                    },
                                    onClick: this.handleSelectPack.bind(this, name)
                                }, name);
                            }.bind(this))
                            : React.createElement('p', { style: { color: '#888' } }, 'Нет доступных паков'),
                        React.createElement('hr'),
                        React.createElement('h4', null, 'Свои слова'),
                        React.createElement('textarea', {
                            id: 'custom-word-area',
                            style: { width: '100%', height: '100px', marginBottom: '8px' },
                            placeholder: 'Введите слова, по одному на строку...',
                            value: this.state.customWords,
                            onChange: function (e) { this.setState({ customWords: e.target.value }); }.bind(this)
                        }),
                        React.createElement('button', {
                            style: { width: '100%', padding: '8px', cursor: 'pointer' },
                            onClick: this.handleSubmitCustomWords.bind(this)
                        }, 'Применить'),
                        React.createElement('button', {
                            style: { width: '100%', padding: '8px', marginTop: '4px', cursor: 'pointer' },
                            onClick: function () { this.setState({ showModal: false }); }.bind(this)
                        }, 'Закрыть')
                    )
                )
                : null
        );
    }
};

// --- UserAudioMarker component ---
window.UserAudioMarker = class UserAudioMarker extends React.Component {
    render() {
        var user = this.props.user;
        var data = this.props.data || {};
        var linked = data.discordLinks && data.discordLinks[user];
        if (linked) {
            return React.createElement('span', {
                className: 'user-audio-marker-elem',
                style: { display: 'inline-block', width: 6, height: 6, borderRadius: '50%', marginRight: 2 },
                title: 'Discord linked'
            });
        }
        return null;
    }
};

// --- PlayerName component ---
window.PlayerName = class PlayerName extends React.Component {
    render() {
        var data = this.props.data || {};
        var id = this.props.id;
        var names = data.playerNames || {};
        return names[id] || id;
    }
};

// --- Socket.IO setup ---
(function () {
    var gameSocket = io('/just-one');

    // Provide window.socket with .of() support
    window.socket = gameSocket;

    // Add .of() method to return the same socket (standalone has single namespace)
    gameSocket.of = function () {
        return gameSocket;
    };
})();
