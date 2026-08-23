const workerUrl = (import.meta.env.VITE_R2_WORKER_URL || '').replace(/\/$/, '')

async function authorizedRequest(user, path, options) {
  if (!workerUrl) throw Object.assign(new Error('R2 Worker not configured'), { code: 'r2/not-configured' })
  const response = await fetch(`${workerUrl}/${path}`, {
    ...options,
    headers: { ...options?.headers, Authorization: `Bearer ${await user.getIdToken()}` },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw Object.assign(new Error(body.message || 'R2 request failed'), { code: body.code || 'r2/request-failed' })
  }
  return response
}

export async function uploadSettlementProof(user, weekKey, file) {
  const response = await authorizedRequest(user, `settlement-proofs/${weekKey}`, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
  return (await response.json()).proofPath
}

export async function downloadSettlementProof(user, proofPath) {
  if (!/^settlement-proofs\/[^/]+\/\d{4}-\d{2}-\d{2}$/.test(proofPath || '')) {
    throw Object.assign(new Error('Invalid proof path'), { code: 'r2/invalid-path' })
  }
  return (await authorizedRequest(user, proofPath)).blob()
}
