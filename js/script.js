(() => {
  'use strict';

  const config = window.WEDDING_CONFIG || {};
  const guestId = getGuestId();
  const storageKey = `wedding-rsvp-status-${guestId}`;
  const targetDate = new Date(config.weddingDateIso || '2027-03-21T10:00:00+09:00');
  const els = {};
  let latestStatus = { completed: false, attending: false };

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('resize', setViewportHeight, { passive: true });

  function init() {
    cacheElements();
    setViewportHeight();
    hydrateDefaultValues();
    restoreLocalStatus();
    renderMessage(latestStatus);
    setupOverlay();
    setupFadeIn();
    setupCountdown();
    setupForm();
    syncStatus();
  }

  function cacheElements() {
    Object.assign(els, {
      overlay: document.getElementById('messageOverlay'),
      messageGuestName: document.getElementById('messageGuestName'),
      messageBody: document.getElementById('messageBody'),
      form: document.getElementById('rsvpForm'),
      thanks: document.getElementById('thanksMessage'),
      formStatus: document.getElementById('formStatus'),
      submitButton: document.getElementById('submitButton'),
      guestIdInput: document.getElementById('guestId'),
      nameInput: document.getElementById('name'),
      emailInput: document.getElementById('email'),
      allergyInput: document.getElementById('allergy'),
      days: document.getElementById('days'),
      hours: document.getElementById('hours'),
      minutes: document.getElementById('minutes'),
      seconds: document.getElementById('seconds')
    });
  }

  function getGuestId() {
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get('guest');
    const fromBody = document.body ? document.body.dataset.guestId : '';
    const parts = location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    return normalizeGuestId(fromQuery || fromBody || last || '');
  }

  function normalizeGuestId(value) {
    const repo = config.repoName || 'invitation-test2';
    return String(value || '')
      .trim()
      .replace(/^https?:\/\/[^/]+\//, '')
      .replace(new RegExp(`^${escapeRegExp(repo)}\\/`), '')
      .replace(/^invitation-test2\//, '')
      .replace(/^invitation-test\//, '')
      .replace(/index\.html$/i, '')
      .replace(/\.html$/i, '')
      .replace(/^\/+|\/+$/g, '');
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function setViewportHeight() {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  }

  function getGuestConfig() {
    return (config.guests && config.guests[guestId]) || {};
  }

  function getDisplayName() {
    const fromInput = els.nameInput ? els.nameInput.value.trim() : '';
    const fromConfig = getGuestConfig().displayName;
    const fromBody = document.body ? document.body.dataset.defaultName : '';
    return fromInput || fromConfig || fromBody || 'ゲスト';
  }

  function hydrateDefaultValues() {
    const displayName = getDisplayName();
    if (els.guestIdInput) els.guestIdInput.value = guestId;
    if (els.nameInput && !els.nameInput.value) els.nameInput.value = displayName;
    if (els.nameInput) {
      els.nameInput.addEventListener('input', () => renderMessage(latestStatus));
    }
  }

  function restoreLocalStatus() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (stored.completed) latestStatus = { completed: true, attending: Boolean(stored.attending) };
    } catch (_) {
      latestStatus = { completed: false, attending: false };
    }
  }

  function isGasConfigured() {
    return typeof config.gasWebAppUrl === 'string'
      && config.gasWebAppUrl.startsWith('https://script.google.com/')
      && !config.gasWebAppUrl.includes('PASTE_YOUR_GAS_WEB_APP_URL_HERE');
  }

  function renderMessage(status) {
    latestStatus = {
      completed: Boolean(status && status.completed),
      attending: Boolean(status && status.attending)
    };

    const displayName = getDisplayName();
    if (els.messageGuestName) els.messageGuestName.textContent = `${displayName}様`;

    let lines;
    if (!latestStatus.completed) {
      lines = [
        'この度、白戸祐輔と大貫愛佳は結婚することとなりました。',
        'つきましては、結婚式へのご出欠について、',
        'ご入力・ご回答をお願いいたします。',
        '皆様と当日お会いできますことを、',
        '心より楽しみにしております。'
      ];
      setFormCompleted(false);
    } else if (latestStatus.attending) {
      lines = [
        '結婚式へのご出欠について、',
        'ご入力・ご回答いただき、誠にありがとうございました。',
        '皆様と当日お会いできますことを、',
        '心より楽しみにしております！'
      ];
      setFormCompleted(true);
    } else {
      lines = [
        '結婚式へのご出欠について、',
        'ご入力・ご回答いただき、誠にありがとうございました。',
        'またお会いできる日を楽しみにしております。'
      ];
      setFormCompleted(true);
    }

    if (els.messageBody) els.messageBody.innerHTML = lines.join('<br>');
  }

  function setFormCompleted(completed) {
    if (els.form) els.form.classList.toggle('is-hidden', Boolean(completed));
    if (els.thanks) els.thanks.classList.toggle('is-hidden', !completed);
  }

  function setupOverlay() {
    if (!els.overlay) return;
    const openInvitation = () => {
      els.overlay.classList.add('is-hidden');
      window.setTimeout(() => els.overlay.remove(), 820);
    };
    els.overlay.addEventListener('click', openInvitation);
    els.overlay.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openInvitation();
      }
    });
  }

  function setupFadeIn() {
    const nodes = document.querySelectorAll('.fade-in');
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(node => node.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    nodes.forEach(node => observer.observe(node));
  }

  function setupCountdown() {
    const tick = () => {
      const diff = Math.max(0, targetDate.getTime() - Date.now());
      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setText(els.days, days);
      setText(els.hours, pad2(hours));
      setText(els.minutes, pad2(minutes));
      setText(els.seconds, pad2(seconds));
    };
    tick();
    window.setInterval(tick, 1000);
  }

  function pad2(value) { return String(value).padStart(2, '0'); }
  function setText(el, value) { if (el) el.textContent = String(value); }

  function setupForm() {
    if (!els.form) return;
    els.form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!isGasConfigured()) {
        setStatus('GASのWebアプリURLが未設定です。js/config.jsにURLを貼り付けてください。', 'error');
        return;
      }
      const formData = new FormData(els.form);
      const payload = Object.fromEntries(formData.entries());
      payload.guestId = guestId;
      payload.name = String(payload.name || '').trim();
      payload.email = String(payload.email || '').trim();
      payload.allergy = String(payload.allergy || '').trim();

      if (!payload.name || !payload.email || !payload.ceremonyAttendance || !payload.receptionAttendance) {
        setStatus('必須項目を入力・選択してください。', 'error');
        return;
      }

      setLoading(true);
      setStatus('送信しています。画面を閉じずにお待ちください。', '');
      try {
        const result = await jsonp('submit', payload);
        if (!result || !result.ok) throw new Error((result && result.error) || '送信に失敗しました。');
        const attending = Boolean(result.attending);
        localStorage.setItem(storageKey, JSON.stringify({ completed: true, attending, savedAt: Date.now() }));
        if (config.guests && config.guests[guestId]) config.guests[guestId].displayName = result.displayName || payload.name;
        renderMessage({ completed: true, attending });
        setStatus('ご回答ありがとうございました。確認メールをご確認ください。', 'success');
        window.scrollTo({ top: document.getElementById('rsvp')?.offsetTop || 0, behavior: 'smooth' });
      } catch (error) {
        setStatus(`送信できませんでした。${error.message || 'GASの設定を確認してください。'}`, 'error');
      } finally {
        setLoading(false);
      }
    });
  }

  async function syncStatus() {
    if (!isGasConfigured() || !guestId) return;
    try {
      const result = await jsonp('status', { guestId });
      if (!result || !result.ok) return;
      if (config.guests && config.guests[guestId]) config.guests[guestId].displayName = result.displayName || getDisplayName();
      if (els.nameInput && result.displayName) els.nameInput.value = result.displayName;
      if (els.emailInput && result.email && !els.emailInput.value) els.emailInput.value = result.email;
      if (els.allergyInput && result.allergy && !els.allergyInput.value) els.allergyInput.value = result.allergy;
      if (result.ceremonyAttendance) checkRadio('ceremonyAttendance', result.ceremonyAttendance);
      if (result.receptionAttendance) checkRadio('receptionAttendance', result.receptionAttendance);
      if (result.completed) {
        localStorage.setItem(storageKey, JSON.stringify({ completed: true, attending: Boolean(result.attending), savedAt: Date.now() }));
      } else {
        localStorage.removeItem(storageKey);
      }
      renderMessage({ completed: result.completed, attending: result.attending });
    } catch (error) {
      console.warn('Status sync failed:', error);
    }
  }

  function checkRadio(name, attendanceLabel) {
    const value = attendanceLabel === '出席' ? '出席' : attendanceLabel === '欠席' ? '欠席' : '';
    if (!value) return;
    const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (radio) radio.checked = true;
  }

  function jsonp(action, params = {}) {
    return new Promise((resolve, reject) => {
      let url;
      try {
        url = new URL(config.gasWebAppUrl);
      } catch (_) {
        reject(new Error('GASのWebアプリURLが正しくありません。'));
        return;
      }
      const callbackName = `__weddingJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      url.searchParams.set('action', action);
      url.searchParams.set('callback', callbackName);
      url.searchParams.set('_', String(Date.now()));
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
      });

      const script = document.createElement('script');
      const timer = window.setTimeout(() => cleanup(new Error('通信がタイムアウトしました。')), 22000);
      window[callbackName] = data => cleanup(null, data);
      script.onerror = () => cleanup(new Error('GASと通信できませんでした。'));
      script.src = url.toString();
      document.body.appendChild(script);

      function cleanup(error, data) {
        window.clearTimeout(timer);
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
        if (error) reject(error);
        else resolve(data);
      }
    });
  }

  function setLoading(loading) {
    if (!els.submitButton) return;
    els.submitButton.disabled = loading;
    els.submitButton.textContent = loading ? 'Sending...' : 'Send Reply';
  }

  function setStatus(message, type) {
    if (!els.formStatus) return;
    els.formStatus.textContent = message || '';
    els.formStatus.classList.toggle('is-error', type === 'error');
    els.formStatus.classList.toggle('is-success', type === 'success');
  }
})();
