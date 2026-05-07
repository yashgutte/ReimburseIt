// controllers/UserController.js
const { User } = require("../models");
const bcrypt = require("bcrypt");

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, manager_id } = req.body;
    const company_id = req.user.company_id;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required." });
    }
    if (!["manager", "employee"].includes(role.toLowerCase())) {
      return res.status(400).json({ message: "Role must be 'manager' or 'employee'." });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "A user with this email already exists." });
    }
    if (manager_id) {
      const manager = await User.findOne({ _id: manager_id, company_id, role: "manager" });
      if (!manager) {
        return res.status(404).json({ message: "Invalid manager ID or manager does not belong to your company." });
      }
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = await User.create({
      name, email, password_hash: hashedPassword, role: role.toLowerCase(),
      company_id, manager_id: manager_id || null,
    });
    res.status(201).json({
      message: `${role} created successfully!`, success: true,
      user: { id: newUser._id.toString(), name: newUser.name, email: newUser.email, role: newUser.role, manager_id: newUser.manager_id?.toString() || null, company_id: newUser.company_id.toString() },
    });
  } catch (error) {
    console.error("Create User Error:", error);
    res.status(500).json({ message: "Internal server error while creating user." });
  }
};

module.exports = { createUser };
