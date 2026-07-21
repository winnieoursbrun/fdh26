import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandaloneNow(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      (navigator as { standalone?: boolean }).standalone === true)
  )
}

const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandaloneNow)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
      Sentry.metrics.count('pwa.installed', 1)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = async () => {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    Sentry.metrics.count('pwa.install_prompt', 1, { attributes: { outcome: choice.outcome } })
    setDeferred(null)
  }

  return {
    // Chrome/Edge/Android : prompt natif disponible
    canPrompt: deferred !== null && !installed,
    // Safari iOS : pas de beforeinstallprompt, on guide manuellement
    needsIosHelp: IS_IOS && deferred === null && !installed,
    promptInstall,
  }
}
