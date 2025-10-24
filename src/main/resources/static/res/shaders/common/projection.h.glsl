
#ifndef LINTON_PROJECTION_H
#define LINTON_PROJECTION_H


// This set of functions is to emulate what happens with 'gl_Position' on the
// GPU, which is required for shadow mapping.
// 'gl_Position' is in clip space, which is converted to NDC
// (normalized device coordinates) by performing the perspective divide.
// NDC can then be freely converted to UV or the standard depth range.


vec3 clipspaceToNdc(vec4 clipspacePos) {
    return clipspacePos.xyz / clipspacePos.w;
}

vec2 ndcToUv(vec3 ndcPos) {
    return ndcPos.xy * 0.5 + 0.5;
}

float ndcToDepth(vec3 ndcPos) {
    return ndcPos.z * 0.5 + 0.5;
}

#endif
