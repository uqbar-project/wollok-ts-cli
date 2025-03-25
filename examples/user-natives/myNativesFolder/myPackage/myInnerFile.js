const packageModel = {
  *nativeTwo(self)  {
    return yield* this.reify(2)
  },
}

module.exports = { packageModel };
