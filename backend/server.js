const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("Connected to database");
});

// Single unified API endpoint
const MODEL_API_URL =
  "https://0ets9ftbrg.execute-api.ap-southeast-2.amazonaws.com/prod/predict";

// Sign Up endpoint
app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const query =
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)";
    db.query(query, [name, email, hashedPassword], (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({ error: "Email already exists" });
        }
        return res.status(500).json({ error: "Database error" });
      }
      res.status(201).json({ message: "User created successfully" });
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Login endpoint
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const query = "SELECT * FROM users WHERE email = ?";
  db.query(query, [email], async (err, results) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json({
      message: "Login successful",
      userId: user.user_id,
      name: user.name,
    });
  });
});

// Get user profile endpoint
app.get("/api/profile/:userId", (req, res) => {
  const { userId } = req.params;

  const query = `
    SELECT gender, age_group, shopping_lvl, is_student, 
           pref_shop_hour, pref_shop_day 
    FROM users 
    WHERE user_id = ?
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const profile = results[0];
    res.json({
      gender: profile.gender,
      ageGroup: profile.age_group,
      shoppingLevel: profile.shopping_lvl,
      isStudent: profile.is_student,
      hourOfClick: profile.pref_shop_hour,
      dayOfClick: profile.pref_shop_day,
    });
  });
});

// Update user profile endpoint
app.put("/api/profile/:userId", (req, res) => {
  const { userId } = req.params;
  const {
    gender,
    ageGroup,
    shoppingLevel,
    isStudent,
    hourOfClick,
    dayOfClick,
  } = req.body;

  // Validate input, explicitly check for undefined to allow 0 values
  if (
    gender === undefined ||
    gender === null ||
    ageGroup === undefined ||
    ageGroup === null ||
    shoppingLevel === undefined ||
    shoppingLevel === null ||
    isStudent === undefined ||
    isStudent === null ||
    hourOfClick === undefined ||
    hourOfClick === null ||
    dayOfClick === undefined ||
    dayOfClick === null
  ) {
    return res.status(400).json({ error: "All profile fields are required" });
  }

  const query = `
    UPDATE users 
    SET gender = ?, 
        age_group = ?, 
        shopping_lvl = ?, 
        is_student = ?, 
        pref_shop_hour = ?, 
        pref_shop_day = ?
    WHERE user_id = ?
  `;

  db.query(
    query,
    [
      gender,
      ageGroup,
      shoppingLevel,
      isStudent,
      hourOfClick,
      dayOfClick,
      userId,
    ],
    (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Failed to update profile" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ message: "Profile updated successfully" });
    }
  );
});

// Helper function to get brand names
function getBrandNames(brandIds) {
  return new Promise((resolve, reject) => {
    if (!brandIds || brandIds.length === 0) {
      resolve({});
      return;
    }

    const placeholders = brandIds.map(() => "?").join(",");
    const query = `SELECT brand_id, brand_name FROM brands WHERE brand_id IN (${placeholders})`;

    db.query(query, brandIds, (err, results) => {
      if (err) {
        console.error("Error fetching brand names:", err);
        resolve({}); // Return empty mapping on error
        return;
      }

      const mapping = {};
      results.forEach((row) => {
        mapping[row.brand_id] = row.brand_name;
      });
      resolve(mapping);
    });
  });
}

// Helper function to get category names
function getCategoryNames(categoryIds) {
  return new Promise((resolve, reject) => {
    if (!categoryIds || categoryIds.length === 0) {
      resolve({});
      return;
    }

    const placeholders = categoryIds.map(() => "?").join(",");
    const query = `SELECT category_id, category_name FROM categories WHERE category_id IN (${placeholders})`;

    db.query(query, categoryIds, (err, results) => {
      if (err) {
        console.error("Error fetching category names:", err);
        resolve({}); // Return empty mapping on error
        return;
      }

      const mapping = {};
      results.forEach((row) => {
        mapping[row.category_id] = row.category_name;
      });
      resolve(mapping);
    });
  });
}

// Get recommendation endpoint (calls single unified AWS API)
app.post("/api/recommend", async (req, res) => {
  const {
    gender,
    ageGroup,
    shoppingLevel,
    isStudent,
    hourOfClick,
    dayOfClick,
    useGenModel,
  } = req.body;

  try {
    // Prepare data for external API
    const apiData = {
      gender: String(gender),
      age: String(ageGroup),
      shopping: String(shoppingLevel),
      occupation: String(isStudent),
      hour: parseInt(hourOfClick),
      day: parseInt(dayOfClick),
      use_gen_model: useGenModel === true || useGenModel === "true",
    };

    console.log("Calling recommendation API with data:", apiData);

    // Call unified recommendation API
    const response = await fetch(MODEL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(apiData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `API responded with status: ${response.status}, body: ${errorText}`
      );
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Recommendation API response:", data);

    // Extract unique brand and category IDs
    const brandIds = [
      ...new Set(data.top_10_recommendations.map((item) => item.brand)),
    ];
    const categoryIds = [
      ...new Set(data.top_10_recommendations.map((item) => item.cate_id)),
    ];

    // Fetch brand and category names from database
    const [brandMapping, categoryMapping] = await Promise.all([
      getBrandNames(brandIds),
      getCategoryNames(categoryIds),
    ]);

    // Transform the API response with actual names
    const recommendations = data.top_10_recommendations.map((item, index) => ({
      rank: index + 1,
      brandId: item.brand,
      brandName: brandMapping[item.brand] || `Unknown Brand (${item.brand})`,
      categoryId: item.cate_id,
      categoryName:
        categoryMapping[item.cate_id] || `Unknown Category (${item.cate_id})`,
      price: item.price,
      probability: item.probability,
      confidence: Math.round(item.probability * 100),
    }));

    res.json({
      success: true,
      modelType: useGenModel ? "DeepFM (gen)" : "DeepFM",
      totalProductsScored: data.total_products_scored,
      recommendations: recommendations,
    });
  } catch (error) {
    console.error("Error calling recommendation API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get recommendations",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
