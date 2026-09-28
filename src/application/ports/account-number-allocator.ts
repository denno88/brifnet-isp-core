export interface AccountNumberAllocation {
  prefix: string;
  sequence: number;
  accountNumber: string;
}

export interface AccountNumberAllocator {
  allocate(prefix: string): Promise<AccountNumberAllocation>;
}