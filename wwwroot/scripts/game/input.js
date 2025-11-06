
const pressingKeys = new Set();
document.addEventListener("keydown", e => {
    if (document.activeElement.tagName === "INPUT") { return; }
    pressingKeys.add(e.code);
});
document.addEventListener("keyup", e => {
    if (document.activeElement.tagName === "INPUT") { return; }
    pressingKeys.delete(e.code);
});

export const key = Object.freeze({

    isDown: key => pressingKeys.has(key)

});


let scrollDelta = 0.0;
let hoveringElement = null;
document.addEventListener("wheel", e => {
    if (hoveringElement.tagName !== "CANVAS") {
        scrollDelta = 0.0;
        return;
    } 
    let delta = e.deltaY;
    switch (e.deltaMode) {
        case WheelEvent.DOM_DELTA_PIXEL: break;
        case WheelEvent.DOM_DELTA_LINE: delta *= 16; break;
        case WheelEvent.DOM_DELTA_PAGE: delta *= window.innerHeight; break;
    }
    scrollDelta += delta / 100.0; // approximately one "notch"
});

document.addEventListener("mouseover", e => {
    hoveringElement = e.target;
});

export const mouse = Object.freeze({

    scrollDelta: () => scrollDelta

});


export function resetInput() {
    scrollDelta = 0.0;
    if (document.activeElement.tagName === "INPUT") {
        pressingKeys.clear();
    }
} 