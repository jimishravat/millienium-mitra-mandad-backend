import { Schema, model } from "mongoose";

const TransactionSchema = new Schema(
  {
    transactionType : {
        type: String,
        required: true,
        enum : ['LOAN', 'REGULAR', 'SETTLEMENT']
    },
    isDeleted: {
      type: Boolean,
      required: true,
      default: false,
    },
    userID: {
      type: [String],
      required: [true, "Please add a userID"],
    },
    bookID: {
      type: String,
      required: [true, "Please add a Book ID"],
    },
    principalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    isLoanTaken: {
      type: Boolean,
      required: true,
      default: false,
    },
    loanAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    loanInterestAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    loanEMI: {
      type: Number,
      required: true,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    amountReturned: {
      type: Number,
      required: true,
      default: 0,
    },
    returnedAmountDescription: {
      type: String,
      required: false,
      default: "",
    },
    penaltyAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    settlementAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    transactionBy: {
      type: String,
      required: true,
    },
    beforeTransactionAmount: {
      loanAmount: {
        type: Number,
        required: true,
        default: 0,
      },
      principalAmount: {
        type: Number,
        required: true,
        default: 0,
      },
    },
  },
  { timestamps: true }
);

export default model("Transactions", TransactionSchema);
