
import { 
    Vector2, Vector3, Vector4, Matrix3, Matrix4 
} from "../libs/math.gl.js";



let canvas = null;
let gl = null;
let initHandlers = [];

export function onGraphicsInit(f) {
    if(gl !== null) {
        f()
    } else {
        initHandlers.push(f);
    }
}

export const GRAPHICS_INIT = new Promise(r => onGraphicsInit(r));

export function initGraphics(canvasElement) {
    canvas = canvasElement;
    gl = canvas.getContext("webgl2");
    initHandlers.forEach(f => f());
    initHandlers = [];
}



const readText = filePath => fetch(filePath)
    .then(r => r.text());



function compileShader(src, shaderType) {
    const shader = gl.createShader(shaderType);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return shader;
}

const SHADER_PRE = "#version 300 es\n"
    + "precision highp float;\n";

export class Shader {

    static async loadGlsl(vertexPath, fragmentPath) {
        const vertexSrcReq = readText(vertexPath);
        const fragmentSrcReq = readText(fragmentPath);
        await GRAPHICS_INIT;
        const vertexSrc = await vertexSrcReq;
        const fragmentSrc = await fragmentSrcReq;
        return new Shader(vertexSrc, fragmentSrc, vertexPath, fragmentPath);
    }

    constructor(
        vertexSrc, fragmentSrc, 
        vertexPath = "<unknown>", fragmentPath = "<unknown>"
    ) {
        const vertExpSrc = SHADER_PRE + vertexSrc;
        const fragExpSrc = SHADER_PRE + fragmentSrc;
        const vertexShader = compileShader(vertExpSrc, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(fragExpSrc, gl.FRAGMENT_SHADER);
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
        const linked = gl.getProgramParameter(this.program, gl.LINK_STATUS);
        if(!linked) {
            throw new Error("Shader compilation failed:\n"
                + `=== Vertex Shader '${vertexPath}' ===\n`
                + gl.getShaderInfoLog(vertexShader) + "\n"
                + `=== Fragment Shader '${fragmentPath} ===\n'`
                + gl.getShaderInfoLog(fragmentShader) + "\n"
                + `=== Linking ===\n`
                + gl.getProgramInfoLog(this.program)
            );
        }
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        this.uniforms = {};
        this.textures = [];
    }

    allocateTexSlot(name, texture) {
        for(let slot = 0; slot < this.textures.length; slot += 1) {
            const entry = this.textures[slot];
            if(entry.name !== name) { continue; }
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
        if(loc === undefined) {
            loc = gl.getUniformLocation(this.program, name);
            this.uniforms[name] = loc;
        }
        if(loc === null) {
            // fail silently - may have been optimized away
            return;
        }
        let isArray = false;
        if(typeof value === "number") {
            gl.uniform1f(loc, value);
        } else if(value instanceof Vector2) {
            gl.uniform2f(loc, value.x, value.y);
        } else if(value instanceof Vector3) {
            gl.uniform3f(loc, value.x, value.y, value.z);
        } else if(value instanceof Vector4) {
            gl.uniform4f(loc, value.x, value.y, value.z, value.w);
        } else if(value instanceof Matrix3) {
            gl.uniformMatrix3fv(loc, false, new Float32Array(value));
        } else if(value instanceof Matrix4) {
            gl.uniformMatrix4fv(loc, false, new Float32Array(value));
        } else if(value instanceof Texture) {
            const texture = value.texture;
            const slot = this.allocateTexSlot(name, texture);
            gl.activeTexture(gl.TEXTURE0 + slot);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(loc, slot);
        } else if(Array.isArray(value)) {
            isArray = true;
        } else {
            throw new Error("Uniform value type is unsupported");
        }
        if(!isArray) { return; }
        if(value.length === 0) { return; }
        const first = value[0];
        if(typeof first === "number") {
            gl.uniform1fv(loc, new Float32Array(value));
        } else if(first instanceof Vector2) {
            gl.uniform2fv(loc, new Float32Array(value.flat()));
        } else if(first instanceof Vector3) {
            gl.uniform3fv(loc, new Float32Array(value.flat()));
        } else if(first instanceof Vector4) {
            gl.uniform4fv(loc, new Float32Array(value.flat()));
        } else if(first instanceof Matrix3) {
            gl.uniformMatrix3fv(loc, false, new Float32Array(value.flat()));
        } else if(first instanceof Matrix4) {
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
        if(Shader.partlyBound === this) { return; }
        gl.useProgram(this.program);
        Shader.partlyBound = this;
    }

    // binds both program and texture slots if needed
    fullBind() {
        if(Shader.fullyBound === this) { return; }
        this.partBind();
        for(let slot = 0; slot < this.textures.length; slot += 1) {
            const entry = this.textures[slot];
            gl.activeTexture(gl.TEXTURE0 + slot);
            gl.bindTexture(gl.TEXTURE_2D, entry.texture);
        }
        Shader.fullyBound = this;
    }

    delete() {
        if(this.program !== null) { gl.deleteProgram(this.program); }
        this.program = null;
    }
    
}



export const DepthTesting = Object.freeze({

    current: { enabled: false },

    ENABLED: Object.freeze({
        enabled: true,
        apply: function() {
            if(DepthTesting.current.enabled) { return; }
            gl.enable(gl.DEPTH_TEST);
        }
    }),

    DISABLED: Object.freeze({
        enabled: false, 
        apply: function() {
            if(!DepthTesting.current.enabled) { return; }
            gl.disable(gl.DEPTH_TEST);
        }
    })

});



export class Geometry {

    static async loadObj(path, layout) {
        const objTextReq = readText(path);
        await GRAPHICS_INIT;
        const objText = await objTextReq;
        // TODO! return new Geometry
        throw "not yet implemented";
    }
    
    static bound = null;

    constructor(vertData, elemData, layout) {
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
        for(let attrib = 0; attrib < layout.length; attrib += 1) {
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
        if(Geometry.bound === this) { return; }
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
        if(instanceCount > 1) {
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
        if(this.vao !== null) { gl.deleteVertexArray(this.vao); }
        if(this.vbo !== null) { gl.deleteBuffer(this.vbo); }
        if(this.ebo !== null) { gl.deleteBuffer(this.ebo); }
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
    CLOSEST: { value: () => gl.CLOSEST }
});

export class Texture {

    static async loadImage(
        path, format = TextureFormat.RGB8, filter = TextureFilter.CLOSEST
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

    static withSize(width, height, format, filter = TextureFilter.CLOSEST) {
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

}



export class AbstractFramebuffer {

    static bound = null;

    constructor(bindImpl) {
        this.bindImpl = bindImpl;
    }

    bind() {
        if(AbstractFramebuffer.bound === this) { return; }
        this.bindImpl();
        gl.viewport(0, 0, this.width, this.height);
        AbstractFramebuffer.bound = this;
    }

    clearColor(color) {
        gl.clearColor(color.x, color.y, color.z, color.w);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    clearDepth(depth) {
        gl.clearDepth(depth);
        gl.clear(gl.DEPTH_BUFFER_BIT);
    }

}

class DefaultFramebuffer extends AbstractFramebuffer {

    constructor() {
        super(() => {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        });
    }

    get width() { return canvas.width; }
    get height() { return canvas.height; }

}

export const defaultFramebuffer = new DefaultFramebuffer();