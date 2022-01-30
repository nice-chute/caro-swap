var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { WalletNotConnectedError, WalletNotReadyError, } from '@solana/wallet-adapter-base';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WalletNotSelectedError } from './errors';
import { useLocalStorage } from './useLocalStorage';
import { WalletContext } from './useWallet';
const initialState = {
    wallet: null,
    adapter: null,
    ready: false,
    publicKey: null,
    connected: false,
};
export const WalletProvider = ({ children, wallets, autoConnect = false, onError, localStorageKey = 'walletName', }) => {
    const [name, setName] = useLocalStorage(localStorageKey, null);
    const [{ wallet, adapter, ready, publicKey, connected }, setState] = useState(initialState);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const isConnecting = useRef(false);
    const isDisconnecting = useRef(false);
    const isUnloading = useRef(false);
    // Map of wallet names to wallets
    const walletsByName = useMemo(() => wallets.reduce((walletsByName, wallet) => {
        walletsByName[wallet.name] = wallet;
        return walletsByName;
    }, {}), [wallets]);
    // When the selected wallet changes, initialize the state
    useEffect(() => {
        const wallet = (name && walletsByName[name]) || null;
        const adapter = wallet && wallet.adapter;
        if (adapter) {
            const { publicKey, connected } = adapter;
            setState({ wallet, adapter, connected, publicKey, ready: false });
            // Asynchronously update the ready state
            const waiting = name;
            (function () {
                return __awaiter(this, void 0, void 0, function* () {
                    const ready = yield adapter.ready();
                    // If the selected wallet hasn't changed while waiting, update the ready state
                    if (name === waiting) {
                        setState((state) => (Object.assign(Object.assign({}, state), { ready })));
                    }
                });
            })();
        }
        else {
            setState(initialState);
        }
    }, [name, walletsByName, setState]);
    // If autoConnect is enabled, try to connect when the adapter changes and is ready
    useEffect(() => {
        if (isConnecting.current || connecting || connected || !autoConnect || !adapter || !ready)
            return;
        (function () {
            return __awaiter(this, void 0, void 0, function* () {
                isConnecting.current = true;
                setConnecting(true);
                try {
                    yield adapter.connect();
                }
                catch (error) {
                    // Clear the selected wallet
                    setName(null);
                    // Don't throw error, but handleError will still be called
                }
                finally {
                    setConnecting(false);
                    isConnecting.current = false;
                }
            });
        })();
    }, [isConnecting, connecting, connected, autoConnect, adapter, ready, setConnecting, setName]);
    // If the window is closing or reloading, ignore disconnect and error events from the adapter
    useEffect(() => {
        function listener() {
            isUnloading.current = true;
        }
        window.addEventListener('beforeunload', listener);
        return () => window.removeEventListener('beforeunload', listener);
    }, [isUnloading]);
    // Select a wallet by name
    const select = useCallback((walletName) => __awaiter(void 0, void 0, void 0, function* () {
        if (name === walletName)
            return;
        if (adapter)
            yield adapter.disconnect();
        setName(walletName);
    }), [name, adapter, setName]);
    // Handle the adapter's connect event
    const handleConnect = useCallback(() => {
        if (!adapter)
            return;
        const { connected, publicKey } = adapter;
        setState((state) => (Object.assign(Object.assign({}, state), { connected, publicKey })));
    }, [adapter, setState]);
    // Handle the adapter's disconnect event
    const handleDisconnect = useCallback(() => {
        // Clear the selected wallet unless the window is unloading
        if (!isUnloading.current)
            setName(null);
    }, [isUnloading, setName]);
    // Handle the adapter's error event, and local errors
    const handleError = useCallback((error) => {
        // Call onError unless the window is unloading
        if (!isUnloading.current) {
            (onError || console.error)(error);
        }
        return error;
    }, [isUnloading, onError]);
    // Connect the adapter to the wallet
    const connect = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        if (isConnecting.current || connecting || disconnecting || connected)
            return;
        if (!wallet || !adapter)
            throw handleError(new WalletNotSelectedError());
        if (!ready) {
            // Clear the selected wallet
            setName(null);
            if (typeof window !== 'undefined') {
                window.open(wallet.url, '_blank');
            }
            throw handleError(new WalletNotReadyError());
        }
        isConnecting.current = true;
        setConnecting(true);
        try {
            yield adapter.connect();
        }
        catch (error) {
            // Clear the selected wallet
            setName(null);
            // Rethrow the error, and handleError will also be called
            throw error;
        }
        finally {
            setConnecting(false);
            isConnecting.current = false;
        }
    }), [
        isConnecting,
        connecting,
        disconnecting,
        connected,
        wallet,
        adapter,
        handleError,
        ready,
        setConnecting,
        setName,
    ]);
    // Disconnect the adapter from the wallet
    const disconnect = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        if (isDisconnecting.current || disconnecting)
            return;
        if (!adapter)
            return setName(null);
        isDisconnecting.current = true;
        setDisconnecting(true);
        try {
            yield adapter.disconnect();
        }
        catch (error) {
            // Clear the selected wallet
            setName(null);
            // Rethrow the error, and handleError will also be called
            throw error;
        }
        finally {
            setDisconnecting(false);
            isDisconnecting.current = false;
        }
    }), [isDisconnecting, disconnecting, adapter, setDisconnecting, setName]);
    // Send a transaction using the provided connection
    const sendTransaction = useCallback((transaction, connection, options) => __awaiter(void 0, void 0, void 0, function* () {
        if (!adapter)
            throw handleError(new WalletNotSelectedError());
        if (!connected)
            throw handleError(new WalletNotConnectedError());
        return yield adapter.sendTransaction(transaction, connection, options);
    }), [adapter, handleError, connected]);
    // Sign a transaction if the wallet supports it
    const signTransaction = useMemo(() => adapter && 'signTransaction' in adapter
        ? (transaction) => __awaiter(void 0, void 0, void 0, function* () {
            if (!connected)
                throw handleError(new WalletNotConnectedError());
            return yield adapter.signTransaction(transaction);
        })
        : undefined, [adapter, handleError, connected]);
    // Sign multiple transactions if the wallet supports it
    const signAllTransactions = useMemo(() => adapter && 'signAllTransactions' in adapter
        ? (transactions) => __awaiter(void 0, void 0, void 0, function* () {
            if (!connected)
                throw handleError(new WalletNotConnectedError());
            return yield adapter.signAllTransactions(transactions);
        })
        : undefined, [adapter, handleError, connected]);
    // Sign an arbitrary message if the wallet supports it
    const signMessage = useMemo(() => adapter && 'signMessage' in adapter
        ? (message) => __awaiter(void 0, void 0, void 0, function* () {
            if (!connected)
                throw handleError(new WalletNotConnectedError());
            return yield adapter.signMessage(message);
        })
        : undefined, [adapter, handleError, connected]);
    // Setup and teardown event listeners when the adapter changes
    useEffect(() => {
        if (adapter) {
            adapter.on('connect', handleConnect);
            adapter.on('disconnect', handleDisconnect);
            adapter.on('error', handleError);
            return () => {
                adapter.off('connect', handleConnect);
                adapter.off('disconnect', handleDisconnect);
                adapter.off('error', handleError);
            };
        }
    }, [adapter, handleConnect, handleDisconnect, handleError]);
    return (React.createElement(WalletContext.Provider, { value: {
            wallets,
            autoConnect,
            wallet,
            adapter,
            publicKey,
            ready,
            connected,
            connecting,
            disconnecting,
            select,
            connect,
            disconnect,
            sendTransaction,
            signTransaction,
            signAllTransactions,
            signMessage,
        } }, children));
};
//# sourceMappingURL=WalletProvider.js.map