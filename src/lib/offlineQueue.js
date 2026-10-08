const prefix = 'assetpro_offline_v2:'
const locks = new Map()
function key(userId) {
  if (!userId) throw new Error('Sign in before saving offline work.')
  return prefix + userId
}
export function readOfflineQueue(storage, userId) {
  const value = JSON.parse(storage.getItem(key(userId)) || '[]')
  if (!Array.isArray(value) || value.some(item => !item || typeof item.id !== 'string' || item.userId !== userId)) {
    throw new Error('Saved offline work could not be read. Contact support before clearing browser data.')
  }
  return value
}
export function enqueueOffline(storage, userId, actionType, payload, id = crypto.randomUUID()) {
  if (actionType !== 'audit') throw new Error('This action is not supported offline.')
  const queue = readOfflineQueue(storage, userId)
  if (queue.length >= 500) throw new Error('Sync pending work before adding more offline actions.')
  queue.push({id,userId,actionType,payload,timestamp:new Date().toISOString()})
  storage.setItem(key(userId), JSON.stringify(queue)) // Never claim saved on quota failure.
  return id
}
export async function drainOffline(storage, userId, execute) {
  const storageKey = key(userId)
  if (locks.has(storageKey)) return locks.get(storageKey)
  const task = (async () => {
    let synced = 0
    for (const item of readOfflineQueue(storage, userId)) {
      if (item.actionType !== 'audit') throw new Error('An unsupported offline action requires review.')
      await execute(item) // Server must deduplicate by actor + item.id.
      const latest = readOfflineQueue(storage, userId)
      storage.setItem(storageKey, JSON.stringify(latest.filter(entry => entry.id !== item.id)))
      synced++
    }
    return synced
  })()
  locks.set(storageKey, task)
  try { return await task } finally { locks.delete(storageKey) }
}
