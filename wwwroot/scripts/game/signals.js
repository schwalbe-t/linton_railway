
import { Vector3 } from "../libs/math.gl.js";
import { defaultFramebuffer } from "./graphics.js";

export class Signal {

    constructor(worldPos, onStateChange = _ => {}) {
        this.pos = worldPos;
        this.container = document.createElement("div");
        this.container.classList.add("game-signal-container");
        document.getElementById("game-world-interacts")
            .appendChild(this.container);
        this.state = false;
        this.container.classList.add("signal-danger");
        this.container.onclick = () => {
            const newState = !this.state;
            this.setState(newState);
            onStateChange(newState);
        };
    }

    setState(value) {
        const getStateClass = () => this.state
            ? "signal-proceed" : "signal-danger";
        this.container.classList.remove(getStateClass());
        this.state = value;
        this.container.classList.add(getStateClass());
    }

    static MAX_Z_INDEX = 100000;

    update(renderer) {
        const screenPos = new Vector3(
            renderer.viewProj.transformPoint(this.pos)
        );
        const c = defaultFramebuffer;
        screenPos
            .scale([1, -1, 1])
            .scale(0.5).add([0.5, 0.5, 0])
            .scale([c.width, c.height, 1]);
        this.container.style.left = `${screenPos.x}px`;
        this.container.style.top = `${screenPos.y}px`;
        const zIndex = Math.round((1.0 - screenPos.z) * Signal.MAX_Z_INDEX);
        this.container.style.zIndex = `${zIndex}`;
    }

    delete() {
        this.container.remove();
    }

}