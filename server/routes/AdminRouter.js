const router = require("express").Router();
const ensureAuthenticated = require("../middlewares/Auth");
const { ensureAdmin } = require("../middlewares/RoleMiddleware");
const {
  createCompany,
  listCompanies,
  listCompanyUsers,
  sendPasswordInvite,
} = require("../controllers/AdminController");
const {
  createRule,
  updateRule,
  deleteRule,
  getCompanyRules,
} = require("../controllers/ApprovalRuleController");

router.get("/companies", ensureAuthenticated, ensureAdmin, listCompanies);
router.post("/companies", ensureAuthenticated, ensureAdmin, createCompany);
router.get("/users", ensureAuthenticated, ensureAdmin, listCompanyUsers);
router.post(
  "/users/send-password",
  ensureAuthenticated,
  ensureAdmin,
  sendPasswordInvite,
);

router.get(
  "/approval-rules",
  ensureAuthenticated,
  ensureAdmin,
  getCompanyRules,
);
router.post(
  "/approval-rules",
  ensureAuthenticated,
  ensureAdmin,
  createRule,
);
router.put(
  "/approval-rules/:id",
  ensureAuthenticated,
  ensureAdmin,
  updateRule,
);
router.delete(
  "/approval-rules/:id",
  ensureAuthenticated,
  ensureAdmin,
  deleteRule,
);

module.exports = router;
