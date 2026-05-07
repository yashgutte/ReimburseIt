const { User, Company } = require("../models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendLoginCredentialsEmail } = require("../utils/mailer");
const {
  primaryRole,
  rolesFromUserRow,
  tokenRolesPayload,
} = require("../utils/roleUtils");

const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const generateTempPassword = () =>
  crypto.randomBytes(12).toString("base64url").slice(0, 16);
const {
  convertToImageUrl,
  convertToImageUrlStatic,
} = require("../utils/imageUtils");

// --- Helper to fetch currency ---
const getCurrencyByCountry = async (countryName) => {
  try {
    const response = await fetch(
      "https://restcountries.com/v3.1/all?fields=name,currencies",
    );
    const countries = await response.json();

    const countryData = countries.find(
      (c) => c.name.common.toLowerCase() === countryName.toLowerCase(),
    );

    if (countryData && countryData.currencies) {
      return Object.keys(countryData.currencies)[0];
    }
    return "USD";
  } catch (error) {
    console.error("Error fetching currency:", error);
    return "USD";
  }
};

const processUserForResponse = (user, req) => {
  const raw = user.toObject ? user.toObject() : { ...user };
  const { _id, ...rest } = raw;
  delete rest.password;
  delete rest.password_hash;
  const userObj = { _id: _id.toString(), ...rest };
  const roles = rolesFromUserRow({
    roles: userObj.roles,
    role: userObj.role,
  });
  const pr = primaryRole(roles);
  return {
    ...userObj,
    role: pr,
    roles: roles.length ? roles : [pr],
    profilePicture: userObj.profilePicture
      ? req
        ? convertToImageUrl(userObj.profilePicture, req)
        : convertToImageUrlStatic(userObj.profilePicture)
      : null,
  };
};

const toPublicUser = (userResponse) => {
  const roles = rolesFromUserRow({
    roles: userResponse.roles,
    role: userResponse.role,
  });
  const pr = primaryRole(roles);
  return {
    _id: userResponse._id,
    name: userResponse.name,
    email: userResponse.email,
    username: userResponse.username,
    profilePicture: userResponse.profilePicture,
    bio: userResponse.bio,
    role: pr,
    roles: roles.length ? roles : [pr],
    companyId: userResponse.companyId,
  };
};

const signUp = async (req, res) => {
  try {
    const { companyName, country, name, email, password } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists with this email",
        success: false,
        field: "email",
      });
    }

    // Fetch Currency
    const baseCurrency = await getCurrencyByCountry(country);

    // Create Company
    const newCompany = await Company.create({
      name: companyName,
      country: country,
      currency_code: baseCurrency,
    });

    // Create Admin User
    const adminRoles = ["admin"];
    const newUser = await User.create({
      name: name,
      email: email,
      password_hash: await bcrypt.hash(password, 12),
      role: "admin",
      roles: adminRoles,
      company_id: newCompany._id,
      manager_id: null,
    });

    try {
      await sendLoginCredentialsEmail({
        to: newUser.email,
        recipientName: newUser.name,
        loginEmail: newUser.email,
        password,
        subject: "Welcome — your company admin account",
      });
    } catch (mailErr) {
      console.error("signUp welcome email:", mailErr.message);
    }

    const { role: tokenRole, roles: tokenRoles } = tokenRolesPayload(newUser);
    const jwtToken = jwt.sign(
      {
        email: newUser.email,
        _id: newUser._id.toString(),
        role: tokenRole,
        roles: tokenRoles,
        company_id: newUser.company_id.toString(),
        company_currency: newCompany.currency_code || null,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" },
    );

    res.status(201).json({
      message: "Company and Admin registered successfully",
      success: true,
      token: jwtToken,
      user: {
        _id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: tokenRole,
        roles: tokenRoles,
        company_id: newUser.company_id.toString(),
        company_currency: newCompany.currency_code || null,
      },
      company: newCompany,
    });
  } catch (err) {
    console.error("SignUp Error:", err);
    res.status(500).json({
      message: "Internal server error during registration",
      success: false,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const emailNorm = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!emailNorm || password == null || password === "") {
      return res
        .status(401)
        .json({ message: "Invalid email or password", success: false });
    }

    const user = await User.findOne({
      email: { $regex: new RegExp(`^${emailNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") },
    });
    if (!user) {
      return res
        .status(401)
        .json({ message: "Invalid email or password", success: false });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ message: "Invalid email or password", success: false });
    }

    const company = user.company_id
      ? await Company.findById(user.company_id)
      : null;
    const companyCurrency = company?.currency_code || null;

    // Build role payload same way signup does — ensures roles array is always present
    const { role: tokenRole, roles: tokenRoles } = tokenRolesPayload(user);

    const jwtToken = jwt.sign(
      {
        email: user.email,
        _id: user._id.toString(),
        role: tokenRole,
        roles: tokenRoles,
        company_id: user.company_id.toString(),
        company_currency: companyCurrency,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(200).json({
      message: "Login successful",
      success: true,
      token: jwtToken,
      user: {
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: tokenRole,
        roles: tokenRoles,
        company_id: user.company_id.toString(),
        company_currency: companyCurrency,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    res
      .status(500)
      .json({ message: "Internal server error during login", success: false });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    const userResponse = processUserForResponse(user, req);
    res.status(200).json({
      message: "Profile retrieved successfully",
      success: true,
      user: toPublicUser(userResponse),
    });
  } catch (err) {
    console.error("Get Profile Error:", err);
    res.status(500).json({
      message: "Internal server error",
      success: false,
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, bio } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    // req.file.path is the full Cloudinary HTTPS URL
    if (req.file) user.profilePicture = req.file.path;

    await user.save();

    const userResponse = processUserForResponse(user, req);
    res.status(200).json({
      message: "Profile updated successfully",
      success: true,
      user: toPublicUser(userResponse),
    });
  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({
      message: "Internal server error",
      success: false,
    });
  }
};

const logout = async (req, res) => {
  try {
    res.status(200).json({
      message: "Logged out successfully",
      success: true,
    });
  } catch (err) {
    console.error("Logout Error:", err);
    res.status(500).json({
      message: "Internal server error",
      success: false,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const emailRaw = req.body?.email;
    const emailNorm =
      typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
    if (!emailNorm || !emailRx.test(emailNorm)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const user = await User.findOne({
      email: { $regex: new RegExp(`^${emailNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") },
    });

    const generic =
      "If an account exists for this email, a new temporary password has been sent.";

    if (!user) {
      return res.status(200).json({ success: true, message: generic });
    }

    const tempPassword = generateTempPassword();
    user.password_hash = await bcrypt.hash(tempPassword, 12);
    await user.save();

    try {
      await sendLoginCredentialsEmail({
        to: user.email,
        recipientName: user.name,
        loginEmail: user.email,
        password: tempPassword,
        subject: "Password reset — your new temporary password",
      });
    } catch (mailErr) {
      console.error("forgotPassword email:", mailErr.message);
    }

    return res.status(200).json({ success: true, message: generic });
  } catch (err) {
    console.error("forgotPassword:", err);
    return res.status(500).json({
      success: false,
      message: "Could not process password reset.",
    });
  }
};

module.exports = {
  signUp,
  login,
  getProfile,
  updateProfile,
  logout,
  forgotPassword,
};
