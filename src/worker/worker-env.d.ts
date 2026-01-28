interface R2Bucket {
  get: (...args: any[]) => any
  put: (...args: any[]) => any
  delete: (...args: any[]) => any
}

interface D1Database {
  prepare: (...args: any[]) => any
}
