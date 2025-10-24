
#ifndef LINTON_SHADING_H
#define LINTON_SHADING_H

#include "diffuse.h.glsl"
#include "shadows.h.glsl"


const float DIFFUSE_LIMIT = 0.35;
const vec3 SHADOW_FACTOR = vec3(0.7, 0.85, 1.1);

vec4 shadedColor(vec4 color, vec3 worldPos, vec3 worldNormal) {
    bool inShadow = diffuseIntensityOf(worldNormal) < DIFFUSE_LIMIT
        || isInShadow(worldPos, worldNormal);
    if(!inShadow) { return color; }
    return vec4(color.rgb * SHADOW_FACTOR, color.a);
}


#endif
