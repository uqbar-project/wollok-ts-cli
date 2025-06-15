class Animal {
  var energy = 10

  method eat() {
    energy = energy + 10
  }
}

object pepita {
  var property energy = 1

  method fly(minutes) {
    energy = energy - (minutes * 2)
  }

  method minimumEnergy() = 100
}