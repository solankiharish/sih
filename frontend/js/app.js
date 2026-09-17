// ======================= STATE =======================
let currentUser = null;

const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');

// ======================= INIT =======================
window.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('sih_token');
  const savedUser = localStorage.getItem('sih_user');
  if (token && savedUser) {
    currentUser = JSON.parse(savedUser);
    showDashboard();
  }
});

// ======================= LOGIN =======================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  errorEl.textContent = '';

  try {
    const { token, user } = await Api.login(username, password);
    localStorage.setItem('sih_token', token);
    localStorage.setItem('sih_user', JSON.stringify(user));
    currentUser = user;
    showDashboard();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('sih_token');
  localStorage.removeItem('sih_user');
  currentUser = null;
  dashboardView.classList.add('hidden');
  loginView.classList.remove('hidden');
});

// ======================= DASHBOARD SHELL =======================
function showDashboard() {
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');

  document.getElementById('userInfo').innerHTML =
    `${currentUser.fullName} &nbsp;<span class="role-chip ${currentUser.role}">${currentUser.role}</span>`;

  // Role-based tab visibility
  document.getElementById('uploadTabBtn').classList.toggle(
    'hidden',
    !(currentUser.role === 'investigator' || currentUser.role === 'admin')
  );
  document.getElementById('usersTabBtn').classList.toggle('hidden', currentUser.role !== 'admin');
  document.getElementById('auditTabBtn').classList.toggle('hidden', currentUser.role !== 'admin');

  setActiveTab('documents');
  loadDocuments();
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    setActiveTab(tab);
    if (tab === 'documents') loadDocuments();
    if (tab === 'users') loadUsers();
    if (tab === 'audit') loadAudit();
  });
});

function setActiveTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
  document.getElementById(`tab-${tab}`).classList.remove('hidden');
}

// ======================= DOCUMENTS =======================
document.getElementById('refreshDocsBtn').addEventListener('click', loadDocuments);

async function loadDocuments() {
  const listEl = document.getElementById('docList');
  listEl.innerHTML = '<p class="empty-state">Loading...</p>';
  try {
    const { documents } = await Api.listDocuments();
    if (documents.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No documents yet.</div>';
      return;
    }
    listEl.innerHTML = documents.map(renderDocCard).join('');

    documents.forEach((doc) => {
      document.getElementById(`view-${doc.id}`).addEventListener('click', () => openViewer(doc));
      document.getElementById(`verify-${doc.id}`).addEventListener('click', () => verifyDoc(doc.id));
    });
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

function renderDocCard(doc) {
  const sizeKb = (doc.size / 1024).toFixed(1);
  return `
    <div class="doc-card">
      <div class="doc-info">
        <h3>${escapeHtml(doc.title)}</h3>
        <div class="doc-meta">
          <span>📁 Case: <strong>${escapeHtml(doc.caseId)}</strong></span>
          <span>👤 ${escapeHtml(doc.uploadedByName)} (${doc.uploadedByRole})</span>
          <span>🕒 ${new Date(doc.timestamp).toLocaleString()}</span>
          <span>📄 ${escapeHtml(doc.originalName)} · ${sizeKb} KB</span>
        </div>
        ${doc.description ? `<p style="margin:8px 0 0; font-size:13px; color:var(--text-dim);">${escapeHtml(doc.description)}</p>` : ''}
        <div class="doc-hash">SHA-256: ${doc.hash}</div>
      </div>
      <div class="doc-actions">
        <button id="verify-${doc.id}" class="btn btn-secondary btn-small">✓ Verify Integrity</button>
        <button id="view-${doc.id}" class="btn btn-primary btn-small">View / Decrypt</button>
      </div>
    </div>
  `;
}

async function verifyDoc(id) {
  try {
    const result = await Api.verifyDocument(id);
    alert(
      result.integrityVerified
        ? `✅ Integrity VERIFIED\n\nStored hash:\n${result.storedHash}\n\nRecomputed hash:\n${result.recomputedHash}`
        : `❌ Integrity CHECK FAILED — document may be tampered or corrupted.`
    );
  } catch (err) {
    alert('Verification failed: ' + err.message);
  }
}

async function openViewer(doc) {
  const modal = document.getElementById('viewerModal');
  const body = document.getElementById('viewerBody');
  document.getElementById('viewerTitle').textContent = doc.title;
  body.innerHTML = '<p>Decrypting &amp; verifying integrity...</p>';
  modal.classList.remove('hidden');

  try {
    const token = localStorage.getItem('sih_token');
    const res = await fetch(Api.viewDocumentUrl(doc.id), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to load document.');
    }

    const verified = res.headers.get('X-Integrity-Verified') === 'true';
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    let previewHtml = '';
    if (doc.mimeType.startsWith('image/')) {
      previewHtml = `<img src="${url}" />`;
    } else if (doc.mimeType === 'application/pdf') {
      previewHtml = `<iframe src="${url}"></iframe>`;
    } else if (doc.mimeType.startsWith('text/')) {
      const text = await blob.text();
      previewHtml = `<pre style="white-space:pre-wrap; font-size:13px;">${escapeHtml(text)}</pre>`;
    } else {
      previewHtml = `<p>Preview not available for this file type.</p>`;
    }

    body.innerHTML = `
      <p class="${verified ? 'badge-verified' : 'badge-failed'}">
        ${verified ? '✅ Integrity Verified (SHA-256 match, AES-256-GCM auth tag valid)' : '❌ Integrity check failed'}
      </p>
      ${previewHtml}
      <a href="${url}" download="${doc.originalName}" class="btn btn-secondary" style="margin-top:12px; display:inline-block;">⬇ Download decrypted file</a>
    `;
  } catch (err) {
    body.innerHTML = `<p class="badge-failed">${err.message}</p>`;
  }
}

document.getElementById('closeViewerBtn').addEventListener('click', () => {
  document.getElementById('viewerModal').classList.add('hidden');
});

// ======================= UPLOAD =======================
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById('uploadMsg');
  msgEl.textContent = 'Encrypting & uploading...';
  msgEl.className = 'status-text';

  const formData = new FormData();
  formData.append('caseId', document.getElementById('caseId').value.trim());
  formData.append('title', document.getElementById('docTitle').value.trim());
  formData.append('description', document.getElementById('docDescription').value.trim());
  formData.append('file', document.getElementById('docFile').files[0]);

  try {
    const { document: doc } = await Api.uploadDocument(formData);
    msgEl.textContent = `✅ Uploaded & encrypted. SHA-256: ${doc.hash.slice(0, 24)}...`;
    msgEl.className = 'status-text ok';
    e.target.reset();
    setActiveTab('documents');
    loadDocuments();
  } catch (err) {
    msgEl.textContent = '❌ ' + err.message;
    msgEl.className = 'status-text err';
  }
});

