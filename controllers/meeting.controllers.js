const { uploadAudioFile } = require('../utils/helper');
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
        textFilePath:processFile.data.fullPath
    });

    return sendSuccessResponse(
        res,
        {audioFile:uploadFile.data,textFile:processFile.data},
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

async function addMeetingMetrics(req,res){
    try{
        const meetingId=req.body.meetingId;
        const meetingData=await meeting.findById(meetingId);
        const metricsResponse=req.body.metricsResponse

        if(!meetingData){   
            return sendErrorResponse(
                res,
                {},
                "Meeting not found",
                STATUS_CODE.NOT_FOUND
            )
        }

        const addMetrics=await meetingServices.addMeetingMetrics(metricsResponse,meetingId);

        if(addMetrics.status!='success'){
            return sendErrorResponse(
                res,
                {},
                "Error adding meeting metrics",
                STATUS_CODE.SERVER_ERROR
            )
        }

        return sendSuccessResponse(
            res,
            addMetrics.data,
            "Meeting metrics added successfully",
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

async function getMeetings(req,res){
    try{
    const userId=req.user.id;
    const page=req.query.page? parseInt(req.query.page) : 1;
    const limit=req.query.limit? parseInt(req.query.limit) : 10;
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

module.exports={
    uploadAndProcessFile,
    addMeetingMetrics,
    getMeetings
}