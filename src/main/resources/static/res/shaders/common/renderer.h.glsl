
#ifndef LINTON_RENDERER_H
#define LINTON_RENDERER_H


const int MAX_INSTANCE_COUNT = 64;

uniform mat4 uViewProj;
uniform mat4 uLightProj;
uniform sampler2D uShadowMap;
uniform vec3 uSunDirection;
uniform float uDepthBias;
uniform float uNormalOffset;
uniform mat4 uModelTransfs[MAX_INSTANCE_COUNT];
uniform sampler2D uTexture;


#endif
