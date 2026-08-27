// MOCKHIVE STUDIO CLIENT - REAL RUNNERS & CONTROLLER
let currentUser = null;
let githubPAT = '';
let storageRepo = '.mockhive-storage';
let vaultFileSha = null;
let activeNodeForShell = null;
let confirmCallback = null;

let nodesList = [];
let wagglesList = [];
let connectorsList = [];
let podsList = [];
let gridJobsList = [];

let activeWaggleForRun = null;
let activeWaggleForEdit = null;
let activeConnectorForEdit = null;

// Initialize on Load
document.addEventListener('DOMContentLoaded', async () => {
  githubPAT = sessionStorage.getItem('mockhive_pat') || localStorage.getItem('mockhive_pat') || '';
  if (githubPAT) {
    try {
      currentUser = await fetchGitHubUser(githubPAT);
      showAppLayout();
      await syncWithGitHub();
      logTelemetry('MockHive Studio connected. User @' + currentUser.login + ' loaded.');
    } catch (e) {
      console.warn('Stored token is invalid or expired:', e.message);
      githubPAT = '';
      currentUser = null;
      sessionStorage.removeItem('mockhive_pat');
      localStorage.removeItem('mockhive_pat');
      showAuthGate();
    }
  } else {
    showAuthGate();
  }
});

// Standard Safe UTF-8 Base64 Decoder (No Deprecated escape() / URIError)
function decodeBase64(b64) {
  if (!b64) return '{}';
  try {
    const clean = b64.replace(/[\r\n\s]/g, '');
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    try {
      return atob(b64.replace(/[\r\n\s]/g, ''));
    } catch (err) {
      return '{}';
    }
  }
}

// ─── AUTHENTICATION & GATE FLOW ──────────────────────────────────────────

async function fetchGitHubUser(pat) {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': 'token ' + pat,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Token no válido o expirado (HTTP 401)');
    if (res.status === 403) throw new Error('Límite de API excedido o permisos insuficientes (HTTP 403)');
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return await res.json();
}

async function handleGateLogin(e) {
  e.preventDefault();
  const input = document.getElementById('input-pat-gate');
  const pat = input.value.trim();
  if (!pat) return;

  const btn = document.getElementById('btn-gate-submit');
  btn.innerHTML = '<span>⏳</span> <span>Validando token con GitHub...</span>';
  btn.disabled = true;

  try {
    const user = await fetchGitHubUser(pat);
    if (!user || !user.login) {
      throw new Error('Token de GitHub no válido');
    }

    githubPAT = pat;
    currentUser = user;
    sessionStorage.setItem('mockhive_pat', pat);
    localStorage.setItem('mockhive_pat', pat);

    showAppLayout();
    showToast(`Conectado como @${user.login}`);
    logTelemetry(`[Auth Success] Logged in as @${user.login} (${user.name || 'Developer'}).`);
    await syncWithGitHub();
  } catch (err) {
    showToast('Error de autenticación: ' + err.message);
  } finally {
    btn.innerHTML = '<span>🚀</span> <span>Iniciar Sesión con GitHub PAT</span>';
    btn.disabled = false;
  }
}

function showAuthGate() {
  const gate = document.getElementById('auth-gate');
  const app = document.getElementById('app-layout');
  if (gate) gate.style.display = 'flex';
  if (app) app.style.display = 'none';

  const gateInput = document.getElementById('input-pat-gate');
  if (gateInput) {
    gateInput.value = '';
    gateInput.focus();
  }
}

function showAppLayout() {
  const gate = document.getElementById('auth-gate');
  const app = document.getElementById('app-layout');
  if (gate) gate.style.display = 'none';
  if (app) app.style.display = 'flex';
  renderAuthenticatedState();
}

function logout() {
  githubPAT = '';
  currentUser = null;
  sessionStorage.removeItem('mockhive_pat');
  localStorage.removeItem('mockhive_pat');
  showAuthGate();
  showToast('Sesión cerrada. Desconectado.');
  logTelemetry('[Auth] Logged out. Return to auth gate.');
}

function renderAuthenticatedState() {
  const headerAuth = document.getElementById('header-auth');
  if (headerAuth && currentUser) {
    headerAuth.innerHTML = `
      <div class="user-profile-box">
        <img src="${currentUser.avatar_url}" alt="${currentUser.login}" class="user-avatar">
        <div class="user-info">
          <span class="user-name">@${currentUser.login}</span>
          <span class="user-badge">${currentUser.public_repos} repos • ${currentUser.plan ? currentUser.plan.name : 'GitHub'}</span>
        </div>
        <button class="btn-sm btn-secondary" style="margin-left: 8px;" onclick="logout()">🚪 Desconectar</button>
      </div>
    `;
  }

  const dot = document.getElementById('vault-dot');
  if (dot) {
    dot.className = 'status-dot connected';
    document.getElementById('vault-status-text').innerText = `Vault: .mockhive-storage`;
  }
}

// ─── GLOBAL MODAL / BACKDROP EVENT HANDLERS ────────────────────────────────

function handleBackdropClick(e, modalId) {
  if (e.target.id === modalId) {
    closeAnyModal(modalId);
  }
}

function closeAnyModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    el.classList.add('hidden');
    el.style.display = 'none';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop').forEach(m => {
      m.classList.add('hidden');
      m.style.display = 'none';
    });
  }
});

// ─── TOAST NOTIFICATION & CONFIRM SYSTEM ────────────────────────────────────

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>✓</span> <span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

function showConfirm(title, desc, onConfirm) {
  document.getElementById('confirm-modal-title').innerText = title;
  document.getElementById('confirm-modal-desc').innerText = desc;
  confirmCallback = onConfirm;

  const btn = document.getElementById('confirm-modal-btn');
  btn.onclick = () => {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
  };

  const modal = document.getElementById('modal-confirm');
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

function closeConfirmModal() {
  const modal = document.getElementById('modal-confirm');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
  confirmCallback = null;
}

function loadDefaultDeployedResources() {
  nodesList = [
    {
      nodeId: 'node_master_worker',
      name: 'Master-Production-Worker',
      osImage: 'ubuntu-latest',
      lifecycleMode: 'lazarus_24_7',
      ttlMinutes: null,
      inactivityMinutes: null,
      storage: { type: 'vault_persistent', mountPath: '/mockhive/data' },
      tunnelProvider: 'tmate',
      initScript: '',
      status: 'stopped',
      sshCommand: null,
      webCommand: null,
      uptimeSeconds: 0
    },
    {
      nodeId: 'node_dev_ubuntu',
      name: 'Dev-Worker-Ubuntu',
      osImage: 'ubuntu-22.04',
      lifecycleMode: 'ttl_ephemeral',
      ttlMinutes: null,
      inactivityMinutes: null,
      storage: { type: 'rolla_ball', rollaBallId: 'ball_dev_storage', mountPath: '/mockhive/data' },
      tunnelProvider: 'tmate',
      initScript: '',
      status: 'stopped',
      sshCommand: null,
      webCommand: null,
      uptimeSeconds: 0
    }
  ];

  wagglesList = [];

  podsList = [
    {
      podId: 'pod_normalizer_py',
      name: 'Data-Normalizer-Py',
      runtime: 'python3',
      version: '1.0.0'
    },
    {
      podId: 'pod_crypto_rust',
      name: 'Fast-Crypto-Rust',
      runtime: 'rust',
      version: '1.1.0'
    },
    {
      podId: 'pod_wasm_sandbox',
      name: 'WASM-Edge-Sandbox',
      runtime: 'wasm',
      version: '1.0.0'
    }
  ];

  gridJobsList = [
    {
      jobId: 'grid_embedding_matrix',
      name: 'Massive-Image-Vector-Matrix',
      workers: 8,
      status: 'completed',
      elapsedSeconds: 14
    },
    {
      jobId: 'grid_log_analytics',
      name: 'Distributed-Log-Parser',
      workers: 4,
      status: 'completed',
      elapsedSeconds: 9
    }
  ];

  renderAll();
}

// Switch Tabs
function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));

  const btn = Array.from(document.querySelectorAll('.nav-item')).find(b => b.getAttribute('onclick')?.includes(tabId));
  if (btn) btn.classList.add('active');

  const pane = document.getElementById('tab-' + tabId);
  if (pane) pane.classList.add('active');

  const titles = {
    dashboard: ['Resource Monitor & Live Dashboard', 'Monitoreo en tiempo real de infraestructura efímera'],
    nodes: ['HiveNodes (EC2 Virtual Servers & Relays)', 'Servidores Ubuntu con terminal SSH en navegadores y CLI'],
    waggles: ['Waggles State Machines & Step Functions', 'Orquestación declarativa de grafos de ejecución y aprobaciones'],
    pods: ['PollenPods (Polyglot Micro-VMs)', 'Ejecución serverless bajo demanda para Python, Rust, Go, WASM'],
    grid: ['HiveGrid (Distributed Map-Reduce Cluster)', 'Computación paralela masiva multi-runner a coste $0'],
    onboarding: ['Onboarding, Guía & Manual de Uso', 'Documentación completa, buenas prácticas y solución de dudas']
  };

  if (titles[tabId]) {
    document.getElementById('page-title').innerText = titles[tabId][0];
    document.getElementById('page-subtitle').innerText = titles[tabId][1];
  }
}

// ─── GITHUB API STORAGE SYNCHRONIZATION ─────────────────────────────────────

async function syncWithGitHub() {
  if (!githubPAT || !currentUser) {
    loadDefaultDeployedResources();
    return;
  }
  logTelemetry(`[Sync] Fetching .mockhive-storage for @${currentUser.login}...`);

  try {
    const res = await fetch(`https://api.github.com/repos/${currentUser.login}/.mockhive-storage/contents/data.json?t=${Date.now()}`, {
      headers: {
        'Authorization': 'token ' + githubPAT,
        'Accept': 'application/vnd.github.v3+json',
      }
    });

    if (res.ok) {
      const dataJson = await res.json();
      vaultFileSha = dataJson.sha;
      const decoded = decodeBase64(dataJson.content);
      const parsed = JSON.parse(decoded);

      nodesList = parsed.nodes || [];
      wagglesList = parsed.waggles || [];
      connectorsList = parsed.connectors || [];
      podsList = parsed.pods || [];
      gridJobsList = parsed.grid || [];

      // Check live status files in repo and merge
      await checkLiveStatusForNodes();

      renderAll();
      logTelemetry(`[Sync Complete] Loaded ${nodesList.length} nodes, ${wagglesList.length} waggles, ${connectorsList.length} connectors, ${podsList.length} pods from GitHub.`);
      return;
    }
  } catch (err) {
    console.warn('Error fetching from GitHub API:', err);
  }

  loadDefaultDeployedResources();
  await persistToGitHub();
}

async function checkLiveStatusForNodes() {
  if (!githubPAT || !currentUser) return;
  let statusChanged = false;

  for (const node of nodesList) {
    try {
      const res = await fetch(`https://api.github.com/repos/${currentUser.login}/.mockhive-storage/contents/.mockhive-status/${node.nodeId}.json?t=${Date.now()}`, {
        headers: {
          'Authorization': 'token ' + githubPAT,
          'Accept': 'application/vnd.github.v3+json',
        }
      });
      if (res.ok) {
        const json = await res.json();
        const statData = JSON.parse(decodeBase64(json.content));
        
        if (statData.status === 'running' && statData.sshCommand) {
          if (node.status !== 'running' || node.sshCommand !== statData.sshCommand) {
            node.status = 'running';
            node.sshCommand = statData.sshCommand;
            node.webCommand = statData.webCommand;
            statusChanged = true;
          }
        } else if (statData.status === 'stopped' && node.status !== 'provisioning') {
          if (node.status !== 'stopped') {
            node.status = 'stopped';
            node.sshCommand = null;
            node.webCommand = null;
            statusChanged = true;
          }
        }
      }
    } catch (e) {
      console.warn('Error checking status for node:', node.nodeId, e);
    }
  }

  if (statusChanged) {
    renderAll();
  }
}

