import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  // Existing fields...
  name: {
    type: String,
   
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    required: function () {
      // If loginMethod is 'credentials', password is required.
      return this.loginMethod === "credentials";
    },
  },
  emailVerificationToken: {
    type: String,
  },
  passwordResetToken: {
    type: String,
  },
  emailVerificationTokenExpiry: {
    type: Date,
  },
  profile_photo : {
    type:String
  },
  isEmailVerified: {
    type: Boolean,
    default: function () {
      // If loginMethod is 'credentials', password is required.
      return this.loginMethod === "google";
    },
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  loginMethod: {
    type: String,
    enum: ["credentials", "google"], // Enum to specify allowed values: 'credentials' or 'google'
    required: true,
    default: "credentials", // Default to 'credentials' for existing users (you can change this if needed).
  },
});

// Login
userSchema.methods.matchPassword = async function (enterPassword) {
  return await bcrypt.compare(enterPassword, this.password);
};

// Register
// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) {
//     next();
//   }
//   const salt = await bcrypt.genSalt(10);
//   this.password = bcrypt.hash(this.password, salt);
// });

const User = mongoose.model("User", userSchema);

export default User;
