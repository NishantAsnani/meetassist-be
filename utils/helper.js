const {createClient} = require('@supabase/supabase-js');
const multer = require('multer');
const supabaseUrl=process.env.SUPABASE_PROJECT_URL;
const supabaseKey=process.env.SUPABASE_SECRET_KEY;
const supabaseClient=createClient(supabaseUrl,supabaseKey);
const upload = multer({ storage: multer.memoryStorage() });
const {google}=require("googleapis");


async function uploadAudioFile(file,userId){
    try{
        const { data, error } = await supabaseClient.storage
            .from('SAIL')
            .upload(`${userId}/audio/${Date.now()}-${file.originalname}`, file.buffer, {
                contentType: file.mimetype,
            });

        if (error) {
            console.log("Supabase Upload Error: ", error);
            return {
                status: 'error',
                message: 'File upload failed',
                data:null
            };
        }

        else{
            return{
                status:'success',
                message:'File uploaded successfully',
                data:data,
            }
        }
        
    }catch(err){
        throw new Error(err);
    }
}

async function uploadTextFile(textBuffer, userId) {
    try {
        const realBuffer = Buffer.isBuffer(textBuffer)
            ? textBuffer
            : Buffer.from(textBuffer.data);
        const { data, error } = await supabaseClient.storage
            .from('SAIL')
            .upload(`${userId}/text/${Date.now()}-transcribeFile`, realBuffer, {
                contentType: 'text/plain',
                upsert: true,
            });



        if (error) {
            console.log("Supabase Upload Error: ", error);
            return {
                status: 'error',
                message: 'File upload failed',
                data: null
            };
        }

        else {
            return {
                status: 'success',
                message: 'File uploaded successfully',
                data: data,
            }
        }

    } catch (err) {
        throw new Error(err);
    }
}

async function getFileFromSupabase(filePath) {
  try {
    const { data, error } = await supabaseClient.storage
      .from("SAIL")
      .download(filePath);

    if (error) {
      console.error("Supabase Download Error:", error);
      return {
        status: "error",
        message: "File download failed",
        data: null,
      };
    }

    // Convert Blob → Buffer (Node.js)
    const buffer = Buffer.from(await data.arrayBuffer());

    return {
      status: "success",
      message: "File downloaded successfully",
      data: buffer,
    };

  } catch (err) {
    console.error("getFileFromSupabase Exception:", err);
    throw err;
  }
}


const formatTime = (ms) => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

function getOAuthClient() {
  return new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);
}

function getJiraOAuthClient() {
  return new google.auth.OAuth2(
  process.env.JIRA_CLIENT_ID,
    process.env.JIRA_CLIENT_SECRET,
    process.env.JIRA_REDIRECT_URI
);
}

async function getSignedUrl(filePath) {
    const { data, error } = await supabaseClient.storage
      .from("SAIL")
      .createSignedUrl(filePath,300);

      return data;
}



module.exports={
    uploadAudioFile,
    uploadTextFile,
    upload,
    formatTime,
    getOAuthClient,
    getJiraOAuthClient,
    getFileFromSupabase,
    getSignedUrl,
}