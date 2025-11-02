
#include "common/renderer.h.glsl"

in vec2 fTexCoords;

void main() {
    vec4 texColor = texture(uTexture, fTexCoords);
    if (texColor.a == 0.0) { discard; }
}