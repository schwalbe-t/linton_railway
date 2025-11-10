
import { Vector3 } from "../libs/math.gl.js";
import { key, mouse } from "./input.js";

const MIN_EYE_DIST = 100;
const DEFAULT_EYE_DIST = 140;
const MAX_EYE_DIST = 180;
const EYE_OFFSET = new Vector3(0, 1.5, 1);
const UP = new Vector3(0, 1, 0);

const MOVEMENT_SPEED = 100.0;
const ZOOM_SPEED = 10.0;

let position;
let eyeDist;

init();

export function init() {
    position = new Vector3();
    eyeDist = DEFAULT_EYE_DIST;
}

export function update(deltaTime) {
    const direction = new Vector3();
    if (key.isDown("KeyW") || key.isDown("ArrowUp")) { direction.z -= 1; }
    if (key.isDown("KeyA") || key.isDown("ArrowLeft")) { direction.x -= 1; }
    if (key.isDown("KeyS") || key.isDown("ArrowDown")) { direction.z += 1; }
    if (key.isDown("KeyD") || key.isDown("ArrowRight")) { direction.x += 1; }
    direction.normalize().scale(MOVEMENT_SPEED * deltaTime);
    position.add(direction);
    eyeDist += mouse.scrollDelta() * ZOOM_SPEED;
    eyeDist = Math.min(Math.max(eyeDist, MIN_EYE_DIST), MAX_EYE_DIST);
}

export function configureRenderer(renderer) {
    renderer.camera.center.copy(position);
    renderer.camera.eye.copy(EYE_OFFSET)
        .normalize().scale(eyeDist)
        .add(position);
    renderer.camera.up.copy(UP);
    renderer.sunRadius = eyeDist * 1.5;
}