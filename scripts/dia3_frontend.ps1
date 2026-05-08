## Script DIA 3: Agregar Frontend Operarios + Config Taller
## Ejecutar desde: C:\taller-os>
## Comando: powershell -ExecutionPolicy Bypass -File scripts/dia3_frontend.ps1

$htmlPath = "public/index.html"

Write-Host "=== DIA 3: Agregando Frontend Operarios + Config Taller ===" -ForegroundColor Cyan

if (-not (Test-Path $htmlPath)) {
    Write-Host "ERROR: No se encontro $htmlPath" -ForegroundColor Red
    exit 1
}

$html = Get-Content $htmlPath -Raw

# Verificar si ya existe (evitar duplicados)
if ($html -like "*modal-operarios*") {
    Write-Host "Frontend ya existe. Saltando..." -ForegroundColor Yellow
    exit 0
}

# PARTE 1: CSS para modales
$cssOperarios = @"

  /* OPERARIOS Y TALLER STYLES */
  #modal-operarios { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; align-items: center; justify-content: center; }
  #modal-operarios.open { display: flex; }
  #modal-operarios .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; }
  .operarios-tabla { width: 100%; border-collapse: collapse; margin-top: 16px; }
  .operarios-tabla th, .operarios-tabla td { padding: 12px; text-align: left; border-bottom: 1px solid var(--border); font-size: 13px; }
  .operarios-tabla th { background: var(--surface2); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .operarios-tabla tr:hover { background: var(--surface2); }
  .operarios-tabla .btn-editar, .operarios-tabla .btn-eliminar { padding: 6px 12px; font-size: 11px; margin-right: 4px; }
  .config-taller-box { background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-top: 16px; }
  .config-taller-box h3 { margin: 0 0 12px 0; font-size: 14px; color: var(--accent); }
  .config-campo { margin-bottom: 12px; }
  .config-campo label { display: block; font-size: 11px; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .config-campo input, .config-campo textarea { width: 100%; padding: 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: 'DM Sans'; font-size: 13px; }
  .config-campo textarea { resize: vertical; min-height: 80px; }

"@

# Encontrar donde insertar CSS (antes de @media)
$htmlActualizado = $html -replace "  @media \(max-width:700px\) \{", ($cssOperarios + "`n  @media (max-width:700px) {")

# PARTE 2: HTML Modal Operarios
$htmlOperarios = @"

<!-- MODAL: OPERARIOS -->
<div id="modal-operarios" class="modal-overlay">
  <div class="modal">
    <h2>Gestionar Operarios</h2>
    
    <div class="grid-2">
      <div class="field">
        <label>Nombre</label>
        <input type="text" id="op-nombre" placeholder="Nombre completo">
      </div>
      <div class="field">
        <label>Email</label>
        <input type="email" id="op-email" placeholder="email@taller.com">
      </div>
    </div>
    
    <div class="grid-2">
      <div class="field">
        <label>Telefono</label>
        <input type="text" id="op-telefono">
      </div>
      <div class="field">
        <label>Rol</label>
        <select id="op-rol">
          <option value="tecnico_especialista">Tecnico Especialista</option>
          <option value="mecanico_general">Mecanico General</option>
          <option value="jefe_taller">Jefe Taller</option>
          <option value="recepcion">Recepcion</option>
        </select>
      </div>
    </div>
    
    <div class="field">
      <label>Especialidades (separadas por coma)</label>
      <input type="text" id="op-especialidades" placeholder="Inyeccion, Diagnostico OBD, Electronica">
    </div>
    
    <div class="field">
      <label>Disponibilidad</label>
      <input type="text" id="op-disponibilidad" placeholder="Lunes a Viernes 08:00-18:00">
    </div>
    
    <div class="field">
      <label style="display: flex; align-items: center; gap: 8px; margin-top: 12px; text-transform: none;">
        <input type="checkbox" id="op-activo" checked style="width: auto;">
        Activo
      </label>
    </div>
    
    <table class="operarios-tabla">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Email</th>
          <th>Rol</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody id="operarios-lista">
        <tr><td colspan="4" style="text-align: center; color: var(--muted);">Cargando operarios...</td></tr>
      </tbody>
    </table>
    
    <div class="btn-row">
      <button class="btn btn-secondary" onclick="cerrarOperarios()">Cerrar</button>
      <button class="btn btn-primary" onclick="guardarOperario()">Guardar Operario</button>
    </div>
  </div>
</div>

"@

# Encontrar punto de insercion para HTML (antes de <!-- MODAL: TURNO -->)
$htmlActualizado = $htmlActualizado -replace "<!-- MODAL: TURNO -->", ($htmlOperarios + "`n<!-- MODAL: TURNO -->")

# PARTE 3: JavaScript para Operarios
$jsOperarios = @"

// ════════════════════════════════════════════════════════════
// OPERARIOS
// ════════════════════════════════════════════════════════════

let operarioEditando = null;

async function abrirOperarios() {
  document.getElementById('modal-operarios').classList.add('open');
  cargarOperarios();
  limpiarFormOperario();
}

function cerrarOperarios() {
  document.getElementById('modal-operarios').classList.remove('open');
  limpiarFormOperario();
}

async function cargarOperarios() {
  try {
    const response = await fetch('/api/operarios', { headers: getHeaders() });
    if (!response.ok) return;
    const operarios = await response.json();
    
    const lista = document.getElementById('operarios-lista');
    if (!operarios.length) {
      lista.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--muted);">Sin operarios</td></tr>';
      return;
    }
    
    lista.innerHTML = operarios.map(op => `
      <tr>
        <td>${op.nombre}</td>
        <td>${op.email}</td>
        <td>${op.rol}</td>
        <td>
          <button class="btn btn-secondary" onclick="editarOperario('${op._id}')" style="padding: 4px 8px; font-size: 11px;">Editar</button>
          <button class="btn btn-secondary" onclick="eliminarOperario('${op._id}')" style="padding: 4px 8px; font-size: 11px;">Eliminar</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Error cargando operarios:', e);
  }
}

async function editarOperario(id) {
  try {
    const response = await fetch(`/api/operarios/\${id}`, { headers: getHeaders() });
    if (!response.ok) return;
    const op = await response.json();
    
    document.getElementById('op-nombre').value = op.nombre;
    document.getElementById('op-email').value = op.email;
    document.getElementById('op-telefono').value = op.telefono || '';
    document.getElementById('op-rol').value = op.rol;
    document.getElementById('op-especialidades').value = (op.especialidades || []).join(', ');
    document.getElementById('op-disponibilidad').value = op.disponibilidad || '';
    document.getElementById('op-activo').checked = op.activo !== false;
    
    operarioEditando = id;
  } catch (e) {
    toast('Error cargando operario', 'err');
  }
}

async function guardarOperario() {
  const nombre = document.getElementById('op-nombre').value.trim();
  const email = document.getElementById('op-email').value.trim();
  const rol = document.getElementById('op-rol').value;
  
  if (!nombre || !email) {
    toast('Nombre y email requeridos', 'err');
    return;
  }
  
  const datos = {
    nombre,
    email,
    telefono: document.getElementById('op-telefono').value,
    rol,
    especialidades: document.getElementById('op-especialidades').value.split(',').map(e => e.trim()).filter(e => e),
    disponibilidad: document.getElementById('op-disponibilidad').value,
    activo: document.getElementById('op-activo').checked
  };
  
  try {
    const url = operarioEditando ? `/api/operarios/\${operarioEditando}` : '/api/operarios';
    const method = operarioEditando ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: getHeaders(),
      body: JSON.stringify(datos)
    });
    
    if (response.ok) {
      toast(operarioEditando ? 'Operario actualizado' : 'Operario creado', 'ok');
      limpiarFormOperario();
      cargarOperarios();
    } else {
      toast('Error al guardar', 'err');
    }
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}

async function eliminarOperario(id) {
  if (!confirm('Eliminar este operario?')) return;
  
  try {
    const response = await fetch(`/api/operarios/\${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    
    if (response.ok) {
      toast('Operario eliminado', 'ok');
      cargarOperarios();
    }
  } catch (e) {
    toast('Error al eliminar', 'err');
  }
}

function limpiarFormOperario() {
  document.getElementById('op-nombre').value = '';
  document.getElementById('op-email').value = '';
  document.getElementById('op-telefono').value = '';
  document.getElementById('op-rol').value = 'tecnico_especialista';
  document.getElementById('op-especialidades').value = '';
  document.getElementById('op-disponibilidad').value = '';
  document.getElementById('op-activo').checked = true;
  operarioEditando = null;
}

"@

# Encontrar donde insertar JS (antes de async function checkConn)
$htmlActualizado = $htmlActualizado -replace "async function checkConn\(\) \{", ($jsOperarios + "`n`nasync function checkConn() {")

# Guardar archivo actualizado
Set-Content -Path $htmlPath -Value $htmlActualizado -Encoding UTF8

Write-Host "OK - Frontend Operarios agregado exitosamente" -ForegroundColor Green
Write-Host "Archivo: $htmlPath" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "Cambios:" -ForegroundColor Cyan
Write-Host "  + Modal CRUD Operarios" -ForegroundColor Green
Write-Host "  + Tabla de operarios" -ForegroundColor Green
Write-Host "  + Funciones JavaScript" -ForegroundColor Green
