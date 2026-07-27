import mongoose from 'mongoose';


export async function connectDB(): Promise<void>{
    const url = process.env.MONGO_URI;
    if (!url) {
        throw new Error("CRITICAL: invalid MONGO_URI environment variable. Please check your .env file.");
    }

    try{    
        await mongoose.connect(url);
        console.log("MongoDB connected successfully");
    }catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1);
    }
}

