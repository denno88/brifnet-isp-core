export type PppoeUserStatus =  "ACTIVE" | "SUSPENDED";

export class PppoeUser {
    constructor(
        public readonly id: string,
        private _name: string,
        private _phone: string,
        private _status: PppoeUserStatus,
        public readonly createdAt: Date,
    ){}

    get name(): string {
        return this._name;
    }

    get phone(): string {
        return this._phone;
    }

    get status(): PppoeUserStatus {
        return this._status;
    }

    changeName(name: string) : void{
        this._name = name;
    }

    changePhone(phone: string): void{
        this._phone = phone;
    }

    suspend(): void{
        this._status = "SUSPENDED";
    }

    activate(): void{
        this._status = "ACTIVE";
    }
}