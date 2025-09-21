const myModel = {
  *nativeOne(_self) {
    return yield* this.reify(1)
  },
}

export { myModel }