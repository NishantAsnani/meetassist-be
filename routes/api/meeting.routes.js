const express=require('express');
const router=express.Router()
const meetingControllers=require('../../controllers/meeting.controllers')
const auth=require('../../middleware/auth')
const {upload,uploadAudioFiletoSupaBase}=require('../../utils/helper');



router.post('/processFile',auth,upload.single('file'),meetingControllers.uploadAndProcessFile)

router.post('/chatResponse',auth,meetingControllers.chatBotResponse);

router.post('/createJiraTicket',auth,meetingControllers.createJiraTicket);

router.get('/',auth,meetingControllers.getAllMeetings)

router.get('/getMetrics/:id',auth,meetingControllers.getMeetingMetrics)

router.get('/getMeetingTasks/:id',auth,meetingControllers.fetchMeetingTasks)

router.get('/downloadMom/:id',auth,meetingControllers.getMom);

router.get('/:id/status',auth,meetingControllers.getMomStatus);

router.get('/:id',auth,meetingControllers.getMeetingById)



module.exports=router
