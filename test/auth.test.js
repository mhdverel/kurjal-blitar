import test from 'node:test'
import assert from 'node:assert/strict'
import { allowedPath, destinationFor } from '../src/auth.js'

test('routes authenticated users by role and account status', () => {
  assert.equal(destinationFor({ role: 'ADMIN' }), '/admin/dashboard')
  assert.equal(destinationFor({ role: 'DRIVER', accountStatus: 'APPROVED' }), '/driver/dashboard')
  assert.equal(destinationFor({ role: 'DRIVER', accountStatus: 'PENDING' }), '/waiting-approval')
  assert.equal(destinationFor({ role: 'DRIVER', accountStatus: 'SUSPENDED' }), '/access-denied')
  assert.equal(allowedPath('/admin/dashboard', { role: 'DRIVER', accountStatus: 'APPROVED' }), '/driver/dashboard')
})
