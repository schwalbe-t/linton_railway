
package schwalbe.linton.server

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import jakarta.servlet.http.HttpServletRequest
import java.util.concurrent.ConcurrentHashMap
import java.util.UUID


val roomRegistry = RoomRegistry()

class RoomRegistry {

	companion object {
		val CREATION_COOLDOWN_MS: Long = 3 * 60_000
		val MAX_PUBLIC_PLAYER_C: Int = 5 // don't auto-add people above this
	}

    val rooms = ConcurrentHashMap<String, Room>()
	val publicRooms = ConcurrentHashMap<String, Room>()
	val clientCooldowns = ConcurrentHashMap<String, Long>()

	fun mayCreateRoom(clientIp: String): Boolean {
		val cooldownUntil: Long? = this.clientCooldowns[clientIp]
		if(cooldownUntil == null) { 
			return true 
		}
		val hasExpired = System.currentTimeMillis() >= cooldownUntil
		if(hasExpired) { 
			this.clientCooldowns.remove(clientIp) 
		}
		return hasExpired
	}

	fun cleanup() {
		val now: Long = System.currentTimeMillis()
		this.clientCooldowns.entries.removeIf { (_, cooldownUntil) -> 
			now >= cooldownUntil 
		}
		this.rooms.entries.removeIf { (_, room) -> 
			val state: Room.State = synchronized(room) { room.state }
			state is Room.State.Dying && now >= state.until
		}
	}

    fun createRoom(clientIp: String, isPublic: Boolean): String {
        var id: String
        do {
            id = UUID.randomUUID().toString()
        } while(this.rooms.containsKey(id))
		val room = Room(id, RoomSettings.default(isPublic))
        this.rooms[id] = room
		if(isPublic) { this.publicRooms[id] = room }
		this.clientCooldowns[clientIp] = System.currentTimeMillis() + RoomRegistry.CREATION_COOLDOWN_MS
        return id
    }

	// Does not handle cleanup of connections!
	fun removeRoom(id: String) {
		this.rooms.remove(id)
		this.publicRooms.remove(id)
	}

	fun findPublicRoom(): String? {
		var bestRoomId: String? = null
		var bestPlayerC: Int = 0
		var bestLastGame: Long = Long.MAX_VALUE
		for((roomId, room) in this.publicRooms) {
			val roomPlayerC: Int = room.connected.size
			val roomLastGame: Long = synchronized(room) { room.lastGameTime }
			if(roomPlayerC >= RoomRegistry.MAX_PUBLIC_PLAYER_C) { continue }
			val isBest: Boolean = bestRoomId == null
				|| roomPlayerC > bestPlayerC
				|| (roomPlayerC == bestPlayerC && roomLastGame < bestLastGame)
			if(!isBest) { continue }
			bestRoomId = roomId
			bestPlayerC = roomPlayerC
			bestLastGame = roomLastGame
		}
		return bestRoomId
	}

}


@RestController
@RequestMapping("api/rooms")
class RoomController {

	private fun attemptRoomCreation(
		request: HttpServletRequest, isPublic: Boolean
	): ResponseEntity<Any> {
		val clientIp: String = request.getHeader("X-Forwarded-For")
			?: request.remoteAddr
		if(!roomRegistry.mayCreateRoom(clientIp)) {
			return ResponseEntity
				.status(HttpStatus.TOO_MANY_REQUESTS)
				.body(mapOf("error" to "Room creation on cooldown"))
		}
		val roomId: String = roomRegistry.createRoom(clientIp, isPublic)
		return ResponseEntity.ok(mapOf("roomId" to roomId.toString()))
	}

	@PostMapping("/create")
	fun createRoom(request: HttpServletRequest): ResponseEntity<Any>
		= this.attemptRoomCreation(request, isPublic = false)
	
	@GetMapping("/findPublic")
	fun findPublicRoom(request: HttpServletRequest): ResponseEntity<Any> {
		val existingId: String? = roomRegistry.findPublicRoom()
		if(existingId == null) {
			return this.attemptRoomCreation(request, isPublic = true)
		}
		return ResponseEntity.ok(mapOf("roomId" to existingId.toString()))
	}

}