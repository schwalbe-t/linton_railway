
import * as resources from "./resources.js";
import * as gameloop from "./gameloop.js";
import * as camera from "./camera.js";
import * as gprofiles from "./gprofiles.js";
import {
    initGraphics, onGraphicsInit, updateGraphics, defaultFramebuffer
} from "./graphics.js";
import { Renderer } from "./renderer.js";
import { HeightMap, Terrain } from "./terrain.js";
import { key, resetInput } from "./input.js";
import { TrackNetwork } from "./network.js";

const RESOURCES = resources.load({
    rendererResources: Renderer.loadResources(),
    terrainResources: Terrain.loadResources(),
    trainTracksResources: TrackNetwork.loadResources()
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

function onReceiveWorld(world) {
    onGraphicsInit(() => {
        if (terrain !== null) {
            terrain.delete(); 
            trainTracks.delete();
        }
        Terrain.tessellateRivers(world.terrain);
        TrackNetwork.tessellateTrackSegments(world.network);
        const heightMap = new HeightMap(world);
        terrain = new Terrain(world.terrain, heightMap);
        trainTracks = new TrackNetwork(world.network, heightMap);
        camera.init();
    });
}
window.onReceiveWorld = onReceiveWorld;

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
        if (gprofiles.current().shadowMapping) {
            renderer.prepareRenderShadows();
            terrain.render(renderer);
            trainTracks.render(renderer);
        }
        renderer.prepareRenderGeometry(defaultFramebuffer);
        terrain.render(renderer);
        trainTracks.render(renderer);
    }
    resetInput();
});