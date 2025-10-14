
package schwalbe.linton.server

import schwalbe.linton.game.Game
import org.springframework.context.annotation.Configuration
import org.springframework.web.socket.handler.TextWebSocketHandler
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.CloseStatus
import org.springframework.stereotype.Component
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.UUID
import java.lang.IllegalStateException
import kotlinx.serialization.*
import kotlinx.serialization.json.*


fun socketSendSyncRaw(socket: WebSocketSession, message: String) {
    synchronized(socket) {
        try {
            socket.sendMessage(TextMessage(message))
        } catch (ex: IOException) {
            // Network error or client disconnected
            // Handled in RoomWebSocketHandler
        } catch (ex: IllegalStateException) {
            // Session already closed
            // Handled in RoomWebSocketHandler
        }
    }
}

inline fun socketSendSync(socket: WebSocketSession, message: OutEvent) {
    socketSendSyncRaw(socket, Json.encodeToString<OutEvent>(message))
}


class Room(val id: String) {

    companion object {
        // minimum delay, may take longer depending on when the next 
        // registry clean up cycle hits
        val CLOSE_DELAY_MS: Long = 300_000 // 5 minutes
    }

    data class Connection(val name: String, val socket: WebSocketSession)

    sealed class State {
        
        abstract val typeString: String
        abstract fun update(room: Room)

        class Dying(): State() {
            override val typeString: String = "dying"

            val until: Long = System.currentTimeMillis() + Room.CLOSE_DELAY_MS

            override fun update(room: Room) {
                if(room.connected.size > 0) {
                    room.changeState(Room.State.Waiting())
                    return
                }
            }
        }

        class Waiting(): State() {
            override val typeString: String = "waiting"

            val ready = ConcurrentHashMap<String, Boolean>()

            override fun update(room: Room) {
                if(room.connected.size == 0) {
                    room.changeState(Room.State.Dying())
                    return
                }
                var allReady: Boolean = true
                for(playerId in room.connected.keys) {
                    if(this.ready[playerId] != true) {
                        allReady = false
                        break
                    }
                }
                if(!allReady) { return }
                val playing: Map<String, String> = room.connected.entries
                    .associate { (id, connection) -> id to connection.name }
                room.changeState(Room.State.Playing(Game(playing)))
            }
        }

        data class Playing(val game: Game): State() {
            override val typeString: String = "playing"

            override fun update(room: Room) {
                if(room.connected.size == 0) {
                    room.changeState(Room.State.Dying())
                    return
                }
                this.game.update()
                if(this.game.hasEnded()) {
                    room.changeState(Room.State.Waiting())
                    return
                }
            }
        }
    }

    var state: State = State.Waiting()
    val connected = ConcurrentHashMap<String, Room.Connection>()
    var owner: String? = null

    fun update() {
        synchronized(this) {
            val prevOwner: String? = this.owner
            if(prevOwner == null || !this.connected.containsKey(prevOwner)) {
                this.owner = this.connected.keys.firstOrNull()
                if(this.owner != prevOwner) {
                    this.broadcastRoomInfo()
                }
            }
        }
        val state: State = synchronized(this) { this.state }
        state.update(this)
    }

    fun changeState(newState: State) {
        synchronized(this) {
            this.state = newState
        }
        this.broadcastRoomInfo()
    }

    fun connect(playerId: String, name: String, socket: WebSocketSession) {
        this.connected[playerId] = Room.Connection(name, socket)
        this.broadcastRoomInfo()
    }

    fun disconnect(playerId: String) {
        this.connected.remove(playerId)
        val state: State = synchronized(this) { this.state }
        if(state is State.Playing) {
            state.game.onPlayerDisconnect(playerId)
        }
        this.broadcastRoomInfo()
    }

    fun handleRoomCrash() {
        val message: String = Json.encodeToString<OutEvent>(
            OutEvent.RoomCrashed()
        )
        for(connection in this.connected.values) {
            socketSendSyncRaw(connection.socket, message)
            connection.socket.close()
        }
    }

    fun getPlayerInfo(): List<EventPlayerInfo> 
    = this.connected.map { (playerId, connection) -> 
        var isReady: Boolean = false
        synchronized(this) {
            val state: Room.State = this.state
            if(state is State.Waiting) {
                isReady = state.ready[playerId] ?: false
            }
        }
        EventPlayerInfo(playerId, connection.name, isReady) 
    }

    fun broadcastRoomInfo() {
        val playerInfo: List<EventPlayerInfo> = this.getPlayerInfo()
        val stateStr: String = synchronized(this) { this.state.typeString }
        val owner: String = synchronized(this) { this.owner } 
            ?: "" // if there is no owner there is no player to broadcast to
        val event: OutEvent = OutEvent.RoomInfo(playerInfo, owner, stateStr)
        val message: String = Json.encodeToString<OutEvent>(event)
        for(connection in this.connected.values) {
            socketSendSyncRaw(connection.socket, message)
        }
    }

}


@Serializable
data class EventPlayerInfo(
    val id: String, val name: String, val isReady: Boolean
)

@Serializable
sealed class OutEvent {
    // invalid message received from client, explains why
    // usually followed by socket close
    @Serializable
    @SerialName("invalid_message")
    data class InvalidMessage(val reason: String): OutEvent()

