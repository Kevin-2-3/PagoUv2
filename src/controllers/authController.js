const auth = require("../services/authService");
exports.loginPage = (req, res) => res.render("login", { layout: false, error: req.query.error });
exports.login = (req, res, next) => {
  try {
    req.session.user = auth.login(req.body.username, req.body.password);
    res.redirect("/");
  } catch (e) {
    if (e.status === 401 || e.status === 403)
      return res.status(e.status).render("login", { layout: false, error: e.message });
    next(e);
  }
};
exports.logout = (req, res, next) =>
  req.session.destroy((e) => (e ? next(e) : res.redirect("/login")));
