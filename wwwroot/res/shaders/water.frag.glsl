
#include "common/renderer.h.glsl"
#include "common/shading.h.glsl"

in vec3 fWorldPosition;
in vec3 fWorldNormal;
in vec2 fTexCoords;

out vec4 oColor;

uniform sampler2D uNormalMap;
uniform sampler2D uDuDvMap;

const vec4 BASE_COLOR = vec4(133.0, 182.0, 154.0, 255.0) / 255.0;
const vec4 HIGHLIGHT_COLOR = vec4(209.0, 193.0, 158.0, 255.0) / 255.0;
const float HIGHLIGHT_MIN_DIFFUSE = 0.8;

const float SCALE_0 =  2.5;
const float SCALE_1 =  5.0;
const float SCALE_2 = 10.0;
const vec2 OFFSET_0 = normalize(vec2(-0.1, +0.9));
const vec2 OFFSET_1 = normalize(vec2(+0.3, +0.7)); 
const vec2 OFFSET_2 = normalize(vec2(+0.5, -0.4));
const float SPEED_0 = 0.07;
const float SPEED_1 = 0.05;
const float SPEED_2 = 0.03;

vec3 sampleNormal(float scale, vec2 offset, float speed) {
    vec2 uv = mod(fTexCoords * scale + offset * uTime * speed, 1.0);
    vec3 raw = texture(uNormalMap, uv).rgb;
    return raw * 2.0 - 1.0;
}

void main() {
    vec3 tangentNormal = normalize(
        sampleNormal(SCALE_0, OFFSET_0, SPEED_0) +
        sampleNormal(SCALE_1, OFFSET_1, SPEED_1) +
        sampleNormal(SCALE_2, OFFSET_2, SPEED_2)
    );
    vec3 worldNormal = tangentNormal.yzx;
    float diffuse = diffuseIntensityOf(worldNormal);
    if (diffuse >= HIGHLIGHT_MIN_DIFFUSE) {
        oColor = HIGHLIGHT_COLOR;
    } else {
        oColor = shadedColor(BASE_COLOR, fWorldPosition, worldNormal);
    }
}