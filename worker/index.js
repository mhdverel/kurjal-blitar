import { getWeekRange } from '../src/ledger.js'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|avif|heic|heif)$/
const WEEK_KEY = /^\d{4}-\d{2}-\d{2}$/

function apiError(status, code, message) {
  return Object.assign(new Error(message), { status, code })
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || ''
  if (!origin) return ''
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim())
  if (!allowed.includes(origin)) throw apiError(403, 'r2/forbidden', 'Origin tidak diizinkan.')
  return origin
}

function tokenUid(token) {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(encoded)).sub
  } catch {
    throw apiError(401, 'r2/unauthorized', 'Sesi Firebase tidak valid.')
  }
}

async function firebaseProfile(request, env) {
  const authorization = request.headers.get('Authorization') || ''
  const token = authorization.match(/^Bearer (.+)$/)?.[1]
  if (!token) throw apiError(401, 'r2/unauthorized', 'Sesi Firebase diperlukan.')
  const uid = tokenUid(token)
  const database = env.FIRESTORE_DATABASE || '(default)'
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/${encodeURIComponent(database)}/documents/users/${encodeURIComponent(uid)}`
  const response = await fetch(url, { headers: { Authorization: authorization } })
  if (!response.ok) throw apiError(401, 'r2/unauthorized', 'Sesi atau profil Firebase tidak valid.')
  const fields = (await response.json()).fields || {}
  if (fields.uid?.stringValue !== uid) throw apiError(401, 'r2/unauthorized', 'Identitas profil tidak valid.')
  return { uid, role: fields.role?.stringValue, accountStatus: fields.accountStatus?.stringValue }
}

async function limitedBody(body) {
  if (!body) throw apiError(400, 'r2/invalid-file', 'File gambar diperlukan.')
  const reader = body.getReader()
  const chunks = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_FILE_SIZE) {
      await reader.cancel()
      throw apiError(413, 'r2/file-too-large', 'Ukuran gambar maksimal 5 MB.')
    }
    chunks.push(value)
  }
  if (!size) throw apiError(400, 'r2/invalid-file', 'File gambar kosong.')
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

async function upload(request, env, weekKey, profile) {
  if (profile.role !== 'DRIVER' || profile.accountStatus !== 'APPROVED') {
    throw apiError(403, 'r2/forbidden', 'Hanya driver aktif yang dapat mengirim bukti.')
  }
  if (!WEEK_KEY.test(weekKey)) throw apiError(400, 'r2/invalid-path', 'Periode setoran tidak valid.')
  if (weekKey !== getWeekRange(new Date(), -1).key) {
    throw apiError(403, 'r2/forbidden', 'Bukti hanya dapat dikirim untuk periode terakhir.')
  }
  const contentType = (request.headers.get('Content-Type') || '').split(';')[0].toLowerCase()
  if (!IMAGE_TYPES.test(contentType)) throw apiError(415, 'r2/invalid-file', 'Format gambar tidak didukung.')
  const declaredSize = Number(request.headers.get('Content-Length') || 0)
  if (declaredSize > MAX_FILE_SIZE) throw apiError(413, 'r2/file-too-large', 'Ukuran gambar maksimal 5 MB.')
  const proofPath = `settlement-proofs/${profile.uid}/${weekKey}`
  await env.SETTLEMENT_PROOFS.put(proofPath, await limitedBody(request.body), {
    httpMetadata: { contentType, cacheControl: 'private, no-store' },
    customMetadata: { ownerId: profile.uid },
  })
  return Response.json({ proofPath })
}

async function download(env, ownerId, weekKey, profile) {
  if (profile.uid !== ownerId && profile.role !== 'ADMIN') {
    throw apiError(403, 'r2/forbidden', 'Bukti setoran bukan milik akun ini.')
  }
  if (!ownerId || !WEEK_KEY.test(weekKey)) throw apiError(400, 'r2/invalid-path', 'Lokasi bukti tidak valid.')
  const object = await env.SETTLEMENT_PROOFS.get(`settlement-proofs/${ownerId}/${weekKey}`)
  if (!object) throw apiError(404, 'r2/not-found', 'Bukti setoran tidak ditemukan.')
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'private, no-store')
  headers.set('Content-Disposition', 'inline')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new Response(object.body, { headers })
}

export default {
  async fetch(request, env) {
    let origin = ''
    try {
      origin = allowedOrigin(request, env)
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
      const parts = new URL(request.url).pathname.split('/').filter(Boolean)
      const profile = await firebaseProfile(request, env)
      let response
      if (request.method === 'PUT' && parts.length === 2 && parts[0] === 'settlement-proofs') {
        response = await upload(request, env, parts[1], profile)
      } else if (request.method === 'GET' && parts.length === 3 && parts[0] === 'settlement-proofs') {
        response = await download(env, parts[1], parts[2], profile)
      } else {
        throw apiError(404, 'r2/not-found', 'Endpoint tidak ditemukan.')
      }
      if (origin) Object.entries(corsHeaders(origin)).forEach(([key, value]) => response.headers.set(key, value))
      return response
    } catch (error) {
      const response = Response.json(
        { code: error.code || 'r2/request-failed', message: error.status ? error.message : 'Penyimpanan sedang bermasalah.' },
        { status: error.status || 500 },
      )
      if (origin) Object.entries(corsHeaders(origin)).forEach(([key, value]) => response.headers.set(key, value))
      return response
    }
  },
}
