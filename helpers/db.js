import mongoose from "mongoose";

export const connectToDb = async()=>{
    try{
        await mongoose.connect(process.env.DB_URI).then(()=>console.log("COnnected to db"))
    }catch(err){
        console.log("DB error",err.message)
        process.exit(1)
    }
}