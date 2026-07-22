import 'dotenv/config';
import Fastify from "fastify";
import { userRoutes } from "./controllers/UserController.js";

const app = Fastify({
    logger: true
});

app.get('/health', async (request, reply) => {
    return { status: 'up', service: 'user-service' };
});

app.register(userRoutes);

const start = async () =>{
    try {
        await app.listen({port: 3000, host: '0.0.0.0'});
        console.log('User service is running on port 3000!!!');
    }catch (err) { 
        app.log.error(err);
        process.exit(1);
    }
};

start();