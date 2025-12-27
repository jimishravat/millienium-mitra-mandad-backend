import { Schema, model } from 'mongoose';

const BooksSchema = new Schema({
    userID: {
        type: [String],
        required: [true, 'Please add a userID'],
    },
    bookName: {
        type: String,
        required: [true, 'Please add a Book Name']
    },
    bookID: {
        type: String,
        required: [true, 'Please add a Book ID'],
        unique: true
    },
    isLoanActive: {
        type: Boolean,
        required: true,
        default: false
    },
    currentPrincipalAmount: {
        type: Number,
        required: true,
        default: 0
    },
    loanAmount: {
        type: Number,
        required: true,
        default: 0
    },
    settlementAmount: {
        type: Number,
        required: true,
        default: 0
    },
    transactionHistory: [
        {
            type: Schema.Types.ObjectId,
            ref: "Transactions"
        }
    ],
    isActive : {
        type: Boolean,
        required: true,
        default: true
    }

}, { timestamps: true });


export default model('Books', BooksSchema);