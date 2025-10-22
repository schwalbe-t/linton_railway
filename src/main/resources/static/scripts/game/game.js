
// import * as spline from "./spline.js";
import { Vector4 } from "../libs/math.gl.js";
import { 
    initGraphics, Shader, Geometry, Texture, TextureFormat, TextureFilter,
    defaultFramebuffer
} from "./graphics.js";
import * as resources from "./resources.js";

const RESOURCES = resources.load({
    testShader: Shader.loadGlsl(
        "/res/shaders/test_vert.glsl", "/res/shaders/test_frag.glsl"
    ),
    testTexture: Texture.loadImage(
        "/res/test.png", TextureFormat.RGBA8, TextureFilter.LINEAR
    )
});

window.addEventListener("load", () => {
    initGraphics(document.getElementById("test-canvas"));
    const testGeometry = new Geometry([
         0.0, +0.5,   0.5, 1.0,
        -0.5, -0.5,   0.0, 0.0,
        +0.5, -0.5,   1.0, 0.0
    ], [
        0, 1, 2
    ], [2, 2]);
    const frame = () => {
        defaultFramebuffer.clearColor(new Vector4(1, 1, 1, 1));
        defaultFramebuffer.clearDepth(1);
        testGeometry.render(RESOURCES.testShader, defaultFramebuffer);
        window.requestAnimationFrame(frame);
    };
    RESOURCES.onLoad(() => {
        RESOURCES.testShader.setUniform("uTexture", RESOURCES.testTexture);
        window.requestAnimationFrame(frame);
    });
});