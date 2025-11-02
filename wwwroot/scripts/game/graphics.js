
import { 
    Vector2, Vector3, Vector4, Matrix3, Matrix4 
} from "../libs/math.gl.js";



let canvas = null;
let gl = null;
let initHandlers = [];

export function onGraphicsInit(f) {
    if (gl !== null) {
        f()
    } else {
        initHandlers.push(f);
    }
}

export const GRAPHICS_INIT = new Promise(r => onGraphicsInit(r));

export function initGraphics(canvasElement) {
    canvas = canvasElement;
    gl = canvas.getContext("webgl2");
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    initHandlers.forEach(f => f());
    initHandlers = [];
}

export function updateGraphics() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width || canvas.height !== height) {
        // size of canvas has changed
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        if (AbstractFramebuffer.bound === defaultFramebuffer) {
            // Re-bind the default buffer if it's the current buffer
            // since its size has changed and we therefore need another call
            // to 'gl.viewport'
            AbstractFramebuffer.bound = null;
        }
    }
}



const readText = filePath => fetch(filePath)
    .then(r => r.text());



const SHADER_INCL = "#include \"";

const SHADER_PRE = "#version 300 es\n"
    + "precision highp float;\n";

function expandShaderIncludes(source, path) {
    const dir = path.split("/")
        .filter(f => f.length > 0)
        .slice(0, -1)
        .join("/");
    return source.split("\n").map(line => {
        if (!line.startsWith(SHADER_INCL)) {
            return line;
        }
        const inclPathEnd = line.indexOf("\"", SHADER_INCL.length);
        const inclPath = line.substring(SHADER_INCL.length, inclPathEnd);
        const absInclPath = "/" + dir + "/" + inclPath;
        return fetch(absInclPath)
            .then(res => res.text())
            .then(src => expandShaderIncludes(src, absInclPath));
    });
}

async function awaitShaderIncludes(lines) {
    for (let lineI = 0; lineI < lines.length; lineI += 1) {
        const line = lines[lineI];
        if (typeof line === "string") { continue; }
        const repl = await line;
        lines[lineI] = await awaitShaderIncludes(repl);
    }
    return lines.join("\n");
}

const preprocessShader = async (src, path) => SHADER_PRE
    + await awaitShaderIncludes(expandShaderIncludes(src, path));

function compileShader(src, shaderType) {
    const shader = gl.createShader(shaderType);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return shader;
}

export class Shader {

    static async loadGlsl(vertexPath, fragmentPath) {
        const vertexSrcReq = readText(vertexPath);
        const fragmentSrcReq = readText(fragmentPath);
        await GRAPHICS_INIT;
        const vertexSrc = await vertexSrcReq;
        const fragmentSrc = await fragmentSrcReq;
        const vertExpReq = preprocessShader(vertexSrc, vertexPath);
        const fragExpReq = preprocessShader(fragmentSrc, fragmentPath);
        const vertExpSrc = await vertExpReq;
        const fragExpSrc = await fragExpReq;
        return new Shader(vertExpSrc, fragExpSrc, vertexPath, fragmentPath);
    }

