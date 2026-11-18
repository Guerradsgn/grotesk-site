import Script from 'next/script'
import Landing from './landing'

export default function Page() {
  return (
    <>
      <Landing />
      {/* the film-grain lens over everything, outside the page that moves */}
      <div className="fx" aria-hidden="true" />
      {/* the ASCII clouds; it finds .ground on its own once the page is there */}
      <Script src="/js/footer-ascii.js" strategy="afterInteractive" />
    </>
  )
}
