import express from "express";
import asyncHandler from "express-async-handler";
import { admin, isAuth } from "../Middleware/AuthMiddleware.js";
import User from "./../Models/UserModel.js";
import bcryptjs from "bcryptjs";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import { removeToken, sendToken } from "../utils/jwtToken.js";
let transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "pandeysandeep1190@gmail.com",
    pass: "zpzqdreaqzorwdfe",
  },
});
const userRouter = express.Router();

// LOGIN
userRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    let user;
    const { email, password, loginMethod, credential } = req.body;
    if (loginMethod === "credentials") {
      user = await User.findOne({ email });
      if (!user || user.loginMethod !== "credentials") {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const isPasswordValid = bcryptjs.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
    } else if (loginMethod === "google") {
      try {
        const decoded = jwt.decode(credential);
        if (decoded) {
          user = await User.findOne({
            email: decoded.email,
          });
          if (user && user?.loginMethod !== "google") {
            return res
              .status(401)
              .json({ message: "Please login with your credentials" });
          }
          if (!user) {
            // Create a new user if not found
            user = new User({
              email: decoded.email,
              name: decoded.name,
              isEmailVerified: true,
              loginMethod: "google",
              profile_photo: decoded.picture,
            });
            user = await user.save();
          }
          if (user && user.loginMethod === "credentials") {
            throw new Error("This email is already registered");
          }
        } else {
          throw new Error("Invalid Google Token");
        }
      } catch (error) {
        // Google token verification failed
        return res
          .status(401)
          .json({ message: error.message || "Invalid Google token" });
      }
    } else {
      return res.status(400).json({ message: "Invalid login method" });
    }

    user.password = undefined;

    sendToken(user, 200, res);
  })
);

userRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    removeToken(res);
  })
);

// REGISTER
userRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
      res.status(400);
      throw new Error("User already exists");
    }
    const emailToken = jwt.sign({ email: email }, "abhinav", {
      expiresIn: "15min",
    });
    const currentTime = new Date();
    const expirationTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
    const finalExpirationTime = expirationTime.toISOString();
    const user = await User.create({
      name,
      email,
      password: bcryptjs.hashSync(password),
      emailVerificationToken: emailToken, // Save the email verification token in the database
      emailVerificationTokenExpiry: finalExpirationTime,
      loginMethod: "credentials",
    });
    await transporter.sendMail({
      from: "Gadget.com",
      to: user.email,
      subject: "Verify Email",

      html: `<b>Hi! Verify email address by clicking on this
      <a href="${process.env.ORIGIN}/verify-email/${emailToken}">Verify Email</a></b>`,
    });
    if (user) {
      user.password = undefined;
      sendToken(user, 200, res);
    } else {
      res.status(400);
      throw new Error("Invalid User Data");
    }
  })
);

userRouter.get(
  "/me",
  isAuth,
  asyncHandler(async (req, res) => {
    return res.status(200).json(res.locals.user);
  })
);
userRouter.put("/verify-email", isAuth, async (req, res) => {
  try {
    const user = await User.findOne({ email: res.locals?.user?.email });

    const emailToken = jwt.sign({ email: user?.email }, "abhinav", {
      expiresIn: "15min",
    });
    const currentTime = new Date();
    const expirationTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
    const finalExpirationTime = expirationTime.toISOString();

    (user.emailVerificationToken = emailToken), // Save the email verification token in the database
      (user.emailVerificationTokenExpiry = finalExpirationTime);

    const savedUser = await user.save();

    await transporter.sendMail({
      from: "Gadget.com",
      to: savedUser.email,
      subject: "Verify Email",

      html: `<b>Hi! Verify email address by clicking on this
      <a href="${process.env.ORIGIN}/verify-email/${emailToken}">Verify Email</a></b>`,
    });

    return res.status(200).json({ success: true, message: "Email Sent" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while sending email to the user.",
    });
  }
});
userRouter.post("/verify-email", isAuth, async (req, res) => {
  const { token } = req.body;

  try {
    // Verify the JWT token with the same secret used during registration
    const secret = "abhinav"; // Replace with your actual secret used for JWT signing during registration

    // Verify the token and get the payload data
    const payload = jwt.verify(token, secret);

    // Extract the username from the payload (you can add more data to the payload during registration if needed)
    const { email } = payload;

    // Find the user in the database based on the extracted username
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check if the token matches the email verification token and is not expired
    if (
      user.emailVerificationToken !== token ||
      new Date() > user.emailVerificationTokenExpiry
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired email verification token",
      });
    }

    // Update the email verification status for the user
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpiry = undefined;
    user.isEmailVerified = true;

    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "An error occurred while verifying the email",
    });
  }
});
// PROFILE
userRouter.get(
  "/profile",
  isAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(res.locals.user._id).select("-password");

    if (user) {
      res.json(user);
    } else {
      res.status(404);
      throw new Error("User not found");
    }
  })
);

// UPDATE PROFILE
// UPDATE PROFILE
userRouter.put(
  "/profile",
  isAuth,
  asyncHandler(async (req, res) => {
    const userId = res.locals.user._id;
    const { name, email, password } = req.body;
    const found = await User.findById(userId).select('-password');

    if (!found) {
      res.status(404);
      throw new Error("User not found");
    }

    if (name) {
      found.name = name;
    }

    if (email) {
      if (email !== found.email) {
        // Check if the provided email is different from the current email
        const emailInUse = await User.findOne({ email });
        if (emailInUse) {
          res.status(400);
          throw new Error("Email already in use");
        }
        found.email = email; // Update the email if it's not already in use
        found.isEmailVerified = false; // Mark email as unverified if changed
      }
    }

    if (password) {
      found.password = bcryptjs.hashSync(password);
    }

    const updatedUser = await found.save();
    res.json(updatedUser);
  })
);
// GET ALL USER ADMIN
userRouter.get(
  "/",
  isAuth,
  admin,
  asyncHandler(async (req, res) => {
    const users = await User.find({});
    res.json(users);
  })
);

export default userRouter;
