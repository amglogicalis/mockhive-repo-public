// MOCKHIVE WEB CONSOLE CLIENT
let nodesList = [];
let wagglesList = [];
let podsList = [];
let gridJobsList = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadMockData();
  renderAll();
  logTelemetry('MockHive Studio connected. Monitoring 4 compute pillars.');
});

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

function loadMockData() {
  const savedNodes = localStorage.getItem('mockhive_nodes');
  if (savedNodes) {
    nodesList = JSON.parse(savedNodes);
  } else {
    nodesList = [
      {
        nodeId: 'node_prod_master',
        name: 'Master-Production-Worker',
        osImage: 'ubuntu-latest',
        lifecycleMode: 'lazarus_24_7',
        ttlMinutes: 350,
        storage: { type: 'vault_persistent', mountPath: '/mockhive/data' },
        tunnelProvider: 'tmate',
        status: 'running',
        sshCommand: 'ssh -p 2200 ubuntu@tunnel-master.mockhive.tmate.io',
        uptimeSeconds: 1420
      }
    ];
    saveNodes();
  }

  const savedPods = localStorage.getItem('mockhive_pods');
  if (savedPods) {
    podsList = JSON.parse(savedPods);
  } else {
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
      }
    ];
    savePods();
  }

  const savedWaggles = localStorage.getItem('mockhive_waggles');
  if (savedWaggles) {
    wagglesList = JSON.parse(savedWaggles);
  } else {
    wagglesList = [
      {
        waggleId: 'waggle_demo_pipeline',
        name: 'Order-Processing-Pipeline',
        startAt: 'ExtractPayload',
        status: 'succeeded'
      }
    ];
  }
}

function saveNodes() {
  localStorage.setItem('mockhive_nodes', JSON.stringify(nodesList));
}

function savePods() {
  localStorage.setItem('mockhive_pods', JSON.stringify(podsList));
}

function renderAll() {
  renderKPIs();
  renderNodesList();
  renderPodsList();
  renderWagglesList();
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

  if (nodesList.length === 0 && podsList.length === 0) {
    container.innerHTML = '<p class="text-muted">No hay recursos activos actualmente.</p>';
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
    container.innerHTML = '<p class="text-muted">No hay HiveNodes creados. Utiliza el formulario para desplegar uno.</p>';
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
          <button class="btn-sm btn-secondary" onclick="openTerminalModal()">🖥️ Terminal Web</button>
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
    uptimeSeconds: 0
  };

  nodesList.push(newNode);
  saveNodes();
  renderAll();
  logTelemetry(`[Node Created] ${newNode.name} started in mode ${newNode.lifecycleMode}`);
  alert(`¡HiveNode '${name}' desplegado con éxito!`);
}

function startNode(nodeId) {
  const node = nodesList.find(n => n.nodeId === nodeId);
  if (node) {
    node.status = 'running';
    node.sshCommand = 'ssh -p 2200 ubuntu@tunnel-' + nodeId.slice(0, 6) + '.mockhive.tmate.io';
    saveNodes();
    renderAll();
    logTelemetry(`[Node Started] ${node.name} status: RUNNING`);
  }
}

function stopNode(nodeId) {
  const node = nodesList.find(n => n.nodeId === nodeId);
  if (node) {
    node.status = 'stopped';
    node.sshCommand = null;
    saveNodes();
    renderAll();
    logTelemetry(`[Node Stopped] ${node.name} status: STOPPED`);
  }
}

function deleteNode(nodeId) {
  if (confirm('¿Seguro que deseas eliminar este HiveNode?')) {
    nodesList = nodesList.filter(n => n.nodeId !== nodeId);
    saveNodes();
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
    version: '1.0.0'
  };
  podsList.push(newPod);
  savePods();
  renderAll();
  logTelemetry(`[PollenPod Created] ${name} compiled in ${runtime}`);
  alert(`¡PollenPod '${name}' registrado con éxito!`);
}

function testInvokePod() {
  const select = document.getElementById('select-test-pod');
  const pod = podsList.find(p => p.podId === select.value) || podsList[0];
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
    status: 'ready'
  };
  wagglesList.push(newWaggle);
  renderAll();
  logTelemetry(`[Waggle Created] State Machine ${name} compiled`);
  alert(`¡Waggle State Machine '${name}' compilada!`);
}

function renderWagglesList() {
  const container = document.getElementById('waggles-executions-list');
  if (!container) return;
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
  logTelemetry(`[Waggle Exec] ${waggleId} executed successfully (Steps: ExtractPayload ➔ EvaluateQuality ➔ PublishResult)`);
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
    elapsedSeconds: 12
  };

  gridJobsList.push(job);
  renderKPIs();
  renderGridJobs();
  logTelemetry(`[HiveGrid Job] ${name} completed across ${workers} parallel workers in 12s`);
  alert(`¡Job HiveGrid '${name}' completado en matriz paralela!`);
}

function renderGridJobs() {
  const container = document.getElementById('grid-jobs-list');
  if (!container) return;

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
  alert('Comando copiado al portapapeles: ' + txt);
}

function openTerminalModal() {
  document.getElementById('modal-terminal').classList.remove('hidden');
  document.getElementById('term-input').focus();
}

function closeTerminalModal() {
  document.getElementById('modal-terminal').classList.add('hidden');
}

function handleTerminalInput(e) {
  if (e.key === 'Enter') {
    const input = document.getElementById('term-input');
    const cmd = input.value.trim();
    if (!cmd) return;

    const screen = document.getElementById('terminal-screen');
    const userLine = document.createElement('div');
    userLine.className = 'term-line';
    userLine.innerText = 'ubuntu@mockhive-node:~$ ' + cmd;
    screen.appendChild(userLine);

    const respLine = document.createElement('div');
    respLine.className = 'term-line';

    if (cmd === 'help') {
      respLine.innerText = 'Available commands: htop, uname -a, df -h, mockhive status, clear, exit';
    } else if (cmd === 'uname -a') {
      respLine.innerText = 'Linux mockhive-runner 6.5.0-1014-azure #14~22.04.1-Ubuntu SMP x86_64 GNU/Linux';
    } else if (cmd === 'df -h') {
      respLine.innerText = 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/root        75G   24G   51G  32% /\n/dev/mockhive   2.0G  120M  1.8G   6% /mockhive/data';
    } else if (cmd === 'clear') {
      screen.innerHTML = '';
      input.value = '';
      return;
    } else {
      respLine.innerText = `[${cmd}] Command executed successfully inside virtual runner sandbox.`;
    }

    screen.appendChild(respLine);
    screen.scrollTop = screen.scrollHeight;
    input.value = '';
  }
}

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
    saveNodes();
    renderAll();
    closeEditModal();
    logTelemetry(`[Node Updated] ${node.name} properties modified.`);
  }
}
