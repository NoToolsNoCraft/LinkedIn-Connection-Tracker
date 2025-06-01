const profileUrlInput = document.getElementById('profileUrl');
const howKnownInput = document.getElementById('howKnown');
const notesInput = document.getElementById('notes');
const form = document.getElementById('connection-form');
const connectionsList = document.getElementById('connections-list');

let connections = [];
let editingIndex = null;

// Get LinkedIn profile URL from active tab if URL matches LinkedIn profile pattern
async function getLinkedInProfileUrl() {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';
  const linkedInProfileRegex = /^https:\/\/www\.linkedin\.com\/in\/[a-zA-Z0-9\-_%]+\/?$/;
  if (linkedInProfileRegex.test(url)) {
    profileUrlInput.value = url;
  } else {
    profileUrlInput.value = '';
  }
}

// Load saved connections from chrome.storage.local
function loadConnections() {
  chrome.storage.local.get(['connections'], (result) => {
    connections = result.connections || [];
    renderConnections();
  });
}

// Save connections array to chrome.storage.local
function saveConnections() {
  chrome.storage.local.set({ connections });
}

// Render the saved connections list in the popup
function renderConnections() {
  connectionsList.innerHTML = '';

  if (connections.length === 0) {
    connectionsList.innerHTML = '<li>No connections saved yet.</li>';
    return;
  }

  connections.forEach((conn, index) => {
    const li = document.createElement('li');
    li.className = 'connection-item';

    li.innerHTML = `
      <a href="${conn.profileUrl}" target="_blank" rel="noopener noreferrer">${conn.profileUrl}</a>
      <div><strong>How known:</strong> ${conn.howKnown || '<em>None</em>'}</div>
      <div class="notes"><strong>Notes:</strong> ${conn.notes || '<em>None</em>'}</div>
      <div class="buttons">
        <button class="edit-btn" data-index="${index}">Edit</button>
        <button class="delete-btn" data-index="${index}">Delete</button>
      </div>
    `;

    connectionsList.appendChild(li);
  });

  // Add event listeners for edit and delete buttons
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

// Add or update a connection
function addOrUpdateConnection(event) {
  event.preventDefault();

  const profileUrl = profileUrlInput.value.trim();
  const howKnown = howKnownInput.value.trim();
  const notes = notesInput.value.trim();

  if (!profileUrl) {
    alert('Please open a LinkedIn profile page to save.');
    return;
  }

  if (editingIndex !== null) {
    // Update existing
    connections[editingIndex] = { profileUrl, howKnown, notes };
    editingIndex = null;
  } else {
    // Check duplicates
    if (connections.some(c => c.profileUrl === profileUrl)) {
      alert('This profile is already saved.');
      return;
    }
    connections.push({ profileUrl, howKnown, notes });
  }

  saveConnections();
  renderConnections();
  form.reset();
  profileUrlInput.value = profileUrl;
  howKnownInput.focus();
}

// Prepare form for editing a connection
function startEditConnection(index) {
  const conn = connections[index];
  profileUrlInput.value = conn.profileUrl;
  howKnownInput.value = conn.howKnown;
  notesInput.value = conn.notes;
  editingIndex = index;
}

// Delete a connection
function deleteConnection(index) {
  if (confirm('Delete this connection?')) {
    connections.splice(index, 1);
    saveConnections();
    renderConnections();
  }
}

// Initialize extension popup
function init() {
  getLinkedInProfileUrl();
  loadConnections();
  form.addEventListener('submit', addOrUpdateConnection);
}

init();