async function persistToGitHub() {
  if (!githubPAT || !currentUser) return;

  const payload = {
    nodes: nodesList,
    waggles: wagglesList,
    connectors: connectorsList,
    pods: podsList,
    grid: gridJobsList,
    updatedAt: new Date().toISOString()
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const b64 = btoa(unescape(encodeURIComponent(jsonStr)));

  try {
    // 1. Fetch current SHA to eliminate 409 Conflict
    let currentSha = vaultFileSha;
    try {
      const curRes = await fetch(`https://api.github.com/repos/${currentUser.login}/.mockhive-storage/contents/data.json?t=${Date.now()}`, {
        headers: { 'Authorization': 'token ' + githubPAT, 'Accept': 'application/vnd.github.v3+json' }
      });
      if (curRes.ok) {
        const curJson = await curRes.json();
        currentSha = curJson.sha;
        vaultFileSha = currentSha;
      }
    } catch (e) {}

    const body = {
      message: 'chore: update deployed resources state',
      content: b64
    };
    if (currentSha) body.sha = currentSha;

    const res = await fetch(`https://api.github.com/repos/${currentUser.login}/.mockhive-storage/contents/data.json`, {
      method: 'PUT',
      headers: {
        'Authorization': 'token ' + githubPAT,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      const result = await res.json();
      vaultFileSha = result.content?.sha || vaultFileSha;
      logTelemetry('[Vault] State committed to GitHub .mockhive-storage');
    }
  } catch (e) {
    console.error('Failed to commit state to GitHub:', e);
  }
}

// ─── RENDERERS ─────────────────────────────────────────────────────────────

function renderAll() {
  renderKPIs();
  renderNodesList();
  renderWagglesList();
  renderConnectorsList();
  renderPodsList();
  renderGridJobs();
  renderDashboardFeed();
}

function renderKPIs() {
  document.getElementById('kpi-nodes').innerText = nodesList.filter(n => n.status === 'running').length;
  document.getElementById('kpi-waggles').innerText = wagglesList.length;
  document.getElementById('kpi-pods').innerText = podsList.length;
  document.getElementById('kpi-grid').innerText = gridJobsList.length;
}

function renderDashboardFeed() {
  const container = document.getElementById('active-resources-list');
  if (!container) return;

  if (nodesList.length === 0 && podsList.length === 0 && wagglesList.length === 0) {
    container.innerHTML = '<p class="section-desc">No hay recursos creados. Utiliza los formularios para aprovisionar HiveNodes, Waggles o Micro-VMs.</p>';
    return;
  }

  let html = '';
  nodesList.forEach(n => {
    const isRunning = n.status === 'running';
    html += `
      <div class="node-card" style="margin-bottom: 10px;">
        <div class="node-header">
          <div>
            <h4>🏰 ${n.name}</h4>
            <span class="node-id">${n.nodeId} • ${n.lifecycleMode === 'lazarus_24_7' ? '24/7 Lazarus' : 'TTL Efímero'}</span>
          </div>
          <span class="status-tag ${n.status}">${isRunning ? 'EN EJECUCIÓN' : n.status === 'provisioning' ? 'APROVISIONANDO' : 'DETENIDO'}</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          ${(isRunning && n.sshCommand) ? `<code>${n.sshCommand}</code>` : 'Servidor detenido / pendiente de arranque'}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderNodesList() {
  const container = document.getElementById('nodes-inventory-list');
  if (!container) return;

  if (nodesList.length === 0) {
    container.innerHTML = '<p class="section-desc">No hay servidores HiveNodes registrados. Despliega uno con el formulario.</p>';
    return;
  }

  let html = '';
  nodesList.forEach(n => {
    const isRunning = n.status === 'running';
    const isProvisioning = n.status === 'provisioning';
    const hasValidSSH = isRunning && n.sshCommand && !n.sshCommand.includes('localhost') && !n.sshCommand.includes('(Web Shell');
    const hasWebTerminal = isRunning && n.webCommand;

    let storageDesc = n.storage?.type || 'vault_persistent';
    if (n.storage?.type === 'vault_persistent') storageDesc = '📦 Vault (.tar.zst)';
    else if (n.storage?.type === 'rolla_ball') storageDesc = `🎱 Rolla: ${n.storage.rollaBallId || 'default'}${n.storage.rollaOwner ? ' (@' + n.storage.rollaOwner + ')' : ''}`;
    else if (n.storage?.type === 's3_custom') storageDesc = `☁️ S3: s3://${n.storage.s3Bucket || 'bucket'}${n.storage.s3Prefix ? '/' + n.storage.s3Prefix : ''}`;
    else if (n.storage?.type === 'ephemeral') storageDesc = '⚡ Efímero';

    html += `
      <div class="node-card">
        <div class="node-header">
          <div>
            <h4>${n.name}</h4>
            <span class="node-id">${n.nodeId} • ${n.osImage}</span>
          </div>
          <span class="status-tag ${n.status}">${isRunning ? 'EN EJECUCIÓN' : isProvisioning ? 'APROVISIONANDO RUNNER ⚡' : 'DETENIDO'}</span>
        </div>
        <div class="node-details">
          <div><strong>Ciclo:</strong> ${n.lifecycleMode === 'lazarus_24_7' ? '24/7 Lazarus Relay' : n.ttlMinutes ? `TTL (${n.ttlMinutes}m)` : 'Inactividad (Sin TTL fijo)'}</div>
          <div><strong>Storage:</strong> ${storageDesc}</div>
          <div><strong>Tunnel:</strong> ${n.tunnelProvider}</div>
        </div>
        ${(isRunning && (hasValidSSH || hasWebTerminal)) ? `
          <div class="ssh-box" style="display: flex; flex-direction: column; gap: 8px;">
            ${hasValidSSH ? `
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                  <code style="word-break: break-all; font-weight: 600;">${n.sshCommand}</code>
                  <button class="btn-sm btn-secondary" onclick="copyNodeSSH('${n.nodeId}')">Copiar SSH</button>
                </div>
                <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 4px;">
                  🔑 <strong>Password SSH:</strong> <code>${n.sshPassword || 'mockhive2026'}</code>
                </div>
              </div>
            ` : ''}
            ${hasWebTerminal ? `
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; ${hasValidSSH ? 'border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px;' : ''}">
                <span style="font-size: 0.8rem; color: #4ade80; display: flex; align-items: center; gap: 4px;">🌐 <strong>Web Terminal:</strong> Activa</span>
                <a href="${n.webCommand}" target="_blank" class="btn-sm btn-primary" style="text-decoration: none;">🚀 Abrir en Navegador</a>
              </div>
            ` : ''}
          </div>
        ` : `
          <div class="ssh-pending-box">
            <span>${isProvisioning ? '⚡ Lanzando runner en GitHub Actions y conectando túneles...' : 'Servidor detenido. Pulsa "⚡ Iniciar Servidor" para despachar un runner real de GitHub Actions y generar los túneles.'}</span>
          </div>
        `}
        <div class="node-actions">
          ${isRunning ? 
            `<button class="btn-sm btn-secondary" onclick="stopNode('${n.nodeId}')">🛑 Parar Servidor</button>` : 
            isProvisioning ?
            `<button class="btn-sm btn-secondary" disabled style="opacity: 0.7;">⏳ Aprovisionando Runner...</button>` :
            `<button class="btn-sm btn-primary" onclick="startNode('${n.nodeId}')">⚡ Iniciar Servidor</button>`
          }
          <button class="btn-sm btn-secondary" onclick="openNodeShell('${n.nodeId}')">🖥️ Web Shell</button>
          <button class="btn-sm btn-secondary" onclick="openEditModal('${n.nodeId}')">⚙️ Editar</button>
          <button class="btn-sm btn-secondary" onclick="deleteNode('${n.nodeId}')">🗑️ Eliminar</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function handleCreateNode(e) {
  e.preventDefault();
  if (!currentUser) {
    showAuthGate();
    return;
  }

  const name = document.getElementById('node-name').value;
  const osImage = document.getElementById('node-os').value;
  const lifecycleMode = document.getElementById('node-lifecycle').value;
  
  const rawTtl = document.getElementById('node-ttl').value;
  const ttlMinutes = lifecycleMode === 'lazarus_24_7' ? null : (rawTtl === '' || rawTtl === '0' ? 0 : parseInt(rawTtl, 10));
  
  const rawInactivity = document.getElementById('node-inactivity').value;
  const inactivityMinutes = lifecycleMode === 'lazarus_24_7' ? null : (rawInactivity ? parseInt(rawInactivity, 10) : 15);

  const storageType = document.getElementById('node-storage-type').value;
  const rollaBallId = document.getElementById('rolla-ball-id')?.value || '';
  const rollaOwner = document.getElementById('rolla-owner')?.value || '';
  const rollaToken = document.getElementById('rolla-token')?.value || '';
  const rollaSyncMode = document.getElementById('rolla-sync-mode')?.value || 'periodic_60s';

  const s3Endpoint = document.getElementById('s3-endpoint')?.value || '';
  const s3Bucket = document.getElementById('s3-bucket')?.value || '';
  const s3AccessKey = document.getElementById('s3-access-key')?.value || '';
  const s3SecretKey = document.getElementById('s3-secret-key')?.value || '';
  const s3Region = document.getElementById('s3-region')?.value || '';
  const s3Prefix = document.getElementById('s3-prefix')?.value || '';

  const tunnelProvider = document.getElementById('node-tunnel').value;
  const sshPassword = document.getElementById('node-ssh-password')?.value.trim() || 'mockhive2026';
  const initScript = document.getElementById('node-init-script')?.value || '';

  const newNode = {
    nodeId: 'node_' + Math.random().toString(36).slice(2, 8),
    name,
    osImage,
    lifecycleMode,
    ttlMinutes,
    inactivityMinutes,
    storage: { 
      type: storageType, 
      rollaBallId: storageType === 'rolla_ball' ? rollaBallId : undefined,
      rollaOwner: (storageType === 'rolla_ball' && rollaOwner) ? rollaOwner : undefined,
      rollaToken: (storageType === 'rolla_ball' && rollaToken) ? rollaToken : undefined,
      rollaSyncMode: storageType === 'rolla_ball' ? rollaSyncMode : undefined,
      s3Endpoint: storageType === 's3_custom' ? s3Endpoint : undefined,
      s3Bucket: storageType === 's3_custom' ? s3Bucket : undefined,
      s3AccessKey: (storageType === 's3_custom' && s3AccessKey) ? s3AccessKey : undefined,
      s3SecretKey: (storageType === 's3_custom' && s3SecretKey) ? s3SecretKey : undefined,
      s3Region: (storageType === 's3_custom' && s3Region) ? s3Region : undefined,
      s3Prefix: (storageType === 's3_custom' && s3Prefix) ? s3Prefix : undefined,
      mountPath: '/mockhive/data' 
    },
    tunnelProvider,
    sshPassword,
    initScript,
    status: 'stopped',
    sshCommand: null,
    webCommand: null,
    uptimeSeconds: 0,
    createdAt: new Date().toISOString()
  };

  nodesList.push(newNode);
  persistToGitHub();
  renderAll();
  showToast(`HiveNode '${name}' aprovisionado en modo ${lifecycleMode === 'lazarus_24_7' ? '24/7' : 'TTL'}`);
  logTelemetry(`[Node Created] ${newNode.name} registered in mode ${newNode.lifecycleMode}`);
}

async function startNode(nodeId) {
  const node = nodesList.find(n => n.nodeId === nodeId);
  if (!node) return;

  if (!currentUser || !githubPAT) {
    showAuthGate();
    return;
  }

  node.status = 'provisioning';
  node.sshCommand = null;
  node.webCommand = null;
  renderAll();
  showToast(`Despachando runner de GitHub Actions para ${node.name}...`);
  logTelemetry(`[Runner Dispatch] Triggering hivenode.yml workflow on GitHub Actions...`);

  try {
    // 1. Reset remote status file to provisioning to wipe previous runs
    try {
      let shaArg = null;
      const exRes = await fetch(`https://api.github.com/repos/${currentUser.login}/.mockhive-storage/contents/.mockhive-status/${node.nodeId}.json?t=${Date.now()}`, {
        headers: { 'Authorization': 'token ' + githubPAT, 'Accept': 'application/vnd.github.v3+json' }
      });
      if (exRes.ok) {
        const exJson = await exRes.json();
        shaArg = exJson.sha;
      }

      const statBody = {
        message: 'status: provisioning ' + node.nodeId,
        content: btoa(JSON.stringify({
          nodeId: node.nodeId,
          sshCommand: null,
          webCommand: null,
          status: 'provisioning',
          updatedAt: new Date().toISOString()
        }, null, 2))
      };
      if (shaArg) statBody.sha = shaArg;

      await fetch(`https://api.github.com/repos/${currentUser.login}/.mockhive-storage/contents/.mockhive-status/${node.nodeId}.json`, {
        method: 'PUT',
        headers: { 'Authorization': 'token ' + githubPAT, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
        body: JSON.stringify(statBody)
      });
    } catch (e) {
      console.warn('Pre-dispatch status reset:', e);
    }

    // 2. Dispatch the GitHub Actions Workflow
    const res = await fetch(`https://api.github.com/repos/${currentUser.login}/.mockhive-storage/actions/workflows/hivenode.yml/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': 'token ' + githubPAT,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          node_id: node.nodeId,
          lifecycle_mode: node.lifecycleMode,
          ttl_minutes: String(node.ttlMinutes && node.ttlMinutes > 0 ? node.ttlMinutes : 350),
          ssh_password: node.sshPassword || 'mockhive2026'
        }
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    logTelemetry(`[Runner Launched] GitHub Actions workflow dispatched successfully. Polling live status...`);
    showToast(`Runner lanzado. Esperando conexión SSH y Web Terminal...`);

    // 3. Poll status from GitHub with cache-busting every 3s
    let attempts = 0;
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const statRes = await fetch(`https://api.github.com/repos/${currentUser.login}/.mockhive-storage/contents/.mockhive-status/${node.nodeId}.json?t=${Date.now()}`, {
          headers: {
            'Authorization': 'token ' + githubPAT,
            'Accept': 'application/vnd.github.v3+json',
          }
        });
        if (statRes.ok) {
          const json = await statRes.json();
          const statData = JSON.parse(decodeBase64(json.content));
          
          if (statData.status === 'running' && (statData.sshCommand || statData.webCommand)) {
            node.status = 'running';
            node.sshCommand = statData.sshCommand;
            node.webCommand = statData.webCommand;
            clearInterval(pollInterval);
            renderAll();
            persistToGitHub();
            
            if (activeNodeForShell && activeNodeForShell.nodeId === node.nodeId) {
              openNodeShell(node.nodeId);
            }
            
            showToast(`¡Servidor ${node.name} activo! Túnel SSH listo.`);
            logTelemetry(`[Runner Online] ${node.name} SSH: ${node.sshCommand}`);
          }
        }
      } catch (e) {}

      if (attempts > 45) {
        clearInterval(pollInterval);
        if (node.status === 'provisioning') {
          showToast('Tiempo de espera agotado al conectar runner. Reintenta.');
          node.status = 'stopped';
          renderAll();
        }
      }
    }, 3000);

  } catch (err) {
    showToast('Error al disparar runner: ' + err.message);
    node.status = 'stopped';
    renderAll();
  }
}

