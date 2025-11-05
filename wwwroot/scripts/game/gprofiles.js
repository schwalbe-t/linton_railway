
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
    })

]);

let currentProfileIdx = -1;

export function applyProfile(profileIdx, renderer) {
    if (currentProfileIdx === profileIdx) { return; }
    currentProfileIdx = profileIdx;
    const profile = PROFILES[profileIdx];
    renderer.shadowMapping = profile.shadowMapping;
    if (profile.shadowMapping) {
        renderer.shadowMapRes = profile.shadowMapRes;
    }
    setRenderScale(profile.renderScale);
}

const PROFILE_CHANGE_FPS = 30; // decrease if FPS lower

export function updateProfile(deltaTime, renderer) {
    if (currentProfileIdx === -1) {
        applyProfile(PROFILES.length - 1, renderer);
    }
    const fps = 1.0 / deltaTime;
    if (fps < PROFILE_CHANGE_FPS && currentProfileIdx > 0) {
        applyProfile(currentProfileIdx - 1, renderer);
    }
}