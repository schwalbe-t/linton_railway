
package schwalbe.linton.server

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component
import java.util.concurrent.*

@Component
class Heartbeat {

    val roomUpdatePool: ExecutorService = Executors.newFixedThreadPool(
        Runtime.getRuntime().availableProcessors()
    )

    @Scheduled(fixedRate = 100)
    fun updateRooms() {
        val tasks = roomRegistry.rooms.entries.map { (roomId, room) ->
            Callable {
                try {
                    val state: Room.State = synchronized(room) { room.state }
                    state.update(room)
                } catch(ex: Exception) {
                    System.err.println("Room ${roomId} threw an uncaught exception during state update!")
                    ex.printStackTrace()
                    room.handleRoomCrash()
                    roomRegistry.removeRoom(roomId)
                }
            }
        }
        roomUpdatePool.invokeAll(tasks)
    }

    @Scheduled(fixedRate = 600_000)
    fun updateRoomCooldowns() {
        roomRegistry.cleanup()
    }

}