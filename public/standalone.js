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
    handleClickSetImage: function (type) {
        if (type !== 'avatar') return;
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/gif,image/webp';
        input.onchange = function () {
            if (!input.files || !input.files[0]) return;
            var file = input.files[0];
            if (file.size > 256 * 1024) {
                alert('Image too large. Max 256KB.');
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                window.socket.emit('upload-avatar', reader.result);
            };
            reader.readAsArrayBuffer(file);
        };
        input.click();
    }
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
    render() {
        return null;
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
