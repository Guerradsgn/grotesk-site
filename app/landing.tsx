'use client'

import { useEffect, useRef } from 'react'
import { GlimmScope, type GlimmScopeHandle } from 'glimm/react'

// The waitlist's only door (join_waitlist on Supabase): it answers the same whether the
// address is new or already there. The publishable key is public by design.
const JOIN = 'https://kceuqxwzqmdegrtyvlci.supabase.co/rest/v1/rpc/join_waitlist'
const KEY = 'sb_publishable_bEzHR-0uGjXq0Q9MX2lWLQ_hvT_aIkl'

type Failure = 'invalid' | 'network' | 'server'
const MESSAGES: Record<Failure, string> = {
  invalid: "That doesn't look like an email.",
  network: 'No connection. Try again.',
  server: "Couldn't add you. Try again.",
}

// the same rule as join_waitlist, so a cleared error never comes back on submit
const valid = (v: string) => v.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)

export default function Landing() {
  const scope = useRef<GlimmScopeHandle>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const timeRef = useRef<HTMLTimeElement>(null)

  // the time in São Paulo, where Grotesk is made ("3:29pm", as on euguerra.com)
  useEffect(() => {
    const time = timeRef.current
    if (!time) return
    let fmt: Intl.DateTimeFormat | undefined
    try {
      fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Sao_Paulo' })
    } catch {}
    const tick = () => {
      if (!fmt) return
      const now = new Date()
      time.textContent = fmt.format(now).replace(/\s/g, '').toLowerCase()
      time.setAttribute('datetime', now.toISOString())
    }
    tick()
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  }, [])

  // The form, modelled on glimm.dev's Publish: the pill inside the field widens for
  // "Adding you" while the page leans in towards it; when the request is done, glimm's
  // band sweeps down the page and the new state is behind it. The versions of the pill
  // and of the line under the field are layers in one slot that crossfade (style.css);
  // this only switches which one is on.
  useEffect(() => {
    const form = formRef.current
    if (!form) return
    const $ = <T extends Element>(s: string) => form.querySelector(s) as T
    const field = $<HTMLInputElement>('.field'), trap = $<HTMLInputElement>('.trap'), pill = $<HTMLButtonElement>('.pill')
    const idle = $<HTMLElement>('.idle'), busy = $<HTMLElement>('.busy'), glyph = $<HTMLElement>('.glyph')
    const sendingLabel = $<HTMLElement>('[data-step="sending"]'), doneLabel = $<HTMLElement>('[data-step="done"]')
    const msgs = Array.from(form.querySelectorAll<HTMLElement>('.msg'))
    const errs = msgs.filter((m) => m.dataset.msg === 'err')
    const hint = msgs[0], thanks = msgs[msgs.length - 1], status = $<HTMLElement>('[role="status"]')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    let errSlot = errs[1], errKind: Failure | '' = '', spinOff: ReturnType<typeof setTimeout> | undefined

    // an inactive version can't be clicked, tabbed to or read aloud
    const layer = (el: HTMLElement, on: boolean) => {
      if (on) { el.setAttribute('data-on', ''); el.removeAttribute('aria-hidden'); el.inert = false }
      else { el.removeAttribute('data-on'); el.setAttribute('aria-hidden', 'true'); el.inert = true }
    }
    // the pill hugs the version it shows and eases between widths; the text keeps clear
    const fit = () => {
      const st = form.dataset.state
      const w = st === 'sending' || st === 'done'
        ? glyph.offsetWidth + 8 + (st === 'done' ? doneLabel : sendingLabel).offsetWidth
        : idle.offsetWidth
      pill.style.width = Math.ceil(w + 28) + 'px'
      field.style.paddingRight = Math.ceil(w + 28 + 18) + 'px'
    }
    const show = (state: 'idle' | 'sending' | 'done' | 'error') => {
      form.dataset.state = state
      layer(idle, state === 'idle' || state === 'error'); layer(busy, state === 'sending' || state === 'done')
      layer(sendingLabel, state !== 'done'); layer(doneLabel, state === 'done')
      fit()
    }
    const lane = (kind: 'hint' | 'thanks' | 'err', text?: string) => {
      let target = kind === 'hint' ? hint : kind === 'thanks' ? thanks : null
      if (kind === 'err') { errSlot = errSlot === errs[0] ? errs[1] : errs[0]; errSlot.textContent = text ?? ''; target = errSlot }
      msgs.forEach((m) => layer(m, m === target))
    }
    // a timer, not a frame: it runs in a background tab too
    const announce = (text: string) => { status.textContent = ''; setTimeout(() => { status.textContent = text }, 60) }
    const shake = () => {
      if (still.matches || !field.animate) return
      field.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }],
        { duration: 320, easing: 'cubic-bezier(.25,.8,.25,1)' },
      )
    }
    const done = () => {
      show('done'); lane('thanks'); announce("You're on the list. Thanks.")
      clearTimeout(spinOff); spinOff = setTimeout(() => form.classList.remove('spinning'), 450)   // turns through its fade-out, then stops
    }
    const fail = (kind: Failure) => {
      errKind = kind; show('error'); lane('err', MESSAGES[kind]); announce(MESSAGES[kind])
      form.classList.remove('spinning'); field.readOnly = false; pill.disabled = false
      shake(); field.focus()   // a disabled button drops focus: bring it back to the field
    }
    // the request, held to about a second and a half even on a fast reply (glimm.dev's
    // Publish holds about the same), given up after 10s; rejects with why
    const request = async (address: string) => {
      const t0 = Date.now(), stop = new AbortController()
      const giveUp = setTimeout(() => stop.abort(), 10000)
      let result: 'ok' | Failure
      try {
        const r = await fetch(JOIN, {
          method: 'POST', signal: stop.signal,
          headers: { apikey: KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ address }),
        })
        result = r.ok ? 'ok' : r.status === 400 ? 'invalid' : 'server'
      } catch { result = 'network' }
      clearTimeout(giveUp)
      await new Promise((res) => setTimeout(res, Math.max(0, 1500 - (Date.now() - t0))))
      if (result !== 'ok') throw result
    }

    const onInput = () => {
      // a format error leaves the moment the address is right; a failed send, as soon as you type
      if (form.dataset.state === 'error' && (errKind !== 'invalid' || valid(field.value.trim().toLowerCase()))) { show('idle'); lane('hint') }
    }
    const onSubmit = (e: Event) => {
      e.preventDefault()
      const state = form.dataset.state
      if (state === 'sending' || state === 'done') return
      const address = field.value.trim().toLowerCase()
      if (!valid(address)) { fail('invalid'); return }
      field.readOnly = true; pill.disabled = true
      if (trap.value) { done(); return }   // only a bot fills the hidden field
      show('sending'); form.classList.add('spinning'); announce('Adding you')
      const r = pill.getBoundingClientRect()
      const handle = scope.current?.play({
        at: [r.left + r.width / 2, r.top + r.height / 2],   // the page leans in towards the pill
        work: () => request(address),
        change: done,                                     // behind the band
        onFail: (why) => fail((why as Failure) || 'server'),
      })
      // no scope (it never mounted): do the work without the effect
      if (!handle) request(address).then(done, (why: Failure) => fail(why))
    }

    field.addEventListener('input', onInput)
    form.addEventListener('submit', onSubmit)
    // fonts change the labels' widths: fit again once they're in
    fit(); document.fonts?.ready.then(fit)
    return () => {
      field.removeEventListener('input', onInput)
      form.removeEventListener('submit', onSubmit)
      clearTimeout(spinOff)
    }
  }, [])

  return (
    // glimm.dev's Publish demo: the whole page in one scope, the ember band down it in 2.7s
    <GlimmScope ref={scope} direction="ttb" sweepMs={2700} palette="ember" bandTight={28} peakAlpha={1.1} brightness={1.15} curve={0.12}
      style={{ position: 'fixed', inset: 0 }}>
      <div className="scroll">
        <main className="page">
          <img className="mark rise" src="/moth.svg" alt="" width={60} height={38} />
          <h1 className="name rise" style={{ '--i': 1 } as React.CSSProperties}>Grotesk</h1>
          <p className="meta rise" style={{ '--i': 2 } as React.CSSProperties}><span>macOS</span><span>Private beta</span></p>

          <div className="bio">
            <p className="rise" style={{ '--i': 3 } as React.CSSProperties}><b>For creative people who ship with taste.</b></p>
            <p className="rise" style={{ '--i': 4 } as React.CSSProperties}>Every terminal before it was made by engineers, for engineers. Grotesk was designed for work that&apos;s already above average, and built to make the difference obvious.</p>
            <p className="rise" style={{ '--i': 5 } as React.CSSProperties}>AI terminal for agentic design.</p>
          </div>

          <form ref={formRef} className="notify rise" style={{ '--i': 6 } as React.CSSProperties} noValidate data-state="idle">
            <label className="sr" htmlFor="notify-email">Email</label>
            <div className="field-wrap">
              <input className="field" id="notify-email" name="email" type="email" required autoComplete="email" inputMode="email" spellCheck={false} placeholder="you@studio.com" />
              <button className="pill" type="submit">
                <span className="layer idle" data-on="">Count me in</span>
                <span className="layer busy" aria-hidden="true" inert>
                  <span className="glyph" aria-hidden="true">
                    <svg className="spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" pathLength={1} /></svg>
                    <svg className="tick" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" pathLength={1} /></svg>
                  </span>
                  <span className="labels">
                    <span className="lbl" data-step="sending" data-on="">Adding you</span>
                    <span className="lbl" data-step="done" aria-hidden="true" inert>You&apos;re on the list</span>
                  </span>
                </span>
              </button>
            </div>
            <input className="trap" name="gz_hp" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <p className="notify-note">
              <span className="msg" data-msg="hint" data-on="">One email when it&apos;s out. Nothing else. <a className="ln" href="/privacidade.html">Privacy</a>.</span>
              <span className="msg err" data-msg="err" aria-hidden="true" inert />
              <span className="msg err" data-msg="err" aria-hidden="true" inert />
              <span className="msg" data-msg="thanks" aria-hidden="true" inert>Thanks. One email, when it&apos;s out.</span>
            </p>
            <span className="sr" role="status" />
          </form>
        </main>

        <footer className="ground">
          <div className="ground-art" aria-hidden="true" />
          <div className="ground-bar">
            <p className="ground-line">
              <span><time ref={timeRef} id="sp-time" aria-label="Time in São Paulo">--:--</time> in São Paulo</span>
              <a href="mailto:breno@brenoguerradesign.com.br?subject=Grotesk">Contact</a>
              <a href="/privacidade.html">Privacy</a>
            </p>
          </div>
        </footer>
      </div>
    </GlimmScope>
  )
}
