import express from "express";
import dotenv from "dotenv";
import connectDatabase from "./config/MongoDb.js";
import ImportData from "./DataImport.js";
import productRoute from "./Routes/ProductRoutes.js";
import { errorHandler, notFound } from "./Middleware/Errors.js";
import userRouter from "./Routes/UserRoutes.js";
import orderRouter from "./Routes/orderRoutes.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { isAuth } from "./Middleware/AuthMiddleware.js";

const app = express();

if (process.env?.NODE_ENV !== "production") {
  dotenv.config();
  app.use(morgan("dev"));
}

// Use Morgan in light mode
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
const allowedOrigins = [process.env.ORIGIN, "http://localhost:3000","https://stirring-kataifi-f90695.netlify.app"];

// CORS options to set allowed origins and allow credentials
const corsOptions = {
  origin: function (origin, callback) {
    // Check if the origin is in the allowed list or if it is undefined (e.g., when the request is from the same origin)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(" Sorry, Not allowed by CORS"));
    }
  },
  credentials: true, // Allow sending and receiving of cookies and other credentials
};

// Use the cors middleware with the specified options
app.use(cors(corsOptions));
const startTime = new Date();
app.get("/", (_, res) => {
  const currentTime = new Date();
  const timeDifference = currentTime - startTime; // Time difference in milliseconds
  const runningMinutes = Math.floor(timeDifference / (1000 * 60)); // Convert milliseconds to minutes

  return res.json({
    NODE_ENV: process.env.NODE_ENV,
    message: "App is Up & Running!",
    minutes: runningMinutes,
  });
});
app.use(cookieParser());
// API

app.use("/api/import", ImportData);
app.use("/api/products", productRoute);
app.use("/api/users", userRouter);
app.use("/api/orders", orderRouter);
app.get("/api/config/paypal", isAuth, (_, res) => {
  res.send(process.env.PAYPAL_CLIENT_ID || "CLIENT_ID");
});

// ERROR HANDLER
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

app.listen(PORT, async () => {
  console.log("Listening on Port: "+PORT);
  connectDatabase();
});
