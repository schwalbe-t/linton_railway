
#ifndef LINTON_BORDERS_H
#define LINTON_BORDERS_H


const vec4 BORDER_FADEOUT_COLOR = vec4(110.0, 114.0, 97.0, 255.0) / 255.0;
const float BORDER_FADEOUT_DIST = 20.0;

vec4 withBorderFadeout(vec4 baseColor, vec3 worldPos) {
    float trueDist = min(
        min(abs(worldPos.x), abs(worldPos.x - uWorldSizeU)),
        min(abs(worldPos.z), abs(worldPos.z - uWorldSizeU))
    );
    float n = min(trueDist / BORDER_FADEOUT_DIST, 1.0);
    return mix(BORDER_FADEOUT_COLOR, baseColor, n);
}


#endif