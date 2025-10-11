
package schwalbe.linton.server

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.scheduling.annotation.EnableScheduling
import org.springframework.boot.runApplication

@SpringBootApplication
@EnableScheduling
class Application

fun main(args: Array<String>) {
	runApplication<Application>(*args)
}
