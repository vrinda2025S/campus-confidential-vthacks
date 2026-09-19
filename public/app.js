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

const HOKIE_AI_FLOW = {
  study: {
    label: 'Find a study spot',
    question: 'What are you trying to find?',
    options: [
      ['quiet', 'A quiet room'],
      ['group', 'A group room'],
      ['outlets', 'Outlets and a work spot'],
    ],
  },
  food: {
    label: 'Find food',
    question: 'What is the dining mood?',
    options: [
      ['fast', 'Something fast'],
      ['late', 'A late-night snack'],
      ['adventure', 'Least drama possible'],
    ],
  },
  transit: {
    label: 'Catch a bus',
    question: 'How is the commute going?',
    options: [
      ['on_time', 'I am on time for once'],
      ['late', 'I am running late'],
      ['defeated', 'Emotionally defeated'],
    ],
  },
};

let hokieAiAnswers = {};

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
      onChoice(value, label);
    });
    choices.appendChild(button);
  });

  hokieAiChat.appendChild(choices);
  hokieAiChat.scrollTop = hokieAiChat.scrollHeight;
}

function askChaosLevel() {
  addHokieAiMessage('assistant', 'Final question: how chaotic are you feeling?');
  addHokieAiChoices(
    [
      ['1', '1 - peaceful'],
      ['4', '4 - manageable'],
      ['7', '7 - concerning'],
      ['10', '10 - full goblin mode'],
    ],
    async (value) => {
      hokieAiAnswers.chaos = Number(value);
      addHokieAiMessage('assistant', 'Consulting the campus rumor mill...');
      await requestDiagnosis();
    }
  );
}

function askDetail() {
  const branch = HOKIE_AI_FLOW[hokieAiAnswers.mission];
  addHokieAiMessage('assistant', branch.question);
  addHokieAiChoices(branch.options, (value) => {
    hokieAiAnswers.detail = value;
    askChaosLevel();
  });
}

function startHokieAiChat() {
  hokieAiAnswers = {};
  hokieAiChat.replaceChildren();
  addHokieAiMessage('assistant', 'Hi, I am HokieAI. What is your campus mission?');
  addHokieAiChoices(
    Object.entries(HOKIE_AI_FLOW).map(([value, branch]) => [value, branch.label]),
    (value) => {
      hokieAiAnswers.mission = value;
      askDetail();
    }
  );
}

async function requestDiagnosis() {
  try {
    const response = await fetch('/api/hokieai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hokieAiAnswers),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'HokieAI could not respond.');
    addHokieAiMessage('assistant diagnosis', data.diagnosis);
  } catch (error) {
    addHokieAiMessage('assistant error', error.message);
  }
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
