import { generateUserID, verifyJWTToken, hashPassword } from "../helper.js";
import Admin from "../models/Admin.js";
import Books from "../models/Books.js";
import Transactions from "../models/Transactions.js";
import User from "../models/User.js";

export const getAllUserDetails = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);

  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const allUserDetails = await User.find({}).select(
    "-_id -__v -createdAt -updatedAt -password"
  );

  if (!allUserDetails) {
    return res
      .status(200)
      .json({ success: true, data: [], message: "No users found" });
  }

  return res.status(200).json({
    success: true,
    data: allUserDetails,
    message: "Users fetched successfully",
  });
};

export const getAllBooksDetails = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const allBooksDetails = await Books.find({}).select(
    "-_id -__v -createdAt -updatedAt"
  );
  if (!allBooksDetails) {
    return res
      .status(200)
      .json({ success: true, data: [], message: "No books found" });
  }
  return res.status(200).json({
    success: true,
    data: allBooksDetails,
    message: "Books fetched successfully",
  });
};

export const getUserBookTransactionHistory = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const totalTransactions = await Transactions.countDocuments({
    book: req.body.bookID,
  });
  const transactions = await Transactions.find({
    book: req.body.bookID,
  })
    .select(
      "userID bookID principalAmount loanInterestAmount loanEMI totalAmount beforeTransactionAmount"
    )
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const totalPages = Math.ceil(totalTransactions / limit);

  return res.status(200).json({
    success: true,
    data: {
      pagination: {
        currentPage: page,
        totalPages,
        totalTransactions,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      count: totalTransactions,
      transactions,
    },
    message: "Transactions fetched successfully",
  });
};

export const updateTheConfiguration = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  // update the Admin model with new configuration settings from req.body
  if (!req.body) {
    return res
      .status(400)
      .json({ success: false, message: "No configuration data provided" });
  }
  let admin = await Admin.findOne();

  if (!admin) {
    // Create if doesn't exist
    admin = await Admin.create({
      ...req.body,
      updatedAt: Date.now(),
    });
  } else {
    // Update existing document
    admin = await Admin.findOneAndUpdate(
      {},
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
  }

  // Logic to update configuration settings
  return res.status(200).json({
    success: true,
    data: admin,
    message: "Configuration updated successfully",
  });
};

export const updateCurrentTotalPrincipalAmount = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  let admin = await Admin.findOne();
  if (!admin) {
    return res
      .status(404)
      .json({ success: false, message: "Admin configuration not found" });
  }

  // Fetch currentTotalPrincipalAmount and defaultPrincipalAmount
  const currentTotalPrincipalAmount = admin.currentTotalPrincipalAmount;
  const defaultPrincipalAmount = admin.defaultPrincipalAmount;

  // Add defaultPrincipalAmount to currentTotalPrincipalAmount
  admin.currentTotalPrincipalAmount =
    currentTotalPrincipalAmount + defaultPrincipalAmount;
  await admin.save();

  return res.status(200).json({
    success: true,
    data: {
      previousTotalPrincipalAmount: currentTotalPrincipalAmount,
      defaultPrincipalAmount: defaultPrincipalAmount,
      updatedTotalPrincipalAmount: admin.currentTotalPrincipalAmount,
    },
    message: "Current total principal amount updated successfully",
  });
};

// Transaction Management

// Helper function to handle transaction logic for both create and update
// Modifies bookDetails object by reference, no return value needed
const handleTransactionLogic = (transaction, bookDetails, transactionType, loanTakenAmount, settlementAmount, loanAmount, currentPrincipalAmount) => {
  if (transactionType === "LOAN") {
    bookDetails.isLoanActive = true;
    bookDetails.loanAmount = loanAmount + loanTakenAmount;
  } else if (transactionType === "SETTLEMENT") {
    bookDetails.settlementAmount = settlementAmount;
    bookDetails.isLoanActive = false;
  } else {
    // REGULAR transaction
    bookDetails.currentPrincipalAmount = currentPrincipalAmount + transaction.principalAmount;
    if (bookDetails.loanAmount > 0) {
      bookDetails.loanAmount = Math.max(0, loanAmount - transaction.loanEMI);
    }
    if (bookDetails.loanAmount <= 0) bookDetails.isLoanActive = false;
  }
};

