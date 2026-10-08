import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { backupKey, encryptBackup, decryptBackup } from '../../scripts/lib/backup-crypto.mjs'
test('encrypted backup round-trips and rejects tampering without leaving plaintext',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'assetpro-crypto-test-'))
 try {
  const key=randomBytes(32), original=randomBytes(200000)
  const source=join(dir,'source'), encrypted=join(dir,'encrypted'), restored=join(dir,'restored')
  await writeFile(source,original)
  await encryptBackup(source,encrypted,key)
  await decryptBackup(encrypted,restored,key)
  assert.deepEqual(await readFile(restored),original)
  await assert.rejects(decryptBackup(encrypted,join(dir,'wrong-key'),randomBytes(32)))
  await assert.rejects(access(join(dir,'wrong-key')))
  const damaged=await readFile(encrypted);damaged[50]^=1;await writeFile(join(dir,'damaged'),damaged)
  await assert.rejects(decryptBackup(join(dir,'damaged'),join(dir,'invalid'),key))
  await assert.rejects(access(join(dir,'invalid')))
  assert.throws(()=>backupKey('not-a-key'))
 } finally { await rm(dir,{recursive:true,force:true}) }
})
