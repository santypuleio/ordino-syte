import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '../firebase'

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' })

export function signInWithGoogle() {
  return signInWithPopup(auth, provider)
}

export function googleAuthErrorMessage(err) {
  const code = err?.code || ''
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return ''
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'Ese email ya tiene una cuenta con contraseña. Ingresá con email y contraseña.'
  }
  if (code === 'auth/operation-not-allowed') {
    return 'El ingreso con Google todavía no está habilitado en Firebase.'
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Este dominio no está autorizado en Firebase para ingresar con Google.'
  }
  if (code === 'auth/popup-blocked') {
    return 'El navegador bloqueó la ventana de Google. Permití ventanas emergentes e intentá de nuevo.'
  }
  return err?.message || 'No se pudo ingresar con Google.'
}
