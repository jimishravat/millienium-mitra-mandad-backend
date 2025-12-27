import Books from "../models/Books.js";
import Transactions from "../models/Transactions.js";
import User from "../models/User.js";

class DataManager {
  constructor() {
    /**
     * userID => [ userObject, booksIssuedArray, transactionHistoryDateWiseObject ]
     *
     * transactionHistoryDateWiseObject -> sorted in descending order by date
     * Structure: {
     *      '2023-10-01': [ transactionObject1, transactionObject2, ... ],
     *     '2023-09-30': [ transactionObject3, transactionObject4, ... ],
     * }
     *
     */
    this.userMap = new Map();
    /**
     * bookID => bookObject
     */
    this.bookMap = new Map();
    /**
     * transactionID => transactionObject
     */
    this.transactionMap = new Map();

    this.lastSyncTime = null;
    this.isSyncing = false;
  }

  async loadData() {
    // Implementation for loading data from database into the maps
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      // Load Users
      const users = await User.find({ isUserActive: true });
      const books = await Books.find({ isActive: true });
      const transactions = await Transactions.find({ isDeleted: false });

      // Sort transactions by date and group into date-wise object (user-wise)
      const userWiseTransactionsByDate = transactions.reduce(
        (userAcc, transaction) => {
          // Handle userID as array
          const userIDs = Array.isArray(transaction.userID)
            ? transaction.userID
            : [transaction.userID];

          // Format date as DD-MM-YYYY
          const transactionDate = new Date(transaction.createdAt);
          const formattedDate = transactionDate.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });

          // Add transaction to each user
          userIDs.forEach((userID) => {
            // Initialize user object if doesn't exist
            if (!userAcc[userID]) {
              userAcc[userID] = {};
            }

            // Initialize array for this date if it doesn't exist
            if (!userAcc[userID][formattedDate]) {
              userAcc[userID][formattedDate] = [];
            }

            // Add transaction ID to the date group
            userAcc[userID][formattedDate].push(transaction._id.toString());
          });

          return userAcc;
        },
        {}
      );

      // Sort dates for each user in descending order (newest first)
      const sortedUserWiseTransactionsByDate = Object.keys(
        userWiseTransactionsByDate
      ).reduce((userAcc, userID) => {
        const userTransactions = userWiseTransactionsByDate[userID];

        // Sort dates for this user
        const sortedDates = Object.keys(userTransactions)
          .sort((dateA, dateB) => {
            const [dayA, monthA, yearA] = dateA.split("-").map(Number);
            const [dayB, monthB, yearB] = dateB.split("-").map(Number);
            const dateObjA = new Date(yearA, monthA - 1, dayA);
            const dateObjB = new Date(yearB, monthB - 1, dayB);
            return dateObjB - dateObjA; // Descending order
          })
          .reduce((acc, date) => {
            acc[date] = userTransactions[date];
            return acc;
          }, {});

        userAcc[userID] = sortedDates;
        return userAcc;
      }, {});

      // Populate userMap
      users.forEach((user) => {
        const userID = user.userID;
        const booksIssued = books
          .filter((book) => book.userID.includes(userID))
          .map((book) => book._id.toString());
        const transactionHistoryByDate =
          sortedUserWiseTransactionsByDate[userID] || {};
        this.userMap.set(userID, [user, booksIssued, transactionHistoryByDate]);
      });

      // Populate bookMap
      books.forEach((book) => {
        this.bookMap.set(book.bookID, book);
      });

      // Populate transactionMap
      transactions.forEach((transaction) => {
        this.transactionMap.set(transaction._id.toString(), transaction);
      });

      this.lastSyncTime = new Date();
      console.log(
        "DataManager: Data loaded successfully at",
        this.lastSyncTime
      );
    } catch (error) {
      console.error("Error loading data in DataManager:", error);
    } finally {
      this.isSyncing = false;
    }
  }
}

export const dataManager = new DataManager();
