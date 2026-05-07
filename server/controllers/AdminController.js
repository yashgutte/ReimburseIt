const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { User, Company } = require("../models");
const { sendLoginCredentialsEmail } = require("../utils/mailer");
const { normalizeRoles, primaryRole } = require("../utils/roleUtils");

const stdOk = (res, status, message, data = {}) =>
  res.status(status).json({ success: true, message, data });
const stdErr = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });
const generateTempPassword = () =>
  crypto.randomBytes(12).toString("base64url").slice(0, 16);
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createCompany = async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    const country = (req.body?.country || "").trim();
    const baseCurrency = (req.body?.baseCurrency || req.body?.currency_code || "").trim().toUpperCase();
    if (!name || name.length < 2) return stdErr(res, 400, "Company name must be at least 2 characters.");
    if (!country) return stdErr(res, 400, "Country is required.");
    if (!baseCurrency || baseCurrency.length < 3) return stdErr(res, 400, "A valid currency code is required.");
    const dup = await Company.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
    if (dup) return stdErr(res, 409, "A company with this name already exists.");
    const company = await Company.create({ name, country, currency_code: baseCurrency });
    return stdOk(res, 201, "Company created successfully.", {
      company: { id: company._id.toString(), name: company.name, country: company.country, currency_code: company.currency_code, created_at: company.createdAt },
    });
  } catch (err) { console.error("createCompany:", err); return stdErr(res, 500, "Could not create company."); }
};

const listCompanies = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return stdErr(res, 400, "Missing company context for this admin.");
    const companies = await Company.find({ _id: companyId }).sort({ createdAt: -1 }).lean();
    const payload = companies.map((c) => ({ id: c._id.toString(), name: c.name, country: c.country, currency_code: c.currency_code, created_at: c.createdAt }));
    return stdOk(res, 200, "OK", { companies: payload });
  } catch (err) { console.error("listCompanies:", err); return stdErr(res, 500, "Could not load companies."); }
};

const listCompanyUsers = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    if (!company_id) return stdErr(res, 400, "Missing company context for this admin.");
    const users = await User.find({ company_id }).sort({ name: 1 }).lean();
    const managerIds = [...new Set(users.filter((u) => u.manager_id).map((u) => u.manager_id.toString()))];
    const managers = managerIds.length ? await User.find({ _id: { $in: managerIds } }).select("_id name email").lean() : [];
    const mgrMap = new Map(managers.map((m) => [m._id.toString(), m]));
    const payload = users.map((u) => {
      const rList = normalizeRoles(u.roles?.length ? u.roles : [u.role]);
      const mgr = u.manager_id ? mgrMap.get(u.manager_id.toString()) : null;
      return { id: u._id.toString(), name: u.name, email: u.email, role: primaryRole(rList), roles: rList.length ? rList : [u.role], manager_id: u.manager_id ? u.manager_id.toString() : null, company_id: u.company_id.toString(), managerName: mgr?.name ?? null, managerEmail: mgr?.email ?? null };
    });
    return stdOk(res, 200, "OK", { users: payload });
  } catch (err) { console.error("listCompanyUsers:", err); return stdErr(res, 500, "Could not load users."); }
};

function summarizeMailResults(results) {
  const mail = (results || []).map((r) => ({ to: r.to, sent: Boolean(r.sent), skipped: Boolean(r.skipped), error: r.error || null }));
  const anyFailed = (results || []).some((r) => !r.sent && !r.skipped && r.error);
  return { emailSent: (results || []).some((r) => r.sent), mailFailed: anyFailed, mail };
}

