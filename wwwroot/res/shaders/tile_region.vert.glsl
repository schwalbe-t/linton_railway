
layout(location = 0) in vec2 vNdcCoords;
layout(location = 1) in vec2 vTileCoords;

out vec2 fTileCoords;

void main() {
    gl_Position = vec4(vNdcCoords, 0.0, 1.0);
    fTileCoords = vTileCoords;
}