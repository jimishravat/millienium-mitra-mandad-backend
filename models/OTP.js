import { Schema, model } from 'mongoose';

const OTPSchema = new Schema({
    userID: {
        type: String,
        required: [true, 'Please add a userID'],
    },
    mobile: {
        type: String,
        required: [true, 'Please add a mobile number']
    },
    OTP: {
        type: Number,
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    isValid: {
        type: Boolean,
        default: true
    },
    OTPCreatedTime: {
        type: Date,
    },
    firebaseSessionID: {
        type: String,
        description: 'Firebase verification session ID for tracking'
    },
    verificationID: {
        type: String,
        description: 'Firebase verification ID for OTP validation'
    }
}, { timestamps: true });


export default model('OTP', OTPSchema);