const sendPasswordInvite = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    if (!company_id) return stdErr(res, 400, "Missing company context for this admin.");
    const { userName, userId, email, role, roles: rolesBody, managerName, managerId, managerEmail, createUserIfNew, createManagerIfNew } = req.body;
    const name = (userName || "").trim();
    const emailNorm = (email || "").trim().toLowerCase();
    const nRoles = normalizeRoles(Array.isArray(rolesBody) && rolesBody.length ? rolesBody : role ? [role] : []);
    const isExistingReset = !createUserIfNew && userId;
    if (!name || name.length < 2) return stdErr(res, 400, "User name is required.");
    if (!emailNorm || !emailRx.test(emailNorm)) return stdErr(res, 400, "A valid email is required.");
    if (!isExistingReset && !nRoles.length) return stdErr(res, 400, "Select at least one role.");
    const roleNorm = nRoles.length ? primaryRole(nRoles) : null;
    let resolvedManagerId = managerId || null;
    let managerTemporaryPassword, managerInviteEmail = null;
    const needsMgr = !isExistingReset && nRoles.includes("employee") && !nRoles.includes("admin");
    if (needsMgr) {
      if (resolvedManagerId) {
        const mgr = await User.findOne({ _id: resolvedManagerId, company_id, role: "manager" });
        if (!mgr) return stdErr(res, 400, "Invalid manager for this company.");
      } else if (createManagerIfNew && (managerName || "").trim()) {
        const me = (managerEmail || "").trim().toLowerCase();
        if (!me || !emailRx.test(me)) return stdErr(res, 400, "Manager email is required to create a new manager.");
        if (await User.findOne({ email: me })) return stdErr(res, 409, "Manager email is already registered.");
        managerInviteEmail = me;
        managerTemporaryPassword = generateTempPassword();
        const newMgr = await User.create({ name: (managerName || "").trim(), email: me, password_hash: await bcrypt.hash(managerTemporaryPassword, 12), role: "manager", roles: ["manager"], company_id, manager_id: null });
        resolvedManagerId = newMgr._id;
      } else if ((managerName || "").trim()) {
        const found = await User.findOne({ company_id, role: "manager", name: { $regex: new RegExp(`^${(managerName||"").trim()}$`, "i") } });
        resolvedManagerId = found?._id || null;
        if (!resolvedManagerId) return stdErr(res, 400, "Unknown manager. Pick someone from the list, or provide manager email to create a new manager.");
      }
    } else { resolvedManagerId = null; }
    const tempPassword = generateTempPassword();
    const password_hash = await bcrypt.hash(tempPassword, 12);
    if (!createUserIfNew && userId) {
      const existing = await User.findOne({ _id: userId, company_id });
      if (!existing) return stdErr(res, 404, "User not found in your company.");
      existing.password_hash = password_hash;
      if (nRoles.length) { existing.roles = nRoles; existing.role = primaryRole(nRoles); }
      await existing.save();
      const mailRes = await sendLoginCredentialsEmail({ to: existing.email, recipientName: existing.name, loginEmail: existing.email, password: tempPassword, subject: "Your new temporary password" });
      const { emailSent, mailFailed, mail } = summarizeMailResults([mailRes]);
      return stdOk(res, 200, emailSent ? "Temporary password set and sent by email." : mailFailed ? "Temporary password set; email delivery failed." : "Temporary password set.", { temporaryPassword: tempPassword, managerTemporaryPassword: managerTemporaryPassword || undefined, user: { id: existing._id.toString(), name: existing.name, email: existing.email, role: existing.role, roles: normalizeRoles(existing.roles?.length ? existing.roles : [existing.role]) }, emailSent, mailFailed, mail });
    }
    if (createUserIfNew) {
      if (await User.findOne({ email: emailNorm })) return stdErr(res, 409, "A user with this email already exists.");
      const newUser = await User.create({ name, email: emailNorm, password_hash, role: roleNorm, roles: nRoles, company_id, manager_id: nRoles.includes("admin") ? null : resolvedManagerId });
      const mailPieces = [];
      if (managerTemporaryPassword && managerInviteEmail) { mailPieces.push(await sendLoginCredentialsEmail({ to: managerInviteEmail, recipientName: (managerName || "").trim(), loginEmail: managerInviteEmail, password: managerTemporaryPassword, subject: "Your manager account — login details" })); }
      mailPieces.push(await sendLoginCredentialsEmail({ to: emailNorm, recipientName: name, loginEmail: emailNorm, password: tempPassword, subject: "Your account — login details" }));
      const { emailSent, mailFailed, mail } = summarizeMailResults(mailPieces);
      return stdOk(res, 201, emailSent ? "User created and credentials sent by email." : mailFailed ? "User created; email delivery failed." : "User created with a temporary password.", { temporaryPassword: tempPassword, managerTemporaryPassword: managerTemporaryPassword || undefined, user: { id: newUser._id.toString(), name: newUser.name, email: newUser.email, role: newUser.role, roles: nRoles, manager_id: newUser.manager_id?.toString() || null }, emailSent, mailFailed, mail });
    }
    return stdErr(res, 400, "Invalid invite request.");
  } catch (err) { console.error("sendPasswordInvite:", err); return stdErr(res, 500, "Could not process user invite."); }
};

module.exports = { createCompany, listCompanies, listCompanyUsers, sendPasswordInvite };
