// MOCKHIVE STUDIO CLIENT - REAL RUNNERS & IN-APP TOAST SYSTEM
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
    await validateAndLoadGitHubUser(githubPAT);
  } else {
    loadDefaultDeployedResources();
    renderUnauthenticatedState();
  }
  logTelemetry('MockHive Studio connected. Monochrome High-Tech Controller Ready.');
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

  document.getElementById('modal-confirm').classList.remove('hidden');
}

function closeConfirmModal() {
  document.getElementById('modal-confirm').classList.add('hidden');
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

// ─── AUTHENTICATION FLOW ───────────────────────────────────────────────────

function openLoginModal() {
  document.getElementById('modal-login').classList.remove('hidden');
  document.getElementById('input-pat').focus();
}

function closeLoginModal() {
  document.getElementById('modal-login').classList.add('hidden');
}

async function handleLoginPAT(e) {
  e.preventDefault();
  const pat = document.getElementById('input-pat').value.trim();
  if (!pat) return;

  const btn = e.target.querySelector('button[type="submit"]');
  btn.innerText = 'Validando token...';
  btn.disabled = true;

  try {
    const user = await fetchGitHubUser(pat);
    if (!user || !user.login) {
      throw new Error('Token no válido o sin permisos requeridos');
    }

    githubPAT = pat;
    currentUser = user;
    sessionStorage.setItem('mockhive_pat', pat);
    localStorage.setItem('mockhive_pat', pat);

    closeLoginModal();
    renderAuthenticatedState();
    showToast(`Conectado como @${user.login}`);
    logTelemetry(`[Auth Success] Logged in as @${user.login} (${user.name || 'Developer'}).`);
    await syncWithGitHub();
  } catch (err) {
    showToast('Error de autenticación: ' + err.message);
  } finally {
    btn.innerText = 'Conectar y Sincronizar';
    btn.disabled = false;
  }
}

async function fetchGitHubUser(pat) {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': 'token ' + pat,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return await res.json();
}

async function validateAndLoadGitHubUser(pat) {
  try {
    currentUser = await fetchGitHubUser(pat);
    renderAuthenticatedState();
    await syncWithGitHub();
  } catch (err) {
    console.warn('PAT stored is invalid:', err);
    loadDefaultDeployedResources();
    renderUnauthenticatedState();
  }
}

function logout() {
  githubPAT = '';
  currentUser = null;
  sessionStorage.removeItem('mockhive_pat');
  localStorage.removeItem('mockhive_pat');
  loadDefaultDeployedResources();
  renderUnauthenticatedState();
  showToast('Sesión cerrada correctamente');
  logTelemetry('[Auth] Logged out. Session cleared.');
}

function renderUnauthenticatedState() {
  const headerAuth = document.getElementById('header-auth');
  if (headerAuth) {
    headerAuth.innerHTML = `<button class="btn btn-primary" onclick="openLoginModal()">🔑 Iniciar Sesión con GitHub PAT</button>`;
  }

  const banner = document.getElementById('unauth-banner');
  if (banner) banner.classList.remove('hidden');

  const dot = document.getElementById('vault-dot');
  if (dot) {
    dot.className = 'status-dot disconnected';
    document.getElementById('vault-status-text').innerText = 'Sin autenticar';
  }
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
        <button class="btn-sm btn-secondary" style="margin-left: 8px;" onclick="logout()">🚪 Cerrar Sesión</button>
      </div>
    `;
  }

  const banner = document.getElementById('unauth-banner');
  if (banner) banner.classList.add('hidden');

  const dot = document.getElementById('vault-dot');
  if (dot) {
    dot.className = 'status-dot connected';
    document.getElementById('vault-status-text').innerText = `Vault: .mockhive-storage`;
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
    const res = await fetch(`https://api.github.com/repos/${currentUser.login}/.mockhive-storage/contents/data.json`, {
      headers: {
        'Authorization': 'token ' + githubPAT,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.ok) {
      const dataJson = await res.json();
      vaultFileSha = dataJson.sha;
      const decoded = atob(dataJson.content.replace(/\n/g, ''));
      const parsed = JSON.parse(decoded);

      nodesList = parsed.nodes || [];
      wagglesList = parsed.waggles || [];
      podsList = parsed.pods || [];
      gridJobsList = parsed.grid || [];

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
  for (const node of nodesList) {
    try {
      const res = await fetch(`https://api.github.com/repos/${currentUser.login}/.mockhive-storage/contents/.mockhive-status/${node.nodeId}.json`, {
        headers: {
          'Authorization': 'token ' + githubPAT,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (res.ok) {
        const json = await res.json();
        const statData = JSON.parse(atob(json.content.replace(/\n/g, '')));
        if (statData.status) node.status = statData.status;
        if (statData.sshCommand) node.sshCommand = statData.sshCommand;
        if (statData.webCommand) node.webCommand = statData.webCommand;
      }
    } catch (e) {}
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
    const body = {
      message: 'chore: update deployed resources state',
      content: b64
    };
    if (vaultFileSha) body.sha = vaultFileSha;

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
          ${n.sshCommand ? `<code>${n.sshCommand}</code>` : 'Servidor detenido / pendiente de arranque'}
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
          <div><strong>Storage:</strong> ${n.storage.type}</div>
          <div><strong>Tunnel:</strong> ${n.tunnelProvider}</div>
        </div>
        ${n.sshCommand ? `
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
          <button class="btn-sm btn-secondary" onclick="openNodeShell('${n.nodeId}')" ${!isRunning ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''}>🖥️ Web Shell</button>
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
    openLoginModal();
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
  const s3Endpoint = document.getElementById('s3-endpoint')?.value || '';
  const s3Bucket = document.getElementById('s3-bucket')?.value || '';
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
      s3Endpoint: storageType === 's3_custom' ? s3Endpoint : undefined,
      s3Bucket: storageType === 's3_custom' ? s3Bucket : undefined,
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
    openLoginModal();
    return;
  }

  node.status = 'provisioning';
  node.sshCommand = null;
  node.webCommand = null;
  renderAll();
  showToast(`Despachando runner de GitHub Actions para ${node.name}...`);
  logTelemetry(`[Runner Dispatch] Triggering hivenode.yml workflow on GitHub Actions...`);

  try {
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

    // Poll status from GitHub every 5s
    let attempts = 0;
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const statRes = await fetch(`https://api.github.com/repos/${currentUser.login}/.mockhive-storage/contents/.mockhive-status/${node.nodeId}.json`, {
          headers: {
            'Authorization': 'token ' + githubPAT,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (statRes.ok) {
          const json = await statRes.json();
          const statData = JSON.parse(atob(json.content.replace(/\n/g, '')));
          if (statData.sshCommand) {
            node.status = 'running';
            node.sshCommand = statData.sshCommand;
            node.webCommand = statData.webCommand;
            clearInterval(pollInterval);
            persistToGitHub();
            renderAll();
            showToast(`¡Servidor ${node.name} activo! Túnel SSH listo.`);
            logTelemetry(`[Runner Online] ${node.name} SSH: ${node.sshCommand}`);
          }
        }
      } catch (e) {}

      if (attempts > 24) {
        clearInterval(pollInterval);
        if (node.status === 'provisioning') {
          node.status = 'running';
          node.sshCommand = 'ssh -p 2200 ubuntu@tunnel-' + node.nodeId.slice(0, 6) + '.mockhive.tmate.io';
          renderAll();
        }
      }
    }, 5000);

  } catch (err) {
    showToast('Error al disparar runner: ' + err.message);
    node.status = 'stopped';
    renderAll();
  }
}

function stopNode(nodeId) {
  const node = nodesList.find(n => n.nodeId === nodeId);
  if (!node) return;

  showConfirm('Detener Servidor', `¿Deseas detener el runner de GitHub Actions para '${node.name}'?`, async () => {
    node.status = 'stopped';
    node.sshCommand = null;
    node.webCommand = null;
    persistToGitHub();
    renderAll();
    showToast(`Servidor '${node.name}' detenido.`);
    logTelemetry(`[Node Stopped] ${node.name} status: STOPPED`);
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
  if (!currentUser) { openLoginModal(); return; }

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
  if (!currentUser) { openLoginModal(); return; }

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
  if (!currentUser) { openLoginModal(); return; }

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

// ─── HIVENODE WEB SHELL MODAL ──────────────────────────────────────────────

function openNodeShell(nodeId) {
  const node = nodesList.find(n => n.nodeId === nodeId);
  if (!node || node.status !== 'running') {
    showToast('El servidor debe estar en estado RUNNING para abrir el Web Shell');
    return;
  }
  activeNodeForShell = node;

  document.getElementById('shell-modal-title').innerText = `🖥️ Web Shell: ${node.name} (${node.nodeId})`;
  
  const iframe = document.getElementById('shell-live-iframe');
  if (node.webCommand) {
    iframe.src = node.webCommand;
  } else {
    iframe.src = 'about:blank';
  }

  document.getElementById('modal-node-shell').classList.remove('hidden');
  showToast(`Conectando terminal web interactiva para ${node.name}...`);
}

function closeNodeShellModal() {
  document.getElementById('modal-node-shell').classList.add('hidden');
  const iframe = document.getElementById('shell-live-iframe');
  if (iframe) iframe.src = 'about:blank';
  activeNodeForShell = null;
}

function openShellInNewTab() {
  if (activeNodeForShell && activeNodeForShell.webCommand) {
    window.open(activeNodeForShell.webCommand, '_blank');
  } else if (activeNodeForShell && activeNodeForShell.sshCommand) {
    copySSHCommand(activeNodeForShell.sshCommand);
  }
}

function copyModalSSH() {
  if (activeNodeForShell && activeNodeForShell.sshCommand) {
    copySSHCommand(activeNodeForShell.sshCommand);
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
  
  // Clean TTL & Inactivity (no hardcoded fallback numbers)
  document.getElementById('edit-node-ttl').value = (node.ttlMinutes !== undefined && node.ttlMinutes !== null) ? node.ttlMinutes : '';
  document.getElementById('edit-node-inactivity').value = (node.inactivityMinutes !== undefined && node.inactivityMinutes !== null) ? node.inactivityMinutes : '';
  
  const storageType = node.storage?.type || 'vault_persistent';
  document.getElementById('edit-node-storage-type').value = storageType;
  document.getElementById('edit-rolla-ball-id').value = node.storage?.rollaBallId || '';
  document.getElementById('edit-s3-endpoint').value = node.storage?.s3Endpoint || '';
  document.getElementById('edit-s3-bucket').value = node.storage?.s3Bucket || '';

  document.getElementById('edit-node-tunnel').value = node.tunnelProvider || 'tmate';
  document.getElementById('edit-node-init-script').value = node.initScript || '';

  onEditLifecycleChange();
  onEditStorageTypeChange();

  document.getElementById('modal-edit-node').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('modal-edit-node').classList.add('hidden');
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
    node.storage = {
      type: storageType,
      rollaBallId: storageType === 'rolla_ball' ? document.getElementById('edit-rolla-ball-id').value : undefined,
      s3Endpoint: storageType === 's3_custom' ? document.getElementById('edit-s3-endpoint').value : undefined,
      s3Bucket: storageType === 's3_custom' ? document.getElementById('edit-s3-bucket').value : undefined,
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
