
package schwalbe.linton.game

import kotlinx.serialization.*
import kotlin.random.Random
import kotlin.math.*
import org.joml.*
import de.articdive.jnoise.generators.noisegen.perlin.PerlinNoiseGenerator
import de.articdive.jnoise.core.api.functions.Interpolation

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


class Terrain(val seed: Int, playerCount: Int) {

    @Serializable
    data class Serialized(
        val seed: Int,
        val sizeC: Int,
        val rivers: List<QuadSpline.Serialized>
    )

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

    val rivers: List<QuadSpline>

    init {
        val playerRegions: Int = playerCount * Terrain.REGIONS_PER_PLAYER
        this.sizeC = 2 + ceil(sqrt(playerRegions.toFloat())).toInt()
        this.sizeT = this.sizeC.chunksToTiles()
        this.sizeU = this.sizeC.chunksToUnits()
        val rng = Random(seed)
        this.rivers = generateRivers(playerCount, seed, rng, this.sizeC)
    }

    fun serialize(): Terrain.Serialized = Terrain.Serialized(
        this.seed, this.sizeC, 
        this.rivers.map { r -> r.serialize() }
    )

}


fun generateRivers(
    numRivers: Int, seed: Int, rng: Random, sizeC: Int
): List<QuadSpline> {
    val noise = PerlinNoiseGenerator.newBuilder()
        .setSeed(seed.toLong())
        .setInterpolation(Interpolation.COSINE)
        .build()
    return List(numRivers) { generateRiver(rng, noise, sizeC) }
}

fun generateRiver(
    rng: Random, noise: PerlinNoiseGenerator, sizeC: Int
): QuadSpline {
    var chunkX: Int = 0
    var chunkZ: Int = 0
    var alongX: Boolean = rng.nextBoolean()
    if(alongX) {
        chunkZ = rng.nextInt(sizeC)
    } else {
        chunkX = rng.nextInt(sizeC)
    }
    val start: Vector3fc = Vector3f(
        chunkX.chunksToTiles().toFloat(), 0f,
        chunkZ.chunksToTiles().toFloat()
    )
    val segments = mutableListOf<QuadSpline.Segment>()
    var dirX: Int = if(alongX) 1 else 0
    var dirZ: Int = if(alongX) 0 else 1
    while(chunkX >= 0 && chunkX <= sizeC && chunkZ >= 0 && chunkZ <= sizeC) {
        val ctrlX: Int = chunkX + dirX
        val ctrlZ: Int = chunkZ + dirZ
        val n: Double = noise.evaluateNoise(
            chunkX.toDouble() * 123.5, chunkZ.toDouble() * 123.5
        )
        val changeDir: Boolean = n > 0.0
        val newDir: Boolean = abs(n) > 0.5
        if(changeDir) {
            if(dirX == 0 && alongX) {
                dirX = 1;
                dirZ = 0;
            } else if(dirZ == 0 && alongX) {
                dirX = 0;
                dirZ = if(newDir) 1 else -1
            } else if(dirX == 0) {
                dirX = if(newDir) 1 else -1
                dirZ = 0
            } else if(dirZ == 0) {
                dirX = 0
                dirZ = 1
            }
        }
        chunkX = ctrlX + dirX
        chunkZ = ctrlZ + dirZ
        segments.add(QuadSpline.Segment(
            Vector3f(
                ctrlX.chunksToTiles().toFloat(), 0f, 
                ctrlZ.chunksToTiles().toFloat()
            ),
            Vector3f(
                chunkX.chunksToTiles().toFloat(), 0f,
                chunkZ.chunksToTiles().toFloat()
            )
        ))
    }
    return QuadSpline(start, segments)
}