
function showRoomError(errorTypeBaseId) {
    document.getElementById("room-error-overlay")
        .style.display = "block";
    document.getElementById("room-error-title")
        .innerHTML = getLocalized(errorTypeBaseId + "Title");
    document.getElementById("room-error-description")
        .innerHTML = getLocalized(errorTypeBaseId + "Description");
}

function hideRoomError() {
    document.getElementById("room-error-overlay")
        .style.display = "none";
}

function initInviteLink() {
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
}

function initChat() {
    const chatMessageInput = document.getElementById("chat-message-input");
    const chatMessageSend = document.getElementById("chat-message-send");
    const sendTextMessage = () => {
        if (!socket) { return; }
        const sent = chatMessageInput.value.trim();
        if (sent.length === 0) { return; }
        socket.send(JSON.stringify({
            type: "chat_message",
            contents: sent
        }));
        chatMessageInput.value = "";
    };
    chatMessageSend.onclick = sendTextMessage;
    chatMessageInput.addEventListener("keyup", e => {
        if (e.key !== "Enter") { return; }
        sendTextMessage();
    });
}

let roomId = null;

window.addEventListener("load", () => {
    document.title = getLocalized("titlebar");
    const params = new URLSearchParams(window.location.search);
    roomId = params.get("id");
    if (!roomId) {
        return exitPage();
    }
    if (!localStorage.username) {
        setTimeout(() => {
            window.location.href = `/join?id=${roomId}`;
        }, 100);
    }
    connectWebsocket(roomId, localStorage.username);
    initInviteLink();
    initChat();
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
    for (const player of players) {
        const name = document.createElement("span");
        name.innerText = filterProfanities(player.name);
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
        if (player.id === roomOwnerId) {
            const isOwner = document.createElement("img");
            isOwner.classList.add("player-status-room-owner");
            isOwner.src = "res/settings-gear.svg";
            playerCont.appendChild(isOwner);
        }
        playerCont.appendChild(isReady);
        playerList.appendChild(playerCont);
    }
    isReady = isReady && !roomIsPlaying;
    if (roomIsPlaying) { isReady = false; }
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
    for (const settingName of Object.keys(SETTING_PROPERTIES)) {
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
            if (socket) {
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

const SOCKET_ROUTE = "wss://localhost:8443/ws/room";
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 16000;

let socket;
let reconnectDelayMs = BASE_RECONNECT_DELAY_MS;
let crashed = false;

function connectWebsocket(roomId, username) {
    const url = new URL(SOCKET_ROUTE);
    const sessionId = localStorage.sessionId;
    if (sessionId) {
        url.searchParams.append("sessionId", sessionId);
    }
    socket = new WebSocket(url.toString());
    socket.addEventListener("open", () => {
        hideRoomError();
        reconnectDelayMs = BASE_RECONNECT_DELAY_MS;
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
        if (crashed || exitingPage) { return; }
        showRoomError("clientDisconnected");
        setTimeout(() => {
            reconnectDelayMs = Math.min(
                reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS
            );
            connectWebsocket(roomId, username);
        }, reconnectDelayMs);
    });
}

let playerId;
let roomOwnerId;

function onSocketEvent(event) {
    switch (event.type) {
        case "invalid_message": {
            switch(event.reason) {
                // critical errors in client side logic
                case "message_parsing_failed":
                case "client_not_in_room":
                case "client_already_in_room":
                    console.error(
                        `Server reported message error '${event.reason}'`
                    );
                    break;
                // non-critical errors for things that should already
                // be enforced by the client
                case "client_not_room_owner":
                case "username_too_long":
                case "chat_message_too_long":
                    break;
                // common issues that need actual handling
                case "room_does_not_exist":
                    crashed = true;
                    showRoomError("unknownRoom");
                    break;
                case "room_is_full":
                    crashed = true;
                    showRoomError("roomFull");
                    break;
            }
            break;
        }
        case "identification": {
            playerId = event.playerId;
            localStorage.sessionId = event.sessionId;
            break;
        }
        case "room_info": {
            roomOwnerId = event.owner;
            settings = event.settings;
            const playing = event.state === "playing";
            if (!playing && roomIsPlaying) {
                showWaiting();
            } else if (playing && !roomIsPlaying) {
                isPlaying = roomIsPlaying === false;
                showPlaying();
            }
            roomIsPlaying = playing;
            window.gameRunning = playing;
            updateWaiting(event.players);
            break;
        }
        case "room_crashed": {
            crashed = true;
            showRoomError("roomCrash");
            break;
        }
        case "chat_message": {
            const chatLog = document.getElementById("chat-message-list");
            const messageName = document.createElement("span");
            messageName.classList.add("chat-message-name");
            messageName.innerText = filterProfanities(event.senderName);
            chatLog.appendChild(messageName);
            const messageContent = document.createElement("span");
            messageContent.classList.add("chat-message-content");
            messageContent.innerText = filterProfanities(event.contents);
            chatLog.appendChild(messageContent);
            chatLog.appendChild(document.createElement("br"));
            chatLog.scrollTop = chatLog.scrollHeight;
            const chatLogNodes = chatLog.childNodes;
            while (chatLogNodes.length > 256 * 2) {
                chatLog.removeChild(chatLogNodes[0]);
            }
            break;
        }
        case "terrain_info": {
            onUpdateTerrain(event.terrain);
            break;
        }
    }
}