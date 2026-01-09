const mongoose = require("mongoose");
        const DB_NAME = process.env.DB_NAME || "mydatabase";
const url = `mongodb://localhost:27017/${DB_NAME}`;

const dbconnection = () => {
  try {
    mongoose.connect(url)
    console.log(`🚀 Connected to MongoDB `);
  } catch (err) {
    console.error("❌ Error connecting to MongoDB:", err);
  }
};


module.exports = {dbconnection};
// This code connects to a MongoDB database using Mongoose.
