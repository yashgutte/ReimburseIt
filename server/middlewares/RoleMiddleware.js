const { userHasAnyRole } = require("../utils/roleUtils");

const ensureAdmin = (req, res, next) => {
  if (!req.user || !userHasAnyRole(req.user, ["admin"])) {
    return res.status(403).json({
      message: "Access denied. Only Admins can perform this action.",
      success: false,
    });
  }
  next();
};

const ensureManagerOrAdmin = (req, res, next) => {
  if (!req.user || !userHasAnyRole(req.user, ["manager", "admin"])) {
    return res.status(403).json({
      message: "Access denied. Manager or admin only.",
      success: false,
    });
  }
  next();
};

module.exports = { ensureAdmin, ensureManagerOrAdmin };
