## Script DIA 2 MEJORADO: Agregar Rutas API
## Ejecutar desde: C:\taller-os>
## Comando: powershell -ExecutionPolicy Bypass -File scripts/dia2_rutas_api.ps1

$indexPath = "server/index.js"

Write-Host "=== DIA 2: Agregando Rutas API ===" -ForegroundColor Cyan

if (-not (Test-Path $indexPath)) {
    Write-Host "ERROR: No se encontro $indexPath" -ForegroundColor Red
    exit 1
}

$contenido = Get-Content $indexPath -Raw

# Verificar si ya existen
if ($contenido -like "*app.get('/api/operarios'*") {
    Write-Host "Las rutas ya existen. Saltando..." -ForegroundColor Yellow
    exit 0
}

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
//  RUTAS: SERVICIOS
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

$nuevoContenido = $contenido -replace "app\.listen\(PORT, \(\) => \{", ($nuevasRutas + "`n`napp.listen(PORT, () => {")

Set-Content -Path $indexPath -Value $nuevoContenido -Encoding UTF8

Write-Host "OK - Rutas API agregadas exitosamente" -ForegroundColor Green
Write-Host "Archivo: $indexPath (linea 697)" -ForegroundColor Green
