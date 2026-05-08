# 🔧 TallerOS — Guía de Instalación y Uso

## ¿Qué es este sistema?

TallerOS es un sistema de recepción de vehículos que reemplaza tu ficha de Excel impresa.  
Incluye base de datos MongoDB, servidor Node.js, y una app web accesible desde el navegador.

---

## Estructura del proyecto

```
taller-os/
├── server/
│   ├── index.js       ← Servidor principal (Node.js + Express)
│   └── models.js      ← Modelos de base de datos (MongoDB)
├── public/
│   └── index.html     ← Interfaz web (se abre en el navegador)
├── data/
│   └── db/            ← Aquí MongoDB guarda los datos (creado automáticamente)
├── .env               ← Configuración del servidor
├── package.json       ← Dependencias Node.js
├── INSTALAR.bat       ← Ejecutar UNA VEZ para instalar
└── INICIAR_TALLEROS.bat ← Ejecutar CADA VEZ para iniciar el sistema
```

---

## Requisitos previos (instalar una sola vez)

### 1. Node.js
- Descargar desde: https://nodejs.org (elegir versión **LTS**)
- Instalar con todas las opciones por defecto
- Para verificar: abrir CMD y escribir `node --version`

### 2. MongoDB Community
- Descargar desde: https://www.mongodb.com/try/download/community
- Elegir: **Windows** → **MSI**
- Durante la instalación: marcar ✅ **"Install MongoDB as a Service"**
- Para verificar: abrir CMD y escribir `mongod --version`

---

## Instalación del sistema

1. Descomprimí la carpeta `taller-os` en donde quieras (ej: `C:\TallerOS`)
2. Doble clic en **`INSTALAR.bat`**
3. Esperá que termine (instala dependencias automáticamente)

---

## Uso diario

### Iniciar el sistema
- Doble clic en **`INICIAR_TALLEROS.bat`**
- Se abre automáticamente el navegador en `http://localhost:3000`
- ¡Listo para usar!

### Cerrar el sistema
- Cerrá la ventana de CMD del servidor
- Cerrá la ventana de MongoDB

---

## Base de datos: colecciones creadas

| Colección | Qué guarda |
|-----------|-----------|
| `vehiculos` | Datos del auto (patente, marca, modelo, chasis, motor, QR) |
| `clientes` | Datos del titular (nombre, teléfono, email) |
| `fichas` | Cada recepción (fecha, km, fluidos, accesorios, estado general) |
| `servicios` | Trabajos realizados en cada ficha |
| `estadoitems` | Estado de cada componente (tablero, frenos, luces, etc.) |

---

## El código QR

- Se genera automáticamente la **primera vez** que ingresás un vehículo
- Apunta a: `http://localhost:3000/historial-publico/PATENTE`
- Podés imprimirlo desde el botón "📱 Ver QR" en el historial
- Guardalo en la guantera del auto
- Cualquier mecánico puede escanearlo para ver el historial completo

> **Importante:** El QR funciona solo en tu red local (mientras el servidor esté corriendo).  
> Para acceso desde afuera, habría que publicar el servidor en internet (paso siguiente opcional).

---

## Backup de los datos

Los datos se guardan en la carpeta `data/db/`.  
Para hacer backup, copiá esa carpeta a un disco externo o pendrive.

---

## Soporte
Desarrollado con TallerOS v1.0
