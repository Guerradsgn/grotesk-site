/** Only the landing page is React. Everything else is a static file in public/ at the
 *  same address as before: the app and Google point to /privacidade.html, Supabase sends
 *  sign-ins back to /entrar/, and sent emails load their images from /email/. */
const config = {
  // /entrar/ must answer as it is, not redirect to /entrar (Supabase's allowed address)
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: '/entrar', destination: '/entrar/index.html' },
      { source: '/entrar/', destination: '/entrar/index.html' },
    ]
  },
  async redirects() {
    return [{ source: '/index.html', destination: '/', permanent: true }]
  },
}

export default config
