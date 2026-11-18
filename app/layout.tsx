import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

const description = "For creative people who ship with taste. A macOS terminal designed for work that's already above average."

// The title stays exactly "Grotesk": Google's brand check compares it with the app name.
export const metadata: Metadata = {
  title: 'Grotesk',
  description,
  icons: { icon: { url: '/favicon.svg', type: 'image/svg+xml' } },
  openGraph: { title: 'Grotesk', description, type: 'website' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#111111',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/Geist-Latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/GeistSerif-Regular.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/JetBrainsMono.woff2" as="font" type="font/woff2" crossOrigin="" />
        {/* One stylesheet for every page: the privacy page and /entrar/ link the same file. */}
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>{children}</body>
    </html>
  )
}
