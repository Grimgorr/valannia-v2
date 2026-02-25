import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { ConnectionProvider, WalletProvider, useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { 
  createApproveInstruction, 
  createTransferInstruction, 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction 
} from '@solana/spl-token'; 
import { deriveBurner } from './logistics';
import { Buffer } from 'buffer';

import '@solana/wallet-adapter-react-ui/styles.css';

const VALAN_MINT = "5cL3TVJ7p5ZKqyx16DXwpdcNx5u19vQtWujA9vYindi";
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const JSON_URL = "https://f-bopb.github.io/valannia-inventory-tracker/data/valanniaTokens.json";

function extractTokens(obj, path = []) {
  let tokens = [];
  if (Array.isArray(obj)) {
    obj.forEach(item => tokens.push(...extractTokens(item, path)));
  } else if (typeof obj === 'object' && obj !== null) {
    if ((obj.address || obj.mint || obj.contract || obj.tokenAddress) && (obj.name || obj.title || obj.id)) {
      let addr = obj.address || obj.mint || obj.contract || obj.tokenAddress;
      let name = obj.name || obj.title || obj.id;
      let cat = obj.category || obj.type || (path.length > 0 ? path[0] : "General");
      let sub = obj.subcategory || obj.subtype || (path.length > 1 ? path[1] : "Variados");
      let img = obj.image || obj.icon || obj.img || ""; 
      tokens.push({ name, address: addr, category: cat, subcategory: sub, image: img });
    } else {
      for (let key in obj) { tokens.push(...extractTokens(obj[key], [...path, key])); }
    }
  }
  return tokens;
}

// ==========================================
// 1. COMPONENTE: BURN WALLET (PERSISTENTE)
// ==========================================
function PanelBurner({ burner, setBurner, refreshTrigger }) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [sol, setSol] = useState('...');
  const [valan, setValan] = useState('...');

  useEffect(() => {
    const savedKey = localStorage.getItem('valannia_burner_key');
    if (savedKey && !burner) {
      try {
        const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(savedKey)));
        setBurner(keypair);
      } catch (e) {
        console.error("Error cargando burner guardada", e);
      }
    }
  }, [setBurner, burner]);

  const handleActivate = async () => {
    try {
      const burnerKeypair = await deriveBurner(wallet);
      localStorage.setItem('valannia_burner_key', JSON.stringify(Array.from(burnerKeypair.secretKey)));
      setBurner(burnerKeypair);
    } catch (err) {
      alert("Error al activar: " + err.message);
    }
  };

  const borrarBurner = () => {
    // Seguridad mejorada: Confirmación escrita
    const confirmacion = prompt(
      "⚠️ ATENCIÓN: Estás a punto de borrar el de este navegador.\n\n" +
      "Si no tienes guardada la clave privada, perderás el acceso a los fondos (SOL/VALAN) que haya dentro.\n\n" +
      "Escribe 'BORRAR' para confirmar:"
    );

    if (confirmacion === "BORRAR") {
      localStorage.removeItem('valannia_burner_key');
      setBurner(null);
      alert("✅ Burn Wallet eliminada correctamente.");
    } else if (confirmacion !== null) {
      alert("❌ Confirmación incorrecta. La Burn Wallet NO ha sido borrada.");
    }
  };

  const fetchSaldos = useCallback(async () => {
    if (!burner) return;
    try {
      const pubkey = burner.publicKey;
      const lamports = await connection.getBalance(pubkey);
      setSol((lamports / 1e9).toFixed(4));
      const tokens = await connection.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_PROGRAM_ID });
      let valanAmt = 0;
      tokens.value.forEach(acc => {
        const info = acc.account.data.parsed.info;
        if (info.mint === VALAN_MINT) valanAmt += info.tokenAmount.uiAmount;
      });
      setValan(valanAmt);
    } catch (err) {}
  }, [burner, connection]);

  useEffect(() => {
    fetchSaldos();
    let interval = setInterval(fetchSaldos, 15000); 
    return () => clearInterval(interval);
  }, [fetchSaldos, refreshTrigger]);

  if (!wallet.connected && !burner) return null;

  return (
    <div style={{ background: '#1e293b', padding: '20px', borderRadius: '10px', marginBottom: '20px', border: '1px solid #00ffcc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
      <div style={{ textAlign: 'left' }}>
        <h3 style={{ margin: '0 0 5px 0', color: '#00ffcc' }}>🔥 Burn Wallet</h3>
        {burner ? (
           <>
             <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0, fontFamily: 'monospace' }}>ID: {burner.publicKey.toString()}</p>
             <button 
                onClick={borrarBurner} 
                style={{ background: 'transparent', color: '#ff4444', border: '1px solid #ff4444', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', marginTop: '10px' }}
             >
                🗑️ Borrar Burn Wallet
             </button>
           </>
        ) : (
           <>
             <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>No hay ninguna Burn Wallet vinculada en este navegador.</p>
             <button onClick={handleActivate} style={{ background: '#00aaff', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', marginTop: '10px', fontWeight: 'bold' }}>🚀 Crear Burn Wallet</button>
           </>
        )}
      </div>
      {burner && (
        <div style={{ display: 'flex', gap: '15px' }}>
          <div style={{ background: '#0f172a', padding: '10px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" width="20" height="20" alt="sol"/>
            <span style={{ color: '#ffcc00', fontWeight: 'bold' }}>{sol} SOL</span>
          </div>
          <div style={{ background: '#0f172a', padding: '10px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="https://portal.valannia.com/assets/logo-CM8aYtKK.webp" width="20" height="20" alt="valan"/>
            <span style={{ color: '#00ffff', fontWeight: 'bold' }}>{valan} VALAN</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. COMPONENTE: PANEL DERECHO (Inventario)
// ==========================================
function PanelMateriales({ data, onAddToCart }) {
  const { alias, direccion, agrupado, totalItems } = data;
  if (totalItems === 0) return (<div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '50px' }}><p>Vacío.</p></div>);
  return (
    <div style={{ textAlign: 'left' }}>
      <h3 style={{ color: '#00ffcc', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>📦 {alias}</h3>
      {Object.entries(agrupado).map(([catName, subcats]) => (
        <details key={catName} style={{ marginBottom: '10px' }}>
          <summary style={{ cursor: 'pointer', color: '#00ffcc' }}>📂 {catName}</summary>
          <div style={{ paddingLeft: '15px' }}>
            {Object.entries(subcats).map(([subName, items]) => (
              <details key={subName} style={{ marginBottom: '5px' }}>
                <summary style={{ cursor: 'pointer', color: '#ff99cc' }}>↳ 📁 {subName}</summary>
                {items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '12px', borderBottom: '1px solid #0f172a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {item.image && <img src={item.image} width="16" height="16" alt="img" style={{borderRadius: '2px'}}/>}
                      <span>{item.name}</span>
                    </div>
                    <div>
                      <span style={{color: '#00aaff', marginRight: '8px'}}>Disp: {item.cantidad}</span>
                      <input id={`qty-${direccion}-${item.address}`} type="number" defaultValue={1} style={{ width: '40px', background: '#0f172a', color: '#fff', border: '1px solid #334155', marginRight: '5px' }} />
                      <button onClick={() => {
                        const qty = parseInt(document.getElementById(`qty-${direccion}-${item.address}`).value);
                        onAddToCart({ origen: direccion, aliasOrigen: alias, item, cantidad: qty });
                      }} style={{ background: '#00cc66', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '3px', fontSize: '10px' }}>+ Añadir</button>
                    </div>
                  </div>
                ))}
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

// ==========================================
// 3. COMPONENTE: FILA CUENTA
// ==========================================
function CuentaFila({ cuenta, index, eliminarCuenta, tokensConfig, isActive, onSelect, onUpdateData, burner, refreshTrigger }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [sol, setSol] = useState('...');
  const [valan, setValan] = useState('...');

  const fetchSaldos = useCallback(async () => {
    try {
      const pubkey = new PublicKey(cuenta.direccion);
      const lamports = await connection.getBalance(pubkey);
      setSol((lamports / 1e9).toFixed(4));
      const tokens = await connection.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_PROGRAM_ID });
      const misBalances = {};
      let vAmt = 0;
      tokens.value.forEach(acc => {
        const info = acc.account.data.parsed.info;
        if (info.mint === VALAN_MINT) vAmt += info.tokenAmount.uiAmount;
        if (info.tokenAmount.uiAmount > 0) misBalances[info.mint] = info.tokenAmount.uiAmount;
      });
      setValan(vAmt);
      const mats = tokensConfig.filter(t => misBalances[t.address] && t.address !== VALAN_MINT).map(t => ({ ...t, cantidad: misBalances[t.address] }));
      const grouped = {};
      mats.forEach(m => {
        if (!grouped[m.category]) grouped[m.category] = {};
        if (!grouped[m.category][m.subcategory]) grouped[m.category][m.subcategory] = [];
        grouped[m.category][m.subcategory].push(m);
      });
      onUpdateData(cuenta.direccion, cuenta.alias, grouped, mats.length);
    } catch (e) {}
  }, [cuenta.direccion, connection, tokensConfig, onUpdateData]);

  useEffect(() => {
    fetchSaldos();
    let interval = setInterval(fetchSaldos, 30000); 
    return () => clearInterval(interval);
  }, [fetchSaldos, refreshTrigger]);

  const otorgarPermisos = async () => {
    if (!wallet.connected || wallet.publicKey.toBase58() !== cuenta.direccion) {
      alert("Conecta esta wallet en Solflare para dar permisos.");
      return;
    }
    try {
      const tx = new Transaction();
      const tokens = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, { programId: TOKEN_PROGRAM_ID });
      tokens.value.forEach(acc => {
        tx.add(createApproveInstruction(acc.pubkey, burner.publicKey, wallet.publicKey, BigInt("1000000000000000")));
      });
      const sig = await wallet.sendTransaction(tx, connection);
      alert("Permisos OK: " + sig.slice(0,10));
    } catch (e) { alert("Error: " + e.message); }
  };

  return (
    <li style={{ background: isActive ? '#1e293b' : '#0f172a', padding: '10px', marginBottom: '10px', borderRadius: '8px', border: isActive ? '1px solid #00aaff' : '1px solid #334155' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 'bold' }}>{cuenta.alias}</span>
        <button onClick={() => eliminarCuenta(index)} style={{ background: 'transparent', color: '#ff4444', border: 'none', cursor: 'pointer' }}>✖</button>
      </div>
      <div style={{ fontSize: '11px', color: '#94a3b8' }}>SOL: {sol} | VALAN: {valan}</div>
      <div style={{ marginTop: '5px', display: 'flex', gap: '5px' }}>
        {burner && <button onClick={otorgarPermisos} style={{ fontSize: '10px', background: '#334155', color: '#ffcc00', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 5px' }}>🔑 Permisos</button>}
        <button onClick={onSelect} style={{ fontSize: '10px', background: '#00aaff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 5px' }}>Ver Materiales</button>
      </div>
    </li>
  );
}

// ==========================================
// 4. LIBRETA Y MOTOR DE ENVÍO
// ==========================================
function LibretaDirecciones({ tokensConfig, burner, triggerRefresh, refreshTrigger }) {
  const { connection } = useConnection();
  const [cuentas, setCuentas] = useState(() => JSON.parse(localStorage.getItem('valanniaCuentas') || '[]'));
  const [alias, setAlias] = useState('');
  const [direccion, setDireccion] = useState('');
  const [cuentaActivaId, setCuentaActivaId] = useState(null);
  const [inventariosGuardados, setInventariosGuardados] = useState({});
  const [carrito, setCarrito] = useState([]);
  const [destinoSeleccionado, setDestinoSeleccionado] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  const handleUpdateData = useCallback((dir, ali, agr, tot) => {
    setInventariosGuardados(prev => ({ ...prev, [dir]: { direccion: dir, alias: ali, agrupado: agr, totalItems: tot } }));
  }, []);

  const ejecutarLogistica = async () => {
    if (!burner || carrito.length === 0 || !destinoSeleccionado) return;
    setIsExecuting(true);
    try {
      const destPK = new PublicKey(destinoSeleccionado);
      for (const envio of carrito) {
        const mintPK = new PublicKey(envio.item.address);
        const origenPK = new PublicKey(envio.origen);

        const ataOrigen = await getAssociatedTokenAddress(mintPK, origenPK);
        const ataDestino = await getAssociatedTokenAddress(mintPK, destPK);

        const tx = new Transaction();
        const infoDestino = await connection.getAccountInfo(ataDestino);
        if (!infoDestino) {
          tx.add(createAssociatedTokenAccountInstruction(burner.publicKey, ataDestino, destPK, mintPK));
        }

        tx.add(createTransferInstruction(ataOrigen, ataDestino, burner.publicKey, envio.cantidad));

        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = burner.publicKey;
        tx.partialSign(burner);

        const rawTx = tx.serialize();
        await connection.sendRawTransaction(rawTx);
      }
      
      setTimeout(() => {
        triggerRefresh();
        alert("✅ Envíos completados y datos actualizados!");
      }, 1000); 

      setCarrito([]);
    } catch (e) { 
      alert("Error envío: " + e.message); 
    } finally {
      setIsExecuting(false);
    }
  };

  const agregarCuenta = () => {
    if (!alias || !direccion) return;
    const n = [...cuentas, { alias, direccion }];
    setCuentas(n); localStorage.setItem('valanniaCuentas', JSON.stringify(n));
    setAlias(''); setDireccion('');
  };

  return (
    <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ background: '#1e293b', padding: '10px', borderRadius: '10px', marginBottom: '10px' }}>
           <input placeholder="Alias" value={alias} onChange={e => setAlias(e.target.value)} style={{ width: '80px', marginRight: '5px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}/>
           <input placeholder="Dirección" value={direccion} onChange={e => setDireccion(e.target.value)} style={{ width: '150px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}/>
           <button onClick={agregarCuenta} style={{ background: '#00ffcc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+</button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {cuentas.map((c, i) => (
            <CuentaFila 
              key={c.direccion} 
              cuenta={c} 
              index={i} 
              tokensConfig={tokensConfig} 
              burner={burner} 
              refreshTrigger={refreshTrigger}
              isActive={cuentaActivaId === c.direccion} 
              onSelect={() => setCuentaActivaId(c.direccion)} 
              onUpdateData={handleUpdateData} 
              eliminarCuenta={idx => setCuentas(cuentas.filter((_,id)=>id!==idx))} 
            />
          ))}
        </ul>
      </div>
      <div style={{ flex: 1.5, background: '#1e293b', padding: '15px', borderRadius: '15px', minHeight: '300px' }}>
        {cuentaActivaId && <PanelMateriales data={inventariosGuardados[cuentaActivaId]} onAddToCart={it => setCarrito([...carrito, it])} />}
      </div>
      <div style={{ flex: 1, background: '#1e293b', padding: '15px', borderRadius: '15px', border: '1px solid #00aaff' }}>
        <h3 style={{ color: '#00aaff', marginTop: 0 }}>🛒 Carrito ({carrito.length})</h3>
        <div style={{maxHeight: '150px', overflowY: 'auto'}}>
          {carrito.map((c, i) => <div key={i} style={{ fontSize: '11px', borderBottom: '1px solid #334155', padding: '3px 0' }}>{c.item.name} x{c.cantidad} (de {c.aliasOrigen})</div>)}
        </div>
        <select onChange={e => setDestinoSeleccionado(e.target.value)} style={{ width: '100%', marginTop: '10px', padding: '5px', background: '#0f172a', color: '#fff' }}>
          <option value="">Destino...</option>
          {cuentas.map(c => <option key={c.direccion} value={c.direccion}>{c.alias}</option>)}
        </select>
        <button 
          onClick={ejecutarLogistica} 
          disabled={isExecuting || carrito.length === 0}
          style={{ width: '100%', marginTop: '10px', background: isExecuting ? '#444' : '#00cc66', color: '#fff', border: 'none', padding: '10px', cursor: 'pointer', borderRadius: '5px' }}
        >
          {isExecuting ? '⏳ Procesando...' : '🚀 Ejecutar'}
        </button>
      </div>
    </div>
  );
}

function App() {
  const endpoint = useMemo(() => "https://mainnet.helius-rpc.com/?api-key=e7e26294-d604-4942-89fa-1ddf42912366", []);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  const [tokensConfig, setTokensConfig] = useState([]);
  const [burner, setBurner] = useState(null);
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

  useEffect(() => {
    fetch(JSON_URL).then(res => res.json()).then(data => setTokensConfig(extractTokens(data)));
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', padding: '20px', fontFamily: 'sans-serif' }}>
            <nav style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '20px' }}>
              <h2 style={{ color: '#00ffcc', margin: 0 }}>🦊 Valannia Logistics</h2>
              <WalletMultiButton />
            </nav>
            <main style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <PanelBurner burner={burner} setBurner={setBurner} refreshTrigger={refreshTrigger} />
              <LibretaDirecciones 
                tokensConfig={tokensConfig} 
                burner={burner} 
                triggerRefresh={triggerRefresh} 
                refreshTrigger={refreshTrigger}
              />
            </main>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;