require('dotenv').config();
const mongoose = require('mongoose');
const { Taller } = require('../server/models');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conectado a MongoDB');
    
    const tallerExiste = await Taller.findOne();
    if (!tallerExiste) {
      await Taller.create({
        nombre: 'MODUCHIP AutoElectroLab',
        email: 'contacto@moduchip.com.ar',
        telefono: '+54 9 221 XXXXXXXX',
        ubicacion: 'La Plata, Buenos Aires',
        horarios: {
          lunes_viernes: '08:00 - 18:00',
          sabados: '09:00 - 13:00',
          domingos: 'Cerrado'
        },
        datos_legales: {
          razon_social: 'MODUCHIP SRL',
          cuit: 'XX-XXXXXXXX-X',
          domicilio_legal: 'La Plata, Buenos Aires',
          licencia_municipal: 'XXXXX'
        }
      });
      console.log('OK - Taller creado');
    } else {
      console.log('OK - Taller ya existe');
    }
    
    process.exit();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();