
let roomId = null;

window.addEventListener("load", () => {
    document.title = getLocalized("titlebar");
    const params = new URLSearchParams(window.location.search);
    roomId = params.get("id");
    if(!roomId) {
        return exitPage();
    }
    if(!localStorage.username) {
        setTimeout(() => {
            window.location.href = `/join?id=${roomId}`;
        }, 100);
    }
    const copyInvLink = document.getElementById("copy-invite-link");
    copyInvLink.onclick = () => {
        const origin = window.location.origin;
        navigator.clipboard.writeText(`${origin}/join?id=${roomId}`);
        const prevText = copyInvLink.innerHTML;
        copyInvLink.style.width = `${copyInvLink.offsetWidth}px`;
        copyInvLink.innerHTML = getLocalized("inviteLinkCopied");
        copyInvLink.disabled = true;
        setTimeout(() => {
            copyInvLink.innerHTML = prevText;
            copyInvLink.disabled = false;
        }, 1000);
    };
    connectWebsocket(roomId, localStorage.username);
    const chatMessageInput = document.getElementById("chat-message-input");
    const chatMessageSend = document.getElementById("chat-message-send");
    const sendTextMessage = () => {
        if(!socket) { return; }
        socket.send(JSON.stringify({
            type: "chat_message",
            contents: chatMessageInput.value
        }));
        chatMessageInput.value = "";
    };
    chatMessageSend.onclick = sendTextMessage;
    chatMessageInput.addEventListener("keyup", e => {
        if(e.key !== "Enter") { return; }
        sendTextMessage();
    });
});

let exitingPage = false;
function exitPage() {
    exitingPage = true;
    setTimeout(() => {
        window.location.href = "/";
    }, 100);
}

let isReady = false;
let roomIsPlaying = null;
let isPlaying = false;

function showWaiting() {
    isReady = false;
    isPlaying = false;
    document.getElementById("game-page").style.display = "none";
    document.getElementById("waiting-page").style.display = "block";
}

function updateWaiting(players) {
    const playerList = document.getElementById("waiting-player-list");
    playerList.innerHTML = "";
    for(const player of players) {
        const name = document.createElement("span");
        name.innerText = player.name;
        const isReady = document.createElement("span");
        isReady.classList.add(
            player.isReady? "player-status-ready" : "player-status-not-ready"
        );
        isReady.innerText = getLocalized(
            player.isReady? "playerReady" : "playerNotReady"
        );
        const playerCont = document.createElement("div");
        playerCont.classList.add("player-info-container");
        playerCont.appendChild(name);
        if(player.id === roomOwnerId) {
            const isOwner = document.createElement("img");
            isOwner.classList.add("player-status-room-owner");
            isOwner.src = "res/settings-gear.svg";
            playerCont.appendChild(isOwner);
        }
        playerCont.appendChild(isReady);
        if(playerId === roomOwnerId) {
            const kickPlayer = document.createElement("button");
            kickPlayer.classList.add("player-kick-button");
            kickPlayer.onclick = () => {
                socket.send(JSON.stringify({
                    type: "kick_player",
                    kickedId: player.id
                }));
            }
            kickPlayer.disabled = player.id === playerId;
            if(player.id !== playerId) {
                const brightIcon = document.createElement("img");
                brightIcon.classList.add("button-icon");
                brightIcon.src = "res/power-off-bright.svg";
                kickPlayer.appendChild(brightIcon);
                const darkIcon = document.createElement("img");
                darkIcon.classList.add("button-icon-hover");
                darkIcon.src = "res/power-off-dark.svg";
                kickPlayer.appendChild(darkIcon);
            } else {
                const disabledIcon = document.createElement("img");
                disabledIcon.src = "res/power-off-disabled.svg";
                kickPlayer.appendChild(disabledIcon);
            }
            playerCont.appendChild(kickPlayer);
        }
        playerList.appendChild(playerCont);
    }
    isReady = isReady && !roomIsPlaying;
    if(roomIsPlaying) { isReady = false; }
    const getReady = document.getElementById("get-ready");
    getReady.disabled = isReady;
    getReady.onclick = () => {
        isReady = true;
        socket.send(JSON.stringify({
            type: "is_ready"
        }));
    };
    updateSettings();
}