    // used to tell the client their player ID
    @Serializable
    @SerialName("identification")
    data class Identification(val playerId: String): OutEvent()

    // used to tell the client about the room
    // - for each player in the room ID, name and isReady
    // - the state of the room ('dying', 'waiting', 'playing')
    // called when a player becomes ready or when someone disconnects / connects
    @Serializable
    @SerialName("room_info")
    data class RoomInfo(
        val players: List<EventPlayerInfo>, 
        val owner: String, 
        val state: String
    ): OutEvent()

    // used to notify the clients about an internal server error
    // (usually uncaught exception in the game logic)
    // entire room is closed and socket is disconnected
    @Serializable
    @SerialName("room_crashed")
    class RoomCrashed(): OutEvent()
}

@Serializable
sealed class InEvent {
    // client requests to join a given room with a given name
    // (client may not be connected to a room at this point)
    // (must always be the first message sent)
    @Serializable
    @SerialName("join_room")
    data class JoinRoom(val roomId: String, val name: String): InEvent() {
        companion object {
            val NAME_LENGTH_LIMIT: Int = 32
        }
    }

    // client tells the server that they are ready to start playing
    // (room state needs to be 'waiting', otherwise ignored)
    @Serializable
    @SerialName("is_ready")
    class IsReady(): InEvent()
}

@Component
class RoomWebSocketHandler: TextWebSocketHandler() {

    val sessionToPlayerId = ConcurrentHashMap<String, String>()
    val playerToSession = ConcurrentHashMap<String, WebSocketSession>()
    val playerToRoomId = ConcurrentHashMap<String, String>()

    override fun afterConnectionEstablished(session: WebSocketSession) {
        synchronized(this) {
            var playerId: String
            do {
                playerId = UUID.randomUUID().toString()
            } while(this.playerToSession.containsKey(playerId))
            this.sessionToPlayerId[session.id] = playerId
            this.playerToSession[playerId] = session
            socketSendSync(session, OutEvent.Identification(playerId))
        }
    }

    override fun handleTextMessage(
        session: WebSocketSession, message: TextMessage
    ) {
        val event: InEvent
        try {
            event = Json.decodeFromString<InEvent>(message.payload)
        } catch(ex: Exception) {
            socketSendSync(session, OutEvent.InvalidMessage(
                "Failed to parse event message: ${ex.message}"
            ))
            session.close()
            return
        }        
        val playerId: String? = this.sessionToPlayerId[session.id]
        if(playerId == null) {
            // something went horribly wrong - player isn't registered?
            socketSendSync(session, OutEvent.InvalidMessage(
                "This client is unknown"
            ))
            session.close()
            return
        }
        val roomId: String? = this.playerToRoomId[playerId]
        if(roomId == null && event is InEvent.JoinRoom) {
            if(event.name.length > InEvent.JoinRoom.NAME_LENGTH_LIMIT) {
                socketSendSync(session, OutEvent.InvalidMessage(
                    "The provided name is too long"
                ))
                session.close()
                return
            }
            val room: Room? = roomRegistry.rooms[event.roomId]
            if(room == null) {
                socketSendSync(session, OutEvent.InvalidMessage(
                    "The provided room ID is unknown"
                ))
                session.close()
                return
            }
            room.connect(playerId, event.name, session)
            this.playerToRoomId[playerId] = event.roomId
            return
        }
        if(roomId == null) {
            // illegal - client hasn't joined a room yet
            socketSendSync(session, OutEvent.InvalidMessage(
                "Clients are required to join a room before using other events"
            ))
            session.close()
            return
        }
        val room: Room? = roomRegistry.rooms[roomId]
        if(room == null) {
            // client room ID doesn't point to valid room?
            socketSendSync(session, OutEvent.InvalidMessage(
                "Client room no longer exists"
            ))
            session.close()
            return
        }
        when(event) {
            is InEvent.JoinRoom -> {
                // illegal - client should reconnect before joining another room
                socketSendSync(session, OutEvent.InvalidMessage(
                    "This client has already joined a room"
                ))
                session.close()
            }
            is InEvent.IsReady -> {
                val state: Room.State = synchronized(room) { room.state }
                if(state is Room.State.Waiting) {
                    state.ready[playerId] = true
                    room.broadcastRoomInfo()
                }
            }
        }
    }

    override fun afterConnectionClosed(
        session: WebSocketSession, status: CloseStatus
    ) {
        val playerId: String? = this.sessionToPlayerId[session.id]
        if(playerId == null) { return }
        this.sessionToPlayerId.remove(session.id)
        this.playerToSession.remove(playerId)
        val roomId: String? = this.playerToRoomId[playerId]
        if(roomId == null) { return }
        this.playerToRoomId.remove(roomId)
        val room: Room? = roomRegistry.rooms[roomId]
        if(room == null) { return }
        room.disconnect(playerId)
    }

}

@Configuration
@EnableWebSocket
class RoomWebSocketConfig(
    private val roomWebSocketHandler: RoomWebSocketHandler
): WebSocketConfigurer {

    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(roomWebSocketHandler, "/ws/room")
            .setAllowedOrigins("*")
    }

}