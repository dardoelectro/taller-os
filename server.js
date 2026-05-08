require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
const QRCode   = require('qrcode');
const ExcelJS  = require('exceljs');

const {
  Cliente, Vehiculo, Ficha, Servicio, EstadoItem,
  ProximoService, Turno, Presupuesto, Foto
} = require('./models');

const app  = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/talleros';

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, '../public')));

mongoose.connect(MONGO_URI)
  .then(() => console.log('TallerOS conectado a MongoDB — http://localhost:' + PORT))
  .catch(err => { console.error('Error MongoDB:', err.message); process.exit(1); });

// ════════════════════════════════════════════
//  VEHÍCULOS
// ════════════════════════════════════════════
app.get('/api/vehiculos/buscar/:q', async (req, res) => {
  try {
    const re = new RegExp(req.params.q, 'i');
    const vehiculos = await Vehiculo.find({ dominio: re }).populate('titular_id').limit(10);
    res.json(vehiculos);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/vehiculos/:dominio', async (req, res) => {
  try {
    const v = await Vehiculo.findOne({ dominio: req.params.dominio.toUpperCase() }).populate('titular_id');
    if (!v) return res.status(404).json({ error: 'No encontrado' });
    res.json(v);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  CLIENTES
// ════════════════════════════════════════════
app.get('/api/clientes/buscar/:q', async (req, res) => {
  try {
    const re = new RegExp(req.params.q, 'i');
    const clientes = await Cliente.find({
      $or: [{ nombre: re }, { telefono: re }, { dni: re }]
    }).limit(15);
    res.json(clientes);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/clientes', async (req, res) => {
  try {
    const c = new Cliente(req.body);
    await c.save();
    res.json(c);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/clientes/:id/nota', async (req, res) => {
  try {
    const c = await Cliente.findByIdAndUpdate(req.params.id, { notas: req.body.notas }, { new: true });
    res.json(c);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  FICHAS
// ════════════════════════════════════════════
app.post('/api/fichas', async (req, res) => {
  try {
    const { ficha_data, servicios_data, estado_items } = req.body;

    let cliente = null;
    if (ficha_data.titular) {
      cliente = await Cliente.findOneAndUpdate(
        { nombre: ficha_data.titular },
        { nombre: ficha_data.titular, telefono: ficha_data.telefono||'', email: ficha_data.email||'' },
        { upsert: true, new: true }
      );
    }

    const dominio = ficha_data.dominio?.toUpperCase();
    let vehiculo = await Vehiculo.findOne({ dominio });
    if (!vehiculo) {
      const urlQR = `http://localhost:${PORT}/historial-publico/${dominio}`;
      const qrSVG = await QRCode.toString(urlQR, { type: 'svg', width: 200 });
      vehiculo = await Vehiculo.create({
        dominio, titular_id: cliente?._id, qr_codigo: qrSVG,
        tipo_vehiculo: ficha_data.tipo_vehiculo, marca: ficha_data.marca,
        modelo: ficha_data.modelo, anio: ficha_data.anio,
        tipo_caja: ficha_data.tipo_caja, combustible: ficha_data.combustible,
        chasis: ficha_data.chasis, motor: ficha_data.motor, ecu: ficha_data.ecu,
      });
    } else if (cliente && String(vehiculo.titular_id) !== String(cliente._id)) {
      if (vehiculo.titular_id) vehiculo.titulares_prev.push(vehiculo.titular_id);
      vehiculo.titular_id = cliente._id;
      await vehiculo.save();
    }

    const ficha = await Ficha.create({
      vehiculo_id: vehiculo._id, cliente_id: cliente?._id, dominio,
      fecha_ingreso: ficha_data.fecha_ingreso || new Date(),
      km_inicial: ficha_data.km_inicial, vtv: ficha_data.vtv,
      responsable: ficha_data.responsable, turno: ficha_data.turno,
      fluidos: { aceite: ficha_data.medida_aceite, frenos: ficha_data.medida_frenos, refrigerante: ficha_data.medida_refrigerante },
      accesorios: {
        baliza: ficha_data.accesorios?.includes('Baliza emergencia'),
        extintor: ficha_data.accesorios?.includes('Extintor'),
        rueda_auxilio: ficha_data.accesorios?.includes('Rueda auxilio'),
        crique: ficha_data.accesorios?.includes('Crique'),
        herramientas: ficha_data.accesorios?.includes('Herramientas'),
        botiquin: ficha_data.accesorios?.includes('Botiquín'),
        otros: ficha_data.otros_accesorios,
      },
      estado_general: ficha_data.estado_general,
      obs_visuales: ficha_data.obs_visuales,
      obs_adicionales: ficha_data.obs_adicionales,
      nota_interna: ficha_data.nota_interna,
      presupuesto_id: ficha_data.presupuesto_id || null,
    });

    if (servicios_data?.length) {
      await Servicio.insertMany(servicios_data.map(s => ({
        ficha_id: ficha._id, vehiculo_id: vehiculo._id, dominio,
        tipo: s.tipo, descripcion: s.descripcion, repuestos: s.repuestos||[],
      })));
    }

    if (estado_items?.length) {
      await EstadoItem.create({ ficha_id: ficha._id, dominio, items: estado_items });
    }

    if (ficha_data.meses_intervalo || ficha_data.km_intervalo) {
      const hoy = new Date(ficha_data.fecha_ingreso || new Date());
      let fecha_proximo = null;
      if (ficha_data.meses_intervalo) {
        fecha_proximo = new Date(hoy);
        fecha_proximo.setMonth(fecha_proximo.getMonth() + parseInt(ficha_data.meses_intervalo));
      }
      const km_proximo = ficha_data.km_intervalo && ficha_data.km_inicial
        ? parseInt(ficha_data.km_inicial) + parseInt(ficha_data.km_intervalo) : null;
      const dias = fecha_proximo ? Math.floor((fecha_proximo - new Date()) / 86400000) : 999;
      const estado = dias < 0 ? 'vencido' : dias <= 30 ? 'proximo_30' : dias <= 60 ? 'proximo_60' : 'al_dia';
      await ProximoService.findOneAndUpdate({ dominio }, {
        dominio, vehiculo_id: vehiculo._id, cliente_id: cliente?._id,
        fecha_proximo, meses_intervalo: ficha_data.meses_intervalo||null,
        km_proximo, km_intervalo: ficha_data.km_intervalo||null,
        ultimo_service: hoy, ultimo_km: ficha_data.km_inicial||null,
        nota: ficha_data.nota_service||'', estado, actualizado: new Date(),
      }, { upsert: true, new: true });
    }

    // Si viene de un presupuesto aprobado, vincular
    if (ficha_data.presupuesto_id) {
      await Presupuesto.findByIdAndUpdate(ficha_data.presupuesto_id, { ficha_id: ficha._id });
    }

    res.json({ ok: true, ficha_id: ficha._id, vehiculo_id: vehiculo._id, qr: vehiculo.qr_codigo });
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

app.put('/api/fichas/:id/estado', async (req, res) => {
  try {
    const f = await Ficha.findByIdAndUpdate(req.params.id, { estado_ficha: req.body.estado }, { new: true });
    res.json(f);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/fichas/:id/nota', async (req, res) => {
  try {
    const f = await Ficha.findByIdAndUpdate(req.params.id, { nota_interna: req.body.nota_interna }, { new: true });
    res.json(f);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/historial/:dominio', async (req, res) => {
  try {
    const dominio = req.params.dominio.toUpperCase();
    const vehiculo = await Vehiculo.findOne({ dominio }).populate('titular_id');
    if (!vehiculo) return res.status(404).json({ error: 'Vehículo no encontrado' });
    const fichas = await Ficha.find({ dominio }).sort({ fecha_ingreso: -1 });
    const historial = await Promise.all(fichas.map(async ficha => {
      const [servicios, estadoItems, fotos] = await Promise.all([
        Servicio.find({ ficha_id: ficha._id }),
        EstadoItem.findOne({ ficha_id: ficha._id }),
        Foto.find({ ficha_id: ficha._id }, 'nombre nota creado_en'),
      ]);
      return { ficha, servicios, estadoItems, fotos };
    }));
    res.json({ vehiculo, historial });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  EXPORT EXCEL — HISTORIAL DE UN VEHÍCULO
// ════════════════════════════════════════════
app.get('/api/export/historial/:dominio', async (req, res) => {
  try {
    const dominio = req.params.dominio.toUpperCase();
    const vehiculo = await Vehiculo.findOne({ dominio }).populate('titular_id');
    if (!vehiculo) return res.status(404).json({ error: 'Vehículo no encontrado' });
    const fichas = await Ficha.find({ dominio }).sort({ fecha_ingreso: 1 });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'TallerOS v3.0';
    const ws = wb.addWorksheet(`Historial ${dominio}`);

    // Encabezado del vehículo
    ws.mergeCells('A1:G1');
    ws.getCell('A1').value = `HISTORIAL — ${dominio} · ${vehiculo.marca||''} ${vehiculo.modelo||''} ${vehiculo.anio||''}`;
    ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFF6B1A' } };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } };

    ws.mergeCells('A2:G2');
    ws.getCell('A2').value = `Titular: ${vehiculo.titular_id?.nombre||'—'} · Tel: ${vehiculo.titular_id?.telefono||'—'} · Exportado: ${new Date().toLocaleDateString('es-AR')}`;
    ws.getCell('A2').font = { color: { argb: 'FF888888' }, size: 10 };
    ws.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } };

    ws.addRow([]);

    // Cabecera de tabla
    const hdrRow = ws.addRow(['Fecha', 'KM', 'Estado', 'Trabajos realizados', 'Turno / Mecánico', 'Obs. adicionales', 'Nota interna']);
    hdrRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B1A' } };
      cell.alignment = { vertical: 'middle' };
    });

    const estadoLabel = { recibido:'Recibido', en_proceso:'En proceso', listo:'Listo', entregado:'Entregado' };

    for (const ficha of fichas) {
      const servicios = await Servicio.find({ ficha_id: ficha._id });
      const trabajos = servicios.map(s => s.descripcion).join(' / ') || '—';
      const row = ws.addRow([
        new Date(ficha.fecha_ingreso).toLocaleDateString('es-AR'),
        ficha.km_inicial ? parseInt(ficha.km_inicial).toLocaleString() + ' km' : '—',
        estadoLabel[ficha.estado_ficha] || '—',
        trabajos,
        ficha.turno || '—',
        ficha.obs_adicionales || '',
        ficha.nota_interna || '',
      ]);
      row.getCell(7).font = { color: { argb: 'FFF59E0B' } }; // nota interna en amarillo
    }

    // Ancho de columnas
    ws.columns = [
      { width: 13 }, { width: 12 }, { width: 13 },
      { width: 45 }, { width: 20 }, { width: 30 }, { width: 30 },
    ];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="historial_${dominio}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  EXPORT EXCEL — TODOS LOS INGRESOS (dashboard)
// ════════════════════════════════════════════
app.get('/api/export/ingresos', async (req, res) => {
  try {
    const fichas = await Ficha.find().sort({ fecha_ingreso: -1 }).limit(500);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'TallerOS v3.0';
    const ws = wb.addWorksheet('Ingresos');

    ws.mergeCells('A1:H1');
    ws.getCell('A1').value = `REGISTRO DE INGRESOS — TallerOS v3.0 · ${new Date().toLocaleDateString('es-AR')}`;
    ws.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FFFF6B1A' } };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } };
    ws.addRow([]);

    const hdr = ws.addRow(['Fecha', 'Patente', 'Titular', 'Teléfono', 'KM', 'Estado', 'Turno', 'Obs.']);
    hdr.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B1A' } };
    });

    const estadoLabel = { recibido:'Recibido', en_proceso:'En proceso', listo:'Listo', entregado:'Entregado' };

    for (const f of fichas) {
      let titular = '—', telefono = '—';
      if (f.cliente_id) {
        const c = await Cliente.findById(f.cliente_id);
        titular  = c?.nombre  || '—';
        telefono = c?.telefono || '—';
      }
      ws.addRow([
        new Date(f.fecha_ingreso).toLocaleDateString('es-AR'),
        f.dominio || '—',
        titular, telefono,
        f.km_inicial ? parseInt(f.km_inicial).toLocaleString() + ' km' : '—',
        estadoLabel[f.estado_ficha] || '—',
        f.turno || '—',
        f.obs_adicionales || '',
      ]);
    }

    ws.columns = [
      { width: 13 }, { width: 11 }, { width: 25 }, { width: 16 },
      { width: 12 }, { width: 13 }, { width: 20 }, { width: 35 },
    ];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="ingresos_talleros.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  EXPORT EXCEL — TURNOS DE UNA SEMANA
// ════════════════════════════════════════════
app.get('/api/export/turnos/:fechaInicio', async (req, res) => {
  try {
    const ini = new Date(req.params.fechaInicio); ini.setHours(0,0,0,0);
    const fin = new Date(ini); fin.setDate(fin.getDate()+6); fin.setHours(23,59,59,999);
    const turnos = await Turno.find({ fecha: { $gte: ini, $lte: fin } }).sort({ fecha: 1, hora: 1 });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Turnos');

    ws.mergeCells('A1:F1');
    ws.getCell('A1').value = `TURNOS — Semana del ${ini.toLocaleDateString('es-AR')} al ${fin.toLocaleDateString('es-AR')}`;
    ws.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FFFF6B1A' } };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } };
    ws.addRow([]);

    const hdr = ws.addRow(['Fecha', 'Hora', 'Cliente', 'Teléfono', 'Trabajo', 'Estado']);
    hdr.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B1A' } };
    });

    const estadoLabel = { pendiente:'Pendiente', confirmado:'Confirmado', atendido:'Atendido', cancelado:'Cancelado' };
    for (const t of turnos) {
      ws.addRow([
        new Date(t.fecha).toLocaleDateString('es-AR'),
        t.hora, t.titular||'—', t.telefono||'—', t.trabajo||'—',
        estadoLabel[t.estado]||'—',
      ]);
    }

    ws.columns = [{ width:13 },{ width:8 },{ width:25 },{ width:16 },{ width:35 },{ width:13 }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="turnos_semana.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  PRESUPUESTOS
// ════════════════════════════════════════════
app.post('/api/presupuestos', async (req, res) => {
  try {
    const { dominio, titular, telefono, items, notas, descuento } = req.body;
    let vehiculo_id = null, cliente_id = null;
    if (dominio) {
      const v = await Vehiculo.findOne({ dominio: dominio.toUpperCase() }).populate('titular_id');
      if (v) { vehiculo_id = v._id; cliente_id = v.titular_id?._id || null; }
    }
    const p = new Presupuesto({
      dominio: dominio?.toUpperCase(), vehiculo_id, cliente_id,
      titular, telefono, items: items || [], notas, descuento: descuento || 0,
    });
    await p.save();
    res.json(p);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/presupuestos', async (req, res) => {
  try {
    const ps = await Presupuesto.find().sort({ creado_en: -1 }).limit(50);
    res.json(ps);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/presupuestos/:id', async (req, res) => {
  try {
    const p = await Presupuesto.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'No encontrado' });
    res.json(p);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/presupuestos/:id', async (req, res) => {
  try {
    const p = await Presupuesto.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'No encontrado' });
    ['dominio','titular','telefono','items','notas','descuento','estado'].forEach(c => {
      if (req.body[c] !== undefined) p[c] = req.body[c];
    });
    await p.save();
    res.json(p);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Aprobar y preparar datos para convertir en ficha
app.post('/api/presupuestos/:id/aprobar', async (req, res) => {
  try {
    const p = await Presupuesto.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'No encontrado' });
    p.estado = 'aprobado';
    await p.save();
    // Devolver datos pre-cargados para la ficha
    let vehiculo = null;
    if (p.dominio) vehiculo = await Vehiculo.findOne({ dominio: p.dominio }).populate('titular_id');
    res.json({
      ok: true,
      presupuesto: p,
      prefill: {
        dominio:   p.dominio || '',
        titular:   p.titular || vehiculo?.titular_id?.nombre || '',
        telefono:  p.telefono || vehiculo?.titular_id?.telefono || '',
        marca_modelo: vehiculo ? `${vehiculo.marca||''} ${vehiculo.modelo||''}`.trim() : '',
        anio:      vehiculo?.anio || '',
        combustible: vehiculo?.combustible || '',
        tipo_caja: vehiculo?.tipo_caja || '',
        arreglos_descripcion: p.items.map(i => i.descripcion).join('\n'),
        presupuesto_id: p._id,
      }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  FOTOS
// ════════════════════════════════════════════
app.post('/api/fotos', async (req, res) => {
  try {
    const { ficha_id, presupuesto_id, dominio, fotos } = req.body;
    if (!fotos?.length) return res.status(400).json({ error: 'Sin fotos' });
    const docs = fotos.map(f => ({
      ficha_id, presupuesto_id, dominio: dominio?.toUpperCase(),
      data: f.data, mime_type: f.mime_type || 'image/jpeg',
      nombre: f.nombre || 'foto.jpg', nota: f.nota || '',
    }));
    const guardadas = await Foto.insertMany(docs);
    res.json({ ok: true, count: guardadas.length, ids: guardadas.map(f => f._id) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/fotos/ficha/:ficha_id', async (req, res) => {
  try {
    const fotos = await Foto.find({ ficha_id: req.params.ficha_id });
    res.json(fotos);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/fotos/:id', async (req, res) => {
  try {
    await Foto.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  ALERTAS
// ════════════════════════════════════════════
app.get('/api/alertas', async (req, res) => {
  try {
    const hoy = new Date(), en30 = new Date(), en60 = new Date();
    en30.setDate(en30.getDate()+30); en60.setDate(en60.getDate()+60);
    await ProximoService.updateMany({ fecha_proximo: { $lt: hoy } },             { estado:'vencido'    });
    await ProximoService.updateMany({ fecha_proximo: { $gte:hoy,  $lte:en30 } }, { estado:'proximo_30' });
    await ProximoService.updateMany({ fecha_proximo: { $gt: en30, $lte:en60 } }, { estado:'proximo_60' });
    await ProximoService.updateMany({ fecha_proximo: { $gt: en60 } },            { estado:'al_dia'     });
    const alertas = await ProximoService.find({ estado:{$in:['vencido','proximo_30','proximo_60']} })
      .populate('vehiculo_id').populate('cliente_id').sort({ fecha_proximo:1 });
    res.json(alertas);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/alertas/:dominio', async (req, res) => {
  try {
    const ps = await ProximoService.findOne({ dominio: req.params.dominio.toUpperCase() });
    res.json(ps || null);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/alertas/:dominio', async (req, res) => {
  try {
    const dominio = req.params.dominio.toUpperCase();
    const { meses_intervalo, km_intervalo, nota, fecha_proximo, km_proximo } = req.body;
    const hoy = new Date();
    let estado = 'al_dia';
    if (fecha_proximo) {
      const dias = Math.floor((new Date(fecha_proximo) - hoy) / 86400000);
      estado = dias < 0 ? 'vencido' : dias <= 30 ? 'proximo_30' : dias <= 60 ? 'proximo_60' : 'al_dia';
    }
    const ps = await ProximoService.findOneAndUpdate({ dominio },
      { meses_intervalo, km_intervalo, nota, fecha_proximo, km_proximo, estado, actualizado: new Date() },
      { new: true });
    res.json(ps);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  TURNOS
// ════════════════════════════════════════════
app.get('/api/turnos/dia/:fecha', async (req, res) => {
  try {
    const ini = new Date(req.params.fecha); ini.setHours(0,0,0,0);
    const fin = new Date(ini); fin.setHours(23,59,59,999);
    const turnos = await Turno.find({ fecha:{$gte:ini,$lte:fin} }).sort({ hora:1 });
    res.json(turnos);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/turnos/semana/:fechaInicio', async (req, res) => {
  try {
    const ini = new Date(req.params.fechaInicio); ini.setHours(0,0,0,0);
    const fin = new Date(ini); fin.setDate(fin.getDate()+6); fin.setHours(23,59,59,999);
    const turnos = await Turno.find({ fecha:{$gte:ini,$lte:fin} }).sort({ fecha:1, hora:1 });
    res.json(turnos);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Turnos de los próximos 2 días (para recordatorios WhatsApp)
app.get('/api/turnos/recordatorios', async (req, res) => {
  try {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const en2 = new Date(hoy); en2.setDate(en2.getDate()+2); en2.setHours(23,59,59,999);
    const turnos = await Turno.find({
      fecha: { $gte: hoy, $lte: en2 },
      estado: { $in: ['pendiente','confirmado'] },
      telefono: { $exists: true, $ne: '' },
    }).sort({ fecha:1, hora:1 });
    res.json(turnos);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/turnos', async (req, res) => {
  try {
    let vehiculo_id=null, cliente_id=null;
    if (req.body.dominio) {
      const v = await Vehiculo.findOne({ dominio: req.body.dominio.toUpperCase() }).populate('titular_id');
      if (v) {
        vehiculo_id = v._id; cliente_id = v.titular_id?._id||null;
        if (!req.body.titular   && v.titular_id?.nombre)   req.body.titular   = v.titular_id.nombre;
        if (!req.body.telefono  && v.titular_id?.telefono) req.body.telefono  = v.titular_id.telefono;
      }
    }
    const t = await Turno.create({ ...req.body, vehiculo_id, cliente_id, dominio: req.body.dominio?.toUpperCase() });
    res.json(t);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/turnos/:id', async (req, res) => {
  try {
    const t = await Turno.findByIdAndUpdate(req.params.id, req.body, { new:true });
    res.json(t);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/turnos/:id', async (req, res) => {
  try { await Turno.findByIdAndDelete(req.params.id); res.json({ ok:true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  QR — HISTORIAL PÚBLICO
// ════════════════════════════════════════════
app.get('/historial-publico/:dominio', async (req, res) => {
  try {
    const dominio = req.params.dominio.toUpperCase();
    const vehiculo = await Vehiculo.findOne({ dominio }).populate('titular_id');
    if (!vehiculo) return res.send(`<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>Vehículo ${dominio} no encontrado</h2></body></html>`);
    const fichas = await Ficha.find({ dominio }).sort({ fecha_ingreso:1 });
    const rows = await Promise.all(fichas.map(async f => {
      const servicios = await Servicio.find({ ficha_id: f._id });
      const tags = servicios.map(s=>`<span style="background:#ff6b1a22;color:#ff6b1a;padding:3px 10px;border-radius:20px;font-size:12px;margin:2px;">${s.descripcion}</span>`).join('');
      return `<div style="border:1px solid #eee;border-radius:10px;padding:16px;margin-bottom:12px;">
        <div style="font-size:12px;color:#888;">${new Date(f.fecha_ingreso).toLocaleDateString('es-AR')} · ${f.turno||''}</div>
        <div style="font-weight:600;font-size:15px;margin:4px 0;">${f.km_inicial?parseInt(f.km_inicial).toLocaleString()+' km':''}</div>
        <div>${tags}</div>
        ${f.obs_adicionales?`<div style="font-size:12px;color:#666;margin-top:8px;">${f.obs_adicionales}</div>`:''}
      </div>`;
    }));
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Historial ${dominio}</title>
      <style>body{font-family:'Segoe UI',sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#f9f9f9;}.hdr{background:#0f0f0f;color:white;padding:20px;border-radius:12px;margin-bottom:20px;text-align:center;}.pat{font-size:32px;font-weight:900;letter-spacing:4px;color:#ff6b1a;}</style>
      </head><body>
      <div class="hdr"><div style="font-size:12px;letter-spacing:2px;color:#aaa;margin-bottom:4px;">TALLEROS</div>
      <div class="pat">${dominio}</div>
      <div style="font-size:14px;color:#ccc;margin-top:4px;">${vehiculo.marca||''} ${vehiculo.modelo||''} ${vehiculo.anio||''}</div>
      <div style="font-size:12px;color:#888;margin-top:2px;">Titular: ${vehiculo.titular_id?.nombre||'—'}</div></div>
      <h3 style="font-size:14px;color:#666;text-transform:uppercase;letter-spacing:1px;">Historial (${fichas.length} visitas)</h3>
      ${rows.join('')||'<p style="color:#aaa;">Sin servicios registrados.</p>'}
    </body></html>`);
  } catch(e) { res.status(500).send('<p>Error.</p>'); }
});

// ════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════
app.get('/api/dashboard', async (req, res) => {
  try {
    const ini_mes  = new Date(); ini_mes.setDate(1); ini_mes.setHours(0,0,0,0);
    const hoy_ini  = new Date(); hoy_ini.setHours(0,0,0,0);
    const hoy_fin  = new Date(); hoy_fin.setHours(23,59,59,999);
    const [total_fichas, total_vehiculos, fichas_mes, alertas_count, turnos_hoy, ultimas, presup_pendientes] = await Promise.all([
      Ficha.countDocuments(),
      Vehiculo.countDocuments(),
      Ficha.countDocuments({ fecha_ingreso:{$gte:ini_mes} }),
      ProximoService.countDocuments({ estado:{$in:['vencido','proximo_30','proximo_60']} }),
      Turno.find({ fecha:{$gte:hoy_ini,$lte:hoy_fin}, estado:{$ne:'cancelado'} }).sort({ hora:1 }),
      Ficha.find().sort({ fecha_ingreso:-1 }).limit(5),
      Presupuesto.countDocuments({ estado:{$in:['borrador','enviado']} }),
    ]);
    const en_taller = await Ficha.find({ estado_ficha:{$in:['recibido','en_proceso','listo']} })
      .sort({ fecha_ingreso:-1 }).limit(20);
    res.json({ total_fichas, total_vehiculos, fichas_mes, alertas_count, turnos_hoy, ultimas, presup_pendientes, en_taller });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Dashboard mensual — fichas por mes, últimos 6 meses
app.get('/api/dashboard/mensual', async (req, res) => {
  try {
    const resultado = [];
    const hoy = new Date();
    for (let i = 5; i >= 0; i--) {
      const ini = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 0, 23, 59, 59);
      const count = await Ficha.countDocuments({ fecha_ingreso: { $gte: ini, $lte: fin } });
      const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      resultado.push({ mes: meses[ini.getMonth()], anio: ini.getFullYear(), count });
    }
    res.json(resultado);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  MECÁNICOS — CARGA DE TRABAJO
// ════════════════════════════════════════════

// Devuelve fichas activas (recibido/en_proceso/listo) agrupadas por mecánico
app.get('/api/mecanicos/carga', async (req, res) => {
  try {
    const fichas = await Ficha.find({
      estado_ficha: { $in: ['recibido', 'en_proceso', 'listo'] },
      turno:        { $exists: true, $ne: '' },
    }).sort({ fecha_ingreso: 1 });

    // Agrupar por el texto del campo turno (extraemos el mecánico)
    const mapa = {};
    for (const f of fichas) {
      // El campo turno tiene cosas como "Turno mañana — Juan" o solo "Juan"
      // Usamos el campo completo como clave — el usuario decide cómo escribirlo
      const clave = (f.turno || 'Sin asignar').trim();
      if (!mapa[clave]) mapa[clave] = [];
      mapa[clave].push(f);
    }

    // Fichas sin mecánico asignado (campo turno vacío)
    const sinAsignar = await Ficha.find({
      estado_ficha: { $in: ['recibido', 'en_proceso', 'listo'] },
      $or: [{ turno: '' }, { turno: { $exists: false } }],
    }).sort({ fecha_ingreso: 1 });

    if (sinAsignar.length) mapa['Sin asignar'] = sinAsignar;

    // Convertir a array ordenado por cantidad desc
    const resultado = Object.entries(mapa).map(([mecanico, fichas]) => ({
      mecanico,
      total: fichas.length,
      recibido:   fichas.filter(f => f.estado_ficha === 'recibido').length,
      en_proceso: fichas.filter(f => f.estado_ficha === 'en_proceso').length,
      listo:      fichas.filter(f => f.estado_ficha === 'listo').length,
      fichas: fichas.map(f => ({
        _id:          f._id,
        dominio:      f.dominio,
        estado_ficha: f.estado_ficha,
        fecha_ingreso:f.fecha_ingreso,
        obs_adicionales: f.obs_adicionales,
      })),
    })).sort((a, b) => b.total - a.total);

    res.json(resultado);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════
//  BACKUP COMPLETO DE LA BD → JSON
// ════════════════════════════════════════════
app.get('/api/backup', async (req, res) => {
  try {
    const [clientes, vehiculos, fichas, servicios, estadoItems,
           proximoService, turnos, presupuestos, fotos] = await Promise.all([
      Cliente.find().lean(),
      Vehiculo.find().lean(),
      Ficha.find().lean(),
      Servicio.find().lean(),
      EstadoItem.find().lean(),
      ProximoService.find().lean(),
      Turno.find().lean(),
      Presupuesto.find().lean(),
      Foto.find().lean(),   // incluye base64 — puede ser grande
    ]);

    const backup = {
      meta: {
        version:     'TallerOS v3.0',
        fecha:       new Date().toISOString(),
        totales: {
          clientes:       clientes.length,
          vehiculos:      vehiculos.length,
          fichas:         fichas.length,
          servicios:      servicios.length,
          turnos:         turnos.length,
          presupuestos:   presupuestos.length,
          fotos:          fotos.length,
        },
      },
      clientes, vehiculos, fichas, servicios,
      estadoItems, proximoService, turnos, presupuestos, fotos,
    };

    const fecha = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="talleros_backup_${fecha}.json"`);
    res.json(backup);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Backup sin fotos (más liviano, para uso frecuente)
app.get('/api/backup/sin-fotos', async (req, res) => {
  try {
    const [clientes, vehiculos, fichas, servicios, estadoItems,
           proximoService, turnos, presupuestos] = await Promise.all([
      Cliente.find().lean(),
      Vehiculo.find().lean(),
      Ficha.find().lean(),
      Servicio.find().lean(),
      EstadoItem.find().lean(),
      ProximoService.find().lean(),
      Turno.find().lean(),
      Presupuesto.find().lean(),
    ]);

    const backup = {
      meta: {
        version: 'TallerOS v3.0',
        fecha:   new Date().toISOString(),
        nota:    'Backup sin fotos — para restaurar fotos usar /api/backup completo',
        totales: {
          clientes: clientes.length, vehiculos: vehiculos.length,
          fichas: fichas.length, servicios: servicios.length,
          turnos: turnos.length, presupuestos: presupuestos.length,
        },
      },
      clientes, vehiculos, fichas, servicios,
      estadoItems, proximoService, turnos, presupuestos,
    };

    const fecha = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="talleros_backup_${fecha}_sin_fotos.json"`);
    res.json(backup);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`TallerOS v3.0 en http://localhost:${PORT}`));
