// ============================================================
//  MODELOS DE BASE DE DATOS — TallerOS v3.0
//  Colecciones:
//    1. clientes
//    2. vehiculos
//    3. fichas
//    4. servicios
//    5. estadoItems
//    6. proximoService
//    7. turnos
//    8. presupuestos   ← NUEVO
//    9. fotos          ← NUEVO
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
  notas:       { type: String, trim: true },   // ← nota interna del taller
  creado_en:   { type: Date, default: Date.now },
  actualizado: { type: Date, default: Date.now },
});
ClienteSchema.pre('save', function(next) { this.actualizado = new Date(); next(); });

// ─────────────────────────────────────────────
// 2. VEHÍCULOS
// ─────────────────────────────────────────────
const VehiculoSchema = new mongoose.Schema({
  dominio:       { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  tipo_vehiculo: { type: String, trim: true },
  marca:         { type: String, trim: true },
  modelo:        { type: String, trim: true },
  anio:          { type: Number },
  tipo_caja:     { type: String, trim: true },
  combustible:   { type: String, trim: true },
  chasis:        { type: String, trim: true, uppercase: true },
  motor:         { type: String, trim: true, uppercase: true },
  ecu:           { type: String, trim: true },
  color:         { type: String, trim: true },
  titular_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
  qr_codigo:     { type: String },
  titulares_prev:[{ type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' }],
  creado_en:     { type: Date, default: Date.now },
  actualizado:   { type: Date, default: Date.now },
});
VehiculoSchema.pre('save', function(next) { this.actualizado = new Date(); next(); });

// ─────────────────────────────────────────────
// 3. FICHAS DE RECEPCIÓN
// ─────────────────────────────────────────────
const FichaSchema = new mongoose.Schema({
  vehiculo_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Vehiculo', required: true, index: true },
  cliente_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
  dominio:        { type: String, uppercase: true, index: true },
  fecha_ingreso:  { type: Date, default: Date.now },
  fecha_egreso:   { type: Date },
  km_inicial:     { type: Number },
  km_final:       { type: Number },
  vtv:            { type: String },
  responsable:    { type: String, trim: true },
  turno:          { type: String, trim: true },
  fluidos: {
    aceite:       { type: String },
    frenos:       { type: String },
    refrigerante: { type: String },
  },
  accesorios: {
    baliza:        { type: Boolean, default: false },
    extintor:      { type: Boolean, default: false },
    rueda_auxilio: { type: Boolean, default: false },
    crique:        { type: Boolean, default: false },
    herramientas:  { type: Boolean, default: false },
    botiquin:      { type: Boolean, default: false },
    otros:         { type: String },
  },
  estado_general:   { type: String, enum: ['Bueno','Regular','Malo',''] },
  obs_visuales:     { type: String },
  obs_adicionales:  { type: String },
  nota_interna:     { type: String },   // ← visible solo en el taller, no en PDF
  estado_ficha: {
    type: String,
    enum: ['recibido','en_proceso','listo','entregado'],
    default: 'recibido',
  },
  presupuesto_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Presupuesto' },
  creado_en:      { type: Date, default: Date.now },
});

// ─────────────────────────────────────────────
// 4. SERVICIOS
// ─────────────────────────────────────────────
const ServicioSchema = new mongoose.Schema({
  ficha_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Ficha', required: true, index: true },
  vehiculo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehiculo' },
  dominio:     { type: String, uppercase: true },
  tipo: {
    type: String,
    enum: ['cambio_aceite','cambio_bujias','mecanico','electrico','diagnostico','preventivo','otro'],
  },
  descripcion: { type: String, required: true, trim: true },
  repuestos:   [{ nombre: String, cantidad: Number, marca: String }],
  completado:  { type: Boolean, default: false },
  creado_en:   { type: Date, default: Date.now },
});

// ─────────────────────────────────────────────
// 5. ESTADO ÍTEMS
// ─────────────────────────────────────────────
const EstadoItemSchema = new mongoose.Schema({
  ficha_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Ficha', required: true, index: true },
  dominio:   { type: String, uppercase: true },
  items:     [{ nombre: String, estado: { type: String, enum: ['Bueno','Regular','Malo'] } }],
  creado_en: { type: Date, default: Date.now },
});

// ─────────────────────────────────────────────
// 6. PRÓXIMO SERVICE
// ─────────────────────────────────────────────
const ProximoServiceSchema = new mongoose.Schema({
  dominio:         { type: String, uppercase: true, unique: true, index: true },
  vehiculo_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Vehiculo' },
  cliente_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
  fecha_proximo:   { type: Date },
  meses_intervalo: { type: Number },
  km_proximo:      { type: Number },
  km_intervalo:    { type: Number },
  ultimo_service:  { type: Date },
  ultimo_km:       { type: Number },
  nota:            { type: String },
  estado: {
    type: String,
    enum: ['al_dia','proximo_30','proximo_60','vencido'],
    default: 'al_dia',
  },
  actualizado: { type: Date, default: Date.now },
});

// ─────────────────────────────────────────────
// 7. TURNOS
// ─────────────────────────────────────────────
const TurnoSchema = new mongoose.Schema({
  fecha:       { type: Date, required: true, index: true },
  hora:        { type: String, required: true },
  dominio:     { type: String, uppercase: true, trim: true },
  vehiculo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehiculo' },
  cliente_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
  titular:     { type: String, trim: true },
  telefono:    { type: String, trim: true },
  trabajo:     { type: String, required: true, trim: true },
  mecanico:    { type: String, trim: true },
  estado: {
    type: String,
    enum: ['pendiente','confirmado','atendido','cancelado'],
    default: 'pendiente',
  },
  nota:      { type: String },
  ficha_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Ficha' },
  creado_en: { type: Date, default: Date.now },
});

// ─────────────────────────────────────────────
// 8. PRESUPUESTOS ← NUEVO
// ─────────────────────────────────────────────
const PresupuestoSchema = new mongoose.Schema({
  // Puede existir ANTES de la ficha (el cliente aprueba primero)
  dominio:     { type: String, uppercase: true, trim: true, index: true },
  vehiculo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehiculo' },
  cliente_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
  titular:     { type: String, trim: true },
  telefono:    { type: String, trim: true },
  fecha:       { type: Date, default: Date.now },

  // Ítems del presupuesto — precio variable, cargado manualmente
  items: [{
    descripcion: { type: String, required: true },
    precio:      { type: Number, default: 0 },
  }],

  // Totales calculados
  subtotal:  { type: Number, default: 0 },
  descuento: { type: Number, default: 0 },  // monto fijo o porcentaje aplicado
  total:     { type: Number, default: 0 },

  // Notas visibles en el PDF del presupuesto
  notas:     { type: String },

  estado: {
    type: String,
    enum: ['borrador','enviado','aprobado','rechazado','vencido'],
    default: 'borrador',
  },

  // Si se aprobó y generó una ficha
  ficha_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Ficha' },
  creado_en: { type: Date, default: Date.now },
  actualizado: { type: Date, default: Date.now },
});
PresupuestoSchema.pre('save', function(next) {
  // Recalcular totales automáticamente
  this.subtotal = this.items.reduce((s, i) => s + (i.precio || 0), 0);
  this.total    = Math.max(0, this.subtotal - (this.descuento || 0));
  this.actualizado = new Date();
  next();
});

// ─────────────────────────────────────────────
// 9. FOTOS ← NUEVO
// ─────────────────────────────────────────────
const FotoSchema = new mongoose.Schema({
  // Una foto puede estar vinculada a una ficha o a un presupuesto
  ficha_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'Ficha', index: true },
  presupuesto_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Presupuesto' },
  dominio:        { type: String, uppercase: true, index: true },

  // La foto se guarda como base64 en MongoDB
  // Para fotos grandes se recomienda guardar solo hasta 2MB por foto
  data:      { type: String, required: true },  // base64
  mime_type: { type: String, default: 'image/jpeg' },
  nombre:    { type: String },
  nota:      { type: String },  // descripción del daño fotografiado

  creado_en: { type: Date, default: Date.now },
});

// ─────────────────────────────────────────────
// EXPORTAR
// ─────────────────────────────────────────────
module.exports = {
  Cliente:        mongoose.model('Cliente',        ClienteSchema),
  Vehiculo:       mongoose.model('Vehiculo',       VehiculoSchema),
  Ficha:          mongoose.model('Ficha',          FichaSchema),
  Servicio:       mongoose.model('Servicio',       ServicioSchema),
  EstadoItem:     mongoose.model('EstadoItem',     EstadoItemSchema),
  ProximoService: mongoose.model('ProximoService', ProximoServiceSchema),
  Turno:          mongoose.model('Turno',          TurnoSchema),
  Presupuesto:    mongoose.model('Presupuesto',    PresupuestoSchema),
  Foto:           mongoose.model('Foto',           FotoSchema),
};
