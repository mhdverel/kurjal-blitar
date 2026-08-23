import test from 'node:test'
import { readFile } from 'node:fs/promises'
import firebase from 'firebase/compat/app'
import 'firebase/compat/firestore'
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from '@firebase/rules-unit-testing'

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  test('Firestore rules tests require the emulator', { skip: 'Run npm run test:rules' }, () => {})
} else {
  const ADMIN = 'admin-uid'
  const PENDING = 'pending-uid'
  const DRIVER = 'driver-uid'
  let environment

  const fee = (updatedBy = ADMIN) => ({
    upTo4Km: 8_000,
    upTo5Km: 10_000,
    upTo6Km: 12_000,
    additionalPerKm: 2_000,
    heavySurcharge: 2_000,
    obrokSurcharge: 4_000,
    rideSurcharge: 2_000,
    cakeSurcharge: 2_000,
    after10PmSurcharge: 2_000,
    afterMidnightSurcharge: 4_000,
    roundTripMultiplier: 2,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy,
  })

  test.before(async () => {
    environment = await initializeTestEnvironment({
      projectId: 'kurjal-blitar-rules-test',
      firestore: { rules: await readFile('firestore.rules', 'utf8') },
    })
  })

  test.beforeEach(async () => {
    await environment.clearFirestore()
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await Promise.all([
        db.doc(`users/${ADMIN}`).set({ role: 'ADMIN', accountStatus: 'APPROVED' }),
        db.doc(`users/${PENDING}`).set({ role: 'DRIVER', accountStatus: 'PENDING' }),
        db.doc(`users/${DRIVER}`).set({ role: 'DRIVER', accountStatus: 'APPROVED' }),
      ])
    })
  })

  test.after(async () => environment.cleanup())

  async function seedFee() {
    await environment.withSecurityRulesDisabled((context) => context.firestore().doc('settings/deliveryFee').set({
      ...fee(), updatedAt: firebase.firestore.Timestamp.now(),
    }))
  }

  test('only Admin and approved Driver can read the tariff', async () => {
    await seedFee()
    await assertFails(environment.unauthenticatedContext().firestore().doc('settings/deliveryFee').get())
    await assertFails(environment.authenticatedContext(PENDING).firestore().doc('settings/deliveryFee').get())
    await assertSucceeds(environment.authenticatedContext(DRIVER).firestore().doc('settings/deliveryFee').get())
    await assertSucceeds(environment.authenticatedContext(ADMIN).firestore().doc('settings/deliveryFee').get())
  })

  test('only Admin can create, update, and never delete the tariff', async () => {
    await assertFails(environment.authenticatedContext(PENDING).firestore().doc('settings/deliveryFee').set(fee(PENDING)))
    await assertFails(environment.authenticatedContext(DRIVER).firestore().doc('settings/deliveryFee').set(fee(DRIVER)))
    await assertSucceeds(environment.authenticatedContext(ADMIN).firestore().doc('settings/deliveryFee').set(fee()))
    await assertSucceeds(environment.authenticatedContext(ADMIN).firestore().doc('settings/deliveryFee').update({
      upTo4Km: 9_000, updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: ADMIN,
    }))
    await assertFails(environment.authenticatedContext(ADMIN).firestore().doc('settings/deliveryFee').delete())
  })

  test('rejects invalid schemas and extra fields', async () => {
    const reference = environment.authenticatedContext(ADMIN).firestore().doc('settings/deliveryFee')
    await assertFails(reference.set({ ...fee(), upTo5Km: 1_000 }))
    await assertFails(reference.set({ ...fee(), roundTripMultiplier: 11 }))
    await assertFails(reference.set({ ...fee(), unexpected: true }))
    await assertFails(reference.set({ ...fee(), additionalPerKm: 2_000.5 }))
    const { cakeSurcharge: _missing, ...missingField } = fee()
    await assertFails(reference.set(missingField))
  })
}
