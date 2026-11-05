/* MyLife hub v2: one small script for every hub screen. It reads only feed.js and links.js (both beside it) and the
   device clock; it fetches nothing, posts nothing, and runs or approves nothing. Settings live in this browser's
   localStorage (accent, motion and, from the v3 look, effects). */
(function () {
  'use strict';

  var ACCENTS = { red: '#F2503F', orange: '#FF8A1F', gold: '#D4AF6A' };
  var STATES = ['HEALTHY', 'STALE', 'OFFLINE', 'UNKNOWN'];
  /* v3 pages: word is the vertical label's word; sub is the line under the OPEN button. */
  var CH = {
    '01': { name: 'GYM', kanji: '鍛錬', full: 'Gym Front', where: 'vault', word: 'TRAINING' },
    '02': { name: 'FINANCE', kanji: '財務', full: 'Finance', where: 'vault', word: 'LEDGER' },
    '03': { name: 'JELLYFIN', kanji: '映像', full: 'Jellyfin', where: 'vault', tag: 'OWN APP', outside: true, word: 'SCREEN', sub: 'HOME NETWORK ONLY' },
    '04': { name: 'MEMORY', kanji: '情報', full: 'Memory', where: 'room', word: 'ARCHIVE' },
    '05': { name: 'BUILDS', kanji: '建造', full: 'Builds', where: 'room', word: 'WORKSHOP' },
    '06': { name: 'ROOM', kanji: '司令室', full: 'Common Room board', where: 'room', word: 'COMMAND', sub: 'PC ONLY' },
    '07': { name: 'MEAL', kanji: '食事', full: 'Meal planner', where: 'vault', tag: 'IN GYM FRONT', word: 'RATIONS', sub: 'OPENS IN GYM' }
  };
  /* v3 pages: the shared header's words for the screens that are not channels (kanji / title / meta / vertical word). */
  var SCREENS = {
    guide: { kanji: '番組表', h1: 'CHANNEL GUIDE', meta: 'SYS · GUIDE', word: 'LISTINGS' },
    brief: { kanji: '朝報', h1: 'MORNING BRIEF', meta: 'SYS · BRIEF', word: 'DISPATCH' },
    settings: { kanji: '設定', h1: 'SETTINGS', meta: 'SYS · SETTINGS', word: 'CONTROLS' },
    projects: { kanji: '掲示', h1: 'PROJECT BOARD', meta: 'SYS · PROJECTS', word: 'PLANS' }
  };
  /* v3 final (11-05): the Project Board, one line per project. Plain words only: no status, numbers or addresses.
     Every kanji here is already in the hub's 55-character font subset, so no font change. */
  var PROJECTS = [
    ['MYLIFE', '画面', "Your phone home screen that opens every app and shows today's one step in this broadcast look."],
    ['GYM AND MEALS', '鍛錬', 'Workout logging through wger and Gym Front, with the food import and a meal planner next.'],
    ['FINANCE', '財務', 'A private household money app, with stage two installed and its first fixes accepted.'],
    ['JELLYFIN AND MUSIC', '映像', 'Your home library of movies, shows and music on the Vault, with the music tags being cleaned up.'],
    ['COMMON ROOM', '司令室', "The shared room where the Claude and GPT crew pick up tasks, check each other's work and report back."],
    ['MEMORY', '情報', 'One place where the crew keeps what it learns, so nobody has to ask you the same thing twice.'],
    ['VAULT', '本部', 'The home server that runs it all, with backup alerts, an uptime monitor and document trackers lined up.'],
    ['LOCAL AI', '機', 'Eight models on your own PC that take on bulk sorting and tagging jobs, only when you say OK.'],
    ['BUILDS', '建造', 'The shelf for side builds and one-off tools, like a small business website.']
  ];
  var MODE_KANJI = { calm: '定時放送', alert: '緊急放送', standby: '放送休止' };
  var HOME_TILES = ['01', '02', '03', '04', '05', '06'];
  var GUIDE_ROWS = ['01', '02', '03', '04', '05', '06', '07'];
  var BAR = [['00', 'HUB'], ['01', 'GYM'], ['07', 'MEAL'], ['02', 'FIN'], ['06', 'ROOM']];
  var NIGHT_START = 22, NIGHT_END = 6;     // device clock; REPORT.md open point "night window"
  var FEED_MAX_AGE_MS = 24 * 3600 * 1000;  // an older feed is not trusted

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { return null; }
    return null;
  }

  /* ---- settings: accent and motion ---- */
  function accentKey() { var k = store('mylife.accent'); return ACCENTS[k] ? k : 'red'; }
  function applyAccent(k) { document.documentElement.style.setProperty('--accent', ACCENTS[k] || ACCENTS.red); }
  function deviceReduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function motionSetting() { return store('mylife.motion') === 'reduced'; }
  function reducedMotion() { return motionSetting() || deviceReduced(); }
  /* v3 look: Effects (CRT overlay, kanji glitch, Slice, header pulse, hazard march, flicker) on unless set off. */
  function effectsOn() { return store('mylife.effects') !== 'off'; }
  function motionClasses() {
    var c = document.documentElement.classList;
    if (reducedMotion()) c.add('rm'); else c.remove('rm');
    if (effectsOn()) c.remove('fx-off'); else c.add('fx-off');
  }
  applyAccent(accentKey());

  /* ---- time ---- */
  var DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function stripDate(d) { return d.getFullYear() + '.' + two(d.getMonth() + 1) + '.' + two(d.getDate()) + ' ' + DAYS[d.getDay()]; }
  function hhmm(d) { return two(d.getHours()) + ':' + two(d.getMinutes()); }
  function isNight(d) { var h = d.getHours(); return h >= NIGHT_START || h < NIGHT_END; }
  function standbyNow(now, f, opts) {   // the hub's STANDBY condition: night, or today's directive done
    var night = opts && typeof opts.night === 'boolean' ? opts.night : isNight(now), d = directive(f);
    return night || !!(d && d.done);
  }
  function parseTime(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return null;
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  function age(from, to) {   // whole units, never rounded up
    var ms = to - from;
    if (!(ms >= 0)) return null;
    var days = Math.floor(ms / 86400000);
    if (days >= 1) return days + 'D';
    var hours = Math.floor(ms / 3600000);
    return hours >= 1 ? hours + 'H' : '<1H';
  }
  function ageWords(from, to) {   // the same age, for a sentence
    var ms = to - from, days = Math.floor(ms / 86400000), hours = Math.floor(ms / 3600000);
    if (!(ms >= 0)) return 'an unknown time';
    if (days >= 1) return days + (days === 1 ? ' day' : ' days');
    return hours >= 1 ? hours + (hours === 1 ? ' hour' : ' hours') : 'under an hour';
  }

  /* ---- the feed: only what a real check wrote; anything unverifiable reads UNKNOWN ---- */
  function readFeed(feed, now) {
    if (feed === null || feed === undefined) return { ok: false, connected: false };
    if (typeof feed !== 'object' || feed.version !== 1) return { ok: false, connected: true, why: 'The status feed is not in a shape MyLife can read.' };
    var readAt = parseTime(feed.read_at);
    if (!readAt) return { ok: false, connected: true, why: 'The status feed has no read time.' };
    if (now - readAt > FEED_MAX_AGE_MS || readAt - now > 300000) return { ok: false, connected: true, why: 'The status feed is out of date.' };
    return { ok: true, connected: true, feed: feed, readAt: readAt, source: typeof feed.source === 'string' ? feed.source : '' };
  }
  function channel(f, n) {
    var none = { state: 'UNKNOWN', check: '', checkedAt: null, lastSeen: null };
    if (!f.ok || !f.feed.channels || typeof f.feed.channels !== 'object') return none;
    var c = f.feed.channels[n];
    if (!c || typeof c !== 'object' || STATES.indexOf(c.state) < 0) return none;
    var checkedAt = parseTime(c.checked_at), lastSeen = parseTime(c.last_seen);
    if (c.state === 'UNKNOWN' || typeof c.check !== 'string' || !c.check || !checkedAt) return none;
    if (c.state === 'STALE' && !lastSeen) return none;
    return { state: c.state, check: c.check, checkedAt: checkedAt, lastSeen: lastSeen };
  }
  function directive(f) {
    if (!f.ok || !f.feed.directive || typeof f.feed.directive !== 'object') return null;
    var d = f.feed.directive;
    if (typeof d.hero !== 'string' || !d.hero || !CH[d.route]) return null;
    return { label: typeof d.label === 'string' ? d.label : '', line1: typeof d.line1 === 'string' ? d.line1 : '',
             hero: d.hero, route: d.route, urgent: d.priority === 'A', priority: d.priority === 'A' ? 'A' : 'ROUTINE',
             done: d.done === true };
  }

  /* ---- links: a null address is a marked LINK PENDING placeholder, never a guess ---- */
  function link(key) {
    var l = (window.MYLIFE_LINKS || {})[key];
    return (typeof l === 'string' && /^https?:\/\/[^\s"'<>]+$/.test(l)) ? l : null;
  }
  function chHref(n, st) {     // STALE / OFFLINE, or no address yet: the hub's own detail screen
    var l = link(n);
    return (!l || st === 'STALE' || st === 'OFFLINE') ? 'signal.html?ch=' + n : l;
  }
  function outAttrs(href) { return /^https?:/.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''; }
  /* v2: where an address works. A link whose href is Jellyfin's address works on the home network only; one whose
     href is the room board's (loopback) works on the PC only (A7_LINKS notes). Shown as text and said in the label. */
  function reach(href) {
    var j = link('03'), b = link('06');
    if (j && href === j) return { text: 'HOME NETWORK ONLY', words: 'Home network only.' };
    if (b && href === b) return { text: 'PC ONLY', words: 'PC only.' };
    return null;
  }
  function reachTag(r, cls) { return r ? '<span class="reach mono' + (cls ? ' ' + cls : '') + '">' + r.text + '</span>' : ''; }
  function pendingButton(text, kind) {
    return '<div class="btn pending" role="link" aria-disabled="true" aria-label="' + esc(text) + ', link pending">' +
      '<span>' + esc(text) + '</span><small>LINK PENDING · NO ADDRESS GIVEN YET</small></div>';
  }
  function linkButton(key, text, kind) {
    var l = link(key);
    var r = l ? reach(l) : null;
    if (l && r) return '<a class="btn ' + kind + ' has-reach" href="' + esc(l) + '"' + outAttrs(l) + ' aria-label="' + esc(text + '. ' + r.words) + '">' +
      '<span>' + esc(text) + ' ↗</span>' + reachTag(r) + '</a>';
    return l ? '<a class="btn ' + kind + '" href="' + esc(l) + '"' + outAttrs(l) + '>' + esc(text) + ' ↗</a>' : pendingButton(text, kind);
  }

  /* ---- drawing ---- */
  function scanlines(w, h, n, h0, h1) {
    var out = '', step = h / n;
    for (var i = 0; i < n; i++) {
      var hh = h0 + (h1 - h0) * i / (n - 1);
      out += '<rect x="0" y="' + ((i + 1) * step - hh).toFixed(1) + '" width="' + w + '" height="' + hh.toFixed(1) + '"/>';
    }
    return '<svg aria-hidden="true" class="scan" preserveAspectRatio="none" viewBox="0 0 ' + w + ' ' + h + '">' + out + '</svg>';
  }
  /* v3 pages: one header for every screen. Meta line with live clock and on-air dot, the big kanji with its glitch
     copies (data-text), the vertical label (word + the mode's kanji), the title, then the hazard. */
  var AIR = { calm: 'ON AIR', alert: 'LIVE', standby: 'OFF AIR' };
  function clockText(d) { return stripDate(d) + ' ' + hhmm(d); }
  function mast(now, mode, s) {
    return '<header class="mast' + (mode === 'standby' ? ' standby' : '') + '">' +
      '<div class="strip mono"><span><span class="brand">MYLIFE · </span>' + esc(s.meta) + '</span><span class="meta"><span class="clock">' + clockText(now) + '</span>' +
      '<span class="air"><i class="dot" aria-hidden="true"></i>' + AIR[mode] + '</span></span></div><div class="rule"></div>' +
      '<div class="kanji-row"><div class="kanji-box"><span class="kanji' + (s.kanji.length >= 3 ? ' k3' : '') + '" lang="ja" data-text="' + s.kanji + '">' + s.kanji + '</span>' + scanlines(296, 160, 14, 0.8, 6.8) + '</div>' +
      '<div class="side mono">' + esc(s.word) + ' · <span lang="ja">' + MODE_KANJI[mode] + '</span></div></div>' +
      '<h1>' + esc(s.h1) + '</h1></header>' +
      '<div class="hazard" aria-hidden="true"></div>';
  }
  /* The status ticker under the header hazard. Two identical segments scroll as one track, so it loops seamlessly;
     the strip itself never moves. The count is all seven channels, from real status. */
  function reportingCount(f) { return GUIDE_ROWS.filter(function (n) { return channel(f, n).state !== 'UNKNOWN'; }).length; }
  function flagFor(n) {       // HOME, PC or NO LINK, from links.js only
    var l = link(n), r = l ? reach(l) : null;
    if (r) return r.text === 'PC ONLY' ? 'PC' : 'HOME';
    return l ? '' : 'NO LINK';
  }
  function flagNotes() {
    var flags = GUIDE_ROWS.map(flagFor), notes = [];
    if (flags.indexOf('HOME') >= 0) notes.push('HOME = HOME NETWORK ONLY');
    if (flags.indexOf('PC') >= 0) notes.push('PC = PC ONLY');
    if (flags.indexOf('NO LINK') >= 0) notes.push('NO LINK = NO ADDRESS GIVEN YET');
    return notes;
  }
  function ticker(mode, f) {
    var words;
    if (mode === 'alert') words = ['EMERGENCY BROADCAST', '<span lang="ja">緊急放送</span>', 'PRIORITY A'];
    else if (mode === 'standby') words = ['OFF AIR', '<span lang="ja">放送休止</span>', 'NEXT BRIEF IN THE MORNING'];
    else words = ['REGULAR PROGRAMMING', '<span lang="ja">定時放送</span>', reportingCount(f) + ' OF ' + GUIDE_ROWS.length + ' REPORTING', 'MORNING BRIEF IN CHAT'].concat(flagNotes());
    var one = words.join(' · ') + ' · ', seg = mode === 'calm' ? one : one + one + one;
    var said = words.join(', ').replace(/<[^>]+>/g, '');
    return '<div class="ticker mono" role="note" aria-label="' + esc(said) + '"><div class="track" aria-hidden="true"><span class="seg">' + seg + '</span><span class="seg">' + seg + '</span></div></div>';
  }
  /* Channel bar: every button opens a hub screen; the current one is lit. */
  function bar(current) {
    var out = '<nav class="bar" aria-label="Channels"><div class="hazard thin" aria-hidden="true"></div><div class="btns">';
    BAR.forEach(function (b) {
      var n = b[0], here = n === current;
      var href = n === '00' ? 'index.html' : 'signal.html?ch=' + n, l = n === '00' ? null : link(n), r = l ? reach(l) : null;
      out += '<a href="' + href + '"' + (here ? ' aria-current="page"' : '') + (r ? ' class="has-reach"' : '') +
        ' aria-label="Channel ' + n + ', ' + (n === '00' ? 'Hub' : CH[n].full) + (here ? ', current' : '') + '.' + (r ? ' ' + r.words : '') + '">' +
        '<span class="n">' + n + '</span><span class="s">' + b[1] + '</span>' + reachTag(r) + '</a>';
    });
    return out + '</div></nav>';
  }
  /* Back row on every inner screen: ‹ 00 HUB, and the screen's flag (or the Guide's reporting count) on the right. */
  function backRow(right) {
    return '<div class="backrow"><a class="back mono" href="index.html" aria-label="Back to the hub"><b aria-hidden="true">‹</b> 00 HUB</a>' + (right || '') + '</div>';
  }
  function flagBox(flag) { return flag ? '<span class="flag mono' + (flag === 'NO LINK' ? ' dashed' : '') + '">' + flag + '</span>' : ''; }
  /* Footer on every screen: END OF BROADCAST, and the way to Settings. A check page may add one marked line above it. */
  function footer(onSettings, note) {
    return (note ? '<div class="exnote mono">' + esc(note) + '</div>' : '') +
      '<div class="example mono"><span>■ END OF BROADCAST</span>' +
      (onSettings ? '<span class="setlink here"><span lang="ja">設定</span></span>'
        : '<a class="setlink" href="settings.html" aria-label="Settings"><span lang="ja">設定</span> SETTINGS <b aria-hidden="true">›</b></a>') + '</div>';
  }
  function feedAlert(f) {
    return f.connected && !f.ok
      ? '<div class="block alert" role="alert"><div class="head mono"><span>警報 ALERT</span><span>STATUS FEED</span></div>' +
        '<div class="line">Status checks could not be read.</div><div class="line">Channels show NO READING until the next check.</div></div><div class="gap"></div>'
      : '';
  }
  function feedNote(f, opts) { return opts.note || (f.ok ? 'STATUS FROM ' + (f.source || 'THE ROOM') : ''); }
  function nightOf(now, opts) { return opts && typeof opts.night === 'boolean' ? opts.night : isNight(now); }
  function moodOf(now, f, opts) { return homeModel(now, f, false, nightOf(now, opts)); }
  /* Status square and words: OK, STALE, OFFLINE, or NO READING (grey) until a check reports. */
  var SQ = { HEALTHY: ['s-ok', 'OK'], STALE: ['s-stale', 'STALE'], OFFLINE: ['s-off', 'OFFLINE'], UNKNOWN: ['s-none', 'NO READING'] };
  function sq(state) { return '<i class="sq ' + SQ[state][0] + '" aria-hidden="true"></i>'; }
  function draw(root, mode, cls, html) {
    root.className = 'screen v3' + (cls ? ' ' + cls : '');
    root.setAttribute('data-mode', mode);
    root.innerHTML = html;
  }

  /* A tile shows only its number, name, small kanji and an optional boxed flag (HOME, PC, NO LINK). The state stays
     in the tile's colour and its spoken label. v3 pages: a tile opens its channel screen. */
  function tile(n, c, opts) {
    var ch = CH[n], href = opts.href ? opts.href(n, c.state) : 'signal.html?ch=' + n;
    var cls = 'tile', label, flag = flagFor(n);
    if (c.state === 'HEALTHY') label = n + ' ' + ch.full + ', healthy, last check ' + hhmm(c.checkedAt) + '.';
    else if (c.state === 'STALE') { cls += ' stale'; label = n + ' ' + ch.full + ', stale, last seen ' + age(c.lastSeen, c.checkedAt) + ' before the check. Signal lost.'; }
    else if (c.state === 'OFFLINE') { cls += ' offline'; label = n + ' ' + ch.full + ', offline.'; }
    else { cls += ' unknown'; label = n + ' ' + ch.full + ', no reading yet.'; }
    label += ' Opens its channel screen.';
    if (flag === 'NO LINK') { cls += ' nolink'; label += ' No address given yet.'; }
    else if (flag) label += ' ' + reach(link(n)).words;
    return '<a class="' + cls + '" href="' + esc(href) + '" aria-label="' + esc(label) + '">' +
      '<span class="top mono"><span class="num">' + n + '</span>' + (flag ? '<span class="flag">' + flag + '</span>' : '') + '</span>' +
      '<span class="bottom"><span class="tname">' + ch.name + '</span><span class="tk" lang="ja">' + ch.kanji + '</span></span></a>';
  }

  /* ---- Hub01 home (CALM / ALERT) and Hub04 standby, one screen in three moods ---- */
  function homeModel(now, f, forceStandby, nightOverride) {
    var d = directive(f), night = typeof nightOverride === 'boolean' ? nightOverride : isNight(now);
    if (d && d.urgent && !d.done) return { mode: 'alert', d: d, night: night };          // urgency comes only from the directive source
    if (forceStandby || night || (d && d.done)) return { mode: 'standby', d: d, night: night };
    return { mode: 'calm', d: d, night: night };
  }
  function mastFor(m) {   // only the hub swaps its kanji and title by mode
    if (m.mode === 'alert') return { kanji: '緊急', h1: 'EMERGENCY BROADCAST', meta: 'CH.00 HUB', word: 'DAILY' };
    if (m.mode === 'standby') return { kanji: '待機', h1: 'STANDING BY', meta: 'CH.00 HUB', word: 'DAILY' };
    return { kanji: '本部', h1: "TODAY'S BROADCAST", meta: 'CH.00 HUB', word: 'DAILY' };
  }
  function directiveSlot(m, opts) {
    var d = m.d;
    if (m.mode !== 'standby' && d) {
      var href = opts.href ? opts.href(d.route, 'UNKNOWN') : chHref(d.route, 'UNKNOWN'), r = reach(href);
      return '<a class="directive" href="' + esc(href) + '"' + outAttrs(href) + ' aria-label="Standing directive ' + esc(d.label) + ': ' + esc(d.line1 + ' ' + d.hero) + '. Routes to channel ' + d.route + ', ' + CH[d.route].full + '.' + (r ? ' ' + r.words : '') + '">' +
        '<span class="label mono"><span>▲ STANDING DIRECTIVE</span><span>' + esc(d.label) + '</span></span>' +
        (d.line1 ? '<span class="l1">' + esc(d.line1) + '</span>' : '') + '<span class="hero">' + esc(d.hero) + '<i class="blk" aria-hidden="true"></i></span>' +
        '<span class="route mono">TAP TO COMPLY · ROUTE <b>→ ' + CH[d.route].name + '</b></span>' + reachTag(r) + '</a>';
    }
    if (m.mode === 'standby' && d && d.done) {
      return '<div class="directive" aria-label="Standing directive ' + esc(d.label) + ', complied. No active directive.">' +
        '<span class="label mono"><span>▲ STANDING DIRECTIVE ' + esc(d.label) + ' · COMPLIED</span><span></span></span>' +
        '<span class="done">' + esc((d.line1 ? d.line1 + ' ' : '') + d.hero) + '</span><span class="route mono">DONE · NO ACTIVE DIRECTIVE</span></div>';
    }
    // no directive, day or night, is one dashed row.
    return '<div class="directive nodir mono" aria-label="No directive. Standing by.">NO DIRECTIVE · STANDING BY</div>';
  }
  function sysRow(href, kanji, name, val, aria) {
    return '<a class="row" href="' + href + '" aria-label="' + esc(aria) + '">' +
      '<span style="display:flex;align-items:baseline;gap:8px"><span lang="ja" style="font-size:16px;line-height:1">' + kanji + '</span><span class="mono" style="color:var(--text-3)">·</span><span class="name">' + name + '</span></span>' +
      '<span class="mono" style="display:flex;align-items:center;gap:10px"><span class="val">' + val + '</span><span class="chev">›</span></span></a>';
  }
  function home(root, now, f, opts) {
    opts = opts || {};
    var m = homeModel(now, f, opts.forceStandby, opts.night);
    var tiles = HOME_TILES.map(function (n) { return tile(n, channel(f, n), { href: opts.href }); }).join('');
    var reporting = reportingCount(f);   // v3 final: all seven channels, the same count as the ticker and the Guide
    var briefRow = feedAlert(f) || sysRow(opts.href ? '#example' : 'brief.html', '朝報', 'MORNING BRIEF', 'IN CHAT', 'Morning brief: it is in the project chat, not in MyLife yet. Opens the brief screen.');
    draw(root, m.mode, 'v3home', mast(now, m.mode, mastFor(m)) + ticker(m.mode, f) +
      '<main>' + directiveSlot(m, opts) + '<div class="gap"></div>' + briefRow +
      '<a class="sect mono" href="' + (opts.href ? '#example' : 'guide.html') + '" aria-label="Channels: ' + reporting + ' of ' + GUIDE_ROWS.length + ' reporting. Opens the Channel Guide."><span><span lang="ja">状況</span> · CHANNELS</span>' +
      '<span class="count"><i class="sq" aria-hidden="true"></i>' + reporting + ' OF ' + GUIDE_ROWS.length + ' REPORTING</span></a>' +
      '<div class="tiles">' + tiles + '</div><div class="gap"></div>' +
      sysRow(opts.href ? '#example' : 'guide.html', '番組表', 'CHANNEL GUIDE', 'ALL ' + GUIDE_ROWS.length, 'Channel guide: all ' + GUIDE_ROWS.length + ' channels.') +
      '<div class="gap" style="height:6px"></div>' +
      sysRow(opts.href ? '#example' : 'projects.html', '掲示', 'PROJECT BOARD', 'ALL ' + PROJECTS.length, 'Project board: all ' + PROJECTS.length + ' projects, one line each.') +
      footer(false, feedNote(f, opts)) + '</main>' + bar('00'));
    v3effects(root, now);
  }

  /* ---- v3 effects layer, shared by every screen. Purely visual: it fetches nothing and adds no data. ---- */
  var CRT_GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
  var SLICE_COLORS = ['rgba(244,236,230,.85)', '#F2503F', '#080404'];
  var clockTimer = null;
  function overlay(cls, html) {
    var el = document.querySelector('body > .' + cls);
    if (!el) { el = document.createElement('div'); el.className = cls; el.setAttribute('aria-hidden', 'true'); el.innerHTML = html; document.body.appendChild(el); }
    return el;
  }
  /* Called after every drawing of a screen (Settings redraws itself); the tap handler and clock are set up once. */
  function v3effects(root, now) {
    motionClasses();
    var crt = overlay('crt', '<i class="scanl"></i><i class="grain"></i><i class="vig"></i><i class="band"></i>');
    crt.querySelector('.grain').style.backgroundImage = CRT_GRAIN;
    var slice = overlay('slice', new Array(8).join('<i></i>'));
    // Live clock: only the clock's text changes, so no animation restarts.
    var shown = clockText(now);
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(function () {
      var t = clockText(new Date()), clock = root.querySelector('.mast .clock');
      if (t !== shown && clock) { shown = t; clock.textContent = t; }
    }, 1000);
    // Ticker speed: one segment scrolls past at 40 px a second, whatever its length.
    function pace() {
      var seg = root.querySelector('.ticker .seg'), track = root.querySelector('.ticker .track');
      if (seg && track) track.style.animationDuration = Math.max(6, seg.getBoundingClientRect().width / 40).toFixed(2) + 's';
    }
    pace();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(pace);
    if (root.getAttribute('data-v3tap')) return;
    root.setAttribute('data-v3tap', '1');
    // Channel change ("Slice"): plain left clicks on the screen's links only; otherwise the browser does as it always does.
    root.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || !root.contains(a) || reducedMotion() || !effectsOn()) return;
      // A link that opens its own tab keeps the native tap (a delayed window.open can be blocked as a popup on a
      // phone home-screen app); the bars and flash still run over this screen, as decoration only.
      var blank = a.getAttribute('target') === '_blank';
      if (!blank) e.preventDefault();
      a.classList.remove('zap'); void a.offsetWidth; a.classList.add('zap');
      var bars = slice.children;
      for (var i = 0; i < bars.length; i++) {
        bars[i].style.top = (Math.random() * 92).toFixed(2) + '%';
        bars[i].style.height = (1.5 + Math.random() * 7).toFixed(2) + '%';
        bars[i].style.background = SLICE_COLORS[i % SLICE_COLORS.length];
        bars[i].style.animationDelay = (i * 18) + 'ms';
      }
      slice.classList.remove('go'); void slice.offsetWidth; slice.classList.add('go');
      if (blank) return;
      var href = a.href;
      setTimeout(function () { window.location.href = href; }, 330);
    });
  }
  /* A screen that opens with the top of the phone scrolled out of view goes back to the top (also on a back step). */
  function toTop() { if (window.scrollY > 0 || window.pageYOffset > 0) window.scrollTo(0, 0); }

  /* ---- Hub02 morning brief: in the directive style; no brief text copied in ---- */
  function brief(root, now, f, opts) {
    opts = opts || {};
    var m = moodOf(now, f, opts), night = m.night;
    var chat = link('chat');
    var open = chat
      ? '<a class="row" href="' + esc(chat) + '"' + outAttrs(chat) + ' aria-label="Open the project chat."><span class="name">OPEN PROJECT CHAT</span><span class="chev">↗</span></a>'
      : dashRow('OPEN PROJECT CHAT');
    draw(root, m.mode, 'v3brief', mast(now, m.mode, SCREENS.brief) + ticker(m.mode, f) + '<main>' + backRow('') +
      '<div class="directive bdir" aria-label="' + (night ? 'Tomorrow: the next brief comes at dawn.' : "Today's brief is in the project chat. Read it there.") + '">' +
      '<span class="label mono"><span>▲ <span lang="ja">朝報</span> · ' + (night ? 'TOMORROW' : 'TODAY') + '</span><span></span></span>' +
      '<span class="l1">' + (night ? 'NEXT BRIEF' : "TODAY'S BRIEF") + '</span>' +
      '<span class="hero">' + (night ? 'AT DAWN' : 'IN CHAT') + '<i class="blk" aria-hidden="true"></i></span>' +
      '<span class="route mono">READ IT IN THE PROJECT CHAT</span></div>' +
      '<div class="gap" style="height:14px"></div>' + open +
      footer(false, feedNote(f, opts)) + '</main>' + bar(''));
    v3effects(root, now);
  }

  /* ---- Hub03 channel screen (?ch=01 to 07): one template for all seven; it fixes nothing ---- */
  function dashRow(text, sub, cls) {   // anything without an address: drawn, never a link
    return '<div class="dash' + (cls ? ' ' + cls : '') + '" role="link" aria-disabled="true" aria-label="' + esc(text + (sub ? ', ' + sub.toLowerCase() : '') + ', no link yet') + '">' +
      '<span class="dl"><span class="dn">' + esc(text) + '</span>' + (sub ? '<span class="ds mono">' + esc(sub) + '</span>' : '') + '</span>' +
      '<span class="dr mono">NO LINK YET</span></div>';
  }
  function openAction(n) {      // the same address the Open button always used; none: a dashed row
    var ch = CH[n], l = link(n), text = 'OPEN ' + ch.name;
    if (!l) return dashRow(text, ch.sub, 'big');
    return '<a class="act" href="' + esc(l) + '"' + outAttrs(l) + ' aria-label="' + esc(text + '.' + (ch.sub ? ' ' + ch.sub.toLowerCase() + '.' : '')) + '">' +
      '<span class="an">' + esc(text) + ' ↗</span>' + (ch.sub ? '<span class="as mono">' + esc(ch.sub) + '</span>' : '') + '</a>';
  }
  function tellAction(n) {
    if (n === '06') return '';
    var key = 'chat', text = 'TELL THE ROOM', l = link(key);
    var row = l ? '<a class="row tell" href="' + esc(l) + '"' + outAttrs(l) + '><span class="name">' + text + '</span><span class="chev">↗</span></a>' : dashRow(text);
    return '<div class="gap" style="height:6px"></div>' + row;
  }
  function cell(k, v) { return '<div class="cell"><div class="ck mono">' + k + '</div><div class="cv">' + esc(v) + '</div></div>'; }
  function signal(root, now, f, n, opts) {
    opts = opts || {};
    var m = moodOf(now, f, opts), ch = CH[n];
    if (!ch) {
      draw(root, m.mode, 'v3signal', mast(now, m.mode, { kanji: '本部', h1: 'NO SUCH CHANNEL', meta: 'CH.?? ', word: 'SIGNAL' }) + ticker(m.mode, f) + '<main>' + backRow('') +
        '<div class="block alert" role="alert"><div class="head mono"><span>警報 ALERT</span><span>NO SUCH CHANNEL</span></div>' +
        '<div class="line">This channel number is not in MyLife.</div><div class="line">Go back to the hub.</div></div>' + footer(false, opts.note) + '</main>' + bar(''));
      v3effects(root, now);
      return;
    }
    var c = channel(f, n), d = m.d;
    var gymDir = n === '01' && d && d.route === '01' && !d.done && m.mode !== 'standby'
      ? '<div class="gdir"><span class="mono gl">▲ STANDING DIRECTIVE · ' + esc(d.label || '01') + '</span><span class="gt">' + esc((d.line1 ? d.line1 + ' ' : '') + d.hero) + '</span></div><div class="gap"></div>'
      : '';
    draw(root, m.mode, 'v3signal', mast(now, m.mode, { kanji: ch.kanji, h1: 'CH.' + n + ' · ' + ch.name, meta: 'CH.' + n + ' ' + ch.name, word: ch.word }) + ticker(m.mode, f) +
      '<main>' + backRow(flagBox(flagFor(n))) + feedAlert(f) +
      '<div class="sect plain mono first"><span><span lang="ja">状況</span> · STATUS</span><span class="count">' + sq(c.state) + SQ[c.state][1] + '</span></div>' +
      '<div class="cells" aria-label="' + esc(ch.full + ': state ' + (c.state === 'UNKNOWN' ? 'no reading' : SQ[c.state][1]) + ', last check ' + (c.checkedAt ? hhmm(c.checkedAt) : 'never') + ', link ' + (link(n) ? 'set' : 'none') + '.') + '">' +
      cell('STATE', c.state === 'UNKNOWN' ? '—' : SQ[c.state][1]) + cell('LAST CHECK', c.checkedAt ? hhmm(c.checkedAt) : 'NEVER') + cell('LINK', link(n) ? 'SET' : 'NONE') + '</div>' +
      '<div class="gap" style="height:14px"></div>' + gymDir + openAction(n) + tellAction(n) +
      footer(false, feedNote(f, opts)) + '</main>' + bar(BAR.some(function (b) { return b[0] === n; }) ? n : ''));
    v3effects(root, now);
  }

  /* ---- Hub05 channel guide: seven rows, each to its channel screen ---- */
  function guide(root, now, f, opts) {
    opts = opts || {};
    var m = moodOf(now, f, opts), reporting = reportingCount(f);
    var rows = GUIDE_ROWS.map(function (n) {
      var c = channel(f, n), ch = CH[n], flag = flagFor(n);
      var href = opts.href ? opts.href(n) : 'signal.html?ch=' + n;
      var aria = n + ' ' + ch.full + ', ' + (c.state === 'UNKNOWN' ? 'no reading, never checked' : SQ[c.state][1].toLowerCase() + ', checked ' + hhmm(c.checkedAt) + ' by ' + c.check) + '.' +
        (flag === 'NO LINK' ? ' No address given yet.' : (flag ? ' ' + reach(link(n)).words : '')) + ' Opens its channel screen.';
      return '<a class="chrow' + (flag === 'NO LINK' ? ' nolink' : '') + '" href="' + esc(href) + '" aria-label="' + esc(aria) + '">' +
        '<span class="num mono">' + n + '</span><span class="gname">' + ch.name + '</span><span class="gk" lang="ja">' + ch.kanji + '</span>' + flagBox(flag) +
        '<span class="spacer"></span>' + sq(c.state) + '<span class="when mono">' + (c.checkedAt ? hhmm(c.checkedAt) : 'NEVER') + '</span><span class="chev">›</span></a>';
    }).join('');
    var key = [['HEALTHY', 'OK'], ['STALE', 'STALE'], ['OFFLINE', 'OFFLINE'], ['UNKNOWN', 'NO READING']]
      .map(function (k) { return '<span>' + sq(k[0]) + k[1] + '</span>'; }).join('');
    draw(root, m.mode, 'v3guide', mast(now, m.mode, SCREENS.guide) + ticker(m.mode, f) + '<main>' +
      backRow('<span class="count mono"><i class="sq" aria-hidden="true"></i>' + reporting + ' OF ' + GUIDE_ROWS.length + ' REPORTING</span>') + feedAlert(f) +
      '<div class="sect plain mono first"><span><span lang="ja">番組表</span> · ALL CHANNELS</span><span>LAST CHECK</span></div>' +
      '<div class="stack">' + rows + '</div>' +
      '<div class="key mono" aria-label="Key: OK, stale, offline, no reading.">' + key + '</div>' +
      footer(false, feedNote(f, opts)) + '</main>' + bar(''));
    v3effects(root, now);
  }

  /* ---- v3 final: Project Board, every project with one sentence; read-only, it opens nothing ---- */
  function projects(root, now, f, opts) {
    opts = opts || {};
    var m = moodOf(now, f, opts);
    var cards = PROJECTS.map(function (p, i) {
      return '<div class="pcard"><span class="num mono">' + two(i + 1) + '</span><span class="pname">' + esc(p[0]) + '</span>' +
        '<span class="pk" lang="ja">' + p[1] + '</span><p class="pline">' + esc(p[2]) + '</p></div>';
    }).join('');
    draw(root, m.mode, 'v3projects', mast(now, m.mode, SCREENS.projects) + ticker(m.mode, f) + '<main>' +
      backRow('<span class="flag mono">' + PROJECTS.length + ' PROJECTS</span>') +
      '<div class="sect plain mono first"><span><span lang="ja">掲示</span> · EVERY PROJECT</span><span>ONE LINE EACH</span></div>' +
      '<div class="stack">' + cards + '</div>' +
      footer(false, feedNote(f, opts)) + '</main>' + bar(''));
    v3effects(root, now);
  }

  /* ---- Hub06 settings: accent, effects and motion, kept on this device ---- */
  function settings(root, now, f, opts) {
    opts = opts || {};
    function paint(toast) {
      var m = moodOf(now, f, opts), k = accentKey(), reduced = motionSetting(), dev = deviceReduced(), fx = effectsOn();
      var picks = [['red', 'RED', 'DEFAULT'], ['orange', 'ORANGE', ''], ['gold', 'GOLD', '']].map(function (p) {
        return '<button type="button" class="swatch" role="radio" aria-checked="' + (k === p[0]) + '" data-accent="' + p[0] + '" style="--sw:' + ACCENTS[p[0]] + '" aria-label="' + p[1].toLowerCase() + ' accent' + (p[2] ? ', the default' : '') + '">' +
          '<span class="sn">' + p[1] + '</span><span class="sd mono">' + p[2] + '</span><span class="box" aria-hidden="true">' + (k === p[0] ? '✓' : '') + '</span></button>';
      }).join('');
      function sw(id, on, name, sub) {
        return '<button type="button" class="toggle-row" role="switch" aria-checked="' + on + '" id="' + id + '"><span class="tl"><span class="tname">' + name + '</span>' +
          '<span class="mono tsub">' + sub + '</span></span><span class="toggle">' + (on ? 'ON' : 'OFF') + '</span></button>';
      }
      draw(root, m.mode, 'v3settings', mast(now, m.mode, SCREENS.settings) + ticker(m.mode, f) + '<main>' + backRow('') +
        '<div class="sect plain mono first"><span><span lang="ja">色</span> · ACCENT</span><span></span></div>' +
        '<div class="swatches" role="radiogroup" aria-label="Accent">' + picks + '</div>' +
        '<div class="sect plain mono"><span><span lang="ja">動き</span> · MOTION</span><span></span></div>' +
        sw('effects', fx, 'EFFECTS', 'CRT, GLITCH, TICKER, SLICE') + '<div style="height:4px"></div>' +
        sw('motion', reduced, 'REDUCED MOTION', 'HOLDS EVERYTHING STILL') +
        (dev ? '<div class="mono" style="margin-top:6px;color:var(--text-2)">THIS DEVICE ASKS FOR REDUCED MOTION · MYLIFE IS ALREADY STILL</div>' : '') +
        '<div class="sect plain mono"><span><span lang="ja">画面</span> · HOME SCREEN</span><span></span></div>' +
        '<div class="dash"><span class="dl"><span class="dn small">HOME-SCREEN ICON · AFTER THE HUB IS HOSTED</span></span></div>' +
        '<div style="flex:1 0 12px"></div><div class="toast mono" role="status"' + (toast ? '' : ' hidden') + '><span>RECEIVED · <span lang="ja">受信</span></span><span>ACCENT APPLIED</span></div>' +
        footer(true, feedNote(f, opts)) + '</main>' + bar(''));
      v3effects(root, now);
      Array.prototype.forEach.call(root.querySelectorAll('.swatch'), function (b) {
        b.addEventListener('click', function () {
          store('mylife.accent', b.getAttribute('data-accent')); applyAccent(accentKey()); paint(true);
          var t = root.querySelector('.toast'); setTimeout(function () { if (t) t.hidden = true; }, 2500);
          var again = root.querySelector('.swatch[data-accent="' + b.getAttribute('data-accent') + '"]'); if (again) again.focus();
        });
      });
      root.querySelector('#motion').addEventListener('click', function () {
        store('mylife.motion', motionSetting() ? 'full' : 'reduced'); paint(false); root.querySelector('#motion').focus();
      });
      root.querySelector('#effects').addEventListener('click', function () {
        store('mylife.effects', effectsOn() ? 'off' : 'on'); paint(false); root.querySelector('#effects').focus();
      });
    }
    paint(false);
  }

  window.MyLife = {
    home: home, brief: brief, signal: signal, guide: guide, settings: settings, projects: projects,
    readFeed: readFeed, reducedMotion: reducedMotion, isNight: isNight,
    start: function (page) {
      var root = document.getElementById('screen'), now = new Date(), f = readFeed(window.MYLIFE_FEED, now);
      var q = (window.location.search || '').replace(/^\?/, '').split('&').reduce(function (o, kv) { var p = kv.split('='); if (p[0]) o[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); return o; }, {});
      try { if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'; } catch (e) { /* not supported */ }
      window.addEventListener('pageshow', toTop);
      if (page === 'home') home(root, now, f, { forceStandby: q.view === 'standby' });
      else if (page === 'brief') brief(root, now, f);
      else if (page === 'signal') signal(root, now, f, /^\d{2}$/.test(q.ch || '') ? q.ch : '');
      else if (page === 'guide') guide(root, now, f);
      else if (page === 'settings') settings(root, now, f);
      else if (page === 'projects') projects(root, now, f);
      toTop();
    }
  };
})();
