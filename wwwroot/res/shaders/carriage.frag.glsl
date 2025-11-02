
#include "common/renderer.h.glsl"
#include "common/shading.h.glsl"

in vec3 fWorldPosition;
in vec3 fWorldNormal;
in vec2 fTexCoords;

const vec3 PLACEHOLDER = vec3(1.0, 0.0, 1.0);
const float PLACEHOLDER_DIST = 0.1;
uniform vec3 uCarriageColor;

out vec4 oColor;

void main() {
    oColor = texture(uTexture, fTexCoords);
    if (oColor.a == 0.0) { discard; }
    if (length(oColor.rgb - PLACEHOLDER) <= PLACEHOLDER_DIST) {
        oColor.rgb = uCarriageColor;
    }
    oColor = shadedColor(oColor, fWorldPosition, fWorldNormal);
}