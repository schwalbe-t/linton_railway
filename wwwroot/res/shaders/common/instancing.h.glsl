
#ifndef LINTON_INSTANCING_H
#define LINTON_INSTANCING_H


#ifndef INSTANCE_TYPE
    #define INSTANCE_TYPE mat4
#endif

#ifndef MAX_INSTANCE_COUNT
    // #define MAX_INSTANCE_COUNT 1024
    #define MAX_INSTANCE_COUNT 64
#endif

// layout(std140) uniform InstanceBlock {
//     INSTANCE_TYPE uInstances[MAX_INSTANCE_COUNT];
// }

uniform INSTANCE_TYPE uInstances[MAX_INSTANCE_COUNT];



#endif
