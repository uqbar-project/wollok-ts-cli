object pepita {
  var energy = 100

  method energy() = energy

  method eat(grams) {
    energy = energy + grams * 10
  }

  method fly(minutes) {
    energy = energy - minutes * 3
  }

}