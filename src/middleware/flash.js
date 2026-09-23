function flash(req, res, next) {
  res.locals.message = req.session.message || null;
  delete req.session.message;
  req.flash = (type, text) => {
    req.session.message = { type, text };
  };
  next();
}
module.exports = { flash };
