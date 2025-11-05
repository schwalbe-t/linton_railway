
import * as resources from "./resources.js";
import * as gameloop from "./gameloop.js";
import * as camera from "./camera.js";
import * as gprofiles from "./gprofiles.js";
import {
    initGraphics, updateGraphics, defaultFramebuffer
} from "./graphics.js";
import { Renderer } from "./renderer.js";
import { Terrain } from "./terrain.js";
import { resetInput } from "./input.js";

const RESOURCES = resources.load({
    rendererResources: Renderer.loadResources(),
    terrainResources: Terrain.loadResources(),
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

function init() {
    renderer = new Renderer();
}

function onUpdateTerrain(details) {
    if (terrain !== null) {
        terrain.delete();
    }
    terrain = new Terrain(details);
    camera.init();
}
window.onUpdateTerrain = onUpdateTerrain;

gameloop.onFrame(deltaTime => {
    if (terrain !== null) {
        // update
        camera.update(deltaTime);
        // render
        gprofiles.updateProfile(deltaTime, renderer);
        updateGraphics();
        camera.configureRenderer(renderer);
        renderer.update(defaultFramebuffer, deltaTime);
        renderer.shadowMapped(defaultFramebuffer, () => {
            terrain.render(renderer);
        });
    }
    resetInput();
});