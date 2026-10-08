import { test } from 'node:test'
import assert from 'node:assert/strict'
import { enqueueOffline, readOfflineQueue, drainOffline } from '../../src/lib/offlineQueue.js'
function memory() { const values=new Map(); return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)} }
test('offline actions are isolated by account and require an identity',()=>{
  const store=memory()
  enqueueOffline(store,'user-a','audit',{count:3},'first')
  assert.equal(readOfflineQueue(store,'user-b').length,0)
  assert.equal(readOfflineQueue(store,'user-a').length,1)
  assert.throws(()=>enqueueOffline(store,null,'audit',{}))
  assert.throws(()=>enqueueOffline(store,'user-a','delete',{}))
})
test('partial sync preserves failed actions and avoids replay of completed work',async()=>{
  const store=memory(), calls=[]
  enqueueOffline(store,'a','audit',{},'one'); enqueueOffline(store,'a','audit',{},'two')
  await assert.rejects(drainOffline(store,'a',async item=>{calls.push(item.id); if(item.id==='two') throw new Error('offline')}))
  assert.deepEqual(readOfflineQueue(store,'a').map(i=>i.id),['two'])
  await drainOffline(store,'a',async item=>calls.push(item.id))
  assert.deepEqual(calls,['one','two','two'])
  assert.equal(readOfflineQueue(store,'a').length,0)
})
test('sync retains actions queued during an in-flight request',async()=>{
  const store=memory(); enqueueOffline(store,'a','audit',{},'one')
  await drainOffline(store,'a',async()=>enqueueOffline(store,'a','audit',{},'two'))
  assert.deepEqual(readOfflineQueue(store,'a').map(i=>i.id),['two'])
})
test('corrupt and full storage fail visibly without claiming success',()=>{
  const store=memory();store.setItem('assetpro_offline_v2:a','invalid')
  assert.throws(()=>readOfflineQueue(store,'a'))
  assert.throws(()=>enqueueOffline({getItem:()=>null,setItem:()=>{throw new Error('quota')}},'a','audit',{}))
})
