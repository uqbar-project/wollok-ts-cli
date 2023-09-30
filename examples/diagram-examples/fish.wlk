object bobbyTheShark {
    var property name = "Bobby"
    var property age = 5
    var property friend = george
    var property born = new Date(day = 14, month = 2, year = 1971)
    var property isHappy = true
    var property range1 = new Range(start = 2, end = 11)
    var property range2 = new Range(start = 2, end = 14, step = 5)
    var property aClosure = { 5 + 2 }
    var property someObject =  object { var property j = 1 }
    var property aPair = new Pair(x = 2, y = 1)
    var property dictionary = new Dictionary()
    var property bird = new Bird()
    const property fixedValue = "Fixed"
}

object george {
    var property colors = ["blue", "orange", "grey"]
    var property colorsAsSet = #{"blue", "orange", "grey"}
}

class Bird {
    var property energy = 100
    var property friend = bobbyTheShark
}