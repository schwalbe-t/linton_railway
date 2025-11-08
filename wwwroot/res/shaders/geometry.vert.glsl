
#include "common/renderer.h.glsl"

layout(location = 0) in vec3 vLocalPosition;
layout(location = 1) in vec3 vLocalNormal;
layout(location = 2) in vec2 vTexCoords;

#define MAX_INSTANCE_COUNT 64
uniform mat4 uInstances[MAX_INSTANCE_COUNT];

out vec3 fLocalPosition;
out vec3 fWorldPosition;
out vec3 fWorldNormal;
out vec2 fTexCoords;

void main() {
    mat4 instance = uInstances[gl_InstanceID];
    fLocalPosition = vLocalPosition;
    vec4 worldPosition = instance * vec4(vLocalPosition, 1.0);
    gl_Position = uViewProj * worldPosition;
    fWorldPosition = worldPosition.xyz;
    fWorldNormal = mat3(instance) * vLocalNormal;
    fTexCoords = vTexCoords;
}