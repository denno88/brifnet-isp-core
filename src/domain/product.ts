export class Product{
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly servicePlanId: string,
        public readonly price: number,
        public readonly durationDays: number,
        public readonly gracePeriodDays: number,
        public readonly createdAt: Date,
    ){}
}