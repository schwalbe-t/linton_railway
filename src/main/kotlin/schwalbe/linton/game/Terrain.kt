
package schwalbe.linton.game

import kotlin.random.Random
import kotlin.math.*

fun Int.unitsToTiles(): Int   = this / Terrain.UNITS_PER_TILE
fun Int.unitsToRegions(): Int = this / Terrain.UNITS_PER_REGION
fun Int.tilesToRegions(): Int = this / Terrain.TILES_PER_REGION
fun Int.tilesToUnits(): Int   = this * Terrain.UNITS_PER_TILE
fun Int.regionsToUnits(): Int = this * Terrain.UNITS_PER_REGION
fun Int.regionsToTiles(): Int = this * Terrain.TILES_PER_REGION

fun Float.unitsToTiles(): Float   = this / Terrain.UNITS_PER_TILE  .toFloat()
fun Float.unitsToRegions(): Float = this / Terrain.UNITS_PER_REGION.toFloat()
fun Float.tilesToRegions(): Float = this / Terrain.TILES_PER_REGION.toFloat()
fun Float.tilesToUnits(): Float   = this * Terrain.UNITS_PER_TILE  .toFloat()
fun Float.regionsToUnits(): Float = this * Terrain.UNITS_PER_REGION.toFloat()
fun Float.regionsToTiles(): Float = this * Terrain.TILES_PER_REGION.toFloat()

class Terrain(seed: Int, playerCount: Int) {

    companion object {
        val REGIONS_PER_PLAYER: Int = 10

        val UNITS_PER_TILE: Int = 10
        val TILES_PER_REGION: Int = 10
        val UNITS_PER_REGION: Int 
            = Terrain.UNITS_PER_TILE * Terrain.TILES_PER_REGION
    }

    val sizeU: Int
    val sizeT: Int
    val sizeR: Int

    init {
        val playerRegions: Int = playerCount * Terrain.REGIONS_PER_PLAYER
        this.sizeR = 2 + ceil(sqrt(playerRegions.toFloat())).toInt()
        this.sizeT = this.sizeR.regionsToTiles()
        this.sizeU = this.sizeR.regionsToUnits()
        val rng = Random(seed)
        // TODO: generate stuff
    }

}