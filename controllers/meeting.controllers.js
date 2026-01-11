const { uploadAudioFile,getSignedUrl } = require('../utils/helper');
const { sendSuccessResponse,sendErrorResponse } = require('../utils/response');
const { STATUS_CODE } = require('../utils/constants');
const meetingServices = require('../services/meeting.service');
const meeting=require('../models/meetings');
const meetingMetric=require('../models/meetingMetrics');


async function uploadAndProcessFile(req,res){
    try{
    const file=req.file;
    const userId=req.user.id;
    const meetingId=req.body.meetingId;

    const uploadFile=await uploadAudioFile(file,userId);



    if(uploadFile.status!='success'){
        return sendErrorResponse(
            res,
            uploadFile.data,
            uploadFile.message,
            STATUS_CODE.SERVER_ERROR
        )
    }

    

    // Placeholder for processing logic (e.g., transcription, summarization)

    const processFile=await meetingServices.processAudioFile(file,userId)

    if(processFile.status!='success'){  
        return sendErrorResponse(
            res,
            {},
            "Error processing file",
            STATUS_CODE.SERVER_ERROR
        )
    }

    await meeting.findByIdAndUpdate(meetingId,{
        audioFilePath:uploadFile.data.fullPath,
        textFilePath:processFile.data.textFile.fullPath
    });

    const textFile=await getSignedUrl(processFile.data.textFile.path);

    const analyzeTextFile=await meetingServices.analyzeTranscriptFile(meetingId,processFile.data.transcript);

    const Mom=await meetingServices.generateMom(meetingId,processFile.data.transcript);

    return sendSuccessResponse(
        res,
        {audioFile:uploadFile.data,textFile},
        "File uploaded and processed successfully",
        STATUS_CODE.SUCCESS
    )


    
    }catch(err){
        console.log(err)
        return sendErrorResponse(
            res,
            {},
            "Internal Server Error",
            STATUS_CODE.SERVER_ERROR
        )
    }
}

async function getMeetingMetrics(req,res){
    try{
        const meetingId=req.params.id;

        console.log("Meeting ID: ", meetingId);
        
        const meetingMetrics=await meetingMetric.findOne({meetingId:meetingId});

        if(!meetingMetrics){
            return sendErrorResponse(
                res,
                meetingMetrics,
                "Meeting metrics not found",
                STATUS_CODE.NOT_FOUND
            )
        }

        return sendSuccessResponse(
            res,
            meetingMetrics,
            "Meeting metrics retrieved successfully",
            STATUS_CODE.SUCCESS
        )
    }catch(err){    
        console.log(err)
        return sendErrorResponse(
            res,
            {},
            "Internal Server Error",
            STATUS_CODE.SERVER_ERROR
        )
    }
}       

async function getAllMeetings(req,res){
    try{
        const userId=req.user.id;
        const meetings=await meeting.find({userId:userId}).sort({createdAt:-1});
        return sendSuccessResponse(
            res,
            meetings,
            "Meetings retrieved successfully",
            STATUS_CODE.SUCCESS
        )
    }catch(err){
        console.log(err)
        return sendErrorResponse(
            res,
            {},
            "Internal Server Error",
            STATUS_CODE.SERVER_ERROR
        )
    }
}

async function getMeetingById(req,res){
    try{
        const meetingId=req.params.id;
        const meetingData=await meeting.findById(meetingId);

        if(!meetingData){
            return sendErrorResponse(
                res,
                {},
                "Meeting not found",
                STATUS_CODE.NOT_FOUND
            )
        }
        return sendSuccessResponse(
            res,
            meetingData,
            "Meeting retrieved successfully",
            STATUS_CODE.SUCCESS
        )
    }
    catch(err){
        console.log(err)
        return sendErrorResponse(
            res,
            {},
            "Internal Server Error",
            STATUS_CODE.SERVER_ERROR
        )
    }
}
module.exports={
    uploadAndProcessFile,
    getMeetingMetrics,
    getAllMeetings,
    getMeetingById
}