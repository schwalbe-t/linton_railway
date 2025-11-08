
import * as resources from "./resources.js";
import * as gameloop from "./gameloop.js";
import * as camera from "./camera.js";
import * as gprofiles from "./gprofiles.js";
import {
    initGraphics, onGraphicsInit, updateGraphics, defaultFramebuffer
} from "./graphics.js";
import { Renderer } from "./renderer.js";
import { Terrain } from "./terrain.js";
import { resetInput } from "./input.js";
import { TrainTracks } from "./traintracks.js";

const RESOURCES = resources.load({
    rendererResources: Renderer.loadResources(),
    terrainResources: Terrain.loadResources(),
    trainTracksResources: TrainTracks.loadResources()
});

window.addEventListener("load", () => {
    initGraphics(document.getElementById("game-canvas"));
    RESOURCES.onLoad(() => {
        init();
        gameloop.start();
    });
});

let renderer = null;
let terrain = null;
let trainTracks = null;

function init() {
    renderer = new Renderer();
}

function onUpdateTerrain(details) {
    onGraphicsInit(() => {
        if (terrain !== null) {
            terrain.delete(); 
            trainTracks.delete();
        }
        terrain = new Terrain(details);
        trainTracks = new TrainTracks({
            segments: [
                { spline: {
                    start: [0, 5, 0],
                    segments: [
                        { ctrl: [10, 5,  0], to: [10, 5, 10] },
                        { ctrl: [10, 5, 15], to: [10, 5, 20] },
                        { ctrl: [10, 5, 40], to: [30, 5, 40] },
                        { ctrl: [40, 5, 40], to: [50, 5, 40] }
                    ]
                } } 
            ]
        });
        camera.init();
    });
}
window.onUpdateTerrain = onUpdateTerrain;

gameloop.onFrame(deltaTime => {
    if (terrain !== null) {
        // update
        camera.update(deltaTime);
        // render
        gprofiles.updateProfile(deltaTime);
        gprofiles.applyProfile(renderer, terrain);
        updateGraphics();
        camera.configureRenderer(renderer);
        renderer.update(defaultFramebuffer, deltaTime);
        renderer.shadowMapped(defaultFramebuffer, () => {
            terrain.render(renderer);
            trainTracks.render(renderer);
        });
    }
    resetInput();
});