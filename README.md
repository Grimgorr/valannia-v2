# Polaris Fuel · Wallet Manager

> Free Web3 tool for the **Valannia** game ecosystem on Solana

[![Live App](https://img.shields.io/badge/Live%20App-valannia.polarisfuel.app-orange?style=flat-square)](https://valannia.polarisfuel.app/wallet-manager)
[![GitHub Pages](https://img.shields.io/badge/Also%20on-grimgorr.github.io%2Fvalannia--v2-blue?style=flat-square)](https://grimgorr.github.io/valannia-v2)
[![Solana](https://img.shields.io/badge/Chain-Solana%20Mainnet-9945FF?style=flat-square)](https://solana.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## What is this?

**Polaris Fuel · Wallet Manager** is an open-source DApp built for players of [Valannia](https://portal.valannia.com), a Web3 RPG on Solana. It provides a unified interface to manage multiple player wallets, move assets, trade with other players, craft items, and claim in-game rewards — all without leaving a single page.

No registration. No fees. Connect your Solana wallet and go.

---

## Features

### 📦 Inventory
- Load any Solana wallet by public address and view its full contents
- SPL tokens fetched via `@solana/web3.js` + `getParsedTokenAccountsByOwner`
- Core NFTs (Metaplex) fetched via **Helius DAS API** (`getAssetsByOwner`)
- Items organized by category and subcategory matching Valannia's structure
- Real-time SOL / VALAN / USDC balances with token logos

### ⚡ Logistics (Multi-wallet Transfer)
- Add multiple wallets and move SPL tokens + Core NFTs between them
- Smart batching: groups SPL transfers up to Solana's tx size limit (~1232 bytes) dynamically
- Core NFTs use `signAllTransactions` — **one Phantom approval for all NFTs at once**
- Automatic ATA creation for destination wallets that don't have a token account yet

### ⚖️ P2P Market
- Direct player-to-player trading of Valannia materials
- **Escrow-backed**: a Cloudflare Worker holds assets until both sides complete
- Orders stored in Firebase Firestore; settlement happens on-chain
- Supports both SPL tokens and Metaplex Core NFTs
- Buyers and sellers interact with simple UI — no manual escrow management

### ⚔️ Heroes
- View all your Valannia heroes with full stats (profession, mastery, XP, health, skills)
- Shows active craft in progress with live countdown timer
- Displays full craft queue for each hero
- Item images and profession logos from Valannia's CDN

### 🔨 Crafting
- Full recipe explorer searchable by name or output item
- Checks Valannia inventory in real time — green ✓ if you have ingredients, red numbers if not
- Execute crafts directly: select hero, recipe, quantity → sign once in Phantom → done
- Supports all professions: Artisan, Blacksmith, Engineer, Alchemist, Architect, Jeweler, Miner, Explorer

### 🎁 Claim Resources (Backlog)
- Claim all pending in-game rewards without visiting the Valannia portal
- Checkbox selection — claim all or pick individual items
- Full 4-step on-chain flow: request → sign → provide → complete
- Auto-reloads after successful claim

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Blockchain | `@solana/web3.js`, `@solana/spl-token`, `@solana/wallet-adapter` |
| NFTs | Metaplex UMI + `@metaplex-foundation/mpl-core` |
| NFT Indexer | Helius DAS API |
| Wallet Support | Phantom, Solflare, Backpack |
| Backend Proxy | Cloudflare Workers (Node.js compat) |
| Database | Firebase Firestore (P2P market orders) |
| Deployment | GitHub Pages + custom domain |

---




## Security

- **No private keys are ever requested or stored.** All signing happens inside the user's wallet extension (Phantom/Solflare/Backpack).
- Every transaction is visible and verifiable on the Solana blockchain.
- The escrow keypair for the P2P market is stored as an encrypted Cloudflare Worker secret — never exposed to the frontend.
- All wallet interactions use `wallet.sendTransaction()` from `@solana/wallet-adapter` following Solana's recommended standards.
- CORS on the Cloudflare Worker is restricted to whitelisted origins only.
- Firebase rules allow read/create from the client but not delete — only the Worker (via Firebase Admin SDK) can remove orders after on-chain confirmation.

---


## About

Built by **[Polaris Fuel Alliance](https://polarisfuel.app)** — tools for the Valannia community.

This project is not affiliated with or endorsed by the Valannia team. It is an independent community tool built on top of Valannia's public API.

---

## License

MIT — free to use, modify and distribute.
