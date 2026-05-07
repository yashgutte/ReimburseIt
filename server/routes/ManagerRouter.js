const router = require("express").Router();
const ensureAuthenticated = require("../middlewares/Auth");
const { ensureManagerOrAdmin } = require("../middlewares/RoleMiddleware");
const {
  listPendingApprovals,
  approveExpense,
  rejectExpense,
} = require("../controllers/ManagerController");

router.get(
  "/approvals",
  ensureAuthenticated,
  ensureManagerOrAdmin,
  listPendingApprovals,
);
router.post(
  "/approvals/:expenseId/approve",
  ensureAuthenticated,
  ensureManagerOrAdmin,
  approveExpense,
);
router.post(
  "/approvals/:expenseId/reject",
  ensureAuthenticated,
  ensureManagerOrAdmin,
  rejectExpense,
);

module.exports = router;
