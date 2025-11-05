
#include "common/renderer.h.glsl"
#include "common/rotation.h.glsl"

layout(location = 0) in vec3 vLocalPosition;
layout(location = 1) in vec3 vLocalNormal;
layout(location = 2) in vec2 vTexCoords;

#define MAX_INSTANCE_COUNT 4096
layout(std140) uniform uInstances {
    vec4 instances[MAX_INSTANCE_COUNT];
};

out vec3 fWorldPosition;
out vec3 fWorldNormal;
out vec2 fTexCoords;

void main() {
    vec4 instance = instances[gl_InstanceID];
    fWorldPosition = rotateY(vLocalPosition, instance.w)
        + instance.xyz;
    fWorldNormal = rotateY(vLocalNormal, instance.w);
    fTexCoords = vTexCoords;
    gl_Position = uViewProj * vec4(fWorldPosition, 1.0);
}