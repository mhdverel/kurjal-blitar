import test from 'node:test'
import assert from 'node:assert/strict'
import worker from '../worker/index.js'
import { getWeekRange } from '../src/ledger.js'

const token = (uid) => `header.${Buffer.from(JSON.stringify({ sub: uid })).toString('base64url')}.signature`
const profileResponse = (uid, role = 'DRIVER', accountStatus = 'APPROVED') => Response.json({ fields: {
  uid: { stringValue: uid }, role: { stringValue: role }, accountStatus: { stringValue: accountStatus },
} })

test('R2 Worker stores proof under authenticated driver and blocks cross-driver reads', async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => profileResponse('driver-1')
  let uploaded
  const env = {
    FIREBASE_PROJECT_ID: 'kurjal-blitar', FIRESTORE_DATABASE: 'default', ALLOWED_ORIGINS: 'http://localhost:5173',
    SETTLEMENT_PROOFS: {
      put: async (key, body) => { uploaded = { key, body } },
      get: async () => { throw new Error('must not read another driver proof') },
    },
  }
  const headers = { Authorization: `Bearer ${token('driver-1')}`, 'Content-Type': 'image/png', Origin: 'http://localhost:5173' }
  const weekKey = getWeekRange(new Date(), -1).key
  const upload = await worker.fetch(new Request(`https://worker.test/settlement-proofs/${weekKey}`, { method: 'PUT', headers, body: new Uint8Array([1, 2, 3]) }), env)
  assert.equal(upload.status, 200)
  assert.equal(uploaded.key, `settlement-proofs/driver-1/${weekKey}`)
  assert.deepEqual([...uploaded.body], [1, 2, 3])

  const forbidden = await worker.fetch(new Request(`https://worker.test/settlement-proofs/driver-2/${weekKey}`, { headers }), env)
  assert.equal(forbidden.status, 403)
  assert.equal((await forbidden.json()).code, 'r2/forbidden')
})
