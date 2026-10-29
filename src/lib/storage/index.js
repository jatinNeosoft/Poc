import { localStorageDriver } from "./local"
import { s3StorageDriver } from "./s3"

/**
 * Storage driver chosen by STORAGE_DRIVER (local | s3).
 * Interface: save(key, buffer, contentType) → { key, url }, stat(key), read(key, range?), remove(key)
 */
export function getStorage() {
  return process.env.STORAGE_DRIVER === "s3" ? s3StorageDriver : localStorageDriver
}
