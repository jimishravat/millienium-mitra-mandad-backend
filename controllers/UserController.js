import mongoose from "mongoose";
import { dataManager } from "../config/dataManager.js";
import { verifyJWTToken } from "../helper.js";
import Books from "../models/Books.js";
import Transactions from "../models/Transactions.js";
import User from "../models/User.js";

export const getUserDetails = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);

  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  let userDetails;
  let totalPrincipleAmount = 0;
  let totalLoanAmount = 0;
  let totalSettlementAmount = 0;
  let responseObject = {};
  let lastTransactionDate = null;
  let lastTransactionDetails = {
    principalAmount: 0,
    loanInterestAmount: 0,
    loanEMI: 0,
    totalAmount: 0,
    amountReturned: 0,
    penaltyAmount: 0,
    settlementAmount: 0,
  };

  if (dataManager.userMap.has(decoded.userID)) {
    userDetails = dataManager.userMap.get(decoded.userID);
  } else {
    userDetails = await User.findOne({ userID: decoded.userID });
    if (!userDetails) {
      return res
        .status(200)
        .json({ success: false, message: "User not found" });
    }
    dataManager.setUserMap(userDetails);
  }

  responseObject.userDetails = userDetails;
  responseObject.totalBooksIssued = userDetails.booksIssued.length;

  for (const bookId of userDetails.booksIssued) {
    let bookDetails;
    if (dataManager.bookMap.has(bookId)) {
      bookDetails = dataManager.bookMap.get(bookId);
    } else {
      bookDetails = await Books.findById(bookId);
      if (bookDetails) {
        dataManager.setBookMap(bookDetails);
      }
    }
    if (bookDetails) {
      totalPrincipleAmount += bookDetails.currentPrincipalAmount || 0;
      totalLoanAmount += bookDetails.loanAmount || 0;
      totalSettlementAmount += bookDetails.settlementAmount || 0;
    }
  }

  responseObject.totalPrincipleAmount = totalPrincipleAmount;
  responseObject.totalLoanAmount = totalLoanAmount;
  responseObject.totalSettlementAmount = totalSettlementAmount;

  const monthlyTransactions = await Transactions.aggregate([
    { $match: { userID: { $in: [decoded.userID] }, isDeleted: false } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          bookID: "$bookID",
        },
        lastTransaction: { $first: "$$ROOT" },
        lastDate: { $max: "$createdAt" },
      },
    },
    { $sort: { "_id.year": -1, "_id.month": -1, "_id.bookID": 1 } },
  ]);

  dataManager.setUserMonthlyTransactionMap(monthlyTransactions);

  // Get previous month's transactions
  const today = new Date();
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthYear = lastMonthDate.getFullYear();
  const lastMonthMonth = lastMonthDate.getMonth() + 1;

  const lastMonthTransactions = monthlyTransactions.filter(
    (t) => t._id.year === lastMonthYear && t._id.month === lastMonthMonth
  );

  lastMonthTransactions.forEach((transaction) => {
    lastTransactionDate = transaction.lastDate;
    lastTransactionDetails.principalAmount +=
      transaction.lastTransaction.principalAmount || 0;

    lastTransactionDetails.loanInterestAmount +=
      transaction.lastTransaction.loanInterestAmount || 0;

    lastTransactionDetails.loanEMI += transaction.lastTransaction.loanEMI || 0;

    lastTransactionDetails.totalAmount +=
      transaction.lastTransaction.totalAmount || 0;

    lastTransactionDetails.amountReturned +=
      transaction.lastTransaction.amountReturned || 0;

    lastTransactionDetails.penaltyAmount +=
      transaction.lastTransaction.penaltyAmount || 0;

    lastTransactionDetails.settlementAmount +=
      transaction.lastTransaction.settlementAmount || 0;
  });

  responseObject.lastTransactionDate = lastTransactionDate;
  responseObject.lastTransactionDetails = lastTransactionDetails;

  return res.status(200).json({
    success: true,
    data: {
      ...responseObject,
    },
  });
};

