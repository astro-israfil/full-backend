import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";

dotenv.config({
  path: "../.env",
});

const port = process.env.PORT || 8000;

connectDB()
  .then(() => {
    app.on("error", (error) => {
      console.log("An error event of", error);
    });
    app.listen(port, () => {
      console.log("Application running on port:", port);
    });
  })
  .catch((error) => {
    console.log("MongoDB connection failed", error);
  });
