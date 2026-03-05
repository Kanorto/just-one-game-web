//import React from "react";
//import ReactDOM from "react-dom"
//import Avatar from '../avatar.jsx'

class PlayerHostControls extends React.Component {
    removePlayer(id, evt) {
        evt.stopPropagation();
        popup.confirm(
            {content: `Removing ${window.commonRoom.getPlayerName(id)}?`},
            (evt) => evt.proceed && this.props.socket.emit("remove-player", id)
        );
    }

    giveHost(id, evt) {
        evt.stopPropagation();
        popup.confirm(
            {content: `Give host ${window.commonRoom.getPlayerName(id)}?`},
            (evt) => evt.proceed && this.props.socket.emit("give-host", id))
        ;
    }

    render() {
        const
            data = this.props.data,
            id = this.props.id;
        return (
            <div className="player-host-controls">
                {(data.hostId === data.userId && data.userId !== id) ? (
                    <i className="material-icons host-button"
                       title="Give host"
                       onClick={(evt) => this.giveHost(id, evt)}>
                        vpn_key
                    </i>) : ""}
                {(data.hostId === data.userId && data.userId !== id) ? (
                    <i className="material-icons host-button"
                       title="Remove"
                       onClick={(evt) => this.removePlayer(id, evt)}>
                        delete_forever
                    </i>) : ""}
                {(data.hostId === id) ? (
                    <i className="material-icons host-button inactive"
                       title="Game host">
                        stars
                    </i>
                ) : ""}
            </div>
        )
    }
}

class Player extends React.Component {

    clickSaveAvatar() {
        window.commonRoom.handleClickSetImage('avatar');
    }


    render() {
        const {data, socket, id} = this.props;
        const {master, readyPlayers} = data;
        const isReady = readyPlayers.includes(id);
        const isMaster = id === master;

        return (
            <div className={cs("player", {
                ready: isReady && !isMaster,
                offline: !~data.onlinePlayers.indexOf(id),
                self: id === data.userId,
                master: isMaster,
            })} onTouchStart={(e) => e.target.focus()}>
                <div className="player-inner">
                    <div className="player-avatar-section"
                         onTouchStart={(e) => e.target.focus()}
                         onClick={() => (id === data.userId) && this.clickSaveAvatar()}>
                        <Avatar data={data} player={id}/>
                        {id === data.userId ? (<i className="change-avatar-icon material-icons" title="Change avatar">
                            edit
                        </i>) : ""}
                    </div>
                    <div className="player-name-section">
                        <UserAudioMarker user={id} data={data} socket={socket}/>
                        <span className="player-name">
                            <PlayerName data={data} id={id} />
                        </span>
                        &nbsp;
                        <PlayerHostControls id={id} data={data} socket={socket}/>
                        <span className="spacer"/>
                        <span className="score-cont">
                            <span className="score">
                                {data.playerScores[id] || 0}
                            </span>
                        </span>
                    </div>
                </div>
            </div>
        );
    }
}

class PlayerList extends React.Component {

    joinPlayersClick(evt) {
        evt.stopPropagation();
        if (!this.props.data.teamsLocked)
            this.props.socket.emit("players-join");
    }

    render() {
        const
            socket = this.props.socket,
            data = this.props.data;
        return (
            <div className="player-list-section">
                <div className="player-list">
                    {data.players.map((id => (
                        <Player key={id} data={data} id={id} socket={socket}/>
                    )))}
                    {!data.players.includes(data.userId) && (
                        <div
                            className="player join-button"
                            onClick={(evt) => this.joinPlayersClick(evt)}
                        >
                            <div className="player-inner">
                                <div className="player-avatar-section">
                                    <div className="avatar"/>
                                </div>
                                <div className="player-name-section">
                                <span className="player-name">
                                    {t('Enter')}
                                </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

class Spectator extends React.Component {
    render() {
        const
            data = this.props.data,
            socket = this.props.socket,
            id = this.props.id;
        return (
            <span className={cs("spectator", {self: id === data.userId})}>
                &nbsp;{(data.voiceEnabled || data.discordMute) ? <UserAudioMarker user={id} data={data} socket={socket}/> : "●"}&nbsp;
                <span className="spectator-name"><PlayerName data={data} id={id} /></span>
                &nbsp;
                <PlayerHostControls id={id} data={data} socket={socket}/>
            </span>
        )
    }
}

class SpectatorList extends React.Component {
    joinSpectatorsClick(evt) {
        evt.stopPropagation();
        if (!this.props.data.teamsLocked)
            this.props.socket.emit("spectators-join");
    }

    render() {
        const
            data = this.props.data,
            socket = this.props.socket,
            empty = !data.spectators.length;
        return (
            <div className="spectator-placeholder">
                <div className={cs('spectators-section')}>
                    <div
                        className={cs("spectators", {empty: empty})}
                        onClick={(evt) => this.joinSpectatorsClick(evt)}
                    >
                        {t('Spectators')}:{empty && ' ...'}
                        {data.spectators.map((id => (
                            <Spectator key={id} data={data} id={id} socket={socket}/>
                        )))}
                    </div>
                </div>
            </div>
        )
    }
}
