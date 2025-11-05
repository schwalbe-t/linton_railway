
import { setRenderScale } from "./graphics.js";

// profiles, index indicates quality
const PROFILES = Object.freeze([

    Object.freeze({
        renderScale: 0.5,
        shadowMapping: false
    }),

    Object.freeze({
        renderScale: 0.75,
        shadowMapping: false
    }),

    Object.freeze({
        renderScale: 0.75,
        shadowMapping: true,
        shadowMapRes: 1024
    }),

    Object.freeze({
        renderScale: 1.0,
        shadowMapping: true,
        shadowMapRes: 1024
    }),

    Object.freeze({
        renderScale: 1.0,
        shadowMapping: true,
        shadowMapRes: 2048
    }),

    Object.freeze({
        renderScale: 1.0,
        shadowMapping: true,
        shadowMapRes: 4096
    })

]);

let gameVisible = true;
let gameInFocus = true;

document.addEventListener("visibilitychange", e => {
    gameVisible = document.visibilityState === "visible";
});
window.addEventListener("focus", () => { gameInFocus = true; });
window.addEventListener("blur", () => { gameInFocus = false; });

let cProfileIdx = -1;

export function applyProfile(profileIdx, renderer) {
    if (cProfileIdx === profileIdx) { return; }
    console.log(
        `Using graphics profile ${profileIdx + 1}/${PROFILES.length}`
    );
    cProfileIdx = profileIdx;
    const profile = PROFILES[profileIdx];
    renderer.shadowMapping = profile.shadowMapping;
    if (profile.shadowMapping) {
        renderer.shadowMapRes = profile.shadowMapRes;
    }
    setRenderScale(profile.renderScale);
}

// An average delta time value over 'DT_HISTORY_LEN' frames
// that exceeds this value causes a switch to the next worse profile.
const PROFILE_DECR_DT = 1/50;

let deltaTimeHistory = [];
const DT_HISTORY_LEN = 100;

export function updateProfile(deltaTime, renderer) {
    if (cProfileIdx === -1) {
        applyProfile(PROFILES.length - 1, renderer);
    }
    if (!gameInFocus || !gameVisible) {
        deltaTimeHistory = [];
        return;
    }
    deltaTimeHistory.push(deltaTime);
    if (deltaTimeHistory.length > DT_HISTORY_LEN) {
        deltaTimeHistory = deltaTimeHistory.slice(-DT_HISTORY_LEN);
        const deltaTimeAvg = deltaTimeHistory.reduce((a, b) => a + b)
            / deltaTimeHistory.length;
        const hasWorse = cProfileIdx > 0;
        if (deltaTimeAvg > PROFILE_DECR_DT && hasWorse) {
            console.log(1 / deltaTimeAvg);
            applyProfile(cProfileIdx - 1, renderer);
            deltaTimeHistory = [];
        }
    }
}