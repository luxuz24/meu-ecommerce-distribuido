import { type FastifyInstance } from "fastify";
import { ProductController } from "../controllers/ProductController.js";

export async function productRoutes(app: FastifyInstance) {
    const productController = new ProductController();

    app.post('/products', {
        schema: {
            body: {
                type: 'object',
                required: ['name', 'description', 'sku', 'price', 'stock'],
                additionalProperties: false,
                properties: {
                    name: { type: 'string', minLength: 2 },
                    description: { type: 'string', minLength: 2 },
                    sku: { type: 'string', minLength: 2 },
                    price: { type: 'number', minimum: 0 },
                    stock: { type: 'number', minimum: 0 },
                },
            },
        },
    }, async (request, reply) => {
        return productController.create(request, reply);
    });
}