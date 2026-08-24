# 🐝 MOCKHIVE

<p align="center">
  <img src="./assets/logo_mockhive.png" alt="MockHive Logo" width="200" style="border-radius: 20px; box-shadow: 0 8px 32px rgba(245, 158, 11, 0.35);" />
</p>

<p align="center">
  <strong>The $0 Cost Compute Cloud, Ephemeral EC2 Servers & Distributed Step Functions Engine for the Terra Ecosystem</strong><br>
  <em>Zero Cost • 6h GitHub Actions Compute • Ubuntu Virtual Servers • Web Terminal & SSH Relays • Polyglot Micro-VMs • Map-Reduce Swarm</em>
</p>

<p align="center">
  <a href="https://amglogicalis.github.io/mockhive-repo-public/" target="_blank">
    <img src="https://img.shields.io/badge/🌐%20Web%20Console-ONLINE%20(GitHub%20Pages)-f59e0b?style=for-the-badge&logo=googlechrome&logoColor=black" alt="Live Console">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-f59e0b.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-06b6d4.svg" alt="License">
  <img src="https://img.shields.io/badge/compute-GitHub%20Actions%20(6h%20runners)-22c55e.svg" alt="Compute">
  <img src="https://img.shields.io/badge/storage-.mockhive--storage%20Releases%20(2GB)-f59e0b.svg" alt="Storage">
  <img src="https://img.shields.io/badge/ecosystem-Terra-34d399.svg" alt="Terra Ecosystem">
  <img src="https://img.shields.io/badge/npm-terra--mockhive-red.svg" alt="NPM Package">
</p>

---

## 📑 Tabla de Contenidos

