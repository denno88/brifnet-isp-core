export class ServicePlan{
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly downloadMbps: number,
        public readonly uploadMbps: number,
        public readonly createdAt: Date,
    ){}
}