    constructor(
        vertexSrc, fragmentSrc, 
        vertexPath = "unknown.vert.glsl", fragmentPath = "unknown.frag.glsl"
    ) { 
        const vertexShader = compileShader(vertexSrc, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(fragmentSrc, gl.FRAGMENT_SHADER);
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
        const linked = gl.getProgramParameter(this.program, gl.LINK_STATUS);
        if (!linked) {
            console.error("Shader compilation failed!");
            console.error(`=== Linking ===\n`
                + gl.getProgramInfoLog(this.program)
            );
            console.error(`=== Vertex Shader '${vertexPath}' ===\n`
                + gl.getShaderInfoLog(vertexShader)
            );
            console.error(`=== Fragment Shader '${fragmentPath} ===\n'`
                + gl.getShaderInfoLog(fragmentShader)
            );
            console.error(`=== Source for '${vertexPath}' ===\n`
                + vertexSrc
            );
            console.error(`=== Source for '${fragmentPath}' ===\n`
                + fragmentSrc
            );
            throw new Error("Shader compilation failed");
        }
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        this.uniforms = {};
        this.textures = [];
    }

    allocateTexSlot(name, texture) {
        for (let slot = 0; slot < this.textures.length; slot += 1) {
            const entry = this.textures[slot];
            if (entry.name !== name) { continue; }
            entry.texture = texture;
            return slot;
        }
        const slot = this.textures.length;
        this.textures.push({ name, texture });
        return slot;
    }
    
    setUniform(name, value) {
        this.partBind();
        let loc = this.uniforms[name];
        if (loc === undefined) {
            loc = gl.getUniformLocation(this.program, name);
            this.uniforms[name] = loc;
        }
        if (loc === null) {
            // fail silently - may have been optimized away
            return;
        }
        let isArray = false;
        if (typeof value === "number") {
            gl.uniform1f(loc, value);
        } else if (value instanceof Vector2) {
            gl.uniform2f(loc, value.x, value.y);
        } else if (value instanceof Vector3) {
            gl.uniform3f(loc, value.x, value.y, value.z);
        } else if (value instanceof Vector4) {
            gl.uniform4f(loc, value.x, value.y, value.z, value.w);
        } else if (value instanceof Matrix3) {
            gl.uniformMatrix3fv(loc, false, new Float32Array(value));
        } else if (value instanceof Matrix4) {
            gl.uniformMatrix4fv(loc, false, new Float32Array(value));
        } else if (value instanceof Texture) {
            const texture = value.texture;
            const slot = this.allocateTexSlot(name, texture);
            gl.activeTexture(gl.TEXTURE0 + slot);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(loc, slot);
        } else if (Array.isArray(value)) {
            isArray = true;
        } else {
            throw new Error("Uniform value type is unsupported");
        }
        if (!isArray) { return; }
        if (value.length === 0) { return; }
        const first = value[0];
        if (typeof first === "number") {
            gl.uniform1fv(loc, new Float32Array(value));
        } else if (first instanceof Vector2) {
            gl.uniform2fv(loc, new Float32Array(value.flat()));
        } else if (first instanceof Vector3) {
            gl.uniform3fv(loc, new Float32Array(value.flat()));
        } else if (first instanceof Vector4) {
            gl.uniform4fv(loc, new Float32Array(value.flat()));
        } else if (first instanceof Matrix3) {
            gl.uniformMatrix3fv(loc, false, new Float32Array(value.flat()));
        } else if (first instanceof Matrix4) {
            gl.uniformMatrix4fv(loc, false, new Float32Array(value.flat()));
        } else {
            throw new Error("Uniform array value type is unsupported");
        }
    }

    // used to reduce unneeded re-binding
    static partlyBound = null;
    static fullyBound = null;

    // binds only the shader program itself if needed
    partBind() {
        if (Shader.partlyBound === this) { return; }
        gl.useProgram(this.program);
        Shader.partlyBound = this;
    }

    // binds both program and texture slots if needed
    fullBind() {
        if (Shader.fullyBound === this) { return; }
        this.partBind();
        for (let slot = 0; slot < this.textures.length; slot += 1) {
            const entry = this.textures[slot];
            gl.activeTexture(gl.TEXTURE0 + slot);
            gl.bindTexture(gl.TEXTURE_2D, entry.texture);
        }
        Shader.fullyBound = this;
    }

    delete() {
        if (this.program !== null) { gl.deleteProgram(this.program); }
        this.program = null;
    }
    
}



export const DepthTesting = Object.freeze({

    current: { enabled: false },

    ENABLED: Object.freeze({
        enabled: true,
        apply: function() {
            if (DepthTesting.current.enabled) { return; }
            gl.enable(gl.DEPTH_TEST);
        }
    }),

    DISABLED: Object.freeze({
        enabled: false, 
        apply: function() {
            if (!DepthTesting.current.enabled) { return; }
            gl.disable(gl.DEPTH_TEST);
        }
    })

});



export const ObjProperty = Object.freeze({
    Position: { size: 3, objIdxPos: 0, buffer: (p, t, n) => p },
    TexCoord: { size: 2, objIdxPos: 1, buffer: (p, t, n) => t },
    Normal:   { size: 3, objIdxPos: 2, buffer: (p, t, n) => n }
});

export class Geometry {

