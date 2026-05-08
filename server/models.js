// ============================================================
//  MODELOS DE BASE DE DATOS — TallerOS
//  Archivo: server/models.js
//
//  Colecciones (tablas) creadas:
//    1. vehiculos   — Datos del vehículo (una vez, por patente)
//    2. clientes    — Datos del cliente/titular
//    3. fichas      — Cada recepción / visita al taller
//    4. servicios   — Trabajos realizados en cada ficha
//    5. estadoItems — Estado de cada componente por ficha
// ============================================================

const mongoose = require('mongoose');

// ─────────────────────────────────────────────
// 1. CLIENTES
// ─────────────────────────────────────────────
const ClienteSchema = new mongoose.Schema({
  nombre:      { type: String, required: true, trim: true },
  telefono:    { type: String, trim: true },
  email:       { type: String, trim: true, lowercase: true },
  dni:         { type: String, trim: true },
  creado_en:   { type: Date, default: Date.now },
  actualizado: { type: Date, default: Date.now },
});
ClienteSchema.pre('save', function(next) {
  this.actualizado = new Date();
  next();
});

// ─────────────────────────────────────────────
// 2. VEHÍCULOS
// ─────────────────────────────────────────────
const VehiculoSchema = new mongoose.Schema({
  dominio: {          // Patente — clave principal de búsqueda
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  tipo_vehiculo:  { type: String, trim: true },   // Auto, Camioneta, etc.
  marca:          { type: String, trim: true },
  modelo:         { type: String, trim: true },
  anio:           { type: Number },
  tipo_caja:      { type: String, trim: true },   // Manual, Automática
  combustible:    { type: String, trim: true },   // Nafta, Diesel, GNC...
  chasis:         { type: String, trim: true, uppercase: true },
  motor:          { type: String, trim: true, uppercase: true },
  ecu:            { type: String, trim: true },
  color:          { type: String, trim: true },
  // Titular principal (referencia al cliente)
  titular_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
  // QR — se genera automáticamente al crear el vehículo
  qr_codigo:      { type: String },   // SVG o URL del QR
  // Historial de titulares anteriores
  titulares_prev: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' }],
  creado_en:      { type: Date, default: Date.now },
  actualizado:    { type: Date, default: Date.now },
});
VehiculoSchema.pre('save', function(next) {
  this.actualizado = new Date();
  next();
});

// ─────────────────────────────────────────────
// 3. FICHAS DE RECEPCIÓN
// (cada vez que el vehículo entra al taller)
// ─────────────────────────────────────────────
const FichaSchema = new mongoose.Schema({
  // Referencias
  vehiculo_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Vehiculo', required: true, index: true },
  cliente_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
  dominio:        { type: String, uppercase: true, index: true },  // Copia para búsqueda rápida

  // Fechas
  fecha_ingreso:  { type: Date, default: Date.now },
  fecha_egreso:   { type: Date },

  // Kilometraje
  km_inicial:     { type: Number },
  km_final:       { type: Number },

  // VTV al momento del ingreso
  vtv:            { type: String },

  // Responsable que trae el vehículo (puede ser diferente al titular)
  responsable:    { type: String, trim: true },

  // Turno / grupo de trabajo
  turno:          { type: String, trim: true },

  // Fluidos al ingreso
  fluidos: {
    aceite:        { type: String },   // Lleno / 3/4 / 1/2 / 1/4 / Mínimo
    frenos:        { type: String },
    refrigerante:  { type: String },
  },

  // Accesorios que entran con el auto
  accesorios: {
    baliza:        { type: Boolean, default: false },
    extintor:      { type: Boolean, default: false },
    rueda_auxilio: { type: Boolean, default: false },
    crique:        { type: Boolean, default: false },
    herramientas:  { type: Boolean, default: false },
    botiquin:      { type: Boolean, default: false },
    otros:         { type: String },
  },

  // Observaciones visuales generales
  estado_general:  { type: String, enum: ['Bueno','Regular','Malo',''] },
  obs_visuales:    { type: String },
  obs_adicionales: { type: String },

  // Estado de cada componente (subdocumento)
  // Se guarda en la colección estadoItems con referencia a esta ficha

  // Estado de la ficha
  estado_ficha:   {
    type: String,
    enum: ['recibido','en_proceso','terminado','entregado'],
    default: 'recibido',
  },

  creado_en:      { type: Date, default: Date.now },
});

// ─────────────────────────────────────────────
// 4. SERVICIOS / TRABAJOS
// (uno o varios por ficha)
// ─────────────────────────────────────────────
const ServicioSchema = new mongoose.Schema({
  ficha_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'Ficha', required: true, index: true },
  vehiculo_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Vehiculo' },
  dominio:        { type: String, uppercase: true },

  tipo: {
    type: String,
    enum: [
      'cambio_aceite',
      'cambio_bujias',
      'mecanico',
      'electrico',
      'diagnostico',
      'preventivo',
      'otro',
    ],
  },
  descripcion:    { type: String, required: true, trim: true },
  repuestos:      [{ nombre: String, cantidad: Number, marca: String }],
  completado:     { type: Boolean, default: false },
  creado_en:      { type: Date, default: Date.now },
});

