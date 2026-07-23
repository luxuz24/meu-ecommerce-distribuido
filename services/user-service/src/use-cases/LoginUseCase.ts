import {PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

interface LoginUserDTO{
    email: string;
    password: string;
}

export class LoginUserUseCase {
    constructor (private prisma: PrismaClient) {}

    async execute(data: LoginUserDTO){
        const secretKey = process.env.JWT_SECRET;
        if(!secretKey){
            throw new Error("CRITICAL: variable JWT_SECRET is not defined in the .env file");
        }

        const user = await this.prisma.user.findUnique({
            where: {email: data.email}
        })

        if(!user){
            throw new Error("INVALID_CREDENTIALS!");
        }
        
        const isPasswordValid = await bcrypt.compare(data.password, user.password);

        if(!isPasswordValid){
            throw new Error("INVALID_CREDENTIALS!");
        }

        const tokenJwt = jwt.sign({userId: user.id, email: user.email},secretKey, {expiresIn: "1h"});

        return {
            tokenJwt,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            },
        };

    }
}