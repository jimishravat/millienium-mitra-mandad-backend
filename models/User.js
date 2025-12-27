import { Schema, model } from "mongoose";

const UserSchema = new Schema(
  {
    userID: {
      type: String,
      required: [true, "Please add a userID"],
      unique: true,
    },
    name: {
      type: String,
      required: [true, "Please add a name"],
    },
    mobile: {
      type: String,
      required: [true, "Please add a mobile number"],
      unique: true,
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't return password by default in queries
    },
    isDefaultPassword: {
      type: Boolean,
      default: true,
      description:
        "True if user is using default password and should change it on first login",
    },
    booksIssued: [
      {
        type: Schema.Types.ObjectId,
        ref: "Books",
      },
    ],
    transactionHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Transactions",
      },
    ],
    isUserActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  { timestamps: true }
);

export default model("User", UserSchema);
