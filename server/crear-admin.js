// ============================================================
//  CREAR USUARIO ADMIN INICIAL
//  Archivo: server/crear-admin.js
//  Uso: node server/crear-admin.js
// ============================================================

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Usuario } = require('./models');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/talleros';

async function crearAdmin() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    // Datos del admin
    const email = 'admin@talleros.com';
    const nombre = 'Administrador';
    const password = 'admin123';

    // Verificar que no exista
    const yaExiste = await Usuario.findOne({ email });
    if (yaExiste) {
      console.log('⚠️ Usuario admin ya existe:', email);
      process.exit(0);
    }

    // Encriptar contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear admin
    const admin = await Usuario.create({
      nombre,
      email,
      password: passwordHash,
      rol: 'admin',
      activo: true
    });

    console.log('✅ Usuario ADMIN creado:');
    console.log('   Email:', email);
    console.log('   Contraseña:', password);
    console.log('   Rol: admin');
    console.log('');
    console.log('⚠️ GUARDAR ESTOS DATOS EN UN LUGAR SEGURO');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

crearAdmin();