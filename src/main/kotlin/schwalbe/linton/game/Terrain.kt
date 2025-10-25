
package schwalbe.linton.game

import kotlin.random.Random
import kotlin.math.*

fun Int.unitsToTiles(): Int  = this / Terrain.UNITS_PER_TILE
fun Int.unitsToChunks(): Int = this / Terrain.UNITS_PER_CHUNK
fun Int.tilesToChunks(): Int = this / Terrain.TILES_PER_CHUNK
fun Int.tilesToUnits(): Int  = this * Terrain.UNITS_PER_TILE
fun Int.chunksToUnits(): Int = this * Terrain.UNITS_PER_CHUNK
fun Int.chunksToTiles(): Int = this * Terrain.TILES_PER_CHUNK

fun Float.unitsToTiles(): Float  = this / Terrain.UNITS_PER_TILE .toFloat()
fun Float.unitsToChunks(): Float = this / Terrain.UNITS_PER_CHUNK.toFloat()
fun Float.tilesToChunks(): Float = this / Terrain.TILES_PER_CHUNK.toFloat()
fun Float.tilesToUnits(): Float  = this * Terrain.UNITS_PER_TILE .toFloat()
fun Float.chunksToUnits(): Float = this * Terrain.UNITS_PER_CHUNK.toFloat()
fun Float.chunksToTiles(): Float = this * Terrain.TILES_PER_CHUNK.toFloat()

class Terrain(seed: Int, playerCount: Int) {

    companion object {
        val REGIONS_PER_PLAYER: Int = 10

        val UNITS_PER_TILE: Int = 10
        val TILES_PER_CHUNK: Int = 10
        val UNITS_PER_CHUNK: Int 
            = Terrain.UNITS_PER_TILE * Terrain.TILES_PER_CHUNK
    }

    val sizeU: Int
    val sizeT: Int
    val sizeC: Int

    init {
        val playerRegions: Int = playerCount * Terrain.REGIONS_PER_PLAYER
        this.sizeC = 2 + ceil(sqrt(playerRegions.toFloat())).toInt()
        this.sizeT = this.sizeC.chunksToTiles()
        this.sizeU = this.sizeC.chunksToUnits()
        val rng = Random(seed)
        // TODO: generate stuff
    }

}