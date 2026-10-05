// IPv4 subnets from CIDR notation (192.168.1.0/26): network, broadcast, mask and usable hosts.
// Not here: IPv6 or masks written as four numbers.

export interface Subnet {
  readonly network: string;
  readonly broadcast: string;
  readonly mask: string;
  readonly prefix: number;
  // Usable hosts counted the classic way taught for exams, 2^(32 - prefix) - 2; /31 links (RFC 3021) count 0.
  readonly hosts: number;
  readonly first: string | null;
  readonly last: string | null;
}

const CIDR = /^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\s*\/\s*(\d{1,2})\s*$/;

function dotted(value: number): string {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
}

export function readSubnet(text: string): Subnet | null {
  const match = CIDR.exec(text);
  if (match === null) return null;
  const [, ...parts] = match;
  const numbers = parts.map(Number);
  const prefix = numbers[4] ?? 33;
  const octets = numbers.slice(0, 4);
  if (prefix > 32 || octets.some((octet) => octet > 255)) return null;
  const address = octets.reduce((sum, octet) => sum * 256 + octet, 0);
  // Shifting by 32 is a no-op in JavaScript, so /0 needs its own mask.
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (address & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const hosts = Math.max(0, broadcast - network - 1);
  return {
    network: dotted(network),
    broadcast: dotted(broadcast),
    mask: dotted(mask),
    prefix,
    hosts,
    first: hosts === 0 ? null : dotted(network + 1),
    last: hosts === 0 ? null : dotted(broadcast - 1),
  };
}
