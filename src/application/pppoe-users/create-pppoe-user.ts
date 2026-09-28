import { randomUUID } from "node:crypto";

import { PppoeUser } from "../../domain/pppoe-user.js";

export interface CreatePppoeUserInput {
    name: string;
    phone: string;
}

export interface PppoeUserRepositoryPort {
    create(user: PppoeUser): Promise<void>;
}

export class CreatePppoeUser {
    constructor (
        private readonly repository: PppoeUserRepositoryPort,
    ){}

    async execute(input: CreatePppoeUserInput): Promise<PppoeUser>{
        const user = new PppoeUser(
            randomUUID(),
            input.name,
            input.phone,
            "ACTIVE",
            new Date(),
        );

        await this.repository.create(user);

        return user;
    }
}