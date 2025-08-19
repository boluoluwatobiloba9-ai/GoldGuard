import { describe, it, expect, beforeEach } from "vitest";

interface MockContract {
  admin: string;
  oracle: string;
  paused: boolean;
  redemptionEnabled: boolean;
  totalSupply: bigint;
  balances: Map<string, bigint>;
  staked: Map<string, bigint>;
  redemptionLocks: Map<string, bigint>;
  lastMintEvent: { recipient: string; amount: bigint; blockHeight: bigint };
  lastRedemptionEvent: { recipient: string; amount: bigint; blockHeight: bigint };
  MAX_SUPPLY: bigint;
  MIN_REDEMPTION: bigint;
  REDEMPTION_LOCK_PERIOD: bigint;
  blockHeight: bigint;

  isAdmin(caller: string): boolean;
  isOracle(caller: string): boolean;
  setPaused(caller: string, pause: boolean): { value: boolean } | { error: number };
  setRedemptionEnabled(caller: string, enabled: boolean): { value: boolean } | { error: number };
  setOracle(caller: string, newOracle: string): { value: boolean } | { error: number };
  mint(caller: string, recipient: string, amount: bigint, oracleVerified: boolean): { value: boolean } | { error: number };
  redeem(caller: string, amount: bigint): { value: boolean } | { error: number };
  transfer(caller: string, recipient: string, amount: bigint): { value: boolean } | { error: number };
  stake(caller: string, amount: bigint): { value: boolean } | { error: number };
  unstake(caller: string, amount: bigint): { value: boolean } | { error: number };
}

const mockContract: MockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  oracle: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  redemptionEnabled: false,
  totalSupply: 0n,
  balances: new Map<string, bigint>(),
  staked: new Map<string, bigint>(),
  redemptionLocks: new Map<string, bigint>(),
  lastMintEvent: { recipient: "", amount: 0n, blockHeight: 0n },
  lastRedemptionEvent: { recipient: "", amount: 0n, blockHeight: 0n },
  MAX_SUPPLY: 1_000_000_000_000n,
  MIN_REDEMPTION: 1_000_000n,
  REDEMPTION_LOCK_PERIOD: 1440n,
  blockHeight: 1000n,

  isAdmin(caller: string) {
    return caller === this.admin;
  },

  isOracle(caller: string) {
    return caller === this.oracle;
  },

  setPaused(caller: string, pause: boolean) {
    if (!this.isAdmin(caller)) return { error: 100 };
    this.paused = pause;
    return { value: pause };
  },

  setRedemptionEnabled(caller: string, enabled: boolean) {
    if (!this.isAdmin(caller)) return { error: 100 };
    this.redemptionEnabled = enabled;
    return { value: enabled };
  },

  setOracle(caller: string, newOracle: string) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (newOracle === "SP000000000000000000002Q6VF78") return { error: 105 };
    this.oracle = newOracle;
    return { value: true };
  },

  mint(caller: string, recipient: string, amount: bigint, oracleVerified: boolean) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (!this.isOracle(caller)) return { error: 107 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 105 };
    if (amount <= 0n) return { error: 106 };
    if (this.totalSupply + amount > this.MAX_SUPPLY) return { error: 103 };
    this.balances.set(recipient, (this.balances.get(recipient) || 0n) + amount);
    this.totalSupply += amount;
    this.lastMintEvent = { recipient, amount, blockHeight: this.blockHeight };
    return { value: true };
  },

  redeem(caller: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (!this.redemptionEnabled) return { error: 108 };
    if (amount < this.MIN_REDEMPTION) return { error: 106 };
    const lockHeight = this.redemptionLocks.get(caller) || 0n;
    if (this.blockHeight < lockHeight) return { error: 108 };
    const bal = this.balances.get(caller) || 0n;
    if (bal < amount) return { error: 101 };
    this.balances.set(caller, bal - amount);
    this.totalSupply -= amount;
    this.redemptionLocks.set(caller, this.blockHeight + this.REDEMPTION_LOCK_PERIOD);
    this.lastRedemptionEvent = { recipient: caller, amount, blockHeight: this.blockHeight };
    return { value: true };
  },

  transfer(caller: string, recipient: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (recipient === "SP000000000000000000002Q6VF78") return { error: 105 };
    if (amount <= 0n) return { error: 106 };
    const bal = this.balances.get(caller) || 0n;
    if (bal < amount) return { error: 101 };
    this.balances.set(caller, bal - amount);
    this.balances.set(recipient, (this.balances.get(recipient) || 0n) + amount);
    return { value: true };
  },

  stake(caller: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (amount <= 0n) return { error: 106 };
    const bal = this.balances.get(caller) || 0n;
    if (bal < amount) return { error: 101 };
    this.balances.set(caller, bal - amount);
    this.staked.set(caller, (this.staked.get(caller) || 0n) + amount);
    return { value: true };
  },

  unstake(caller: string, amount: bigint) {
    if (this.paused) return { error: 104 };
    if (amount <= 0n) return { error: 106 };
    const stakeBal = this.staked.get(caller) || 0n;
    if (stakeBal < amount) return { error: 102 };
    this.staked.set(caller, stakeBal - amount);
    this.balances.set(caller, (this.balances.get(caller) || 0n) + amount);
    return { value: true };
  },
};

