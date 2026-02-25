import { Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Buffer } from 'buffer';

// 1. Generar la Burner Wallet a partir de una firma
export const deriveBurner = async (walletAdapter) => {
    const message = "Autorizo la activación del Mayordomo de Valannia para esta sesión.";
    const encodedMessage = new TextEncoder().encode(message);
    
    // El usuario firma (Gratis)
    const signature = await walletAdapter.signMessage(encodedMessage);
    
    // Usamos la firma como semilla para que sea SIEMPRE la misma wallet
    const seed = signature.slice(0, 32);
    const burner = Keypair.fromSeed(seed);
    
    return burner;
};

// 2. Función para enviar SOL (o luego adaptarla a Items)
export const sendGasToBurner = async (connection, fromWallet, toBurnerPubkey, amount) => {
    const transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: fromWallet,
            toPubkey: toBurnerPubkey,
            lamports: amount * LAMPORTS_PER_SOL,
        })
    );
    
    const signature = await connection.sendTransaction(transaction, connection);
    return signature;
};