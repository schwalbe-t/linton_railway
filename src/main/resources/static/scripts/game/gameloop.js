
let frame = () => {};

export function start() {
    window.requestAnimationFrame(gameloop);
}

export function onFrame(f) {
    frame = f;
}

let lastTimestampMs = -1;

function gameloop(timestampMs) {
    if(window.gameRunning) {
        const deltaTimeS = lastTimestampMs === -1? 0
            : (timestampMs - lastTimestampMs) / 1000;
        frame(deltaTimeS);
    }
    lastTimestampMs = timestampMs;
    window.requestAnimationFrame(gameloop);
}