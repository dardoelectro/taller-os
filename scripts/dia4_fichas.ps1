## Script DIA 4: Mejorar Fichas (Diagnosticos, Servicios, Edicion)
## Ejecutar desde: C:\taller-os>
## Comando: powershell -ExecutionPolicy Bypass -File scripts/dia4_fichas.ps1

$htmlPath = "public/index.html"

Write-Host "=== DIA 4: Mejorando Fichas ===" -ForegroundColor Cyan

if (-not (Test-Path $htmlPath)) {
    Write-Host "ERROR: No se encontro $htmlPath" -ForegroundColor Red
    exit 1
}

$html = Get-Content $htmlPath -Raw

# Verificar si ya existe
if ($html -like "*modal-diagnostico*") {
    Write-Host "Fichas mejoradas ya existen. Saltando..." -ForegroundColor Yellow
    exit 0
}

# PARTE 1: CSS para fichas mejoradas
$cssFichas = @"

  /* FICHAS MEJORADAS STYLES */
  .servicios-box { background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin: 12px 0; }
  .servicios-box h4 { margin: 0 0 10px 0; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .servicio-item { background: var(--bg); border-left: 3px solid var(--accent); padding: 10px 12px; margin-bottom: 8px; border-radius: 4px; font-size: 13px; }
  .servicio-item strong { color: var(--text); }
  .servicio-item p { margin: 4px 0 0 0; color: var(--muted); font-size: 12px; }
  #modal-diagnostico { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; align-items: center; justify-content: center; }
  #modal-diagnostico.open { display: flex; }
  #modal-diagnostico .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; width: 100%; max-width: 700px; max-height: 90vh; overflow-y: auto; }
  .diagnostico-field { margin-bottom: 14px; }
  .diagnostico-field label { display: block; font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .diagnostico-field input[type="text"], .diagnostico-field textarea, .diagnostico-field input[type="file"] { width: 100%; padding: 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: 'DM Sans'; font-size: 13px; }
  .diagnostico-field textarea { resize: vertical; min-height: 100px; }
  .archivos-lista { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-top: 8px; }
  .archivo-item { display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--surface2); border-radius: 4px; margin-bottom: 6px; font-size: 12px; }
  .archivo-item a { color: var(--accent); text-decoration: none; }
  .archivo-item a:hover { text-decoration: underline; }
  .archivo-item .btn-eliminar { padding: 4px 8px; font-size: 10px; }

"@

$htmlActualizado = $html -replace "  /* OPERARIOS Y TALLER STYLES */", ($cssFichas + "`n  /* OPERARIOS Y TALLER STYLES */")

# PARTE 2: HTML Modal Diagnostico
$htmlDiagnostico = @"

<!-- MODAL: DIAGNOSTICO -->
<div id="modal-diagnostico" class="modal-overlay">
  <div class="modal">
    <h2>Cargar Diagnostico</h2>
    
    <div class="diagnostico-field">
      <label>Tipo de Diagnostico</label>
      <select id="diag-tipo" style="width: 100%; padding: 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 13px;">
        <option value="OBD-II">OBD-II</option>
        <option value="Electronico">Electronico</option>
        <option value="Mecanico">Mecanico</option>
        <option value="Completo">Completo</option>
        <option value="Otro">Otro</option>
      </select>
    </div>
    
    <div class="diagnostico-field">
      <label>Resultado/Observaciones</label>
      <textarea id="diag-resultado" placeholder="Descripcion del diagnostico realizado..."></textarea>
    </div>
    
    <div class="diagnostico-field">
      <label>Cargar Archivo (PDF, HTML, TXT)</label>
      <input type="file" id="diag-archivo" accept=".pdf,.html,.txt">
      <div class="archivos-lista" id="diag-archivos-lista" style="display: none;"></div>
    </div>
    
    <div class="btn-row">
      <button class="btn btn-secondary" onclick="cerrarDiagnostico()">Cancelar</button>
      <button class="btn btn-primary" onclick="guardarDiagnostico()">Guardar Diagnostico</button>
    </div>
  </div>
</div>

"@

$htmlActualizado = $htmlActualizado -replace "<!-- MODAL: OPERARIOS -->", ($htmlDiagnostico + "`n<!-- MODAL: OPERARIOS -->")

# PARTE 3: JavaScript para Fichas Mejoradas
$jsFichas = @"

// ════════════════════════════════════════════════════════════
// FICHAS MEJORADAS
// ════════════════════════════════════════════════════════════

let fichaActual = null;
let diagnosticoActual = null;

async function abrirDiagnostico(fichaId) {
  fichaActual = fichaId;
  document.getElementById('modal-diagnostico').classList.add('open');
  cargarDiagnosticoExistente();
}

function cerrarDiagnostico() {
  document.getElementById('modal-diagnostico').classList.remove('open');
  document.getElementById('diag-tipo').value = 'OBD-II';
  document.getElementById('diag-resultado').value = '';
  document.getElementById('diag-archivo').value = '';
  fichaActual = null;
}

async function cargarDiagnosticoExistente() {
  if (!fichaActual) return;
  try {
    const response = await fetch(`/api/fichas/\${fichaActual}`, { headers: getHeaders() });
    if (!response.ok) return;
    const data = await response.json();
    const { ficha } = data;
    
    if (ficha.diagnostico) {
      document.getElementById('diag-tipo').value = ficha.diagnostico.tipo || 'OBD-II';
      document.getElementById('diag-resultado').value = ficha.diagnostico.resultado_texto || '';
      
      if (ficha.diagnostico.archivos_adjuntos && ficha.diagnostico.archivos_adjuntos.length > 0) {
        mostrarArchivosAdjuntos(ficha.diagnostico.archivos_adjuntos);
      }
    }
  } catch (e) {
    console.error('Error cargando diagnostico:', e);
  }
}

function mostrarArchivosAdjuntos(archivos) {
  const lista = document.getElementById('diag-archivos-lista');
  if (!archivos.length) {
    lista.style.display = 'none';
    return;
  }
  lista.style.display = 'block';
  lista.innerHTML = '<strong style="font-size: 11px; color: var(--muted); display: block; margin-bottom: 8px;">Archivos Adjuntos:</strong>' + 
    archivos.map(a => `
      <div class="archivo-item">
        <a href="/diagnosticos/escaner/${a.nombre}" target="_blank">📄 ${a.nombre}</a>
        <button class="btn-eliminar" onclick="alert('Eliminar: implementar en backend')">X</button>
      </div>
    `).join('');
}

async function guardarDiagnostico() {
  if (!fichaActual) {
    toast('Error: no hay ficha', 'err');
    return;
  }
  
  const tipo = document.getElementById('diag-tipo').value;
  const resultado = document.getElementById('diag-resultado').value;
  
  if (!resultado) {
    toast('Resultado requerido', 'err');
    return;
  }
  
  try {
    const diagnosticoData = {
      tipo,
      resultado_texto: resultado,
      fecha: new Date().toISOString()
    };
    
    const response = await fetch(`/api/fichas/\${fichaActual}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ diagnostico: diagnosticoData })
    });
    
    if (response.ok) {
      toast('Diagnostico guardado', 'ok');
      cerrarDiagnostico();
    } else {
      toast('Error al guardar', 'err');
    }
  } catch (e) {
    toast('Error: ' + e.message, 'err');
  }
}

// Mejorar verHistorial para mostrar servicios
async function mostrarServiciosFicha(fichaId) {
  try {
    const response = await fetch(`/api/fichas/\${fichaId}`, { headers: getHeaders() });
    if (!response.ok) return '';
    const data = await response.json();
    const { servicios } = data;
    
    if (!servicios || servicios.length === 0) {
      return '<p style="color: var(--muted); font-size: 12px; margin: 0;">Sin servicios registrados</p>';
    }
    
    return servicios.map(s => `
      <div class="servicio-item">
        <strong>${s.tipo || 'Otro'}</strong>
        <p>${s.descripcion || '-'}</p>
      </div>
    `).join('');
  } catch (e) {
    return '<p style="color: var(--bad); font-size: 12px;">Error cargando servicios</p>';
  }
}

"@

$htmlActualizado = $htmlActualizado -replace "// ════════════════════════════════════════════════════════════`n// OPERARIOS", ($jsFichas + "`n`n// ════════════════════════════════════════════════════════════`n// OPERARIOS")

# Guardar archivo
Set-Content -Path $htmlPath -Value $htmlActualizado -Encoding UTF8

Write-Host "OK - Fichas mejoradas agregadas exitosamente" -ForegroundColor Green
Write-Host "Archivo: $htmlPath" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "Cambios:" -ForegroundColor Cyan
Write-Host "  + Modal Diagnostico" -ForegroundColor Green
Write-Host "  + Carga de archivos" -ForegroundColor Green
Write-Host "  + Funciones para servicios" -ForegroundColor Green
