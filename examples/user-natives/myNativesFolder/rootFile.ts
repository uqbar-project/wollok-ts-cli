const myModel = {
    *nativeOne(self: any) : any {
      return yield* this.reify(1)
    },
}

export { myModel }