describe("GoldGuard Gold Token Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.oracle = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.redemptionEnabled = false;
    mockContract.totalSupply = 0n;
    mockContract.balances = new Map();
    mockContract.staked = new Map();
    mockContract.redemptionLocks = new Map();
    mockContract.blockHeight = 1000n;
  });

  it("should mint tokens when called by admin and oracle", () => {
    const result = mockContract.mint(mockContract.admin, "ST2CY5...", 1000000n, true);
    expect(result).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5...")).toBe(1000000n);
    expect(mockContract.totalSupply).toBe(1000000n);
    expect(mockContract.lastMintEvent).toEqual({
      recipient: "ST2CY5...",
      amount: 1000000n,
      blockHeight: 1000n,
    });
  });

  it("should prevent minting over max supply", () => {
    const result = mockContract.mint(mockContract.admin, "ST2CY5...", 2_000_000_000_000n, true);
    expect(result).toEqual({ error: 103 });
  });

  it("should transfer tokens", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 5000000n, true);
    const result = mockContract.transfer("ST2CY5...", "ST3NB...", 2000000n);
    expect(result).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5...")).toBe(3000000n);
    expect(mockContract.balances.get("ST3NB...")).toBe(2000000n);
  });

  it("should prevent transfer when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    const result = mockContract.transfer("ST2CY5...", "ST3NB...", 1000000n);
    expect(result).toEqual({ error: 104 });
  });

  it("should stake tokens", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 5000000n, true);
    const result = mockContract.stake("ST2CY5...", 2000000n);
    expect(result).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5...")).toBe(3000000n);
    expect(mockContract.staked.get("ST2CY5...")).toBe(2000000n);
  });

  it("should unstake tokens", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 5000000n, true);
    mockContract.stake("ST2CY5...", 2000000n);
    const result = mockContract.unstake("ST2CY5...", 1000000n);
    expect(result).toEqual({ value: true });
    expect(mockContract.staked.get("ST2CY5...")).toBe(1000000n);
    expect(mockContract.balances.get("ST2CY5...")).toBe(4000000n);
  });

  it("should redeem tokens when enabled and lock period passed", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 5000000n, true);
    mockContract.setRedemptionEnabled(mockContract.admin, true);
    const result = mockContract.redeem("ST2CY5...", 1000000n);
    expect(result).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5...")).toBe(4000000n);
    expect(mockContract.totalSupply).toBe(4000000n);
    expect(mockContract.redemptionLocks.get("ST2CY5...")).toBe(1000n + mockContract.REDEMPTION_LOCK_PERIOD);
    expect(mockContract.lastRedemptionEvent).toEqual({
      recipient: "ST2CY5...",
      amount: 1000000n,
      blockHeight: 1000n,
    });
  });

  it("should prevent redemption if not enabled", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 5000000n, true);
    const result = mockContract.redeem("ST2CY5...", 1000000n);
    expect(result).toEqual({ error: 108 });
  });

  it("should prevent redemption if amount below minimum", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 5000000n, true);
    mockContract.setRedemptionEnabled(mockContract.admin, true);
    const result = mockContract.redeem("ST2CY5...", 500000n);
    expect(result).toEqual({ error: 106 });
  });

  it("should prevent redemption during lock period", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 5000000n, true);
    mockContract.setRedemptionEnabled(mockContract.admin, true);
    mockContract.redeem("ST2CY5...", 1000000n);
    const result = mockContract.redeem("ST2CY5...", 1000000n);
    expect(result).toEqual({ error: 108 });
  });

  it("should allow redemption after lock period", () => {
    mockContract.mint(mockContract.admin, "ST2CY5...", 5000000n, true);
    mockContract.setRedemptionEnabled(mockContract.admin, true);
    mockContract.redeem("ST2CY5...", 1000000n);
    mockContract.blockHeight = 2440n; // After lock period
    const result = mockContract.redeem("ST2CY5...", 1000000n);
    expect(result).toEqual({ value: true });
    expect(mockContract.balances.get("ST2CY5...")).toBe(3000000n);
  });

  it("should set oracle correctly", () => {
    const result = mockContract.setOracle(mockContract.admin, "ST3NB...");
    expect(result).toEqual({ value: true });
    expect(mockContract.oracle).toBe("ST3NB...");
  });
});