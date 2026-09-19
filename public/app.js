const FEED_URL = '/api/headlines';
const REFRESH_MS = 15000;

const feedEl = document.getElementById('feed');
const liveDotEl = document.getElementById('live-dot');
const statusTextEl = document.getElementById('status-text');

let seenIds = new Set();

function relativeTime(dateString) {
  const seconds = Math.round((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function tagClass(source) {
  return ['dining', 'weather', 'transit', 'newman-library-rooms'].includes(source)
    ? source
    : 'default';
}

function renderHeadline(headline, isNew) {
  const el = document.createElement('article');
  el.className = 'story' + (isNew ? ' is-new' : '');

  el.innerHTML = `
    <span class="tag ${tagClass(headline.source)}">${headline.source}</span>
    <div>
      <h2>${headline.headline}</h2>
      <p>${headline.blurb}</p>
      <div class="meta">${relativeTime(headline.createdAt)}</div>
    </div>
  `;
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
      setStatus('live', 'live · no headlines yet');
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

    setStatus('live', `live · updated ${relativeTime(new Date().toISOString())}`);
  } catch (err) {
    console.error('Failed to load headlines:', err.message);
    setStatus('error', 'connection issue, retrying...');
  }
}

loadHeadlines();
setInterval(loadHeadlines, REFRESH_MS);
