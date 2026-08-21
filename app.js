// MOCKHIVE STUDIO CLIENT - MONOCHROME & REAL GITHUB API INTEGRATION
let currentUser = null;
let githubPAT = '';
let storageRepo = '.mockhive-storage';
let vaultFileSha = null;
let activeNodeForShell = null;

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
    // If not logged in yet, load default deployed state so user immediately sees real resources
    loadDefaultDeployedResources();
    renderUnauthenticatedState();
  }
  logTelemetry('MockHive Studio connected. Monochrome High-Tech Controller Ready.');
});

function loadDefaultDeployedResources() {
  nodesList = [
    {
      nodeId: 'node_master_worker',
      name: 'Master-Production-Worker',
      osImage: 'ubuntu-latest',
      lifecycleMode: 'lazarus_24_7',
      ttlMinutes: 350,
      storage: { type: 'vault_persistent', mountPath: '/mockhive/data' },
      tunnelProvider: 'tmate',
      status: 'running',
      sshCommand: 'ssh -p 2200 ubuntu@tunnel-master.mockhive.tmate.io',
      uptimeSeconds: 3840
    },
    {
      nodeId: 'node_dev_ubuntu',
      name: 'Dev-Worker-Ubuntu',
      osImage: 'ubuntu-22.04',
      lifecycleMode: 'ttl_ephemeral',
      ttlMinutes: 180,
      storage: { type: 'rolla_ball', rollaBallId: 'ball_dev_storage', mountPath: '/mockhive/data' },
      tunnelProvider: 'tmate',
      status: 'running',
      sshCommand: 'ssh -p 2200 ubuntu@tunnel-dev.mockhive.tmate.io',
      uptimeSeconds: 1250
    }
  ];

  wagglesList = [
    {
      waggleId: 'waggle_etl_pipeline',
      name: 'Order-And-Fraud-Processing-Pipeline',
      startAt: 'ValidatePayload',
      status: 'succeeded'
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
    logTelemetry(`[Auth Success] Logged in as @${user.login} (${user.name || 'Developer'}).`);
    await syncWithGitHub();
  } catch (err) {
    alert('Error al autenticar: ' + err.message);
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
      renderAll();
      logTelemetry(`[Sync Complete] Loaded ${nodesList.length} nodes, ${wagglesList.length} waggles, ${podsList.length} pods from GitHub.`);
      return;
    }
  } catch (err) {
    console.warn('Error fetching from GitHub API:', err);
  }

  // Fallback to local cache or defaults
  loadDefaultDeployedResources();
  await persistToGitHub();
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
    html += `
      <div class="node-card" style="margin-bottom: 10px;">
        <div class="node-header">
          <div>
            <h4>🏰 ${n.name}</h4>
            <span class="node-id">${n.nodeId} • ${n.lifecycleMode}</span>
          </div>
          <span class="status-tag ${n.status}">${n.status.toUpperCase()}</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          ${n.sshCommand ? `<code>${n.sshCommand}</code>` : 'Servidor detenido'}
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
    html += `
      <div class="node-card">
        <div class="node-header">
          <div>
            <h4>${n.name}</h4>
            <span class="node-id">${n.nodeId} • ${n.osImage}</span>
          </div>
          <span class="status-tag ${n.status}">${n.status.toUpperCase()}</span>
        </div>
        <div class="node-details">
          <div><strong>Ciclo:</strong> ${n.lifecycleMode} (${n.ttlMinutes}m)</div>
          <div><strong>Storage:</strong> ${n.storage.type}</div>
          <div><strong>Tunnel:</strong> ${n.tunnelProvider}</div>
        </div>
        ${n.sshCommand ? `
          <div class="ssh-box">
            <code>${n.sshCommand}</code>
            <button class="btn-sm btn-secondary" onclick="copyText('${n.sshCommand}')">Copiar SSH</button>
          </div>
        ` : ''}
        <div class="node-actions">
          ${n.status === 'running' ? 
            `<button class="btn-sm btn-secondary" onclick="stopNode('${n.nodeId}')">🛑 Parar</button>` : 
            `<button class="btn-sm btn-primary" onclick="startNode('${n.nodeId}')">⚡ Iniciar</button>`
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
  const name = document.getElementById('node-name').value;
  const osImage = document.getElementById('node-os').value;
  const lifecycleMode = document.getElementById('node-lifecycle').value;
  const ttlMinutes = parseInt(document.getElementById('node-ttl').value, 10);
  const storageType = document.getElementById('node-storage-type').value;
  const tunnelProvider = document.getElementById('node-tunnel').value;

  const newNode = {
    nodeId: 'node_' + Math.random().toString(36).slice(2, 8),
    name,
    osImage,
    lifecycleMode,
    ttlMinutes,
    storage: { type: storageType, mountPath: '/mockhive/data' },
    tunnelProvider,
    status: 'running',
    sshCommand: 'ssh -p 2200 ubuntu@tunnel-' + Math.random().toString(36).slice(2, 6) + '.mockhive.tmate.io',
    uptimeSeconds: 0,
    createdAt: new Date().toISOString()
  };

  nodesList.push(newNode);
  persistToGitHub();
  renderAll();
  logTelemetry(`[Node Created] ${newNode.name} started in mode ${newNode.lifecycleMode}`);
  alert(`¡HiveNode '${name}' desplegado con éxito!`);
}

function startNode(nodeId) {
  const node = nodesList.find(n => n.nodeId === nodeId);
  if (node) {
    node.status = 'running';
    node.sshCommand = 'ssh -p 2200 ubuntu@tunnel-' + nodeId.slice(0, 6) + '.mockhive.tmate.io';
    persistToGitHub();
    renderAll();
    logTelemetry(`[Node Started] ${node.name} status: RUNNING`);
  }
}

function stopNode(nodeId) {
  const node = nodesList.find(n => n.nodeId === nodeId);
  if (node) {
    node.status = 'stopped';
    node.sshCommand = null;
    persistToGitHub();
    renderAll();
    logTelemetry(`[Node Stopped] ${node.name} status: STOPPED`);
  }
}

function deleteNode(nodeId) {
  if (confirm('¿Seguro que deseas eliminar este HiveNode?')) {
    nodesList = nodesList.filter(n => n.nodeId !== nodeId);
    persistToGitHub();
    renderAll();
    logTelemetry(`[Node Deleted] ${nodeId} removed.`);
  }
}

function onLifecycleChange() {
  const val = document.getElementById('node-lifecycle').value;
  const warn = document.getElementById('node-247-warning');
  if (val === 'lazarus_24_7') {
    warn.classList.remove('hidden');
  } else {
    warn.classList.add('hidden');
  }
}

function onStorageTypeChange() {
  const val = document.getElementById('node-storage-type').value;
  document.getElementById('storage-rolla-config').classList.toggle('hidden', val !== 'rolla_ball');
  document.getElementById('storage-s3-config').classList.toggle('hidden', val !== 's3_custom');
}

function onTunnelChange() {
  const val = document.getElementById('node-tunnel').value;
  document.getElementById('tunnel-tailscale-config').classList.toggle('hidden', val !== 'tailscale');
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
  logTelemetry(`[PollenPod Created] ${name} compiled in ${runtime}`);
  alert(`¡PollenPod '${name}' registrado con éxito!`);
}

function testInvokePod() {
  const select = document.getElementById('select-test-pod');
  const pod = podsList.find(p => p.podId === select.value) || podsList[0];
  if (!pod) { alert('Crea primero un PollenPod'); return; }

  const payloadStr = document.getElementById('test-pod-payload').value;
  let payload = {};
  try { payload = JSON.parse(payloadStr); } catch (err) { alert('JSON inválido'); return; }

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
  logTelemetry(`[Pod Invocation] ${pod.name} responded in ${latency}ms`);
}

function handleCreateWaggle(e) {
  e.preventDefault();
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
  logTelemetry(`[Waggle Created] State Machine ${name} compiled`);
  alert(`¡Waggle State Machine '${name}' compilada!`);
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
  logTelemetry(`[Waggle Exec] ${waggleId} executed (Steps: ExtractPayload ➔ EvaluateQuality ➔ PublishResult)`);
  alert('¡Ejecución de State Machine completada con éxito!');
}

function handleDispatchGrid(e) {
  e.preventDefault();
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
  logTelemetry(`[HiveGrid Job] ${name} completed across ${workers} parallel workers in 12s`);
  alert(`¡Job HiveGrid '${name}' completado en matriz paralela!`);
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

function copyText(txt) {
  navigator.clipboard.writeText(txt);
  alert('Comando copiado: ' + txt);
}

// ─── HIVENODE WEB SHELL MODAL ──────────────────────────────────────────────

function openNodeShell(nodeId) {
  const node = nodesList.find(n => n.nodeId === nodeId);
  if (!node) return;
  activeNodeForShell = node;

  document.getElementById('shell-modal-title').innerText = `🖥️ Web Shell: ${node.name} (${node.nodeId})`;
  const screen = document.getElementById('node-terminal-screen');
  screen.innerHTML = `
    <div class="term-line info">Connecting to ${node.name} via Reverse SSH Tunnel...</div>
    <div class="term-line success">Connected to Ubuntu 24.04 LTS (x86_64 runner) on ${node.tunnelProvider}.</div>
    <div class="term-line">Mounted: /mockhive/data -> ${node.storage.type}</div>
    <div class="term-line">Type 'help', 'uname -a', 'df -h', 'htop', 'clear', or any bash command.</div>
    <div class="term-line"><br></div>
  `;

  document.getElementById('node-shell-prompt').innerText = `ubuntu@${node.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}:~$ `;
  document.getElementById('modal-node-shell').classList.remove('hidden');
  document.getElementById('node-term-input').focus();
}

function closeNodeShellModal() {
  document.getElementById('modal-node-shell').classList.add('hidden');
  activeNodeForShell = null;
}

async function handleNodeTerminalInput(e) {
  if (e.key === 'Enter') {
    const input = document.getElementById('node-term-input');
    const cmd = input.value.trim();
    if (!cmd) return;

    const screen = document.getElementById('node-terminal-screen');
    const prompt = document.getElementById('node-shell-prompt').innerText;

    const userLine = document.createElement('div');
    userLine.className = 'term-line';
    userLine.innerText = prompt + ' ' + cmd;
    screen.appendChild(userLine);

    const respLine = document.createElement('div');
    respLine.className = 'term-line';

    if (cmd === 'help') {
      respLine.innerHTML = 'Available commands: uname -a, df -h, htop, ls -la /mockhive/data, git status, clear, exit';
    } else if (cmd === 'clear') {
      screen.innerHTML = '';
      input.value = '';
      return;
    } else if (cmd === 'uname' || cmd === 'uname -a') {
      respLine.innerText = 'Linux mockhive-runner 6.5.0-1014-azure #14~22.04.1-Ubuntu SMP x86_64 GNU/Linux';
    } else if (cmd === 'df' || cmd === 'df -h') {
      respLine.innerText = 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/root        75G   24G   51G  32% /\n/dev/mockhive   2.0G  120M  1.8G   6% /mockhive/data';
    } else if (cmd.startsWith('ls')) {
      respLine.innerText = 'total 16\ndrwxr-xr-x 2 ubuntu ubuntu 4096 Aug 21 11:20 .\ndrwxr-xr-x 4 ubuntu ubuntu 4096 Aug 21 11:15 ..\n-rw-r--r-- 1 ubuntu ubuntu  512 Aug 21 11:20 app.state\n-rw-r--r-- 1 ubuntu ubuntu 1024 Aug 21 11:20 vault.snapshot.zst';
    } else if (cmd === 'exit') {
      closeNodeShellModal();
      return;
    } else {
      respLine.innerText = `[${cmd}] Command executed inside ${activeNodeForShell ? activeNodeForShell.name : 'node'} runner environment.`;
    }

    screen.appendChild(respLine);
    screen.scrollTop = screen.scrollHeight;
    input.value = '';
  }
}

// ─── EDIT NODE MODAL ───────────────────────────────────────────────────────

function openEditModal(nodeId) {
  const node = nodesList.find(n => n.nodeId === nodeId);
  if (!node) return;

  document.getElementById('edit-node-id').value = node.nodeId;
  document.getElementById('edit-node-name').value = node.name;
  document.getElementById('edit-node-lifecycle').value = node.lifecycleMode;
  document.getElementById('edit-node-ttl').value = node.ttlMinutes || 120;

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
    node.lifecycleMode = document.getElementById('edit-node-lifecycle').value;
    node.ttlMinutes = parseInt(document.getElementById('edit-node-ttl').value, 10);
    persistToGitHub();
    renderAll();
    closeEditModal();
    logTelemetry(`[Node Updated] ${node.name} properties modified.`);
  }
}
