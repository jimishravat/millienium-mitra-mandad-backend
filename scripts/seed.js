import { config } from "dotenv";
import mongoose from "mongoose";
import xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { hashPassword } from "../helper.js";
import User from "../models/User.js";
import Books from "../models/Books.js";
import Transactions from "../models/Transactions.js";
import { dataManager } from "../config/dataManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config();

const EXCEL_FILE_PATH = process.env.EXCEL_FILE_PATH || "./data/seedData.xlsx";

class DataSeeder {
  constructor() {
    this.userMap = new Map();
    this.bookMap = new Map();
    this.transactionMap = new Map();
  }

  /**
   * Convert date from MM/DD/YYYY format (Excel) to JavaScript Date object
   * @param {string} dateString - Date in MM/DD/YYYY format (e.g., "12/16/2025")
   * @returns {Date} JavaScript Date object
   */
  convertExcelDateToJS(dateString) {
    if (!dateString) return new Date();

    // Handle Excel numeric dates (serial numbers)
    if (typeof dateString === "number") {
      const excelEpoch = new Date(1900, 0, 1);
      const millisecondsPerDay = 86400000;
      return new Date(
        excelEpoch.getTime() + (dateString - 2) * millisecondsPerDay
      );
    }

    // Handle string dates in MM/DD/YYYY format
    if (typeof dateString === "string") {
      const [month, day, year] = dateString.split("/").map(Number);
      return new Date(year, month - 1, day);
    }

    return new Date();
  }

  async connectDB() {
    try {
      await mongoose.connect(
        process.env.MONGODB_URI || "mongodb://localhost:27017/mitramandal"
      );
      console.log("✅ Connected to MongoDB");
    } catch (error) {
      console.error("❌ MongoDB connection error:", error);
      process.exit(1);
    }
  }

  async readExcelData() {
    try {
      const workbook = xlsx.readFile(EXCEL_FILE_PATH);

      return {
        users: xlsx.utils.sheet_to_json(workbook.Sheets["User"]),
        books: xlsx.utils.sheet_to_json(workbook.Sheets["Books"]),
        transactions: xlsx.utils.sheet_to_json(workbook.Sheets["Transactions"]),
        admin: xlsx.utils.sheet_to_json(workbook.Sheets["Admin_Config"]),
      };
    } catch (error) {
      console.error("❌ Error reading Excel file:", error);
      process.exit(1);
    }
  }

  async seedUserData(usersData) {
    console.log("Seeding User Data...");
    try {
      for (const userData of usersData) {
        const hashedPassword = await hashPassword(String(userData.password));

        const user = await User.create({
          userID: userData.userID,
          name: userData.name,
          mobile: String(userData.mobile),
          password: hashedPassword,
          isDefaultPassword:
            userData.isDefaultPassword === "true" ||
            userData.isDefaultPassword === true,
          isUserActive: true,
          booksIssued: [],
        });

        this.userMap.set(userData.userID, user._id);
        console.log(`✅ User created: ${userData.name} (${userData.userID})`);
      }
    } catch (error) {
      console.error("❌ Error seeding users:", error);
    }
  }

  async seedBooksData(booksData) {
    console.log("\n📚 Seeding Books...");

    try {
      for (const bookData of booksData) {
        // Parse userIDs from comma-separated string
        const userIDs = String(bookData["userID"])
          .split(",")
          .map((id) => id.trim());

        const book = await Books.create({
          bookID: bookData.bookID,
          bookName: bookData.bookName,
          userID: userIDs,
          currentPrincipalAmount: Number(bookData.currentPrincipalAmount),
          loanAmount: Number(bookData.loanAmount),
          isLoanActive:
            bookData.isLoanActive === "true" || bookData.isLoanActive === true,
          transactionHistory: [],
        });

        this.bookMap.set(bookData.bookID, book._id);

        // Update user's booksIssued array
        for (const userID of userIDs) {
          await User.updateOne(
            { userID },
            { $push: { booksIssued: book._id } }
          );
        }

        console.log(
          `✅ Book created: ${bookData.bookName} (${bookData.bookID})`
        );
      }
    } catch (error) {
      console.error("❌ Error seeding books:", error);
    }
  }

