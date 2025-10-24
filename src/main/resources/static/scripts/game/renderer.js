
import { Vector3, Vector4, Matrix4 } from "../libs/math.gl.js";
import { 
    ObjProperty, DepthTesting, Framebuffer, Texture, TextureFormat, Shader
} from "./graphics.js";

export class Renderer {

    static OBJ_LAYOUT = [
        ObjProperty.Position,
        ObjProperty.Normal,
        ObjProperty.TexCoord 
    ];

    static SUN_OFFSET = new Vector3(50, 50, -50);
    static SUN_ORTHO_PROJ = {
        left: -50, right: 50,
        bottom: -50, top: 50,
        near: 1, far: 300
    };
    static SHADOW_MAP_RES = 4096;
    static DEPTH_BIAS = 0.001;
    static NORMAL_OFFSET = 0;
    static FOV_Y = 60;
    static NEAR_PLANE = 1;
    static FAR_PLANE = 300;
    static CLEAR_COLOR = new Vector4(134, 160, 99, 255).scale(1/255);
    
    static MAX_INSTANCE_COUNT = 64;
    static VIEW_PROJ_UNIFORM = "uViewProj";
    static LIGHT_PROJ_UNIFORM = "uLightProj";
    static SHADOW_MAP_UNIFORM = "uShadowMap";
    static SUN_DIR_UNIFORM = "uSunDirection";
    static DEPTH_BIAS_UNIFORM = "uDepthBias";
    static NORMAL_OFFSET_UNIFORM = "uNormalOffset";
    static MODEL_TRANSFS_UNIFORM = "uModelTransfs";
    static TEXTURE_UNIFORM = "uTexture";

    static SHADOW_SHADER = null;
    static async loadShadowShader() {
        const shader = await Shader.loadGlsl(
            "/res/shaders/geometry.vert.glsl", "/res/shaders/shadows.frag.glsl"
        );
        Renderer.SHADOW_SHADER = shader;
        return shader;
    }

    constructor() {
        this.camera = {
            eye: new Vector3(5, 5, 5),
            center: new Vector3(0, 0, 0),
            up: new Vector3(0, 1, 0)
        };
        this.sun = {
            eye: new Vector3(),
            center: new Vector3(),
            up: new Vector3()
        };
        this.shaderOverride = null;
        this.target = null;
        this.lightProj = new Matrix4();
        this.viewProj = new Matrix4();
        this.shadowMap = new Framebuffer();
        this.shadowMap.setDepth(Texture.withSize(
            Renderer.SHADOW_MAP_RES, Renderer.SHADOW_MAP_RES,
            TextureFormat.DEPTH16
        ));
        this.sunDirection = new Vector3();
    }

    updateSun() {
        // update sun camera setup
        this.sun.center = this.camera.center.clone();
        this.sun.eye = this.sun.center.clone().add(Renderer.SUN_OFFSET);
        this.sun.up = this.camera.up.clone();
        this.sunDirection = Renderer.SUN_OFFSET.clone().normalize().negate();
        // update sun view projection matrix
        const view = new Matrix4().lookAt(this.sun);
        const projection = new Matrix4().ortho(Renderer.SUN_ORTHO_PROJ);
        this.lightProj = projection.multiplyRight(view);
    }

    updateCamera() {
        const view = new Matrix4().lookAt(this.camera);
        const projection = new Matrix4().perspective({
            fovy: Renderer.FOV_Y * (Math.PI / 180),
            aspect: this.target.width / this.target.height,
            near: Renderer.NEAR_PLANE, far: Renderer.FAR_PLANE
        });
        this.viewProj = projection.multiplyRight(view);
    }

    update(target) {
        this.target = target;
        this.updateSun();
        this.updateCamera(this.camera);
    }

    shadowMapped(target, f) {
        this.shaderOverride = Renderer.SHADOW_SHADER;
        this.shaderOverride.setUniform(
            Renderer.VIEW_PROJ_UNIFORM, this.lightProj
        );
        this.target = this.shadowMap;
        this.target.clearDepth(1);
        f();
        this.shaderOverride = null;
        this.target = target;
        this.target.clearColor(Renderer.CLEAR_COLOR);
        this.target.clearDepth(1);
        f();
    }

    setUniforms(shader) {
        shader.setUniform(Renderer.VIEW_PROJ_UNIFORM, this.viewProj);
        shader.setUniform(Renderer.LIGHT_PROJ_UNIFORM, this.lightProj);
        shader.setUniform(Renderer.SHADOW_MAP_UNIFORM, this.shadowMap.depth);
        shader.setUniform(Renderer.SUN_DIR_UNIFORM, this.sunDirection);
        shader.setUniform(
            Renderer.DEPTH_BIAS_UNIFORM, Renderer.DEPTH_BIAS
        );
        shader.setUniform(
            Renderer.NORMAL_OFFSET_UNIFORM, Renderer.NORMAL_OFFSET
        );
    }

    render(model, shader, instances, depthTesting = DepthTesting.ENABLED) {
        const actualShader = this.shaderOverride || shader;
        const remaining = [...instances];
        while(remaining.length > 0) {
            const batch = remaining.splice(0, Renderer.MAX_INSTANCE_COUNT);
            actualShader.setUniform(Renderer.MODEL_TRANSFS_UNIFORM, batch);
            model.render(
                actualShader, this.target, Renderer.TEXTURE_UNIFORM,
                batch.length, depthTesting
            );
        }
    }

}