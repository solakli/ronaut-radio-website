/* RNT opener: the Ronaut ident, the tape-peel wordmark and the ON AIR badge, played in the page before a
 * set starts (Staff Picks and the Sets page). Same piece as on YouTube, but live in the browser, so the
 * stored sets, the streams and the tracklist times stay untouched.
 *
 * Ported from the Claude Design file "Ronaut Radio Logo Concepts" → Ronaut/watermark/intros.jsx
 * (CenterWordmark, OnAir, Disc), laid out on a 1920×1080 stage scaled over the video.
 *
 *   RNTOpener.start(video, container, url)   call right before the site calls video.play() for a set
 *                                            that starts from the top; returns false when it skips
 *   RNTOpener.cancel()                       stop it and hand the video back untouched
 *
 * During the intro the set plays muted, blurred and wavy from 0:00 while the ident plays. At the snap it
 * rewinds to 0:00, unmutes and comes into focus, and ON AIR locks lit. A tap, a seek, a pause or a new
 * source ends the intro straight away.
 */
(function () {
  'use strict';
  var OR = '#ff6600', INK = '#0f0f0f';
  var IDENT_URL = '/assets/ident/ronaut-radio-ident.mp3';   // 0.43 s lead-in, the ident, ends at the snap
  var LOCK = 512 / 60;          // the snap: ON AIR locks, the picture sharpens, the set starts
  var SNAP = 0.6;               // focus pull
  var WORD_C0 = 0.6;            // wordmark's t=0
  var AIR_C0 = LOCK - 1.24;     // On Air's t=1.24 (ON AIR solid) lands on the snap
  var END = LOCK + 3.2;         // badge gone
  // Ident level per set: about 1 LU over the set's first two minutes, never louder than the file, at most
  // 12 dB down (same rule as the YouTube uploads). Keyed by the set's HLS slug.
  var IDENT_VOLUME = window.RNT_IDENT_VOLUME || {};

  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, u) { return a + (b - a) * u; };
  var E = {
    linear: function (u) { return u; },
    enter: function (u) { return 1 - Math.pow(1 - u, 3); },
    glide: function (u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; },
    pop: function (u) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }
  };
  var seg = function (t, a, b, ease) { return (ease || E.glide)(clamp((t - a) / (b - a), 0, 1)); };

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ua = navigator.userAgent;
  var isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Android/.test(ua);
  var isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var WAVES = !isSafari && !isTouch;    // SVG displacement on video: desktop Chrome/Firefox/Edge only

  function el(tag, style, parent, text) {
    var e = document.createElement(tag);
    if (style) e.style.cssText = style;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  var svgWave = null;
  function ensureWaveFilter() {
    if (svgWave || !WAVES) return;
    var ns = 'http://www.w3.org/2000/svg';
    svgWave = document.createElementNS(ns, 'svg');
    svgWave.setAttribute('width', '0'); svgWave.setAttribute('height', '0');
    svgWave.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    svgWave.innerHTML = '<filter id="rnt-wave" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">' +
      '<feTurbulence id="rnt-wave-noise" type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="2" seed="7" result="n"/>' +
      '<feDisplacementMap id="rnt-wave-map" in="SourceGraphic" in2="n" scale="30" xChannelSelector="R" yChannelSelector="G"/></filter>';
    document.body.appendChild(svgWave);
  }

  // ---------- the stage: 1920×1080 design coordinates scaled over the picture ----------
  function build(container) {
    var root = el('div', 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden;z-index:50;cursor:pointer;' +
      '-webkit-tap-highlight-color:transparent', container);
    root.setAttribute('aria-label', 'Ronaut Radio intro, tap to skip');
    var stage = el('div', 'position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;pointer-events:none', root);

    // W: Center Wordmark
    var word = el('div', 'position:absolute;left:50%;top:50%;display:flex;flex-direction:column;align-items:flex-start;' +
      'font-family:"Archivo Black","Arial Black",sans-serif;color:#fff;will-change:transform,opacity', stage);
    var lines = ['RO', 'NAUT', 'RADIO'].map(function (l) {
      var row = el('div', 'position:relative;font-size:190px;line-height:168px;letter-spacing:-4px;white-space:nowrap', word);
      var span = el('span', 'opacity:0;text-shadow:0 6px 24px rgba(0,0,0,.45)', row, l);
      var tape = el('div', 'position:absolute;left:-14px;right:-14px;top:8px;bottom:8px;background:' + OR + ';transform:scaleX(0)', row);
      return { span: span, tape: tape };
    });
    var tagRow = el('div', 'display:flex;align-items:center;gap:36px;margin-top:34px;height:40px', word);
    var bar = el('div', 'width:0;height:8px;background:' + OR, tagRow);
    var tag = el('span', 'font-family:"Space Mono","Courier New",monospace;font-size:38px;letter-spacing:10px;white-space:pre;' +
      'text-shadow:0 2px 10px rgba(0,0,0,.5)', tagRow, '');

    // 5A: On Air (rings, pill, disc) at the watermark spot
    var WX = 1920 - 125, WY = 1080 - 95;
    var rings = [0, 1, 2, 3].map(function (i) {
      return el('div', 'position:absolute;border-radius:50%;border:' + (6 - i) + 'px solid ' + OR + ';opacity:0;' +
        'clip-path:polygon(50% 50%,0 0,50% -20%,20% 50%);-webkit-clip-path:polygon(50% 50%,0 0,50% -20%,20% 50%)', stage);
    });
    var pillBox = el('div', 'position:absolute;top:' + (WY - 34) + 'px;height:68px;overflow:hidden;border-radius:34px 0 0 34px;width:0', stage);
    var pill = el('div', 'position:absolute;left:0;top:0;height:68px;width:330px;display:flex;align-items:center;gap:14px;' +
      'padding-left:26px;background:' + INK + ';border:3px solid ' + OR + ';border-radius:34px;box-sizing:border-box', pillBox);
    var dot = el('div', 'width:16px;height:16px;border-radius:50%;flex:none', pill);
    var col = el('div', 'display:flex;flex-direction:column;line-height:1', pill);
    var onAir = el('span', 'font-family:"Archivo Black","Arial Black",sans-serif;font-size:28px;color:' + OR, col, 'ON AIR');
    el('span', 'font-family:"Space Mono","Courier New",monospace;font-size:16px;color:#fff;margin-top:4px', col, 'RONAUTRADIO.LA');
    var disc = el('div', 'position:absolute;left:' + (WX - 70) + 'px;top:' + (WY - 70) + 'px;width:140px;height:140px;border-radius:50%;' +
      'background:' + OR + ';box-shadow:inset 0 0 0 4.9px ' + INK + ',0 6px 16px rgba(0,0,0,.4);overflow:hidden;opacity:0', stage);
    var img = el('img', 'position:absolute;left:15%;top:15%;width:80.2%;height:82.8%', disc);
    img.src = '/assets/surfers/og-dj-light.webp'; img.alt = '';

    return { root: root, stage: stage, word: word, lines: lines, bar: bar, tag: tag, rings: rings, pillBox: pillBox,
             dot: dot, onAir: onAir, disc: disc, WX: WX, WY: WY };
  }

  function layout(s) {
    // the picture's box inside the container (object-fit: contain)
    var v = s.video, c = s.container;
    var cw = c.clientWidth, ch = c.clientHeight;
    var vr = v.getBoundingClientRect(), cr = c.getBoundingClientRect();
    var bw = vr.width || cw, bh = vr.height || ch;
    var ar = (v.videoWidth && v.videoHeight) ? v.videoWidth / v.videoHeight : 16 / 9;
    var w = bw, h = bw / ar;
    if (h > bh) { h = bh; w = bh * ar; }
    var left = (vr.left - cr.left) + (bw - w) / 2, top = (vr.top - cr.top) + (bh - h) / 2;
    s.ui.root.style.left = left + 'px'; s.ui.root.style.top = top + 'px';
    s.ui.root.style.width = w + 'px'; s.ui.root.style.height = h + 'px';
    s.ui.stage.style.transform = 'scale(' + (w / 1920) + ')';
    s.scale = w / 1920;
  }

  function dream(s, a) {
    // blurred, wavy, a little desaturated and darker; a = 1 during the intro, easing to 0 at the snap
    if (a <= 0.001) { s.video.style.filter = s.origFilter; return; }
    var blur = 14 * s.scale * a;
    var f = 'blur(' + blur.toFixed(2) + 'px) saturate(' + (1 - 0.35 * a).toFixed(3) + ') brightness(' + (1 - 0.18 * a).toFixed(3) + ')';
    if (WAVES) {
      var map = document.getElementById('rnt-wave-map'), noise = document.getElementById('rnt-wave-noise');
      if (map && noise) {
        map.setAttribute('scale', (48 * s.scale * a).toFixed(1));
        var ph = s.t;
        noise.setAttribute('baseFrequency', (0.006 + 0.0012 * Math.sin(ph * 1.7)).toFixed(5) + ' ' + (0.012 + 0.002 * Math.sin(ph * 2.3 + 1)).toFixed(5));
        f = 'url(#rnt-wave) ' + f;
      }
    }
    s.video.style.filter = f;
  }

  function render(s, T) {
    var u = s.ui;
    // --- wordmark (the design's CenterWordmark, lifting out at the snap) ---
    var t = T - WORD_C0;
    var out = seg(T, LOCK, LOCK + 0.7, E.glide);
    var drift = lerp(1, 1.03, seg(t, 1.0, LOCK - WORD_C0, E.linear));
    u.word.style.opacity = t < 0 ? 0 : 1 - out;
    u.word.style.transform = 'translate(-50%,-50%) translateY(' + (-40 * out) + 'px) scale(' + drift + ')';
    u.lines.forEach(function (ln, i) {
      var a = 0.15 * i;
      var inW = seg(t, 0.1 + a, 0.55 + a, E.enter), offW = seg(t, 0.7 + a, 1.15 + a, E.enter);
      ln.span.style.opacity = offW > 0 ? 1 : 0;
      ln.tape.style.transformOrigin = offW > 0 ? '100% 50%' : '0% 50%';
      ln.tape.style.transform = 'scaleX(' + (offW > 0 ? 1 - offW : inW) + ')';
    });
    u.bar.style.width = (96 * seg(t, 1.4, 1.8, E.enter)) + 'px';
    var chars = Math.round(8 * seg(t, 1.7, 2.3, E.linear));
    if (u.tag._n !== chars) { u.tag.textContent = 'EST 2025'.slice(0, chars); u.tag._n = chars; }

    // --- On Air (the design's OnAir, cued so ON AIR locks on the snap) ---
    var ta = T - AIR_C0;
    var fade = 1 - seg(T, LOCK + 2.6, LOCK + 3.2, E.glide);
    [0, 0.35, 0.7, 1.05].forEach(function (d, i) {
      var r = u.rings[i], uu = seg(ta, 0.1 + d, 1.5 + d, E.enter);
      if (uu <= 0 || uu >= 1) { r.style.opacity = 0; return; }
      var rad = 80 + uu * 520;
      r.style.left = (u.WX - rad) + 'px'; r.style.top = (u.WY - rad) + 'px';
      r.style.width = r.style.height = (rad * 2) + 'px';
      r.style.opacity = (1 - uu) * 0.8;
    });
    var flick = [[1.0, 1.06], [1.12, 1.16], [1.24, 1.5]];
    var lit = ta >= 1.5 || flick.some(function (f) { return ta >= f[0] && ta < f[1]; });
    u.dot.style.background = lit ? '#ff2a1a' : '#4a1a14';
    u.dot.style.boxShadow = lit ? '0 0 14px #ff2a1a' : 'none';
    u.onAir.style.opacity = lit ? 1 : 0.15;
    u.onAir.style.textShadow = lit ? '0 0 16px ' + OR : 'none';
    var pillW = 330 * seg(ta, 0.8, 1.1, E.enter) * (1 - seg(ta, 3.2, 3.7, E.glide));
    u.pillBox.style.left = (u.WX - 60 - pillW) + 'px';
    u.pillBox.style.width = (pillW > 0.5 ? pillW + 30 : 0) + 'px';
    u.pillBox.style.opacity = fade;
    var sc = lerp(0.3, 1, seg(ta, 0, 0.5, E.pop));
    u.disc.style.opacity = ta < 0 ? 0 : seg(ta, 0, 0.2, E.glide) * fade;
    u.disc.style.transform = 'scale(' + sc + ')';
  }

  var S = null;   // the running intro

  function now(s) {
    // a steady clock, nudged onto the ident's while it plays in step (keeps sound and picture together);
    // an ident that starts late is left to its own and stopped at the snap
    var wall = (performance.now() - s.t0) / 1000;
    if (s.identOk && !s.ident.paused && s.ident.currentTime > 0 && Math.abs(s.ident.currentTime - wall) < 0.25) {
      s.t0 = performance.now() - s.ident.currentTime * 1000;
      return s.ident.currentTime;
    }
    return wall;
  }

  function logic(s) {
    // timing and hand-over, run from a timer too: animation frames stop in a background tab, and the set
    // must still come in with its sound if someone starts it and switches tabs
    if (S !== s) return false;
    // the site loaded something else into this player (another set, back to live): let go
    // (currentSrc only: an empty src attribute reads back as the page's own URL)
    var src = s.video.currentSrc || '';
    if (!s.src && src) s.src = src;
    else if (s.src && src && src !== s.src) { cancel(); return false; }
    var T = now(s);
    s.t = T;
    if (!s.snapped && T >= LOCK) snap(s);
    if (s.snapped && T >= END) { finish(); return false; }
    return true;
  }

  function reveal(s) {
    // bring the player into view once it has a size (switching to the Sets page can leave it off-screen)
    if (s.revealed || !s.container.clientWidth) return;
    s.revealed = true;
    var r = s.container.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight * 0.5) {
      window.scrollTo({ top: Math.max(0, window.pageYOffset + r.top - 80), behavior: 'smooth' });
    }
  }

  function tick() {
    var s = S;
    if (!s || !logic(s)) return;
    if (++s.frames % 30 === 1) { layout(s); reveal(s); }
    render(s, s.t);
    dream(s, s.snapped ? 1 - E.enter(clamp((s.t - LOCK) / SNAP, 0, 1)) : 1);
    s.raf = requestAnimationFrame(tick);
  }

  function snap(s) {
    // the set starts for real: back to 0:00, sound on, into focus
    s.snapped = true;
    s.ui.root.style.pointerEvents = 'none';
    s.ui.root.style.cursor = '';
    s.ourSeek = true;
    try { s.video.currentTime = 0; } catch (e) {}
    s.video.muted = s.wantMuted;
    var p = s.video.play();
    if (p && p.catch) p.catch(function () {});
    if (s.ident && !s.ident.paused) {
      // the ident has faded out by here; stop it so it can't overlap the set
      setTimeout(function () { try { s.ident.pause(); } catch (e) {} }, 150);
    }
  }

  function detach(s) {
    s.video.removeEventListener('seeking', s.onSeeking);
    s.video.removeEventListener('pause', s.onPause);
    s.video.removeEventListener('loadedmetadata', s.onMeta);
    window.removeEventListener('resize', s.onResize);
    s.ui.root.removeEventListener('click', s.onSkip);
    if (s.raf) cancelAnimationFrame(s.raf);
    if (s.timer) clearInterval(s.timer);
    if (s.ui.root.parentNode) s.ui.root.parentNode.removeChild(s.ui.root);
    s.video.style.filter = s.origFilter;
    try { s.ident.pause(); } catch (e) {}
  }

  function finish() { if (S) { var s = S; S = null; detach(s); } }

  function cancel() {
    // hand the video back as the site set it up: unmuted if it was meant to be, no filter
    if (!S) return;
    var s = S; S = null;
    detach(s);
    if (!s.snapped) s.video.muted = s.wantMuted;
  }

  function skip() {
    // tap during the intro: go straight to the set
    if (!S || S.snapped) return;
    var s = S;
    s.t0 = performance.now() - LOCK * 1000;
    try { s.ident.pause(); } catch (e) {}
    s.identOk = false;
  }

  function slugOf(url) {
    var m = /\/hls-vod\/([^\/?#]+)\.m3u8/.exec(url || '');
    return m ? decodeURIComponent(m[1]) : '';
  }

  function start(video, container, url) {
    cancel();
    if (!video || !container) return false;
    if (reduceMotion || window.RNT_OPENER_OFF) return false;
    // no tap yet (a shared link opening a set): browsers won't let the ident play, so leave the page as is
    var ua_ = navigator.userActivation;
    if (ua_ && !ua_.isActive && !ua_.hasBeenActive) return false;
    try { if (localStorage.getItem('rntOpener') === 'off') return false; } catch (e) {}
    ensureWaveFilter();
    var s = {
      video: video, container: container, ui: build(container), t0: performance.now(), t: 0, snapped: false,
      wantMuted: video.muted, origFilter: video.style.filter || '', scale: 0.5, identOk: false, frames: 0, src: ''
    };
    // the ident starts inside the tap that pressed play, so phones allow its sound
    s.ident = new Audio(IDENT_URL);
    s.ident.preload = 'auto';
    var vol = IDENT_VOLUME[slugOf(url)];
    s.ident.volume = clamp((typeof vol === 'number' ? vol : 0.8) * (video.volume || 1), 0, 1);
    var pp = s.ident.play();
    s.identOk = true;
    if (pp && pp.then) pp.then(function () {}, function () { s.identOk = false; });
    // the set plays muted and blurred under the intro
    video.muted = true;
    s.onSeeking = function () {
      if (S !== s) return;
      if (s.ourSeek) { s.ourSeek = false; return; }
      if (!s.snapped && video.currentTime > 1) cancel();          // someone jumped into the set
    };
    s.onPause = function () { if (S === s && !s.snapped && !video.seeking && video.readyState > 2) cancel(); };
    s.onMeta = function () { if (S === s) layout(s); };
    s.onResize = function () { if (S === s) layout(s); };
    s.onSkip = function (e) { e.preventDefault(); e.stopPropagation(); skip(); };
    video.addEventListener('seeking', s.onSeeking);
    video.addEventListener('pause', s.onPause);
    video.addEventListener('loadedmetadata', s.onMeta);
    window.addEventListener('resize', s.onResize);
    s.ui.root.addEventListener('click', s.onSkip);
    S = s;
    layout(s);
    render(s, 0);
    dream(s, 1);
    s.raf = requestAnimationFrame(tick);
    s.timer = setInterval(function () { logic(s); }, 200);
    return true;
  }

  window.RNTOpener = { start: start, cancel: cancel, active: function () { return !!S; } };
})();
