class A {
  var unused = 1
  method value()
}

class B inherits A {
  method value() {}
}

class C inherits A {
  method value() = 2
  method returnInvalidValue() = invalidValue
}

class D inherits D {}