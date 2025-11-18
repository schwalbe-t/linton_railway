
#include "common/renderer.h.glsl"
#include "common/shading.h.glsl"
#include "common/regions.h.glsl"
#include "common/borders.h.glsl"

in vec3 fWorldPosition;
in vec3 fWorldNormal;
in vec2 fTexCoords;

out vec4 oColor;

void main() {
    vec4 texColor = texture(uTexture, fTexCoords);
    if (texColor.a == 0.0) { discard; }
    vec4 shaded = shadedColor(texColor, fWorldPosition, fWorldNormal);
    vec4 regColor = withRegionColorFilter(shaded, fWorldPosition);
    oColor = withBorderFadeout(regColor, fWorldPosition);
}