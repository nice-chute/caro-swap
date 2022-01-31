import React, { useState, useEffect, useCallback } from 'react';
import { Connection, PublicKey, Keypair, clusterApiUrl, LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
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
import { Anchor } from 'react-bootstrap';
require('@solana/wallet-adapter-react-ui/styles.css');

// http
const { metadata: { Metadata } } = programs;

// Globals
const carolineVault = new PublicKey("99nL9LcHaybrPXTQx7aJxKLr2gqCg3MWcCpJX1HtrM3N");
const probPool = new PublicKey("F1YEX86sK22Ns2oBM8VNXMy93tt11iQWozkNqTU8yzGS")
const swapFee = new anchor.BN(25);
const wallets = [getPhantomWallet()]
const network = clusterApiUrl('devnet');
// const network = "https://ssc-dao.genesysgo.net/"
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
          // const pda = await Metadata.getPDA(tokenAccountMint);
          // const metadata = await Metadata.load(provider.connection, pda);
          // let uri = metadata.data.data.uri
          // const { data } = await axios.get(uri);
          // Todo: handle non metaplex nfts
          wallet_nfts.push({ "pubkey": pubkey, "mint": tokenAccountMint })
        }
        catch (err) {
          console.log(err)
        }
      }
    }
    setWalletNfts({ 'wallet_nfts': wallet_nfts })
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
        console.log(accounts[i].pubkey.toBase58())
        let listing = await program.account.probPool.fetch(accounts[i].pubkey);
        // Metaplex data
        // const pda = await Metadata.getPDA(listing.nftMint);
        // const metadata = await Metadata.load(provider.connection, pda);
        // let uri = metadata.data.data.uri
        // const { data } = await axios.get(uri);
        // Todo: handle non metaplex nfts
        listings.push({ "listing": listing })
        // user listing
        if (listing.authority.equals(provider.wallet.publicKey)) {
          user_listings.push({ "listing": listing })
        }
      }
      catch (err) {
        console.log(err)
      }
    }
    setListings({ 'activeListings': listings, 'userListings': user_listings });
  });

  function NFTCard({ props }) {
    console.log(props)
    // Listing price
    const [solAmount, setSolAmount] = useState("");
    const [probAmount, setProbAmount] = useState("");

    async function handleClick() {
      try {
        let splAmount = new anchor.BN(solAmount * LAMPORTS_PER_SOL)
        let ptokenAmount = new anchor.BN(probAmount)
        // Program
        const provider = await getProvider();
        const program = new Program(idl, programID, provider);

        const probPool = Keypair.generate();
        console.log("prob pool", probPool.publicKey.toBase58())

        // Nft account info for the card
        let nftAccount = props.pubkey;
        let nftMint = props.mint;

        // ptoken mint PDA
        let [ptokenMint, ptokenMintBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("mint")),
            probPool.publicKey.toBuffer(),
          ],
          program.programId
        );
        // ptoken mint PDA
        let [nftVault, nftVaultBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("vault")),
            nftMint.toBuffer(),
            probPool.publicKey.toBuffer(),
          ],
          program.programId
        );
        // SPL vault PDA
        let [splVault, splVaultBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("vault")),
            NATIVE_MINT.toBuffer(),
            probPool.publicKey.toBuffer()
          ],
          program.programId
        );
        // ptoken vault PDA
        let [ptokenVault, ptokenVaultBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("vault")),
            ptokenMint.toBuffer(),
            probPool.publicKey.toBuffer()
          ],
          program.programId
        );

        console.log(program.programId.toBase58())
        // Create listing
        const tx = await program.rpc.createPool(
          swapFee,
          splAmount,
          ptokenAmount,
          splVaultBump,
          nftVaultBump,
          ptokenVaultBump,
          ptokenMintBump,
          {
            accounts: {
              signer: provider.wallet.publicKey,
              nftAccount: nftAccount,
              probPool: probPool.publicKey,
              ptokenMint: ptokenMint,
              nftVault: nftVault,
              splVault: splVault,
              ptokenVault: ptokenVault,
              nftMint: nftMint,
              nativeMint: NATIVE_MINT,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              rent: SYSVAR_RENT_PUBKEY
            },
            signers: [probPool]
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
            <div>{props.mint.toBase58()}</div>
            <Card.Img className="nft" src="https://arweave.net/ea_ljlyWitQgwXiMiqDnhNKjEIw6d2p3UysObHyWCKE" />
          </Container>
          <Card.Body className="card-body justify-content-center">
            <div className="input-group mb-3">
              <input type="text" className="form-control" min="0" placeholder="SOL" value={solAmount} onChange={event => {
                setSolAmount(event.target.value);
              }}
              ></input>
              <input type="text" className="form-control" min="0" placeholder="Prob" value={probAmount} onChange={event => {
                setProbAmount(event.target.value);
              }}
              ></input>
            </div>
            <button className="btn btn-outline-secondary" type="button" onClick={(e) => handleClick()}>Create Pool</button>

          </Card.Body>
        </Card>
      );
    }
  }

  function ListingCard({ props }) {
    console.log('listing props', props)
    const [probAmount, setProbAmount] = useState("");

    const [solCost, setSolCost] = useState("");
    const [probWin, setProbWin] = useState("");


    function probChange(e) {
      if (e > 1000 || e < 0) {
        setProbAmount('')
        setSolCost('')
        setProbWin('')
      }
      else {
        setProbAmount(e)
        let k = props.listing.ptokenSupply * props.listing.splSupply
        let new_spl_amount = k / (props.listing.ptokenSupply - e)
        let solCost = (new_spl_amount - props.listing.splSupply) / LAMPORTS_PER_SOL
        setSolCost(Math.round(solCost * 10000) / 10000)
        setProbWin(e / props.listing.ptokenSupply)
      }
    }
    // Buy nft
    async function handleClick() {
      console.log("click")
      try {
        // Program
        const provider = await getProvider();
        const program = new Program(idl, programID, provider);
        // Accounts + Params
        let ptokenAmount = new anchor.BN(probAmount)

        // ptoken mint PDA
        let [ptokenMint, ptokenMintBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("mint")),
            probPool.toBuffer(),
          ],
          program.programId
        );
        // Caroline SPL vault PDA
        let [carolineVault, carolineVaultBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("vault")),
            NATIVE_MINT.toBuffer(),
          ],
          program.programId
        );
        // User pool ptoken vault
        let [userPtokenVault, userPtokenVaultBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("vault")),
            ptokenMint.toBuffer(),
            probPool.toBuffer(),
            provider.wallet.publicKey.toBuffer()
          ],
          program.programId
        );
        // ptoken vault PDA
        let [ptokenVault, ptokenVaultBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("vault")),
            ptokenMint.toBuffer(),
            probPool.toBuffer()
          ],
          program.programId
        );
        // SPL vault PDA
        let [splVault, splVaultBump] = await PublicKey.findProgramAddress(
          [
            Buffer.from(anchor.utils.bytes.utf8.encode("vault")),
            NATIVE_MINT.toBuffer(),
            probPool.toBuffer()
          ],
          program.programId
        );

        // Buy ptokens
        const tx = await program.rpc.buy(
          ptokenAmount,
          carolineVaultBump,
          userPtokenVaultBump,
          ptokenMintBump,
          ptokenVaultBump,
          {
            accounts: {
              signer: provider.wallet.publicKey,
              splVault: splVault,
              ptokenVault: ptokenVault,
              probPool: probPool,
              carolineVault: carolineVault,
              userPtokenVault: userPtokenVault,
              ptokenMint: ptokenMint,
              nativeMint: NATIVE_MINT,
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

    return (
      <Card className="card">
        <div className="nft-price inline">
          <img
            alt=""
            src="../Greek_lc_mu.svg"
            width="20"
            height="20"
            className="d-inline-block"
          />{' '}
          {props.listing.ptokenSupply.toNumber()}
        </div>
        <Container>
          <Card.Img className="nft" src="https://arweave.net/ea_ljlyWitQgwXiMiqDnhNKjEIw6d2p3UysObHyWCKE" />
        </Container>
        <Card.Body className="card-body justify-content-center">
          <div className="input-group mb-3">
            <input type="text" className="form-control" min="0" type="number" max="999" placeholder="Prob to buy" value={probAmount} onChange={event => {
              probChange(event.target.value);
            }}
            ></input>
          </div>
          <div>
            <img
              alt=""
              src="../sol.svg"
              width="20"
              height="20"
              className="d-inline-block"
            />{' '}{solCost}</div>
          <div></div>
          <div>
            <img
              alt=""
              src="../Greek_lc_epsilon.svg"
              width="25"
              height="25"
              className="d-inline-block"
            />{' '}{solCost * probWin}</div>
          <div>
            <img
              alt=""
              src="../percentage-sign.svg"
              width="20"
              height="20"
              className="d-inline-block"
            />{' '}
            {probWin}</div>
          <Button className="submit-btn" onClick={() => handleClick()}>Buy</Button>
        </Card.Body>
      </Card>
    );
  }

  function UserListingCard({ props }) {
    const [listingPrice, setListingPrice] = useState("");
    // close listing
    async function handleClose() {
      console.log("click")
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
          {props.listing.splSupply.toNumber() / (props.listing.ptokenSupply.toNumber() * LAMPORTS_PER_SOL)}
        </div>
        <div className="nft-price inline">
          <img
            alt=""
            src="../percentage-sign.svg"
            width="15"
            height="15"
            className="d-inline-block"
          />{' '}
          {1 / (props.listing.ptokenSupply.toNumber())}
        </div>
        <div className="nft-price inline">
          <img
            alt=""
            src="../Greek_lc_mu.svg"
            width="25"
            height="25"
            className="d-inline-block"
          />{' '}
          {props.listing.ptokenSupply.toNumber()}
        </div>
        <Container>
          <Card.Img className="nft" src="https://arweave.net/ea_ljlyWitQgwXiMiqDnhNKjEIw6d2p3UysObHyWCKE" />
        </Container>
        <Card.Body className="card-body justify-content-center">
          <button className="close-btn" type="button" onClick={(e) => handleClose()}>Close Pool</button>
        </Card.Body>
      </Card>
    );
  }

  function ActiveListings({ props }) {
    console.log(props)
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
    console.log(props)
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
            {props.wallet_nfts.map((acc, idx) => (
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