export const getUserBooksDetails = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);

  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  let bookDetails = [];

  if (dataManager.userMap.has(decoded.userID)) {
    const userBookObjectIDs = dataManager.userMap.get(
      decoded.userID
    ).booksIssued;
    for (const bookObjectID in userBookObjectIDs) {
      if (dataManager.bookMap.has(bookObjectID)) {
        bookDetails.push(dataManager.getBookByObjectID(bookObjectID));
      } else {
        const bookDetail = await Books.findById(bookObjectID);
        if (bookDetail) {
          dataManager.setBookMap(bookDetail);
          bookDetails.push(bookDetail);
        }
      }
    }
  } else {
    const userDetails = await User.findOne({ userID: decoded.userID });
    if (!userDetails) {
      return res
        .status(200)
        .json({ success: false, message: "User not found" });
    }
    dataManager.setUserMap(userDetails);

    for (const bookId of userDetails.booksIssued) {
      let bookDetail = await Books.findById(bookId);
      if (bookDetail) {
        dataManager.setBookMap(bookDetail);
        bookDetails.push(bookDetail);
      }
    }
  }

  return res.status(200).json({
    success: true,
    data: bookDetails,
    message: "Books fetched successfully",
  });
};

export const getBookTransactionHistory = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);

  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { bookID } = req.body;

  let bookDetails;
  let allTransactionDetails = [];
  if (dataManager.bookMap.has(bookID)) {
    bookDetails = dataManager.bookMap.get(bookID);
  } else {
    bookDetails = await Books.findOne({ bookID });
    if (!bookDetails) {
      return res
        .status(200)
        .json({ success: false, message: "Book not found" });
    }
    dataManager.setBookMap(bookDetails);
  }
  console.log(
    "Book Details fetched:",
    bookDetails.transactionHistory[0].toString()
  );
  for (const transactionObjectID of bookDetails.transactionHistory) {
    let transactionDetails;
    console.log("Fetching transaction for ID:", transactionObjectID);
    if (dataManager.transactionMap.has(transactionObjectID)) {
      transactionDetails = dataManager.getTransactionMap(transactionObjectID);
    } else {
      transactionDetails = await Transactions.findById(transactionObjectID);
      if (transactionDetails) {
        dataManager.setTransactionMap(transactionObjectID, transactionDetails);
      }
    }
    if (transactionDetails) {
      allTransactionDetails.push(transactionDetails);
    }
  }

  // Sort transactions by month wise descending order grouped by year and month
  const monthNames = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];

  const groupedTransactions = {};

  // Group transactions by year and month
  allTransactionDetails.forEach((transaction) => {
    const date = new Date(transaction.createdAt);
    const year = date.getFullYear();
    const monthIndex = date.getMonth();
    const month = monthNames[monthIndex];

    if (!groupedTransactions[year]) {
      groupedTransactions[year] = {};
    }
    if (!groupedTransactions[year][month]) {
      groupedTransactions[year][month] = [];
    }

    groupedTransactions[year][month].push(transaction);
  });

  // Sort by year descending and month descending
  const sortedGroupedTransactions = {};
  const sortedYears = Object.keys(groupedTransactions)
    .map(Number)
    .sort((a, b) => b - a);

  sortedYears.forEach((year) => {
    sortedGroupedTransactions[year] = {};
    const monthsInYear = Object.keys(groupedTransactions[year]);
    const sortedMonths = monthsInYear.sort(
      (a, b) => monthNames.indexOf(b) - monthNames.indexOf(a)
    );

    sortedMonths.forEach((month) => {
      sortedGroupedTransactions[year][month] = groupedTransactions[year][month];
    });
  });

  return res.status(200).json({
    success: true,
    data: sortedGroupedTransactions,
    message: "Transactions grouped by year and month successfully",
  });
};
