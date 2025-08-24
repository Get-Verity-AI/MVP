// miniapp/src/lib/nearWallet.ts
let selector: any = null;
let modal: any = null;

// miniapp/src/lib/nearWallet.ts
const RAW = String(import.meta.env.VITE_NEAR_NETWORK || "testnet").toLowerCase();
const NETWORK = RAW === "mainnet" ? "mainnet" : "testnet";

async function loadDeps() {
  // Lazy-load everything so other pages don’t evaluate these modules
  const [
    core,
    modalUi,
    here,
    meteor,
    eth,
  ] = await Promise.all([
    import("@near-wallet-selector/core"),
    import("@near-wallet-selector/modal-ui"),
    import("@near-wallet-selector/here-wallet"),
    import("@near-wallet-selector/meteor-wallet"),
    import("@near-wallet-selector/ethereum-wallets"),
  ]);

  // lazy-load CSS too
  await import("@near-wallet-selector/modal-ui/styles.css");

  return {
    setupWalletSelector: core.setupWalletSelector,
    setupModal: modalUi.setupModal,
    setupHereWallet: here.setupHereWallet,
    setupMeteorWallet: meteor.setupMeteorWallet,
    setupEthereumWallets: eth.setupEthereumWallets,
  };
}

export async function ensureNearSelector() {
  if (selector) return { selector, modal };

  const {
    setupWalletSelector,
    setupModal,
    setupHereWallet,
    setupMeteorWallet,
    setupEthereumWallets,
  } = await loadDeps();

  selector = await setupWalletSelector({
    network: NETWORK,
    debug: false,
    modules: [
      setupHereWallet(),
      setupMeteorWallet(),
      // MetaMask & other EVM wallets
      setupEthereumWallets({
        // wallets: ["metamask"], // optional: restrict to MetaMask
      }),
    ],
  });

  modal = setupModal(selector, { contractId: CONTRACT_ID });
  return { selector, modal };
}

// Unified connect that returns NEAR accountId OR EVM address + provider type
export async function connectWallet(): Promise<
  string | { type: "near" | "evm"; account: string } | null
> {
  const { selector, modal } = await ensureNearSelector();
  modal?.show();

  return new Promise((resolve) => {
    const sub = selector.on("signIn", async () => {
      const wallet = await selector.wallet();
      const accounts = await wallet.getAccounts();
      const id = accounts?.[0]?.accountId ?? "";
      const type: "near" | "evm" = id?.toLowerCase().startsWith("0x") ? "evm" : "near";
      sub.remove();
      resolve(id ? { type, account: id } : null);
    });
  });
}

export async function disconnectWallet() {
  const { selector } = await ensureNearSelector();
  try {
    await selector.signOut();
  } catch {}
}