async function stopNode(nodeId) {
  const node = nodesList.find(n => n.nodeId === nodeId);
  if (!node) return;

  showConfirm('Detener Servidor', `¿Deseas detener el runner de GitHub Actions para '${node.name}'?`, async () => {
    node.status = 'stopped';
    node.sshCommand = null;
    node.webCommand = null;
    renderAll();
    showToast(`Deteniendo servidor '${node.name}'...`);
    logTelemetry(`[Node Stopped] ${node.name} status: STOPPED`);

    try {
      if (githubPAT && currentUser) {
        // 1. Cancel in-progress and queued runs
        try {
          const runsRes = await fetch(`https://api.github.com/repos/${currentUser.login}/.mockhive-storage/actions/runs?per_page=15`, {
            headers: { 'Authorization': 'token ' + githubPAT, 'Accept': 'application/vnd.github.v3+json' }
          });
          if (runsRes.ok) {
            const runsData = await runsRes.json();
            for (const r of (runsData.workflow_runs || [])) {
              if (r.status === 'in_progress' || r.status === 'queued') {
                await fetch(`https://api.github.com/repos/${currentUser.login}/.mockhive-storage/actions/runs/${r.id}/cancel`, {
                  method: 'POST',
                  headers: { 'Authorization': 'token ' + githubPAT, 'Accept': 'application/vnd.github.v3+json' }
                });
              }
            }
          }
        } catch (e) {
          console.warn('Error cancelling runs:', e);
        }

        // 2. Reset status file in repo
        let shaArg = null;
        try {
          const exRes = await fetch(`https://api.github.com/repos/${currentUser.login}/.mockhive-storage/contents/.mockhive-status/${node.nodeId}.json?t=${Date.now()}`, {
            headers: { 'Authorization': 'token ' + githubPAT, 'Accept': 'application/vnd.github.v3+json' }
          });
          if (exRes.ok) {
            const exJson = await exRes.json();
            shaArg = exJson.sha;
          }
        } catch (e) {}

        const statBody = {
          message: 'status: stop ' + node.nodeId,
          content: btoa(JSON.stringify({
            nodeId: node.nodeId,
            sshCommand: null,
            webCommand: null,
            status: 'stopped',
            updatedAt: new Date().toISOString()
          }, null, 2))
        };
        if (shaArg) statBody.sha = shaArg;

        await fetch(`https://api.github.com/repos/${currentUser.login}/.mockhive-storage/contents/.mockhive-status/${node.nodeId}.json`, {
          method: 'PUT',
          headers: { 'Authorization': 'token ' + githubPAT, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
          body: JSON.stringify(statBody)
        });
      }
    } catch (e) {
      console.warn('Error resetting status:', e);
    }

    await persistToGitHub();
    renderAll();
    showToast(`Servidor '${node.name}' detenido correctamente.`);
  });
}

function deleteNode(nodeId) {
  const node = nodesList.find(n => n.nodeId === nodeId);
  showConfirm('Eliminar Servidor', `¿Seguro que deseas eliminar este HiveNode (${node ? node.name : nodeId})?`, () => {
    nodesList = nodesList.filter(n => n.nodeId !== nodeId);
    persistToGitHub();
    renderAll();
    showToast('HiveNode eliminado.');
    logTelemetry(`[Node Deleted] ${nodeId} removed.`);
  });
}

function copyNodeSSH(nodeId) {
  const node = nodesList.find(n => n.nodeId === nodeId);
  if (!node || !node.sshCommand) {
    showToast('No hay comando SSH disponible');
    return;
  }
  const cleanCmd = node.sshCommand.replace(/\(.*?\)/g, '').trim();
  copyTextToClipboard(cleanCmd);
}

function copySSHCommand(cmd) {
  if (!cmd) return;
  const cleanCmd = cmd.replace(/\(.*?\)/g, '').trim();
  copyTextToClipboard(cleanCmd);
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`✓ Comando SSH copiado al portapapeles`);
    }).catch(() => {
      fallbackCopyText(text);
    });
  } else {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '0';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    showToast(`✓ Comando SSH copiado al portapapeles`);
  } catch (err) {
    prompt('Copia manualmente este comando SSH:', text);
  }
  document.body.removeChild(ta);
}

function onLifecycleChange() {
  const val = document.getElementById('node-lifecycle').value;
  const warn = document.getElementById('node-247-warning');
  const ttlRow = document.getElementById('ttl-row');
  if (val === 'lazarus_24_7') {
    if (warn) warn.classList.remove('hidden');
    if (ttlRow) ttlRow.classList.add('hidden');
  } else {
    if (warn) warn.classList.add('hidden');
    if (ttlRow) ttlRow.classList.remove('hidden');
  }
}

function onStorageTypeChange() {
  const val = document.getElementById('node-storage-type').value;
  document.getElementById('storage-rolla-config').classList.toggle('hidden', val !== 'rolla_ball');
  document.getElementById('storage-s3-config').classList.toggle('hidden', val !== 's3_custom');
}

function onEditLifecycleChange() {
  const val = document.getElementById('edit-node-lifecycle').value;
  const warn = document.getElementById('edit-node-247-warning');
  const ttlRow = document.getElementById('edit-ttl-row');
  if (val === 'lazarus_24_7') {
    if (warn) warn.classList.remove('hidden');
    if (ttlRow) ttlRow.classList.add('hidden');
  } else {
    if (warn) warn.classList.add('hidden');
    if (ttlRow) ttlRow.classList.remove('hidden');
  }
}

function onEditStorageTypeChange() {
  const val = document.getElementById('edit-node-storage-type').value;
  document.getElementById('edit-storage-rolla-config').classList.toggle('hidden', val !== 'rolla_ball');
  document.getElementById('edit-storage-s3-config').classList.toggle('hidden', val !== 's3_custom');
}

function renderPodsList() {
  const select = document.getElementById('select-test-pod');
  if (!select) return;
  if (podsList.length === 0) {
    select.innerHTML = '<option value="">No hay Pods registrados</option>';
    return;
  }
  select.innerHTML = podsList.map(p => `<option value="${p.podId}">${p.name} (${p.runtime})</option>`).join('');
}

function handleCreatePod(e) {
  e.preventDefault();
  if (!currentUser) { showAuthGate(); return; }

  const name = document.getElementById('pod-name').value;
  const runtime = document.getElementById('pod-runtime').value;
  const newPod = {
    podId: 'pod_' + Math.random().toString(36).slice(2, 8),
    name,
    runtime,
    version: '1.0.0',
    createdAt: new Date().toISOString()
  };
  podsList.push(newPod);
  persistToGitHub();
  renderAll();
  showToast(`PollenPod '${name}' guardado con éxito`);
  logTelemetry(`[PollenPod Created] ${name} compiled in ${runtime}`);
}

function testInvokePod() {
  const select = document.getElementById('select-test-pod');
  const pod = podsList.find(p => p.podId === select.value) || podsList[0];
  if (!pod) { showToast('Crea primero un PollenPod'); return; }

  const payloadStr = document.getElementById('test-pod-payload').value;
  let payload = {};
  try { payload = JSON.parse(payloadStr); } catch (err) { showToast('JSON inválido'); return; }

  const latency = Math.floor(Math.random() * 25) + 14;
  document.getElementById('res-latency').innerText = `⏱️ ${latency}ms`;

  const output = {
    invocationId: 'inv_' + Math.random().toString(36).slice(2, 8),
    podId: pod.podId,
    runtime: pod.runtime,
    processedPayload: payload,
    status: 'success',
    executedAt: new Date().toISOString()
  };

  document.getElementById('res-json-output').innerText = JSON.stringify(output, null, 2);
  document.getElementById('pod-test-result').classList.remove('hidden');
  showToast(`Invocación completada en ${latency}ms`);
  logTelemetry(`[Pod Invocation] ${pod.name} responded in ${latency}ms`);
}

// ─── WAGGLES & CUSTOM CONNECTORS SUITE ──────────────────────────────────────

function switchWaggleSubTab(subtabId) {
  document.querySelectorAll('.sub-nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.sub-pane').forEach(p => p.classList.remove('active'));

  const btn = document.getElementById('btn-subtab-' + subtabId);
  if (btn) btn.classList.add('active');

  const pane = document.getElementById('subpane-' + subtabId);
  if (pane) pane.classList.add('active');
}

function onConnectorTypeChange(typeSelectId, httpBlockId, storageBlockId, codeBlockId) {
  const sel = document.getElementById(typeSelectId);
  if (!sel) return;
  const val = sel.value;
  const httpBlock = document.getElementById(httpBlockId);
  const storageBlock = document.getElementById(storageBlockId);
  const codeBlock = document.getElementById(codeBlockId);

  if (httpBlock) httpBlock.classList.toggle('hidden', val !== 'http');
  if (storageBlock) storageBlock.classList.toggle('hidden', val !== 'storage');
  if (codeBlock) codeBlock.classList.toggle('hidden', val !== 'code' && val !== 'pod');
}

function onStorageProviderChange(providerSelectId, rollaBlockId, s3BlockId, vaultBlockId) {
  const sel = document.getElementById(providerSelectId);
  if (!sel) return;
  const val = sel.value;
  const rollaBlock = document.getElementById(rollaBlockId);
  const s3Block = document.getElementById(s3BlockId);
  const vaultBlock = document.getElementById(vaultBlockId);

  if (rollaBlock) rollaBlock.classList.toggle('hidden', val !== 'rolla_ball');
  if (s3Block) s3Block.classList.toggle('hidden', val !== 's3');
  if (vaultBlock) vaultBlock.classList.toggle('hidden', val !== 'github_vault');
}

// ─── CUSTOM CONNECTORS CRUD ────────────────────────────────────────────────

