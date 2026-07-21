import { registerSW } from 'virtual:pwa-register'

registerSW({
  onRegisterError(error) {
    console.warn('Service worker registration failed', error)
  },
})
