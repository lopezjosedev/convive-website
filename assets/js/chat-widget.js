/* ==========================================================================
   CONVIVE — Widget de chat (SOCI)
   Reemplaza al widget embebido de SendPulse. Habla con el mismo motor de
   flujo que el bot de WhatsApp (app/flow/engine.py del bot) via
   POST /wa/web/message — un solo flow.json/terms.json para los dos
   canales, así que actualizar uno actualiza el otro.
   ========================================================================== */
(() => {
  const API_URL = '/wa/web/message';
  const SESSION_KEY = 'soci_session_id';
  const HISTORY_KEY = 'soci_history';
  const DOT_KEY = 'soci_dot_dismissed';
  const MAX_HISTORY = 60;
  const STAGGER_MS = 450;

  const ICON_CHAT = `<svg class="soci-bubble__chat" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3C6.98 3 3 6.58 3 11c0 2.42 1.19 4.6 3.08 6.08-.1.96-.43 2.2-1.28 3.42a.5.5 0 0 0 .53.77c1.86-.5 3.26-1.32 4.17-1.98A11.3 11.3 0 0 0 12 19c5.02 0 9-3.58 9-8s-3.98-8-9-8Z"
      fill="currentColor"/>
  </svg>
  <svg class="soci-bubble__close" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`;

  const ICON_AVATAR = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 5.8 2 10.5c0 2.6 1.36 4.94 3.5 6.52-.1 1.06-.47 2.4-1.4 3.73a.5.5 0 0 0 .55.78c2-.5 3.55-1.42 4.55-2.15A12 12 0 0 0 12 19c5.52 0 10-3.8 10-8.5S17.52 2 12 2Z" fill="currentColor"/>
  </svg>`;

  const ICON_SEND = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.4 20.6 21 12 3.4 3.4 3 10l12 2-12 2 .4 6.6Z" fill="currentColor"/>
  </svg>`;

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getSessionId() {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    } catch {
      /* localStorage lleno o deshabilitado: no es crítico, seguimos sin persistir */
    }
  }

  function buildDom() {
    const bubble = document.createElement('button');
    bubble.className = 'soci-bubble';
    bubble.type = 'button';
    bubble.setAttribute('aria-label', 'Abrir chat con SOCI');
    bubble.innerHTML = `${ICON_CHAT}<span class="soci-bubble__dot"></span>`;

    const panel = document.createElement('div');
    panel.className = 'soci-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat con SOCI, el asistente de CONVIVE');
    panel.innerHTML = `
      <div class="soci-panel__header">
        <div class="soci-panel__avatar">${ICON_AVATAR}</div>
        <div>
          <div class="soci-panel__title">SOCI · CONVIVE</div>
          <div class="soci-panel__subtitle">Asistente virtual</div>
        </div>
      </div>
      <div class="soci-panel__body" data-soci-body></div>
      <form class="soci-panel__footer" data-soci-form>
        <input class="soci-input" type="text" maxlength="1500" placeholder="Escribí acá..." data-soci-input autocomplete="off" />
        <button class="soci-send" type="submit" aria-label="Enviar" data-soci-send>${ICON_SEND}</button>
      </form>
    `;

    document.body.appendChild(panel);
    document.body.appendChild(bubble);
    return { bubble, panel, body: panel.querySelector('[data-soci-body]'),
             form: panel.querySelector('[data-soci-form]'), input: panel.querySelector('[data-soci-input]'),
             sendBtn: panel.querySelector('[data-soci-send]') };
  }

  function init() {
    const dom = buildDom();
    const sessionId = getSessionId();
    let history = loadHistory();
    let busy = false;

    function scrollToBottom() {
      dom.body.scrollTop = dom.body.scrollHeight;
    }

    function appendUserBubble(text, persist = true) {
      const el = document.createElement('div');
      el.className = 'soci-msg soci-msg--user';
      el.textContent = text;
      dom.body.appendChild(el);
      if (persist) {
        history.push({ from: 'user', text });
        saveHistory(history);
      }
      scrollToBottom();
    }

    function disableSiblingOptions(container) {
      container.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    }

    // 27/10, pedido de Cande tras la toma de 6to A: durante la toma,
    // algunas alumnas escribían la respuesta en el campo de texto en vez
    // de tocar la opción (botón/lista) que correspondía — como el sistema
    // necesitaba la opción marcada, el bot volvía a mandar la misma
    // pregunta sin que quedara claro por qué. La corrección real es acá:
    // mientras la última pregunta del bot es de botones o lista (opción
    // única o múltiple), se oculta el campo de texto libre entero, para
    // que la única forma de responder sea tocando una opción. Se vuelve a
    // mostrar apenas la próxima pregunta es de texto libre.
    function actualizarFormulario(ultimoMensaje) {
      const esEstructurado = !!ultimoMensaje
        && (ultimoMensaje.kind === 'buttons' || ultimoMensaje.kind === 'list' || ultimoMensaje.kind === 'list_multi');
      dom.form.classList.toggle('is-hidden', esEstructurado);
    }

    function renderBotMessage(msg, persist = true) {
      if (msg.kind === 'text') {
        const el = document.createElement('div');
        el.className = 'soci-msg soci-msg--bot';
        el.textContent = msg.text;
        dom.body.appendChild(el);
      } else if (msg.kind === 'buttons') {
        if (msg.body) {
          const body = document.createElement('div');
          body.className = 'soci-msg soci-msg--bot';
          body.textContent = msg.body;
          dom.body.appendChild(body);
        }
        const wrap = document.createElement('div');
        wrap.className = 'soci-options soci-options--row';
        (msg.buttons || []).forEach((label) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'soci-option';
          btn.textContent = label;
          btn.addEventListener('click', () => {
            disableSiblingOptions(wrap);
            handleUserInput(label);
          });
          wrap.appendChild(btn);
        });
        dom.body.appendChild(wrap);
      } else if (msg.kind === 'list') {
        if (msg.body) {
          const body = document.createElement('div');
          body.className = 'soci-msg soci-msg--bot';
          body.textContent = msg.body;
          dom.body.appendChild(body);
        }
        const wrap = document.createElement('div');
        wrap.className = 'soci-options';
        (msg.rows || []).forEach((row) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'soci-list-row';
          btn.innerHTML = `<div class="soci-list-row__title"></div>${row.description ? '<div class="soci-list-row__desc"></div>' : ''}`;
          btn.querySelector('.soci-list-row__title').textContent = row.title;
          if (row.description) btn.querySelector('.soci-list-row__desc').textContent = row.description;
          btn.addEventListener('click', () => {
            disableSiblingOptions(wrap);
            handleUserInput(row.title);
          });
          wrap.appendChild(btn);
        });
        dom.body.appendChild(wrap);
      } else if (msg.kind === 'list_multi') {
        if (msg.body) {
          const body = document.createElement('div');
          body.className = 'soci-msg soci-msg--bot';
          body.textContent = msg.body;
          dom.body.appendChild(body);
        }
        const wrap = document.createElement('div');
        wrap.className = 'soci-options soci-multi';
        const checks = [];
        (msg.rows || []).forEach((row, i) => {
          const id = `soci-multi-${Date.now()}-${i}`;
          const label = document.createElement('label');
          label.className = 'soci-check';
          label.setAttribute('for', id);
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.id = id;
          input.value = row.title;
          const span = document.createElement('span');
          span.className = 'soci-check__box';
          const text = document.createElement('span');
          text.className = 'soci-check__text';
          text.innerHTML = `<span class="soci-check__title"></span>${row.description ? '<span class="soci-check__desc"></span>' : ''}`;
          text.querySelector('.soci-check__title').textContent = row.title;
          if (row.description) text.querySelector('.soci-check__desc').textContent = row.description;
          label.appendChild(input);
          label.appendChild(span);
          label.appendChild(text);
          wrap.appendChild(label);
          checks.push(input);
        });
        const submit = document.createElement('button');
        submit.type = 'button';
        submit.className = 'soci-option soci-multi__submit';
        submit.textContent = msg.button_label || 'Listo';
        submit.addEventListener('click', () => {
          const elegidas = checks.filter((c) => c.checked).map((c) => c.value);
          checks.forEach((c) => { c.disabled = true; });
          submit.disabled = true;
          handleUserInput(elegidas.length ? elegidas.join(', ') : 'Ninguna');
        });
        wrap.appendChild(submit);
        dom.body.appendChild(wrap);
      } else if (msg.kind === 'image' && msg.link) {
        const el = document.createElement('div');
        el.className = 'soci-msg soci-msg--bot soci-msg--image';
        if (msg.caption) {
          const cap = document.createElement('div');
          cap.textContent = msg.caption;
          el.appendChild(cap);
        }
        const img = document.createElement('img');
        img.src = msg.link;
        img.alt = msg.caption || '';
        el.appendChild(img);
        dom.body.appendChild(el);
      }
      if (persist) {
        history.push({ from: 'bot', msg });
        saveHistory(history);
      }
      scrollToBottom();
    }

    function showTyping() {
      const el = document.createElement('div');
      el.className = 'soci-typing';
      el.setAttribute('data-soci-typing', '');
      el.innerHTML = '<span></span><span></span><span></span>';
      dom.body.appendChild(el);
      scrollToBottom();
      return el;
    }

    function setBusy(v) {
      busy = v;
      dom.input.disabled = v;
      dom.sendBtn.disabled = v;
    }

    async function handleUserInput(text) {
      const clean = (text || '').trim();
      if (!clean || busy) return;
      appendUserBubble(clean);
      setBusy(true);
      const typing = showTyping();

      let messages = [];
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, text: clean }),
        });
        if (res.status === 429) {
          messages = [{ kind: 'text', text: 'Estamos recibiendo muchos mensajes tuyos seguidos — esperá unos segundos y probá de nuevo.' }];
        } else if (!res.ok) {
          messages = [{ kind: 'text', text: 'Uh, tuvimos un problema técnico. Probá de nuevo en un momento.' }];
        } else {
          const data = await res.json();
          messages = data.messages || [];
        }
      } catch {
        messages = [{ kind: 'text', text: 'No pudimos conectar. Revisá tu conexión y probá de nuevo.' }];
      }

      typing.remove();
      setBusy(false);
      dom.input.focus();

      for (let i = 0; i < messages.length; i++) {
        if (i > 0) {
          const t = showTyping();
          await new Promise((r) => setTimeout(r, STAGGER_MS));
          t.remove();
        }
        renderBotMessage(messages[i]);
      }
      actualizarFormulario(messages[messages.length - 1]);
    }

    function rehydrate() {
      if (history.length === 0) {
        const saludo = {
          kind: 'text',
          text: '¡Hola! Soy SOCI 👋 Si tenés un código para completar una actividad de CONVIVE, escribilo acá abajo.',
        };
        renderBotMessage(saludo, false);
        actualizarFormulario(saludo);
        return;
      }
      let ultimoMensajeBot = null;
      history.forEach((entry) => {
        if (entry.from === 'user') {
          appendUserBubble(entry.text, false);
        } else {
          renderBotMessage(entry.msg, false);
          ultimoMensajeBot = entry.msg;
        }
      });
      actualizarFormulario(ultimoMensajeBot);
    }

    function openPanel() {
      dom.panel.classList.add('is-open');
      dom.bubble.classList.add('is-open');
      dom.bubble.setAttribute('aria-label', 'Cerrar chat con SOCI');
      dom.bubble.querySelector('.soci-bubble__dot').classList.add('is-hidden');
      localStorage.setItem(DOT_KEY, '1');
      // El panel es pantalla completa: bloqueamos el scroll de la pagina
      // de atras para que quede realmente "limpio" (pedido de Cande), no
      // se vea ni se pueda mover el contenido detras del chat.
      document.body.style.overflow = 'hidden';
      dom.input.focus();
      scrollToBottom();
    }

    function closePanel() {
      dom.panel.classList.remove('is-open');
      dom.bubble.classList.remove('is-open');
      dom.bubble.setAttribute('aria-label', 'Abrir chat con SOCI');
      document.body.style.overflow = '';
    }

    dom.bubble.addEventListener('click', () => {
      if (dom.panel.classList.contains('is-open')) closePanel();
      else openPanel();
    });

    dom.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = dom.input.value;
      dom.input.value = '';
      handleUserInput(text);
    });

    if (localStorage.getItem(DOT_KEY)) {
      dom.bubble.querySelector('.soci-bubble__dot').classList.add('is-hidden');
    }

    rehydrate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
