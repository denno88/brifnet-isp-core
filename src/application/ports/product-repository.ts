import { Product } from "../../domain/product.js";

export interface ProductRepository {
  create(product: Product): Promise<void>;

  findById(id: string): Promise<Product | null>;

  findByPrice(
    price: number,
  ): Promise<Product[]>;

  save(product: Product): Promise<void>;
}