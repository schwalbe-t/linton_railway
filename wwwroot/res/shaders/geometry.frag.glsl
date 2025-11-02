
#include "common/renderer.h.glsl"
#include "common/shading.h.glsl"

in vec3 fWorldPosition;
in vec3 fWorldNormal;
in vec2 fTexCoords;

out vec4 oColor;

void main() {
    oColor = texture(uTexture, fTexCoords);
    if (oColor.a == 0.0) { discard; }
    oColor = shadedColor(oColor, fWorldPosition, fWorldNormal);
}