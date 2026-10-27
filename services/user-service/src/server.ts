import 'dotenv/config';
import Fastify from "fastify";
import { userRoutes } from "./infra/http/controllers/UserController.js";

const app = Fastify({
    logger: true
});

app.get('/health', async (request, reply) => {
    return { status: 'up', service: 'user-service' };
});

app.register(userRoutes);

const start = async () =>{
    try {
        const port = Number(process.env.PORT) || 3000;
        await app.listen({port, host: '0.0.0.0'});
        console.log(`User service is running on port ${port}!!!`);
    }catch (err) { 
        app.log.error(err);
        process.exit(1);
    }
};

start();