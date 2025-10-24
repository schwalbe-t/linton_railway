
#ifndef LINTON_DIFFUSE_H
#define LINTON_DIFFUSE_H

#include "renderer.h.glsl"


float diffuseIntensityOf(vec3 normal) {
    return dot(normalize(normal), -uSunDirection);
}


#endif
