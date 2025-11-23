
#include "common/renderer.h.glsl"
#include "common/shading.h.glsl"
#include "common/regions.h.glsl"
#include "common/borders.h.glsl"

in vec3 fWorldPosition;
in vec3 fWorldNormal;
in vec2 fTexCoords;

out vec4 oColor;

uniform vec4 uTrainColor;

const vec3 PLACEHOLDER_COLOR = vec3(1.0, 0.0, 1.0);
const float MAX_PLACEHOLDER_DIST = 0.1;

vec4 baseColor(vec4 texColor) {
    float phDist = distance(texColor.rgb, PLACEHOLDER_COLOR);
    float isPh = step(phDist, MAX_PLACEHOLDER_DIST);
    return isPh * uTrainColor + (1.0 - isPh) * texColor;
}

void main() {
    vec4 texColor = texture(uTexture, fTexCoords);
    if (texColor.a == 0.0) { discard; }
    vec4 baseColor = baseColor(texColor);
    vec4 shadedColor = shadedColor(baseColor, fWorldPosition, fWorldNormal);
    vec4 regColor = withRegionColorFilter(shadedColor, fWorldPosition);
    oColor = withBorderFadeout(regColor, fWorldPosition);
}