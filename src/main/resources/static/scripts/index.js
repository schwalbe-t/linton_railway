
function onPageLoad() {
    document.title = getLocalized("titlebar");
    if(window.location.pathname === "/join") {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");
        if(id !== null) {
            prepareJoin(id);
        }
    }
}

window.onload = onPageLoad;

window.addEventListener("load", onPageLoad);
window.addEventListener("pageshow", onPageLoad);

window.addEventListener('popstate', () => {
    location.reload();
});

const handleRoomFindResponse = request => request
    .then(r => {
        if(r.ok) { return r.json(); }
        const roomErr = document.getElementById("room-create-error");
        if(roomErr.innerText.length !== 0) { return null; }
        roomErr.innerText = getLocalized(
            r.status === 429? "roomCreationCooldown" : "roomCreationFailed"
        );
        setTimeout(() => {
            roomErr.innerText = "";
        }, 5000);
        return null;
    })
    .then(j => {
        const hasRoomId = j
            && typeof j === "object"
            && typeof j.roomId === "string";
        if(!hasRoomId) { return; }
        history.pushState(null, "", `/join?id=${j.roomId}`);
        prepareJoin(j.roomId);
    })
    .catch(console.error);

function createRoom() {
    const roomCreateRequest = {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        }
    };
    handleRoomFindResponse(fetch("/api/rooms/create", roomCreateRequest));
}

function joinPublicRoom() {
    handleRoomFindResponse(fetch("/api/rooms/findPublic"));
}

function prepareJoin(roomId) {
    document.getElementById("main-page").style.display = "none";
    document.getElementById("join-page").style.display = "block";
    const usernameInp = document.getElementById("join-room-username");
    const joinRoomBut = document.getElementById("confirm-join-room");
    usernameInp.oninput = () => {
        joinRoomBut.disabled = usernameInp.value.trim().length === 0;
    };
    usernameInp.value = localStorage.username || "";
    usernameInp.oninput();
    joinRoomBut.onclick = () => {
        const username = usernameInp.value.trim();
        if(username.length === 0) { return; }
        localStorage.username = username;
        window.location.href = `/room?id=${roomId}`;
    };
}