    // very basic Obj parser:
    // - no support for materials
    // - no support for multiple meshes
    static async loadObj(layout, path) {
        const objTextReq = readText(path);
        await GRAPHICS_INIT;
        const objText = await objTextReq;
        const positions = [];
        const texCoords = [];
        const normals = [];
        let vertexCount = 0;
        const vertData = [];
        const elemData = [];
        for (const line of objText.split("\n")) {
            const elems = line.split("#")[0].split(" ");
            const parseVertex = elem => {
                const indices = elem.split("/").map(Number);
                for (const property of layout) {
                    const index = indices[property.objIdxPos] - 1;
                    const buf = property.buffer(positions, texCoords, normals);
                    vertData.push(...buf[index]);
                }
                let vertIdx = vertexCount;
                vertexCount += 1;
                return vertIdx;
            };
            switch (elems[0]) {
                case "v":
                    positions.push(elems.slice(1, 4).map(Number));
                    break;
                case "vt":
                    texCoords.push(elems.slice(1, 3).map(Number));
                    break;
                case "vn":
                    normals.push(elems.slice(1, 4).map(Number));
                    break;
                case "f":
                    const indices = elems.slice(1).map(parseVertex);
                    if (indices.length === 3) {
                        elemData.push(indices[0], indices[1], indices[2]);
                        break;
                    }
                    if (indices.length === 4) {
                        elemData.push(indices[0], indices[1], indices[2]);
                        elemData.push(indices[0], indices[2], indices[3]);
                        break;
                    }
                    for (let i = 1; i < indices.length - 1; i += 1) {
                        elemData.push(indices[0], indices[i], indices[i + 1]);
                    }
                    break;
            }
        }
        return new Geometry(layout.map(p => p.size), vertData, elemData);
    }
    
    static bound = null;

    constructor(layout, vertData, elemData) {
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);
        this.vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(
            gl.ARRAY_BUFFER, new Float32Array(vertData), gl.STATIC_DRAW
        );
        this.ebo = gl.createBuffer();
        this.indexCount = elemData.length;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
        gl.bufferData(
            gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(elemData), gl.STATIC_DRAW
        );
        const stride = layout.reduce((acc, size) => acc + (size * 4), 0);
        let byteOffset = 0;
        for (let attrib = 0; attrib < layout.length; attrib += 1) {
            const size = layout[attrib];
            gl.enableVertexAttribArray(attrib);
            gl.vertexAttribPointer(
                attrib, size, gl.FLOAT, false, stride, byteOffset
            );
            byteOffset += size * 4;
        }
        Geometry.bound = null;
    }

    bind() {
        if (Geometry.bound === this) { return; }
        gl.bindVertexArray(this.vao);
        Geometry.bound = this;
    }

    render(
        shader, framebuffer, 
        instanceCount = 1, depthTesting = DepthTesting.ENABLED
    ) {
        depthTesting.apply();
        framebuffer.bind();
        shader.fullBind();
        this.bind();
        if (instanceCount > 1) {
            gl.drawElementsInstanced(
                gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0, 
                instanceCount
            );
        } else {
            gl.drawElements(
                gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0
            );
        }
    }

    delete() {
        if (this.vao !== null) { gl.deleteVertexArray(this.vao); }
        if (this.vbo !== null) { gl.deleteBuffer(this.vbo); }
        if (this.ebo !== null) { gl.deleteBuffer(this.ebo); }
        this.vao = null;
        this.vbo = null;
        this.ebo = null;
    }
    
}



export const TextureFormat = Object.freeze({
    R8:     { fmt: () => gl.RED,  iFmt: () => gl.R8,     chType: () => gl.UNSIGNED_BYTE  },
    RG8:    { fmt: () => gl.RG,   iFmt: () => gl.RG8,    chType: () => gl.UNSIGNED_BYTE  },
    RGB8:   { fmt: () => gl.RGB,  iFmt: () => gl.RGB8,   chType: () => gl.UNSIGNED_BYTE  },
    RGBA8:  { fmt: () => gl.RGBA, iFmt: () => gl.RGBA8,  chType: () => gl.UNSIGNED_BYTE  },
    DEPTH16: { 
        fmt: () => gl.DEPTH_COMPONENT, iFmt: () => gl.DEPTH_COMPONENT16,  
        chType: () => gl.UNSIGNED_SHORT
    },
    DEPTH24: { 
        fmt: () => gl.DEPTH_COMPONENT, iFmt: () => gl.DEPTH_COMPONENT24,  
        chType: () => gl.UNSIGNED_INT
    },
    DEPTH32: { 
        fmt: () => gl.DEPTH_COMPONENT, iFmt: () => gl.DEPTH_COMPONENT32F,  
        chType: () => gl.FLOAT
    }
});

export const TextureFilter = Object.freeze({
    LINEAR:  { value: () => gl.LINEAR },
    NEAREST: { value: () => gl.NEAREST }
});

export class Texture {

