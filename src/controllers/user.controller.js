import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

const registerUser = asyncHandler(async function (req, res) {
  // get user details from frontend
  // validate users data
  // check for existed user
  // check for images or avatar image
  // upload these images to the cloudinary
  // check for successfull upload image
  // create new user in database
  // check for successfull creation of users
  // get newly created users data and remove all sensitive field like password, refresh token
  // send newly created users data

  const { fullName, username, email, password } = req.body;

  if (
    [fullName, username, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ email, username }],
  });

  if (existedUser) {
    throw new ApiError(
      409,
      "User with this email or username is already exist"
    );
  }

  let avatarLocalPath;
  let coverImageLocalPath;

  if (Array.isArray(req.files?.avatar) && req.files?.avatar?.length > 0) {
    avatarLocalPath = req.files?.avatar[0]?.path;
  }

  if (
    Array.isArray(req.files?.coverImage) &&
    req.files?.coverImage?.length > 0
  ) {
    coverImageLocalPath = req.files?.coverImage[0]?.path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(500, "Internal server error cloudinary uploads failed");
  }

  const user = await User.create({
    username: username.toLowerCase(),
    email,
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    password,
  });

  const createdUser = await User.findById(user?._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong when creating user");
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        user: createdUser,
      },
      "success"
    )
  );
});

const loginUser = asyncHandler(async function (req, res) {
  // get users credentials from frontend
  // check if email, username, and password is present or not
  // find user with email, or username
  // check password is correct
  // generate access and refresh token
  // send cookie

  const { username, email, password } = req.body;

  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }
  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  const user = await User.findOne({
    $or: [{ email }, { password }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const cookieOptions = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          refreshToken,
          accessToken,
        },
        "success"
      )
    );
});

const logoutUser = asyncHandler(async function (req, res) {
  if (!req.user) {
    throw new ApiError(401, "Aunthentication failed");
  }

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: "",
      },
    },
    {
      new: true,
    }
  );

  const cookieOptions = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "success"));
});

const refreshAccessToken = asyncHandler(async function (req, res) {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Refresh token expired or used");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );
    const cookieOptions = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken)
      .cookie("refreshToken", refreshToken)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken,
          },
          "success"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      error.message || "Internal server error when refreshing access token"
    );
  }
});

const changeUsersCurrentPassword = asyncHandler(async function (req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword?.trim()) {
    throw new ApiError(400, "Invalid current password");
  }
  if (!newPassword?.trim()) {
    throw new ApiError(400, "Invalid new password");
  }

  const user = await User.findById(req.user?._id);

  if (!user) {
    throw new ApiError(401, "Unauthorized request");
  }

  const isPasswordCorrect = await user.isPasswordCorrect(currentPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid credentials");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(new ApiResponse(200, {}, "success"));
});

const getCurrentUser = asyncHandler(async function (req, res) {
  if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized request");
  }
  const user = await User.findById(req.user?._id).select(
    "-password -refreshToken"
  );
  if (!user) {
    throw new ApiError(404, "User is not found");
  }

  return res.status(200).json(new ApiResponse(200, { user }, "success"));
});

const updateUsersDetails = asyncHandler(async function (req, res) {
  const { fullName, email } = req.body;
  if (!fullName && !email) {
    throw new ApiError(400, "FullName or email is required to update");
  }

  let user;

  if (fullName) {
    user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          fullName,
        },
      },
      { new: true }
    ).select("-password");
  }

  if (email) {
    user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          email,
        },
      },
      { new: true }
    ).select("-password");
  }
  return res.status(200).json(new ApiResponse(200, { user }), "success");
});

const updateUsersAvatar = asyncHandler(async function (req, res) {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar?.url) {
    throw new ApiError(
      500,
      "Internal server error while uploading avatar on cloudinary"
    );
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  if (!user) {
    throw new ApiError(500, "Internal server error while updating avatar");
  }

  return res.status(200).json(new ApiResponse(200, { user }, "success"));
});

const updateUsersCoverImage = asyncHandler(async function (req, res) {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage?.url) {
    throw new ApiError(
      500,
      "Internal server error while uploading cover image on cloudinary"
    );
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  if (!user) {
    throw new ApiError(500, "Internal server error while updating cover image");
  }

  return res.status(200).json(new ApiResponse(200, { user }, "success"));
});

async function generateAccessAndRefreshTokens(userId) {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(500, "Something went wrong while searching user");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went worng while generating access and refresh tokens"
    );
  }
}

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeUsersCurrentPassword,
  getCurrentUser,
  updateUsersDetails,
  updateUsersAvatar,
  updateUsersCoverImage,
};
