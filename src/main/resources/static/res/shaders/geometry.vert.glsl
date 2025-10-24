
#include "common/renderer.h.glsl"

layout(location = 0) in vec3 vLocalPosition;
layout(location = 1) in vec3 vLocalNormal;
layout(location = 2) in vec2 vTexCoords;

out vec3 fWorldPosition;
out vec3 fWorldNormal;
out vec2 fTexCoords;

void main() {
    vec4 worldPosition
        = uModelTransfs[gl_InstanceID]
        * vec4(vLocalPosition, 1.0);
    gl_Position = uViewProj * worldPosition;
    fWorldPosition = worldPosition.xyz;
    fWorldNormal
        = mat3(uModelTransfs[gl_InstanceID])
        * vLocalNormal;
    fTexCoords = vTexCoords;
}