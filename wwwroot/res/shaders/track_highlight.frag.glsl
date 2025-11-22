
#include "common/renderer.h.glsl"
#include "common/borders.h.glsl"

in vec3 fWorldPosition;
in vec3 fWorldNormal;
in vec2 fTexCoords;

out vec4 oColor;

const vec4 HIGHLIGHT_COLOR = vec4(178.0, 178.0, 178.0, 255.0) / 255.0;

void main() {
    oColor = HIGHLIGHT_COLOR;
}