  async seedTransactionData(transactionsData) {
    console.log("\n💰 Seeding Transactions...");

    try {
      for (const transData of transactionsData) {

        const userIDs = String(transData["userID"])
          .split(",")
          .map((id) => id.trim());

        const transaction = await Transactions.create({
          userID: userIDs,
          bookID: transData.bookID,
          principalAmount: Number(transData.principalAmount),
          loanEMI: Number(transData.loanEMI),
          loanInterestAmount: Number(transData.loanInterestAmount),
          penaltyAmount: Number(transData.penaltyAmount),
          amountReturned: Number(transData.amountReturned || 0),
          isLoanTaken:
            transData.isLoanTaken === "true" || transData.isLoanTaken === true,
          settlementAmount: Number(transData.settlementAmount || 0),
          transactionType: transData.transactionType,
          totalAmount:
            Number(transData.principalAmount) +
            Number(transData.loanEMI) +
            Number(transData.loanInterestAmount) +
            Number(transData.penaltyAmount),
          createdAt: this.convertExcelDateToJS(transData.transactionDate),
          transactionBy: "00000", // Admin userID for seeding
        });

        // Add transaction to book's history
        const book = await Books.findOne({ bookID: transData.bookID });
        if (book) {
          book.transactionHistory.push(transaction._id);
          await book.save();
        }

         // Update user's booksIssued array
        for (const userID of String(transData.userID).split(",").map((id) => id.trim())) {
          await User.updateOne(
            { userID },
            { $push: { transactionHistory: transaction._id } }
          );
        }
        // const user = await User.findOne({ userID: transData.userID });
        // if (user) {
        //   user.transactionHistory.push(transaction._id);
        //   await user.save();
        // }

        console.log(
          `✅ Transaction created for User ${transData.userID} in Book ${transData.bookID}`
        );
      }
    } catch (error) {
      console.error("❌ Error seeding transactions:", error);
    }
  }

  async clearExistingData() {
    console.log("Clearing existing data...");
    try {
      await User.deleteMany({ userID: { $ne: "00000" } }); // Keep default admin
      await Books.deleteMany({});
      await Transactions.deleteMany({});
      console.log("✅ Existing data cleared (except default admin)");
    } catch (error) {
      console.error("❌ Error clearing data:", error);
    }
  }

  async run() {
    try {
      console.log("🚀 Starting Data Seeding...\n");

      await this.connectDB();

      // Ask to clear existing data
      console.log("Reading Excel file...");
      const { users, books, transactions, admin } = await this.readExcelData();

      console.log(
        `Found ${users.length} users, ${books.length} books, ${transactions.length} transactions`
      );

      // Clear existing data
      await this.clearExistingData();

      // Seed data in order
      await this.seedUserData(users);
      await this.seedBooksData(books);
      await this.seedTransactionData(transactions);
      //   await this.seedAdmin(admin);

      console.log("\n✅ Data seeding completed successfully!");
      await dataManager.loadData();

      // Convert Maps to objects and save to JSON file
      const dataSnapshot = {
        timestamp: new Date().toISOString(),
        userMap: Object.fromEntries(dataManager.userMap),
        bookMap: Object.fromEntries(dataManager.bookMap),
        transactionMap: Object.fromEntries(dataManager.transactionMap),
      };

      const jsonFilePath = path.join(__dirname, "user.json");
      fs.writeFileSync(jsonFilePath, JSON.stringify(dataSnapshot, null, 2));
      console.log(`\n✅ Data snapshot saved to: ${jsonFilePath}`);

      process.exit(0);
    } catch (error) {
      console.error("❌ Seeding error:", error);
      process.exit(1);
    }
  }
}
const seeder = new DataSeeder();
seeder.run();
