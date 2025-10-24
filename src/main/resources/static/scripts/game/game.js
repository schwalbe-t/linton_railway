
import { Matrix4, Vector3 } from "../libs/math.gl.js";
import {
    initGraphics, updateGraphics,
    Shader, Model, defaultFramebuffer, 
    TextureFormat,
    TextureFilter
} from "./graphics.js";
import { Renderer } from "./renderer.js";
import * as resources from "./resources.js";
import * as gameloop from "./gameloop.js";

const RESOURCES = resources.load({
    rendererShadowShader: Renderer.loadShadowShader(),
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

function init() {
    renderer = new Renderer();
    renderer.camera.eye.set(-6, 4.5, -3);
}

gameloop.onFrame(deltaTime => {
    updateGraphics();
    renderer.update(defaultFramebuffer);
    renderer.setUniforms(RESOURCES.shader);
    renderer.setUniforms(RESOURCES.carriageShader);
    renderer.shadowMapped(defaultFramebuffer, () => {
        RESOURCES.carriageShader.setUniform(
            "uCarriageColor", new Vector3(204, 120, 91).scale(1/255)
        );
        renderer.render(
            RESOURCES.carriage, RESOURCES.carriageShader,
            [
                new Matrix4(),
                new Matrix4().translate([ 1.15, 0, 0 ]),
                new Matrix4().translate([ 2.30, 0, 0 ])
            ]
        )
        RESOURCES.carriageShader.setUniform(
            "uCarriageColor", new Vector3(170, 116, 158).scale(1/255)
        );
        renderer.render(
            RESOURCES.carriage, RESOURCES.carriageShader,
            [
                new Matrix4().translate([ 0.00, 0, 0.5 ]),
                new Matrix4().translate([ 1.15, 0, 0.5 ]),
                new Matrix4().translate([ 2.30, 0, 0.5 ])
            ]
        )
        renderer.render(
            RESOURCES.locoSteam, RESOURCES.shader,
            [ new Matrix4().translate([ -1.15, 0, 0 ]) ]
        )
        renderer.render(
            RESOURCES.locoDiesel, RESOURCES.shader,
            [ new Matrix4().translate([ -1.15, 0, 0.5 ]) ]
        )
        renderer.render(
            RESOURCES.tree, RESOURCES.shader,
            [
                new Matrix4().translate([ 0.25, 0, -0.5 ]),
                new Matrix4().translate([ 2.25, 0, -0.5 ])
            ]
        )
    });
});