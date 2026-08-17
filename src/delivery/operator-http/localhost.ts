export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) {
    return false;
  }
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === ":ffff:127.0.0.1" ||
    address.endsWith("127.0.0.1")
  );
}

export function isLocalhostHost(host: string | undefined): boolean {
  if (!host) {
    return false;
  }
  const hostname = host.split("]")[0]?.replace(/^\[/, "").split(":")[0] ?? host;
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}
