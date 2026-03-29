import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { createApproveInstruction, createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';

const VALAN_MINT = "5cL3TVJ7p5ZKqyx16DXwpdcNx5u19vQtWujA9vYindi";
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
// Dejamos la variable por si en un futuro decides reactivarlo, pero ya no se usa
const DEV_FEE_WALLET = new PublicKey("5heGJeuvcpBzGs12ur6HdhsRUdbDB6xuS1rrGjRZCQsj");

function PanelMateriales({ data, onAddToCart, t }) {
  const { alias, direccion, agrupado, totalItems } = data;
  if (totalItems === 0) return (<div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '50px' }}><p>{t('empty')}</p></div>);
  return (
    <div style={{ textAlign: 'left' }}>
      <h3 style={{ color: 'var(--accent-glow)', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginTop: 0 }}>📦 {alias}</h3>
      <div className="inventory-tree">
        {Object.entries(agrupado).map(([catName, subcats]) => (
          <details key={catName} style={{ marginBottom: '10px' }} open>
            <summary className="tree-summary-cat">📂 {catName}</summary>
            <div style={{ paddingLeft: '15px', marginTop: '8px' }}>
              {Object.entries(subcats).map(([subName, items]) => (
                <details key={subName} style={{ marginBottom: '5px' }} open>
                  <summary className="tree-summary-sub">↳ 📁 {subName}</summary>
                  <div className="item-list">
                    {items.map((item, i) => (
                      <div key={i} className="item-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {item.image ? <img src={item.image} className="item-icon" alt="img"/> : <div className="item-icon-placeholder"></div>}
                          <span style={{fontWeight: '500'}}>{item.name}</span>
                        </div>
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                          <span style={{color: 'var(--valan-color)', fontSize: '12px'}}>{t('avail')} {item.cantidad}</span>
                          <input id={`qty-${direccion}-${item.address}`} type="number" defaultValue={1} className="qty-input" />
                          <button onClick={() => {
                            const qty = parseInt(document.getElementById(`qty-${direccion}-${item.address}`).value);
                            onAddToCart({ origen: direccion, aliasOrigen: alias, item, cantidad: qty });
                          }} className="axon-btn-small">{t('add')}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function CuentaFila({ cuenta, index, eliminarCuenta, tokensConfig, isActive, onSelect, onUpdateData, burner, refreshTrigger, t }) {
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
      setValan(vAmt.toFixed(2));
      
      const mats = tokensConfig.filter(tk => misBalances[tk.address] && tk.address !== VALAN_MINT).map(tk => ({ ...tk, cantidad: misBalances[tk.address] }));
      const grouped = {};
      mats.forEach(m => {
        if (!grouped[m.category]) grouped[m.category] = {};
        if (!grouped[m.category][m.subcategory]) grouped[m.category][m.subcategory] = [];
        grouped[m.category][m.subcategory].push(m);
      });
      onUpdateData(cuenta.direccion, cuenta.alias, grouped, mats.length);
    } catch (e) {
      onUpdateData(cuenta.direccion, cuenta.alias, {}, 0);
    }
  }, [cuenta.direccion, connection, tokensConfig, onUpdateData]);

  useEffect(() => {
    fetchSaldos();
    let interval = setInterval(fetchSaldos, 30000); 
    return () => clearInterval(interval);
  }, [fetchSaldos, refreshTrigger]);

  const otorgarPermisos = async () => {
    if (!wallet.connected || wallet.publicKey.toBase58() !== cuenta.direccion) { alert(t('accPermReq')); return; }
    try {
      const tokens = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, { programId: TOKEN_PROGRAM_ID });
      const tokensValannia = tokens.value.filter(acc => {
        const mint = acc.account.data.parsed.info.mint;
        const balance = acc.account.data.parsed.info.tokenAmount.uiAmount;
        return balance > 0 && mint !== VALAN_MINT && mint !== "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" && tokensConfig.some(tk => tk.address === mint);
      });
      if (tokensValannia.length === 0) { alert(t('accNoMats')); return; }
      let lotes = [];
      for (let i = 0; i < tokensValannia.length; i += 10) lotes.push(tokensValannia.slice(i, i + 10));
      for (let i = 0; i < lotes.length; i++) {
        const { blockhash } = await connection.getLatestBlockhash();
        const tx = new Transaction({ feePayer: wallet.publicKey, recentBlockhash: blockhash });
        lotes[i].forEach(acc => {
          tx.add(createApproveInstruction(new PublicKey(acc.pubkey), burner.publicKey, wallet.publicKey, BigInt("1000000000000")));
        });
        await wallet.sendTransaction(tx, connection);
      }
      alert(t('accPermOk'));
    } catch (e) { console.error(e); }
  };

  return (
    <li className={`wallet-row ${isActive ? 'active' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: '600', letterSpacing: '0.5px' }}>{cuenta.alias}</span>
        {!cuenta.isBurner && ( <button onClick={() => eliminarCuenta(index)} className="icon-btn-danger">✖</button> )}
      </div>
      <div style={{ display: 'flex', gap: '8px', margin: '12px 0' }}>
        <div className="balance-pill-small">
          <img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" width="12" height="12" alt="sol"/>
          <span style={{ color: 'var(--solana-color)' }}>{sol}</span>
        </div>
        <div className="balance-pill-small">
          <img src="https://portal.valannia.com/assets/logo-CM8aYtKK.webp" width="12" height="12" alt="valan"/>
          <span style={{ color: 'var(--valan-color)' }}>{valan}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {!cuenta.isBurner && burner && ( <button onClick={otorgarPermisos} className="axon-btn-outline" style={{flex: 1}}>{t('btnPerms')}</button> )}
        <button onClick={onSelect} className="axon-btn-secondary" style={{flex: 1}}>{t('btnViewMats')}</button>
      </div>
    </li>
  );
}

export default function VistaInventario({ cuentas, setCuentas, tokensConfig, burner, triggerRefresh, refreshTrigger, t }) {
  const { connection } = useConnection();
  const [alias, setAlias] = useState('');
  const [direccion, setDireccion] = useState('');
  const [cuentaActivaId, setCuentaActivaId] = useState(null);
  const [inventariosGuardados, setInventariosGuardados] = useState({});
  const [carrito, setCarrito] = useState([]);
  const [destinoSeleccionado, setDestinoSeleccionado] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  const cuentasRender = useMemo(() => {
    if (burner) return [{ alias: "🔥 Burn Wallet", direccion: burner.publicKey.toBase58(), isBurner: true }, ...cuentas];
    return cuentas;
  }, [cuentas, burner]);

  const handleUpdateData = useCallback((dir, ali, agr, tot) => {
    setInventariosGuardados(prev => ({ ...prev, [dir]: { direccion: dir, alias: ali, agrupado: agr, totalItems: tot } }));
  }, []);

  const ejecutarLogistica = async () => {
    if (!burner || carrito.length === 0 || !destinoSeleccionado) return;
    setIsExecuting(true);
    let destPK;
    try { destPK = new PublicKey(destinoSeleccionado); } catch (err) { alert(t('errInvalidAddr')); setIsExecuting(false); return; }

    try {
      const resumenItems = carrito.map(c => `- ${c.cantidad}x ${c.item.name}`).join('\n');

      for (const envio of carrito) {
        const mintPK = new PublicKey(envio.item.address);
        const origenPK = new PublicKey(envio.origen);
        const ataOrigen = await getAssociatedTokenAddress(mintPK, origenPK);
        const ataDestino = await getAssociatedTokenAddress(mintPK, destPK);
        const tx = new Transaction();

        // 🟢 FEE ELIMINADO TOTALMENTE AQUÍ 🟢

        const infoDestino = await connection.getAccountInfo(ataDestino);
        if (!infoDestino) tx.add(createAssociatedTokenAccountInstruction(burner.publicKey, ataDestino, destPK, mintPK));

        tx.add(createTransferInstruction(ataOrigen, ataDestino, burner.publicKey, envio.cantidad));
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = burner.publicKey;
        tx.partialSign(burner);

        await connection.sendRawTransaction(tx.serialize());
      }
      setTimeout(() => { triggerRefresh(); alert(t('cartSuccessDetails', { items: resumenItems, dest: destinoSeleccionado })); }, 1000); 
      setCarrito([]);
    } catch (e) { alert(`${t('cartErr')} ${e.message}`); } 
    finally { setIsExecuting(false); }
  };

  const agregarCuenta = () => {
    if (!alias || !direccion) return;
    const n = [...cuentas, { alias, direccion }];
    setCuentas(n); localStorage.setItem('valanniaCuentas', JSON.stringify(n));
    setAlias(''); setDireccion('');
  };

  const eliminarCuentaDeLibreta = (indexRender) => {
    const indexReal = burner ? indexRender - 1 : indexRender;
    const nuevasCuentas = cuentas.filter((_, id) => id !== indexReal);
    setCuentas(nuevasCuentas); localStorage.setItem('valanniaCuentas', JSON.stringify(nuevasCuentas));
    if (cuentaActivaId === cuentas[indexReal]?.direccion) setCuentaActivaId(null);
  };

  return (
    <div style={{ display: 'flex', gap: '25px', flexGrow: 1, minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div className="glass-card" style={{ padding: '15px', marginBottom: '15px', display: 'flex', gap: '10px' }}>
           <input placeholder={t('cartAlias')} value={alias} onChange={e => setAlias(e.target.value)} className="axon-input" style={{ flex: 1 }}/>
           <input placeholder={t('cartAddr')} value={direccion} onChange={e => setDireccion(e.target.value)} className="axon-input" style={{ flex: 2 }}/>
           <button onClick={agregarCuenta} className="axon-btn-primary" style={{ padding: '0 15px', fontSize: '18px' }}>+</button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: 'auto' }}>
          {cuentasRender.map((c, i) => (
            <CuentaFila key={c.direccion} cuenta={c} index={i} tokensConfig={tokensConfig} burner={burner} refreshTrigger={refreshTrigger} t={t} isActive={cuentaActivaId === c.direccion} onSelect={() => setCuentaActivaId(c.direccion)} onUpdateData={handleUpdateData} eliminarCuenta={eliminarCuentaDeLibreta} />
          ))}
        </ul>
      </div>

      <div className="glass-card" style={{ flex: 1.5, padding: '25px', overflowY: 'auto' }}>
        {cuentaActivaId ? ( inventariosGuardados[cuentaActivaId] ? ( <PanelMateriales data={inventariosGuardados[cuentaActivaId]} onAddToCart={it => setCarrito([...carrito, it])} t={t} /> ) : ( <div className="empty-state">{t('invLoading')}</div> ) ) : ( <div className="empty-state">{t('invSelectAcc')}</div> )}
      </div>

      <div className="glass-card cart-panel" style={{ flex: 1, padding: '25px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ color: 'var(--valan-color)', marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>{t('cartTitle')} ({carrito.length})</h3>
        <div style={{flexGrow: 1, overflowY: 'auto', margin: '15px 0'}}>
          {carrito.map((c, i) => (
            <div key={i} className="cart-item">
              <span style={{fontWeight: '500'}}>{c.item.name}</span>
              <span style={{color: 'var(--valan-color)'}}>x{c.cantidad}</span>
              <span style={{color: 'var(--text-muted)', fontSize: '11px', width: '100%', display: 'block', marginTop: '4px'}}>{t('cartFrom')} {c.aliasOrigen}</span>
            </div>
          ))}
          {carrito.length === 0 && <div style={{textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px'}}>{t('empty')}</div>}
        </div>
        <div style={{ marginTop: 'auto', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <select value={cuentasRender.some(c => c.direccion === destinoSeleccionado) ? destinoSeleccionado : ""} onChange={e => setDestinoSeleccionado(e.target.value)} className="axon-input" style={{ width: '100%', marginBottom: '15px' }}>
            <option value="">{t('cartDest')}</option>
            {cuentasRender.map(c => <option key={c.direccion} value={c.direccion}>{c.alias}</option>)}
          </select>
          <div style={{ marginBottom: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>{t('customDest')}</div>
          <input type="text" placeholder={t('customDestPh')} value={destinoSeleccionado} onChange={e => setDestinoSeleccionado(e.target.value)} className="axon-input" style={{ width: '100%', marginBottom: '15px' }} />
          <div style={{ marginBottom: '15px', fontSize: '11px', color: 'var(--solana-color)', textAlign: 'center', background: 'rgba(255,204,0,0.1)', padding: '8px', borderRadius: '6px' }}>{t('invFeeNote')}</div>
          <button onClick={ejecutarLogistica} disabled={isExecuting || carrito.length === 0 || !destinoSeleccionado} className={`axon-btn-primary ${isExecuting || carrito.length === 0 || !destinoSeleccionado ? 'disabled' : ''}`} style={{ width: '100%', padding: '12px', fontSize: '14px' }}>
            {isExecuting ? t('cartExecWait') : t('cartExec')}
          </button>
        </div>
      </div>
    </div>
  );
}