
import { Vector3 } from "../libs/math.gl.js";
import { defaultFramebuffer } from "./graphics.js";


export const getWorldUiContainer = () => document
    .getElementById("game-world-interacts");


export class WorldUi {

    constructor(worldPos, element) {
        this.pos = worldPos;
        this.element = element;
        getWorldUiContainer().appendChild(this.element);
    }

    static MAX_Z_INDEX = 100000;

    update(renderer, buffer = defaultFramebuffer) {
        const screenPos = new Vector3(
            renderer.viewProj.transformPoint(this.pos)
        );
        screenPos
            .scale([1, -1, 1])
            .scale(0.5).add([0.5, 0.5, 0])
            .scale([buffer.width, buffer.height, 1]);
        this.element.style.left = `${screenPos.x}px`;
        this.element.style.top = `${screenPos.y}px`;
        const zIndex = Math.round((1.0 - screenPos.z) * WorldUi.MAX_Z_INDEX);
        this.element.style.zIndex = `${zIndex}`;
    }

    delete() {
        this.element.remove();
    }

}


export class Signal extends WorldUi {

    constructor(worldPos, onStateChange = _ => {}) {
        super(worldPos, document.createElement("div"));
        this.element.classList.add("game-signal-container");
        this.state = false;
        this.element.classList.add("signal-danger");
        this.element.onclick = () => {
            const newState = !this.state;
            this.setState(newState);
            onStateChange(newState);
        };
    }

    setState(value) {
        const getStateClass = () => this.state
            ? "signal-proceed" : "signal-danger";
        this.element.classList.remove(getStateClass());
        this.state = value;
        this.element.classList.add(getStateClass());
    }

}


export class RegionText extends WorldUi {

    constructor(worldPos, text) {
        super(worldPos, document.createElement("div"));
        this.element.textContent = text;
        this.element.classList.add("game-region-text");
    }

}