import { PrismaClient } from '@prisma/client';
import  bcrypt from 'bcrypt';


export class CreateUserUseCase {
    constructor(private readonly prisma: PrismaClient) {};

    async execute(name:string, email:string, passwordPlain:string) {

        const userExists = await this.prisma.user.findUnique({
            where: {email},
        });

        if (userExists) {
            throw new Error('USER_ALREADY_EXISTS');
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(passwordPlain, saltRounds);

        const result = await this.prisma.$transaction( async (tx)=>{
            const user = await tx.user.create({
                data:{
                    name,
                    email,
                    password: hashedPassword,
                },
            });

            await tx.outbox.create({
                data:{
                    aggregateType: 'User',
                    aggregateId: user.id,
                    eventType: 'USER_CREATED',
                    payload: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                    },
                },
            });
            return user;
        });
        const {password, ...userWithoutPassword} = result;
        return userWithoutPassword;
}
}
