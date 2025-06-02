// ────────────────────────────────────────────────────────────────────────────
// 1) ELEMENT REFERENCES & STATE
// ────────────────────────────────────────────────────────────────────────────
const profileUrlInput = document.getElementById('profileUrl');
const notesInput      = document.getElementById('notes');
const form            = document.getElementById('connection-form');
const connectionsList = document.getElementById('connections-list');

let connections         = [];
let editingIndex        = null;
// holds the name of the currently loaded LinkedIn profile
let currentProfileName  = '';

// ────────────────────────────────────────────────────────────────────────────
// 2) SHOW TOAST (replace alert/confirm)
// ────────────────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// ────────────────────────────────────────────────────────────────────────────
// 3) GET LINKEDIN PROFILE URL & NAME
// ────────────────────────────────────────────────────────────────────────────
async function getLinkedInProfileInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url   = tab?.url || '';
  // match only /in/username/ pages
  const regex = /^https:\/\/www\.linkedin\.com\/in\/[a-zA-Z0-9\-_%]+\/?$/;

  if (regex.test(url)) {
    profileUrlInput.value = url;

    // Inject script to grab the <h1> text (profile name)
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: () => {
          const h1 = document.querySelector('h1');
          return h1 ? h1.innerText.trim() : '';
        }
      },
      (injectionResults) => {
        if (
          injectionResults &&
          Array.isArray(injectionResults) &&
          injectionResults[0] &&
          typeof injectionResults[0].result === 'string'
        ) {
          currentProfileName = injectionResults[0].result || '';
        } else {
          currentProfileName = '';
        }
      }
    );
  } else {
    // Not on a valid LinkedIn-in-page
    profileUrlInput.value     = '';
    currentProfileName        = '';
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 4) LOAD & SAVE FUNCTIONS
// ────────────────────────────────────────────────────────────────────────────
function loadConnections() {
  chrome.storage.local.get(['connections'], (result) => {
    // If existing entries only have profileUrl & notes (older format), default profileName to empty string
    connections = (result.connections || []).map(conn => ({
      profileUrl:  conn.profileUrl,
      profileName: conn.profileName || '',
      notes:       conn.notes || ''
    }));
    renderConnections();
  });
}

function saveConnections() {
  chrome.storage.local.set({ connections });
}

// ────────────────────────────────────────────────────────────────────────────
// 5) RENDER THE SAVED CONNECTIONS
// ────────────────────────────────────────────────────────────────────────────
function renderConnections() {
  connectionsList.innerHTML = '';

  if (connections.length === 0) {
    connectionsList.innerHTML = '<li>No connections saved yet.</li>';
    return;
  }

  connections.forEach((conn, index) => {
    const displayName = conn.profileName || conn.profileUrl;
    const li = document.createElement('li');
    li.className = 'connection-item';

    li.innerHTML = `
      <a href="${conn.profileUrl}" target="_blank" rel="noopener noreferrer">
        ${displayName}
      </a>
      <div class="notes"><strong>Notes:</strong> ${conn.notes || '<em>None</em>'}</div>
      <div class="buttons">
        <button class="edit-btn" data-index="${index}">Edit</button>
        <button class="delete-btn" data-index="${index}">Delete</button>
      </div>
    `;

    connectionsList.appendChild(li);
  });

  // Attach edit/delete handlers
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      startEditConnection(parseInt(btn.dataset.index, 10));
    });
  });
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteConnection(parseInt(btn.dataset.index, 10));
    });
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 6) ADD OR UPDATE A CONNECTION
// ────────────────────────────────────────────────────────────────────────────
function addOrUpdateConnection(event) {
  event.preventDefault();

  const profileUrl   = profileUrlInput.value.trim();
  const notes        = notesInput.value.trim();
  const profileName  = currentProfileName.trim();

  if (!profileUrl) {
    showToast('Please open a LinkedIn profile page to save.', 'error');
    return;
  }

  if (editingIndex !== null) {
    // UPDATE existing entry
    connections[editingIndex] = { profileUrl, profileName, notes };
    editingIndex = null;
    showToast('Connection updated.', 'success');
  } else {
    // CHECK duplicate
    if (connections.some(c => c.profileUrl === profileUrl)) {
      showToast('This profile is already saved.', 'error');
      return;
    }
    connections.push({ profileUrl, profileName, notes });
    showToast('Connection saved successfully!', 'success');
  }

  saveConnections();
  renderConnections();
  form.reset();
  // Preserve the URL field so user can see it, but clear name
  profileUrlInput.value     = profileUrl;
  currentProfileName        = profileName;
}

// ────────────────────────────────────────────────────────────────────────────
// 7) START EDITING A CONNECTION
// ────────────────────────────────────────────────────────────────────────────
function startEditConnection(index) {
  const conn = connections[index];
  profileUrlInput.value    = conn.profileUrl;
  notesInput.value         = conn.notes;
  currentProfileName       = conn.profileName;
  editingIndex             = index;
}

// ────────────────────────────────────────────────────────────────────────────
// 8) DELETE A CONNECTION
// ────────────────────────────────────────────────────────────────────────────
function deleteConnection(index) {
  if (confirm('Delete this connection?')) {
    connections.splice(index, 1);
    saveConnections();
    renderConnections();
    showToast('Connection deleted.', 'success');
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 9) INITIALIZE POPUP
// ────────────────────────────────────────────────────────────────────────────
function init() {
  getLinkedInProfileInfo();
  loadConnections();
  form.addEventListener('submit', addOrUpdateConnection);

  // If you switch tabs or reload LinkedIn, re-fetch name/URL whenever popup opens
  chrome.tabs.onActivated.addListener(getLinkedInProfileInfo);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      getLinkedInProfileInfo();
    }
  });
}

init();


document.getElementById('delete-all-btn').addEventListener('click', deleteAllConnections);
function deleteAllConnections() {
  if (connections.length === 0) {
    showToast('No connections to delete.', 'error');
    return;
  }

  if (confirm('Are you sure you want to delete all saved connections?')) {
    connections = [];
    saveConnections();
    renderConnections();
    showToast('All connections deleted.', 'success');
  }
}
