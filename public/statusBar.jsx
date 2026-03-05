//import React from "react";
//import ReactDOM from "react-dom"
//import Avatar from '../avatar.jsx'

class ProgressBar extends React.Component {
    componentDidMount() {
        this.timerSound = new Audio("/just-one/tick.mp3");
        this.timerSound.volume = 0.4;
        const {timed, time} = this.props.data;
        if (timed && time !== null) {
            this.updateTimer(time);
        }
        this.props.setPhase2(() => this.progressBarUpdate(0, 100));
    }

    updateTimer(time) {
        const data = this.props.data
        const timeTotal = {
            1: data.playerTime,
            2: data.teamTime,
            3: data.masterTime,
            4: data.revealTime,
        }[data.phase] * 1000;
        this.progressBarUpdate(timeTotal - time, timeTotal);
    }

    progressBarUpdate(x, outOf) {
        const percent = (1 - x / outOf) * 100 + '%'
        const ratio = 1 - x / outOf;
        const barNode = document.getElementById('timer-progress-bar');
        if (barNode) {
            barNode.style.width = percent;
            barNode.classList.remove('timer-warning', 'timer-danger');
            if (ratio <= 0.15) {
                barNode.classList.add('timer-danger');
            } else if (ratio <= 0.35) {
                barNode.classList.add('timer-warning');
            }
        }
    }

    render() {
        const {data, setTime} = this.props;

        clearTimeout(this.timerTimeout);
        if (data.phase !== 0 && data.timed) {
            let timeStart = new Date();
            this.timerTimeout = setTimeout(() => {
                if (data.timed && !data.paused) {
                    let prevTime = data.time,
                        time = prevTime - (new Date - timeStart);
                    setTime(time);
                    this.updateTimer(time);
                    if (![2, 4].includes(data.phase) && data.timed && time < 5000
                        && ((Math.floor(prevTime / 1000) - Math.floor(time / 1000)) > 0) && !parseInt(localStorage.muteSounds))
                        this.timerSound.play();
                }
                if (!data.timed)
                    this.updateTimer(0);
            }, 1000);
        }

        return (
            <div id="timer-progress-bar"/>
        )
    }
}

class ReadyBtn extends React.Component {

    toggleReady() {
        this.props.socket.emit("toggle-ready");
    }

    render() {
        const {isReady} = this.props;
        return (
            <div
                className={cs('ready-button', {isReady})}
                onClick={() => this.toggleReady()}
            >
                <i className="material-icons">fast_forward</i>
            </div>
        )
    }
}

class AcceptBtn extends React.Component {

    voteAccept() {
        this.props.socket.emit("vote-accept");
    }

    render() {
        const {playerAcceptVotes, playerAccepted, players} = this.props;
        const playerAcceptedText = playerAcceptVotes.length > 0
            ? `(${playerAcceptVotes.length}/${Math.ceil(players.length / 2)}) `
            : ``;
        return (
            <div
                className={cs('accept-button', {playerAccepted})}
                onClick={() => !playerAccepted && this.voteAccept()}
            >
                Принять {playerAcceptedText}<i className="material-icons">thumb_up</i>
            </div>
        )
    }
}

class Title extends React.Component {
    render() {
        return (
            <div className="title">
                {this.props.text}
            </div>
        )
    }
}

class Subtitle extends React.Component {
    render() {
        const {text, readyBtn} = this.props;
        return (
            <div className="subtitle">
                {text} {readyBtn}
            </div>
        )
    }
}

class ClosedWord extends React.Component {
    render() {
        const {text, mistake} = this.props;
        return (
            <div className={cs("card closed-word", {mistake, back: !mistake && text == null})}>
                {(text != null || mistake)
                    ? <div>{window.hyphenate(text ? text : `(${t("empty")})`)}</div>
                    : <div className="card-logo"/>}
                {this.props.children}
            </div>
        )
    }
}

//TODO: don't let spectators input
class HintForm extends React.Component {
    addHint() {
        this.props.socket.emit("add-hint", document.getElementById("hint-input").value);
    }

    onKeyDown(evt) {
        !evt.stopPropagation() && evt.key === "Enter" && this.addHint()
    }

    render() {
        const {data} = this.props;
        const {userId, closedWord, master, rounds} = data;
        return (
            <div className="hint-form">
                <div className="hint-cont">
                    <div
                        className="card hint"
                        style={Messy.getStyle(rounds + '_' + 'input')}
                    >
                        <input
                            id="hint-input"
                            type="text"
                            autoComplete="off"
                            autoFocus="true"
                            onKeyDown={(evt) => this.onKeyDown(evt)}
                        />
                        <div className="bl-corner">
                            <Avatar data={data} player={userId}/>
                        </div>
                        <div className="br-corner">
                            <div
                                className="add-command-button"
                                onClick={() => this.addHint()}
                            >
                                <i className="material-icons">send</i>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="avatar-arrow">
                    <Avatar data={data} player={master}/>
                </div>
                <ClosedWord text={closedWord}/>
            </div>
        )
    }
}

