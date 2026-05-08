// ============================================================
//  SERVIDOR PRINCIPAL — TallerOS
//  Archivo: server/index.js
//  Uso: node server/index.js
// ============================================================

require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const path      = require('path');
const QRCode    = require('qrcode');

const { Cliente, Vehiculo, Ficha, Servicio, EstadoItem, ProximoService, Turno } = require('./models');

const app  = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/talleros';

// ─── Middlewares ──────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── Conectar a MongoDB ───────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB:', MONGO_URI);
    console.log('🔧 TallerOS corriendo en http://localhost:' + PORT);
  })
  .catch(err => {
    console.error('❌ Error al conectar MongoDB:', err.message);
    console.error('   Asegurate de que MongoDB esté corriendo (mongod)');
    process.exit(1);
  });

// ════════════════════════════════════════════════════════════
//  RUTAS: VEHÍCULOS
// ════════════════════════════════════════════════════════════

// Buscar por patente (búsqueda parcial)
app.get('/api/vehiculos/buscar/:patente', async (req, res) => {
  try {
    const regex = new RegExp(req.params.patente, 'i');
    const vehiculos = await Vehiculo.find({ dominio: regex })
      .populate('titular_id')
      .limit(10);
    res.json(vehiculos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Obtener vehículo por patente exacta (para el QR)
app.get('/api/vehiculos/:dominio', async (req, res) => {
  try {
    const v = await Vehiculo.findOne({ dominio: req.params.dominio.toUpperCase() })
      .populate('titular_id');
    if (!v) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(v);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Crear o actualizar vehículo
app.post('/api/vehiculos', async (req, res) => {
  try {
    const dominio = req.body.dominio?.toUpperCase();
    if (!dominio) return res.status(400).json({ error: 'Dominio requerido' });

    let vehiculo = await Vehiculo.findOne({ dominio });

    if (!vehiculo) {
      // Es nuevo — generar QR
      const urlQR = `http://localhost:${PORT}/historial-publico/${dominio}`;
      const qrSVG = await QRCode.toString(urlQR, { type: 'svg', width: 200 });

      vehiculo = new Vehiculo({ ...req.body, dominio, qr_codigo: qrSVG });
    } else {
      // Actualizar datos (sin pisar el QR ni el historial de titulares)
      const campos = ['tipo_vehiculo','marca','modelo','anio','tipo_caja',
                      'combustible','chasis','motor','ecu','color'];
      campos.forEach(c => { if (req.body[c] !== undefined) vehiculo[c] = req.body[c]; });
    }

    await vehiculo.save();
    res.json(vehiculo);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════
//  RUTAS: CLIENTES
// ════════════════════════════════════════════════════════════

app.get('/api/clientes/buscar/:nombre', async (req, res) => {
  try {
    const regex = new RegExp(req.params.nombre, 'i');
    const clientes = await Cliente.find({
      $or: [{ nombre: regex }, { telefono: regex }]
    }).limit(10);
    res.json(clientes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/clientes', async (req, res) => {
  try {
    const cliente = new Cliente(req.body);
    await cliente.save();
    res.json(cliente);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════
//  RUTAS: FICHAS
// ════════════════════════════════════════════════════════════

// Guardar ficha completa (recepción)
app.post('/api/fichas', async (req, res) => {
  try {
    const { ficha_data, servicios_data, estado_items } = req.body;

    // 1. Buscar o crear cliente
    let cliente = null;
    if (ficha_data.titular) {
      cliente = await Cliente.findOneAndUpdate(
        { nombre: ficha_data.titular },
        {
          nombre:   ficha_data.titular,
          telefono: ficha_data.telefono || '',
          email:    ficha_data.email || '',
        },
        { upsert: true, new: true }
      );
    }

    // 2. Buscar o crear vehículo
    const dominio = ficha_data.dominio?.toUpperCase();
    let vehiculo = await Vehiculo.findOne({ dominio });
    if (!vehiculo) {
      const urlQR = `http://localhost:${PORT}/historial-publico/${dominio}`;
      const qrSVG = await QRCode.toString(urlQR, { type: 'svg', width: 200 });
      vehiculo = await Vehiculo.create({
        dominio,
        tipo_vehiculo: ficha_data.tipo_vehiculo,
        marca:         ficha_data.marca,
        modelo:        ficha_data.modelo,
        anio:          ficha_data.anio,
        tipo_caja:     ficha_data.tipo_caja,
        combustible:   ficha_data.combustible,
        chasis:        ficha_data.chasis,
        motor:         ficha_data.motor,
        ecu:           ficha_data.ecu,
        titular_id:    cliente?._id,
        qr_codigo:     qrSVG,
      });
    } else {
      // Actualizar titular si cambió
      if (cliente && String(vehiculo.titular_id) !== String(cliente._id)) {
        if (vehiculo.titular_id) vehiculo.titulares_prev.push(vehiculo.titular_id);
        vehiculo.titular_id = cliente._id;
        await vehiculo.save();
      }
    }

    // 3. Crear la ficha
    const ficha = await Ficha.create({
      vehiculo_id:    vehiculo._id,
      cliente_id:     cliente?._id,
      dominio,
      fecha_ingreso:  ficha_data.fecha_ingreso || new Date(),
      km_inicial:     ficha_data.km_inicial,
      vtv:            ficha_data.vtv,
      responsable:    ficha_data.responsable,
      turno:          ficha_data.turno,
      fluidos: {
        aceite:       ficha_data.medida_aceite,
        frenos:       ficha_data.medida_frenos,
        refrigerante: ficha_data.medida_refrigerante,
      },
      accesorios: {
        baliza:        ficha_data.accesorios?.includes('Baliza emergencia'),
        extintor:      ficha_data.accesorios?.includes('Extintor'),
        rueda_auxilio: ficha_data.accesorios?.includes('Rueda auxilio'),
        crique:        ficha_data.accesorios?.includes('Crique'),
        herramientas:  ficha_data.accesorios?.includes('Herramientas'),
        botiquin:      ficha_data.accesorios?.includes('Botiquín'),
        otros:         ficha_data.otros_accesorios,
      },
      estado_general:  ficha_data.estado_general,
      obs_visuales:    ficha_data.obs_visuales,
      obs_adicionales: ficha_data.obs_adicionales,
    });

    // 4. Guardar servicios
    if (servicios_data?.length) {
      const servicios = servicios_data.map(s => ({
        ficha_id:    ficha._id,
        vehiculo_id: vehiculo._id,
        dominio,
        tipo:        s.tipo,
        descripcion: s.descripcion,
        repuestos:   s.repuestos || [],
      }));
      await Servicio.insertMany(servicios);
    }

    // 5. Guardar estado de ítems
    if (estado_items?.length) {
      await EstadoItem.create({ ficha_id: ficha._id, dominio, items: estado_items });
    }

    // 6. Actualizar próximo service si se indicó
    if (ficha_data.meses_intervalo || ficha_data.km_intervalo) {
      const hoy = new Date(ficha_data.fecha_ingreso || new Date());
      let fecha_proximo = null;
      if (ficha_data.meses_intervalo) {
        fecha_proximo = new Date(hoy);
        fecha_proximo.setMonth(fecha_proximo.getMonth() + parseInt(ficha_data.meses_intervalo));
      }
      const km_proximo = ficha_data.km_intervalo && ficha_data.km_inicial
        ? parseInt(ficha_data.km_inicial) + parseInt(ficha_data.km_intervalo)
        : null;

      // Calcular estado
      let estado = 'al_dia';
      if (fecha_proximo) {
        const diasRestantes = Math.floor((fecha_proximo - new Date()) / (1000*60*60*24));
        if (diasRestantes < 0)        estado = 'vencido';
        else if (diasRestantes <= 30) estado = 'proximo_30';
        else if (diasRestantes <= 60) estado = 'proximo_60';
      }

      await ProximoService.findOneAndUpdate(
        { dominio },
        {
          dominio, vehiculo_id: vehiculo._id, cliente_id: cliente?._id,
          fecha_proximo, meses_intervalo: ficha_data.meses_intervalo || null,
          km_proximo, km_intervalo: ficha_data.km_intervalo || null,
          ultimo_service: hoy,
          ultimo_km: ficha_data.km_inicial || null,
          nota: ficha_data.nota_service || '',
          estado, actualizado: new Date(),
        },
        { upsert: true, new: true }
      );
    }

    res.json({ ok: true, ficha_id: ficha._id, vehiculo_id: vehiculo._id, qr: vehiculo.qr_codigo });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Historial completo por patente
app.get('/api/historial/:dominio', async (req, res) => {
  try {
    const dominio = req.params.dominio.toUpperCase();

    const vehiculo = await Vehiculo.findOne({ dominio }).populate('titular_id');
    if (!vehiculo) return res.status(404).json({ error: 'Vehículo no encontrado' });

    const fichas = await Ficha.find({ dominio }).sort({ fecha_ingreso: -1 });

    const historial = await Promise.all(fichas.map(async ficha => {
      const servicios   = await Servicio.find({ ficha_id: ficha._id });
      const estadoItems = await EstadoItem.findOne({ ficha_id: ficha._id });
      return { ficha, servicios, estadoItems };
    }));

    res.json({ vehiculo, historial });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════
//  RUTA: QR — Historial Público del Vehículo
//  (esta es la URL que se imprime en el QR)
// ════════════════════════════════════════════════════════════
app.get('/historial-publico/:dominio', async (req, res) => {
  try {
    const dominio = req.params.dominio.toUpperCase();
    const vehiculo = await Vehiculo.findOne({ dominio }).populate('titular_id');
    if (!vehiculo) {
      return res.send(`<html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h2>🔍 Vehículo ${dominio} no encontrado</h2>
        <p>Este vehículo no tiene historial registrado en TallerOS.</p>
      </body></html>`);
    }
    const fichas = await Ficha.find({ dominio }).sort({ fecha_ingreso: 1 });
    const historialHTML = await Promise.all(fichas.map(async f => {
      const servicios = await Servicio.find({ ficha_id: f._id });
      const tags = servicios.map(s => `<span style="background:#ff6b1a22;color:#ff6b1a;padding:3px 10px;border-radius:20px;font-size:12px;margin:2px;">${s.descripcion}</span>`).join('');
      return `
        <div style="border:1px solid #eee;border-radius:10px;padding:16px;margin-bottom:12px;">
          <div style="font-size:12px;color:#888;">${new Date(f.fecha_ingreso).toLocaleDateString('es-AR')} · ${f.turno || ''}</div>
          <div style="font-weight:600;font-size:15px;margin:4px 0;">${f.km_inicial ? parseInt(f.km_inicial).toLocaleString() + ' km' : ''}</div>
          <div>${tags}</div>
          ${f.obs_adicionales ? `<div style="font-size:12px;color:#666;margin-top:8px;">${f.obs_adicionales}</div>` : ''}
        </div>`;
    }));

    res.send(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Historial — ${dominio}</title>
      <style>body{font-family:'Segoe UI',sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#f9f9f9;}
      .header{background:#0f0f0f;color:white;padding:20px;border-radius:12px;margin-bottom:20px;text-align:center;}
      .patente{font-size:32px;font-weight:900;letter-spacing:4px;color:#ff6b1a;}</style>
    </head><body>
      <div class="header">
        <div style="font-size:12px;letter-spacing:2px;color:#aaa;margin-bottom:4px;">🔧 TALLEROS</div>
        <div class="patente">${dominio}</div>
        <div style="font-size:14px;color:#ccc;margin-top:4px;">${vehiculo.marca || ''} ${vehiculo.modelo || ''} ${vehiculo.anio || ''}</div>
        <div style="font-size:12px;color:#888;margin-top:2px;">Titular: ${vehiculo.titular_id?.nombre || '—'}</div>
      </div>
      <h3 style="font-size:14px;color:#666;text-transform:uppercase;letter-spacing:1px;">Historial de servicios (${fichas.length})</h3>
      ${historialHTML.join('') || '<p style="color:#aaa;">Sin servicios registrados aún.</p>'}
    </body></html>`);
  } catch (e) {
    res.status(500).send('<p>Error al cargar el historial.</p>');
  }
});

// ════════════════════════════════════════════════════════════
//  RUTAS: DASHBOARD
// ════════════════════════════════════════════════════════════
app.get('/api/dashboard', async (req, res) => {
  try {
    const inicio_mes = new Date(); inicio_mes.setDate(1); inicio_mes.setHours(0,0,0,0);
    const hoy_inicio = new Date(); hoy_inicio.setHours(0,0,0,0);
    const hoy_fin    = new Date(); hoy_fin.setHours(23,59,59,999);

    const [total_fichas, total_vehiculos, fichas_mes, alertas_count, turnos_hoy, ultimas] = await Promise.all([
      Ficha.countDocuments(),
      Vehiculo.countDocuments(),
      Ficha.countDocuments({ fecha_ingreso: { $gte: inicio_mes } }),
      ProximoService.countDocuments({ estado: { $in: ['vencido','proximo_30','proximo_60'] } }),
      Turno.find({ fecha: { $gte: hoy_inicio, $lte: hoy_fin }, estado: { $ne: 'cancelado' } }).sort({ hora: 1 }),
      Ficha.find().sort({ fecha_ingreso: -1 }).limit(5),
    ]);

    res.json({ total_fichas, total_vehiculos, fichas_mes, alertas_count, turnos_hoy, ultimas });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════
//  RUTAS: PRÓXIMO SERVICE / ALERTAS
// ════════════════════════════════════════════════════════════

// Recalcular y devolver todas las alertas activas
app.get('/api/alertas', async (req, res) => {
  try {
    const hoy = new Date();
    const en30 = new Date(); en30.setDate(en30.getDate() + 30);
    const en60 = new Date(); en60.setDate(en60.getDate() + 60);

    // Actualizar estados en BD
    await ProximoService.updateMany(
      { fecha_proximo: { $lt: hoy } },
      { estado: 'vencido' }
    );
    await ProximoService.updateMany(
      { fecha_proximo: { $gte: hoy, $lte: en30 } },
      { estado: 'proximo_30' }
    );
    await ProximoService.updateMany(
      { fecha_proximo: { $gt: en30, $lte: en60 } },
      { estado: 'proximo_60' }
    );
    await ProximoService.updateMany(
      { fecha_proximo: { $gt: en60 } },
      { estado: 'al_dia' }
    );

    const alertas = await ProximoService.find({
      estado: { $in: ['vencido', 'proximo_30', 'proximo_60'] }
    })
      .populate('vehiculo_id')
      .populate('cliente_id')
      .sort({ fecha_proximo: 1 });

    res.json(alertas);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Obtener próximo service de un vehículo
app.get('/api/alertas/:dominio', async (req, res) => {
  try {
    const ps = await ProximoService.findOne({ dominio: req.params.dominio.toUpperCase() });
    res.json(ps || null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar manualmente el próximo service
app.put('/api/alertas/:dominio', async (req, res) => {
  try {
    const dominio = req.params.dominio.toUpperCase();
    const { meses_intervalo, km_intervalo, nota, fecha_proximo, km_proximo } = req.body;

    const hoy = new Date();
    let estado = 'al_dia';
    if (fecha_proximo) {
      const fp = new Date(fecha_proximo);
      const dias = Math.floor((fp - hoy) / (1000*60*60*24));
      if (dias < 0)        estado = 'vencido';
      else if (dias <= 30) estado = 'proximo_30';
      else if (dias <= 60) estado = 'proximo_60';
    }

    const ps = await ProximoService.findOneAndUpdate(
      { dominio },
      { meses_intervalo, km_intervalo, nota, fecha_proximo, km_proximo, estado, actualizado: new Date() },
      { new: true }
    );
    res.json(ps);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════
//  RUTAS: TURNOS
// ════════════════════════════════════════════════════════════

// Obtener turnos de un día específico
app.get('/api/turnos/dia/:fecha', async (req, res) => {
  try {
    const inicio = new Date(req.params.fecha);
    inicio.setHours(0,0,0,0);
    const fin = new Date(inicio);
    fin.setHours(23,59,59,999);

    const turnos = await Turno.find({
      fecha: { $gte: inicio, $lte: fin }
    }).sort({ hora: 1 });
    res.json(turnos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Obtener turnos de una semana
app.get('/api/turnos/semana/:fechaInicio', async (req, res) => {
  try {
    const inicio = new Date(req.params.fechaInicio);
    inicio.setHours(0,0,0,0);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 6);
    fin.setHours(23,59,59,999);

    const turnos = await Turno.find({
      fecha: { $gte: inicio, $lte: fin }
    }).sort({ fecha: 1, hora: 1 });
    res.json(turnos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Crear turno
app.post('/api/turnos', async (req, res) => {
  try {
    // Si la patente existe en BD, vincular vehículo y cliente
    let vehiculo_id = null, cliente_id = null;
    if (req.body.dominio) {
      const v = await Vehiculo.findOne({ dominio: req.body.dominio.toUpperCase() }).populate('titular_id');
      if (v) {
        vehiculo_id = v._id;
        cliente_id  = v.titular_id?._id || null;
        if (!req.body.titular && v.titular_id?.nombre) req.body.titular   = v.titular_id.nombre;
        if (!req.body.telefono && v.titular_id?.telefono) req.body.telefono = v.titular_id.telefono;
      }
    }
    const turno = await Turno.create({ ...req.body, vehiculo_id, cliente_id,
      dominio: req.body.dominio?.toUpperCase() });
    res.json(turno);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar estado del turno
app.put('/api/turnos/:id', async (req, res) => {
  try {
    const turno = await Turno.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(turno);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Eliminar turno
app.delete('/api/turnos/:id', async (req, res) => {
  try {
    await Turno.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Iniciar servidor ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🔧 TallerOS iniciado`);
  console.log(`   Aplicación: http://localhost:${PORT}`);
  console.log(`   Base de datos: ${MONGO_URI}\n`);
});
