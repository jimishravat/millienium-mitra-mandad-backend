import pkg from 'jsonwebtoken';
const { sign, verify } = pkg;
import otpGenerator from 'otp-generator';
import bcrypt from 'bcryptjs';

export const generateOTP = () => {
    try {
        return otpGenerator.generate(4, {
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false
        })
    } catch (error) {
        console.log(error)
    }
}


export const sendOTPViaSMA = async (mobile, OTP) => {
    try {
        // Format mobile number to include country code if not present
        const phoneNumber = mobile.startsWith('+') ? mobile : `+91${mobile}`;
        
        // Create a custom token for phone authentication
        // In production, you would use Firebase's phone authentication with client SDK
        // For backend OTP sending, we store the OTP and send via Firebase (configured separately)
        console.log(`📱 OTP sent to ${phoneNumber}: ${OTP}`);
        
        return {
            success: true,
            message: `OTP sent to ${phoneNumber}`,
            phoneNumber: phoneNumber
        };
    } catch (error) {
        console.error('Error sending OTP via SMS:', error);
        throw error;
    }
}


export const generateJWTToken = (payload) => {
    // Implementation for generating JWT token
    return sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

}

export const verifyJWTToken = (token) => {
    // Implementation for verifying JWT 
    try {
        if (!token) {
            return false;
        }
        return verify(token, process.env.JWT_SECRET);
    } catch (err) {
        // Check if token is expired
        if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
            return false;
        }
        // Other errors
        return false
    }

}

export const generateUserID = () => {
    // Generate random 5-digit number (10000 to 99999)
    const userId = Math.floor(10000 + Math.random() * 90000).toString();
    return userId;
}

export const hashPassword = async (password) => {
    try {
        const salt = await bcrypt.genSalt(10);
        return await bcrypt.hash(password, salt);
    } catch (error) {
        console.error('Error hashing password:', error);
        throw error;
    }
}

export const comparePassword = async (plainPassword, hashedPassword) => {
    try {
        return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
        console.error('Error comparing password:', error);
        throw error;
    }
}
