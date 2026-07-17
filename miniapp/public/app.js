(function () {
  var tg = window.Telegram && window.Telegram.WebApp;
  var PHASE_ICON = { intro: '🌱', impact: '💥', history: '🕰️', support: '🤝', readiness: '🚀' };

  function applyTelegramTheme() {
    if (!tg || !tg.themeParams) return;
    var root = document.documentElement.style;
    var p = tg.themeParams;
    if (p.bg_color) root.setProperty('--bg', p.bg_color);
    if (p.secondary_bg_color) root.setProperty('--surface', p.secondary_bg_color);
    if (p.text_color) root.setProperty('--text', p.text_color);
    if (p.hint_color) root.setProperty('--text-muted', p.hint_color);
    if (p.link_color) root.setProperty('--accent-strong', p.link_color);
    if (p.button_color) root.setProperty('--accent', p.button_color);
  }

  function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderMessage(message) {
    document.getElementById('app').innerHTML = '<div class="state-message">' + escapeHtml(message) + '</div>';
  }

  function currentPhaseLabel(profile) {
    if (profile.interviewComplete) return 'Interview complete';
    var current = profile.phases.find(function (phase) { return phase.isCurrent; });
    return current ? current.label : '';
  }

  function renderHeader(profile) {
    var initials = profile.displayName ? profile.displayName.trim().slice(0, 1).toUpperCase() : '🙂';
    return (
      '<div class="profile-header">' +
      '<div class="avatar-circle">' + escapeHtml(initials) + '</div>' +
      '<p class="profile-name">' + escapeHtml(profile.displayName || 'Your profile') + '</p>' +
      '<p class="profile-subtitle">' + escapeHtml(currentPhaseLabel(profile)) + '</p>' +
      '</div>'
    );
  }

  function renderStatRow(profile) {
    var doneCount = profile.phases.filter(function (phase) { return phase.isDone; }).length;
    return (
      '<div class="stat-row">' +
      '<div class="s"><strong>' + doneCount + '/' + profile.phases.length + '</strong><span>chapters</span></div>' +
      '<div class="s"><strong>' + profile.facts.length + '</strong><span>learned</span></div>' +
      '</div>'
    );
  }

  function renderHighlights(profile) {
    var html = '<div class="highlights">';
    profile.phases.forEach(function (phase) {
      var cls = phase.isCurrent ? 'now' : phase.isDone ? 'done' : '';
      html +=
        '<button type="button" class="highlight-bubble ' + cls + '" data-phase="' + phase.key + '">' +
        '<span class="circle">' + (PHASE_ICON[phase.key] || '•') + '</span>' +
        '<span>' + escapeHtml(phase.label) + '</span>' +
        '</button>';
    });
    return html + '</div>';
  }

  function groupFactsByPhase(facts) {
    var byPhase = {};
    facts.forEach(function (fact) {
      (byPhase[fact.phase] = byPhase[fact.phase] || []).push(fact);
    });
    return byPhase;
  }

  function renderFactCard(phase, facts) {
    var html = '<div class="phase-section" id="phase-' + phase.key + '"><div class="fact-card">';
    html += '<div class="fact-head">' + (PHASE_ICON[phase.key] || '') + ' ' + escapeHtml(phase.label) + '</div>';
    facts.forEach(function (fact) {
      html +=
        '<div class="fact-row">' +
        '<span class="fact-value">' + escapeHtml(fact.value) + '</span>' +
        '<span class="fact-why">why: ' + escapeHtml(fact.description) + '</span>' +
        '</div>';
    });
    return html + '</div></div>';
  }

  function renderFactCards(profile) {
    var factsByPhase = groupFactsByPhase(profile.facts);
    return profile.phases
      .filter(function (phase) { return factsByPhase[phase.key] && factsByPhase[phase.key].length > 0; })
      .map(function (phase) { return renderFactCard(phase, factsByPhase[phase.key]); })
      .join('');
  }

  function wireHighlightScroll(app) {
    app.querySelectorAll('.highlight-bubble').forEach(function (button) {
      button.addEventListener('click', function () {
        var target = document.getElementById('phase-' + button.getAttribute('data-phase'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function renderProfile(profile) {
    var app = document.getElementById('app');
    var html = renderHeader(profile) + renderStatRow(profile) + renderHighlights(profile) + renderFactCards(profile);
    if (profile.facts.length === 0) {
      html += '<div class="state-message">Nothing learned yet — reply to Nila in the chat to build your profile.</div>';
    }
    app.innerHTML = html;
    wireHighlightScroll(app);
  }

  async function fetchProfile(initData) {
    var response = await fetch('/api/profile', { headers: { Authorization: 'tma ' + initData } });
    if (response.status === 401) return { error: 'Could not verify your Telegram session — please reopen this from the bot menu.' };
    if (response.status === 404) return { error: 'Start chatting with Nila in Telegram first — your profile will appear here as you go.' };
    if (!response.ok) return { error: 'Something went wrong loading your profile — try again in a moment.' };
    return { profile: await response.json() };
  }

  async function loadProfile() {
    var initData = tg ? tg.initData : '';
    if (!initData) {
      renderMessage('Open this page from the Nila bot in Telegram to see your profile.');
      return;
    }
    try {
      var result = await fetchProfile(initData);
      if (result.error) renderMessage(result.error);
      else renderProfile(result.profile);
    } catch (error) {
      renderMessage('Could not reach the server — check your connection and try again.');
    }
  }

  if (tg) {
    tg.ready();
    tg.expand();
    applyTelegramTheme();
  }
  loadProfile();
})();
