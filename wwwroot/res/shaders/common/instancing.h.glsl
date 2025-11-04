
#ifndef LINTON_INSTANCING_H
#define LINTON_INSTANCING_H


#ifndef INSTANCE_TYPE
    #define INSTANCE_TYPE mat4
#endif

#ifndef MAX_INSTANCE_COUNT
    #define MAX_INSTANCE_COUNT 64
#endif

uniform INSTANCE_TYPE uInstances[MAX_INSTANCE_COUNT];


#endif
