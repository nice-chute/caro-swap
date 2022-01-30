import { Program, Provider, web3 } from '@project-serum/anchor';
import * as anchor from '@project-serum/anchor';
import {
    PublicKey, Keypair, SystemProgram, Transaction, TransactionInstruction, LAMPORTS_PER_SOL,
    SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
    SYSVAR_RENT_PUBKEY, clusterApiUrl, Connection
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, Token, NATIVE_MINT, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idl from '../idl.json';

let marketFee = new anchor.BN(25); // 2.5%

const network = clusterApiUrl('devnet');
const opts = {
    preflightCommitment: "processed"
}
const provider = anchor.Provider.env();

let array = Uint8Array.from([118, 171, 232, 184, 36, 164, 170, 155, 71, 113, 117, 121, 78, 201, 43, 7, 11, 252, 22, 181, 92, 139, 42, 107, 243, 216, 27, 66, 51, 5, 205, 119, 118, 51, 174, 59, 158, 44, 73, 9, 142, 82, 216, 91, 132, 186, 196, 117, 131, 112, 237, 1, 254, 241, 92, 111, 190, 124, 3, 229, 56, 221, 221, 6])
let wallet = Keypair.fromSecretKey(array)
console.log(wallet)

let market = Keypair.generate()
console.log(wallet.publicKey.toBase58())
const programID = new PublicKey(idl.metadata.address);

const program = new Program(idl as anchor.Idl, programID, provider);

const account = async () => {
    // Lamport vault PDA
    let [lamportVault, lamportVaultBump] = await PublicKey.findProgramAddress(
        [
            Buffer.from(anchor.utils.bytes.utf8.encode("vault")),
            market.publicKey.toBuffer(),
            NATIVE_MINT.toBuffer(),
        ],
        program.programId
    );
    const tx = await program.rpc.createMarket(
        marketFee,
        lamportVaultBump,
        {
            accounts: {
                signer: wallet.publicKey,
                market: market.publicKey,
                marketVault: lamportVault,
                nativeMint: NATIVE_MINT,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: SYSVAR_RENT_PUBKEY
            },
            signers: [wallet, market]
        });
};
console.log(market.publicKey.toBase58())
account();