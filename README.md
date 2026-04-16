Polaris Fuel · Wallet Manager
Free, open-source wallet management tool for the Valannia Web3 game ecosystem on Solana. Officially endorsed by Valannia.
Manage multiple player wallets, move assets, trade with other players, craft items and claim in-game rewards — all from a single interface. No registration. No fees. Connect your Solana wallet and go.

Features
📦 Inventory — Load any Solana wallet by public address and view its full contents. SPL tokens and Metaplex Core NFTs organized by category, with real-time SOL, VALAN and USDC balances.
⚡ Logistics — Transfer SPL tokens and Core NFTs between wallets. Smart batching groups transfers to stay within Solana's transaction size limit. Core NFTs use a single Phantom approval for all transfers at once.
⚖️ P2P Market — Direct player-to-player trading backed by on-chain escrow. No trust required. Orders are stored in Firebase and settled on-chain. Supports both SPL tokens and Core NFTs.
⚔️ Heroes — View all your Valannia heroes with profession stats, mastery levels, active craft countdowns, and the full craft queue for each hero.
🔨 Crafting — Searchable recipe explorer filtered by hero profession and level. Shows ingredient requirements checked against your Valannia inventory in real time. Execute crafts with a single wallet signature.
🎁 Claim Resources — Claim all pending backlog items without visiting the Valannia portal. Select items, sign once, done.

Tech Stack
LayerTechnologyFrontendReact 18 + ViteBlockchain@solana/web3.js · @solana/spl-token · @solana/wallet-adapterNFTsMetaplex UMI · mpl-coreNFT IndexerHelius DAS APIWallet SupportPhantom · Solflare · BackpackBackendCloudflare WorkersDatabaseFirebase Firestore

Security
No private keys are ever requested or stored. All transaction signing happens inside the user's wallet extension. The escrow keypair for the P2P market is stored as an encrypted Cloudflare Worker secret and never exposed to the frontend. All transactions are verifiable on the Solana blockchain.

About
Built by Polaris Fuel Alliance · Free community tool · Officially endorsed by Valannia
MIT License
