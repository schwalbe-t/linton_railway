
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
	}

    val rooms = ConcurrentHashMap<String, Room>()
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

    fun createRoom(clientIp: String): String {
        var id: String
        do {
            id = UUID.randomUUID().toString()
        } while(this.rooms.containsKey(id))
        this.rooms[id] = Room(id)
		this.clientCooldowns[clientIp] = System.currentTimeMillis() + RoomRegistry.CREATION_COOLDOWN_MS
        return id
    }

	// Does not handle cleanup of connections!
	fun removeRoom(id: String) {
		this.rooms.remove(id)
	}

}


@RestController
@RequestMapping("api/rooms")
class RoomController {

	@PostMapping("/create")
	fun createRoom(request: HttpServletRequest): ResponseEntity<Any> {
		val clientIp: String = request.getHeader("X-Forwarded-For")
			?: request.remoteAddr
		if(!roomRegistry.mayCreateRoom(clientIp)) {
			return ResponseEntity
				.status(HttpStatus.TOO_MANY_REQUESTS)
				.body(mapOf("error" to "Room creation on cooldown"))
		}
		val roomId: String = roomRegistry.createRoom(clientIp)
		return ResponseEntity.ok(mapOf("roomId" to roomId.toString()))
	}

}