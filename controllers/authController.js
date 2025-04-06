const jwt = require("jsonwebtoken");
const { User } = require("../models");

// Register a new user
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      password, // Will be hashed by model hook
      role,
    });

    // Generate JWT token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // Return user data without password
    const userData = user.toJSON();
    delete userData.password;

    res.status(201).json({ user: userData, token });
  } catch (error) {
    console.error("Register error:", error);
    res.status(400).json({ error: error.message });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // Return user data without password
    const userData = user.toJSON();
    delete userData.password;

    res.json({ user: userData, token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(400).json({ error: error.message });
  }
};

module.exports = { register, login };
