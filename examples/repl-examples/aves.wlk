import otros.comidas.*

object pepita {
	var energia = 100

	method come(comida) {
		energia = energia + comida.energiaQueAporta()
	}

	method vola(distancia) {
		energia = energia - 10 - distancia
	}

	method energia() {
		return energia
	}
}

object pepitaRota {
	var energia = 100

	method vola(distancia) {
		energia = energia + 'papa'
	}

	method energia() {
		return energia
	}
}