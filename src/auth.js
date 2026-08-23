export function destinationFor(profile) {
  if (!profile) return '/access-denied'
  if (profile.role === 'ADMIN') return '/admin/dashboard'
  if (profile.role !== 'DRIVER') return '/access-denied'
  if (profile.accountStatus === 'APPROVED') return '/driver/dashboard'
  if (profile.accountStatus === 'PENDING') return '/waiting-approval'
  return '/access-denied'
}

export function allowedPath(path, profile) {
  const fallback = destinationFor(profile)
  if (profile?.role === 'ADMIN' && path.startsWith('/admin/')) return path
  if (profile?.role === 'DRIVER' && profile.accountStatus === 'APPROVED' && path.startsWith('/driver/')) return path
  if (profile?.role === 'DRIVER' && profile.accountStatus === 'PENDING' && path === '/waiting-approval') return path
  if (['REJECTED', 'SUSPENDED'].includes(profile?.accountStatus) && path === '/access-denied') return path
  return fallback
}

export function authErrorMessage(error) {
  return {
    'auth/invalid-email': 'Format email tidak valid.',
    'auth/invalid-credential': 'Email atau password salah.',
    'auth/user-not-found': 'Email tidak terdaftar.',
    'auth/wrong-password': 'Password salah.',
    'auth/user-disabled': 'Akun ini telah dinonaktifkan.',
    'auth/email-already-in-use': 'Email sudah digunakan.',
    'auth/weak-password': 'Password harus minimal 6 karakter.',
    'auth/network-request-failed': 'Koneksi gagal. Periksa internet lalu coba lagi.',
    unavailable: 'Koneksi Firestore gagal. Silakan coba lagi.',
    'permission-denied': 'Akses Firebase ditolak. Periksa akun atau aturan keamanan.',
    'r2/invalid-proof': 'Bukti harus berupa gambar dengan ukuran maksimal 5 MB.',
    'r2/unauthorized': 'Akses ke bukti setoran ditolak.',
    'r2/forbidden': 'Akun tidak memiliki izin mengakses bukti setoran.',
    'r2/not-configured': 'R2 Worker belum dikonfigurasi.',
    'r2/invalid-path': 'Lokasi bukti setoran tidak valid.',
    'r2/not-found': 'Bukti setoran tidak ditemukan.',
    'r2/file-too-large': 'Bukti harus berupa gambar dengan ukuran maksimal 5 MB.',
    'r2/invalid-file': 'Bukti harus berupa gambar JPG, PNG, WebP, GIF, AVIF, HEIC, atau HEIF.',
    'r2/request-failed': 'Penyimpanan bukti sedang bermasalah. Silakan coba lagi.',
    'profile/not-found': 'Profil pengguna tidak ditemukan di Firestore.',
    'firebase/not-configured': 'Firebase belum dikonfigurasi. Lengkapi variabel VITE_FIREBASE_* terlebih dahulu.',
  }[error?.code] || 'Terjadi kesalahan. Silakan coba lagi.'
}
