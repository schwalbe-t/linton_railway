
import * as resources from "./resources.js";
import * as gameloop from "./gameloop.js";
import * as camera from "./camera.js";
import * as gprofiles from "./gprofiles.js";
import {
    initGraphics, onGraphicsInit, updateGraphics, defaultFramebuffer
} from "./graphics.js";
import { Renderer } from "./renderer.js";
import { HeightMap, Terrain } from "./terrain.js";
import { resetInput } from "./input.js";
import { TrackNetwork, Train } from "./network.js";
import { WorldUi } from "./world_ui.js";
import { Matrix4 } from "../libs/math.gl.js";

const RESOURCES = resources.load({
    rendererResources: Renderer.loadResources(),
    terrainResources: Terrain.loadResources(),
    networkResources: TrackNetwork.loadResources(),
    trainResources: Train.loadResources()
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
let network = null;

function init() {
    renderer = new Renderer();
}

function onReceiveWorld(world) {
    onGraphicsInit(() => {
        if (terrain !== null) {
            terrain.delete(); 
            network.delete();
        }
        Terrain.tessellateRivers(world.terrain);
        TrackNetwork.tessellateTrackSegments(world.network);
        const heightMap = new HeightMap(world);
        terrain = new Terrain(world.terrain, heightMap);
        network = new TrackNetwork(world, heightMap);
        camera.init(terrain);
    });
}
window.onReceiveWorld = onReceiveWorld;

function onReceiveGameState(state) {
    if (terrain === null) { return; }
    network.updateTileRegionTex(state.regions);
    network.updateSwitchStates(state.switches);
    network.updateTrains(state.trains);
}
window.onReceiveGameState = onReceiveGameState;

gameloop.onFrame(deltaTime => {
    if (terrain !== null) {
        // update
        camera.update(deltaTime, terrain);
        // render
        gprofiles.updateProfile(deltaTime);
        gprofiles.applyProfile(renderer, terrain);
        updateGraphics();
        camera.configureRenderer(renderer);
        renderer.update(defaultFramebuffer, network, deltaTime);
        WorldUi.VIEW_PROJECTION = new Matrix4(renderer.viewProj);
        network.update(deltaTime);
        if (gprofiles.current().shadowMapping) {
            renderer.prepareRenderShadows();
            terrain.render(renderer);
            network.render(renderer);
        }
        renderer.prepareRenderGeometry(defaultFramebuffer);
        terrain.render(renderer);
        network.render(renderer);
    }
    resetInput();
});