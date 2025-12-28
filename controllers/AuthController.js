import { generateJWTToken, hashPassword, comparePassword, verifyJWTToken } from "../helper.js";
import Admin from "../models/Admin.js";
import User from "../models/User.js";


export const loginController = async (req, res) => {
    if (req.body === undefined || Object.keys(req.body).length === 0) {
        return res.status(400).json({ success: false, message: "Request body is missing" });
    }

    console.log("Request Body:", req.body);
    
    if (req.body.mobile === undefined || req.body.mobile === null || req.body.mobile === "") {
        return res.status(400).json({ success: false, message: "Mobile Number is missing" });
    }
    
    if (req.body.password === undefined || req.body.password === null || req.body.password === "") {
        return res.status(400).json({ success: false, message: "Password is missing" });
    }

    try {
        // Find user by mobile number and explicitly select password
        const userDetails = await User.findOne({ mobile: req.body.mobile }).select('+password');

        if (!userDetails) {
            return res.status(200).json({ success: false, message: "User not found" });
        }

        // Compare provided password with stored hash
        const isPasswordCorrect = await comparePassword(req.body.password, userDetails.password);

        if (!isPasswordCorrect) {
            return res.status(200).json({ success: false, message: "Invalid password" });
        }

        // Check if user is active
        if (!userDetails.isUserActive) {
            return res.status(200).json({ success: false, message: "User account is inactive. Please contact administrator" });
        }

        // Check if user is admin
        const isAdminUser = !!await Admin.findOne({ adminUserID: userDetails.userID });

        // Generate JWT token
        const token = generateJWTToken({ userID: userDetails.userID, mobile: userDetails.mobile, isAdmin: isAdminUser });

        const options = {
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            httpOnly: true, // Prevents XSS attacks
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            sameSite: 'strict' // CSRF protection
        };

        res.status(200)
            .cookie('token', token, options)
            .json({
                success: true,
                data: {
                    token,
                    userDetails: { id: userDetails.userID, name: userDetails.name },
                    isAdmin: isAdminUser,
                    isDefaultPassword: userDetails.isDefaultPassword
                },
                message: "Login successful"
            });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ success: false, message: "Server error during login" });
    }
}

export const changePasswordController = async (req, res) => {
    if (req.body === undefined || Object.keys(req.body).length === 0) {
        return res.status(400).json({ success: false, message: "Request body is missing" });
    }

    const { oldPassword, newPassword, verifyPassword } = req.body;

    // Validate inputs
    if (!oldPassword || !newPassword || !verifyPassword) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (newPassword !== verifyPassword) {
        return res.status(400).json({ success: false, message: "New passwords do not match" });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
    }

    try {
        // Get user ID from JWT token
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ success: false, message: "Unauthorized - No token found" });
        }

        const decodedToken = verifyJWTToken(token);
        if (!decodedToken) {
            return res.status(401).json({ success: false, message: "Unauthorized - Invalid token" });
        }

        // Find user and get password field
        const user = await User.findOne({ userID: decodedToken.userID }).select('+password');
        if (!user) {
            return res.status(200).json({ success: false, message: "User not found" });
        }

        // Verify old password
        const isOldPasswordCorrect = await comparePassword(oldPassword, user.password);
        if (!isOldPasswordCorrect) {
            return res.status(200).json({ success: false, message: "Old password is incorrect" });
        }

        // Hash new password
        const hashedNewPassword = await hashPassword(newPassword);

        // Update password and set isDefaultPassword to false
        user.password = hashedNewPassword;
        user.isDefaultPassword = false;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Password changed successfully",
            data: { isDefaultPassword: false }
        });

    } catch (error) {
        console.error('Change password error:', error);
        return res.status(500).json({ success: false, message: "Server error during password change" });
    }
}

export const verifyOTPController = async (req, res) => {
    // This endpoint is deprecated - kept for backwards compatibility
    return res.status(400).json({ success: false, message: "OTP verification is deprecated. Use password-based login." });
}

export const logoutController = async (req, res) => {
    res.status(200)
        .cookie('token', '', {
            expires: new Date(0),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        })
        .json({ success: true, message: "Logged out successfully" });
}

export const checkUserSessionController = async (req, res) => {
    // Get token from cookies
    const token = req.cookies.token;

    // If no token found in cookies
    if (!token) {
        return res.status(200).json({
            success: false,
            message: 'No token found'
        });
    }

    const isValid = verifyJWTToken(token);
    if (!isValid) {
        return res.status(200).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }

    return res.status(200).json({
        success: true,
        data: { userID: isValid.userID, mobile: isValid.mobile, isAdmin: isValid.isAdmin },
        message: 'Token is valid'
    });
}

export const checkAdminUser = async (req, res, next) => {
    const token = req.cookies.token;
    const decoded = verifyJWTToken(token);
    if (!decoded) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const adminUsers = await Admin.findOne();

    let isAdmin = false;

    if (adminUsers.adminUserID.includes(decoded.userID)) {
        isAdmin = true;
    }

    if (!isAdmin) {
        return res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
    }

    next();


}