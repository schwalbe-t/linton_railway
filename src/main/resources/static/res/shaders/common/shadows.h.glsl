
#ifndef LINTON_SHADOWS_H
#define LINTON_SHADOWS_H

#include "renderer.h.glsl"
#include "projection.h.glsl"


bool isInShadow(vec3 worldPosition, vec3 surfaceNormal, bool oobShadow) {
    vec3 surfacePosition = worldPosition + surfaceNormal * uNormalOffset;
    vec4 clipPosition = uLightProj * vec4(surfacePosition, 1.0);
    vec3 ndcPosition = clipspaceToNdc(clipPosition);
    vec2 uvPosition = ndcToUv(ndcPosition);
    bool inSunRange = 0.0 <= uvPosition.x && uvPosition.x <= 1.0
        && 0.0 <= uvPosition.y && uvPosition.y <= 1.0;
    if(!inSunRange) { return oobShadow; }
    float surfaceDepth = ndcToDepth(ndcPosition);
    float lightDepth = texture(uShadowMap, uvPosition).r;
    return surfaceDepth > lightDepth + uDepthBias;
}


#endif
