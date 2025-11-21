
#include "common/renderer.h.glsl"
#include "common/regions.h.glsl"
#include "common/borders.h.glsl"

in vec3 fWorldPosition;
in vec3 fWorldNormal;
in vec2 fTexCoords;

out vec4 oColor;

const vec4 HIGHLIGHT_COLOR = vec4(209.0, 193.0, 158.0, 255.0) / 255.0;

void main() {
    vec4 regColor = withRegionColorFilter(HIGHLIGHT_COLOR, fWorldPosition);
    oColor = withBorderFadeout(regColor, fWorldPosition);
}