class MasterTarget extends React.Component {
    render() {
        const {data} = this.props;
        const {master, closedWord} = data;
        return (
            <div className="master-target">
                <ClosedWord text={closedWord}/>
                <div className="master-avatar">
                    <Avatar data={data} player={master}/>
                </div>
            </div>
        )
    }
}

class ClosedWordForm extends React.Component {
    guessWord() {
        this.props.socket.emit("guess-word", document.getElementById("closed-word-input").value);
    }

    onKeyDown(evt) {
        !evt.stopPropagation() && evt.key === "Enter" && this.guessWord()
    }

    render() {
        const {data} = this.props;
        const {userId} = data;

        return (
            <div className="card closed-word">
                <input
                    id="closed-word-input"
                    type="text"
                    autoComplete="off"
                    autoFocus="true"
                    onKeyDown={(evt) => this.onKeyDown(evt)}
                />
                <div className="bl-corner">
                    <Avatar data={data} player={userId}/>
                </div>
                <div className="br-corner">
                    <div
                        className="add-command-button"
                        onClick={() => this.guessWord()}
                    >
                        <i className="material-icons">send</i>
                    </div>
                </div>
            </div>
        )
    }
}


//TODO: add points and other data
class ClosedWordResult extends React.Component {
    render() {
        const {data} = this.props;
        const {wordGuessed, guessedWord, wordAccepted, word, master, scoreChanges} = data;

        if (wordGuessed || wordAccepted) {
            return (
                <ClosedWord text={wordGuessed ? word : guessedWord}>
                    <div className="tl-corner">
                        <div className="score-change">
                            {'+' + scoreChanges[master]}
                        </div>
                    </div>
                    <div className="bl-corner">
                        <Avatar data={data} player={master}/>
                    </div>
                </ClosedWord>
            )
        }
        return (
            <div className="closed-word-result">
                <ClosedWord text={word}/>
                <ClosedWord text={guessedWord} mistake={true}>
                    <div className="bl-corner">
                        <Avatar data={data} player={master}/>
                    </div>
                </ClosedWord>
            </div>
        )
    }
}

class StatusBar extends React.Component {
    render() {
        const {data, socket, setTime, setPhase2} = this.props;
        const {
            phase, players, playerWin, timed, time, userId,
            master, readyPlayers, playerNames, wordGuessed, wordAccepted, playerAcceptVotes, noHints
        } = data;
        const playerAccepted = playerAcceptVotes.includes(userId);
        const isMaster = userId === master;
        const isReady = readyPlayers.includes(userId);
        const isPlayer = players.includes(userId);

        const enoughText = (players.length > 2)
            ? t('Host can start game')
            : t('Not enough players (minimum 3)');

        let content
        let subtitle = null
        let hasReady = false
        let hasAccept = false
        if (phase === 0 && !playerWin) {
            content = <MasterTarget data={data}/>;
            subtitle = enoughText;
        } else if (phase === 1) {
            if (isMaster) {
                content = <MasterTarget data={data}/>;
                subtitle = t("Wait for players to write their hints");
            } else if (isReady) {
                content = <MasterTarget data={data}/>;
                subtitle = t("Wait for players to write their hints");
            } else if (isPlayer) {
                content = <HintForm data={data} socket={socket}/>;
                subtitle = t("Write your hint");
            } else {
                content = <MasterTarget data={data}/>;
                subtitle = t("Wait for players to write their hints");
            }
        } else if (phase === 2) {
            if (isMaster) {
                content = <MasterTarget data={data}/>;
                subtitle = t("Wait for players to delete duplicates");
            } else {
                content = <MasterTarget data={data}/>;
                subtitle = t("Delete duplicates");
                hasReady = isPlayer;
            }
        } else if (phase === 3) {
            if (isMaster) {
                content = <ClosedWordForm data={data} socket={socket}/>;
                subtitle = t("Now try guess the original word");
            } else {
                content = <MasterTarget data={data}/>;
                subtitle = t('Now ') + window.commonRoom.getPlayerName(master) + t(' should guess original word');
            }
        } else if (phase === 4) {
            content = <ClosedWordResult data={data}/>;
            subtitle = t("Next round");
            hasReady = isPlayer;
            hasAccept = !wordGuessed && !wordAccepted && !noHints;
        } else if (phase === 0 && playerWin) {
            content = <div className="player-win">
                <Avatar data={data} player={playerWin}/>
                <Title text={t('The winner is') + ' ' + window.commonRoom.getPlayerName(playerWin) + '!'}/>
            </div>;
            subtitle = enoughText;
        }

        return (
            <div className="status-bar-wrap">
                <div className="status-bar">
                    {phase !== 0 && <div className="round-counter">{t("round")} {data.rounds}</div>}
                    <div className="aligner">
                        {content}
                    </div>
                    {subtitle && <div className="subtitle">{subtitle}</div>}
                    {hasReady && <ReadyBtn isReady={isReady} socket={socket}/>}
                    {hasAccept && <AcceptBtn playerAcceptVotes={playerAcceptVotes}
                                             playerAccepted={playerAccepted}
                                             players={players}
                                             socket={socket}/>}
                    {timed && time !== null && (
                        <ProgressBar data={data} setPhase2={setPhase2} setTime={setTime}/>
                    )}
                </div>
            </div>
        )
    }
}

