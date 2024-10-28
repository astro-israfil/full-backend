import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeUsersCurrentPassword,
  getCurrentUser,
  updateUsersDetails,
  updateUsersAvatar,
  updateUsersCoverImage,
  getUserChannelDetails,
  getWatchHistory,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);
router.route("/login").post(loginUser);
router.route("/refresh-token").post(refreshAccessToken);

// Secure routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/change-password").post(verifyJWT, changeUsersCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/update-user-details").patch(verifyJWT, updateUsersDetails);
router
  .route("/update-user-avatar")
  .patch(verifyJWT, upload.single("avatar"), updateUsersAvatar);
router
  .route("/update-user-coverImage")
  .patch(verifyJWT, upload.single("coverImage"), updateUsersCoverImage);
router.route("/c/:username").get(verifyJWT, getUserChannelDetails);
router.route("/watch-history").get(verifyJWT, getWatchHistory);

export default router;
