object bobbyTheShark {
    var name = "Bobby"
    var age = 5
    var friend = george
    var born = new Date(day = 14, month = 2, year = 1971)
    var isHappy = true
    var range1 = new Range(start = 2, end = 11)
    var range2 = new Range(start = 2, end = 14, step = 5)
    var aClosure = { 5 + 2 }
    var someObject =  object { var j = 1 }
    var aPair = new Pair(x = 2, y = 1)
    var dictionary = new Dictionary()
    var bird = new Bird()
    const fixedValue = "Fixed"
}

object george {
    var colors = ["blue", "orange", "grey"]
    var colorsAsSet = #{"blue", "orange", "grey"}
}

class Bird {
    var energy = 100
    var friend = bobbyTheShark
}