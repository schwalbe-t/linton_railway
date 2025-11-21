
#ifndef LINTON_REGIONS_H
#define LINTON_REGIONS_H


const vec4 REG_CLIENT_BASE = vec4(0.0, 0.0, 0.0, 0.0);
const vec4 REG_CLIENT_FACTORS = vec4(1.0, 1.0, 1.0, 1.0);
const float REG_CLIENT_VAL = 1.0;

const vec4 REG_ENEMY_BASE = vec4(0.0, 0.0, 0.0, 0.0);
const vec4 REG_ENEMY_FACTORS = vec4(0.80, 0.90, 1.07, 1.0);
const float REG_ENEMY_VAL = 0.5;

const vec4 REG_UNKNOWN_BASE = vec4(110.0, 114.0, 97.0, 255.0) / 255.0;
const vec4 REG_UNKNOWN_FACTORS = vec4(0.1, 0.1, 0.1, 1.0);
const float REG_UNKNOWN_VAL = 0.0;

vec4 withRegionColorFilter(vec4 baseColor, vec3 worldPos) {
    return baseColor;
}

// vec4 withRegionColorFilter(vec4 baseColor, vec3 worldPos) {
//     vec2 texCoords = worldPos.xz / uWorldSizeU;
//     float region = texture(uTileRegions, texCoords).r;
//     float c = REG_ENEMY_VAL;
//     if (region <= c) {
//         vec4 enemyColor = REG_ENEMY_BASE + baseColor * REG_ENEMY_FACTORS;
//         vec4 unknownColor = REG_UNKNOWN_BASE + baseColor * REG_UNKNOWN_FACTORS;
//         return mix(unknownColor, enemyColor, region / c);
//     } else {
//         vec4 clientColor = REG_CLIENT_BASE + baseColor * REG_CLIENT_FACTORS;
//         vec4 enemyColor = REG_ENEMY_BASE + baseColor * REG_ENEMY_FACTORS;
//         return mix(enemyColor, clientColor, (region - c) / c);
//     }
// }


#endif