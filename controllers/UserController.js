import { verifyJWTToken } from "../helper.js";
import Books from "../models/Books.js";
import Transactions from "../models/Transactions.js";
import User from "../models/User.js";

export const getUserDetails = async (req, res) => {
    const token = req.cookies.token;
    const decoded = verifyJWTToken(token);

    if (!decoded) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userDetails = await User.findOne({ userID: decoded.userID });

    if (!userDetails) {
        return res.status(200).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, data: userDetails });
}

export const getUserBooksDetails = async (req, res) => {
    const token = req.cookies.token;
    const decoded = verifyJWTToken(token);

    if (!decoded) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const bookDetails = await Books.find({ userID: decoded.userID }).select("bookID isLoanActive currentPrincipalAmount loanAmount");

    if (!bookDetails) {
        return res.status(200).json({ success: true, data: [], message: 'No books found for this user' });
    }

    return res.status(200).json({ success: true, data: bookDetails, message: 'Books fetched successfully' });

}

export const getBookTransactionHistory = async (req, res) => {
    const token = req.cookies.token;
    const decoded = verifyJWTToken(token);

    if (!decoded) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;


    const totalTransactions = await Transactions.countDocuments({
        user: decoded.userID,
        book: req.body.bookID,
        isDeleted: false
    });

    const transactions = await Transactions.find({
        user: decoded.userID,
        book: req.body.bookID
    }).select("bookID principalAmount loanInterestAmount loanEMI totalAmount beforeTransactionAmount")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const totalPages = Math.ceil(totalTransactions / limit);

    return res.status(200).json({
        success: true,
        count: transactions.length,
        pagination: {
            currentPage: page,
            totalPages,
            totalTransactions,
            limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        },
        data: transactions
    });

}