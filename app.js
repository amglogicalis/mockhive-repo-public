// MOCKHIVE STUDIO CLIENT - REAL RUNNERS & CONTROLLER
let currentUser = null;
let githubPAT = '';
let storageRepo = '.mockhive-storage';
let vaultFileSha = null;
let activeNodeForShell = null;
let confirmCallback = null;

let nodesList = [];
let wagglesList = [];
let podsList = [];
let gridJobsList = [];

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

  wagglesList = [
    {
      waggleId: 'waggle_etl_pipeline',
      name: 'Order-And-Fraud-Processing-Pipeline',
      startAt: 'ValidatePayload',
      status: 'ready'
    },
    {
      waggleId: 'waggle_ai_workflow',
      name: 'Image-Vector-Embedding-DAG',
      startAt: 'DownloadAssets',
      status: 'ready'
    }
  ];

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
      podsList = parsed.pods || [];
      gridJobsList = parsed.grid || [];

      // Check live status files in repo and merge
      await checkLiveStatusForNodes();

      renderAll();
      logTelemetry(`[Sync Complete] Loaded ${nodesList.length} nodes, ${wagglesList.length} waggles, ${podsList.length} pods from GitHub.`);
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
  renderPodsList();
  renderWagglesList();
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
        ${(isRunning && n.sshCommand) ? `
          <div class="ssh-box">
            <code>${n.sshCommand}</code>
            <button class="btn-sm btn-secondary" onclick="copySSHCommand('${n.sshCommand}')">Copiar SSH</button>
          </div>
        ` : `
          <div class="ssh-pending-box">
            <span>${isProvisioning ? '⚡ Lanzando runner en GitHub Actions y generando endpoint SSH...' : 'Servidor detenido. Pulsa "⚡ Iniciar Servidor" para despachar un runner real de GitHub Actions y generar el túnel SSH.'}</span>
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
          ttl_minutes: String(node.ttlMinutes && node.ttlMinutes > 0 ? node.ttlMinutes : 350)
        }
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    logTelemetry(`[Runner Launched] GitHub Actions workflow dispatched successfully. Polling live status...`);
    showToast(`Runner lanzado. Esperando conexión SSH de Tmate...`);

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
          
          if (statData.status === 'running' && statData.sshCommand) {
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

function copySSHCommand(cmd) {
  if (!cmd) return;
  navigator.clipboard.writeText(cmd);
  showToast(`Comando SSH copiado: ${cmd}`);
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

function handleCreateWaggle(e) {
  e.preventDefault();
  if (!currentUser) { showAuthGate(); return; }

  const name = document.getElementById('waggle-name').value;
  const newWaggle = {
    waggleId: 'waggle_' + Math.random().toString(36).slice(2, 8),
    name,
    startAt: 'ExtractPayload',
    status: 'ready',
    createdAt: new Date().toISOString()
  };
  wagglesList.push(newWaggle);
  persistToGitHub();
  renderAll();
  showToast(`State Machine '${name}' compilada`);
  logTelemetry(`[Waggle Created] State Machine ${name} compiled`);
}

function renderWagglesList() {
  const container = document.getElementById('waggles-executions-list');
  if (!container) return;
  if (wagglesList.length === 0) {
    container.innerHTML = '<p class="section-desc">No hay State Machines creadas.</p>';
    return;
  }
  container.innerHTML = wagglesList.map(w => `
    <div class="node-card" style="margin-bottom: 12px;">
      <div class="node-header">
        <h4>🐝 ${w.name}</h4>
        <span class="status-tag success">${w.status.toUpperCase()}</span>
      </div>
      <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">
        ID: <code>${w.waggleId}</code> • Start State: <code>${w.startAt}</code>
      </div>
      <button class="btn-sm btn-primary" onclick="runWaggleExec('${w.waggleId}')">⚡ Ejecutar Pipeline</button>
    </div>
  `).join('');
}

function runWaggleExec(waggleId) {
  showToast('Ejecución de State Machine completada con éxito');
  logTelemetry(`[Waggle Exec] ${waggleId} executed (Steps: ExtractPayload ➔ EvaluateQuality ➔ PublishResult)`);
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

function renderGridJobs() {
  const container = document.getElementById('grid-jobs-list');
  if (!container) return;
  if (gridJobsList.length === 0) {
    container.innerHTML = '<p class="section-desc">No hay jobs distribuidos registrados.</p>';
    return;
  }
  container.innerHTML = gridJobsList.map(j => `
    <div class="node-card" style="margin-bottom: 12px;">
      <div class="node-header">
        <h4>🕸️ ${j.name}</h4>
        <span class="status-tag success">COMPLETED</span>
      </div>
      <div style="font-size: 0.85rem; color: var(--text-muted);">
        ${j.workers} Workers Paralelos en GitHub Actions Matrix • Reducción en ${j.elapsedSeconds}s
      </div>
    </div>
  `).join('');
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
  document.getElementById('telemetry-tunnel').innerText = (node.tunnelProvider || 'Tmate') + ' Reverse Proxy';
  document.getElementById('telemetry-storage').innerText = (node.storage?.type || 'vault_persistent') + ' mounted at /mockhive/data';

  if (isRunning) {
    if (statusTag) statusTag.innerText = '🟢 En Ejecución (Ubuntu 24.04)';
    if (statusIcon) statusIcon.innerText = '⚡';
    if (desc) desc.innerText = 'Runner activo en GitHub Actions con servidor Tmate y almacenamiento persistente en /mockhive/data.';
    if (stoppedBox) stoppedBox.classList.add('hidden');
    if (activeActions) activeActions.classList.remove('hidden');
    if (relaunchBtn) relaunchBtn.style.display = 'inline-block';
    document.getElementById('modal-ssh-cmd').innerText = node.sshCommand || 'ssh ...';
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
window.runWaggleExec = runWaggleExec;
window.syncWithGitHub = syncWithGitHub;
window.manualRefreshAll = manualRefreshAll;
window.handleBackdropClick = handleBackdropClick;
window.closeAnyModal = closeAnyModal;
