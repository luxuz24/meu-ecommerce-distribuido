import 'dotenv/config';
import Fastify from 'fastify';
import { connectDB } from './infra/database/mongo.js';
import { productRoutes } from './infra/http/routes/product.routes.js';

const app = Fastify({ logger: true });
app.get('/health', async (request, reply) => {
            return { status: 'OK', service: 'catalog-service', timestamp: new Date()};
        });

app.register(productRoutes, { prefix: 'api' });

async function start() {
    try{
        console.log("initializing catalog-service...");
        await connectDB();
        const port = Number(process.env.PORT);
        await app.listen({ port, host:'0.0.0.0'});
        console.log(`catalog-service is running on port ${port}`);
    }catch (err) {
        app.log.error(err);
        process.exit(1);

    }
}

start();
