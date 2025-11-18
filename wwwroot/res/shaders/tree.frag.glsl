
#include "common/renderer.h.glsl"
#include "common/regions.h.glsl"
#include "common/borders.h.glsl"

in vec3 fLocalPosition;
in vec3 fWorldPosition;
in vec3 fWorldNormal;
in vec2 fTexCoords;

out vec4 oColor;

const vec3 PLACEHOLDER_COLOR = vec3(1.0, 0.0, 1.0);
const float MAX_PLACEHOLDER_DIST = 0.5;

const vec3 GRADIENT_LOW = vec3(170.0, 116.0, 158.0) / 255.0;
const vec3 GRADIENT_HIGH = vec3(212.0, 164.0, 136.0) / 255.0;

const vec3 GRADIENT_HIGH_SNOW = vec3(209.0, 193.0, 158.0) / 255.0;

const float GRADIENT_LOW_Y = 1.0;
const float GRADIENT_HIGH_Y = 4.5;
const float GRADIENT_RANGE_Y = GRADIENT_HIGH_Y - GRADIENT_LOW_Y;
const float SNOW_MIN_Y = 5.0;

vec3 baseColor(vec3 texColor) {
    if (distance(texColor, PLACEHOLDER_COLOR) > MAX_PLACEHOLDER_DIST) {
        return texColor;
    }
    float a = (fLocalPosition.y - GRADIENT_LOW_Y) / GRADIENT_RANGE_Y;
    float isSnow = step(SNOW_MIN_Y, fWorldPosition.y - fLocalPosition.y);
    vec3 gradientHigh = (1.0 - isSnow) * GRADIENT_HIGH
        + isSnow * GRADIENT_HIGH_SNOW;
    return mix(GRADIENT_LOW, gradientHigh, a);
}

void main() {
    vec4 texColor = texture(uTexture, fTexCoords);
    if (texColor.a == 0.0) { discard; }
    vec4 baseColor = vec4(baseColor(texColor.rgb), texColor.a);
    vec4 regColor = withRegionColorFilter(baseColor, fWorldPosition);
    oColor = withBorderFadeout(regColor, fWorldPosition);
}