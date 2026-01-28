export type Bindings = {
  MUSIC_BUCKET: {
    get: (...args: any[]) => any
    put: (...args: any[]) => any
    delete: (...args: any[]) => any
  }
  MUSIC_DB: {
    prepare: (...args: any[]) => any
  }
}
