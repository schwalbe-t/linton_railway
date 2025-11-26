
import { Vector3 } from "../libs/math.gl.js";
import { defaultFramebuffer } from "./graphics.js";


export const getWorldUiContainer = () => document
    .getElementById("game-world-interacts");


export class WorldUi {

    constructor(worldPos, element) {
        this.pos = new Vector3(worldPos);
        this.element = element;
        this.oldPxLeft = null;
        this.oldPxTop = null;
        this.oldDepth = null;
        getWorldUiContainer().appendChild(this.element);
    }

    static MAX_Z_INDEX = 100000;

    update(renderer, buffer = defaultFramebuffer) {
        const screenPos = new Vector3(
            renderer.viewProj.transformPoint(this.pos)
        );
        const shouldBeHidden = Math.abs(screenPos.x) >= 1.25
            || Math.abs(screenPos.z) >= 1.25;
        if (shouldBeHidden) {
            this.element.style.display = "none";
            this.oldPxLeft = null;
            this.oldPxTop = null;
            this.oldDepth = null;
            return;
        }
        this.element.style.display = "";
        screenPos
            .scale([1, -1, 1])
            .scale(0.5).add([0.5, 0.5, 0])
            .scale([buffer.displayWidth, buffer.displayHeight, 1]);
        if (this.oldPxLeft !== screenPos.x) {
            this.element.style.left = `${screenPos.x}px`;
            this.oldPxLeft = screenPos.x;
        }
        if (this.oldPxTop !== screenPos.y) {
            this.element.style.top = `${screenPos.y}px`;
            this.oldPxTop = screenPos.y;
        }
        if (this.oldDepth !== screenPos.z) {
            const zIndex = (1.0 - screenPos.z) * WorldUi.MAX_Z_INDEX;
            this.element.style.zIndex = `${Math.round(zIndex)}`;
            this.oldDepth = screenPos.z;
        }
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


export class WorldUiText extends WorldUi {

    constructor(worldPos, text = "") {
        super(worldPos, document.createElement("div"));
        this.element.classList.add("game-world-text");
        if (text) { this.setText(text); }
    }

    setText(content) {
        this.element.textContent = content;
    }

}

export class RegionText extends WorldUiText {
    constructor(worldPos, text = "") {
        super(worldPos, text);
        this.element.classList.add("game-region-text");
    }
}

export class TrainText extends WorldUiText {
    constructor(worldPos, text = "") {
        super(worldPos, text);
        this.element.classList.add("game-train-text");
    }
}