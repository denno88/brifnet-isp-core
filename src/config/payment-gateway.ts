export interface BrifNetMpesaGatewayConfig {
  baseUrl: string;
  timeoutMs: number;
  accessToken?: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function positiveIntegerEnv(
  name: string,
  defaultValue: number,
): number {
  const raw =
    process.env[name]?.trim();

  if (!raw) {
    return defaultValue;
  }

  const value = Number(raw);

  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      `${name} must be a positive integer`,
    );
  }

  return value;
}

export function getBrifNetMpesaGatewayConfig(): BrifNetMpesaGatewayConfig {
  const accessToken =
    process.env.BRIFNET_MPESA_ACCESS_TOKEN?.trim();

  return {
    baseUrl: requiredEnv(
      "BRIFNET_MPESA_GATEWAY_URL",
    ),

    timeoutMs: positiveIntegerEnv(
      "BRIFNET_MPESA_TIMEOUT_MS",
      10_000,
    ),

    ...(accessToken
      ? { accessToken }
      : {}),
  };
}
