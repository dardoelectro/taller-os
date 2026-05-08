// ============================================================
//  MIDDLEWARE DE AUTENTICACIÓN
//  Archivo: server/auth.js
// ============================================================

const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.rol === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Solo administradores' });
    }
  });
};

module.exports = { verifyToken, verifyAdmin };