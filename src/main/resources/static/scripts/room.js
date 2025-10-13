
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
    document.getElementById("copy-invite-link").onclick = () => {
        const origin = window.location.origin;
        navigator.clipboard.writeText(`${origin}/join?id=${roomId}`);
    };
    connectWebsocket(roomId, localStorage.username);
});

function exitPage() {
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
        isReady.style.visibility = roomIsPlaying? "hidden" : "visible";
        const playerCont = document.createElement("div");
        playerCont.classList.add("player-info-container");
        playerCont.appendChild(name);
        playerCont.appendChild(isReady);
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
}

function showPlaying() {
    document.getElementById("waiting-page").style.display = "none";
    document.getElementById("game-page").style.display = "block";
}

let socket;
let roomCrashed = false;

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
            return exitPage();
        }
        onSocketEvent(event);
    });
    socket.addEventListener("close", () => {
        if(!roomCrashed) {
            return exitPage();
        }
    });
}

let playerId;

function onSocketEvent(event) {
    switch(event.type) {
        case "invalid_message": {
            console.error(`Server reported invalid message: ${event.reason}`);
            return exitPage();
        }
        case "identification": {
            playerId = event.playerId;
            break;
        }
        case "room_info": {
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
            roomCrashed = true;
            document.getElementById("room-crashed-overlay")
                .style.display = "block";
            break;
        }
    }
}