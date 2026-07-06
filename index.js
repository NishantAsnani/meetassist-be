require('dotenv').config();
require('newrelic')
const express=require('express')
const app=express();
const PORT=process.env.PORT || 3000;
const cors=require('cors')
const routes=require('./routes/index')
const bodyParser=require('body-parser')
const dbconnection=require('./db');
const http =require('http');
const server= http.createServer(app);
const {initializeSocket}=require('./utils/socket')


initializeSocket(server);
(async ()=>{
  await dbconnection()
})();
require("./utils/queueEvents");

app.use(cors(
  {
    origin:"http://localhost:5173"
  }
));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
//Middleware to parse JSON and URL-encoded data


app.use('/api',routes)



server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});