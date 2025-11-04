
#include "common/renderer.h.glsl"
#include "common/shading.h.glsl"

in vec3 fWorldPosition;
in vec3 fWorldNormal;
in vec2 fTexCoords;

out vec4 oColor;

const vec4 WATER_COLOR = vec4(133.0, 182.0, 154.0, 255.0) / 255.0;

void main() {
    oColor = shadedColor(WATER_COLOR, fWorldPosition, fWorldNormal);
}