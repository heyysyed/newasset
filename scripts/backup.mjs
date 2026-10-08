// Run on a trusted scheduler, never in the browser. No automatic retention deletes.
import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { backupKey, encryptBackup, decryptBackup } from './lib/backup-crypto.mjs'

function required(name) { if (!process.env[name]) throw new Error(`Configure ${name} in the scheduler's secret settings.`); return process.env[name] }
async function command(binary, args) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(binary,args,{stdio:['ignore','ignore','pipe']})
    // Do not emit pg connection details or credentials into backup logs.
    child.stderr.resume()
    child.on('error',reject)
    child.on('close',code=>code === 0 ? resolveRun() : reject(new Error(`${binary} failed (exit ${code}); inspect the scheduler configuration.`)))
  })
}
async function sha256(path) {
  const hash=createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

const work = await mkdtemp(join(tmpdir(),'assetpro-backup-'))
try {
  const key=backupKey(required('BACKUP_KEY_BASE64'))
  const mode=process.argv[2] || 'create'
  if(mode === 'verify') {
    const source=resolve(process.argv[3] || required('BACKUP_FILE'))
    const archive=join(work,'verified.tar')
    await decryptBackup(source,archive,key)
    const extracted=join(work,'contents'); await mkdir(extracted,{mode:0o700})
    await command('tar',['-xf',archive,'-C',extracted,'--no-same-owner','--no-same-permissions'])
    const manifest=JSON.parse(await readFile(join(extracted,'manifest.json'),'utf8'))
    for(const file of manifest.files) {
      if (!/^(database\.dump|objects\/[a-f0-9]{64})$/.test(file.path)) throw new Error('Unexpected backup entry.')
      if(await sha256(join(extracted,file.path)) !== file.sha256) throw new Error('Backup content checksum mismatch.')
    }
    await command('pg_restore',['--list',join(extracted,'database.dump')])
    console.log(`Verified encrypted backup: ${manifest.files.length} checksummed files. A database restore drill is still required.`)
  } else if(mode === 'create') {
    required('PGHOST'); required('PGUSER'); required('PGDATABASE')
    if(process.env.PGSSLMODE !== 'verify-full') throw new Error('Set PGSSLMODE=verify-full and configure the trusted server CA.')
    const url=new URL(required('SUPABASE_URL'))
    if(url.protocol!=='https:' || url.username || url.password) throw new Error('SUPABASE_URL must be an HTTPS project URL.')
    const sb=createClient(url.href,required('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})
    const contents=join(work,'contents'); await mkdir(join(contents,'objects'),{recursive:true,mode:0o700})
    const files=[]
    const startedAt=new Date().toISOString()
    await command('pg_dump',['--format=custom','--no-owner','--file',join(contents,'database.dump')])
    files.push({path:'database.dump',sha256:await sha256(join(contents,'database.dump'))})
    const {data:buckets,error}=await sb.storage.listBuckets()
    if(error) throw new Error('Cannot enumerate storage buckets; backup is incomplete.')
    async function walk(bucket,prefix='') {
      for(let offset=0;;offset+=100) {
        const {data,error:listError}=await sb.storage.from(bucket).list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}})
        if(listError) throw new Error('Cannot enumerate storage objects; backup is incomplete.')
        for(const entry of data) {
          const objectName=prefix ? `${prefix}/${entry.name}` : entry.name
          if(!entry.id) { await walk(bucket,objectName); continue }
          const {data:blob,error:downloadError}=await sb.storage.from(bucket).download(objectName)
          if(downloadError) throw new Error('Cannot download a storage object; backup is incomplete.')
          const path=`objects/${createHash('sha256').update(JSON.stringify([bucket,objectName])).digest('hex')}`
          await writeFile(join(contents,path),Buffer.from(await blob.arrayBuffer()),{mode:0o600})
          files.push({path,bucket,objectName,contentType:blob.type,sha256:await sha256(join(contents,path))})
        }
        if(data.length<100) break
      }
    }
    for(const bucket of buckets) await walk(bucket.id)
    await writeFile(join(contents,'manifest.json'),JSON.stringify({version:1,project:url.hostname,startedAt,finishedAt:new Date().toISOString(),buckets,files}),{mode:0o600})
    const archive=join(work,'snapshot.tar')
    await command('tar',['-cf',archive,'-C',contents,'.'])
    const outputDir=resolve(required('BACKUP_OUTPUT_DIR')); await mkdir(outputDir,{recursive:true,mode:0o700})
    const name=`${new Date().toISOString().replaceAll(':','-')}-${randomUUID()}.apbackup`
    const destination=join(outputDir,name)
    await encryptBackup(archive,destination,key)
    const checksum=await sha256(destination)
    await writeFile(`${destination}.sha256`,`${checksum}  ${name}\n`,{mode:0o600})
    if(process.env.BACKUP_S3_BUCKET) {
      if(process.env.BACKUP_S3_ENDPOINT && new URL(process.env.BACKUP_S3_ENDPOINT).protocol!=='https:') throw new Error('Backup S3 endpoint requires HTTPS.')
      const s3=new S3Client({region:required('AWS_REGION'),endpoint:process.env.BACKUP_S3_ENDPOINT})
      const objectKey=`${process.env.BACKUP_S3_PREFIX || 'assetpro'}/${url.hostname}/${name}`
      await s3.send(new PutObjectCommand({Bucket:process.env.BACKUP_S3_BUCKET,Key:objectKey,Body:createReadStream(destination),ContentLength:(await stat(destination)).size,ContentType:'application/octet-stream',Metadata:{sha256:checksum}}))
      const uploaded=await s3.send(new HeadObjectCommand({Bucket:process.env.BACKUP_S3_BUCKET,Key:objectKey}))
      if(uploaded.Metadata?.sha256!==checksum || uploaded.ContentLength!==(await stat(destination)).size) throw new Error('Remote backup verification failed.')
      console.log('Encrypted database + storage backup uploaded; object size and checksum metadata verified.')
    } else console.log('Encrypted database + storage backup created locally. Independent remote backup is NOT configured.')
    console.log(`Backup artifact: ${destination}`)
  } else throw new Error('Use: node scripts/backup.mjs create | verify <encrypted-file>')
} finally {
  // Only our unique temporary directory, including sensitive plaintext snapshots.
  await rm(work,{recursive:true,force:true})
}