// ======================= USERS (admin) =======================
document.getElementById('createUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById('createUserMsg');
  const payload = {
    fullName: document.getElementById('newFullName').value.trim(),
    username: document.getElementById('newUsername').value.trim(),
    password: document.getElementById('newPassword').value,
    role: document.getElementById('newRole').value,
  };
  try {
    await Api.createUser(payload);
    msgEl.textContent = '✅ User created.';
    msgEl.className = 'status-text ok';
    e.target.reset();
    loadUsers();
  } catch (err) {
    msgEl.textContent = '❌ ' + err.message;
    msgEl.className = 'status-text err';
  }
});

async function loadUsers() {
  const listEl = document.getElementById('userList');
  listEl.innerHTML = '<p class="empty-state">Loading...</p>';
  try {
    const { users } = await Api.listUsers();
    listEl.innerHTML = users
      .map(
        (u) => `
      <div class="user-card">
        <div>
          <strong>${escapeHtml(u.fullName)}</strong> &nbsp;
          <span class="role-chip ${u.role}">${u.role}</span>
          <div style="color:var(--text-dim); font-size:12px; margin-top:4px;">@${escapeHtml(u.username)} · joined ${new Date(u.createdAt).toLocaleDateString()}</div>
        </div>
      </div>`
      )
      .join('');
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

// ======================= AUDIT LOG (admin) =======================
document.getElementById('refreshAuditBtn').addEventListener('click', loadAudit);

async function loadAudit() {
  const listEl = document.getElementById('auditList');
  listEl.innerHTML = '<p class="empty-state">Loading...</p>';
  try {
    const { logs } = await Api.listAudit();
    if (logs.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No activity yet.</div>';
      return;
    }
    listEl.innerHTML = logs
      .map(
        (l) => `
      <div class="audit-item">
        <div>
          <span class="audit-action">${l.action}</span>
          &nbsp;by <strong>${escapeHtml(l.username)}</strong>
          <span class="role-chip ${l.role}">${l.role}</span>
          <div style="color:var(--text-dim); font-size:12px; margin-top:4px;">${escapeHtml(l.details || '')}</div>
        </div>
        <div class="audit-time">${new Date(l.timestamp).toLocaleString()}</div>
      </div>`
      )
      .join('');
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

// ======================= UTIL =======================
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
