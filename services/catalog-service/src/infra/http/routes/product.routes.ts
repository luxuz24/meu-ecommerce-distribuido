import { type FastifyInstance } from "fastify";
import { ProductController } from "../controllers/ProductController.js";

export async function productRoutes(app: FastifyInstance) {
    const productController = new ProductController();

    app.post('/products', async (request, reply) => {
        return productController.create(request, reply);
    });
}