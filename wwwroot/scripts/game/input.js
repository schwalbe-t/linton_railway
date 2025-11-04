
if (window.pressingKeys === undefined) {
    const pressingKeys = new Set();
    window.pressingKeys = pressingKeys;

    document.addEventListener("keydown", e => pressingKeys.add(e.code));
    document.addEventListener("keyup", e => pressingKeys.delete(e.code));
}

if (window.scrollDelta === undefined) {
    window.scrollDelta = 0.0;

    document.addEventListener("wheel", e => {
        let delta = e.deltaY;
        switch (e.deltaMode) {
            case WheelEvent.DOM_DELTA_PIXEL: break;
            case WheelEvent.DOM_DELTA_LINE: delta *= 16; break;
            case WheelEvent.DOM_DELTA_PAGE: delta *= window.innerHeight; break;
        }
        window.scrollDelta += delta / 100.0; // approximately one "notch"
    });
}

export const key = Object.freeze({

    isDown: key => window.pressingKeys.has(key)

});

export const mouse = Object.freeze({

    scrollDelta: () => window.scrollDelta

});

export function resetInput() {
    window.scrollDelta = 0.0;
}