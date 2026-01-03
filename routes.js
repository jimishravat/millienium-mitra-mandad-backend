import { Router } from "express";
import {
  checkAdminUser,
  checkUserSessionController,
  loginController,
  logoutController,
  verifyOTPController,
  changePasswordController,
} from "./controllers/AuthController.js";
import {
  getUserBooksDetails,
  getUserDetails,
  getBookTransactionHistory,
} from "./controllers/UserController.js";
import {
  addUser,
  changePasswordByAdmin,
  deleteTransaction,
  getAllBooksDetails,
  getAllUserDetails,
  getUserBookTransactionHistory,
  makeTransactionForBook,
  toggleBookIssuedToUser,
  toggleUserActiveStatus,
  toggleUserAdmin,
  updateCurrentTotalPrincipalAmount,
  updateTheConfiguration,
  updateTransaction,
  updateUser,
} from "./controllers/AdminController.js";
import { dataManager } from "./config/dataManager.js";

const router = Router();
const userRoutes = Router();
const adminRoutes = Router();
const commonRoutes = Router();

// common routes
commonRoutes.post("/login", loginController);
commonRoutes.post("/verify-otp", verifyOTPController);
commonRoutes.post("/change-password", changePasswordController);
commonRoutes.post("/logout", logoutController);
commonRoutes.post("/user-session", checkUserSessionController);

// admin routes
adminRoutes.post("/get-users", checkAdminUser, getAllUserDetails);
adminRoutes.post("/get-books", checkAdminUser, getAllBooksDetails);
adminRoutes.post(
  "/get-user-book-transaction-history",
  checkAdminUser,
  getUserBookTransactionHistory
);
adminRoutes.post("/config", checkAdminUser, updateTheConfiguration);
adminRoutes.post(
  "/update-current-total-principal-amount",
  checkAdminUser,
  updateCurrentTotalPrincipalAmount
);
adminRoutes.post("/add-transaction", checkAdminUser, makeTransactionForBook);
adminRoutes.post("/delete-transaction", checkAdminUser, deleteTransaction);
adminRoutes.post("/update-transaction", checkAdminUser, updateTransaction);

adminRoutes.post("/add-user", checkAdminUser, addUser);
adminRoutes.post("/update-user", checkAdminUser, updateUser);
adminRoutes.post(
  "/toggle-user-active-status",
  checkAdminUser,
  toggleUserActiveStatus
);
adminRoutes.post("/toggle-book-issued", checkAdminUser, toggleBookIssuedToUser);
adminRoutes.post(
  "/change-password-admin",
  checkAdminUser,
  changePasswordByAdmin
);
adminRoutes.post("/toggle-admin-user", checkAdminUser, toggleUserAdmin);

// user routes
userRoutes.post("/user-details", getUserDetails);
userRoutes.post("/book-details", getUserBooksDetails);
userRoutes.post("/book-transaction-history", getBookTransactionHistory);

userRoutes.get("/get-map-data", async (req, res) => {
  try {
    const data = {
      ...(await dataManager.getAllMapsData()),
    };
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching map data:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error fetching map data" });
  }
});

router.use("/api/v1/auth", commonRoutes);
router.use("/api/v1/user", userRoutes);
router.use("/api/v1/admin", adminRoutes);

export default router;
