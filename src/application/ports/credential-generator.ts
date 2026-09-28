export interface GeneratedCredential {
  username: string;
  password: string;
}

export interface CredentialGenerator {
  generate(accountNumber: string): GeneratedCredential;
}