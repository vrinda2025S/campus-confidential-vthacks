const FEED_URL = '/api/headlines';
const REFRESH_MS = 15000;

const feedEl = document.getElementById('feed');
const liveDotEl = document.getElementById('live-dot');
const statusTextEl = document.getElementById('status-text');
const DINING_CHARACTERS = new Set([
  'dietrick', 'owens', 'perry', 'turner', 'deets', 'dx', 'xpressLane',
  'dunkin', 'squires', 'westEnd', 'hokieGrill',
]);

let seenIds = new Set();

function relativeTime(dateString) {
  const seconds = Math.round((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

const SOURCE_ALIASES = {
  bt: 'transit',
  newman: 'newman-library-rooms',
};

function tagClass(source) {
  if (DINING_CHARACTERS.has(source)) return 'dining';
  const resolved = SOURCE_ALIASES[source] || source;
  return ['dining', 'weather', 'transit', 'newman-library-rooms'].includes(resolved)
    ? resolved
    : 'default';
}

const SOURCE_ICONS = {
  dining: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3v6a2 2 0 0 0 4 0V3M6 9v12"/><path d="M18 3c-1.7 0-3 2-3 5s1.3 5 3 5M18 3v18"/></svg>',
  weather: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
  transit: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="11" rx="2"/><path d="M3 11h18M7 16v2M17 16v2"/><circle cx="7.5" cy="16" r="0.8" fill="white" stroke="none"/><circle cx="16.5" cy="16" r="0.8" fill="white" stroke="none"/></svg>',
  'newman-library-rooms': '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/></svg>',
  default: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M7 9h6M7 13h10M7 16h10"/></svg>',
};

function sourceIcon(source) {
  return SOURCE_ICONS[source] || SOURCE_ICONS[tagClass(source)] || SOURCE_ICONS.default;
}

async function shareHeadline(headline, button) {
  const shareText = `${headline.headline}\n\n${headline.blurb}`;
  const shareUrl = window.location.href;

  try {
    if (navigator.share) {
      await navigator.share({ title: 'Campus Confidential', text: shareText, url: shareUrl });
      return;
    }
    await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
    const original = button.textContent;
    button.textContent = 'Copied!';
    button.disabled = true;
    setTimeout(() => {
      button.textContent = original;
      button.disabled = false;
    }, 1500);
  } catch (err) {
    // AbortError fires when the user just closes the native share sheet — not a real failure.
    if (err.name !== 'AbortError') {
      console.error('Share failed:', err.message);
    }
  }
}

function renderHeadline(headline, isNew) {
  const el = document.createElement('article');
  el.className = 'story' + (isNew ? ' is-new' : '');

  const media = document.createElement('div');
  media.className = 'story-media';

  const thumb = document.createElement('div');
  thumb.className = `story-thumb ${tagClass(headline.source)}`;
  thumb.innerHTML = sourceIcon(headline.source);

  const tag = document.createElement('span');
  tag.className = `tag ${tagClass(headline.source)}`;
  tag.textContent = headline.source;

  media.append(thumb, tag);

  const body = document.createElement('div');

  const h2 = document.createElement('h2');
  h2.textContent = headline.headline;

  const p = document.createElement('p');
  p.textContent = headline.blurb;

  const footerRow = document.createElement('div');
  footerRow.className = 'story-footer';

  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = relativeTime(headline.createdAt);

  const shareBtn = document.createElement('button');
  shareBtn.className = 'share-btn';
  shareBtn.type = 'button';
  shareBtn.textContent = 'Share';
  shareBtn.addEventListener('click', () => shareHeadline(headline, shareBtn));

  footerRow.append(meta, shareBtn);
  body.append(h2, p, footerRow);
  el.append(media, body);

  return el;
}

function setStatus(state, text) {
  liveDotEl.className = `live-dot ${state}`;
  statusTextEl.textContent = text;
}

async function loadHeadlines() {
  try {
    const res = await fetch(FEED_URL);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const headlines = await res.json();

    if (!Array.isArray(headlines) || headlines.length === 0) {
      feedEl.innerHTML = '<div class="empty-state"><p>The presses are warming up. First headlines land within a few minutes.</p></div>';
      setStatus('live', 'live - no headlines yet');
      return;
    }

    const nextSeenIds = new Set();
    const fragment = document.createDocumentFragment();

    headlines.forEach((headline) => {
      const isNew = !seenIds.has(headline._id);
      nextSeenIds.add(headline._id);
      fragment.appendChild(renderHeadline(headline, isNew));
    });

    feedEl.replaceChildren(fragment);
    seenIds = nextSeenIds;
    setStatus('live', `live - updated ${relativeTime(new Date().toISOString())}`);
  } catch (err) {
    console.error('Failed to load headlines:', err.message);
    setStatus('error', 'connection issue, retrying...');
  }
}

loadHeadlines();
setInterval(loadHeadlines, REFRESH_MS);

const hokieAiLauncher = document.getElementById('hokieai-launcher');
const hokieAiPanel = document.getElementById('hokieai-panel');
const hokieAiClose = document.getElementById('hokieai-close');
const hokieAiChat = document.getElementById('hokieai-chat');

const HOKIE_CATEGORIES = [
  ['study', 'Open study rooms?'],
  ['dining', "What's open to eat?"],
  ['transit', 'How are the buses?'],
  ['weather', "What's the weather?"],
];

function addHokieAiMessage(role, text) {
  const message = document.createElement('p');
  message.className = `hokieai-message ${role}`;
  message.textContent = text;
  hokieAiChat.appendChild(message);
  hokieAiChat.scrollTop = hokieAiChat.scrollHeight;
}

function addHokieAiChoices(options, onChoice) {
  const choices = document.createElement('div');
  choices.className = 'hokieai-choices';

  options.forEach(([value, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => {
      choices.querySelectorAll('button').forEach((choice) => {
        choice.disabled = true;
      });
      addHokieAiMessage('user', label);
      onChoice(value);
    });
    choices.appendChild(button);
  });

  hokieAiChat.appendChild(choices);
  hokieAiChat.scrollTop = hokieAiChat.scrollHeight;
}

// One card with the real specifics (actual room names, dining spots, etc.) —
// this is the direct answer. Gemini's line is flavor on top, never the source of truth.
function addFactCard(title, tags) {
  const card = document.createElement('div');
  card.className = 'hokieai-fact-card';

  const heading = document.createElement('p');
  heading.className = 'hokieai-fact-title';
  heading.textContent = title;
  card.appendChild(heading);

  if (tags.length) {
    const tagWrap = document.createElement('div');
    tagWrap.className = 'hokieai-fact-tags';
    tags.forEach((tagText) => {
      const el = document.createElement('span');
      el.className = 'hokieai-fact-tag';
      el.textContent = tagText;
      tagWrap.appendChild(el);
    });
    card.appendChild(tagWrap);
  }

  hokieAiChat.appendChild(card);
  hokieAiChat.scrollTop = hokieAiChat.scrollHeight;
}

function addFactList(items) {
  const list = document.createElement('div');
  list.className = 'hokieai-fact-list';
  items.forEach((text) => {
    const item = document.createElement('div');
    item.className = 'hokieai-fact-item';
    item.textContent = text;
    list.appendChild(item);
  });
  hokieAiChat.appendChild(list);
  hokieAiChat.scrollTop = hokieAiChat.scrollHeight;
}

function renderFacts(category, facts) {
  if (!facts) return;

  if (category === 'study') {
    const count = facts.availableRoomCount || 0;
    addFactCard(`${count} room${count === 1 ? '' : 's'} open right now`, facts.availableRooms);
    return;
  }

  if (category === 'dining') {
    const count = facts.openLocationCount || 0;
    addFactCard(`${count} spot${count === 1 ? '' : 's'} open right now`, facts.locations);
    return;
  }

  if (category === 'transit') {
    if (!facts.buses.length) {
      addFactList(['No buses currently reporting.']);
      return;
    }
    addFactList(facts.buses.map((bus) => `${bus.route} · ${bus.occupancyPercent}% full · ${bus.status}`));
    return;
  }

  if (category === 'weather') {
    addFactList([`${facts.tempF}°F · ${facts.condition} · wind ${facts.windSpeed}`]);
  }
}

function addAskAgainButton() {
  addHokieAiChoices([['again', 'Ask something else']], startHokieAiChat);
}

async function askHokieAi(category) {
  try {
    const res = await fetch('/api/hokieai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'HokieAI could not respond.');

    renderFacts(data.category, data.facts);
    if (data.blurb) addHokieAiMessage('assistant diagnosis', data.blurb);
  } catch (error) {
    addHokieAiMessage('assistant error', error.message);
  }

  addAskAgainButton();
}

function startHokieAiChat() {
  hokieAiChat.replaceChildren();
  addHokieAiMessage('assistant', "Hi, I'm HokieAI. What do you want to know?");
  addHokieAiChoices(HOKIE_CATEGORIES, askHokieAi);
}

function setHokieAiOpen(isOpen) {
  hokieAiPanel.classList.toggle('open', isOpen);
  hokieAiPanel.setAttribute('aria-hidden', String(!isOpen));
  hokieAiLauncher.setAttribute('aria-expanded', String(isOpen));
}

hokieAiLauncher.addEventListener('click', () => {
  setHokieAiOpen(true);
  startHokieAiChat();
});

hokieAiClose.addEventListener('click', () => setHokieAiOpen(false));
