## Script DIA 5 CORREGIDO: Historial Publico Profesional
## Ejecutar desde: C:\taller-os>
## Comando: powershell -ExecutionPolicy Bypass -File scripts/dia5_historial_publico.ps1

$indexPath = "server/index.js"

Write-Host "=== DIA 5: Mejorando Historial Publico ===" -ForegroundColor Cyan

if (-not (Test-Path $indexPath)) {
    Write-Host "ERROR: No se encontro $indexPath" -ForegroundColor Red
    exit 1
}

$contenido = Get-Content $indexPath -Raw

# Verificar si ya existe
if ($contenido -like "*historial-publico mejorado*") {
    Write-Host "Historial publico mejorado ya existe. Saltando..." -ForegroundColor Yellow
    exit 0
}

# Crear archivo temporal con la nueva ruta
$tempFile = "server/historial_publico_ruta.js"

$nuevaRuta = @'
// RUTA: HISTORIAL PUBLICO PROFESIONAL (con logo y datos)
app.get('/historial-publico/:dominio', async (req, res) => {
  try {
    const vehiculo = await Vehiculo.findOne({ dominio: req.params.dominio.toUpperCase() });
    if (!vehiculo) return res.status(404).send('<h1>Vehiculo no encontrado</h1>');
    
    const fichas = await Ficha.find({ vehiculo_id: vehiculo._id })
      .populate('cliente_id')
      .sort({ fecha_ingreso: -1 });
    
    const taller = await Taller.findOne();
    
    const desarrollado = 'Este software fue desarrollado por <a href="https://autoelectrolab.com/" target="_blank" style="color: #00d4ff; text-decoration: none;">AutoElectroLab.com</a>';
    
    let fichasHTML = '';
    fichas.forEach((f, idx) => {
      const numFicha = fichas.length - idx;
      const fecha = new Date(f.fecha_ingreso).toLocaleDateString('es-AR');
      const estado = f.estado_ficha || 'RECIBIDO';
      const responsable = f.responsable || '-';
      const kmFinal = f.km_final || '-';
      
      fichasHTML += `
      <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px; page-break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 2px solid var(--accent); padding-bottom: 12px;">
          <div>
            <div style="font-family: 'Bebas Neue'; font-size: 24px; letter-spacing: 2px; color: var(--accent);">FICHA #${numFicha}</div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">${fecha}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px;">${estado}</div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; font-size: 13px;">
          <div>
            <div style="color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Responsable</div>
            <div style="color: var(--text);">${responsable}</div>
          </div>
          <div>
            <div style="color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">KM Final</div>
            <div style="color: var(--text);">${kmFinal} km</div>
          </div>
        </div>
      </div>`;
    });
    
    const logoHtml = taller && taller.logo_url ? `<img src="${taller.logo_url}" alt="Logo">` : '';
    const nombreTaller = taller ? taller.nombre : 'TallerOS';
    const emailTaller = taller && taller.email ? `<div>Email: ${taller.email}</div>` : '';
    const telTaller = taller && taller.telefono ? `<div>Tel: ${taller.telefono}</div>` : '';
    const ubicTaller = taller && taller.ubicacion ? `<div>Ubicacion: ${taller.ubicacion}</div>` : '';
    
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Historia Clinica - ${vehiculo.dominio}</title>
        <style>
          :root {
            --bg: #0a0e27;
            --surface: #141829;
            --surface2: #1a1f3a;
            --border: #2a3354;
            --text: #e8e8ff;
            --muted: #888ba6;
            --accent: #00d4ff;
            --good: #00ff88;
            --bad: #ff4444;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); padding: 20px; line-height: 1.6; }
          .container { max-width: 900px; margin: 0 auto; }
          header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid var(--accent); }
          .logo-taller { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
          .logo-taller img { height: 60px; }
          .logo-taller .nombre { font-family: 'Bebas Neue'; font-size: 28px; letter-spacing: 2px; color: var(--accent); }
          .datos-taller { font-size: 12px; color: var(--muted); margin-top: 12px; }
          .datos-taller div { margin: 4px 0; }
          h1 { font-family: 'Bebas Neue'; font-size: 32px; letter-spacing: 3px; margin: 20px 0 10px 0; }
          .vehiculo-info { background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 30px; }
          .vehiculo-info h2 { font-size: 20px; margin-bottom: 12px; }
          .vehiculo-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; font-size: 13px; }
          .vehiculo-grid div { background: var(--bg); padding: 10px; border-radius: 6px; border-left: 3px solid var(--accent); }
          .vehiculo-grid strong { color: var(--accent); display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
          .credito { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 12px; color: var(--muted); }
          .credito a { color: var(--accent); text-decoration: none; }
          @media (max-width: 768px) {
            .vehiculo-grid { grid-template-columns: 1fr; }
            .logo-taller { flex-direction: column; }
            h1 { font-size: 24px; }
          }
          @media print {
            body { padding: 0; }
            .container { max-width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <div class="logo-taller">
              ${logoHtml}
              <div>
                <div class="nombre">${nombreTaller}</div>
                <div class="datos-taller">
                  ${emailTaller}
                  ${telTaller}
                  ${ubicTaller}
                </div>
              </div>
            </div>
            <h1>HISTORIA CLINICA DEL VEHICULO</h1>
          </header>
          
          <div class="vehiculo-info">
            <h2 style="font-family: 'Bebas Neue'; font-size: 24px; letter-spacing: 2px; color: var(--accent);">${vehiculo.dominio}</h2>
            <div class="vehiculo-grid">
              <div><strong>Marca</strong> ${vehiculo.marca} ${vehiculo.modelo}</div>
              <div><strong>Anio</strong> ${vehiculo.anio}</div>
              <div><strong>Tipo</strong> ${vehiculo.tipo_vehiculo}</div>
              <div><strong>Propietario</strong> ${vehiculo.titular || 'N/A'}</div>
              <div><strong>Motor</strong> ${vehiculo.motor || 'N/A'}</div>
              <div><strong>Color</strong> ${vehiculo.color || 'N/A'}</div>
            </div>
          </div>
          
          ${fichasHTML}
          
          <div class="credito">
            ${desarrollado}
          </div>
        </div>
      </body>
      </html>
    `;
    
    res.send(html);
  } catch (e) {
    res.status(500).send('<h1>Error: ' + e.message + '</h1>');
  }
});
'@

# Guardar en archivo temporal
Set-Content -Path $tempFile -Value $nuevaRuta -Encoding UTF8

# Leer la ruta desde el archivo temporal
$rutaAInsertar = Get-Content $tempFile -Raw

# Insertar en index.js (antes de app.listen)
$nuevoContenido = $contenido -replace "app\.listen\(PORT, \(\) => \{", ($rutaAInsertar + "`n`napp.listen(PORT, () => {")

Set-Content -Path $indexPath -Value $nuevoContenido -Encoding UTF8

# Eliminar archivo temporal
Remove-Item $tempFile -Force

Write-Host "OK - Historial publico profesional agregado" -ForegroundColor Green
Write-Host "Archivo: $indexPath" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "Cambios:" -ForegroundColor Cyan
Write-Host "  + Ruta GET /historial-publico/:dominio" -ForegroundColor Green
Write-Host "  + HTML profesional con logo y datos" -ForegroundColor Green
Write-Host "  + Credito AutoElectroLab.com" -ForegroundColor Green
Write-Host "  + Historia clinica completa" -ForegroundColor Green
Write-Host "  + Responsive y printable" -ForegroundColor Green
