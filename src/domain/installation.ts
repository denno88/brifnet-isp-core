export type InstallationStatus = "PENDING" | "ACTIVE";

export class Installation {
    constructor(
        public readonly id: string,
        public readonly pppoeUserId: string,
        public readonly accountNumber: string,
        private _status: InstallationStatus,
        public readonly createdAt: Date,
    ){}

    get status(): InstallationStatus{
        return this._status;
    }

    activate(): void{
        this._status = "ACTIVE";
    }
}