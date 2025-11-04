
#ifndef LINTON_ROTATION_H
#define LINTON_ROTATION_H


vec3 rotateY(vec3 v, float a) {
    float s = sin(a);
    float c = cos(a);
    return vec3(
        v.x * c - v.z * s,
        v.y,
        v.x * s + v.z * c
    );
}


#endif