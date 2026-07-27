import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
    name: string;
    description: string;
    sku: string;
    price: number;
    stock: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const ProductSchema: Schema = new Schema({
    name: {type: String,required: true, trim: true},
    description: {type: String, required: true},
    sku: {type: String, required: true, unique: true, index: true},
    price: {type: Number, required: true, min: 0},
    stock: {type: Number, required: true, min: 0},
    isActive: {type: Boolean, default: true},
}, {
    timestamps: true,   
});

export const ProductModel = mongoose.model<IProduct>('Product', ProductSchema);