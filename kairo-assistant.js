/* Kairo — floating assistant widget. Local commands work with no key or backend.
   LLM chat is optional: set a Cloudflare Worker URL in the widget Settings. */
(() => {
  'use strict';

  const script = document.currentScript;
  const base = script ? new URL('.', script.src).href : new URL('./', location.href).href;
  const sheet = document.createElement('link');
  sheet.rel = 'stylesheet';
  sheet.href = base + 'css/kairo-assistant.css';
  document.head.appendChild(sheet);

  const LS_WORKER = 'kairo-worker-url';
  const LS_LIGHTS = 'kairo-lights-mode';
  const LS_VOICE = 'kairo-voice-replies';
  const POSTS = [
    'posts/small-tools.html', 'posts/quiet-interfaces.html', 'posts/testing-notes.html',
    'posts/cli-setup.html', 'posts/type-scales.html', 'posts/readme.html'
  ];

  const root = document.createElement('div');
  root.id = 'kairo-assistant';
  root.className = 'ka-root lights-full';
  root.innerHTML = `
    <button class="ka-orb" id="ka-orb" type="button" aria-label="Open Kairo assistant" aria-expanded="false" aria-controls="ka-panel">
      <span class="ka-ring r1" aria-hidden="true"></span>
      <span class="ka-ring r2" aria-hidden="true"></span>
      <span class="ka-ring r3" aria-hidden="true"></span>
      <span class="ka-core" aria-hidden="true"><span class="ka-glyph">K.</span></span>
      <canvas class="ka-wave" id="ka-wave" width="180" height="42" aria-hidden="true"></canvas>
    </button>
    <section class="ka-panel" id="ka-panel" hidden role="dialog" aria-label="Kairo assistant">
      <header class="ka-head">
        <div><strong>Kairo</strong><span class="ka-sub" id="ka-status">Local mode</span></div>
        <div class="ka-head-actions">
          <button class="ka-mini" id="ka-lights" type="button" title="Cycle lighting" aria-label="Cycle lighting">✦</button>
          <button class="ka-mini" id="ka-close" type="button" title="Close" aria-label="Close assistant">×</button>
        </div>
      </header>
      <div class="ka-log" id="ka-log" role="log" aria-live="polite"></div>
      <form class="ka-form" id="ka-form">
        <input id="ka-input" type="text" autocomplete="off" aria-label="Command for Kairo" placeholder="Try: theme dark">
        <button class="ka-mic" id="ka-mic" type="button" title="Speak" aria-label="Speak a command">🎤</button>
        <button class="ka-send" type="submit" title="Send" aria-label="Send command">➤</button>
      </form>
      <details class="ka-settings">
        <summary>Settings (worker URL, voice)</summary>
        <label class="ka-check"><input type="checkbox" id="ka-voice" checked> Voice replies</label>
        <div class="ka-worker-row">
          <input id="ka-worker" type="url" placeholder="https://kairo-assistant.workers.dev" aria-label="Cloudflare Worker URL">
          <button id="ka-save-worker" type="button">Save</button>
        </div>
        <p class="ka-note">Everything stays in this browser. No key is ever stored on the site.</p>
      </details>
    </section>`;
  document.body.appendChild(root);

  const $ = (id) => document.getElementById(id);
  const orb = $('ka-orb');
  const panel = $('ka-panel');
  const input = $('ka-input');
  const logEl = $('ka-log');
  const statusEl = $('ka-status');
  const workerInput = $('ka-worker');
  const voiceToggle = $('ka-voice');
  const canvas = $('ka-wave');

  let workerUrl = localStorage.getItem(LS_WORKER) || '';
  let lightsMode = localStorage.getItem(LS_LIGHTS) || 'full';
  let voiceReplies = localStorage.getItem(LS_VOICE) !== 'off';
  let listening = false;
  let recognition = null;
  let audioCtx = null;
  let analyser = null;
  let micStream = null;
  let waveFrame = 0;
  let fakeTick = 0;
  const history = [];

  workerInput.value = workerUrl;
  voiceToggle.checked = voiceReplies;
  applyLights(lightsMode);
  updateStatus();

  function applyLights(mode) {
    root.classList.remove('lights-full', 'lights-soft', 'lights-off');
    root.classList.add('lights-' + mode);
  }

  function setLights(mode) {
    lightsMode = mode;
    localStorage.setItem(LS_LIGHTS, mode);
    applyLights(mode);
    updateStatus();
    notify(mode === 'off' ? 'Lights off' : 'Lights ' + mode);
  }

  function updateStatus() {
    statusEl.textContent = workerUrl
      ? 'LLM mode · lights ' + lightsMode
      : 'Local mode · lights ' + lightsMode;
  }

  function notify(message) {
    addLog('Kairo', message, 'system');
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show');
      clearTimeout(notify.timer);
      notify.timer = setTimeout(() => toast.classList.remove('show'), 2200);
    }
  }

  function addLog(who, text, kind) {
    const line = document.createElement('p');
    line.className = 'ka-line ' + (kind || 'reply');
    line.textContent = (who ? who + ': ' : '') + text;
    logEl.appendChild(line);
    while (logEl.children.length > 40) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function speak(text) {
    if (!voiceReplies || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    utterance.rate = 1.02;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function go(url) {
    const target = new URL(url, base).href;
    addLog('', 'Opening ' + url, 'action');
    setTimeout(() => { location.href = target; }, 350);
  }

  function setTheme(mode) {
    const button = document.getElementById('theme-toggle');
    if (button && button.getAttribute('aria-pressed') !== String(mode === 'dark')) button.click();
    if (document.documentElement.dataset.theme !== mode) document.documentElement.dataset.theme = mode;
    try { localStorage.setItem('kairo-theme', mode); } catch (error) { /* private mode */ }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'dark' ? '#1b1418' : '#fff9fb');
  }

  function runLocal(text) {
    const raw = String(text || '').trim();
    const t = raw.toLowerCase();

    if (/^(help|madad|commands?|what can you do)/.test(t)) {
      return 'Commands: theme dark/light, search <word>, blog, docs, home, contact, email, share, rss, saved, random post, lights on/off/soft, time, about. Add a worker URL for free-form chat.';
    }
    if (/light/.test(t) && !/theme/.test(t)) {
      if (/off|band/.test(t)) setLights('off');
      else if (/soft|calm|kam/.test(t)) setLights('soft');
      else setLights('full');
      return 'Lighting set to ' + lightsMode + '.';
    }
    if (/theme|dark mode|light mode/.test(t)) {
      const mode = /dark|black|raat/.test(t) ? 'dark' : 'light';
      setTheme(mode);
      return 'Theme changed to ' + mode + '.';
    }
    if (/\b(search|find)\b/.test(t) || /\bblog|writing|posts?\b/.test(t)) {
      const match = raw.match(/(?:search|find|for)\s+(.+)/i);
      if (match && match[1]) {
        go('blog.html?q=' + encodeURIComponent(match[1].trim()));
        return 'Searching posts for “' + match[1].trim() + '”.';
      }
      go('blog.html');
      return 'Opening the writing archive.';
    }
    if (/\bdocs?\b/.test(t)) { go('docs.html'); return 'Opening docs.'; }
    if (/\bhome|homepage|start\b/.test(t)) { go('index.html'); return 'Back to home.'; }
    if (/\bcontact|hello|email\b/.test(t)) {
      if (/copy/.test(t)) {
        const value = 'noviqxofficial@gmail.com';
        if (navigator.clipboard) navigator.clipboard.writeText(value).catch(() => {});
        return 'Email copied: ' + value;
      }
      go('index.html#contact');
      return 'Opening the contact section.';
    }
    if (/\bshare\b/.test(t)) {
      if (navigator.share) {
        navigator.share({ title: document.title, url: location.href }).catch(() => {});
        return 'Share sheet opened.';
      }
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).catch(() => {});
      return 'Link copied to clipboard.';
    }
    if (/\brss|feed/.test(t)) { go('feed.xml'); return 'Opening the RSS feed.'; }
    if (/\bsaved|starred|favourites?\b/.test(t)) {
      go('blog.html');
      return 'Saved posts live in the ★ Saved filter on the writing page.';
    }
    if (/\brandom/.test(t)) {
      go(POSTS[Math.floor(Math.random() * POSTS.length)]);
      return 'Picking a random post.';
    }
    if (/\btime\b/.test(t)) return 'It is ' + new Date().toLocaleTimeString() + ' right now.';
    if (/\b(about|who are you|your name)\b/.test(t)) {
      return 'I am Kairo — your portfolio assistant. I can control this site locally, and with a worker URL I can chat using an LLM too.';
    }
    return null;
  }

  async function callWorker(text) {
    if (!workerUrl) {
      return 'I am in local mode. Try “theme dark”, “search tools”, “open docs”, “random post”, or add a Worker URL in Settings for chat.';
    }
    try {
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, history: history.slice(-6) })
      });
      if (!response.ok) return 'Worker error: HTTP ' + response.status;
      const data = await response.json();
      return String(data.answer || data.error || 'No answer from worker.');
    } catch (error) {
      return 'Worker unreachable: ' + (error && error.message ? error.message : String(error));
    }
  }

  async function handle(text) {
    const value = String(text || '').trim();
    if (!value) return;
    addLog('You', value, 'user');
    history.push({ role: 'user', content: value });
    statusEl.textContent = 'Thinking…';
    root.classList.add('thinking');

    const local = runLocal(value);
    let answer = local;
    if (!answer) answer = await callWorker(value);

    statusEl.textContent = workerUrl ? 'LLM mode · lights ' + lightsMode : 'Local mode · lights ' + lightsMode;
    root.classList.remove('thinking');
    addLog('Kairo', answer, 'reply');
    history.push({ role: 'assistant', content: answer });
    speak(answer);
  }

  function togglePanel(force) {
    const open = typeof force === 'boolean' ? force : panel.hidden;
    panel.hidden = !open;
    orb.setAttribute('aria-expanded', String(open));
    if (open) input.focus();
    else { stopListening(); if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }
  }

  function startWave() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const colours = ['#b8326e', '#7c4dcc', '#3f7fb8', '#2f8f6b', '#c2713a'];

    function clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

    function drawFake() {
      fakeTick += 0.16;
      clear();
      for (let i = 0; i < 28; i++) {
        const h = 6 + Math.abs(Math.sin(fakeTick + i * 0.42)) * 22;
        ctx.fillStyle = colours[i % colours.length];
        ctx.fillRect(i * 6.4, canvas.height / 2 - h / 2, 4, h);
      }
      waveFrame = requestAnimationFrame(drawFake);
    }

    function drawReal() {
      if (!analyser) { drawFake(); return; }
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      clear();
      for (let i = 0; i < 28; i++) {
        const h = 4 + (data[i] / 255) * 34;
        ctx.fillStyle = colours[i % colours.length];
        ctx.fillRect(i * 6.4, canvas.height / 2 - h / 2, 4, h);
      }
      waveFrame = requestAnimationFrame(drawReal);
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && !audioCtx) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        if (!listening) { stream.getTracks().forEach((track) => track.stop()); return; }
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) { drawFake(); return; }
        micStream = stream;
        audioCtx = new AudioContextClass();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        audioCtx.createMediaStreamSource(stream).connect(analyser);
        drawReal();
      }).catch(() => drawFake());
    } else {
      drawFake();
    }
  }

  function stopWave() {
    cancelAnimationFrame(waveFrame);
    if (micStream) { micStream.getTracks().forEach((track) => track.stop()); micStream = null; }
    if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
    analyser = null;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  function startListening() {
    togglePanel(true);
    if (!SpeechRecognition) {
      notify('Speech Recognition is not supported here — type your command.');
      input.focus();
      return;
    }
    if (listening) { stopListening(); return; }
    recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      listening = true;
      root.classList.add('listening');
      statusEl.textContent = 'Sun raha hoon…';
      startWave();
    };
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      input.value = text;
      handle(text);
    };
    recognition.onerror = (event) => {
      notify('Mic error: ' + event.error);
      stopListening();
    };
    recognition.onend = () => stopListening();
    try { recognition.start(); }
    catch (error) { notify('Could not start the mic.'); }
  }

  function stopListening() {
    listening = false;
    root.classList.remove('listening');
    if (recognition) { try { recognition.stop(); } catch (error) { /* already stopped */ } recognition = null; }
    stopWave();
    if (statusEl.textContent === 'Sun raha hoon…') updateStatus();
  }

  orb.addEventListener('click', () => togglePanel());
  $('ka-close').addEventListener('click', () => togglePanel(false));
  $('ka-mic').addEventListener('click', startListening);
  $('ka-lights').addEventListener('click', () => {
    const order = ['full', 'soft', 'off'];
    setLights(order[(order.indexOf(lightsMode) + 1) % order.length]);
  });
  $('ka-save-worker').addEventListener('click', () => {
    workerUrl = workerInput.value.trim();
    localStorage.setItem(LS_WORKER, workerUrl);
    updateStatus();
    notify(workerUrl ? 'Worker saved.' : 'Worker cleared — local mode.');
  });
  voiceToggle.addEventListener('change', () => {
    voiceReplies = voiceToggle.checked;
    localStorage.setItem(LS_VOICE, voiceReplies ? 'on' : 'off');
  });
  $('ka-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value.trim();
    input.value = '';
    handle(value);
  });
  document.addEventListener('keydown', (event) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (event.key === 'Escape' && !panel.hidden) togglePanel(false);
    if (event.key === 'k' && !/INPUT|TEXTAREA/.test(tag) && !event.ctrlKey && !event.metaKey) {
      togglePanel(true);
    }
  });

  // Prefill blog search when arriving from a voice command like "search tools".
  if (/blog\.html$/.test(location.pathname)) {
    const query = new URLSearchParams(location.search).get('q');
    const search = document.getElementById('post-search');
    if (query && search) {
      search.value = query;
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  addLog('', 'Namaste! I am Kairo. Press the orb or type a command.', 'system');
})();