// Make transaction for book
export const makeTransactionForBook = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const {
    userID,
    bookID,
    loanEMI = 0,
    loanInterestAmount = 0,
    principalAmount = 0,
    penaltyAmount = 0,
    amountReturned = 0,
    returnedAmountDescription = "",
    transactionType,
    loanTakenAmount = 0,
    settlementAmount = 0,
  } = req.body;

  // Validate amounts are non-negative
  if (principalAmount < 0 || loanEMI < 0 || loanInterestAmount < 0 || penaltyAmount < 0) {
    return res.status(400).json({ success: false, message: "Amounts cannot be negative" });
  }

  // Validate required fields
  if (!userID || !bookID || !transactionType) {
    return res.status(400).json({ success: false, message: "userID, bookID, and transactionType are required" });
  }

  const bookDetails = await Books.findOne({ bookID });
  if (!bookDetails) {
    return res.status(404).json({ success: false, message: "Book not found" });
  }

  const { loanAmount, currentPrincipalAmount } = bookDetails;
  const userIDs = String(userID)
    .split(",")
    .map((id) => id.trim());

  const totalAmount = principalAmount + loanInterestAmount + loanEMI + penaltyAmount;
  
  const transaction = await Transactions.create({
    userID: userIDs,
    bookID,
    principalAmount,
    loanInterestAmount,
    loanEMI,
    penaltyAmount,
    amountReturned,
    returnedAmountDescription,
    totalAmount,
    transactionBy: decoded.userID,
    transactionType,
  });

  // Update user transaction history - use Promise.all to wait for all updates
  await Promise.all(
    userIDs.map(async (user_id) => {
      const user = await User.findOne({ userID: user_id });
      if (user) {
        user.transactionHistory.push(transaction._id);
        await user.save();
      }
    })
  );

  handleTransactionLogic(transaction, bookDetails, transactionType, loanTakenAmount, settlementAmount, loanAmount, currentPrincipalAmount);
  
  bookDetails.transactionHistory.push(transaction._id);
  await bookDetails.save();

  return res.status(200).json({
    success: true,
    data: {
      transaction,
      bookDetails,
    },
    message: "Transaction created successfully",
  });
};

// Delete transaction
export const deleteTransaction = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const { transactionID } = req.body;

  const transaction = await Transactions.findById({ _id: transactionID });

  if (!transaction) {
    return res
      .status(404)
      .json({ success: false, message: "Transaction not found" });
  }

  transaction.isDeleted = true;

  await transaction.save();

  return res
    .status(200)
    .json({ success: true, message: "Transaction deleted successfully" });
};

// Update transaction
export const updateTransaction = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const {
    transactionID,
    loanEMI = 0,
    loanInterestAmount = 0,
    principalAmount = 0,
    penaltyAmount = 0,
    amountReturned = 0,
    returnedAmountDescription = "",
    transactionType,
    loanTakenAmount = 0,
    settlementAmount = 0,
  } = req.body;

  // Validate required fields
  if (!transactionID) {
    return res.status(400).json({ success: false, message: "transactionID is required" });
  }

  // Validate amounts are non-negative
  if (principalAmount < 0 || loanEMI < 0 || loanInterestAmount < 0 || penaltyAmount < 0) {
    return res.status(400).json({ success: false, message: "Amounts cannot be negative" });
  }

  // Find the existing transaction
  const transaction = await Transactions.findById(transactionID);
  if (!transaction) {
    return res.status(404).json({ success: false, message: "Transaction not found" });
  }

  // Find the book
  const bookDetails = await Books.findOne({ bookID: transaction.bookID });
  if (!bookDetails) {
    return res.status(404).json({ success: false, message: "Book not found" });
  }

  // Store old transaction values for reverting book changes
  const oldPrincipalAmount = transaction.principalAmount;
  const oldLoanEMI = transaction.loanEMI;
  const oldTransactionType = transaction.transactionType;
  const originalLoanAmount = bookDetails.loanAmount;
  const originalPrincipalAmount = bookDetails.currentPrincipalAmount;

  // Update transaction fields
  transaction.principalAmount = principalAmount;
  transaction.loanInterestAmount = loanInterestAmount;
  transaction.loanEMI = loanEMI;
  transaction.penaltyAmount = penaltyAmount;
  transaction.amountReturned = amountReturned;
  transaction.returnedAmountDescription = returnedAmountDescription;
  transaction.totalAmount = principalAmount + loanInterestAmount + loanEMI + penaltyAmount;
  if (transactionType) {
    transaction.transactionType = transactionType;
  }
  transaction.updatedAt = Date.now();

  await transaction.save();

  // Reverse the old transaction's effect on the book
  if (oldTransactionType === "LOAN") {
    bookDetails.loanAmount = Math.max(0, bookDetails.loanAmount - (loanTakenAmount || 0));
  } else if (oldTransactionType === "SETTLEMENT") {
    bookDetails.settlementAmount = 0;
    bookDetails.isLoanActive = true;
  } else {
    // REGULAR transaction - reverse the changes
    bookDetails.currentPrincipalAmount = Math.max(0, bookDetails.currentPrincipalAmount - oldPrincipalAmount);
    if (originalLoanAmount > 0) {
      bookDetails.loanAmount = bookDetails.loanAmount + oldLoanEMI;
    }
    bookDetails.isLoanActive = bookDetails.loanAmount > 0;
  }

  // Apply the new transaction's effect
  const { loanAmount, currentPrincipalAmount } = bookDetails;
  const finalTransactionType = transactionType || oldTransactionType;
  handleTransactionLogic(transaction, bookDetails, finalTransactionType, loanTakenAmount, settlementAmount, loanAmount, currentPrincipalAmount);

  await bookDetails.save();

  return res.status(200).json({
    success: true,
    data: {
      transaction,
      bookDetails,
    },
    message: "Transaction updated successfully",
  });
};