// ─────────────────────────────────────────────
// 5. ESTADO DE ÍTEMS DEL VEHÍCULO
// (por ficha — estado de cada componente)
// ─────────────────────────────────────────────
const EstadoItemSchema = new mongoose.Schema({
  ficha_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Ficha', required: true, index: true },
  dominio:    { type: String, uppercase: true },
  items: [{
    nombre:  { type: String },  // "Tablero", "Luces altas", etc.
    estado:  { type: String, enum: ['Bueno','Regular','Malo'] },
  }],
  creado_en:  { type: Date, default: Date.now },
});

// ─────────────────────────────────────────────
// 6. PRÓXIMO SERVICE
// (uno por vehículo, se actualiza en cada ficha)
// ─────────────────────────────────────────────
const ProximoServiceSchema = new mongoose.Schema({
  dominio:         { type: String, uppercase: true, unique: true, index: true },
  vehiculo_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Vehiculo' },
  cliente_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },

  // Criterio principal: tiempo
  fecha_proximo:   { type: Date },           // Fecha en que vence el service
  meses_intervalo: { type: Number },         // Cada cuántos meses (configurable por vehículo)

  // Criterio secundario: km (opcional)
  km_proximo:      { type: Number },         // KM en que vence
  km_intervalo:    { type: Number },         // Cada cuántos km

  // Último service registrado
  ultimo_service:  { type: Date },
  ultimo_km:       { type: Number },

  // Nota del mecánico
  nota:            { type: String },

  // Estado calculado (se actualiza automáticamente)
  estado: {
    type: String,
    enum: ['al_dia', 'proximo_30', 'proximo_60', 'vencido'],
    default: 'al_dia',
  },

  actualizado: { type: Date, default: Date.now },
});

// ─────────────────────────────────────────────
// 7. TURNOS
// ─────────────────────────────────────────────
const TurnoSchema = new mongoose.Schema({
  fecha:       { type: Date, required: true, index: true },
  hora:        { type: String, required: true },  // "09:30"
  dominio:     { type: String, uppercase: true, trim: true },
  vehiculo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehiculo' },
  cliente_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
  titular:     { type: String, trim: true },       // Copia para búsqueda rápida
  telefono:    { type: String, trim: true },
  trabajo:     { type: String, required: true, trim: true },  // Descripción del trabajo
  mecanico:    { type: String, trim: true },        // Mecánico asignado
  estado: {
    type: String,
    enum: ['pendiente', 'confirmado', 'atendido', 'cancelado'],
    default: 'pendiente',
  },
  nota:        { type: String },
  // Si se convirtió en ficha, guardar referencia
  ficha_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Ficha' },
  creado_en:   { type: Date, default: Date.now },
});

// ─────────────────────────────────────────────
// 8. USUARIOS
// ─────────────────────────────────────────────
const UsuarioSchema = new mongoose.Schema({
  nombre:       { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:     { type: String, required: true },
  rol:          { 
    type: String, 
    enum: ['admin', 'mecanico'], 
    default: 'mecanico' 
  },
  activo:       { type: Boolean, default: true },
  creado_en:    { type: Date, default: Date.now },
  actualizado:  { type: Date, default: Date.now },
});

UsuarioSchema.pre('save', function(next) {
  this.actualizado = new Date();
  next();
});

// ─────────────────────────────────────────────
// EXPORTAR MODELOS
// ─────────────────────────────────────────────
module.exports = {
  Cliente:         mongoose.model('Cliente',         ClienteSchema),
  Vehiculo:        mongoose.model('Vehiculo',        VehiculoSchema),
  Ficha:           mongoose.model('Ficha',           FichaSchema),
  Servicio:        mongoose.model('Servicio',        ServicioSchema),
  EstadoItem:      mongoose.model('EstadoItem',      EstadoItemSchema),
  ProximoService:  mongoose.model('ProximoService',  ProximoServiceSchema),
  Turno:           mongoose.model('Turno',           TurnoSchema),
  Usuario:         mongoose.model('Usuario',         UsuarioSchema),
};