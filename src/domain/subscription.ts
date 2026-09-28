export type SubscriptionStatus = "ACTIVE" | "GRACE" | "EXPIRED" | "SUSPENDED";

export class Subscription {
    constructor(
        public readonly id: string,
        public readonly installationId: string,
        public readonly productId: string,
        private _status: SubscriptionStatus,
        private _currentPeriodStart: Date,
        private _currentPeriodEnd: Date,
        private _graceEndsAt: Date | null,
        public readonly createdAt: Date, 
    ){}

    get status(): SubscriptionStatus{
        return this._status;
    }

    get currentPeriodStart(): Date{
        return this._currentPeriodStart;
    }

    get currentPeriodEnd(): Date{
        return this._currentPeriodEnd;
    }

    get graceEndsAt(): Date | null{
        return this._graceEndsAt;
    }

    enterGrace(now: Date, gracePeriodDays: number): void {
        if (this._status !== "ACTIVE") {
            return;
        }

        if (now < this._currentPeriodEnd) {
            return;
        }

        if (gracePeriodDays <= 0) {
            this._status = "EXPIRED";
            this._graceEndsAt = null;
            return;
        }

        this._status = "GRACE";
        this._graceEndsAt = new Date(
            this._currentPeriodEnd.getTime() +
            gracePeriodDays * 24 * 60 * 60 * 1000,
        );
    }

    expire(now: Date): void{
        if(this._status !== "GRACE"){
            return;
        }

        if(this._graceEndsAt === null){
            this._status = "EXPIRED";
            return;
        }

        if(now >= this._graceEndsAt){
            this._status = "EXPIRED";
            return;
        }
    }

    renew(durationDays: number, gracePeriodDays: number): void{
        const millisecondsPerDay = 24 * 60 * 60 * 1000;

        const newEnd = new Date(
            this._currentPeriodEnd.getTime() + 
            durationDays * millisecondsPerDay,
        );

        this._currentPeriodEnd = newEnd;

        this._graceEndsAt = new Date(
            newEnd.getTime() + 
            gracePeriodDays * millisecondsPerDay,
        );

        this._status = "ACTIVE";
    }

    suspend(): void{
        this._status = "SUSPENDED";
    }
}