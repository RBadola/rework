import express from "express"
import { config } from "dotenv"
import cookieParser from "cookie-parser"
import morgan from "morgan";
import helmet from "helmet";
import errorHandler from "./helpers/errorHandler.js";
import cors from "cors"
import apiRoutes from "./routes/index.js"
import { connectToDb } from "./helpers/db.js";
import { logger } from "./helpers/logger.js";
config()
const app = express()
const allowedOrigins = ['http://192.168.29.132:5173','http://localhost:5173', 'https://yourdomain.com',"http://localhost:4173","http://192.168.29.132:4173","https://gentle-truffle-2eb12a.netlify.app","https://refreshingroots.com/"];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // if you're sending cookies
}));
app.use(helmet())
app.use(morgan("dev"))
app.use(express.json({limit:"5mb"}))
app.use(express.urlencoded({extended:false,limit:"5mb"}))
app.use(cookieParser())
app.use(errorHandler)
app.use((req, res, next) => {
  logger.info(`MIDDLEWARE: ${req.method} ${req.path} - Request received`);
  next();
})
app.use("/api",apiRoutes)
const serverStarter = async ()=>{
    try{
       await connectToDb()
       app.listen(process.env.PORT || 3000 ,()=>console.log("listening",process.env.PORT || 3000))
    }catch(error){
        console.log(error.message)
        process.exit(1)
    }
}
serverStarter()