const SETTING_PROPERTIES = Object.freeze({
    roomIsPublic: {
        values: [false, true],
        valuesLocalized: "roomSettingVisibilityValues",
        buttonId: "room-setting-is-public",
        buttonClasses: [["setting-negative"], ["setting-positive"]]
    },
    
    trainNameLanguage: {
        values: ["en", "de", "bg"],
        valuesLocalized: "gameSettingTrainNameLanguageValues",
        buttonId: "game-setting-train-name-language",
        buttonClasses: [[], [], []]
    },
    trainNameChanges: {
        values: [false, true],
        valuesLocalized: "gameSettingTrainNameChangesValues",
        buttonId: "game-setting-train-name-changes",
        buttonClasses: [["setting-negative"], ["setting-positive"]]
    },
    variedTrainStyles: {
        values: [false, true],
        valuesLocalized: "gameSettingTrainStylesValues",
        buttonId: "game-setting-varied-train-styles",
        buttonClasses: [["setting-negative"], ["setting-positive"]]
    },
    trainLength: {
        values: ["short", "medium", "long"],
        valuesLocalized: "gameSettingTrainLengthValues",
        buttonId: "game-setting-train-length",
        buttonClasses: [["setting-positive"], [], ["setting-negative"]]
    }
});

let settings = {
    roomIsPublic: false,
    trainNameLanguage: "en",
    trainNameChanges: true,
    variedTrainStyles: true,
    trainLength: "medium"
};

function updateSettings() {
    for(const settingName of Object.keys(SETTING_PROPERTIES)) {
        const settingProps = SETTING_PROPERTIES[settingName];
        const button = document.getElementById(settingProps.buttonId);
        const valueIdx = settingProps.values.indexOf(settings[settingName]);
        // if valueIdx === 0 then valueIdx + 1 will be 0 :)
        const nextValueIdx = (valueIdx + 1) % settingProps.values.length;
        button.innerText = getLocalized(settingProps.valuesLocalized)[valueIdx];
        button.classList.remove(...button.classList);
        button.classList.add(...settingProps.buttonClasses[valueIdx]);
        button.disabled = playerId !== roomOwnerId;
        button.onclick = () => {
            settings[settingName] = settingProps.values[nextValueIdx];
            if(socket) {
                socket.send(JSON.stringify({
                    type: "configure_room",
                    newSettings: settings
                }));
            }
            updateSettings();
        };
    }
}

function showPlaying() {
    document.getElementById("waiting-page").style.display = "none";
    document.getElementById("game-page").style.display = "block";
}

let socket;
let crashed = false;

function connectWebsocket(roomId, username) {
    socket = new WebSocket("wss://localhost:8443/ws/room");
    socket.addEventListener("open", () => {
        socket.send(JSON.stringify({
            type: "join_room",
            roomId: roomId,
            name: username
        }));
        showWaiting();
    });
    socket.addEventListener("message", e => {
        let event;
        try {
            event = JSON.parse(e.data);
        } catch(e) {
            socket.close();
            throw e;
        }
        onSocketEvent(event);
    });
    socket.addEventListener("close", () => {
        if(crashed || exitingPage) { return; }
        crashed = true;
        document.getElementById("client-disconnect-overlay")
            .style.display = "block";
    });
}

let playerId;
let roomOwnerId;

function onSocketEvent(event) {
    switch(event.type) {
        case "invalid_message": {
            console.error(`Server reported invalid message: ${event.reason}`);
            break;
        }
        case "identification": {
            playerId = event.playerId;
            break;
        }
        case "room_info": {
            roomOwnerId = event.owner;
            settings = event.settings;
            const playing = event.state === "playing";
            if(!playing && roomIsPlaying) {
                showWaiting();
            } else if(playing && !roomIsPlaying) {
                isPlaying = roomIsPlaying === false;
                showPlaying();
            }
            roomIsPlaying = playing;
            updateWaiting(event.players);
            break;
        }
        case "room_crashed": {
            crashed = true;
            document.getElementById("room-crashed-overlay")
                .style.display = "block";
            break;
        }
        case "chat_message": {
            const chatLog = document.getElementById("chat-message-list");
            chatLog.innerText += `${event.senderName}: ${event.contents}`;
            chatLog.appendChild(document.createElement("br"));
            chatLog.scrollTop = chatLog.scrollHeight;
            const chatLogNodes = chatLog.childNodes;
            while(chatLogNodes.length > 256 * 2) {
                chatLog.removeChild(chatLogNodes[0]);
            }
            break;
        }
    }
}