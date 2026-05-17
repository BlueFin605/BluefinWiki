/**
 * Public-IP validation for the fetch-url proxy.
 *
 * Resolves a hostname and rejects any address that is private, loopback,
 * link-local, multicast, the cloud metadata service, or otherwise unsafe
 * to fetch from a server in a (potentially) public-facing deployment.
 *
 * Returns the validated IP literal to pin the eventual connection against,
 * defeating DNS-rebinding attacks where a hostname resolves to a public IP
 * during validation and then to a private IP when the request is actually made.
 */

import { lookup as dnsLookupCb } from 'node:dns';
import { promisify } from 'node:util';
import { isIPv4, isIPv6 } from 'node:net';

const dnsLookup = promisify(dnsLookupCb);

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export async function resolvePublicAddress(hostname: string): Promise<ResolvedAddress> {
  const addresses = await dnsLookup(hostname, { all: true });
  if (!addresses.length) {
    throw new Error(`Hostname did not resolve: ${hostname}`);
  }

  for (const { address } of addresses) {
    if (!isPublicIp(address)) {
      throw new Error(`Hostname ${hostname} resolves to a non-public address (${address})`);
    }
  }

  const preferred = addresses.find((a) => a.family === 4) ?? addresses[0];
  return { address: preferred.address, family: preferred.family as 4 | 6 };
}

export function isPublicIp(ip: string): boolean {
  if (isIPv4(ip)) return isPublicIpv4(ip);
  if (isIPv6(ip)) return isPublicIpv6(ip);
  return false;
}

function isPublicIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0) return false;                          // 0.0.0.0/8
  if (a === 10) return false;                         // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return false; // 100.64.0.0/10 CGNAT
  if (a === 127) return false;                        // loopback
  if (a === 169 && b === 254) return false;           // link-local incl. metadata service
  if (a === 172 && b >= 16 && b <= 31) return false;  // 172.16.0.0/12
  if (a === 192 && b === 0) return false;             // 192.0.0.0/24 protocol assignments
  if (a === 192 && b === 168) return false;           // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return false; // 198.18.0.0/15 benchmarking
  if (a >= 224 && a <= 239) return false;             // multicast 224.0.0.0/4
  if (a >= 240) return false;                         // reserved 240.0.0.0/4 incl. 255.255.255.255
  return true;
}

function isPublicIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();

  if (lower === '::' || lower === '::1') return false;

  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4.
  const mappedMatch = lower.match(/^::ffff:([0-9.]+)$/);
  if (mappedMatch) return isPublicIpv4(mappedMatch[1]);

  // 6to4 (2002::/16) embeds a v4 address in the next 32 bits.
  if (lower.startsWith('2002:')) {
    const hextets = lower.split(':');
    if (hextets.length >= 3) {
      const h1 = parseInt(hextets[1] || '0', 16);
      const h2 = parseInt(hextets[2] || '0', 16);
      const embedded = `${(h1 >> 8) & 0xff}.${h1 & 0xff}.${(h2 >> 8) & 0xff}.${h2 & 0xff}`;
      if (!isPublicIpv4(embedded)) return false;
    }
  }

  // fc00::/7 unique-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return false;
  // fe80::/10 link-local
  if (/^fe[89ab]/.test(lower)) return false;
  // ff00::/8 multicast
  if (lower.startsWith('ff')) return false;
  // 2001:db8::/32 documentation
  if (lower.startsWith('2001:db8:') || lower.startsWith('2001:0db8:')) return false;
  // 64:ff9b::/96 NAT64 wellknown — embeds public v4 but exposes infrastructure assumptions; deny.
  if (lower.startsWith('64:ff9b:')) return false;

  return true;
}
