const verifyAdminPassword = (req, res, next) => {
  const adminPassword = req.headers['x-admin-password'];

  if (!adminPassword || adminPassword !== process.env.PASSWORD_ADMIN) {
    res.status(401);
    throw new Error('Mot de passe administrateur specifique incorrect ou manquant');
  }
  next();
};

module.exports = { verifyAdminPassword };