import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { open, stat, unlink } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
const MAGIC = Buffer.from('APBACK01')

export function backupKey(value) {
  const key = Buffer.from(value || '', 'base64')
  if (key.length !== 32) throw new Error('BACKUP_KEY_BASE64 must contain a 32-byte encryption key.')
  return key
}

export async function encryptBackup(source, destination, key) {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(MAGIC)
  const handle = await open(destination, 'wx', 0o600)
  await handle.write(Buffer.concat([MAGIC, nonce]))
  await handle.close()
  try {
    await pipeline(createReadStream(source), cipher, createWriteStream(destination, { flags: 'a', mode: 0o600 }))
    const tail = await open(destination, 'a')
    try { await tail.write(cipher.getAuthTag()) } finally { await tail.close() }
  } catch (error) { await unlink(destination).catch(() => {}); throw error }
}

export async function decryptBackup(source, destination, key) {
  const size = (await stat(source)).size
  if (size < 36) throw new Error('Invalid backup: file is truncated.')
  const handle = await open(source, 'r')
  const header = Buffer.alloc(20), tag = Buffer.alloc(16)
  try { await handle.read(header, 0, 20, 0); await handle.read(tag, 0, 16, size - 16) } finally { await handle.close() }
  if (!header.subarray(0,8).equals(MAGIC)) throw new Error('Unsupported backup format.')
  const cipher = createDecipheriv('aes-256-gcm', key, header.subarray(8))
  cipher.setAAD(MAGIC); cipher.setAuthTag(tag)
  // Authentication is only final at end-of-stream. Consumers must await success.
  const output = await open(destination, 'wx', 0o600)
  await output.close()
  try {
    await pipeline(createReadStream(source, { start:20, end:size-17 }), cipher, createWriteStream(destination, { flags:'w', mode:0o600 }))
  } catch (error) { await unlink(destination).catch(() => {}); throw new Error('Backup authentication failed; check the key and file integrity.', { cause:error }) }
}
