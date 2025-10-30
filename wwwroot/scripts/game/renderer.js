
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
    static GEOMETRY_LAYOUT = [ 3, 3, 2 ];

    static SUN_OFFSET = new Vector3(1.134, 1, -0.85).normalize().scale(200);
    static SUN_ORTHO_PROJ = {
        left: -200, right: 200,
        bottom: -200, top: 200,
        near: 10, far: 1000
    };
    static SHADOW_MAP_RES = 4096;
    static DEPTH_BIAS = 0.05;
    static NORMAL_OFFSET = 0.01;
    static FOV_Y = 60;
    static NEAR_PLANE = 1;
    static FAR_PLANE = 1000;
    static CLEAR_COLOR = new Vector4(209, 193, 158, 255).scale(1/255);
    
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
        Renderer.SHADOW_SHADER = await Shader.loadGlsl(
            "/res/shaders/geometry.vert.glsl", "/res/shaders/shadows.frag.glsl"
        );
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
        this.defaultShader = null;
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

    renderInstanced(instances, shader, f) {
        const s = this.shaderOverride || shader || this.defaultShader;
        if(!s) { throw new Error("No shader specified"); }
        const remaining = [...instances];
        while(remaining.length > 0) {
            const batch = remaining.splice(0, Renderer.MAX_INSTANCE_COUNT);
            s.setUniform(Renderer.MODEL_TRANSFS_UNIFORM, batch);
            f(s, batch.length);
        }
    }

    renderModel(model, instances, shader, depthTesting = DepthTesting.ENABLED) {
        this.renderInstanced(instances, shader, (s, batchLen) => {
            model.render(
                s, this.target, Renderer.TEXTURE_UNIFORM,
                batchLen, depthTesting
            );
        });
    }

    renderGeometry(
        geometry, texture, instances, 
        shader, depthTesting = DepthTesting.ENABLED
    ) {
        this.renderInstanced(instances, shader, (s, batchLen) => {
            s.setUniform(Renderer.TEXTURE_UNIFORM, texture);
            geometry.render(s, this.target, batchLen, depthTesting);
        });
    }

}