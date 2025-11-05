
import { Vector3, Vector4, Matrix4 } from "../libs/math.gl.js";
import { 
    ObjProperty, DepthTesting, Framebuffer, Texture, TextureFormat, Shader,
    UniformBuffer
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
        left: -400, right: 400,
        bottom: -200, top: 200,
        near: 10, far: 400
    };
    static DEPTH_BIAS = 0.005;
    static NORMAL_OFFSET = 0.01;
    static FOV_Y = 60;
    static NEAR_PLANE = 1;
    static FAR_PLANE = 1000;
    static CLEAR_COLOR = new Vector4(209, 193, 158, 255).scale(1/255);
    
    static VIEW_PROJ_UNIFORM = "uViewProj";
    static LIGHT_PROJ_UNIFORM = "uLightProj";
    static SHADOW_MAP_UNIFORM = "uShadowMap";
    static SUN_DIR_UNIFORM = "uSunDirection";
    static DEPTH_BIAS_UNIFORM = "uDepthBias";
    static NORMAL_OFFSET_UNIFORM = "uNormalOffset";
    static INSTANCES_UNIFORM = "uInstances";
    static TEXTURE_UNIFORM = "uTexture";
    static TIME_UNIFORM = "uTime";
    static SHADOW_MAPPING_UNIFORM = "uShadowMapping";

    static SHADOW_SHADER = null;
    static GEOMETRY_SHADER = null;
    static async loadResources() {
        const shadowShaderReq = Shader.loadGlsl(
            "/res/shaders/geometry.vert.glsl", "/res/shaders/shadows.frag.glsl"
        );
        const geometryShaderReq = Shader.loadGlsl(
            "/res/shaders/geometry.vert.glsl", "/res/shaders/geometry.frag.glsl"
        );
        Renderer.SHADOW_SHADER = await shadowShaderReq;
        Renderer.GEOMETRY_SHADER = await geometryShaderReq;
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
        this.target = null;
        this.lightProj = new Matrix4();
        this.viewProj = new Matrix4();
        this.sunDirection = new Vector3();
        this.time = 0.0;
        this.shadowMapping = true;
        this.shadowMapRes = 256;
        this.shadowMap = new Framebuffer();
        this.shadowMap.setDepth(Texture.withSize(
            256, 256, TextureFormat.DEPTH16
        ));
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

    update(target, deltaTime = 0.0) {
        this.target = target;
        this.time += deltaTime;
        if (this.shadowMap.depth.width !== this.shadowMapRes) {
            const oldDepth = this.shadowMap.depth;
            this.shadowMap.setDepth(Texture.withSize(
                this.shadowMapRes, this.shadowMapRes, TextureFormat.DEPTH16
            ));
            oldDepth.delete();
        }
        this.updateSun();
        this.updateCamera(this.camera);
        this.setShadowUniforms(Renderer.SHADOW_SHADER);
        this.setGeometryUniforms(Renderer.GEOMETRY_SHADER);
    }

    shadowMapped(target, f) {
        if (this.shadowMapping) {
            this.target = this.shadowMap;
            this.target.clearDepth(1);
            f();
        }
        this.target = target;
        this.target.clearColor(Renderer.CLEAR_COLOR);
        this.target.clearDepth(1);
        f();
    }

    setGeometryUniforms(shader) {
        shader.setUniform(Renderer.VIEW_PROJ_UNIFORM, this.viewProj);
        shader.setUniform(Renderer.LIGHT_PROJ_UNIFORM, this.lightProj);
        shader.setUniform(Renderer.SHADOW_MAP_UNIFORM, this.shadowMap.depth);
        shader.setUniform(Renderer.SUN_DIR_UNIFORM, this.sunDirection);
        shader.setUniform(Renderer.TIME_UNIFORM, this.time);
        shader.setUniform(Renderer.SHADOW_MAPPING_UNIFORM, this.shadowMapping);
        shader.setUniform(
            Renderer.DEPTH_BIAS_UNIFORM, Renderer.DEPTH_BIAS
        );
        shader.setUniform(
            Renderer.NORMAL_OFFSET_UNIFORM, Renderer.NORMAL_OFFSET
        );
    }

    setShadowUniforms(shader) {
        shader.setUniform(
            Renderer.VIEW_PROJ_UNIFORM, this.lightProj
        );
    }

    renderInstanced(instances, shadowShader, geometryShader, maxBatchSize, f) {
        const s = this.target !== this.shadowMap
            ? (geometryShader ? geometryShader : Renderer.GEOMETRY_SHADER)
            : (shadowShader   ? shadowShader   : Renderer.SHADOW_SHADER  );
        if (instances instanceof UniformBuffer) {
            s.setUniform(Renderer.INSTANCES_UNIFORM, instances);
            f(s, maxBatchSize);
            return;
        }
        const remaining = [...instances];
        while (remaining.length > 0) {
            const batch = remaining.splice(0, maxBatchSize);
            s.setUniform(Renderer.INSTANCES_UNIFORM, batch);
            f(s, batch.length);
        }
    }

    renderModel(
        model, instances,
        shadowShader, geometryShader, 
        depthTesting = DepthTesting.ENABLED,
        maxBatchSize = 64
    ) {
        this.renderInstanced(
            instances, shadowShader, geometryShader, maxBatchSize, 
            (s, batchLen) => {
                model.render(
                    s, this.target, Renderer.TEXTURE_UNIFORM,
                    batchLen, depthTesting
                );
            }
        );
    }

    renderGeometry(
        geometry, texture, instances,
        shadowShader, geometryShader, 
        depthTesting = DepthTesting.ENABLED,
        maxBatchSize = 64
    ) {
        this.renderInstanced(
            instances, shadowShader, geometryShader, maxBatchSize, 
            (s, batchLen) => {
                s.setUniform(Renderer.TEXTURE_UNIFORM, texture);
                geometry.render(s, this.target, batchLen, depthTesting);
            }
        );
    }

}