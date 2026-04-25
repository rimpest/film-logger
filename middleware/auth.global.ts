/**
 * Global route guard. Public pages: /login, /register.
 * Anything else requires a session.
 */
const PUBLIC_PATHS = new Set(['/login', '/register'])

export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn } = useUserSession()
  if (PUBLIC_PATHS.has(to.path)) {
    if (loggedIn.value && to.query.redirect !== '0') {
      return navigateTo('/')
    }
    return
  }
  if (!loggedIn.value) {
    return navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`)
  }
})
