
#ifndef LINTON_REGIONS_H
#define LINTON_REGIONS_H


uniform sampler2D uTileRegions;
uniform float uWorldSizeU;

const vec4 REG_CLIENT_COLORS = vec4(1.0, 1.0, 1.0, 1.0);
const float REG_CLIENT_MIN = 0.8;
const vec4 REG_ENEMY_COLORS = vec4(0.5, 0.5, 0.5, 1.0);
const float REG_ENEMY_MIN = 0.3;
const vec4 REG_UNKNOWN_COLORS = vec4(0.1, 0.1, 0.1, 1.0);

vec4 withRegionColorFilter(vec4 baseColor, vec3 worldPos) {
    vec2 texCoords = worldPos.xz / uWorldSizeU;
    float region = texture(uTileRegions, texCoords).r;
    if (region >= REG_CLIENT_MIN) { return baseColor * REG_CLIENT_COLORS; }
    if (region >= REG_ENEMY_MIN) { return baseColor * REG_ENEMY_COLORS; }
    return baseColor * REG_UNKNOWN_COLORS;
}


#endif