1. [🌟 Visión y Filosofía ($0 Compute Cloud)](#-visión-y-filosofía-0-compute-cloud)
2. [📦 Instalación y Arranque Rápido](#-instalación-y-arranque-rápido)
3. [🏰 1. HiveNodes (Servidores Virtuales EC2 & Túneles SSH)](#-1-hivenodes-servidores-virtuales-ec2--túneles-ssh)
4. [🐝 2. Waggles (Step Functions & State Machines)](#-2-waggles-step-functions--state-machines)
5. [🌸 3. PollenPods (Micro-VMs & Serverless Políglotas)](#-3-pollenpods-micro-vms--serverless-políglotas)
6. [🕸️ 4. HiveGrid (Cluster Distribuido Map-Reduce)](#️-4-hivegrid-cluster-distribuido-map-reduce)
7. [💻 5. Referencia Completa del CLI & SDK](#-5-referencia-completa-del-cli--sdk)
8. [💡 6. Buenas y Malas Prácticas](#-6-buenas-y-malas-prácticas)
9. [❓ 7. FAQ & Solución de Errores Comunes](#-7-faq--solución-de-errores-comunes)

---

## 🌟 Visión y Filosofía ($0 Compute Cloud)

**MockHive** es el motor de computación cloud efímera de **Terra**. Transforma la infraestructura de **GitHub Actions** en una plataforma de computación completa, equivalente a una suite comercial de nube (**AWS EC2 + Step Functions + Lambda + EMR**), pero a **coste económico $0**:

```
                                 🐝 MOCKHIVE ENGINE
                              (Compute Control Plane)
                                         │
    ┌──────────────────┬─────────────────┼─────────────────┬──────────────────┐
    ▼                  ▼                 ▼                 ▼                  ▼
🏰 HIVENODES        🐝 WAGGLES        🌸 POLLENPODS     🕸️ HIVEGRID        📦 STORAGE VAULT
(Virtual Servers)  (Step Functions)  (Polyglot MicroVM)(Map-Reduce Swarm) (Snapshots/Rolla)
    │                  │                 │                 │                  │
    └──────────────────┴─────────────────┼─────────────────┴──────────────────┘
                                         ▼
                             🖥️ MOCKHIVE STUDIO (SPA)
                   (Web Terminal xterm.js & Resource Monitor)
```

- **Servidores Reales**: Ejecuta instancias completas de Ubuntu con acceso SSH o Web Terminal en navegador.
- **Relay Inmortal 24/7**: Mecanismo de auto-relevo en cadena antes del límite de 6 horas de GitHub Actions con advertencia de ToS.
- **Persistencia Flexible**: Snapshots comprimidos `.tar.zst` en GitHub Releases, integración nativa con **Rolla-Balls** o buckets compatibles con **S3 / R2 / MinIO**.
- **Mutabilidad Total**: Todos los parámetros de cada máquina pueden editarse tras su creación.

---

## 📦 Instalación y Arranque Rápido

### 1. Instalación Global vía NPM:
```bash
npm install -g terra-mockhive
```

### 2. Inicializar Entorno:
```bash
mockhive init
```

### 3. Abrir la Consola Web Localhost:
```bash
# Puerto por defecto (7440)
mockhive console

# Puerto personalizado
mockhive console --port 8080
```

### 4. Uso Programático con TypeScript / ES Modules:
```typescript
import { MockHive } from 'terra-mockhive';

const app = new MockHive({
  storageRepo: '.mockhive-storage'
});

await app.init();
```

---

## 🏰 1. HiveNodes (Servidores Virtuales EC2 & Túneles SSH)

Un **HiveNode** es una instancia de servidor virtual Ubuntu ejecutada en un runner de GitHub Actions con acceso interactivo bidireccional.

### Características Principales:
- **Ciclo de Vida Configurable**:
  - **`ttl_ephemeral`**: Se apaga automáticamente tras el tiempo configurado (ej: 60m, 120m) o por inactividad.
  - **`lazarus_24_7`**: Auto-relevo mediante `workflow_dispatch` antes de las 6 horas. *(Incluye aviso visible de ToS de GitHub)*.
- **Almacenamiento**:
  - `vault_persistent`: Empaqueta `/mockhive/data` en un snapshot comprimido `.tar.zst` guardado en GitHub Releases (soporte para archivos >2GB con chunking).
  - `rolla_ball`: Conexión nativa a Rolla-Balls de Terra (usando el mismo u otro PAT de GitHub).
  - `s3_custom`: Sincronización bidireccional con buckets S3, Cloudflare R2 o MinIO.
  - `ephemeral`: Almacenamiento volátil para pruebas rápidas.
- **Conectividad**:
  - **Web Terminal**: Terminal interactiva xterm.js embebida directamente en la Consola Web.
  - **SSH Nativo**: Túneles inversos gratuitos (Tmate, Bore, Cloudflare Tunnel). Comando copy-paste directo: `ssh -p 2200 ubuntu@tunnel.tmate.io`.
  - **Tailscale**: Nodo efímero privado con IP `100.x.y.z`.
- **Edición Post-Creación**: Modifica TTL, nombre, variables de entorno y scripts de arranque en cualquier momento.

### Conexión SSH Persistente & Tutorial de Desconexión Rápida (Multi-Connect)

Cada HiveNode en ejecución ofrece un túnel SSH persistente que puedes reutilizar cuantas veces quieras:

```bash
# Ejemplo de conexión desde tu terminal (PowerShell, CMD, bash, VS Code)
ssh eycNGwTsndkaa6eDf4s4XgakW@sfo2.tmate.io
```

#### ⚡ Cómo Desconectarse al Instante sin Apagar el Servidor (`Detach`):
Dentro del servidor, la sesión de terminal está gestionada por un multiplexor persistente. Para salir a tu terminal local en medio segundo:
1. Pulsa **`Ctrl + B`** (a la vez).
2. Suelta ambas teclas y pulsa **`D`** (*detach*).

Tu cliente SSH local se desconectará limpiamente devolviéndote a tu prompt local (`PS C:\...`), mientras **el servidor en la nube, tus programas en ejecución y todos los archivos en `/mockhive/data` permanecen 100% activos**.

#### 🔄 Reconexión Infinita:
Para volver a entrar, simplemente **ejecuta de nuevo el mismo comando SSH**. Volverás exactamente a la misma sesión con todos tus datos y procesos intactos.

### Comandos del CLI:
```bash
# Crear un servidor virtual
mockhive nodes create --name "Dev-Worker" --lifecycle ttl_ephemeral --ttl 120 --storage vault_persistent --tunnel tmate

# Listar servidores
mockhive nodes list

# Iniciar servidor y obtener conexión SSH
mockhive nodes start <nodeId>

# Conectar por SSH
mockhive nodes ssh <nodeId>

# Editar configuración
mockhive nodes edit <nodeId> --name "Dev-Worker-Prod" --ttl 180

# Detener servidor
mockhive nodes stop <nodeId>

# Exportar workflow YAML de GitHub Actions
mockhive nodes workflow <nodeId> --output .github/workflows/node.yml
```

---

## 🐝 2. Waggles (Step Functions & State Machines)

Orquestador declarativo de grafos de ejecución y máquinas de estado compatibles con flujos de trabajo multi-acción.

### Tipos de Estados Soportados:
- `Task`: Ejecuta una tarea o invoca un PollenPod.
- `Choice`: Bifurcación condicional basada en variables de contexto (`eq`, `neq`, `gt`, `lt`, `contains`, `exists`).
- `Parallel`: Ejecución concurrente de múltiples ramas.
- `Wait`: Pausa por $N$ segundos o hasta un timestamp ISO.
- `WaitForCallback`: **Pausa para aprobación humana**. La ejecución se detiene y puede ser aprobada o rechazada con 1 clic desde la Consola Web o mediante el CLI.
- `Succeed` / `Fail`: Estados terminales con reporte de métricas.

### Comandos del CLI:
```bash
# Crear máquina de estados
mockhive waggles create --name "Data-Processing-Pipeline" --file ./pipeline.json

# Listar máquinas de estado
mockhive waggles list

# Ejecutar pipeline con payload de contexto
mockhive waggles run <waggleId> --context '{"score": 92, "user": "admin"}'

# Reanudar ejecución pausada (Aprobación humana)
mockhive waggles resume <execId> --approve
```

---

## 🌸 3. PollenPods (Micro-VMs & Serverless Políglotas)

Unidades de computación serverless atómicas bajo demanda para múltiples runtimes aislados.

### Runtimes Disponibles:
- 🐍 **Python 3.11** (con gestor de paquetes `pip`, pandas, numpy, etc.).
- 🦀 **Rust 1.78** (compilación nativa de alto rendimiento con `cargo`).
- 🐹 **Go 1.22** (binarios concurrentes ultra-ligeros).
- 🟢 **Node.js 20 LTS** (JavaScript / TypeScript).
- 🌐 **WebAssembly (WASM)** (micro-sandboxes seguros con arranque en microsegundos).
- 🐚 **Bash / Shell Script**.

### Invocación Síncrona y Métricas:
Invocación Request $\rightarrow$ Response en tiempo real con medición de latencia exacta (ms), estado de warm pool y consumo de memoria.

### Comandos del CLI:
```bash
# Crear un PollenPod
mockhive pods create --name "Fast-Hasher-Rust" --runtime rust --handler ./handler.rs

# Listar Pods registrados
mockhive pods list

# Invocar Pod con payload JSON
mockhive pods invoke <podId> --payload '{"data": ["alpha", "beta", 42]}'
```

---

## 🕸️ 4. HiveGrid (Cluster Distribuido Map-Reduce)

Convierte múltiples runners de GitHub Actions en un cluster de computación paralela masiva (*Map-Reduce*) a coste $0.

### Funcionamiento:
1. **Split**: Divide un dataset o lote de tareas en $N$ fragmentos (*Chunks*).
2. **Map**: Despacha una matriz paralela de hasta **20 runners simultáneos** en GitHub Actions.
3. **Reduce & Merge**: Un runner consolidador recopila los outputs intermedios y emite un artefacto final unificado.

### Comandos del CLI:
```bash
# Despachar job en matriz paralela (ej: 6 workers)
mockhive grid dispatch --name "Image-Embedding-Matrix" --workers 6 --runtime python3

# Listar jobs del cluster
mockhive grid list

# Ver resultado del job
mockhive grid get <jobId>
```

---

## 💻 5. Referencia Completa del CLI & SDK

| Comando | Descripción |
| :--- | :--- |
| `mockhive console [--port <p>]` | Inicia el servidor HTTP de la Consola Web SPA |
| `mockhive nodes create / list / get / edit / start / stop / ssh` | Gestión completa de servidores virtuales HiveNodes |
| `mockhive waggles create / list / get / run / resume` | Orquestación de Step Functions y aprobaciones |
| `mockhive pods create / list / get / invoke` | Creación e invocación síncrona de Micro-VMs |
| `mockhive grid dispatch / list / get` | Cluster distribuido Map-Reduce de hasta 20 runners |
| `mockhive init` | Inicializa el entorno local y el vault `.mockhive-storage` |

---

## 💡 6. Buenas y Malas Prácticas

### ✔️ Buenas Prácticas:
1. **Montar `/mockhive/data`**: Configura siempre un volumen persistente o Rolla-Ball para no perder datos al reiniciar la máquina.
2. **Utilizar TTL para Desarrollo**: Usa el modo `ttl_ephemeral` con apagado automático para tareas puntuales y ahorrar recursos.
3. **Usar PollenPods para Cálculos Rápidos**: Emplea Micro-VMs para tareas específicas de transformación sin levantar un servidor completo.
4. **Validar Máquinas de Estado**: Añade checkpoints `WaitForCallback` en pasos críticos antes de mutar bases de datos de producción.

### ❌ Malas Prácticas:
1. **Abusar del Modo 24/7 sin Supervisión**: Mantener decenas de runners en bucle continuo puede alertar los filtros de ToS de GitHub.
2. **Hardcodear Secretos en Init Scripts**: Emplea siempre GitHub Secrets (`\${{ secrets.API_KEY }}`) en lugar de texto plano.
3. **Ignorar Errores en Step Functions**: Define bloques `Retry` y `Catch` en estados `Task` propensos a fallos de red.

---

## ❓ 7. FAQ & Solución de Errores Comunes

<details>
<summary><strong>Q: ¿Cómo se conecta uno por SSH si el runner de GitHub no tiene IP pública?</strong></summary>
<p>
<strong>R:</strong> Mediante un <em>túnel inverso saliente</em>. El runner arranca una conexión segura hacia Tmate, Bore o Tailscale y expone un endpoint público o IP mesh que puedes usar desde tu terminal o desde la Web Terminal embebida.
</p>
</details>

<details>
<summary><strong>Q: ¿Qué ocurre con los datos cuando vence el límite de 6 horas en modo 24/7?</strong></summary>
<p>
<strong>R:</strong> A las 5h 45m, el runner empaqueta <code>/mockhive/data</code> en un snapshot comprimido <code>.tar.zst</code>, lo sube a GitHub Releases de <code>.mockhive-storage</code> y dispara el siguiente relevo, el cual descarga el snapshot y restaura el estado en menos de 30 segundos.
</p>
</details>

<details>
<summary><strong>Q: ¿Puedo conectar mis HiveNodes a Rolla o S3?</strong></summary>
<p>
<strong>R:</strong> Sí, MockHive incluye integración nativa para montar Rolla-Balls (incluso desde otra cuenta con PAT) o buckets compatibles con S3/R2.
</p>
</details>

---

<p align="center">
  <strong>MOCKHIVE — Terra Ecosystem</strong><br>
  Computación Cloud Efímera, Servidores Virtuales y Step Functions a Coste $0.<br>
  <a href="https://amglogicalis.github.io/mockhive-repo-public/">Abrir Consola Web Online</a>
</p>
