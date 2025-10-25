
import {
    initGraphics, updateGraphics,
    Shader, Model, defaultFramebuffer, 
    TextureFormat,
    TextureFilter
} from "./graphics.js";
import { Renderer } from "./renderer.js";
import * as resources from "./resources.js";
import * as gameloop from "./gameloop.js";
import { Terrain } from "./terrain.js";

const RESOURCES = resources.load({
    rendererShadowShader: Renderer.loadShadowShader(),
    terrainResources: Terrain.loadResources(),

    shader: Shader.loadGlsl(
        "/res/shaders/geometry.vert.glsl", "/res/shaders/geometry.frag.glsl"
    ),
    carriageShader: Shader.loadGlsl(
        "/res/shaders/geometry.vert.glsl", "/res/shaders/carriage.frag.glsl"
    ),
    carriage: Model.loadMeshes(Renderer.OBJ_LAYOUT, [
        { tex: "/res/models/carriage.png", obj: "/res/models/carriage.obj" }
    ]),
    locoDiesel: Model.loadMeshes(Renderer.OBJ_LAYOUT, [
        { tex: "/res/models/loco_diesel.png", obj: "/res/models/loco_diesel.obj" }
    ]),
    locoSteam: Model.loadMeshes(Renderer.OBJ_LAYOUT, [
        { tex: "/res/models/loco_steam.png", obj: "/res/models/loco_steam.obj" }
    ]),
    tree: Model.loadMeshes(Renderer.OBJ_LAYOUT, [
        { 
            tex: "/res/models/tree.png", obj: "/res/models/tree.obj",
            texFormat: TextureFormat.RGBA8, texFilter: TextureFilter.LINEAR
        }
    ])
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
    renderer.camera.eye.set(500, 200, 500+150);
    renderer.camera.center.set(500, 0, 500);
    renderer.defaultShader = RESOURCES.shader;
    terrain = new Terrain({
        sizeChunks: 10,
        seed: Math.floor(Math.random() * 65536)
    });
}

gameloop.onFrame(deltaTime => {
    updateGraphics();
    renderer.update(defaultFramebuffer);
    renderer.setUniforms(RESOURCES.shader);
    renderer.setUniforms(RESOURCES.carriageShader);
    renderer.shadowMapped(defaultFramebuffer, () => {
        terrain.render(renderer);
    });
});