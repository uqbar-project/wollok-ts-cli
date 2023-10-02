import personas.entrenadores.*

object alpiste {
	method energiaQueAporta() {
		return 20
	}
}

object manzana {
	var madurez = 1
	const base = 5
	const property duenio = ash

	method madurez() {
		return madurez
	}

	method madurez(_madurez) {
		madurez = _madurez
	}

	method madurar() {
		self.madurez(madurez + 1)
	}

	method energiaQueAporta() {
		return base * madurez
	}

}