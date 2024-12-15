const myModel = {
  *nativeOne(this: any, _self: any) : any {
    return yield* this.reify(1)
  },
}

export { myModel }