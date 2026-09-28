export type CredentialStatus = "ACTIVE" | "REVOKED";

export class Credential{
    constructor(
        public readonly id: string,
        public readonly installationId: string,
        public readonly username: string,
        private _password: string,
        private _status: CredentialStatus,
        public readonly createdAt: Date,
    ){}

    get password(): string{
        return this._password;
    }

    get status(): CredentialStatus{
        return this._status;
    }

    changePassword(password: string): void{
        this._password = password;
    }

    revoke(): void{
        this._status = "REVOKED";
    }

    activate(): void{
        this._status = "ACTIVE";
    }
}