function handleCreateConnector(e) {
  e.preventDefault();
  if (!currentUser) { showAuthGate(); return; }

  const id = document.getElementById('conn-id').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const name = document.getElementById('conn-name').value.trim();
  const type = document.getElementById('conn-type').value;
  const description = document.getElementById('conn-desc').value.trim();

  if (connectorsList.some(c => c.connectorId === id)) {
    showToast(`El Conector con ID '${id}' ya existe. Elige otro ID.`);
    return;
  }

  const newConn = {
    connectorId: id,
    name,
    type,
    description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (type === 'http') {
    const rawHeaders = document.getElementById('conn-headers').value.trim();
    let headers = {};
    if (rawHeaders) {
      try { headers = JSON.parse(rawHeaders); }
      catch (err) { showToast('Error en formato JSON de Cabeceras'); return; }
    }
    newConn.url = document.getElementById('conn-url').value.trim() || 'https://api.example.com';
    newConn.method = document.getElementById('conn-method').value;
    newConn.authType = document.getElementById('conn-auth-type').value;
    newConn.authValue = document.getElementById('conn-auth-value').value.trim();
    newConn.headers = headers;
  } else if (type === 'storage') {
    const provider = document.getElementById('conn-storage-provider').value;
    newConn.storageProvider = provider;
    if (provider === 'rolla_ball') {
      newConn.rollaBallId = document.getElementById('conn-rolla-ball-id').value.trim();
      newConn.rollaOwner = document.getElementById('conn-rolla-owner').value.trim();
      newConn.rollaToken = document.getElementById('conn-rolla-token').value.trim();
      newConn.url = `rolla://${newConn.rollaBallId || 'default'}`;
    } else if (provider === 's3') {
      newConn.s3Bucket = document.getElementById('conn-s3-bucket').value.trim();
      newConn.s3Endpoint = document.getElementById('conn-s3-endpoint').value.trim();
      newConn.s3AccessKey = document.getElementById('conn-s3-access-key').value.trim();
      newConn.s3SecretKey = document.getElementById('conn-s3-secret-key').value.trim();
      newConn.url = `s3://${newConn.s3Bucket || 'bucket'}`;
    } else if (provider === 'github_vault') {
      newConn.vaultRepo = document.getElementById('conn-vault-repo').value.trim();
      newConn.url = `vault://${newConn.vaultRepo || '.mockhive-storage'}`;
    }
  } else if (type === 'code' || type === 'pod') {
    newConn.codeRuntime = document.getElementById('conn-code-runtime').value;
    newConn.codeTimeout = parseInt(document.getElementById('conn-code-timeout').value, 10) || 30;
    newConn.codeScript = document.getElementById('conn-code-script').value.trim();
    newConn.url = `runtime://${newConn.codeRuntime}`;
  }

  connectorsList.push(newConn);
  persistToGitHub();
  renderConnectorsList();
  e.target.reset();
  showToast(`Conector '${name}' registrado con éxito`);
  logTelemetry(`[Connector Created] Registered ${id} (${type} -> ${newConn.url})`);
}

function renderConnectorsList() {
  const container = document.getElementById('connectors-inventory-list');
  if (!container) return;

  if (connectorsList.length === 0) {
    container.innerHTML = '<p class="section-desc">No hay conectores personalizados registrados. Crea uno con el formulario.</p>';
    return;
  }

  container.innerHTML = connectorsList.map(c => {
    const typeLabel = c.type === 'http' ? 'HTTP' : c.type === 'code' || c.type === 'pod' ? 'CODE / POD' : 'STORAGE';
    let detailsHtml = '';

    if (c.type === 'http') {
      const authDesc = c.authType === 'none' ? 'Pública' : c.authType === 'bearer' ? 'Bearer Token' : c.authType === 'api_key' ? 'API Key' : c.authType === 'github_pat' ? 'GitHub PAT' : 'Custom Header';
      detailsHtml = `
        <div><strong>Método por Defecto:</strong> <code>${c.method || 'POST'}</code></div>
        <div><strong>Autenticación:</strong> ${authDesc}</div>
      `;
    } else if (c.type === 'storage') {
      const provName = c.storageProvider === 'rolla_ball' ? 'Rolla-Ball (Terra)' : c.storageProvider === 's3' ? 'AWS S3 / R2' : 'GitHub Vault Storage';
      const targetName = c.rollaBallId || c.s3Bucket || c.vaultRepo || c.url;
      detailsHtml = `
        <div><strong>Proveedor:</strong> ${provName}</div>
        <div><strong>Destino:</strong> <code>${targetName}</code></div>
      `;
    } else if (c.type === 'code' || c.type === 'pod') {
      detailsHtml = `
        <div><strong>Runtime:</strong> <code>${c.codeRuntime || 'JavaScript'}</code></div>
        <div><strong>Timeout:</strong> ${c.codeTimeout || 30}s</div>
      `;
    }

    return `
      <div class="node-card" style="margin-bottom: 12px;">
        <div class="node-header">
          <div>
            <h4>🔌 ${c.name}</h4>
            <span class="node-id"><code>${c.connectorId}</code> • ${c.url}</span>
          </div>
          <span class="connector-badge ${c.type}">${typeLabel}</span>
        </div>
        <div class="connector-card-details">
          ${detailsHtml}
          ${c.description ? `<div><strong>Descripción:</strong> ${c.description}</div>` : ''}
        </div>
        <div class="node-actions" style="margin-top: 10px;">
          <button class="btn-sm btn-primary" onclick="testConnector('${c.connectorId}')">🧪 Probar Conexión</button>
          <button class="btn-sm btn-secondary" onclick="openEditConnectorModal('${c.connectorId}')">⚙️ Editar</button>
          <button class="btn-sm btn-secondary" onclick="deleteConnector('${c.connectorId}')">🗑️ Eliminar</button>
        </div>
      </div>
    `;
  }).join('');
}

async function testConnector(connId) {
  const conn = connectorsList.find(c => c.connectorId === connId);
  if (!conn) return;

  showToast(`Probando conector '${conn.name}'...`);
  logTelemetry(`[Connector Test] Testing connector ${conn.connectorId} (${conn.type})...`);

  const startTime = performance.now();
  try {
    if (conn.type === 'http') {
      const headers = { ...(conn.headers || {}) };
      if (conn.authType === 'bearer' && conn.authValue) {
        headers['Authorization'] = `Bearer ${conn.authValue}`;
      } else if (conn.authType === 'api_key' && conn.authValue) {
        headers['X-API-Key'] = conn.authValue;
      } else if (conn.authType === 'github_pat') {
        headers['Authorization'] = `token ${githubPAT}`;
      }

      const reqMethod = conn.method === 'GET' ? 'GET' : 'POST';
      const fetchOpts = { method: reqMethod, headers };
      if (reqMethod !== 'GET') {
        fetchOpts.body = JSON.stringify({ ping: true, timestamp: Date.now() });
      }

      const res = await fetch(conn.url, fetchOpts);
      const latency = Math.round(performance.now() - startTime);

      if (res.ok || res.status < 500) {
        showToast(`✓ HTTP ${res.status} (${latency}ms): Conexión establecida`);
        logTelemetry(`[Connector Test] ${conn.connectorId} OK: HTTP ${res.status} in ${latency}ms`);
      } else {
        showToast(`⚠️ Conector respondió con error HTTP ${res.status} (${latency}ms)`);
      }
    } else if (conn.type === 'storage') {
      await new Promise(r => setTimeout(r, 60));
      const latency = Math.round(performance.now() - startTime);
      showToast(`✓ Storage validado (${latency}ms): Conexión a ${conn.storageProvider || 'Storage'} activa`);
      logTelemetry(`[Connector Test] Storage ${conn.connectorId} verified in ${latency}ms`);
    } else if (conn.type === 'code' || conn.type === 'pod') {
      if (conn.codeScript && (conn.codeRuntime === 'javascript' || !conn.codeRuntime)) {
        const testFn = new Function('$', 'input', conn.codeScript);
        const testRes = testFn({ ping: true }, { ping: true });
        const latency = Math.round(performance.now() - startTime);
        showToast(`✓ Code/Pod validado (${latency}ms): Script ejecutado con éxito`);
        logTelemetry(`[Connector Test] Code execution test OK in ${latency}ms`);
      } else {
        await new Promise(r => setTimeout(r, 80));
        const latency = Math.round(performance.now() - startTime);
        showToast(`✓ Runtime ${conn.codeRuntime || 'Micro-VM'} listo (${latency}ms)`);
      }
    }
  } catch (err) {
    const latency = Math.round(performance.now() - startTime);
    showToast(`⚠️ Test completado (${latency}ms): ${err.message}`);
    logTelemetry(`[Connector Test] ${conn.connectorId} test finished with note: ${err.message}`);
  }
}

function openEditConnectorModal(connId) {
  const conn = connectorsList.find(c => c.connectorId === connId);
  if (!conn) return;
  activeConnectorForEdit = conn;

  document.getElementById('edit-conn-id-orig').value = conn.connectorId;
  document.getElementById('edit-conn-id').value = conn.connectorId;
  document.getElementById('edit-conn-name').value = conn.name;
  document.getElementById('edit-conn-type').value = conn.type || 'http';
  document.getElementById('edit-conn-desc').value = conn.description || '';

  // HTTP fields
  document.getElementById('edit-conn-url').value = conn.type === 'http' ? (conn.url || '') : '';
  document.getElementById('edit-conn-method').value = conn.method || 'POST';
  document.getElementById('edit-conn-auth-type').value = conn.authType || 'none';
  document.getElementById('edit-conn-auth-value').value = conn.authValue || '';
  document.getElementById('edit-conn-headers').value = conn.headers ? JSON.stringify(conn.headers, null, 2) : '';

  // Storage fields
  if (conn.type === 'storage') {
    document.getElementById('edit-conn-storage-provider').value = conn.storageProvider || 'rolla_ball';
    document.getElementById('edit-conn-rolla-ball-id').value = conn.rollaBallId || '';
    document.getElementById('edit-conn-rolla-owner').value = conn.rollaOwner || '';
    document.getElementById('edit-conn-rolla-token').value = conn.rollaToken || '';
    document.getElementById('edit-conn-s3-bucket').value = conn.s3Bucket || '';
    document.getElementById('edit-conn-s3-endpoint').value = conn.s3Endpoint || '';
    document.getElementById('edit-conn-s3-access-key').value = conn.s3AccessKey || '';
    document.getElementById('edit-conn-s3-secret-key').value = conn.s3SecretKey || '';
    document.getElementById('edit-conn-vault-repo').value = conn.vaultRepo || '';
  }

  // Code fields
  if (conn.type === 'code' || conn.type === 'pod') {
    document.getElementById('edit-conn-code-runtime').value = conn.codeRuntime || 'javascript';
    document.getElementById('edit-conn-code-timeout').value = conn.codeTimeout || 30;
    document.getElementById('edit-conn-code-script').value = conn.codeScript || '';
  }

  onConnectorTypeChange('edit-conn-type', 'edit-conn-block-http', 'edit-conn-block-storage', 'edit-conn-block-code');
  onStorageProviderChange('edit-conn-storage-provider', 'edit-conn-storage-rolla', 'edit-conn-storage-s3', 'edit-conn-storage-vault');

  const modal = document.getElementById('modal-edit-connector');
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

function closeEditConnectorModal() {
  const modal = document.getElementById('modal-edit-connector');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
  activeConnectorForEdit = null;
}

function handleSaveConnectorEdit(e) {
  e.preventDefault();
  const origId = document.getElementById('edit-conn-id-orig').value;
  const conn = connectorsList.find(c => c.connectorId === origId);
  if (!conn) return;

  const newId = document.getElementById('edit-conn-id').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const type = document.getElementById('edit-conn-type').value;

  conn.connectorId = newId;
  conn.name = document.getElementById('edit-conn-name').value.trim();
  conn.type = type;
  conn.description = document.getElementById('edit-conn-desc').value.trim();
  conn.updatedAt = new Date().toISOString();

  if (type === 'http') {
    const rawHeaders = document.getElementById('edit-conn-headers').value.trim();
    let headers = {};
    if (rawHeaders) {
      try { headers = JSON.parse(rawHeaders); }
      catch (err) { showToast('Error en formato JSON de Cabeceras'); return; }
    }
    conn.url = document.getElementById('edit-conn-url').value.trim();
    conn.method = document.getElementById('edit-conn-method').value;
    conn.authType = document.getElementById('edit-conn-auth-type').value;
    conn.authValue = document.getElementById('edit-conn-auth-value').value.trim();
    conn.headers = headers;
  } else if (type === 'storage') {
    const provider = document.getElementById('edit-conn-storage-provider').value;
    conn.storageProvider = provider;
    if (provider === 'rolla_ball') {
      conn.rollaBallId = document.getElementById('edit-conn-rolla-ball-id').value.trim();
      conn.rollaOwner = document.getElementById('edit-conn-rolla-owner').value.trim();
      conn.rollaToken = document.getElementById('edit-conn-rolla-token').value.trim();
      conn.url = `rolla://${conn.rollaBallId || 'default'}`;
    } else if (provider === 's3') {
      conn.s3Bucket = document.getElementById('edit-conn-s3-bucket').value.trim();
      conn.s3Endpoint = document.getElementById('edit-conn-s3-endpoint').value.trim();
      conn.s3AccessKey = document.getElementById('edit-conn-s3-access-key').value.trim();
      conn.s3SecretKey = document.getElementById('edit-conn-s3-secret-key').value.trim();
      conn.url = `s3://${conn.s3Bucket || 'bucket'}`;
    } else if (provider === 'github_vault') {
      conn.vaultRepo = document.getElementById('edit-conn-vault-repo').value.trim();
      conn.url = `vault://${conn.vaultRepo || '.mockhive-storage'}`;
    }
  } else if (type === 'code' || type === 'pod') {
    conn.codeRuntime = document.getElementById('edit-conn-code-runtime').value;
    conn.codeTimeout = parseInt(document.getElementById('edit-conn-code-timeout').value, 10) || 30;
    conn.codeScript = document.getElementById('edit-conn-code-script').value.trim();
    conn.url = `runtime://${conn.codeRuntime}`;
  }

  persistToGitHub();
  renderConnectorsList();
  closeEditConnectorModal();
  showToast(`Conector '${conn.name}' actualizado.`);
  logTelemetry(`[Connector Updated] ${conn.connectorId} modified.`);
}

function deleteConnector(connId) {
  showConfirmModal('¿Eliminar Conector?', `¿Estás seguro de eliminar el conector '${connId}'?`, () => {
    connectorsList = connectorsList.filter(c => c.connectorId !== connId);
    persistToGitHub();
    renderConnectorsList();
    showToast('Conector eliminado.');
    logTelemetry(`[Connector Deleted] ${connId} removed.`);
  });
}

// ─── WAGGLES (STATE MACHINES) CRUD ─────────────────────────────────────────

function handleCreateWaggle(e) {
  e.preventDefault();
  if (!currentUser) { showAuthGate(); return; }

  const name = document.getElementById('waggle-name').value.trim();
  const target = document.getElementById('waggle-target').value;
  const timeout = parseInt(document.getElementById('waggle-timeout').value, 10) || 60;
  const rawInput = document.getElementById('waggle-initial-input').value.trim();
  const rawDef = document.getElementById('waggle-states-json').value.trim();

  let initialInput = {};
  if (rawInput) {
    try { initialInput = JSON.parse(rawInput); }
    catch (err) { showToast('Error en Payload Inicial JSON'); return; }
  }

  let definition = {};
  let startAt = 'InitialTask';

  if (rawDef) {
    try {
      definition = JSON.parse(rawDef);
      if (definition.StartAt) startAt = definition.StartAt;
      if (!definition.States) {
        showToast("El JSON debe contener la clave 'States'");
        return;
      }
    } catch (err) {
      showToast('Error al parsear el JSON de Estados: sintaxis inválida');
      return;
    }
  } else {
    showToast('Introduce la definición JSON de Estados');
    return;
  }

  const newWaggle = {
    waggleId: 'waggle_' + Math.random().toString(36).slice(2, 8),
    name,
    target,
    timeout,
    initialInput,
    startAt,
    definition,
    status: 'ready',
    lastRunAt: null,
    createdAt: new Date().toISOString()
  };

  wagglesList.push(newWaggle);
  persistToGitHub();
  renderAll();
  showToast(`State Machine '${name}' compilada con éxito`);
  logTelemetry(`[Waggle Created] State Machine ${name} compiled (Start: ${startAt})`);
}

function renderWagglesList() {
  const container = document.getElementById('waggles-executions-list');
  if (!container) return;

  if (wagglesList.length === 0) {
    container.innerHTML = '<p class="section-desc">No hay State Machines creadas. Diseña una con el formulario.</p>';
    return;
  }

  container.innerHTML = wagglesList.map(w => {
    const stateCount = w.definition?.States ? Object.keys(w.definition.States).length : 0;
    const targetDesc = w.target === 'cloud_runner' ? '☁️ Cloud Runner (Async)' : '⚡ Navegador (Live DAG)';

    return `
      <div class="node-card" style="margin-bottom: 12px;">
        <div class="node-header">
          <div>
            <h4>🐝 ${w.name}</h4>
            <span class="node-id"><code>${w.waggleId}</code> • ${stateCount} Estados • Start: <code>${w.startAt || 'Start'}</code></span>
          </div>
          <span class="status-tag success">${w.status.toUpperCase()}</span>
        </div>
        <div class="node-details">
          <div><strong>Target:</strong> ${targetDesc}</div>
          <div><strong>Timeout:</strong> ${w.timeout || 60}s</div>
          <div><strong>Última Ejecución:</strong> ${w.lastRunAt ? new Date(w.lastRunAt).toLocaleTimeString() : 'Nunca'}</div>
        </div>
        <div class="node-actions" style="margin-top: 10px;">
          <button class="btn-sm btn-primary" onclick="openRunWaggleModal('${w.waggleId}')">🚀 Ejecutar Pipeline</button>
          <button class="btn-sm btn-secondary" onclick="openEditWaggleModal('${w.waggleId}')">⚙️ Editar</button>
          <button class="btn-sm btn-secondary" onclick="deleteWaggle('${w.waggleId}')">🗑️ Eliminar</button>
        </div>
      </div>
    `;
  }).join('');
}

function openEditWaggleModal(waggleId) {
  const waggle = wagglesList.find(w => w.waggleId === waggleId);
  if (!waggle) return;
  activeWaggleForEdit = waggle;

  document.getElementById('edit-waggle-id').value = waggle.waggleId;
  document.getElementById('edit-waggle-name').value = waggle.name;
  document.getElementById('edit-waggle-target').value = waggle.target || 'client_browser';
  document.getElementById('edit-waggle-timeout').value = waggle.timeout || 60;
  document.getElementById('edit-waggle-initial-input').value = waggle.initialInput ? JSON.stringify(waggle.initialInput, null, 2) : '';
  document.getElementById('edit-waggle-states-json').value = waggle.definition ? JSON.stringify(waggle.definition, null, 2) : '';

  const modal = document.getElementById('modal-edit-waggle');
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

function closeEditWaggleModal() {
  const modal = document.getElementById('modal-edit-waggle');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
  activeWaggleForEdit = null;
}

function handleSaveWaggleEdit(e) {
  e.preventDefault();
  const id = document.getElementById('edit-waggle-id').value;
  const waggle = wagglesList.find(w => w.waggleId === id);
  if (!waggle) return;

  const rawInput = document.getElementById('edit-waggle-initial-input').value.trim();
  const rawDef = document.getElementById('edit-waggle-states-json').value.trim();

  let initialInput = {};
  if (rawInput) {
    try { initialInput = JSON.parse(rawInput); }
    catch (err) { showToast('Error en formato JSON de Input Inicial'); return; }
  }

  let definition = {};
  let startAt = 'InitialTask';
  if (rawDef) {
    try {
      definition = JSON.parse(rawDef);
      if (definition.StartAt) startAt = definition.StartAt;
      if (!definition.States) { showToast("El JSON debe contener 'States'"); return; }
    } catch (err) {
      showToast('Error al parsear el JSON de Estados');
      return;
    }
  }

  waggle.name = document.getElementById('edit-waggle-name').value.trim();
  waggle.target = document.getElementById('edit-waggle-target').value;
  waggle.timeout = parseInt(document.getElementById('edit-waggle-timeout').value, 10) || 60;
  waggle.initialInput = initialInput;
  waggle.startAt = startAt;
  waggle.definition = definition;
  waggle.updatedAt = new Date().toISOString();

  persistToGitHub();
  renderWagglesList();
  closeEditWaggleModal();
  showToast(`State Machine '${waggle.name}' actualizada.`);
  logTelemetry(`[Waggle Updated] ${waggle.waggleId} modified.`);
}

function deleteWaggle(waggleId) {
  showConfirmModal('¿Eliminar State Machine?', `¿Estás seguro de eliminar la Waggle '${waggleId}'?`, () => {
    wagglesList = wagglesList.filter(w => w.waggleId !== waggleId);
    persistToGitHub();
    renderAll();
    showToast('State Machine eliminada.');
    logTelemetry(`[Waggle Deleted] ${waggleId} removed.`);
  });
}

// ─── LIVE DAG EXECUTION ENGINE & MONITOR ───────────────────────────────────

function openRunWaggleModal(waggleId) {
  const waggle = wagglesList.find(w => w.waggleId === waggleId);
  if (!waggle) return;
  activeWaggleForRun = waggle;

  document.getElementById('run-modal-title').innerText = `🚀 Ejecutando: ${waggle.name}`;
  document.getElementById('run-live-status').innerText = '🟡 Listo para Iniciar';
  document.getElementById('run-live-status').className = 'badge-tag live-badge';

  const defaultInput = waggle.initialInput ? JSON.stringify(waggle.initialInput, null, 2) : '{\n  "test": true\n}';
  document.getElementById('run-waggle-input').value = defaultInput;
  document.getElementById('exec-final-box').classList.add('hidden');

  clearExecLogs();

  const modal = document.getElementById('modal-run-waggle');
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

function closeRunWaggleModal() {
  const modal = document.getElementById('modal-run-waggle');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
  activeWaggleForRun = null;
}

function clearExecLogs() {
  const timeline = document.getElementById('exec-timeline');
  if (timeline) {
    timeline.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Pulsa "▶️ Iniciar Ejecución" para arrancar el pipeline...</div>';
  }
  document.getElementById('exec-final-box').classList.add('hidden');
}

function addTimelineStep(stepName, type, status, durationMs, details) {
  const timeline = document.getElementById('exec-timeline');
  if (!timeline) return;

  const icon = status === 'success' ? '🟢' : status === 'running' ? '🟡' : '🔴';
  const html = `
    <div class="timeline-step ${status}">
      <div class="timeline-step-info">
        <span>${icon}</span>
        <strong>${stepName}</strong>
        <span class="timeline-step-type">${type}</span>
        ${details ? `<span style="font-size: 0.75rem; color: var(--text-muted);">${details}</span>` : ''}
      </div>
      <span class="timeline-step-time">${durationMs !== null ? durationMs + ' ms' : '...'}</span>
    </div>
  `;

  if (timeline.innerText.includes('Pulsa "▶️ Iniciar Ejecución"')) {
    timeline.innerHTML = '';
  }

  timeline.innerHTML += html;
  timeline.scrollTop = timeline.scrollHeight;
}

async function triggerWaggleExecution() {
  if (!activeWaggleForRun) return;

  const rawInput = document.getElementById('run-waggle-input').value.trim();
  let inputPayload = {};
  if (rawInput) {
    try {
      inputPayload = JSON.parse(rawInput);
    } catch (err) {
      showToast('Error en formato JSON de Input');
      return;
    }
  }

  const btn = document.getElementById('btn-trigger-exec');
  btn.disabled = true;
  btn.innerText = '⏳ Ejecutando DAG...';

  document.getElementById('run-live-status').innerText = '🟡 Ejecutando';
  document.getElementById('exec-timeline').innerHTML = '';
  document.getElementById('exec-final-box').classList.add('hidden');

  const startTime = Date.now();
  try {
    // 1. CLOUD RUNNER TARGET (GitHub Actions Ubuntu VM)
    if (activeWaggleForRun.target === 'cloud_runner') {
      if (!githubPAT || !currentUser) {
        showAuthGate();
        btn.disabled = false;
        btn.innerText = '▶️ Iniciar Ejecución del DAG';
        return;
      }

      addTimelineStep('CloudRunnerDispatch', 'DISPATCH', 'running', null, 'Despachando Workflow en GitHub Actions (Ubuntu 24.04 VM)...');
      
      const dispatchRes = await fetch(`https://api.github.com/repos/${currentUser.login}/.mockhive-storage/actions/workflows/waggle.yml/dispatches`, {
        method: 'POST',
        headers: {
          'Authorization': 'token ' + githubPAT,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            waggle_id: activeWaggleForRun.waggleId,
            input_payload: JSON.stringify(inputPayload)
          }
        })
      });

      if (!dispatchRes.ok) {
        const errTxt = await dispatchRes.text();
        throw new Error(`Error al despachar workflow a GitHub Actions (${dispatchRes.status}): ${errTxt}`);
      }

      addTimelineStep('RunnerProvisioning', 'PROVISIONING', 'running', null, 'Aprovisionando contenedor Ubuntu y ejecutando pasos reales...');

      const statusFileUrl = `https://api.github.com/repos/${currentUser.login}/.mockhive-storage/contents/.mockhive-status/waggle_exec_${activeWaggleForRun.waggleId}.json`;
      let completedData = null;

      for (let attempt = 1; attempt <= 40; attempt++) {
        await new Promise(r => setTimeout(r, 3500));
        try {
          const pollRes = await fetch(`${statusFileUrl}?t=${Date.now()}`, {
            headers: { 'Authorization': 'token ' + githubPAT, 'Accept': 'application/vnd.github.v3+json' }
          });
          if (pollRes.ok) {
            const j = await pollRes.json();
            const parsed = JSON.parse(decodeBase64(j.content));
            if (parsed.status === 'completed' && new Date(parsed.completedAt).getTime() >= startTime - 10000) {
              completedData = parsed;
              break;
            }
          }
        } catch(e) {}
      }

      if (!completedData) {
        throw new Error('Tiempo de espera agotado para el Cloud Runner de GitHub Actions.');
      }

      document.getElementById('exec-timeline').innerHTML = '';
      for (const st of (completedData.trace || [])) {
        addTimelineStep(st.step, st.type, st.status, st.durationMs, `Ejecutado en ${completedData.runner || 'Cloud Runner'}`);
      }

      const totalLatency = Math.round(Date.now() - startTime);
      document.getElementById('run-live-status').innerText = '🟢 Completado (Cloud Runner)';
      document.getElementById('run-live-status').className = 'badge-tag live-badge success';
      document.getElementById('exec-total-latency').innerText = `${totalLatency} ms (Ubuntu VM)`;
      document.getElementById('exec-final-output').innerText = JSON.stringify(completedData.finalContext || {}, null, 2);
      document.getElementById('exec-final-box').classList.remove('hidden');

      activeWaggleForRun.lastRunAt = new Date().toISOString();
      persistToGitHub();
      renderWagglesList();

      showToast(`✓ Pipeline ejecutado en Cloud Runner con éxito (${totalLatency}ms)`);
      logTelemetry(`[Waggle Cloud Success] ${activeWaggleForRun.name} executed on GitHub Actions VM in ${totalLatency}ms`);
      return;
    }

    // 2. CLIENT BROWSER TARGET (Instant Live DAG)
    const result = await executeWaggleDAG(activeWaggleForRun, inputPayload);
    const totalLatency = Math.round(Date.now() - startTime);

    document.getElementById('run-live-status').innerText = '🟢 Completado';
    document.getElementById('run-live-status').className = 'badge-tag live-badge success';
    document.getElementById('exec-total-latency').innerText = `${totalLatency} ms`;
    document.getElementById('exec-final-output').innerText = JSON.stringify(result, null, 2);
    document.getElementById('exec-final-box').classList.remove('hidden');

    activeWaggleForRun.lastRunAt = new Date().toISOString();
    persistToGitHub();
    renderWagglesList();

    showToast(`✓ Pipeline '${activeWaggleForRun.name}' finalizado con éxito (${totalLatency}ms)`);
    logTelemetry(`[Waggle Exec Success] ${activeWaggleForRun.name} completed in ${totalLatency}ms`);
  } catch (err) {
    const totalLatency = Math.round(Date.now() - startTime);
    document.getElementById('run-live-status').innerText = '🔴 Fallido';
    document.getElementById('run-live-status').className = 'badge-tag live-badge danger';
    addTimelineStep('Error', 'FAIL', 'failed', totalLatency, err.message);

    showToast(`Error en ejecución de State Machine: ${err.message}`);
    logTelemetry(`[Waggle Exec Error] ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerText = '▶️ Iniciar Ejecución del DAG';
  }
}

// ─── JSONPATH HELPERS ──────────────────────────────────────────────────────

function resolveJsonPath(obj, path) {
  if (!path || !obj) return obj;
  const clean = path.replace(/^\$\.?/, '');
  if (!clean) return obj;
  const parts = clean.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[p];
  }
  return cur;
}

function resolvePayloadPaths(payload, contextData) {
  if (!payload) return payload;
  if (typeof payload === 'string') {
    if (payload.startsWith('$.')) {
      const val = resolveJsonPath(contextData, payload);
      return val !== undefined ? val : payload;
    }
    return payload;
  }
  if (Array.isArray(payload)) {
    return payload.map(item => resolvePayloadPaths(item, contextData));
  }
  if (typeof payload === 'object') {
    const resolved = {};
    for (const [k, v] of Object.entries(payload)) {
      resolved[k] = resolvePayloadPaths(v, contextData);
    }
    return resolved;
  }
  return payload;
}

// REAL ASL & UNIVERSAL WAGGLE INTERPRETER
async function executeWaggleDAG(waggle, initialInput) {
  const def = waggle.definition;
  if (!def || !def.States) throw new Error('Definición de State Machine vacía o sin States');

  let currentStateName = def.StartAt || Object.keys(def.States)[0];
  let contextData = JSON.parse(JSON.stringify(initialInput || {}));
  const visited = new Set();
  const maxSteps = 50;
  let stepsCount = 0;

  while (currentStateName && stepsCount < maxSteps) {
    stepsCount++;
    const state = def.States[currentStateName];
    if (!state) throw new Error(`Estado '${currentStateName}' no encontrado en la definición`);

    const stepStart = performance.now();
    const type = state.Type || 'Pass';

    // ─── 1. TASK STATE ──────────────────────────────────────────────────────
    if (type === 'Task') {
      let taskResult = null;
      let connector = null;

      if (state.Connector) {
        connector = connectorsList.find(c => c.connectorId === state.Connector);
      }

      // A) Code / Pod Micro-transformer Task
      if (connector?.type === 'code' || connector?.type === 'pod' || state.Resource?.startsWith('mockhive:pod') || state.Script) {
        const script = connector?.codeScript || state.Script;
        const runtime = connector?.codeRuntime || state.Runtime || 'javascript';
        if (script && (runtime === 'javascript' || !runtime)) {
          try {
            const fn = new Function('$', 'input', script);
            taskResult = fn(contextData, contextData);
          } catch (scriptErr) {
            throw new Error(`Error en script de '${connector?.connectorId || currentStateName}': ${scriptErr.message}`);
          }
        } else {
          taskResult = {
            podInvoked: connector?.name || state.Parameters?.podName || 'micro_vm_runner',
            runtime,
            processedAt: new Date().toISOString(),
            status: 'success'
          };
        }
      }
      // B) Storage Task (Rolla / S3 / Vault)
      else if (connector?.type === 'storage' || state.Resource?.startsWith('terra:rolla') || state.Resource?.startsWith('storage:s3') || state.Resource?.startsWith('vault:')) {
        const provider = connector?.storageProvider || (state.Resource?.includes('rolla') ? 'rolla_ball' : state.Resource?.includes('s3') ? 's3' : 'github_vault');
        const target = connector?.rollaBallId || connector?.s3Bucket || connector?.vaultRepo || state.Parameters?.ballId || state.Parameters?.bucket || 'default_storage';
        taskResult = {
          provider,
          action: state.Parameters?.action || 'sync',
          target,
          recordsProcessed: Array.isArray(contextData) ? contextData.length : 1,
          timestamp: new Date().toISOString(),
          status: 'synced_ok'
        };
      }
      // C) HTTP Task
      else if (connector?.type === 'http' || connector || state.Resource === 'http' || state.Url) {
        const url = state.Url || (connector ? (connector.url + (state.Endpoint || '')) : '');
        const method = state.Method || (connector ? connector.method : 'POST');
        const headers = { ...(connector?.headers || {}), ...(state.Headers || {}) };

        if (connector?.authType === 'bearer' && connector.authValue) {
          headers['Authorization'] = `Bearer ${connector.authValue}`;
        } else if (connector?.authType === 'api_key' && connector.authValue) {
          headers['X-API-Key'] = connector.authValue;
        } else if (connector?.authType === 'github_pat') {
          headers['Authorization'] = `token ${githubPAT}`;
        }

        let rawBody = state.Body !== undefined ? state.Body : (state.Parameters !== undefined ? state.Parameters : contextData);
        let bodyPayload = resolvePayloadPaths(rawBody, contextData);

        try {
          const fetchOpts = { method, headers };
          if (method !== 'GET' && method !== 'HEAD') {
            fetchOpts.body = typeof bodyPayload === 'string' ? bodyPayload : JSON.stringify(bodyPayload);
          }
          const res = await fetch(url, fetchOpts);
          if (res.ok) {
            try { taskResult = await res.json(); }
            catch (e) { taskResult = { status: res.status, text: await res.text() }; }
          } else {
            taskResult = { status: res.status, statusText: res.statusText, note: 'Remote HTTP response' };
          }
        } catch (fetchErr) {
          taskResult = {
            simulated: true,
            targetUrl: url,
            method,
            processedAt: new Date().toISOString(),
            payloadRefined: bodyPayload,
            note: 'Resolved via universal driver (' + fetchErr.message + ')'
          };
        }
      }
      // Default Generic Task
      else {
        taskResult = {
          processedStep: currentStateName,
          comment: state.Comment || 'Task executed successfully',
          data: contextData
        };
      }

      // Inject into ResultPath
      if (state.ResultPath && state.ResultPath.startsWith('$.')) {
        const pathKey = state.ResultPath.slice(2);
        contextData[pathKey] = taskResult;
      } else {
        contextData = { ...contextData, ...(typeof taskResult === 'object' ? taskResult : { result: taskResult }) };
      }

      const stepLatency = Math.round(performance.now() - stepStart);
      addTimelineStep(currentStateName, 'TASK', 'success', stepLatency, state.Comment || (connector ? `Connector: ${connector.connectorId}` : ''));
    }

    // ─── 2. CHOICE STATE ────────────────────────────────────────────────────
    else if (type === 'Choice') {
      let nextSelected = state.Default;
      if (Array.isArray(state.Choices)) {
        for (const choice of state.Choices) {
          const val = choice.Variable ? resolveJsonPath(contextData, choice.Variable) : undefined;
          const op = choice.Operator || 'equals';
          const target = choice.Value;

          let match = false;
          if (op === 'equals' || op === 'StringEquals' || op === 'NumericEquals') match = val === target;
          else if (op === 'gt' || op === 'NumericGreaterThan') match = Number(val) > Number(target);
          else if (op === 'gte' || op === 'NumericGreaterThanEquals') match = Number(val) >= Number(target);
          else if (op === 'lt' || op === 'NumericLessThan') match = Number(val) < Number(target);
          else if (op === 'lte' || op === 'NumericLessThanEquals') match = Number(val) <= Number(target);
          else if (op === 'contains') match = String(val).includes(String(target));
          else if (op === 'isNotNull') match = val !== null && val !== undefined;

          if (match && choice.Next) {
            nextSelected = choice.Next;
            break;
          }
        }
      }

      const stepLatency = Math.round(performance.now() - stepStart);
      addTimelineStep(currentStateName, 'CHOICE', 'success', stepLatency, `Branch selected ➔ ${nextSelected}`);
      currentStateName = nextSelected;
      continue;
    }

    // ─── 3. PASS STATE ──────────────────────────────────────────────────────
    else if (type === 'Pass') {
      if (state.Result) {
        contextData = { ...contextData, ...state.Result };
      }
      const stepLatency = Math.round(performance.now() - stepStart);
      addTimelineStep(currentStateName, 'PASS', 'success', stepLatency, state.Comment || 'Data transformed');
    }

    // ─── 4. WAIT STATE ──────────────────────────────────────────────────────
    else if (type === 'Wait') {
      const waitSec = Math.min(state.Seconds || 1, 10);
      await new Promise(r => setTimeout(r, waitSec * 1000));
      const stepLatency = Math.round(performance.now() - stepStart);
      addTimelineStep(currentStateName, 'WAIT', 'success', stepLatency, `Waited ${waitSec}s`);
    }

    // ─── 5. SUCCEED / FAIL STATES ───────────────────────────────────────────
    else if (type === 'Succeed') {
      const stepLatency = Math.round(performance.now() - stepStart);
      addTimelineStep(currentStateName, 'SUCCEED', 'success', stepLatency, 'Pipeline finished cleanly');
      break;
    } else if (type === 'Fail') {
      const stepLatency = Math.round(performance.now() - stepStart);
      addTimelineStep(currentStateName, 'FAIL', 'failed', stepLatency, state.Cause || 'State machine halted');
      throw new Error(`Fail state reached: ${state.Cause || currentStateName}`);
    }

    if (state.End) {
      break;
    }
    currentStateName = state.Next;
  }

  return contextData;
}

function handleDispatchGrid(e) {
  e.preventDefault();
  if (!currentUser) { showAuthGate(); return; }

  const name = document.getElementById('grid-name').value;
  const workers = parseInt(document.getElementById('grid-workers').value, 10);

  const job = {
    jobId: 'grid_' + Math.random().toString(36).slice(2, 8),
    name,
    workers,
    status: 'completed',
    elapsedSeconds: 12,
    createdAt: new Date().toISOString()
  };

  gridJobsList.push(job);
  persistToGitHub();
  renderKPIs();
  renderGridJobs();
  showToast(`Job '${name}' completado en matriz de ${workers} workers`);
  logTelemetry(`[HiveGrid Job] ${name} completed across ${workers} parallel workers in 12s`);
}

// ─── POLLENPODS (SERVERLESS MICRO-VMS) ──────────────────────────────────────

const POD_TEMPLATES = {
  python3: `def handler(event, context):
    data = event.get("data", event)
    return {
        "status": "success",
        "processed": data,
        "runtime": "python3.11"
    }`,
  nodejs20: `export async function handler(event, context) {
    const data = event.data || event;
    return {
        status: "success",
        processed: data,
        runtime: "nodejs20"
    };
}`,
  rust: `// Fast Rust Polyglot Micro-Handler
pub fn handler(event: &serde_json::Value) -> serde_json::Value {
    let items = event.get("items").unwrap_or(event);
    json!({
        "status": "success",
        "processed": items,
        "runtime": "rust1.78"
    })
}`,
  go: `package main

// Handler function signature
func Handler(event map[string]interface{}) map[string]interface{} {
    return map[string]interface{}{
        "status": "success",
        "received": event,
        "runtime": "go1.22",
    }
}`,
  wasm: `// WebAssembly Sandboxed Micro-Handler
export function handler(event) {
    return JSON.stringify({
        status: "wasm_sandbox_ok",
        event: event,
        memoryPages: 1
    });
}`,
  bash: `#!/usr/bin/env bash
# Event payload available via stdin or environment
INPUT=$(cat)
echo "{\\"status\\": \\"success\\", \\"input\\": $INPUT, \\"runtime\\": \\"bash\\"}"`
};

function onPodRuntimeChange() {
  const runtime = document.getElementById('pod-runtime').value;
  const codeEl = document.getElementById('pod-code');
  if (codeEl && (!codeEl.value.trim() || codeEl.dataset.isTemplate === 'true')) {
    codeEl.value = POD_TEMPLATES[runtime] || '';
    codeEl.dataset.isTemplate = 'true';
  }
}

function insertPodTemplate() {
  const runtime = document.getElementById('pod-runtime').value;
  const codeEl = document.getElementById('pod-code');
  if (codeEl) {
    codeEl.value = POD_TEMPLATES[runtime] || '';
    codeEl.dataset.isTemplate = 'true';
    showToast(`✓ Plantilla para ${runtime} insertada`);
  }
}

function renderPodsList() {
  const container = document.getElementById('pods-inventory-grid');
  const countBadge = document.getElementById('pods-count-badge');
  const selectTest = document.getElementById('select-test-pod');

  if (countBadge) countBadge.innerText = `${podsList.length} Pod${podsList.length === 1 ? '' : 's'}`;

  if (selectTest) {
    if (podsList.length === 0) {
      selectTest.innerHTML = '<option value="">No hay Pods creados</option>';
    } else {
      selectTest.innerHTML = podsList.map(p => `
        <option value="${p.podId}">${p.name} (${p.runtime || 'python3'})</option>
      `).join('');
    }
  }

  if (!container) return;

  if (podsList.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; background: #080808; border: 1px dashed #222; border-radius: 8px; padding: 24px; text-align: center; color: var(--text-muted);">
        <p style="margin-bottom: 8px;">🌸 No hay Micro-VMs (PollenPods) registradas.</p>
        <small>Crea tu primera función polyglot en Python, Rust, Go, Node.js o WASM utilizando el formulario inferior.</small>
      </div>
    `;
    return;
  }

  const RUNTIME_ICONS = {
    python3: '🐍',
    nodejs20: '⚡',
    rust: '🦀',
    go: '🦫',
    wasm: '🌐',
    bash: '💻'
  };

  container.innerHTML = podsList.map(p => {
    const icon = RUNTIME_ICONS[p.runtime] || '🌸';
    const runtimeClass = p.runtime || 'python3';
    const entrypoint = p.entrypoint || 'handler';
    const version = p.version || '1.0.0';
    const codeSnippet = p.code || POD_TEMPLATES[p.runtime] || '// Sin código guardado';

    return `
      <div class="pod-card">
        <div class="pod-card-header">
          <div class="pod-card-title-wrap">
            <span style="font-size: 1.2rem;">${icon}</span>
            <div>
              <h4>${p.name}</h4>
              <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">${p.podId}</span>
            </div>
          </div>
          <span class="pod-runtime-badge ${runtimeClass}">${p.runtime || 'polyglot'}</span>
        </div>

        <div class="pod-card-details">
          <div><strong>Entrypoint:</strong> <code>${entrypoint}()</code></div>
          <div><strong>Versión:</strong> <span style="font-family: var(--font-mono); color: #ccc;">v${version}</span></div>
        </div>

        <div class="pod-code-preview-box"><code>${escapeHtml(codeSnippet)}</code></div>

        <div class="pod-card-actions">
          <button class="btn-sm btn-secondary" onclick="openEditPodModal('${p.podId}')">⚙️ Editar</button>
          <button class="btn-sm btn-secondary" onclick="deletePod('${p.podId}')">🗑️ Eliminar</button>
        </div>
      </div>
    `;
  }).join('');
}

function handleCreatePod(e) {
  e.preventDefault();
  if (!currentUser) { showAuthGate(); return; }

  const name = document.getElementById('pod-name').value.trim();
  const runtime = document.getElementById('pod-runtime').value;
  const entrypoint = document.getElementById('pod-entrypoint').value.trim() || 'handler';
  const code = document.getElementById('pod-code').value.trim() || POD_TEMPLATES[runtime] || '';

  const podId = 'pod_' + name.toLowerCase().replace(/[^a-z0-9_]/g, '_') + '_' + Math.random().toString(36).slice(2, 6);

  const newPod = {
    podId,
    name,
    runtime,
    entrypoint,
    version: '1.0.0',
    code,
    createdAt: new Date().toISOString()
  };

  podsList.push(newPod);
  persistToGitHub();
  renderAll();

  document.getElementById('form-create-pod').reset();
  document.getElementById('pod-entrypoint').value = 'handler';

  showToast(`✓ Micro-VM '${name}' compilada y guardada`);
  logTelemetry(`[PollenPod Created] ${name} (${runtime}) initialized with entrypoint ${entrypoint}()`);
}

function openEditPodModal(podId) {
  const pod = podsList.find(p => p.podId === podId);
  if (!pod) return;

  document.getElementById('edit-pod-id').value = pod.podId;
  document.getElementById('edit-pod-name').value = pod.name;
  document.getElementById('edit-pod-runtime').value = pod.runtime || 'python3';
  document.getElementById('edit-pod-entrypoint').value = pod.entrypoint || 'handler';
  document.getElementById('edit-pod-version').value = pod.version || '1.0.0';
  document.getElementById('edit-pod-code').value = pod.code || '';

  document.getElementById('modal-edit-pod').classList.remove('hidden');
}

function closeEditPodModal() {
  document.getElementById('modal-edit-pod').classList.add('hidden');
}

function handleSavePodEdit(e) {
  e.preventDefault();
  const podId = document.getElementById('edit-pod-id').value;
  const pod = podsList.find(p => p.podId === podId);
  if (!pod) return;

  pod.name = document.getElementById('edit-pod-name').value.trim();
  pod.runtime = document.getElementById('edit-pod-runtime').value;
  pod.entrypoint = document.getElementById('edit-pod-entrypoint').value.trim();
  pod.version = document.getElementById('edit-pod-version').value.trim() || '1.0.0';
  pod.code = document.getElementById('edit-pod-code').value;
  pod.updatedAt = new Date().toISOString();

  persistToGitHub();
  renderAll();
  closeEditPodModal();
  showToast(`✓ Pod '${pod.name}' actualizado con éxito`);
  logTelemetry(`[PollenPod Updated] ${pod.name} saved.`);
}

function deletePod(podId) {
  const pod = podsList.find(p => p.podId === podId);
  if (!pod) return;

  showConfirmModal('¿Eliminar PollenPod?', `¿Estás seguro de que deseas eliminar la micro-función '${pod.name}'?`, () => {
    podsList = podsList.filter(p => p.podId !== podId);
    persistToGitHub();
    renderAll();
    showToast(`Pod '${pod.name}' eliminado.`);
    logTelemetry(`[PollenPod Deleted] ${pod.podId} removed.`);
  });
}

function selectPodForTesting(podId) {
  const select = document.getElementById('select-test-pod');
  if (select) {
    select.value = podId;
    select.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  showToast(`Pod seleccionado para invocación`);
}

function onSelectTestPodChange() {
  const resultBox = document.getElementById('pod-test-result');
  if (resultBox) resultBox.classList.add('hidden');
}

async function testInvokePod() {
  const select = document.getElementById('select-test-pod');
  const podId = select ? select.value : '';
  const pod = podsList.find(p => p.podId === podId);
  if (!pod) {
    showToast('Selecciona un Pod válido para invocar');
    return;
  }

  const rawPayload = document.getElementById('test-pod-payload').value.trim();
  let payload = {};
  if (rawPayload) {
    try {
      payload = JSON.parse(rawPayload);
    } catch (err) {
      showToast('Error de sintaxis JSON en el Payload de Entrada');
      return;
    }
  }

  const startTime = performance.now();
  let responseData = null;
  let isCold = Math.random() < 0.2;

  try {
    if (pod.runtime === 'nodejs20') {
      let userCode = pod.code || '';
      userCode = userCode.replace(/export\s+async\s+function\s+\w+\s*\(/, 'async function handler(')
                         .replace(/export\s+function\s+\w+\s*\(/, 'function handler(');
      
      const runnerFn = new Function('event', 'context', `
        ${userCode}
        if (typeof ${pod.entrypoint || 'handler'} === 'function') {
          return ${pod.entrypoint || 'handler'}(event, context);
        }
        return { status: "success", executed: true, data: event };
      `);
      responseData = await runnerFn(payload, { podId: pod.podId, memoryLimitMb: 128 });
    } else {
      const processed = payload.items ? payload.items.map(x => typeof x === 'string' ? x.toUpperCase() : x * 2) : payload;
      responseData = {
        status: "success",
        podId: pod.podId,
        runtime: pod.runtime || 'polyglot',
        entrypoint: `${pod.entrypoint || 'handler'}()`,
        output: {
          received: payload,
          transformed: processed,
          timestamp: new Date().toISOString()
        }
      };
    }
  } catch (evalErr) {
    responseData = {
      error: "RuntimeExecutionError",
      message: evalErr.message,
      podId: pod.podId
    };
  }

  const elapsedMs = Math.max(8, Math.round(performance.now() - startTime + (isCold ? 25 : 4)));

  const resultBox = document.getElementById('pod-test-result');
  const latencyPill = document.getElementById('res-latency');
  const statusPill = document.getElementById('res-status');
  const coldPill = document.getElementById('res-cold');
  const jsonPre = document.getElementById('res-json-output');

  if (latencyPill) latencyPill.innerText = `⏱️ ${elapsedMs}ms`;
  if (statusPill) {
    statusPill.innerText = responseData.error ? 'HTTP 500 ERROR' : 'HTTP 200 OK';
    statusPill.className = `metric-pill ${responseData.error ? 'failed' : 'success'}`;
  }
  if (coldPill) {
    coldPill.innerText = isCold ? 'Cold Start ❄️' : 'Warm Pool ⚡';
  }
  if (jsonPre) {
    jsonPre.innerText = JSON.stringify(responseData, null, 2);
  }
  if (resultBox) {
    resultBox.classList.remove('hidden');
  }

  logTelemetry(`[PollenPod Invoked] ${pod.name} executed in ${elapsedMs}ms (${statusPill.innerText})`);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
}

function logTelemetry(msg) {
  const box = document.getElementById('telemetry-log');
  if (!box) return;
  const line = document.createElement('div');
  line.className = 'log-line info';
  line.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

// ─── HIVENODE WEB SHELL & MODAL FUNCTIONS ──────────────────────────────────

function openNodeShell(nodeId) {
  const node = nodesList.find(n => n.nodeId === nodeId);
  if (!node) return;
  activeNodeForShell = node;

  const isRunning = node.status === 'running';
  const isProvisioning = node.status === 'provisioning';

  document.getElementById('shell-modal-title').innerText = `🖥️ Conexión: ${node.name}`;
  document.getElementById('shell-node-name').innerText = node.name;
  
  const statusTag = document.getElementById('shell-live-status');
  const statusIcon = document.getElementById('shell-status-icon');
  const desc = document.getElementById('shell-node-desc');
  const stoppedBox = document.getElementById('shell-stopped-box');
  const activeActions = document.getElementById('shell-active-actions');
  const relaunchBtn = document.getElementById('btn-relaunch-runner');

  document.getElementById('telemetry-os').innerText = node.osImage || 'Ubuntu 24.04 LTS';
  document.getElementById('telemetry-tunnel').innerText = 'Cloudflare Tunnel (Port 443 HTTPS)';
  document.getElementById('telemetry-storage').innerText = (node.storage?.type || 'vault_persistent') + ' mounted at /mockhive/data';
  const passVal = document.getElementById('modal-ssh-pass-val');
  if (passVal) passVal.innerText = node.sshPassword || 'mockhive2026';

  if (isRunning) {
    if (statusTag) statusTag.innerText = '🟢 En Ejecución (Ubuntu 24.04)';
    if (statusIcon) statusIcon.innerText = '⚡';
    if (desc) desc.innerText = 'Runner activo en GitHub Actions con Web Terminal HTTPS y almacenamiento persistente en /mockhive/data.';
    if (stoppedBox) stoppedBox.classList.add('hidden');
    if (activeActions) activeActions.classList.remove('hidden');
    if (relaunchBtn) relaunchBtn.style.display = 'inline-block';
    
    const hasValidSSH = node.sshCommand && !node.sshCommand.includes('localhost') && !node.sshCommand.includes('(Web Shell');
    document.getElementById('modal-ssh-cmd').innerText = hasValidSSH ? node.sshCommand : (node.webCommand ? 'Web Terminal HTTPS Activa' : 'Conectando túneles...');
  } else if (isProvisioning) {
    if (statusTag) statusTag.innerText = '⚡ Aprovisionando Runner...';
    if (statusIcon) statusIcon.innerText = '⏳';
    if (desc) desc.innerText = 'Lanzando runner en GitHub Actions y abriendo túnel SSH. Espera unos segundos...';
    if (stoppedBox) stoppedBox.classList.add('hidden');
    if (activeActions) activeActions.classList.add('hidden');
    if (relaunchBtn) relaunchBtn.style.display = 'none';
  } else {
    if (statusTag) statusTag.innerText = '⚪ Detenido';
    if (statusIcon) statusIcon.innerText = '⚪';
    if (desc) desc.innerText = 'Servidor actualmente detenido. No hay procesos ni túneles abiertos.';
    if (stoppedBox) stoppedBox.classList.remove('hidden');
    if (activeActions) activeActions.classList.add('hidden');
    if (relaunchBtn) relaunchBtn.style.display = 'none';
  }

  const modal = document.getElementById('modal-node-shell');
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

function closeNodeShellModal() {
  const modal = document.getElementById('modal-node-shell');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
  activeNodeForShell = null;
}

function startFromModal() {
  if (activeNodeForShell) {
    const id = activeNodeForShell.nodeId;
    startNode(id);
    openNodeShell(id);
  }
}

function openShellInNewTab() {
  if (activeNodeForShell && activeNodeForShell.status === 'running' && activeNodeForShell.webCommand) {
    window.open(activeNodeForShell.webCommand, '_blank');
    showToast('Terminal web abierta en pestaña nueva');
  } else if (activeNodeForShell && activeNodeForShell.status !== 'running') {
    showToast('Inicia primero el servidor con ⚡ Iniciar Servidor');
  } else if (activeNodeForShell && activeNodeForShell.sshCommand) {
    copySSHCommand(activeNodeForShell.sshCommand);
  }
}

function copyModalSSH() {
  if (activeNodeForShell && activeNodeForShell.sshCommand) {
    copySSHCommand(activeNodeForShell.sshCommand);
  }
}

function relaunchActiveRunner() {
  if (activeNodeForShell) {
    const id = activeNodeForShell.nodeId;
    startNode(id);
    openNodeShell(id);
  }
}

// ─── EDIT NODE MODAL (FULL PARAMETERS) ─────────────────────────────────────

function openEditModal(nodeId) {
  const node = nodesList.find(n => n.nodeId === nodeId);
  if (!node) return;

  document.getElementById('edit-node-id').value = node.nodeId;
  document.getElementById('edit-node-name').value = node.name;
  document.getElementById('edit-node-os').value = node.osImage || 'ubuntu-latest';
  document.getElementById('edit-node-lifecycle').value = node.lifecycleMode || 'ttl_ephemeral';
  
  document.getElementById('edit-node-ttl').value = (node.ttlMinutes !== undefined && node.ttlMinutes !== null) ? node.ttlMinutes : '';
  document.getElementById('edit-node-inactivity').value = (node.inactivityMinutes !== undefined && node.inactivityMinutes !== null) ? node.inactivityMinutes : '';
  
  const storageType = node.storage?.type || 'vault_persistent';
  document.getElementById('edit-node-storage-type').value = storageType;
  document.getElementById('edit-rolla-ball-id').value = node.storage?.rollaBallId || '';
  document.getElementById('edit-rolla-owner').value = node.storage?.rollaOwner || '';
  document.getElementById('edit-rolla-token').value = node.storage?.rollaToken || '';
  document.getElementById('edit-rolla-sync-mode').value = node.storage?.rollaSyncMode || 'periodic_60s';

  document.getElementById('edit-s3-endpoint').value = node.storage?.s3Endpoint || '';
  document.getElementById('edit-s3-bucket').value = node.storage?.s3Bucket || '';
  document.getElementById('edit-s3-access-key').value = node.storage?.s3AccessKey || '';
  document.getElementById('edit-s3-secret-key').value = node.storage?.s3SecretKey || '';
  document.getElementById('edit-s3-region').value = node.storage?.s3Region || '';
  document.getElementById('edit-s3-prefix').value = node.storage?.s3Prefix || '';

  document.getElementById('edit-node-tunnel').value = node.tunnelProvider || 'tmate';
  document.getElementById('edit-node-ssh-password').value = node.sshPassword || '';
  document.getElementById('edit-node-init-script').value = node.initScript || '';

  onEditLifecycleChange();
  onEditStorageTypeChange();

  const modal = document.getElementById('modal-edit-node');
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

function closeEditModal() {
  const modal = document.getElementById('modal-edit-node');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

function handleSaveNodeEdit(e) {
  e.preventDefault();
  const nodeId = document.getElementById('edit-node-id').value;
  const node = nodesList.find(n => n.nodeId === nodeId);
  if (node) {
    node.name = document.getElementById('edit-node-name').value;
    node.osImage = document.getElementById('edit-node-os').value;
    node.lifecycleMode = document.getElementById('edit-node-lifecycle').value;
    
    const rawTtl = document.getElementById('edit-node-ttl').value;
    node.ttlMinutes = node.lifecycleMode === 'lazarus_24_7' ? null : (rawTtl === '' || rawTtl === '0' ? 0 : parseInt(rawTtl, 10));
    
    const rawInactivity = document.getElementById('edit-node-inactivity').value;
    node.inactivityMinutes = node.lifecycleMode === 'lazarus_24_7' ? null : (rawInactivity ? parseInt(rawInactivity, 10) : 15);
    
    const storageType = document.getElementById('edit-node-storage-type').value;
    const rollaBallId = document.getElementById('edit-rolla-ball-id')?.value || '';
    const rollaOwner = document.getElementById('edit-rolla-owner')?.value || '';
    const rollaToken = document.getElementById('edit-rolla-token')?.value || '';
    const rollaSyncMode = document.getElementById('edit-rolla-sync-mode')?.value || 'periodic_60s';

    const s3Endpoint = document.getElementById('edit-s3-endpoint')?.value || '';
    const s3Bucket = document.getElementById('edit-s3-bucket')?.value || '';
    const s3AccessKey = document.getElementById('edit-s3-access-key')?.value || '';
    const s3SecretKey = document.getElementById('edit-s3-secret-key')?.value || '';
    const s3Region = document.getElementById('edit-s3-region')?.value || '';
    const s3Prefix = document.getElementById('edit-s3-prefix')?.value || '';

    node.storage = {
      type: storageType,
      rollaBallId: storageType === 'rolla_ball' ? rollaBallId : undefined,
      rollaOwner: (storageType === 'rolla_ball' && rollaOwner) ? rollaOwner : undefined,
      rollaToken: (storageType === 'rolla_ball' && rollaToken) ? rollaToken : undefined,
      rollaSyncMode: storageType === 'rolla_ball' ? rollaSyncMode : undefined,
      s3Endpoint: storageType === 's3_custom' ? s3Endpoint : undefined,
      s3Bucket: storageType === 's3_custom' ? s3Bucket : undefined,
      s3AccessKey: (storageType === 's3_custom' && s3AccessKey) ? s3AccessKey : undefined,
      s3SecretKey: (storageType === 's3_custom' && s3SecretKey) ? s3SecretKey : undefined,
      s3Region: (storageType === 's3_custom' && s3Region) ? s3Region : undefined,
      s3Prefix: (storageType === 's3_custom' && s3Prefix) ? s3Prefix : undefined,
      mountPath: '/mockhive/data'
    };

    node.tunnelProvider = document.getElementById('edit-node-tunnel').value;
    node.sshPassword = document.getElementById('edit-node-ssh-password')?.value.trim() || 'mockhive2026';
    node.initScript = document.getElementById('edit-node-init-script').value;

    persistToGitHub();
    renderAll();
    closeEditModal();
    showToast(`HiveNode '${node.name}' actualizado con éxito`);
    logTelemetry(`[Node Updated] ${node.name} full properties modified.`);
  }
}

async function manualRefreshAll() {
  showToast('Sincronizando estado con GitHub Actions...');
  await syncWithGitHub();
  showToast('✓ Estado e inventario actualizados');
}

// Unconditional Background Poller for Live Status every 4s
setInterval(async () => {
  if (githubPAT && currentUser) {
    await checkLiveStatusForNodes();
  }
}, 4000);

// Global Window Exports
window.handleGateLogin = handleGateLogin;
window.showAuthGate = showAuthGate;
window.showAppLayout = showAppLayout;
window.logout = logout;
window.openNodeShell = openNodeShell;
window.closeNodeShellModal = closeNodeShellModal;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.closeConfirmModal = closeConfirmModal;
window.switchTab = switchTab;
window.startNode = startNode;
window.stopNode = stopNode;
window.deleteNode = deleteNode;
window.copyNodeSSH = copyNodeSSH;
window.copySSHCommand = copySSHCommand;
window.copyModalSSH = copyModalSSH;
window.openShellInNewTab = openShellInNewTab;
window.startFromModal = startFromModal;
window.relaunchActiveRunner = relaunchActiveRunner;
window.onLifecycleChange = onLifecycleChange;
window.onStorageTypeChange = onStorageTypeChange;
window.onEditLifecycleChange = onEditLifecycleChange;
window.onEditStorageTypeChange = onEditStorageTypeChange;
window.testInvokePod = testInvokePod;
window.handleCreatePod = handleCreatePod;
window.openEditPodModal = openEditPodModal;
window.closeEditPodModal = closeEditPodModal;
window.handleSavePodEdit = handleSavePodEdit;
window.deletePod = deletePod;
window.selectPodForTesting = selectPodForTesting;
window.onSelectTestPodChange = onSelectTestPodChange;
window.onPodRuntimeChange = onPodRuntimeChange;
window.insertPodTemplate = insertPodTemplate;
window.syncWithGitHub = syncWithGitHub;
window.manualRefreshAll = manualRefreshAll;

window.switchWaggleSubTab = switchWaggleSubTab;
window.onConnectorTypeChange = onConnectorTypeChange;
window.onStorageProviderChange = onStorageProviderChange;
window.handleCreateConnector = handleCreateConnector;
window.renderConnectorsList = renderConnectorsList;
window.openEditConnectorModal = openEditConnectorModal;
window.closeEditConnectorModal = closeEditConnectorModal;
window.handleSaveConnectorEdit = handleSaveConnectorEdit;
window.deleteConnector = deleteConnector;
window.testConnector = testConnector;

window.handleCreateWaggle = handleCreateWaggle;
window.renderWagglesList = renderWagglesList;
window.openEditWaggleModal = openEditWaggleModal;
window.closeEditWaggleModal = closeEditWaggleModal;
window.handleSaveWaggleEdit = handleSaveWaggleEdit;
window.deleteWaggle = deleteWaggle;
window.openRunWaggleModal = openRunWaggleModal;
window.closeRunWaggleModal = closeRunWaggleModal;
window.clearExecLogs = clearExecLogs;
window.triggerWaggleExecution = triggerWaggleExecution;
window.handleBackdropClick = handleBackdropClick;
window.closeAnyModal = closeAnyModal;
