## Script DIA 2: Agregar Rutas API OPERARIOS, TALLER, SERVICIOS
## Ejecutar desde: C:\taller-os>
## Comando: powershell -ExecutionPolicy Bypass -File scripts/dia2_rutas_api.ps1

param(
    [string]$indexPath = "server/index.js"
)

Write-Host "=== DIA 2: Agregando Rutas API ===" -ForegroundColor Cyan

# Verificar que el archivo existe
if (-not (Test-Path $indexPath)) {
    Write-Host "ERROR: No se encontro $indexPath" -ForegroundColor Red
    exit 1
}

# Leer el contenido actual
$contenido = Get-Content $indexPath -Raw

# Verificar si ya existen las rutas (evitar duplicados)
if ($contenido -contains "app.get('/api/operarios'") {
    Write-Host "Las rutas ya existen. Saltando..." -ForegroundColor Yellow
    exit 0
}

# Punto de insercion: ANTES de app.listen
$puntoInsert = "app.listen(PORT, () => {"

if (-not ($contenido -contains $puntoInsert)) {
    Write-Host "ERROR: No se encontro el punto de insercion" -ForegroundColor Red
    exit 1
}

# Nuevas rutas API
$nuevasRutas = @"

// ════════════════════════════════════════════════════════════
//  RUTAS: OPERARIOS
// ════════════════════════════════════════════════════════════

app.get('/api/operarios', verifyToken, async (req, res) => {
  try {
    const operarios = await Operario.find();
    res.json(operarios);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/operarios', verifyToken, async (req, res) => {
  try {
    const operario = await Operario.create(req.body);
    res.json(operario);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/operarios/:id', verifyToken, async (req, res) => {
  try {
    const operario = await Operario.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(operario);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/operarios/:id', verifyToken, async (req, res) => {
  try {
    await Operario.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════
//  RUTAS: TALLER
// ════════════════════════════════════════════════════════════

app.get('/api/taller', verifyToken, async (req, res) => {
  try {
    let taller = await Taller.findOne();
    if (!taller) {
      taller = await Taller.create({ nombre: 'MODUCHIP AutoElectroLab' });
    }
    res.json(taller);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/taller', verifyToken, async (req, res) => {
  try {
    let taller = await Taller.findOne();
    if (!taller) {
      taller = await Taller.create(req.body);
    } else {
      taller = await Taller.findByIdAndUpdate(taller._id, req.body, { new: true });
    }
    res.json(taller);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════
//  RUTAS: SERVICIOS (Catalogo)
// ════════════════════════════════════════════════════════════

app.get('/api/servicios', verifyToken, async (req, res) => {
  try {
    const servicios = await Servicio.find();
    res.json(servicios);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/servicios', verifyToken, async (req, res) => {
  try {
    const servicio = await Servicio.create(req.body);
    res.json(servicio);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/servicios/:id', verifyToken, async (req, res) => {
  try {
    const servicio = await Servicio.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(servicio);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/servicios/:id', verifyToken, async (req, res) => {
  try {
    await Servicio.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

"@

# Insertar las nuevas rutas
$nuevoContenido = $contenido -replace $puntoInsert, ($nuevasRutas + "`n`napp.listen(PORT, () => {")

# Guardar el archivo actualizado
Set-Content -Path $indexPath -Value $nuevoContenido -Encoding UTF8

Write-Host "OK - Rutas API agregadas exitosamente" -ForegroundColor Green
Write-Host "Archivos modificados: $indexPath" -ForegroundColor Green
