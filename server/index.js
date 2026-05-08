// ============================================================
//  SERVIDOR PRINCIPAL â€” TallerOS
//  Archivo: server/index.js
//  Uso: node server/index.js
// ============================================================

require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const path      = require('path');
const QRCode    = require('qrcode');

const { Cliente, Vehiculo, Ficha, Servicio, EstadoItem, ProximoService, Turno, Usuario } = require('./models');
const { verifyToken, verifyAdmin } = require('./auth');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app  = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/talleros';

// â”€â”€â”€ Middlewares â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// â”€â”€â”€ Conectar a MongoDB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('âœ… Conectado a MongoDB:', MONGO_URI);
    console.log('ðŸ”§ TallerOS corriendo en http://localhost:' + PORT);
  })
  .catch(err => {
    console.error('âŒ Error al conectar MongoDB:', err.message);
    console.error('   Asegurate de que MongoDB estÃ© corriendo (mongod)');
    process.exit(1);
  });

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RUTAS: AUTENTICACIÃ“N
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseÃ±a requeridos' });
    }

    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(401).json({ error: 'Email o contraseÃ±a incorrectos' });
    }

    if (!usuario.activo) {
      return res.status(401).json({ error: 'Usuario desactivado' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Email o contraseÃ±a incorrectos' });
    }

    const token = jwt.sign(
      { _id: usuario._id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      message: 'Login exitoso',
      token,
      usuario: { _id: usuario._id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Obtener usuario actual
app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user._id).select('-password');
    res.json(usuario);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Registrar usuario (solo admin)
app.post('/api/auth/register', verifyAdmin, async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Campos requeridos: nombre, email, password' });
    }

    const usuarioExistente = await Usuario.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ error: 'Email ya registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const usuario = await Usuario.create({
      nombre,
      email,
      password: passwordHash,
      rol: rol || 'mecanico',
    });

    res.json({ 
      message: 'Usuario creado', 
      usuario: { _id: usuario._id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Listar usuarios (solo admin)
app.get('/api/auth/usuarios', verifyAdmin, async (req, res) => {
  try {
    const usuarios = await Usuario.find().select('-password');
    res.json(usuarios);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RUTAS: VEHÃCULOS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Buscar por patente (bÃºsqueda parcial)
app.get('/api/vehiculos/buscar/:patente', verifyToken, async (req, res) => {
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

// Obtener vehÃ­culo por patente exacta (para el QR)
app.get('/api/vehiculos/:dominio', verifyToken, async (req, res) => {
  try {
    const v = await Vehiculo.findOne({ dominio: req.params.dominio.toUpperCase() })
      .populate('titular_id');
    if (!v) return res.status(404).json({ error: 'VehÃ­culo no encontrado' });
    res.json(v);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Crear o actualizar vehÃ­culo
app.post('/api/vehiculos', verifyToken, async (req, res) => {
  try {
    const dominio = req.body.dominio?.toUpperCase();
    if (!dominio) return res.status(400).json({ error: 'Dominio requerido' });

    let vehiculo = await Vehiculo.findOne({ dominio });

    if (!vehiculo) {
      // Es nuevo â€” generar QR
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RUTAS: CLIENTES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

app.get('/api/clientes/buscar/:nombre', verifyToken, async (req, res) => {
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

app.post('/api/clientes', verifyToken, async (req, res) => {
  try {
    const cliente = new Cliente(req.body);
    await cliente.save();
    res.json(cliente);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RUTAS: FICHAS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Guardar ficha completa (recepciÃ³n)
app.post('/api/fichas', verifyToken, async (req, res) => {
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

    // 2. Buscar o crear vehÃ­culo
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
      // Actualizar titular si cambiÃ³
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
        botiquin:      ficha_data.accesorios?.includes('BotiquÃ­n'),
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

    // 5. Guardar estado de Ã­tems
    if (estado_items?.length) {
      await EstadoItem.create({ ficha_id: ficha._id, dominio, items: estado_items });
    }

    // 6. Actualizar prÃ³ximo service si se indicÃ³
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
app.get('/api/historial/:dominio', verifyToken, async (req, res) => {
  try {
    const dominio = req.params.dominio.toUpperCase();

    const vehiculo = await Vehiculo.findOne({ dominio }).populate('titular_id');
    if (!vehiculo) return res.status(404).json({ error: 'VehÃ­culo no encontrado' });

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RUTA: QR â€” Historial PÃºblico del VehÃ­culo
//  (esta es la URL que se imprime en el QR)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
app.get('/historial-publico/:dominio', async (req, res) => {
  try {
    const dominio = req.params.dominio.toUpperCase();
    const vehiculo = await Vehiculo.findOne({ dominio }).populate('titular_id');
    if (!vehiculo) {
      return res.send(`<html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h2>ðŸ” VehÃ­culo ${dominio} no encontrado</h2>
        <p>Este vehÃ­culo no tiene historial registrado en TallerOS.</p>
      </body></html>`);
    }
    const fichas = await Ficha.find({ dominio }).sort({ fecha_ingreso: 1 });
    const historialHTML = await Promise.all(fichas.map(async f => {
      const servicios = await Servicio.find({ ficha_id: f._id });
      const tags = servicios.map(s => `<span style="background:#ff6b1a22;color:#ff6b1a;padding:3px 10px;border-radius:20px;font-size:12px;margin:2px;">${s.descripcion}</span>`).join('');
      return `
        <div style="border:1px solid #eee;border-radius:10px;padding:16px;margin-bottom:12px;">
          <div style="font-size:12px;color:#888;">${new Date(f.fecha_ingreso).toLocaleDateString('es-AR')} Â· ${f.turno || ''}</div>
          <div style="font-weight:600;font-size:15px;margin:4px 0;">${f.km_inicial ? parseInt(f.km_inicial).toLocaleString() + ' km' : ''}</div>
          <div>${tags}</div>
          ${f.obs_adicionales ? `<div style="font-size:12px;color:#666;margin-top:8px;">${f.obs_adicionales}</div>` : ''}
        </div>`;
    }));

    res.send(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Historial â€” ${dominio}</title>
      <style>body{font-family:'Segoe UI',sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#f9f9f9;}
      .header{background:#0f0f0f;color:white;padding:20px;border-radius:12px;margin-bottom:20px;text-align:center;}
      .patente{font-size:32px;font-weight:900;letter-spacing:4px;color:#ff6b1a;}</style>
    </head><body>
      <div class="header">
        <div style="font-size:12px;letter-spacing:2px;color:#aaa;margin-bottom:4px;">ðŸ”§ TALLEROS</div>
        <div class="patente">${dominio}</div>
        <div style="font-size:14px;color:#ccc;margin-top:4px;">${vehiculo.marca || ''} ${vehiculo.modelo || ''} ${vehiculo.anio || ''}</div>
        <div style="font-size:12px;color:#888;margin-top:2px;">Titular: ${vehiculo.titular_id?.nombre || 'â€”'}</div>
      </div>
      <h3 style="font-size:14px;color:#666;text-transform:uppercase;letter-spacing:1px;">Historial de servicios (${fichas.length})</h3>
      ${historialHTML.join('') || '<p style="color:#aaa;">Sin servicios registrados aÃºn.</p>'}
    </body></html>`);
  } catch (e) {
    res.status(500).send('<p>Error al cargar el historial.</p>');
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RUTAS: DASHBOARD
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
app.get('/api/dashboard', verifyToken, async (req, res) => {
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RUTAS: PRÃ“XIMO SERVICE / ALERTAS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Recalcular y devolver todas las alertas activas
app.get('/api/alertas', verifyToken, async (req, res) => {
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

// Obtener prÃ³ximo service de un vehÃ­culo
app.get('/api/alertas/:dominio', verifyToken, async (req, res) => {
  try {
    const ps = await ProximoService.findOne({ dominio: req.params.dominio.toUpperCase() });
    res.json(ps || null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar manualmente el prÃ³ximo service
app.put('/api/alertas/:dominio', verifyToken, async (req, res) => {
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RUTAS: TURNOS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Obtener turnos de un dÃ­a especÃ­fico
app.get('/api/turnos/dia/:fecha', verifyToken, async (req, res) => {
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
app.get('/api/turnos/semana/:fechaInicio', verifyToken, async (req, res) => {
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
app.post('/api/turnos', verifyToken, async (req, res) => {
  try {
    // Si la patente existe en BD, vincular vehÃ­culo y cliente
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
app.put('/api/turnos/:id', verifyToken, async (req, res) => {
  try {
    const turno = await Turno.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(turno);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Eliminar turno
app.delete('/api/turnos/:id', verifyToken, async (req, res) => {
  try {
    await Turno.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RUTAS: EDICIÃ“N DE FICHAS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Obtener ficha completa por ID
app.get('/api/fichas/:id', verifyToken, async (req, res) => {
  try {
    const ficha = await Ficha.findById(req.params.id)
      .populate('vehiculo_id')
      .populate('cliente_id');
    const servicios = await Servicio.find({ ficha_id: req.params.id });
    const estadoItems = await EstadoItem.findOne({ ficha_id: req.params.id });
    if (!ficha) return res.status(404).json({ error: 'Ficha no encontrada' });
    res.json({ 
      ficha, 
      servicios, 
      estadoItems: estadoItems?.items || [], 
      vehiculo: ficha.vehiculo_id, 
      cliente: ficha.cliente_id 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar ficha
app.put('/api/fichas/:id', verifyToken, async (req, res) => {
  try {
    const { ficha_data } = req.body;
    const ficha = await Ficha.findByIdAndUpdate(req.params.id, {
      km_inicial: ficha_data.km_inicial,
      km_final: ficha_data.km_final,
      vtv: ficha_data.vtv,
      responsable: ficha_data.responsable,
      turno: ficha_data.turno,
      fluidos: { aceite: ficha_data.medida_aceite, frenos: ficha_data.medida_frenos, refrigerante: ficha_data.medida_refrigerante },
      accesorios: { baliza: ficha_data.accesorios?.includes('Baliza emergencia') || false, extintor: ficha_data.accesorios?.includes('Extintor') || false, rueda_auxilio: ficha_data.accesorios?.includes('Rueda auxilio') || false, crique: ficha_data.accesorios?.includes('Crique') || false, herramientas: ficha_data.accesorios?.includes('Herramientas') || false, botiquin: ficha_data.accesorios?.includes('BotiquÃ­n') || false, otros: ficha_data.otros_accesorios },
      estado_general: ficha_data.estado_general,
      obs_visuales: ficha_data.obs_visuales,
      obs_adicionales: ficha_data.obs_adicionales,
    }, { new: true });
    res.json(ficha);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar servicio
app.put('/api/servicios/:id', verifyToken, async (req, res) => {
  try {
    const servicio = await Servicio.findByIdAndUpdate(req.params.id, {
      tipo: req.body.tipo,
      descripcion: req.body.descripcion,
      repuestos: req.body.repuestos || [],
      completado: req.body.completado || false,
    }, { new: true });
    res.json(servicio);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Eliminar servicio
app.delete('/api/servicios/:id', verifyToken, async (req, res) => {
  try {
    await Servicio.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar estado de Ã­tems
app.put('/api/estadoitems/:id', verifyToken, async (req, res) => {
  try {
    const estadoItem = await EstadoItem.findByIdAndUpdate(req.params.id, { items: req.body.items }, { new: true });
    res.json(estadoItem);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// â”€â”€â”€ Iniciar servidor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RUTAS: OPERARIOS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RUTAS: TALLER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RUTAS: SERVICIOS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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


app.listen(PORT, () => {
  console.log(`\nðŸ”§ TallerOS iniciado`);
  console.log(`   AplicaciÃ³n: http://localhost:${PORT}`);
  console.log(`   Base de datos: ${MONGO_URI}\n`);
});

