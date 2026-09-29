const DATABASE = "flowie2k-audio"
const STORE = "tracks"

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DATABASE, 1)
  let blocked = false
  request.onupgradeneeded = () => request.result.createObjectStore(STORE)
  request.onerror = () => reject(request.error)
  request.onblocked = () => {
    blocked = true
    reject(new Error("Audio cache is blocked"))
  }
  request.onsuccess = () => {
    const db = request.result
    db.onversionchange = () => db.close()
    if (blocked) db.close()
    else resolve(db)
  }
})

async function accessCache<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode)
      const request = operation(transaction.objectStore(STORE))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(transaction.error)
      transaction.onerror = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

export async function getCachedAudio(key: string, size: number): Promise<Blob | null> {
  try {
    const blob: unknown = await accessCache("readonly", (store) => store.get(key))
    return blob instanceof Blob && blob.size === size && size > 0 ? blob : null
  } catch {
    // Private browsing, eviction, or unavailable storage must not prevent playback.
    return null
  }
}

export async function cacheAudio(
  key: string,
  size: number,
  source: string,
  signal: AbortSignal,
): Promise<void> {
  try {
    const response = await fetch(source, { signal })
    // Store only complete files, never an error page or a partial range response.
    if (response.status !== 200) {
      await response.body?.cancel()
      return
    }
    const blob = await response.blob()
    if (signal.aborted || blob.size !== size || size <= 0) return
    await accessCache("readwrite", (store) => store.put(blob, key))
  } catch {
    // Downloads and quota failures are optional cache misses. R2 playback continues.
  }
}
