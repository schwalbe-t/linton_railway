
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
let displayedPoints = 0;
let currentPoints = 0;

function init() {
    renderer = new Renderer();
}

function onReceiveWorld(world) {
    document.getElementById("game-winner-page").style.display = "none";
    onGraphicsInit(() => {
        if (terrain !== null) {
            terrain.delete(); 
            network.delete();
        }
        displayedPoints = -1;
        currentPoints = -1;
        onPointUpdate({ trains: [], clientNumPoints: -1 });
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

function onPointUpdate(event) {
    if (network !== null) {
        network.updateTrainPoints(event.trains);
    }
    const oldPoints = currentPoints;
    currentPoints = event.clientNumPoints;
    if (displayedPoints < oldPoints) { return; }
    const addPoint = () => {
        if (displayedPoints >= currentPoints) { return; }
        displayedPoints += 1;
        document.getElementById("game-point-counter-value").innerText
            = displayedPoints;
        setTimeout(addPoint, 50);
    };
    addPoint();
}
window.onPointUpdate = onPointUpdate;

const WINNER_SCREEN_TIME = 20; // needs to match server side constant

function onWinnersAnnounced(winners) {
    const page = document.getElementById("game-winner-page");
    page.style.display = "block";
    const list = document.getElementById("game-winners-list");
    list.innerHTML = "";
    let currentPlacement = 0;
    let lastScore = Infinity;
    for (const winner of winners) {
        const item = document.createElement("div");
        item.classList.add("game-winner-item");
        if (winner.numPoints < lastScore) {
            lastScore = winner.numPoints;
            currentPlacement += 1;
        } 
        const placement = document.createElement("div");
        placement.classList.add("game-winner-placement");
        if (currentPlacement === 1) {
            placement.classList.add("game-winner-placement-first");
        }
        placement.innerText = currentPlacement;
        item.appendChild(placement);
        const name = document.createElement("div");
        name.classList.add("game-winner-name");
        name.innerText = winner.name;
        item.appendChild(name);
        const points = document.createElement("div");
        points.classList.add("game-winner-score");
        points.innerText = winner.numPoints;
        item.appendChild(points);
        list.appendChild(item);
    }
    const clock = document.getElementById("game-winners-end-timer");
    let remSeconds = WINNER_SCREEN_TIME;
    const displayTimer = () => {
        if (page.style.display !== "block") { return; }
        clock.innerText = "00:" + `${remSeconds}`.padStart(2, "0");
        remSeconds -= 1;
        if (remSeconds <= 0) { return; }
        setTimeout(displayTimer, 1000);
    };
    displayTimer();
}
window.onWinnersAnnounced = onWinnersAnnounced;

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