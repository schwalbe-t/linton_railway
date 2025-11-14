
#include "common/renderer.h.glsl"
#include "common/rotation.h.glsl"

layout(location = 0) in vec3 vLocalPosition;
layout(location = 1) in vec3 vLocalNormal;
layout(location = 2) in vec2 vTexCoords;

#define MAX_INSTANCE_COUNT 4000
layout(std140) uniform uInstances {
    vec4 instances[MAX_INSTANCE_COUNT];
};

out vec3 fLocalPosition;
out vec3 fWorldPosition;
out vec3 fWorldNormal;
out vec2 fTexCoords;

uniform bool uSwayingTrees;

const float HEIGHT_SWAY_SCALE = 1.0/16.0;
const float ORIGIN_DIST_TIME_OFFSET = 1.0/8.0;
const float SWAY_SPEED_1 = 1.0;
const vec3 SWAY_DIRECTION_1 = normalize(vec3(1.0, 0.0, 1.0));
const float SWAY_SPEED_2 = 0.5;
const vec3 SWAY_DIRECTION_2 = normalize(vec3(-1.0, 0.0, 0.0));

void main() {
    vec4 instance = instances[gl_InstanceID];
    fLocalPosition = vLocalPosition;
    vec3 baseWorldPosition = rotateY(vLocalPosition, instance.w)
        + instance.xyz;
    float swayScale = vLocalPosition.y * HEIGHT_SWAY_SCALE;
    float swayTime = 0.0;
    if (uSwayingTrees) {
        swayTime = uTime - length(baseWorldPosition) * ORIGIN_DIST_TIME_OFFSET;
    }
    vec3 windOffset
        = swayScale * sin(swayTime * SWAY_SPEED_1) * SWAY_DIRECTION_1
        + swayScale * sin(swayTime * SWAY_SPEED_2) * SWAY_DIRECTION_2;
    fWorldPosition = baseWorldPosition + windOffset;
    fWorldNormal = rotateY(vLocalNormal, instance.w);
    fTexCoords = vTexCoords;
    gl_Position = uViewProj * vec4(fWorldPosition, 1.0);
}