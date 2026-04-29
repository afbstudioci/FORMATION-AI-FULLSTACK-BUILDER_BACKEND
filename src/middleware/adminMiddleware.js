const verifyAdminPassword = (req, res, next) => {
  // Bypass automatique pour l'Admin Principal (Master Root)
  if (req.user && req.user._id === "000000000000000000000000") {
    return next();
  }

  const adminPassword = req.headers['x-admin-password'];

  if (!adminPassword || adminPassword !== process.env.PASSWORD_ADMIN) {
    res.status(401);
    throw new Error('Mot de passe administrateur specifique incorrect ou manquant');
  }
  next();
};

module.exports = { verifyAdminPassword };