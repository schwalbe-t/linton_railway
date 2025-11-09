
import { setRenderScale } from "./graphics.js";

// profiles, index indicates quality
const PROFILES = Object.freeze([

    Object.freeze({
        renderScale: 0.5,
        shadowMapping: false,
        flatTrees: true
    }),

    Object.freeze({
        renderScale: 0.75,
        shadowMapping: false,
        flatTrees: true
    }),

    Object.freeze({
        renderScale: 0.75,
        shadowMapping: true,
        dynamicShadows: true,
        shadowMapRes: 2048,
        shadowDepthBias: 0.003,
        flatTrees: false
    }),

    Object.freeze({
        renderScale: 1.0,
        shadowMapping: true,
        dynamicShadows: true,
        shadowMapRes: 3072,
        shadowDepthBias: 0.002,
        flatTrees: false
    }),

    Object.freeze({
        renderScale: 1.0,
        shadowMapping: true,
        dynamicShadows: true,
        shadowMapRes: 4096,
        shadowDepthBias: 0.001,
        flatTrees: false
    })

]);

let gameVisible = true;
let gameInFocus = true;

document.addEventListener("visibilitychange", e => {
    gameVisible = document.visibilityState === "visible";
});
window.addEventListener("focus", () => { gameInFocus = true; });
window.addEventListener("blur", () => { gameInFocus = false; });

let profileIdx = PROFILES.length - 1;

export function applyProfile(renderer, terrain) {
    const profile = PROFILES[profileIdx];
    setRenderScale(profile.renderScale);
    renderer.shadowMapping = profile.shadowMapping;
    if (profile.shadowMapping) {
        renderer.shadowMapRes = profile.shadowMapRes;
        renderer.shadowDepthBias = profile.shadowDepthBias;
    }
    terrain.flatTrees = profile.flatTrees;
}

export const current = () => PROFILES[profileIdx];

// An average delta time value over 'DT_HISTORY_LEN' frames
// that exceeds this value causes a switch to the next worse profile.
const PROFILE_DECR_DT = 1/50;

let deltaTimeHistory = [];
const DT_HISTORY_LEN = 50;

export function updateProfile(deltaTime) {
    if (!gameInFocus || !gameVisible) {
        deltaTimeHistory = [];
        return;
    }
    deltaTimeHistory.push(deltaTime);
    if (deltaTimeHistory.length > DT_HISTORY_LEN) {
        deltaTimeHistory = deltaTimeHistory.slice(-DT_HISTORY_LEN);
        const deltaTimeAvg = deltaTimeHistory.reduce((a, b) => a + b)
            / deltaTimeHistory.length;
        const hasWorse = profileIdx > 0;
        if (deltaTimeAvg > PROFILE_DECR_DT && hasWorse) {
            profileIdx -= 1;
            deltaTimeHistory = [];
            console.log(
                `Downgraded to profile ${profileIdx + 1}/${PROFILES.length}`
            );
        }
    }
}