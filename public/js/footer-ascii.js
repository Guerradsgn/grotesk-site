/* Footer ASCII (euguerra /links): clouds at night, as if the page floated above them.
   Cumulus in the back: billowy, irregular tops, bright where the light hits them and
   darker the deeper you go, like a painting. In front, a lower, dark mass of cloud
   that fills the footer down to the bottom edge, so the end of the page is never seen.
   Both drift slowly sideways and their tops churn slowly. Drawn in the banner's
   characters (JetBrains Mono 600, the ramp " .:-=+*#%@" and a few fixed brightness
   levels, like a terminal). The pointer lights the clouds under it a little.
   WebGL draws the grid in one pass (2D canvas as a fallback). It only runs while the
   footer is on screen; with reduced motion it is one still frame. */
(function () {
  'use strict';

  var foot = document.querySelector('.ground');
  // inside the footer, or drawn behind the page (the landing) and kept over the footer
  var host = foot && (foot.querySelector('.ground-art') || document.querySelector('.ground-art'));
  if (!host) return;
  var bar = foot.querySelector('.ground-bar');   // the time: above the clouds, or at the foot over them

  // ---- tuning ---------------------------------------------------------------
  var RAMP = ' .:-=+*#%@';
  var TERM = [0.07, 0.2, 0.4, 0.68, 1];   // brightness levels, as in the banner
  var FAMILY = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  var WEIGHT = 600;
  var BACK = { top: 0.14, tower: 0.64, speed: 4, lump: 72 };    // the lit cumulus: lowest top (share of the room under the time), extra height of the towers, drift px/s, lump size px
  var FRONT = { top: 0.12, tower: 0.22, speed: 8, lump: 84 };   // the dark mass in front
  var SOFT = 24;          // px, how soft the cloud edges are
  var LUMPY = 2.6;        // how much the lumps push the outline in and out
  var ABSORB = 190;       // px of cloud the light gets through before it fades
  var CHURN = 1.2;        // px/s the billows roll upward inside the shapes
  var POINTER_R = 120;    // px, reach of the light under the pointer
  var ATTACK = 2.5, RELEASE = 0.9;
  var ENTER = 2.6;        // seconds for the clouds to rise into view

  var NR = RAMP.length - 1;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, y) {                  // smooth value noise, 0..1
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var a = hash(ix + iy * 157), b = hash(ix + 1 + iy * 157), c = hash(ix + (iy + 1) * 157), d = hash(ix + 1 + (iy + 1) * 157);
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(x, y) {                     // layered noise, 0..1
    var v = 0, a = 0.5;
    for (var o = 0; o < 4; o++) { v += a * vnoise(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 9.2; a *= 0.5; }
    return v / 0.9375;
  }
  function billow(x, y) {                  // rounded lumps, the cauliflower look of cumulus
    var v = 0, a = 0.5;                    // (3 octaves: a 4th would be finer than a character)
    for (var o = 0; o < 3; o++) { v += a * (1 - Math.abs(2 * vnoise(x, y) - 1)); x = x * 2.03 + 17.1; y = y * 2.03 + 9.2; a *= 0.5; }
    return v / 0.875;
  }

  // ---- renderer: one quad, the cell grid and a glyph atlas as textures --------
  host.innerHTML = '<canvas class="ga-glow"></canvas><canvas class="ga-field"></canvas>';
  var glow = host.children[0], canvas = host.children[1];
  var gctx = glow.getContext('2d');
  var gl = null, ctx = null, cellTex, atlasTex, uGrid, uCell, uH, uOff;

  function initGL() {
    try { gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true }); } catch (e) { gl = null; }
    if (!gl) return false;
    function sh(type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; }
    var vs = sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}');
    var fs = sh(gl.FRAGMENT_SHADER, [
      'precision highp float;',
      'uniform sampler2D uCells, uAtlas; uniform vec2 uGrid, uCell; uniform float uH, uOff;',
      'void main(){',
      '  vec2 p = vec2(gl_FragCoord.x, uH - gl_FragCoord.y + uOff);',   // rows sit on the bottom edge
      '  vec2 cell = floor(p / uCell);',
      '  if (cell.x >= uGrid.x || cell.y >= uGrid.y) { gl_FragColor = vec4(0.); return; }',
      '  vec2 f = (p - cell * uCell) / uCell;',
      '  vec4 c = texture2D(uCells, (cell + .5) / uGrid);',
      '  float g = floor(c.r * 255. + .5);',
      '  gl_FragColor = vec4(texture2D(uAtlas, vec2((g + f.x) / ' + RAMP.length + '., f.y)).a * c.g);',
      '}'].join('\n'));
    if (!vs || !fs) { gl = null; return false; }
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    function tex(unit) {
      var t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    cellTex = tex(0); atlasTex = tex(1);
    gl.uniform1i(gl.getUniformLocation(prog, 'uCells'), 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'uAtlas'), 1);
    uGrid = gl.getUniformLocation(prog, 'uGrid');
    uCell = gl.getUniformLocation(prog, 'uCell');
    uH = gl.getUniformLocation(prog, 'uH');
    uOff = gl.getUniformLocation(prog, 'uOff');
    return true;
  }
  if (!initGL()) ctx = canvas.getContext('2d');

  var W = 0, H = 0, dpr = 1, cw = 5, ch = 8, cols = 0, rows = 0, off = 0, ceil = 0, scale = 1, lift = 0, quiet = null;
  var out = null, tone = null, topA = null, topB = null, atlas = null, aw = 0, ah = 0;

  function buildAtlas() {
    aw = Math.ceil(cw * dpr); ah = Math.ceil(ch * dpr);
    var c = document.createElement('canvas'); c.width = aw * RAMP.length; c.height = ah;
    var g = c.getContext('2d');
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = WEIGHT + ' ' + Math.round(ch * 0.86) * dpr + 'px ' + FAMILY;
    for (var i = 0; i < RAMP.length; i++) g.fillText(RAMP[i], i * aw + aw / 2, ah / 2 + dpr * 0.5);
    atlas = c;
    if (gl) {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uGrid, cols, rows);
      gl.uniform2f(uCell, cw * dpr, ch * dpr);
      gl.uniform1f(uH, canvas.height);
      gl.uniform1f(uOff, off * dpr);
    }
  }

  function layout() {
    W = host.clientWidth; H = host.clientHeight;
    if (!W || !H) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    cw = W < 640 ? 4 : 5; ch = Math.round(cw * 1.65);   // the banner's cell
    scale = clamp(W / 1280, 0.6, 1.15);                  // smaller lumps on small screens
    lift = W < 640 ? 0.12 : 0;                           // and a fuller sky of clouds there
    cols = Math.ceil(W / cw); rows = Math.ceil(H / ch); off = rows * ch - H;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    glow.width = Math.round(W * dpr / 2); glow.height = Math.round(H * dpr / 2);
    out = new Uint8Array(cols * rows * 4);
    for (var i = 0; i < cols * rows; i++) out[i * 4 + 3] = 255;
    tone = new Float32Array(cols * rows);
    topA = new Float32Array(cols); topB = new Float32Array(cols);
    ceil = H - 16;                        // px above the bottom edge where the clouds must be gone
    quiet = null;                         // a soft clearing behind the time, when it sits over the clouds
    if (bar) {
      var hb = host.getBoundingClientRect(), bb = bar.getBoundingClientRect();
      if (bb.top - hb.top < H / 2) ceil = Math.max(ch * 8, H - (bb.bottom - hb.top) - 16);   // above the clouds
      else if (document.createRange) {                                                      // at the foot, over them
        var rg = document.createRange(); rg.selectNodeContents(bar.querySelector('.ground-line') || bar);
        var tb = rg.getBoundingClientRect();
        if (tb.width) quiet = { x0: tb.left - hb.left, x1: tb.right - hb.left, y0: tb.top - hb.top, y1: tb.bottom - hb.top };
      }
    }
    buildAtlas();
    return true;
  }

  // ---- the clouds -------------------------------------------------------------------
  var ptr = { x: 0, y: 0, k: 0, on: false };

  function compose(t, enter) {
    var c, r, i, x, y;
    var sink = (1 - enter) * ceil * 0.45;          // on entry the clouds rise from below
    var soft = SOFT * scale, fA = 1 / (BACK.lump * scale), fB = 1 / (FRONT.lump * scale);
    var lit = ptr.k > 0.01, P2 = POINTER_R * POINTER_R;
    // the outline of each layer along the footer: a few tall towers in the back, a low,
    // rolling line in front; both move with their layer
    for (c = 0; c < cols; c++) {
      x = c * cw + cw / 2;
      var xa = (x + t * BACK.speed) * 0.0026 / scale, xb = (x + t * FRONT.speed) * 0.0045 / scale;
      var tw = smooth(0.36, 0.74, fbm(xa, 3.7));
      tw = 1 - (1 - tw) * (1 - tw);        // broad, rounded heads rather than peaks
      topA[c] = ceil * (BACK.top + lift + BACK.tower * tw) - sink;   // clusters, with sky between
      topB[c] = ceil * (FRONT.top + lift * 0.5 + FRONT.tower * smooth(0.28, 0.72, fbm(xb + 40, 8.3))) - sink;   // a rolling, uneven line
    }
    for (c = 0; c < cols; c++) {
      x = c * cw + cw / 2;
      var ax = (x + t * BACK.speed) * fA, bx = (x + t * FRONT.speed) * fB;
      var accA = 0, accB = 0, hiA = topA[c] + soft * LUMPY * 0.5, hiB = topB[c] + soft * LUMPY * 0.5, prevA = null;
      for (r = 0; r < rows; r++) {
        i = r * cols + c;
        y = r * ch + ch / 2 - off;
        var h = H - y;                     // px above the bottom edge
        if (h > hiA && h > hiB) { tone[i] = 0; continue; }   // open sky
        // front: a dark mass, only its upper edge catches a little light
        var dB = 0, tB = 0;
        if (h < hiB) {
          dB = clamp((topB[c] - h) / soft + (billow(bx + 31, (y + t * CHURN * 0.6) * fB * 1.25 + 7) - 0.55) * LUMPY, 0, 1);
          if (dB > 0) { tB = dB * (0.07 + 0.3 * Math.exp(-accB / (ABSORB * 0.5))); accB += dB * ch; }
        }
        // back: lit cumulus; light comes from above and fades the deeper it goes
        // (skipped where the front mass hides it completely)
        var tA = 0;
        if (h < hiA && dB < 0.999) {
          var rawA = (topA[c] - h) / soft + (billow(ax, (y + t * CHURN) * fA * 1.25) - 0.55) * LUMPY;
          // each lump has a lit top and a shaded underside: compare with the cell above
          var slope = prevA === null ? 0 : (rawA - prevA) - ch / soft;
          prevA = rawA;
          var dA = clamp(rawA, 0, 1);
          if (dA > 0) {
            var lightA = Math.exp(-accA / ABSORB);
            var shade = clamp(0.55 + slope * 2.2, 0, 1);
            tA = Math.pow(dA, 0.7) * (0.1 + 0.95 * lightA) * (0.5 + 0.65 * shade);
            accA += dA * ch;
          }
        } else prevA = null;
        var v = tB + tA * (1 - dB);
        if (lit && (tA > 0 || dB > 0)) {   // the pointer lights the clouds under it
          var px = x - ptr.x, py = (y - ptr.y) * 1.2;
          v += ptr.k * 0.3 * Math.exp(-(px * px + py * py) / P2) * (0.3 + v);
        }
        if (quiet) {                       // the clouds thin out softly around the time, so it reads
          var qx = Math.max(quiet.x0 - x, 0, x - quiet.x1), qy = Math.max(quiet.y0 - y, 0, y - quiet.y1);
          v *= 0.12 + 0.88 * smooth(0, 40, Math.sqrt(qx * qx + qy * qy));
        }
        tone[i] = v * smooth(ceil, ceil * 0.9, h);   // and they fade out before the top
      }
    }
    for (i = 0; i < cols * rows; i++) {
      var tv = clamp(tone[i], 0, 1), j = i * 4, code = Math.round(tv * NR);
      if (!code) { out[j + 1] = 0; continue; }
      var al = TERM[Math.min(TERM.length - 1, (tv * TERM.length) | 0)];
      out[j] = code; out[j + 1] = al >= 1 ? 255 : (al * 255 + 0.5) | 0;
    }
  }

  function present() {
    if (gl) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cellTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, out);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var j = (r * cols + c) * 4;
        if (!out[j + 1]) continue;
        ctx.globalAlpha = out[j + 1] / 255;
        ctx.drawImage(atlas, out[j] * aw, 0, aw, ah, Math.round(c * cw * dpr), Math.round((r * ch - off) * dpr), aw, ah);
      }
      ctx.globalAlpha = 1;
    }
    gctx.globalCompositeOperation = 'copy';   // the glow is the same frame, small and blurred (CSS)
    gctx.drawImage(canvas, 0, 0, glow.width, glow.height);
  }

  // ---- control ------------------------------------------------------------------
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clock = 0, raf = 0, last = 0, visible = false;

  function still() { compose(20, 1); present(); }
  function frame(now) {
    raf = 0;
    if (!visible) return;
    raf = requestAnimationFrame(frame);
    if (last && now - last < 40) return;      // ~25 fps is plenty for clouds
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    clock += dt;                              // only moves while the footer is on screen
    var want = ptr.on ? 1 : 0;
    ptr.k += (want - ptr.k) * Math.min(1, dt * (want > ptr.k ? ATTACK : RELEASE));
    compose(clock, smooth(0, ENTER, clock));
    present();
  }
  function play() { if (ready && !raf && visible) { last = 0; raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  // the footer may have no size yet (a tab opened in the background, a hidden frame):
  // then the clouds wait for the first real size instead of giving up
  var ready = false;
  function start() {
    if (ready || !layout()) return;
    ready = true;
    if (reduce) still(); else { compose(0, 0); present(); play(); }
  }
  start();
  if (document.fonts && document.fonts.load) {
    document.fonts.load(WEIGHT + ' 16px "JetBrains Mono"').then(function () {
      if (!ready) return;
      buildAtlas();
      if (reduce) still(); else if (!raf) { compose(clock, smooth(0, ENTER, clock)); present(); }
    }).catch(function () {});
  }

  if (!reduce) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting && !document.hidden;
        if (visible) play(); else stop();
      }, { rootMargin: '80px 0px' }).observe(host);
    } else { visible = true; play(); }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { visible = false; stop(); }
      else { var b = host.getBoundingClientRect(); visible = b.bottom > 0 && b.top < innerHeight; play(); }
    });
    foot.addEventListener('pointermove', function (ev) {
      var a = host.getBoundingClientRect();
      ptr.x = ev.clientX - a.left; ptr.y = ev.clientY - a.top; ptr.on = true;
    });
    foot.addEventListener('pointerleave', function () { ptr.on = false; });
  }

  var rt;
  if ('ResizeObserver' in window) new ResizeObserver(function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (!ready) { start(); return; }
      if (host.clientWidth === W && host.clientHeight === H) return;
      if (!layout()) return;
      if (reduce) still(); else if (!raf) { compose(clock, smooth(0, ENTER, clock)); present(); }
    }, 120);
  }).observe(host);
})();