// USER CREATION
export const addUser = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { name, mobile, booksIssued, isExistingBooks } = req.body;

  // Validate required fields
  if (!name || !mobile) {
    return res
      .status(400)
      .json({ success: false, message: "Name and mobile are required" });
  }

  const userID = generateUserID();

  // Generate default password: "user_" + userID
  const defaultPassword = mobile;
  const hashedPassword = await hashPassword(defaultPassword);
  let userBookID = [];
  if (isExistingBooks) {
    userBookID = await Books.find({ bookID: { $in: booksIssued } })
      .select("_id")
      .lean()
      .then((book) => book.map((b) => b._id));
  } else {
    if (booksIssued && booksIssued.length > 0) {
      const bookPromises = booksIssued.map(async (book) => {
        const userBook = await Books.create({
          userID: [userID],
          bookID: book.bookId,
          bookName: book.bookName,
          isLoanActive: false,
          currentPrincipalAmount: book.currentPrincipalAmount,
          loanAmount: 0,
          transactionHistory: [],
        });
        console.log("userBook", userBook);
        return userBook._id;
      });
      // Wait for all book creations to complete
      userBookID = await Promise.all(bookPromises);
    }
  }
  console.log("userBookID", userBookID);

  const newUser = await User.create({
    userID,
    name,
    mobile,
    password: hashedPassword,
    isDefaultPassword: true,
    booksIssued: userBookID || [],
  });

  return res.status(200).json({
    success: true,
    data: {
      userID: newUser.userID,
      name: newUser.name,
      mobile: newUser.mobile,
      defaultPassword: defaultPassword,
      message: "User created with default password: " + newUser.mobile,
    },
    message: "User created successfully with default password",
  });
};

// USER UPDATION
export const updateUser = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { userID, name, mobile } = req.body;
  const user = await User.findOne({ userID });

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  user.name = name || user.name;
  user.mobile = mobile || user.mobile;

  await user.save();
};

// TOGGLE USER ACTIVE STATUS
export const toggleUserActiveStatus = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const { userID, isUserActive } = req.body;
  const user = await User.find.findOne({ userID });

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  user.isUserActive = isUserActive;
  await user.save();
  return res.status(200).json({
    success: true,
    data: {
      userID: user.userID,
      isUserActive: user.isUserActive,
    },
    message: `User has been ${
      isUserActive ? "activated" : "deactivated"
    } successfully`,
  });
};

// TOGGLE BOOK ISSUED TO USER
export const toggleBookIssuedToUser = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const { userID, bookID, issueBook } = req.body;
  const user = await User.findOne({ userID });
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  const book = await Books.findOne({ bookID });
  if (!book) {
    return res.status(404).json({ success: false, message: "Book not found" });
  }
  if (issueBook) {
    // Issue book to user
    if (!user.booksIssued.includes(book._id)) {
      user.booksIssued.push(book._id);
    }
    if (!book.userID.includes(userID)) {
      book.userID.push(userID);
    }
  } else {
    // Return book from user
    user.booksIssued = user.booksIssued.filter(
      (bId) => bId.toString() !== book._id.toString()
    );
    book.userID = book.userID.filter((uId) => uId !== userID);
  }
  await user.save();
  await book.save();
  return res.status(200).json({
    success: true,
    data: {
      userID: user.userID,
      bookID: book.bookID,
      booksIssued: user.booksIssued,
      bookUsers: book.userID,
    },
    message: `Book has been ${
      issueBook ? "issued to" : "returned from"
    } user successfully`,
  });
};

// CHANGE PASSWORD BY ADMIN
export const changePasswordByAdmin = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const { userID } = req.body;
  const user = await User.findOne({ userID });
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // Set default password to user's mobile number
  const defaultPassword = user.mobile;
  const hashedPassword = await hashPassword(defaultPassword);

  user.password = hashedPassword;
  user.isDefaultPassword = true;
  await user.save();

  return res.status(200).json({
    success: true,
    data: {
      userID: user.userID,
      defaultPassword: defaultPassword,
      isDefaultPassword: user.isDefaultPassword,
    },
    message: `Password reset successfully. New default password: ${defaultPassword}. User must change password on next login.`,
  });
};

// TOGGLE USER ADMIN PRIVILEGES
export const toggleUserAdmin = async (req, res) => {
  const token = req.cookies.token;
  const decoded = verifyJWTToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  const { userID, makeAdmin } = req.body;
  const adminDoc = await Admin.findOne();
  if (!adminDoc) {
    return res
      .status(404)
      .json({ success: false, message: "Admin document not found" });
  }
  if (makeAdmin) {
    // Add userID to adminUserID array if not already present
    if (!adminDoc.adminUserID.includes(userID)) {
      adminDoc.adminUserID.push(userID);
    }
  } else {
    // Remove userID from adminUserID array
    adminDoc.adminUserID = adminDoc.adminUserID.filter((id) => id !== userID);
  }
  await adminDoc.save();
  return res.status(200).json({
    success: true,
    data: {
      userID,
      isAdmin: makeAdmin,
    },
    message: `User has been ${
      makeAdmin ? "granted" : "revoked"
    } admin privileges successfully`,
  });
};
