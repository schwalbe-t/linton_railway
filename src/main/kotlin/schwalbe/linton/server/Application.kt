
package schwalbe.linton.server

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.boot.runApplication
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping

@SpringBootApplication
@EnableScheduling
class Application

fun main(args: Array<String>) {
	runApplication<Application>(*args)
}

@Controller
class PageController {

	@GetMapping("/room")
    fun room() = "forward:/room.html"

    @GetMapping("/join")
    fun join() = "forward:/index.html"

}