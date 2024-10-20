import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

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

export { registerUser };
