const  User  = require("../models/users");
const { sendSuccessResponse, sendErrorResponse } = require("../utils/response");
const { STATUS_CODE } = require("../utils/constants");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const authServices = require("../services/auth.service");
const jwtSecret = process.env.JWT_SECRET || "your_jwt_secret";
const {getOAuthClient}=require("../utils/helper");
const {google}=require("googleapis");

async function Login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return sendErrorResponse(
        res,
        {},
        "Invalid Credentials",
        STATUS_CODE.NOT_FOUND
      );
    }
    const validatePassword = await bcrypt.compare(password, user.password);

    if (!validatePassword) {
      sendErrorResponse(
        res,
        {},
        "Invalid Credentials",
        STATUS_CODE.UNAUTHORIZED
      );
    } else {

      const token=jwt.sign(
        { id: user.id, email: user.email },
        jwtSecret,
        { expiresIn: "24h" }
      );



      return sendSuccessResponse(
        res,
        {token,email},
        "Logged In Sucessfully",
        STATUS_CODE.SUCCESS
      );
    }
  } catch (err) {
    return sendErrorResponse(
      res,
      {},
      "Internal Server Error",
      STATUS_CODE.UNAUTHORIZED
    );
  }
}

async function Signup(req, res) {
  try {
    const { name, email, password, institute } = req.body;

    

    const existingUser = await User.findOne({email});


    if (existingUser) {
      return sendErrorResponse(
        res,
        {},
        "User Already Exists",
        STATUS_CODE.CONFLICT
      );
    }

    const createUser = await authServices.createNewUser({
      name,
      email,
      password,
      institute,
      googleTokens:{}
    });

    if (createUser) {
      return sendSuccessResponse(
        res,
        {id:createUser._id},
        "User Created Successfully",
        STATUS_CODE.CREATED
      );
    }
  } catch (err) {
    return sendErrorResponse(
      res,
      {},
      `Error Creating User: ${err.message}`,
      STATUS_CODE.INTERNAL_SERVER_ERROR
    );
  }
}

async function googleSignup(req,res){
  try{

    const oauth2Client = getOAuthClient();
    console.log("UserID:", req.query.userId);
    

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/calendar.readonly"],
      state: req.query.userId, // 🔑 
    });

    sendSuccessResponse(
      res,
      {auth_url:url},
      "Google Auth URL generated successfully",
      STATUS_CODE.SUCCESS
    );
  }catch(err){
    return sendErrorResponse(
      res,
      {},
      `Error: ${err.message}`,
      STATUS_CODE.INTERNAL_SERVER_ERROR
    );
  }
}

async function getGoogleToken(req,res){
  try{
    const { code, state } = req.query;
    const userId = state;
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    

    const user=await User.findById(userId);
    user.googleTokens=tokens;
    await user.save();

    sendSuccessResponse(
      res,
      {},
      `Google Calendar connected for user ${userId}`,
      STATUS_CODE.SUCCESS
    );
  }catch(err){
    return sendErrorResponse(
      res,
      {},
      `Error: ${err.message}`,
      STATUS_CODE.INTERNAL_SERVER_ERROR
    );
  }
}

async function fetchGoogleCalenderEvents(req,res){
  try{
    const userId=req.user.id;
    const user=await User.findById(userId);
    const calenderId=req.query.calenderId || "primary";

    if(!user.googleTokens){
      return sendErrorResponse(
        res,
        {},
        "User not connected to Google",
        STATUS_CODE.UNAUTHORIZED
      );
    }
    
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(user.googleTokens);
    const calendar = google.calendar({
      version: "v3",
      auth: oauth2Client,
    });

    const eventsResponse = await calendar.events.list({
      calendarId: calenderId,
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = eventsResponse.data.items;

    return sendSuccessResponse(
      res,
      {events},
      "Fetched Google Calendar events successfully",
      STATUS_CODE.SUCCESS
    );

  }catch(err){
    return sendErrorResponse(
      res,
      {},
      `Error: ${err.message}`,
      STATUS_CODE.INTERNAL_SERVER_ERROR
    );
  }
}

async function fetchGoogleCalenders(req,res){
  try{
    const userId=req.user.id;
    const user=await User.findById(userId);

    if(!user.googleTokens){
      return sendErrorResponse(
        res,
        {},
        "User not connected to Google",
        STATUS_CODE.UNAUTHORIZED
      );
    }
    
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(user.googleTokens);
    const calendar = google.calendar({
      version: "v3",
      auth: oauth2Client,
    });

    const calendarListResponse = await calendar.calendarList.list();

    const calendars = calendarListResponse.data.items;

    return sendSuccessResponse(
      res,
      {calendars},
      "Fetched Google Calendars successfully",
      STATUS_CODE.SUCCESS
    );

  }catch(err){
    return sendErrorResponse(
      res,
      {},
      `Error: ${err.message}`,
      STATUS_CODE.INTERNAL_SERVER_ERROR
    );
  }
}




module.exports = {
  Login,
  Signup,
  googleSignup,
  getGoogleToken,
  fetchGoogleCalenderEvents,
  fetchGoogleCalenders
};
