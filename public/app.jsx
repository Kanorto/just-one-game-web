//import React from "react";
//import ReactDOM from "react-dom"
//import io from "socket.io"
//import StatusBar from '../statusBar.jsx'
//import Hints from '../hints.jsx'
//import PlayerList, SpectatorList from '../player.jsx'
//import HostControls from '../hostControls.jsx'
//import AvatarSaver from '../avatar.jsx'

function makeId() {
    let text = "";
    const possible = "abcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < 5; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

class Game extends React.Component {

    constructor() {
        super();
        this.state = {
            inited: false
        };
        window.hyphenate = createHyphenator(hyphenationPatternsRu);
    }

    componentDidMount() {
        this.gameName = "justOne";
        const initArgs = CommonRoom.roomInit(this);
        if (!localStorage.justOneUserId) {
            while (!localStorage.userName)
                localStorage.userName = prompt("Your name");
            localStorage.justOneUserId = makeId();
        }
        if (!location.hash)
            history.replaceState(undefined, undefined, location.origin + location.pathname + "#" + makeId());
        else
            history.replaceState(undefined, undefined, location.origin + location.pathname + location.hash);
        if (localStorage.acceptDelete) {
            initArgs.acceptDelete = localStorage.acceptDelete;
            delete localStorage.acceptDelete;
        }
        initArgs.avatarId = localStorage.avatarId;
        initArgs.discordId = localStorage.discordId;
        initArgs.roomId = this.roomId = location.hash.substr(1);
        initArgs.userId = this.userId = localStorage.justOneUserId;
        initArgs.token = this.userToken = localStorage.userToken;
        initArgs.userName = localStorage.userName;
        initArgs.wssToken = window.wssToken;
        this.socket = window.socket.of(location.pathname);
        this.player = {cards: []};
        this.socket.on("state", state => {
            CommonRoom.processCommonRoom(state, this.state, {
                maxPlayers: "∞",
                largeImageKey: "just-one",
                details: "Намёк понял!"
            }, this);
            if (this.state.phase && state.phase !== 0 && !parseInt(localStorage.muteSounds)) {
                if (this.state.master !== this.userId && state.master === this.userId)
                    this.masterSound.play();
                else if (this.state.phase === 1 && state.phase === 2)
                    this.storySound.play();
                else if (this.state.phase === 2 && state.phase === 3)
                    this.revealSound.play();
                else if (state.phase === 2 && this.state.readyPlayers.length !== state.readyPlayers.length)
                    this.tapSound.play();
            }
            if (this.state.inited && this.state.phase !== 2 && state.phase === 2)
                this.phase2StatusBar && this.phase2StatusBar();
            this.setState(Object.assign({
                userId: this.userId
            }, state));
        });
        this.socket.on("player-state", (state) => {
            this.setState(Object.assign(this.state, state));
        });
        this.socket.on("message", text => {
            popup.alert({content: text});
        });
        window.socket.on("disconnect", (event) => {
            this.setState({
                inited: false,
                disconnected: true,
                disconnectReason: event.reason
            });
        });
        this.socket.on("reload", () => {
            setTimeout(() => window.location.reload(), 3000);
        });
        this.socket.on("prompt-delete-prev-room", (roomList) => {
            if (localStorage.acceptDelete =
                prompt(`Limit for hosting rooms per IP was reached: ${roomList.join(", ")}. Delete one of rooms?`, roomList[0]))
                location.reload();
        });
        this.socket.on("subscribe-needed", () => {
            window.commonRoom.subscribeOrKonfaPopup('Пользовательские паки доступны ')
        });
        this.socket.on("discord-linked", (result) => {
            if (result.success) {
                localStorage.discordId = result.discordId;
                popup.alert({content: t("discord linked") + ": " + result.discordUsername});
            } else {
                popup.alert({content: t("discord link failed")});
            }
        });
        this.socket.on("discord-guild-set", (result) => {
            if (result.success) {
                popup.alert({content: t("discord guild set success") + ": " + result.guildName});
            } else {
                const BOT_INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1373254586231423076&scope=bot&permissions=8391680';
                let msg = '';
                if (result.error === 'discord_guild_not_found') {
                    msg = t("discord guild not found") + "\n\n" + t("add bot link") + ":\n" + BOT_INVITE_URL;
                } else if (result.error === 'discord_insufficient_permissions') {
                    msg = t("discord insufficient permissions") + "\n\n" + t("add bot link") + ":\n" + BOT_INVITE_URL;
                } else if (result.error === 'discord_bot_not_active') {
                    msg = t("discord bot not active");
                } else if (result.error === 'invalid_guild_id') {
                    msg = t("invalid discord guild id");
                } else {
                    msg = t("discord guild set failed");
                }
                popup.alert({content: msg});
            }
        });
        this.socket.on("ping", (id) => {
            this.socket.emit("pong", id);
        });
        this.socket.on("avatar-uploaded", (avatarId) => {
            localStorage.avatarId = avatarId;
        });
        document.title = `Just one - ${initArgs.roomId}`;
        this.socket.emit("init", initArgs);
        this.tapSound = new Audio("/just-one/tap.mp3");
        this.tapSound.volume = 0.3;
        this.storySound = new Audio("/just-one/start.mp3");
        this.storySound.volume = 0.4;
        this.revealSound = new Audio("/just-one/reveal.mp3");
        this.revealSound.volume = 0.3;
        this.masterSound = new Audio("/just-one/master.mp3");
        this.masterSound.volume = 0.7;
    }

    setTime(time) {
        this.setState(Object.assign({}, this.state, {time: time}));
    }

    refreshState() {
        this.setState(Object.assign({}, this.state));
    }

    getOptimalWidth({players}) {
        const numCards = players.length - 1;
        const contWidth = window.innerWidth - 20; //approximate
        if (numCards <= 6 || contWidth < 760) {
            return null;
        } else {
            const cardWidth = 210 + 25; //approximate
            const originalNumCols = Math.floor(contWidth / cardWidth);
            const originalNumRows = Math.ceil(numCards / originalNumCols);
            let numRows = originalNumRows;
            let numCols = originalNumCols;
            while (numRows === originalNumRows) {
                numCols-- ;
                numRows = Math.ceil(numCards / numCols);
            };
            numCols++;
            return ({ maxWidth: numCols * cardWidth + 'px' });
        }

    }

    render() {
        if (this.state.disconnected) {
            return (<div className="kicked">
                Disconnected{this.state.disconnectReason ? ` (${this.state.disconnectReason})` : ""}
            </div>);
        } else if (this.state.inited) {
            document.body.classList.add("captcha-solved");
            const
                data = this.state,
                isMaster = data.master === data.userId,
                socket = this.socket;
            return (
                <div className={cs("game", {timed: this.state.timed})}>
                    <CommonRoom state={this.state} app={this}/>
                    <div className={
                        cs("game-board", {
                            active: this.state.inited,
                            isMaster,
                            teamsLocked: data.teamsLocked
                    })}>
                        {data.paused && data.phase !== 0 && (
                            <div className="pause-overlay">
                                <i className="material-icons pause-overlay-icon">pause_circle</i>
                                <div className="pause-overlay-text">{t("paused")}</div>
                            </div>
                        )}
                        <SpectatorList data={data} socket={socket} />
                        <PlayerList data={data} socket={socket}  />
                        <div className="main-row">
                            <StatusBar data={data} socket={socket}
                                setTime={(time) => this.setTime(time)}
                                //Notify about phase 2
                                //https://stackoverflow.com/questions/37949981/call-child-method-from-parent#45582558
                                setPhase2={cb => this.phase2StatusBar = cb}
                            />
                        </div>
                        <div className="main-row" style={this.getOptimalWidth(data)}>
                            <Hints data={data} socket={socket} />
                        </div>
                        <HostControls data={data} socket={socket} app={this}
                            refreshState={() => this.refreshState()}
                        />
                    </div>
                </div>
            );
        } else {
            return (<div/>);
        }
    }
}

ReactDOM.render(<Game/>, document.getElementById('root'));
