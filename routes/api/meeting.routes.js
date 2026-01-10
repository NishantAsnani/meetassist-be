const express=require('express');
const router=express.Router()
const meetingControllers=require('../../controllers/meeting.controllers')
const auth=require('../../middleware/auth')
const {upload,uploadAudioFiletoSupaBase}=require('../../utils/helper');

router.post('/addMetrics',auth,meetingControllers.addMeetingMetrics)

router.post('/processFile',auth,upload.single('file'),meetingControllers.uploadAndProcessFile)

router.get('/',auth,meetingControllers.getMeetings)

router.get('/:id',auth,meetingControllers.getMeetingById)




module.exports=router
