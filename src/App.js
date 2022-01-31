import React, { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, NATIVE_MINT } from "@solana/spl-token";
import {
  Program, Provider, web3
} from '@project-serum/anchor';
import idl from './idl.json';
import * as anchor from "@project-serum/anchor";

// Wallet adapter
import { getPhantomWallet } from '@solana/wallet-adapter-wallets';
import { useWallet, WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';

import { programs } from '@metaplex/js';

// Bootstrap components
import Container from 'react-bootstrap/Container';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Card from 'react-bootstrap/Card';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Spinner from 'react-bootstrap/Spinner'
import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
// https
import axios from 'axios';

// CSS
import './App.css';
require('@solana/wallet-adapter-react-ui/styles.css');

// http
const { metadata: { Metadata } } = programs;

// Globals
const market = new PublicKey("33Tz73Cng8inaqTxGhv2HT2bZkip2axJJSEsa9B21ZR7");
const wallets = [getPhantomWallet()]
//const network = clusterApiUrl('devnet');
const network = "https://ssc-dao.genesysgo.net/"
const opts = {
  preflightCommitment: "processed"
}
const programID = new PublicKey(idl.metadata.address);
const { SystemProgram } = web3;

function App() {
  // Wallet NFTs
  const [walletNfts, setWalletNfts] = useState([]);
  // Listings on market
  const [listings, setListings] = useState([]);
  // Wallet connected
  const wallet = useWallet()
  // Connection to Solana rpc
  async function getProvider() {
    const connection = new Connection(network, opts.preflightCommitment);
    const provider = new Provider(
      connection, wallet, opts.preflightCommitment,
    );
    return provider;
  }
  // App render
  useEffect(() => {
    (async () => {
      if (
        !wallet ||
        !wallet.publicKey
      ) {
        return;
      }
      // Listings
      fetchListings().catch(console.error);
      // Wallet NFTs
      fetchWalletNfts().catch(console.error);
    })();
  }, [wallet]);

  // Fetch wallet's nfts
  const fetchWalletNfts = useCallback(async () => {
    const provider = await getProvider();
    // // TODO: This is slow
    let tokenAccounts = await provider.connection.getParsedTokenAccountsByOwner(provider.wallet.publicKey, { programId: TOKEN_PROGRAM_ID });
    let wallet_nfts = []
    for (let i = 0; i < tokenAccounts.value.length; i++) {
      let pubkey = tokenAccounts.value[i].pubkey
      let tokenAccountMint = new PublicKey(tokenAccounts.value[i].account.data.parsed.info.mint);
      let tokenBalance = parseInt(tokenAccounts.value[i].account.data.parsed.info.tokenAmount.amount);
      // NFT
      if (tokenBalance === 1) {
        // Metaplex data
        try {
          const pda = await Metadata.getPDA(tokenAccountMint);
          const metadata = await Metadata.load(provider.connection, pda);
          let uri = metadata.data.data.uri
          const { data } = await axios.get(uri);
          // Todo: handle non metaplex nfts
          wallet_nfts.push({ "pubkey": pubkey, "mint": tokenAccountMint, "data": data })
        }
        catch (err) {
          console.log(err)
        }
      }
    }
    setWalletNfts(wallet_nfts)

  });

  const fetchListings = useCallback(async () => {
    const provider = await getProvider();
    const program = new Program(idl, programID, provider);
    let listings = []
    let user_listings = []
    let accounts = await provider.connection.getProgramAccounts(program.programId);
    for (let i = 0; i < accounts.length; i++) {
      // Try to fetch the listing account, throws error if its not a listing
      try {
        let listing = await program.account.listing.fetch(accounts[i].pubkey);
        // Metaplex data
        try {
          const pda = await Metadata.getPDA(listing.nftMint);
          const metadata = await Metadata.load(provider.connection, pda);
          let uri = metadata.data.data.uri
          const { data } = await axios.get(uri);
          // Todo: handle non metaplex nfts
          listings.push({ "listing": listing, "metadata": data })
          // user listing
          if (listing.seller.equals(provider.wallet.publicKey)) {
            user_listings.push({ "listing": listing, "metadata": data })
          }
        }
        catch (err) {
          console.log(err)
        }
      }
      catch (err) {
      }
    }
    setListings({ 'activeListings': listings, 'userListings': user_listings });
  });

  function NFTCard({ props }) {
    // Listing price
    const [listingPrice, setListingPrice] = useState("");
    async function handleClick() {
      try {
        let price = new anchor.BN(listingPrice * LAMPORTS_PER_SOL)
        // Program
        const provider = await getProvider();
        const program = new Program(idl, programID, provider);

        // Nft account info for the card
        let nftAccount = props.pubkey;
        let nftMint = props.mint;
        // Listing PDA
        let [listing, listingBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("listing")),
            market.toBuffer(),
            nftMint.toBuffer(),
            provider.wallet.publicKey.toBuffer(),
          ],
          program.programId
        );
        // NFT vault PDA
        let [nftVault, nftVaultBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("vault")),
            nftMint.toBuffer(),
          ],
          program.programId
        );
        // Create listing
        const tx = await program.rpc.createListing(
          price,
          listingBump,
          nftVaultBump,
          {
            accounts: {
              signer: provider.wallet.publicKey,
              listing: listing,
              market: market,
              nftVault: nftVault,
              nftAccount: nftAccount,
              nftMint: nftMint,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: SYSVAR_RENT_PUBKEY
            },
            signers: []
          });
        console.log(tx)
      }
      catch (err) {
        console.log(err)
      }
    }

    if (Object.keys(props).length === 0 && props.constructor === Object) {
      return (
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      )
    }
    else {
      return (
        <Card className="card">
          <Container>
            <Card.Img className="nft" src={props.data.image} />
          </Container>
          <Card.Body className="card-body justify-content-center">
            <div className="input-group mb-3">
              <input type="text" className="form-control" min="0" placeholder="SOL" value={listingPrice} onChange={event => {
                setListingPrice(event.target.value);
              }}
              ></input>
              <div className="input-group-append">
                <button className="btn btn-outline-secondary" type="button" onClick={(e) => handleClick()}>List</button>
              </div>
            </div>
          </Card.Body>
        </Card>
      );
    }
  }

  function ListingCard({ props }) {
    // Buy nft
    async function handleClick() {
      try {
        // Program
        const provider = await getProvider();
        const program = new Program(idl, programID, provider);
        // Mint + market
        let nftMint = new PublicKey(props.nftMint);
        let market = new PublicKey(props.market)
        let buyerNFTAcc = Keypair.generate();
        // Listing PDA
        let [listing, listingBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("listing")),
            market.toBuffer(),
            props.nftMint.toBuffer(),
            props.seller.toBuffer(),
          ],
          program.programId
        );
        // Market vault PDA
        let [marketVault, marketVaultBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("vault")),
            market.toBuffer(),
            NATIVE_MINT.toBuffer(),
          ],
          program.programId
        );
        // NFT vault PDA
        let [nftVault, nftVaultBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("vault")),
            nftMint.toBuffer(),
          ],
          program.programId
        );
        // Buy nft
        const tx = await program.rpc.buy(
          listingBump,
          marketVaultBump,
          nftVaultBump,
          {
            accounts: {
              signer: provider.wallet.publicKey,
              signerNftAcc: buyerNFTAcc.publicKey,
              listing: listing,
              seller: props.seller,
              market: market,
              marketVault: marketVault,
              nftVault: nftVault,
              nftMint: nftMint,
              nativeMint: NATIVE_MINT,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: SYSVAR_RENT_PUBKEY,
            },
            signers: [buyerNFTAcc]
          });
        console.log(tx)
      }
      catch (err) {
        console.log(err)
      }
    }

    return (
      <Card className="card">
        <div className="nft-price inline">
          <img
            alt=""
            src="../sol.svg"
            width="15"
            height="15"
            className="d-inline-block"
          />{' '}
          {props.listing.ask.toNumber() / LAMPORTS_PER_SOL}
        </div>
        <Container>
          <Card.Img className="nft" src={props.metadata.image} />
        </Container>
        <Card.Body className="card-body justify-content-center">
          <Button className="submit-btn" onClick={() => handleClick()}>Buy</Button>
        </Card.Body>
      </Card>
    );
  }

  function UserListingCard({ props }) {
    const [listingPrice, setListingPrice] = useState("");
    // close listing
    async function handleClose() {
      try {
        // Program
        const provider = await getProvider();
        const program = new Program(idl, programID, provider);

        let sellerNFTAcc = Keypair.generate();

        // Mint + market
        let nftMint = new PublicKey(props.listing.nftMint);
        let market = new PublicKey(props.listing.market)
        // Listing PDA
        let [listing, listingBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("listing")),
            market.toBuffer(),
            nftMint.toBuffer(),
            provider.wallet.publicKey.toBuffer(),
          ],
          program.programId
        );
        // NFT vault PDA
        let [nftVault, nftVaultBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("vault")),
            nftMint.toBuffer(),
          ],
          program.programId
        );
        // Close listing
        const tx = await program.rpc.closeListing(
          listingBump,
          nftVaultBump,
          {
            accounts: {
              signer: provider.wallet.publicKey,
              signerNftAcc: sellerNFTAcc.publicKey,
              nftVault: nftVault,
              listing: listing,
              market: market,
              nftMint: nftMint,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: SYSVAR_RENT_PUBKEY
            },
            signers: [sellerNFTAcc]
          });
        console.log(tx)
      }
      catch (err) {
        console.log(err)
      }

    }
    async function handleUpdate() {
      try {
        let price = new anchor.BN(listingPrice * LAMPORTS_PER_SOL)
        // Program
        const provider = await getProvider();
        const program = new Program(idl, programID, provider);

        // Mint + market
        let nftMint = new PublicKey(props.listing.nftMint);
        let market = new PublicKey(props.listing.market)
        // Listing PDA
        let [listing, listingBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("listing")),
            market.toBuffer(),
            nftMint.toBuffer(),
            provider.wallet.publicKey.toBuffer(),
          ],
          program.programId
        );
        // Update listing ask
        const tx = await program.rpc.ask(
          price,
          listingBump,
          {
            accounts: {
              signer: provider.wallet.publicKey,
              listing: listing,
              market: market,
              nftMint: nftMint,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
            },
            signers: []
          });
        console.log(tx)
      }
      catch (err) {
        console.log(err)
      }
    }

    return (
      <Card className="card">
        <div className="nft-price inline">
          <img
            alt=""
            src="../sol.svg"
            width="15"
            height="15"
            className="d-inline-block"
          />{' '}
          {props.listing.ask.toNumber() / LAMPORTS_PER_SOL}
        </div>
        <Container>
          <Card.Img className="nft" src={props.metadata.image} />
        </Container>
        <Card.Body className="card-body justify-content-center">
          <div className="input-group mb-3">
            <input type="text" className="form-control" min="0" placeholder="SOL" value={listingPrice} onChange={event => {
              setListingPrice(event.target.value);
            }}
            ></input>
            <div className="input-group-append">
              <button className="btn btn-outline-secondary" type="button" onClick={(e) => handleUpdate()}>Update</button>
            </div>
          </div>
          <button className="close-btn" type="button" onClick={(e) => handleClose()}>Close listing</button>
        </Card.Body>
      </Card>
    );
  }

  function ActiveListings({ props }) {
    if (props.length === 0) {
      return (
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      )
    }
    else {
      return (
        <Container className="card-container">
          <Row xs={"auto"} md={"auto"} className="row">
            {props.activeListings.map((listing, idx) => (
              <Col className="col top-buffer" key={idx}>
                <ListingCard props={listing} />
              </Col>
            ))}
          </Row>
        </Container >
      );
    }
  }

  function UserListings({ props }) {
    if (props.length === 0) {
      return (
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      )
    }
    else {
      return (
        <Container className="card-container">
          <Row xs={"auto"} md={"auto"} className="row">
            {props.userListings.map((listing, idx) => (
              <Col className="col top-buffer" key={idx}>
                <UserListingCard props={listing} />
              </Col>
            ))}
          </Row>
        </Container >
      );
    }
  }

  function UserNFTs({ props }) {
    if (Object.keys(walletNfts).length === 0) {
      return (
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      )
    }
    else {
      return (
        <Container className="card-container">
          <Row xs={"auto"} md={"auto"} className="row">
            {props.map((acc, idx) => (
              <Col className="col top-buffer" key={idx}>
                <NFTCard props={acc} />
              </Col>
            ))}
          </Row>
        </Container >
      );
    }
  }

  function Home() {
    return (
      <>
        <ActiveListings props={listings} />
      </>
    );
  }

  function Listings() {
    return (
      <>
        <UserListings props={listings} />
      </>
    );
  }

  function Wallet() {
    return (
      <>
        <UserNFTs props={walletNfts} />
      </>
    );
  }

  if (!wallet.connected) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>
        <WalletMultiButton />
      </div>
    )
  } else {
    return (
      <Container className="container-top">
        <Navbar sticky="top">
          <Container className="nav-container">
            <Navbar.Brand href="/">
              <img
                alt=""
                src="../small.png"
                height="75"
                className="logo d-inline-block align-middle"
              />{' '}
              <img
                alt=""
                src="../logo.png"
                width="190"
                height="25"
                className="logo-banner d-inline-block align-middle"
              />{' '}
            </Navbar.Brand>
            <Nav className="nav-middle">
              <Nav.Link href="/listings">My Listings</Nav.Link>
              <Nav.Link href="/wallet">Wallet</Nav.Link>
            </Nav>
            <a href="https://discord.gg/NJ8cvqPQ">
              <img
                alt=""
                src="../discord1.svg"
                width="35"
                height="35"
                className="logo-banner d-inline-block align-middle"
                href="https://discord.gg/NJ8cvqPQ"
              />{' '}
            </a>
          </Container>
        </Navbar >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/listings" element={<Listings />} />
        </Routes>
      </Container >
    );
  }
}

const AppWithProvider = () => (
  <ConnectionProvider endpoint={network}>
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <Router>
          <App />
        </Router>
      </WalletModalProvider>
    </WalletProvider>
  </ConnectionProvider>
)

export default AppWithProvider;