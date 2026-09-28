import { Credential } from "../../domain/credential.js";

export interface CredentialRepository {
    create(credential: Credential): Promise<void>;

    findById(id: string): Promise<Credential | null>;

    findActiveByInstallationId(
        installationId: string,
    ): Promise <Credential | null>;

    save(credential: Credential): Promise<void>;
}