const  User  = require("../models/users");
const { sendSuccessResponse, sendErrorResponse } = require("../utils/response");
const { STATUS_CODE } = require("../utils/constants");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const authServices = require("../services/auth.service");
const jwtSecret = process.env.JWT_SECRET || "your_jwt_secret";
const {getOAuthClient}=require("../utils/helper");
const {google}=require("googleapis");
const axios=require("axios");
const meetingServices=require("../services/meeting.service");
const meeting=require('../models/meetings');
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
        {token,user:{
          id:user._id,
          name:user.name,
          email:user.email,
          institute:user.institute,
          isGoogleSynced:user.isGoogleSynced,
        }},
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
      googleTokens:{},
      jiraAuthTokens:{},
      jiraCloudId:"",
    });

    if (createUser) {
      const token=jwt.sign(
        { id: createUser._id,email:email },
        jwtSecret,
        { expiresIn: "24h" }
      );



      return sendSuccessResponse(
        res,
        {token,user:{
          id:createUser._id,
          name,
          email,
          institute,
          isGoogleSynced:createUser.isGoogleSynced,
        }},
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
    const userId=req.query.userId || req.user.id;
    
    

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/calendar.readonly"],
      state: userId, // 🔑 
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

    console.log("Google OAuth Callback hit for userId:", userId);
    
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    

    const user=await User.findById(userId);
    user.googleTokens=tokens;
    user.isGoogleSynced=true;
    await user.save();

    const syncGoogleToDatabase=await meetingServices.syncGoogleCalenderToDB(user);

    
    res.redirect(`${process.env.FRONTEND_URL}/calender`);

    

    
  }catch(err){
    console.log(err)
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

async function jiraSignup(req,res){
  try{
    const  meetingId  = req.query.meetingId;
    console.log("Jira Signup endpoint hit for meetingId:", meetingId);

    const scopes = [
    'read:jira-work',  
    'write:jira-work', 
    'read:jira-user',  
    'offline_access'   
  ].join(' ');
  const authUrl =
      `${process.env.JIRA_AUTH_URL}` +
      `?audience=api.atlassian.com` +
      `&client_id=${process.env.JIRA_CLIENT_ID}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(process.env.JIRA_REDIRECT_URI)}` +
      `&state=${meetingId}` +
      `&response_type=code` +
      `&prompt=consent`;

    return sendSuccessResponse(
      res,
      { auth_url:authUrl },
      "Jira Signup endpoint hit successfully",
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

async function getJiraToken(req, res) {
  try {
    const { code, state: meetingId } = req.query;


    const tokenRes = await axios.post(
      process.env.JIRA_TOKEN_URL,
      {
        grant_type: "authorization_code",
        client_id: process.env.JIRA_CLIENT_ID,
        client_secret: process.env.JIRA_CLIENT_SECRET,
        code,
        redirect_uri: process.env.JIRA_REDIRECT_URI,
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const tokens = tokenRes.data;
    const meetingData = await meeting.findById(meetingId).populate('userId');
    
  
    console.log(meetingData);

    const resourceRes = await axios.get(
      "https://api.atlassian.com/oauth/token/accessible-resources",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    const cloudId = resourceRes.data[0].id;


    let selectedProjectKey = null;
    let selectedProjectName = null;



    const projects = await meetingServices.getJiraProjects(cloudId, tokens);

    if (projects.length > 0) {

      const preferred = projects.find(p => p.key.includes("MEET") || p.name.includes("Meeting"));
      const target = preferred || projects[0];

      selectedProjectKey = target.key;
      selectedProjectName = target.name;


    } else {
      // CASE B: User has NO projects -> Auto-Create one

      const newProjectRes = await meetingServices.createInitialProject(cloudId, tokens);

      selectedProjectKey = newProjectRes.data.key;
      selectedProjectName = "Meeting Action Items";
    }



    meetingData.userId.jiraAuthTokens = tokens;
    meetingData.userId.jiraCloudId = cloudId;
    meetingData.userId.isJiraSynced = true;
    if (selectedProjectKey) {
      meetingData.userId.defaultJiraProjectKey = selectedProjectKey;
      meetingData.userId.defaultJiraProjectName = selectedProjectName;
    }

    await meetingData.userId.save();

    res.redirect(`${process.env.FRONTEND_URL}/dashboard/${meetingId}`);
  } catch (err) {
    console.log(err);
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
  fetchGoogleCalenders,
  jiraSignup,
  getJiraToken
};
