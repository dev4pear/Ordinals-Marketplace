import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { useBalance } from "./hooks/useBalance";
import { useSend } from "./hooks/useSend";
import { OrdConnectKit, useSign } from "./index";
import { OrdConnectProvider, useOrdContext } from "./providers/OrdContext.tsx";
import { signTransaction } from "sats-connect";
import "./style.css";
import { SignPsbtOptionsParams } from "./lib/signPsbt";
import { getUtxosByAddress, FullnodeRPC, SellerSigner, BuyerSigner, mapUtxos } from "@magiceden-oss/msigner";

function SampleComponent() {
  const { address, network, publicKey, format, safeMode, wallet } =
    useOrdContext();
  const [send, error, loading] = useSend();
  const { getBalance, getUTXOs } = useBalance();
  const [sign] = useSign();
  const [result, setResult] = React.useState("");
  const [balance, setBalance] = React.useState(0);

  const [areaText, setAreaText] = useState("");

  const ordItem = {
    id: "3be20401702ab90291b92e9ba7e15d93ed25c24ea7592068e4dfc871f94ad7dfi0",
    contentURI:
      "https://testnet.ordinals.com/content/3be20401702ab90291b92e9ba7e15d93ed25c24ea7592068e4dfc871f94ad7dfi0",
    contentType: "text/plain;charset=utf-8",
    contentPreviewURI:
      "https://testnet.ordinals.com/preview/3be20401702ab90291b92e9ba7e15d93ed25c24ea7592068e4dfc871f94ad7dfi0",
    sat: 1360552204278130,
    satName: "Bitcoin Sat",
    genesisTransaction:
      "3be20401702ab90291b92e9ba7e15d93ed25c24ea7592068e4dfc871f94ad7df",
    genesisTransactionBlockTime: "2023-10-16 21:56:32 UTC",
    inscriptionNumber: 379532,
    chain: "btc-testnet",
    location:
      "3be20401702ab90291b92e9ba7e15d93ed25c24ea7592068e4dfc871f94ad7df:0:0",
    output:
      "3be20401702ab90291b92e9ba7e15d93ed25c24ea7592068e4dfc871f94ad7df:0",
    outputValue: 10000,
    owner: "tb1quz3u3vt9rvtmu9xm84gcs6j666fa84ljwgjxe7",
    listed: false,
    postage: 10000,
    offset: 0,
  };

  const [listing, setListing] = useState<any>({
    seller: {
      makerFeeBp: 0,
      sellerOrdAddress: "",
      price: 20000,
      ordItem: ordItem,
      sellerReceiveAddress: "",
      feeRate: 0,
    },
    buyer: {},
  });

  const [buying, setBuying] = useState<any>({
    seller: {},
    buyer: {
      takerFeeBp: 1,
      buyerAddress: "",
      buyerTokenReceiveAddress: "",
      feeRateTier: "High",
      platformFeeAddress: "tb1qtxvwypw27plxvvl9saxd2j3v0u4x3kesymgnzx",
      feeRate: 0.2,
    },
  });

  const handleClickSellerSign = async (e: React.MouseEvent) => {
    e.preventDefault();
    let newListing = listing;
    newListing.seller.sellerOrdAddress = address.payments;
    newListing.seller.sellerReceiveAddress = address.payments;
    newListing = await SellerSigner.generateUnsignedListingPSBTBase64(listing);

    let options: SignPsbtOptionsParams = { finalize: false, extractTx: false };
    let signedPSBT = await sign(
      "tb1quz3u3vt9rvtmu9xm84gcs6j666fa84ljwgjxe7",
      newListing.seller.unsignedListingPSBTBase64,
      options
    );
    newListing.seller.signedListingPSBTHex = signedPSBT.hex;
    newListing.seller.signedListingPSBTBase64 = Buffer.from(
      signedPSBT.hex,
      "hex"
    ).toString("base64");
    console.log(newListing);
    setListing(newListing);
    setAreaText(JSON.stringify(newListing));
  };

  const handleClickBuyerSign = async (e) => {
    e.preventDefault();
    let newBuying = buying;
    newBuying.seller = JSON.parse(areaText).seller;
    newBuying.buyer.buyerAddress = address.payments;
    newBuying.buyer.buyerTokenReceiveAddress = address.payments;
    console.log("newBying :>> ", newBuying);
    console.log("listing :>> ", newBuying);
    console.log("address :>> ", address);
    const utxosFromMempool = await getUtxosByAddress(address.payments);
    utxosFromMempool.sort((a, b) => b.value - a.value);
    const utxos = await mapUtxos(utxosFromMempool);
    console.log("utxos :>> ", utxos);

    newBuying.buyer.buyerDummyUTXOs = utxos.slice(1, 3);
    newBuying.buyer.buyerPaymentUTXOs = utxos.slice(0, 1);
    newBuying = await BuyerSigner.generateUnsignedBuyingPSBTBase64(newBuying);
    setBuying(newBuying);
    let options: SignPsbtOptionsParams = { finalize: false, extractTx: false };
    const signedPSBT = await sign(
      "tb1qnh7t7lvahnd2msts5l84jxcxleent9qtdtt0fp",
      newBuying.buyer.unsignedBuyingPSBTBase64,
      options
    );
    newBuying.buyer.signedBuyingPSBTBase64 = Buffer.from(
      signedPSBT.hex,
      "hex"
    ).toString("base64");
    const mergedPsbtBase64 = BuyerSigner.mergeSignedBuyingPSBTBase64(
      newBuying.seller.signedListingPSBTBase64,
      newBuying.buyer.signedBuyingPSBTBase64
    );
    console.log("mergedPsbtBase64", mergedPsbtBase64);
    const tx = await FullnodeRPC.finalizepsbt(mergedPsbtBase64);
    console.log("txHex :>> ", tx.hex);
    const res = await FullnodeRPC.sendrawtransaction(tx.hex);
    console.log('res :>> ', res);
    console.log(newBuying);
    setBuying(newBuying);
  };

  return (
    <div>
      <span>{balance > 0 && `Wallet Balance: ${balance}`}</span>
      <span>{address && `Connected Address: ${address.ordinals}`}</span>
      <span>{result && `Transaction ID: ${result}`}</span>
      <span>{error && `Error: ${error}`}</span>
      <span>{loading && `Loading`}</span>
      <button
        type="button"
        onClick={async () => {
          const txId = await send(
            "tb1qgypdud5xr0x0wugf5yv62z03ytkwxusjwsr9kq",
            1000,
            10
          );
          if (typeof txId === "string") {
            setResult(txId);
          }
        }}
      >
        Send money
      </button>
      <button
        type="button"
        onClick={async () => {
          const walletBalance = await getBalance();
          if (typeof walletBalance === "number") {
            setBalance(walletBalance);
          }
        }}
      >
        Check balance
      </button>
      <button
        type="button"
        onClick={async () => {
          const signed = await sign(
            address.payments,
            "cHNidP8BAFICAAAAARXJoLPdXB0nA98DsK0PaC5ABbmJbxKPAZ+WUvKJYgieAAAAAAD/////AaRCDwAAAAAAFgAUQQLeNoYbzPdxCaEZpQnxIuzjchIAAAAAAAEBH2QAAAAAAAAAFgAUQQLeNoYbzPdxCaEZpQnxIuzjchIBAwSDAAAAAAA=",
            { extractTx: false }
          );
          console.log(signed);
        }}
      >
        Sign PSBT
      </button>

      <button
        value="seller_signal"
        className="myButton"
        onClick={handleClickSellerSign}
      >
        SELLER SIGNAL
      </button>
      <button
        value="buyer_signal"
        className="myButton"
        onClick={handleClickBuyerSign}
      >
        BUYER SIGNAL
      </button>
      <textarea
        value={areaText}
        onChange={(e) => setAreaText(e.target.value)}
        style={{ width: "100%", height: "100px" }}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <OrdConnectProvider initialNetwork="testnet" initialSafeMode>
      <SampleComponent />
      <OrdConnectKit />
    </OrdConnectProvider>
  </React.StrictMode>
);
