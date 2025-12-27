import { Schema, model } from "mongoose";
import mongoose from "mongoose";

const AdminSchema = new Schema(
  {
    adminUserID: [
      {
        type: String,
        required: true,
        default: [],
      },
    ],
    interestPerMonth: {
      type: Number,
      required: true,
      default: 0,
    },
    defaultPrincipalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    currentTotalPrincipalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    dateOfEMI: {
      type: Number,
      required: true,
      default: 16,
    },
  },
  { timestamps: true }
);
// Ensure only one document exists
AdminSchema.pre("save", async function (next) {
  const count = await mongoose.model("Admin").countDocuments();
  if (count > 0 && this.isNew) {
    throw new Error("Admin document already exists. Use update instead.");
  }
  next();
});

export default model("Admin", AdminSchema);
