import {test} from 'node:test'
import assert from 'node:assert/strict'
import {csvReport,validateRecipients} from '../../scripts/lib/report-data.mjs'
test('CSV preserves data while neutralizing spreadsheet formulas and quoting',()=>{
 const csv=csvReport([{name:' =WEBSERVICE("https://x")',site:'A, B'},{name:'line\nnext',site:'@SUM(A1)'}],['name','site'])
 assert.ok(csv.includes('"\' =WEBSERVICE(""https://x"")"'))
 assert.ok(csv.includes('"A, B"'));assert.ok(csv.includes('"\'@SUM(A1)"'))
})
test('recipient validation rejects header injection and empty recipient lists',()=>{
 assert.deepEqual(validateRecipients(['a@example.test','a@example.test']),['a@example.test'])
 for(const value of [[],['a@example.test\r\nBcc: x@y.test'],['not email']]) assert.throws(()=>validateRecipients(value))
})
