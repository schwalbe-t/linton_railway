
package schwalbe.linton.game

data class Player(val name: String, val id: String)

class Game(players: Map<String, String>) {

    val playing: MutableMap<String, Player> = mutableMapOf()
    var gameHasEnded: Boolean = false

    init {
        for((id, name) in players) {
            this.playing[id] = Player(name, id)
        }
    }

    @Synchronized
    fun onPlayerDisconnect(id: String) {
        this.playing.remove(id)
    }

    @Synchronized
    fun update() {
        if(this.playing.size == 0) {
            this.gameHasEnded = true
        }
    }

    @Synchronized
    fun hasEnded(): Boolean = this.gameHasEnded

}