    static async loadImage(
        path, format = TextureFormat.RGB8, filter = TextureFilter.NEAREST
    ) {
        const img = new Image();
        const imgLoaded = new Promise(r => { img.onload = r; });
        img.src = path;
        await GRAPHICS_INIT;
        await imgLoaded;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(
            gl.TEXTURE_2D, 0, format.iFmt(), format.fmt(), format.chType(), img
        )
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter.value());
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter.value());
        return new Texture(texture, img.width, img.height);
    }

    static withSize(width, height, format, filter = TextureFilter.NEAREST) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D, 0, format.iFmt(), width, height, 0, 
            format.fmt(), format.chType(), null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter.value());
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter.value());
        return new Texture(texture, width, height);
    }

    constructor(texture, width, height) {
        this.texture = texture;
        this.width = width;
        this.height = height;
    }

    delete() {
        if (this.texture !== null) { gl.deleteTexture(this.texture); }
        this.texture = null;
    }

}



export class Model {

    static async loadMeshes(layout, meshes) {
        const meshPromises = meshes.map(async mesh => {
            const geometryReq = Geometry.loadObj(
                layout, mesh.obj
            )
            const textureReq = Texture.loadImage(
                mesh.tex, mesh.texFormat, mesh.texFilter 
            );
            return {
                geometry: await geometryReq,
                texture: await textureReq
            };
        });
        const loadedMeshes = (await Promise.allSettled(meshPromises))
            .map(p => p.value);
        return new Model(loadedMeshes);
    }

    constructor(meshes) {
        this.meshes = meshes;
    }

    render(
        shader, framebuffer,
        textureUniformName = undefined,
        instanceCount = 1, depthTesting = DepthTesting.ENABLED,
    ) {
        for (const mesh of this.meshes) {
            if (textureUniformName !== undefined) {
                shader.setUniform(textureUniformName, mesh.texture);
            }
            mesh.geometry.render(
                shader, framebuffer, instanceCount, depthTesting
            );
        }
    }

    delete() {
        this.meshes.forEach(mesh => {
            mesh.geometry.delete();
            mesh.texture.delete();
        });
        this.meshes = [];
    }

}



export class AbstractFramebuffer {

    static bound = null;

    bindImpl() {
        throw new Error("'AbstractFramebuffer.bindImpl' not implemented!");
    }

    bind() {
        if (AbstractFramebuffer.bound === this) { return; }
        this.bindImpl();
        gl.viewport(0, 0, this.width, this.height);
        AbstractFramebuffer.bound = this;
    }

    clearColor(color) {
        this.bind();
        gl.clearColor(color.x, color.y, color.z, color.w);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    clearDepth(depth) {
        this.bind();
        gl.clearDepth(depth);
        gl.clear(gl.DEPTH_BUFFER_BIT);
    }

}

class DefaultFramebuffer extends AbstractFramebuffer {

    bindImpl() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    get width() { return canvas.width; }
    get height() { return canvas.height; }

}

export const defaultFramebuffer = new DefaultFramebuffer();

export class Framebuffer extends AbstractFramebuffer {

    constructor() {
        super();
        this.fbo = gl.createFramebuffer();
        this.color = null;
        this.depth = null;
    }

    assertMatchingSize() {
        if (this.color === null || this.depth === null) { return; }
        const matchingSize = this.color.width === this.depth.width
            && this.color.height === this.depth.height;
        if (matchingSize) { return; }
        throw new Error(
            `Attached color is ${this.color.width}x${this.color.height}, `
                + `but depth is ${this.depth.width}x${this.depth.height}`
        );
    }

    setColor(texture = null) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            texture !== null? texture.texture : null,
            0
        );
        this.color = texture;
        this.assertMatchingSize();
        AbstractFramebuffer.bound = null;
    }

    setDepth(texture = null) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.DEPTH_ATTACHMENT,
            gl.TEXTURE_2D,
            texture !== null? texture.texture : null,
            0
        );
        this.depth = texture;
        this.assertMatchingSize();
        AbstractFramebuffer.bound = null;
    }

    bindImpl() {
        if (this.color === null && this.depth === null) {
            throw new Error("Framebuffer is empty");
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    }

    get width() {
        return this.color !== null? this.color.width
            : this.depth !== null? this.depth.width
            : 0;
    }

    get height() {
        return this.color !== null? this.color.height
            : this.depth !== null? this.depth.height
            : 0;
    }

    delete() {
        if (this.fbo !== null) { gl.deleteFramebuffer(this.fbo); }
        this.fbo = null;
        this.color = null;
        this.depth = null;
    }

}