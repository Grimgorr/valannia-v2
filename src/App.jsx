import React, { useMemo, useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { ConnectionProvider, WalletProvider, useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction, VersionedTransaction, Keypair, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction, createApproveInstruction } from '@solana/spl-token';
// AÑADIR junto a los otros imports
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { transferV1, mplCore } from '@metaplex-foundation/mpl-core';
import { publicKey as umiPublicKey, createSignerFromKeypair, signerIdentity } from '@metaplex-foundation/umi';

import { deriveBurner } from './logistics';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import logoImg from './Axon.png';
import '@solana/wallet-adapter-react-ui/styles.css';

// 🟢 AQUÍ CONECTAMOS TU NUEVO ARCHIVO DE ESTILOS 🟢
import './estilos.css'; 

// ==========================================
// CONFIGURACIÓN FIREBASE Y CONSTANTES
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCqR5FD6dNFEIxtMdQC_qcUurBGyKYyZjo",
  authDomain: "axon-market.firebaseapp.com",
  projectId: "axon-market",
  storageBucket: "axon-market.firebasestorage.app",
  messagingSenderId: "596953855057",
  appId: "1:596953855057:web:7f56e317171893f421f470"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const VALAN_MINT = "5cL3TVJ7p5ZKqyx16DXwpdcNx5u19vQtWujA9vYindi";
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const JSON_URL = "https://f-bopb.github.io/valannia-inventory-tracker/data/valanniaTokens.json";
const CODIGO_BETA = "Valannia Tester";

const DEV_FEE_WALLET = new PublicKey("5heGJeuvcpBzGs12ur6HdhsRUdbDB6xuS1rrGjRZCQsj");
const TARGET_ADDRESS = "FutaNQMxqzyfScgW42Hbg71bPjkh5Rp7Tza4CiHFGoDT";
const HELIUS_API_KEY = "e7e26294-d604-4942-89fa-1ddf42912366";
// ==========================================
// SISTEMA DE TOASTS
// ==========================================
const ToastContext = createContext();
const useToast = () => useContext(ToastContext);

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none' }}>
        {toasts.map(toast => (
          <div key={toast.id} onClick={() => removeToast(toast.id)}
            style={{
              pointerEvents: 'all',
              minWidth: '280px', maxWidth: '420px',
              background: 'var(--pf-surface)',
              border: `1px solid ${toast.type === 'success' ? 'var(--pf-gold)' : toast.type === 'error' ? 'var(--pf-orange)' : 'var(--pf-border)'}`,
              borderLeft: `4px solid ${toast.type === 'success' ? 'var(--pf-gold)' : toast.type === 'error' ? 'var(--pf-orange)' : 'var(--pf-text-muted)'}`,
              padding: '14px 18px',
              borderRadius: '6px',
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              cursor: 'pointer',
              animation: 'toastIn 0.25s ease',
            }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>
              {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--pf-text)', lineHeight: '1.5' }}>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ==========================================
// DICCIONARIO DE TRADUCCIONES
// ==========================================
const LanguageContext = createContext();
const useTranslation = () => useContext(LanguageContext);

const TRANSLATIONS = {
  es: {
    menuInventory: "Inventario", menuMarket: "Mercado P2P", menuCrafting: "Héroes", menuRecipes: "Crafteo",
    betaTitle: "Acceso Beta", betaDesc: "Introduce el código para acceder a la infraestructura de Axon.",
    betaPlaceholder: "Código de acceso...", betaBtn: "Acceder", betaErr: "Código incorrecto.",
    burnExportAlert: "¡Clave Privada copiada al portapapeles!\n\nGuárdala en un lugar seguro.",
    burnCopyPubAlert: "Dirección pública copiada.", burnCreateBtn: "Activar Burner",
    burnConfirmMsg: "ATENCIÓN: Vas a borrar el Burner.\nEscribe 'BORRAR' para confirmar:",
    burnOk: "Burner eliminado.", burnErr: "Confirmación incorrecta.",
    burnDepositSameWallet: "Para añadir fondos, conecta tu wallet principal.",
    burnDepositSolPrompt: "¿Cuántos SOL quieres transferir?", burnDepositValanPrompt: "¿Cuántos VALAN quieres transferir?",
    burnDepositSuccess: "Fondos transferidos.", empty: "Inventario vacío.", avail: "Disp:", add: "+ Añadir",
    accPermReq: "Conecta esta wallet para dar permisos.", accNoMats: "No se han detectado materiales.",
    accPermOk: "Permisos otorgados.", btnPerms: "Permisos", btnViewMats: "Ver Materiales", 
    cartAlias: "Alias", cartAddr: "Dirección", cartTitle: "Logística", cartFrom: "de", cartDest: "Elegir destino...", 
    customDest: "O enviar a dirección externa:", customDestPh: "Dirección Solana...", cartExec: "Ejecutar Envío", 
    cartExecWait: "Procesando...", cartSuccessDetails: "ENVÍO COMPLETADO", errInvalidAddr: "Dirección inválida.", 
    cartErr: "Error:", footDev: "Ecosistema Axon por Grimgorr", footMem: "Polaris Fuel Alliance", 
    mktDemoBanner: "MERCADO GLOBAL ACTIVO", mktActiveOrders: "Libro de Órdenes", mktCreateOrder: "Crear Oferta",
    mktItem: "Material", mktQty: "Cant.", mktPrice: "Precio", mktTotal: "Total", mktSeller: "Vendedor",
    mktAction: "Acción", mktBuy1Click: "Comprar", mktCancel: "Cancelar", mktSelectAcc: "Elige wallet...",
    mktSelectMat: "Selecciona material...", mktSetPrice: "Precio...", mktBtnSell: "Publicar",
    mktNoAccs: "Libreta vacía.", mktNoMatsToSell: "Sin materiales.", mktOrderOk: "Oferta creada.", 
    mktCancelOk: "Orden cancelada.", fltAllCat: "Categorías", fltAllSub: "Subcategorías", fltAllItem: "Objetos", 
    fltClear: "Limpiar", mktFeeNote: "0% Fee de venta.", mktSellerWallet: "Wallet Origen", mktQtyToSell: "Cantidad", 
    mktReceiveExact: "Recibirás:", mktNoOrdersFlt: "No hay órdenes.", mktNoOrdersGlobal: "Sin ofertas públicas.",
    invSelectAcc: "Selecciona una cuenta.", invLoading: "Cargando...", errNeedBurner: "Activa el Burner primero.", 
    errFillAll: "Rellena todos los campos.", errInvQty: "Cantidad inválida.", errNotEnough: "Insuficiente.", 
    errPermissions: "Error: {msg}", errDevRefund: "Error: {msg}", errBuy: "Error: {msg}", successBuy: "¡Contrato ejecutado!",
    confirmSell: "¿Firmar contrato de venta?", confirmCancel: "¿Cancelar contrato?", confirmBuy: "¿Aceptas y firmas?", 
    invFeeNote: "Coste de red cubierto por Axon.", craftTitle: "Crafteo", craftSelectAcc: "Selecciona wallet", 
    craftNoHeroes: "Sin héroes.", craftProfession: "Profesión:", craftLevel: "Nivel:", statTitle: "Radar de Flujo",
    statSubtitle: "Transacciones VALAN en tiempo real.", statSearchDate: "Día:", statBtnExtract: "Extraer Datos",
    statBtnExtracting: "Consultando...", statCardIn: "Entradas", statCardOut: "Salidas", statCardNet: "Neto",
    homeHeroPre: "Valannia · Realms Fase 1", homeHeroTitle1: "La infraestructura", homeHeroTitle2: "económica avanza.",
    homeHeroSub: "Axon Dapp se une a Polaris Fuel para ofrecer la infraestructura técnica definitiva. Coordina recursos, automatiza logística y opera en mercados P2P sin riesgo.",
    homeHeroBtn: "Entrar a la DApp", homeHeroBtn2: "Ver Polaris Fuel",
    homeProbTitle: "El Problema", homeProbMain: "La economía es compleja.", homeProbSub: "Múltiples cuentas, transferencias manuales lentas y riesgo de estafa en intercambios OTC por Discord. Demasiada fricción.",
    homeSolTitle: "Nuestra Solución", homeSolMain: "Sistemas Core", homeSolSub: "Herramientas construidas por y para jugadores.",
    homeFeat1: "Logística Multi-Cuenta", homeFeat1Sub: "Mueve recursos entre wallets y gremios en un clic.",
    homeFeat2: "Mercado Escrow", homeFeat2Sub: "Contratos inteligentes P2P. Intercambios 100% seguros sin intermediarios.",
    homeFeat3: "Analíticas On-Chain", homeFeat3Sub: "Toma decisiones basadas en el flujo real de la blockchain.",
    homeCtaTitle: "Entra Temprano", homeCtaMain: "Fase Beta Activa", homeCtaSub: "Únete a la fase de pruebas cerrada de la infraestructura Axon."
  },
  en: {
    menuInventory: "Inventory", menuMarket: "P2P Market", menuCrafting: "Heroes", menuRecipes: "Crafting",
    betaTitle: "Beta Access", betaDesc: "Enter code to access Axon infrastructure.",
    betaPlaceholder: "Access code...", betaBtn: "Enter", betaErr: "Incorrect code.",
    burnExportAlert: "Private Key copied!\n\nStore it safely.",
    burnCopyPubAlert: "Public address copied.", burnCreateBtn: "Activate Burner",
    burnConfirmMsg: "WARNING: Deleting Burner.\nType 'DELETE':",
    burnOk: "Burner deleted.", burnErr: "Incorrect.",
    burnDepositSameWallet: "Connect main wallet to deposit.",
    burnDepositSolPrompt: "Amount of SOL?", burnDepositValanPrompt: "Amount of VALAN?",
    burnDepositSuccess: "Funds transferred.", empty: "Empty.", avail: "Avail:", add: "+ Add",
    accPermReq: "Connect wallet to grant perms.", accNoMats: "No materials.",
    accPermOk: "Perms granted.", btnPerms: "Permissions", btnViewMats: "View Mats", 
    cartAlias: "Alias", cartAddr: "Address", cartTitle: "Logistics", cartFrom: "from", cartDest: "Select destination...", 
    customDest: "External address:", customDestPh: "Solana address...", cartExec: "Execute", 
    cartExecWait: "Processing...", cartSuccessDetails: "SHIPMENT COMPLETE", errInvalidAddr: "Invalid address.", 
    cartErr: "Error:", footDev: "Axon Ecosystem by Grimgorr", footMem: "Polaris Fuel Alliance", 
    mktDemoBanner: "GLOBAL MARKET ACTIVE", mktActiveOrders: "Order Book", mktCreateOrder: "Create Offer",
    mktItem: "Item", mktQty: "Qty", mktPrice: "Price", mktTotal: "Total", mktSeller: "Seller",
    mktAction: "Action", mktBuy1Click: "Buy", mktCancel: "Cancel", mktSelectAcc: "Select wallet...",
    mktSelectMat: "Select material...", mktSetPrice: "Price...", mktBtnSell: "Publish",
    mktNoAccs: "Empty book.", mktNoMatsToSell: "No materials.", mktOrderOk: "Offer created.", 
    mktCancelOk: "Order canceled.", fltAllCat: "Categories", fltAllSub: "Subcategories", fltAllItem: "Items", 
    fltClear: "Clear", mktFeeNote: "0% Selling fee.", mktSellerWallet: "Source Wallet", mktQtyToSell: "Quantity", 
    mktReceiveExact: "You receive:", mktNoOrdersFlt: "No orders.", mktNoOrdersGlobal: "No public offers.",
    invSelectAcc: "Select an account.", invLoading: "Loading...", errNeedBurner: "Activate Burner.", 
    errFillAll: "Fill all fields.", errInvQty: "Invalid qty.", errNotEnough: "Insufficient.", 
    errPermissions: "Error: {msg}", errDevRefund: "Error: {msg}", errBuy: "Error: {msg}", successBuy: "Contract executed!",
    confirmSell: "Sign sell contract?", confirmCancel: "Cancel contract?", confirmBuy: "Sign and accept?", 
    invFeeNote: "Network cost covered by Axon.", craftTitle: "Crafting", craftSelectAcc: "Select wallet", 
    craftNoHeroes: "No heroes.", craftProfession: "Profession:", craftLevel: "Level:", statTitle: "Flow Radar",
    statSubtitle: "Real-time VALAN transactions.", statSearchDate: "Date:", statBtnExtract: "Extract Data",
    statBtnExtracting: "Querying...", statCardIn: "Inflow", statCardOut: "Outflow", statCardNet: "Net",
    homeHeroPre: "Valannia · Realms Phase 1", homeHeroTitle1: "Economic", homeHeroTitle2: "infrastructure evolved.",
    homeHeroSub: "Axon Dapp joins Polaris Fuel to offer the ultimate technical infrastructure. Coordinate resources, automate logistics, and trade securely in P2P markets.",
    homeHeroBtn: "Launch DApp", homeHeroBtn2: "View Polaris Fuel",
    homeProbTitle: "The Problem", homeProbMain: "Economy is complex.", homeProbSub: "Multiple accounts, slow manual transfers, and scam risks in Discord OTC trades. Too much friction.",
    homeSolTitle: "Our Solution", homeSolMain: "Core Systems", homeSolSub: "Tools built by players, for players.",
    homeFeat1: "Multi-Account Logistics", homeFeat1Sub: "Move resources between wallets and guilds in one click.",
    homeFeat2: "Escrow Market", homeFeat2Sub: "P2P smart contracts. 100% secure trades with no middlemen.",
    homeFeat3: "On-Chain Analytics", homeFeat3Sub: "Make decisions based on real blockchain flow data.",
    homeCtaTitle: "Get In Early", homeCtaMain: "Beta Phase Active", homeCtaSub: "Join the closed testing phase of the Axon infrastructure."
  }
};

function extractTokens(obj, path = []) {
  let tokens = [];
  if (Array.isArray(obj)) obj.forEach(item => tokens.push(...extractTokens(item, path)));
  else if (typeof obj === 'object' && obj !== null) {
    if ((obj.address || obj.mint) && (obj.name || obj.title)) {
      tokens.push({ 
        name: obj.name || obj.title, address: obj.address || obj.mint, 
        category: obj.category || (path.length > 0 ? path[0] : "General"), 
        subcategory: obj.subcategory || (path.length > 1 ? path[1] : "Variados"), 
        image: obj.image || obj.icon || "" 
      });
    } else {
      for (let key in obj) tokens.push(...extractTokens(obj[key], [...path, key]));
    }
  }
  return tokens;
}

function shortenAddress(address) { return address ? `${address.slice(0, 4)}...${address.slice(-4)}` : ''; }

// ==========================================
// EFECTOS VISUALES 
// ==========================================
function CustomCursor() {
  const cursorRef = useRef(null);
  const ringRef = useRef(null);
  const requestRef = useRef(null);
  const mouse = useRef({ x: 0, y: 0, rx: 0, ry: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => { mouse.current.x = e.clientX; mouse.current.y = e.clientY; };
    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      mouse.current.rx += (mouse.current.x - mouse.current.rx) * 0.15;
      mouse.current.ry += (mouse.current.y - mouse.current.ry) * 0.15;
      if (cursorRef.current) {
        cursorRef.current.style.left = mouse.current.x + 'px';
        cursorRef.current.style.top = mouse.current.y + 'px';
      }
      if (ringRef.current) {
        ringRef.current.style.left = mouse.current.rx + 'px';
        ringRef.current.style.top = mouse.current.ry + 'px';
      }
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => { window.removeEventListener('mousemove', handleMouseMove); cancelAnimationFrame(requestRef.current); };
  }, []);

  return (
    <>
      <div id="cursor" ref={cursorRef} style={{position: 'fixed', width: '10px', height: '10px', background: 'var(--pf-orange)', borderRadius: '50%', pointerEvents: 'none', zIndex: 9999, transform: 'translate(-50%,-50%)', transition: 'width .2s, height .2s, background .2s', mixBlendMode: 'screen'}}></div>
      <div id="cursor-ring" ref={ringRef} style={{position: 'fixed', width: '34px', height: '34px', border: '1px solid rgba(255,107,26,0.5)', borderRadius: '50%', pointerEvents: 'none', zIndex: 9998, transform: 'translate(-50%,-50%)', transition: 'width .3s, height .3s, border-color .3s'}}></div>
    </>
  );
}

function FireCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H;
    let particles = [];
    let reqId;

    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    resize();

    class P {
      constructor() { this.reset(true); }
      reset(init = false) {
        this.x = Math.random() * W; this.y = init ? Math.random() * H : H + 10;
        this.size = Math.random() * 1.8 + 0.4; this.vy = -(Math.random() * 0.5 + 0.15);
        this.vx = (Math.random() - 0.5) * 0.25; this.life = 0;
        this.maxLife = Math.random() * 180 + 80; this.hue = Math.random() * 25 + 8;
      }
      update() {
        this.x += this.vx; this.y += this.vy; this.life++;
        if (this.life > this.maxLife || this.y < -10) this.reset();
      }
      draw() {
        const t = this.life / this.maxLife;
        const a = t < 0.3 ? t / 0.3 : 1 - ((t - 0.3) / 0.7);
        ctx.save(); ctx.globalAlpha = a * 0.65; ctx.fillStyle = `hsl(${this.hue},100%,60%)`;
        ctx.shadowBlur = 5; ctx.shadowColor = `hsl(${this.hue},100%,60%)`;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill(); ctx.restore();
      }
    }
    for (let i = 0; i < 100; i++) particles.push(new P());

    const animP = () => {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => { p.update(); p.draw(); });
      reqId = requestAnimationFrame(animP);
    };
    animP();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(reqId); };
  }, []);

  return <canvas ref={canvasRef} id="particle-canvas" style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none', opacity: 0.55}}></canvas>;
}

// ==========================================
// VISTA HOME (LANDING PAGE)
// ==========================================
function VistaHome({ onLaunchApp, lang, setLang, t }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="landing-container">
      <nav id="navbar" className={scrolled ? 'glass-card' : ''} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.2rem 3rem', borderBottom: '1px solid transparent', transition: 'background .4s, border-color .4s, backdrop-filter .4s' }}>
        <div onClick={onLaunchApp} style={{cursor:'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
          <img src={logoImg} alt="Axon" style={{width: '36px', height: 'auto', mixBlendMode: 'screen', filter: 'drop-shadow(0 0 6px rgba(255,107,26,0.5))'}} />
          <span style={{fontFamily: 'var(--font-heading)', fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.2em', color: 'var(--pf-gold)', textTransform: 'uppercase'}}>POLARIS FUEL<span style={{color: 'var(--pf-orange)'}}> · Wallet Manager</span></span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
          <div style={{display: 'flex', gap: '0.4rem'}}>
            <button className={`axon-btn-outline ${lang==='en'?'active':''}`} onClick={() => setLang('en')} style={{padding: '0.26rem 0.52rem', fontSize: '0.58rem'}}>EN</button>
            <button className={`axon-btn-outline ${lang==='es'?'active':''}`} onClick={() => setLang('es')} style={{padding: '0.26rem 0.52rem', fontSize: '0.58rem'}}>ES</button>
          </div>
          <button onClick={onLaunchApp} className="axon-btn-primary" style={{padding: '0.6rem 1.5rem', fontSize: '0.6rem'}}>
            <span>{t('betaBtn')}</span>
          </button>
        </div>
      </nav>

      <section className="hero-section" style={{minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '10rem 2rem 6rem', position: 'relative', overflow: 'hidden'}}>
        <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '900px', height: '700px', background: 'radial-gradient(ellipse,rgba(255,107,26,0.1) 0%,transparent 65%)', pointerEvents: 'none'}}></div>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, marginBottom: '1.5rem', position: 'relative', zIndex: 2}}>
          <div style={{fontFamily: 'var(--font-heading)', fontSize: '0.6rem', letterSpacing: '0.42em', textTransform: 'uppercase', color: 'var(--pf-text-muted)', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem'}}>
             <span style={{display: 'inline-block', width: '36px', height: '1px', background: 'linear-gradient(90deg,transparent,var(--pf-border-hover))'}}></span>
             <span>{t('homeHeroPre')}</span>
             <span style={{display: 'inline-block', width: '36px', height: '1px', background: 'linear-gradient(90deg,var(--pf-border-hover),transparent)'}}></span>
          </div>
          <h1 style={{fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.8rem,4.5vw,3.2rem)', fontWeight: 900, color: 'var(--pf-gold-light)', letterSpacing: '0.04em', marginBottom: '1rem', lineHeight: 1.15}}>
            {t('homeHeroTitle1')}<br/><em style={{fontStyle: 'normal', color: 'var(--pf-orange)'}}>{t('homeHeroTitle2')}</em>
          </h1>
          <p style={{fontSize: '1.02rem', lineHeight: 1.85, color: 'var(--pf-text-muted)', maxWidth: '560px', margin: '0 auto 1.5rem'}}>{t('homeHeroSub')}</p>
          <div style={{display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem'}}>
            <button onClick={onLaunchApp} className="axon-btn-primary"><span>{t('homeHeroBtn')}</span></button>
            <a href="https://polarisfuel.app" target="_blank" rel="noreferrer" className="axon-btn-secondary">{t('homeHeroBtn2')}</a>
          </div>
          <div style={{marginTop: '3rem'}}>
            <div style={{display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-heading)', fontSize: '0.53rem', letterSpacing: '0.25em', textTransform: 'uppercase', padding: '0.32rem 0.85rem', border: '1px solid rgba(255,107,26,0.4)', color: 'var(--pf-orange)', background: 'rgba(255,107,26,0.06)'}}>
              <span style={{display: 'block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--pf-orange)'}}></span>
              <span>Phase 1 · Beta</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ==========================================
// RESTO DE LA DAPP (INVENTARIO, MERCADO, ETC)
// ==========================================

function PantallaBloqueo({ onAccesoConcedido, t }) {
  const [inputCode, setInputCode] = useState("");
  const [error, setError] = useState(false);
  const comprobarCodigo = () => {
    if (inputCode === CODIGO_BETA) { localStorage.setItem("acceso_beta_concedido", "true"); onAccesoConcedido(); } 
    else { setError(true); setTimeout(() => setError(false), 2000); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', position: 'relative', zIndex: 10 }}>
      <img src={logoImg} alt="Axon Logo" style={{ width: '100px', marginBottom: '30px', filter: 'drop-shadow(0 0 20px rgba(255, 107, 26, 0.5))' }} />
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
        <h2 style={{ color: 'var(--pf-gold-light)', marginTop: 0, fontFamily: 'var(--font-heading)', letterSpacing: '0.1em' }}>{t('betaTitle')}</h2>
        <p style={{color: 'var(--pf-text-muted)', marginBottom: '20px', fontSize: '14px'}}>{t('betaDesc')}</p>
        <input type="password" placeholder={t('betaPlaceholder')} value={inputCode} onChange={(e) => setInputCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && comprobarCodigo()} className="axon-input" style={{ marginBottom: '20px', textAlign: 'center' }} />
        <button onClick={comprobarCodigo} className="axon-btn-primary" style={{width: '100%'}}><span>{t('betaBtn')}</span></button>
        {error && <p style={{ color: 'var(--danger-color)', marginTop: '15px', fontSize: '13px' }}>{t('betaErr')}</p>}
      </div>
    </div>
  );
}


function PanelMateriales({ data, onAddToCart, t }) {
  const { alias, direccion, agrupado, totalItems } = data;
  if (totalItems === 0) return (<div style={{ textAlign: 'center', color: 'var(--pf-text-muted)', marginTop: '50px' }}><p>{t('empty')}</p></div>);
  return (
    <div style={{ textAlign: 'left' }}>
      <h3 style={{ color: 'var(--pf-gold-light)', borderBottom: '1px solid var(--pf-border)', paddingBottom: '12px', marginTop: 0, fontFamily: 'var(--font-heading)' }}>📦 {alias}</h3>
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
                          <span style={{fontWeight: '500', color: 'var(--pf-text)'}}>{item.name}</span>
                        </div>
                        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                          <span style={{color: 'var(--valan-color)', fontSize: '12px'}}>{t('avail')} {item.cantidad}</span>
                         
{!item.isNFT ? (
  <>
<input id={`qty-${direccion}-${item.address}`} type="number" defaultValue={1} min={1} max={item.cantidad} className="qty-input" />
<button onClick={() => {
  const qty = Math.min(
    parseInt(document.getElementById(`qty-${direccion}-${item.address}`).value) || 1,
    item.cantidad
  );
  onAddToCart({ origen: direccion, aliasOrigen: alias, item, cantidad: qty, maxCantidad: item.cantidad });
}} className="axon-btn-small">{t('add')}</button>
  </>
) : (
  <button onClick={() => {
    onAddToCart({ origen: direccion, aliasOrigen: alias, item, cantidad: 1, maxCantidad: item.cantidad });
  }} className="axon-btn-small">{t('add')}</button>
)}
{item.isNFT && (
  <span style={{ fontSize: '10px', color: 'var(--pf-text-muted)', border: '1px solid var(--pf-border)', padding: '4px 8px', borderRadius: '4px' }}>NFT</span>
)}
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

function HeaderBurner({ burner, setBurner, refreshTrigger, triggerRefresh, t }) {
    const wallet = useWallet();
    const { connection } = useConnection();
    const toast = useToast();
    const [sol, setSol] = useState('...');
    const [valan, setValan] = useState('...');
  
    useEffect(() => {
      const savedKey = localStorage.getItem('valannia_burner_key');
      if (savedKey && !burner) { try { setBurner(Keypair.fromSecretKey(new Uint8Array(JSON.parse(savedKey)))); } catch (e) {} }
    }, [setBurner, burner]);
  
    const handleActivate = async () => { try { const burnerKeypair = await deriveBurner(wallet); localStorage.setItem('valannia_burner_key', JSON.stringify(Array.from(burnerKeypair.secretKey))); setBurner(burnerKeypair); } catch (err) { toast("Error: " + err.message, 'error'); } };
    const borrarBurner = () => { const confirmacion = prompt(t('burnConfirmMsg')); if (confirmacion === "BORRAR" || confirmacion === "DELETE") { localStorage.removeItem('valannia_burner_key'); setBurner(null); toast(t('burnOk'), 'success'); } else if (confirmacion !== null) { toast(t('burnErr'), 'error'); } };
    const exportarLlave = () => { if (!burner) return; const secretKeyString = JSON.stringify(Array.from(burner.secretKey)); if (navigator.clipboard) { navigator.clipboard.writeText(secretKeyString).then(() => { toast(t('burnExportAlert'), 'success'); }).catch(() => { prompt(t('burnExportAlert'), secretKeyString); }); } else { prompt(t('burnExportAlert'), secretKeyString); } };
    const copiarPublica = () => { if (!burner) return; if (navigator.clipboard) { navigator.clipboard.writeText(burner.publicKey.toBase58()).then(() => { toast(t('burnCopyPubAlert'), 'success'); }); } };

    // 🟢 AQUÍ ESTÁ LA FUNCIÓN PARA AÑADIR FONDOS RESTAURADA 🟢
    const handleDeposit = async (tokenType) => {
        if (!wallet.connected) { toast(t('accPermReq'), 'error'); return; }
        if (wallet.publicKey.toBase58() === burner.publicKey.toBase58()) { toast(t('burnDepositSameWallet'), 'error'); return; }
    
        const amtStr = prompt(tokenType === 'SOL' ? t('burnDepositSolPrompt') : t('burnDepositValanPrompt'));
        if (!amtStr || isNaN(amtStr) || parseFloat(amtStr) <= 0) return;
        const amt = parseFloat(amtStr);
    
        try {
          const tx = new Transaction();
          if (tokenType === 'SOL') {
            tx.add(SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: burner.publicKey, lamports: Math.floor(amt * 1e9) }));
          } else {
            const mintPK = new PublicKey(VALAN_MINT);
            const fromATA = await getAssociatedTokenAddress(mintPK, wallet.publicKey);
            const toATA = await getAssociatedTokenAddress(mintPK, burner.publicKey);
            const infoDest = await connection.getAccountInfo(toATA);
            if (!infoDest) tx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, toATA, burner.publicKey, mintPK));
            tx.add(createTransferInstruction(fromATA, toATA, wallet.publicKey, Math.floor(amt * Math.pow(10, 6)))); 
          }
          const { blockhash } = await connection.getLatestBlockhash();
          tx.recentBlockhash = blockhash; tx.feePayer = wallet.publicKey;
          await wallet.sendTransaction(tx, connection);
          toast(t('burnDepositSuccess'), 'success'); triggerRefresh();
        } catch (e) { toast("Error: " + e.message, 'error'); }
      };

    const fetchSaldos = useCallback(async () => {
        if (!burner) return;
        try {
            const lamports = await connection.getBalance(burner.publicKey); setSol((lamports / 1e9).toFixed(4));
            const tokens = await connection.getParsedTokenAccountsByOwner(burner.publicKey, { programId: TOKEN_PROGRAM_ID });
            let vAmt = 0; tokens.value.forEach(acc => { if (acc.account.data.parsed.info.mint === VALAN_MINT) vAmt += acc.account.data.parsed.info.tokenAmount.uiAmount; });
            setValan(vAmt.toFixed(2));
        } catch (err) {}
    }, [burner, connection]);

    useEffect(() => { fetchSaldos(); let interval = setInterval(fetchSaldos, 15000); return () => clearInterval(interval); }, [fetchSaldos, refreshTrigger]);
  
    if (!burner) return <button onClick={handleActivate} className="axon-btn-primary" style={{ padding: '8px 25px', fontSize: '10px' }}><span>{t('burnCreateBtn')}</span></button>;
  
    return (
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', padding: '6px 15px', borderRadius: '30px', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderRight: '1px solid var(--pf-border)', paddingRight: '15px' }}>
            <span style={{ fontSize: '15px', filter: 'drop-shadow(0 0 5px rgba(255,107,26,0.5))' }}>🔥</span>
            <span onClick={copiarPublica} className="axon-address-badge" title="Copiar">{burner.publicKey.toBase58().slice(0,4)}...{burner.publicKey.toBase58().slice(-4)}</span>
            <button onClick={exportarLlave} className="icon-btn">🔑</button>
            <button onClick={borrarBurner} className="icon-btn" style={{filter: 'grayscale(1)'}}>🗑️</button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* 🟢 AÑADIDO: Icono de Solana y botón de Depósito (+) 🟢 */}
            <div className="balance-pill-small">
              <img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" width="14" height="14" alt="sol"/>
              <span style={{ color: 'var(--pf-gold)' }}>{sol} SOL</span>
              <button onClick={() => handleDeposit('SOL')} title="Deposit SOL" className="deposit-btn">+</button>
            </div>
            {/* 🟢 AÑADIDO: Icono de Valannia y botón de Depósito (+) 🟢 */}
            <div className="balance-pill-small">
              <img src="https://portal.valannia.com/assets/logo-CM8aYtKK.webp" width="14" height="14" alt="valan"/>
              <span style={{ color: 'var(--pf-orange)' }}>{valan} VALAN</span>
              <button onClick={() => handleDeposit('VALAN')} title="Deposit VALAN" className="deposit-btn">+</button>
            </div>
          </div>
        </div>
      );
}

function CuentaFila({ cuenta, index, eliminarCuenta, tokensConfig, isActive, onSelect, onUpdateData, refreshTrigger, t }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const toast = useToast();
  const [sol, setSol] = useState('...');
  const [valan, setValan] = useState('...');

  // DESPUÉS
const fetchSaldos = useCallback(async () => {
  try {
    const pubkey = new PublicKey(cuenta.direccion);
    const lamports = await connection.getBalance(pubkey);
    setSol((lamports / 1e9).toFixed(4));

    // ── 1. Tokens SPL clásicos ──────────────────────────────────────────
    const tokens = await connection.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_PROGRAM_ID });
    const misBalances = {}; let vAmt = 0;
    tokens.value.forEach(acc => {
      const info = acc.account.data.parsed.info;
      if (info.mint === VALAN_MINT) vAmt += info.tokenAmount.uiAmount;
      if (info.tokenAmount.uiAmount > 0) misBalances[info.mint] = info.tokenAmount.uiAmount;
    });
    setValan(vAmt.toFixed(2));
    const mats = tokensConfig
      .filter(tk => misBalances[tk.address] && tk.address !== VALAN_MINT)
      .map(tk => ({ ...tk, cantidad: misBalances[tk.address] }));

    // ── 2. NFTs Metaplex Core via Helius DAS ────────────────────────────
    const coreAssets = [];
    try {
      const dasRes = await fetch(
        `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 'axon-core', method: 'getAssetsByOwner',
            params: {
              ownerAddress: cuenta.direccion,
              page: 1, limit: 1000,
              displayOptions: { showFungible: false, showNativeBalance: false }
            }
          })
        }
      );
      const dasData = await dasRes.json();
      const items = dasData?.result?.items || [];
      // DESPUÉS
items.forEach(asset => {
  if (!asset.interface?.startsWith('MplCore')) return;

  const attrs = asset.content?.metadata?.attributes || [];
  const getAttr = (trait) => attrs.find(a => a.trait_type === trait)?.value;

  const name     = asset.content?.metadata?.name || asset.id.slice(0, 8);
  const image    = asset.content?.links?.image || asset.content?.files?.[0]?.uri || '';
  const category = getAttr('category') || 'NFTs · Core';
  const type     = getAttr('type')     || 'Unknown';
  const richness = getAttr('richness');
  const collection = asset.grouping?.find(g => g.group_key === 'collection')?.group_value || null;

  const displayName = richness != null ? `${name} · Richness ${richness}` : name;

const existing = coreAssets.find(a => a.name === displayName && a.subcategory === type);
if (existing) {
  existing.cantidad += 1;
  existing.allAddresses.push(asset.id);
} else {
  coreAssets.push({
    name: displayName,
    address: asset.id,
    allAddresses: [asset.id],
    category,
    subcategory: type,
    image,
    cantidad: 1,
    isNFT: true,
    collection,
  });
}
});

    } catch (coreErr) {
      console.warn('[Axon] Error fetching Core NFTs:', coreErr);
    }

    // ── 3. Mezclar SPL + Core en el mismo grouped ───────────────────────
    const allItems = [...mats, ...coreAssets];
    const grouped = {};
    allItems.forEach(m => {
      if (!grouped[m.category]) grouped[m.category] = {};
      if (!grouped[m.category][m.subcategory]) grouped[m.category][m.subcategory] = [];
      grouped[m.category][m.subcategory].push(m);
    });
    onUpdateData(cuenta.direccion, cuenta.alias, grouped, allItems.length);

  } catch (e) { onUpdateData(cuenta.direccion, cuenta.alias, {}, 0); }
}, [cuenta.direccion, connection, tokensConfig, onUpdateData]);
  useEffect(() => { fetchSaldos(); let interval = setInterval(fetchSaldos, 30000); return () => clearInterval(interval); }, [fetchSaldos, refreshTrigger]);

  return (
    <li className={`wallet-row ${isActive ? 'active' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: '600', letterSpacing: '0.5px' }}>{cuenta.alias}</span>
        <button onClick={() => eliminarCuenta(index)} className="icon-btn-danger">✖</button>
      </div>
      <div style={{ display: 'flex', gap: '8px', margin: '12px 0' }}>
        <div className="balance-pill-small"><span style={{ color: 'var(--pf-gold)' }}>{sol} SOL</span></div>
        <div className="balance-pill-small"><span style={{ color: 'var(--pf-orange)' }}>{valan} VALAN</span></div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onSelect} className="axon-btn-secondary" style={{flex: 1, padding: '8px', fontSize: '10px'}}>{t('btnViewMats')}</button>
      </div>
    </li>
  );
}

function VistaInventario({ cuentas, setCuentas, tokensConfig, triggerRefresh, refreshTrigger, t }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const toast = useToast();
  const [alias, setAlias] = useState(''); const [direccion, setDireccion] = useState('');
  const [cuentaActivaId, setCuentaActivaId] = useState(null);
  const [inventariosGuardados, setInventariosGuardados] = useState({});
  const [carrito, setCarrito] = useState([]);
  const [destinoSeleccionado, setDestinoSeleccionado] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  const cuentasRender = useMemo(() => cuentas, [cuentas]);
  const handleUpdateData = useCallback((dir, ali, agr, tot) => { setInventariosGuardados(prev => ({ ...prev, [dir]: { direccion: dir, alias: ali, agrupado: agr, totalItems: tot } })); }, []);

const ejecutarLogistica = async () => {
  if (carrito.length === 0 || !destinoSeleccionado) return;
  if (!wallet.connected) { toast(t('errConnectWalletLogistics'), 'error'); return; }
  setIsExecuting(true);
  let destPK;
  try { destPK = new PublicKey(destinoSeleccionado); }
  catch (err) { toast(t('errInvalidAddr'), 'error'); setIsExecuting(false); return; }

  const origenesUnicos = [...new Set(carrito.map(c => c.origen))];
  for (const origen of origenesUnicos) {
    if (wallet.publicKey.toBase58() !== origen) {
      const aliasO = carrito.find(c => c.origen === origen)?.aliasOrigen || origen.slice(0,8);
      toast(t('errConnectAlias').replace('la wallet', `"${aliasO}"`), 'error');
      setIsExecuting(false); return;
    }
  }

  try {
    const enviosSPL  = carrito.filter(c => !c.item.isNFT);
    const enviosCore = carrito.filter(c =>  c.item.isNFT);

    // ── SPL: agrupar en lotes de hasta ~6 transfers por tx ──────────────
    // Cada transfer SPL = ~2 instrucciones (createATA si hace falta + transfer).
    // Límite seguro: 6 transfers por tx para no superar el límite de tamaño de Solana.
    // Pre-calcular todas las instrucciones SPL
    const splIxs = [];
    for (const envio of enviosSPL) {
      const mintPK     = new PublicKey(envio.item.address);
      const origenPK   = new PublicKey(envio.origen);
      const ataOrigen  = await getAssociatedTokenAddress(mintPK, origenPK);
      const ataDestino = await getAssociatedTokenAddress(mintPK, destPK);
      const ixs = [];
      const infoDestino = await connection.getAccountInfo(ataDestino);
      if (!infoDestino) ixs.push(createAssociatedTokenAccountInstruction(wallet.publicKey, ataDestino, destPK, mintPK));
      ixs.push(createTransferInstruction(ataOrigen, ataDestino, wallet.publicKey, envio.cantidad));
      splIxs.push(...ixs);
    }

    // Enviar en lotes — agrupación dinámica por tamaño real de tx
    // En vez de un número fijo, construimos la tx e imos añadiendo instrucciones
    // hasta que la tx serializada se acerque al límite de 1232 bytes de Solana.
    const TX_SIZE_LIMIT = 1100; // margen de seguridad bajo el límite real de 1232
    const { blockhash: splBlockhash } = await connection.getLatestBlockhash('confirmed');

    const sendSPLBatch = async (ixBatch) => {
      const tx = new Transaction();
      tx.recentBlockhash = splBlockhash;
      tx.feePayer = wallet.publicKey;
      ixBatch.forEach(ix => tx.add(ix));
      const sig = await wallet.sendTransaction(tx, connection);
      const start = Date.now();
      while (Date.now() - start < 45000) {
        const status = await connection.getSignatureStatus(sig);
        const c = status?.value?.confirmationStatus;
        if (status?.value?.err) throw new Error('SPL tx failed: ' + JSON.stringify(status.value.err));
        if (c === 'confirmed' || c === 'finalized') break;
        await new Promise(r => setTimeout(r, 1000));
      }
    };

    let currentBatch = [];
    let testTx = new Transaction();
    testTx.recentBlockhash = splBlockhash;
    testTx.feePayer = wallet.publicKey;

    for (const ix of splIxs) {
      testTx.add(ix);
      currentBatch.push(ix);
      // Estimar tamaño — si supera el límite, enviar el lote anterior y empezar uno nuevo
      const estimatedSize = testTx.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
      if (estimatedSize > TX_SIZE_LIMIT) {
        // Quitar la última instrucción y enviar el lote sin ella
        currentBatch.pop();
        if (currentBatch.length > 0) await sendSPLBatch(currentBatch);
        // Nueva tx con solo la instrucción que no cabía
        currentBatch = [ix];
        testTx = new Transaction();
        testTx.recentBlockhash = splBlockhash;
        testTx.feePayer = wallet.publicKey;
        testTx.add(ix);
      }
    }
    // Enviar el último lote si queda algo
    if (currentBatch.length > 0) await sendSPLBatch(currentBatch);

    // ── Core NFTs: agrupar usando signAllTransactions ──────────────────
    // UMI construye cada transferV1 como una VersionedTransaction separada.
    // Usamos signAllTransactions para que el wallet firme todas de una vez
    // (una sola aprobación en Phantom), luego se envían en serie.
    if (enviosCore.length > 0) {
      const umi = createUmi(connection.rpcEndpoint).use(mplCore());

      // Construir todas las txs Core sin enviar
      const coreTxBuilders = enviosCore.map(envio =>
        transferV1(umi, {
          asset:    umiPublicKey(envio.item.address),
          newOwner: umiPublicKey(destinoSeleccionado),
          ...(envio.item.collection ? { collection: umiPublicKey(envio.item.collection) } : {}),
        })
      );

      // Serializar a VersionedTransaction para firmado en lote
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      const versionedTxs = await Promise.all(
        coreTxBuilders.map(async (builder) => {
          const umiTx = await builder.buildWithLatestBlockhash(umi);
          const serialized = umi.transactions.serialize(umiTx);
          return VersionedTransaction.deserialize(serialized);
        })
      );

      // Una sola confirmación del wallet para todas las Core txs
      const signedTxs = await wallet.signAllTransactions(versionedTxs);

      // Enviar en serie y confirmar cada una
      for (const signedTx of signedTxs) {
        const raw = signedTx.serialize();
        const sig = await connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 3 });
        const start = Date.now();
        while (Date.now() - start < 45000) {
          const status = await connection.getSignatureStatus(sig);
          const c = status?.value?.confirmationStatus;
          if (status?.value?.err) throw new Error('Core tx failed: ' + JSON.stringify(status.value.err));
          if (c === 'confirmed' || c === 'finalized') break;
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    setTimeout(() => { triggerRefresh(); toast(t('cartSuccessDetails'), 'success'); }, 1000);
    setCarrito([]);
  } catch (e) { toast(`${t('cartErr')} ${e.message}`, 'error'); }
  finally { setIsExecuting(false); }
};

  const agregarCuenta = () => { if (!alias || !direccion) return; const n = [...cuentas, { alias, direccion }]; setCuentas(n); localStorage.setItem('valanniaCuentas', JSON.stringify(n)); setAlias(''); setDireccion(''); };
  const eliminarCuentaDeLibreta = (indexRender) => { const nuevasCuentas = cuentas.filter((_, id) => id !== indexRender); setCuentas(nuevasCuentas); localStorage.setItem('valanniaCuentas', JSON.stringify(nuevasCuentas)); if (cuentaActivaId === cuentas[indexRender]?.direccion) setCuentaActivaId(null); };

  return (
    <div style={{ display: 'flex', gap: '25px', flexGrow: 1, minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div className="glass-card" style={{ padding: '15px', marginBottom: '15px', display: 'flex', gap: '10px' }}>
           <input placeholder={t('cartAlias')} value={alias} onChange={e => setAlias(e.target.value)} className="axon-input" style={{ flex: 1 }}/>
           <input placeholder={t('cartAddr')} value={direccion} onChange={e => setDireccion(e.target.value)} className="axon-input" style={{ flex: 2 }}/>
           <button onClick={agregarCuenta} className="axon-btn-primary" style={{ padding: '0 15px', fontSize: '18px' }}><span>+</span></button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: 'auto' }}>
          {cuentasRender.map((c, i) => <CuentaFila key={c.direccion} cuenta={c} index={i} tokensConfig={tokensConfig} refreshTrigger={refreshTrigger} t={t} isActive={cuentaActivaId === c.direccion} onSelect={() => setCuentaActivaId(c.direccion)} onUpdateData={handleUpdateData} eliminarCuenta={eliminarCuentaDeLibreta} />)}
        </ul>
      </div>
      <div className="glass-card" style={{ flex: 1.5, padding: '25px', overflowY: 'auto' }}>
        {cuentaActivaId ? ( inventariosGuardados[cuentaActivaId] ? ( <PanelMateriales data={inventariosGuardados[cuentaActivaId]} onAddToCart={it => {
  const yaEnCarrito = carrito
    .filter(c => c.item.address === it.item.address && c.origen === it.origen)
    .reduce((sum, c) => sum + c.cantidad, 0);
  const disponible = it.maxCantidad - yaEnCarrito;
  if (disponible <= 0) { toast(t('errNotEnough'), 'error'); return; }
  const cantidadFinal = Math.min(it.cantidad, disponible);
  setCarrito([...carrito, { ...it, cantidad: cantidadFinal }]);
}} t={t} /> ) : ( <div className="empty-state">{t('invLoading')}</div> ) ) : ( <div className="empty-state">{t('invSelectAcc')}</div> )}
      </div>
      <div className="glass-card" style={{ flex: 1, padding: '25px', display: 'flex', flexDirection: 'column', background: 'var(--pf-surface)' }}>
        <h3 style={{ color: 'var(--pf-gold-light)', marginTop: 0, borderBottom: '1px solid var(--pf-border)', paddingBottom: '15px', fontFamily: 'var(--font-heading)' }}>{t('cartTitle')} ({carrito.length})</h3>
        {/* Aviso si hay NFTs Core de wallets que necesitan conexión */}
        {carrito.some(c => c.item.isNFT) && (() => {
          const walletsPendientes = [...new Set(carrito.filter(c => c.item.isNFT).map(c => c.aliasOrigen))];
          const walletActual = wallet.connected ? wallet.publicKey.toBase58() : null;
          const todasOk = carrito.filter(c => c.item.isNFT).every(c => c.origen === walletActual);
          return (
            <div style={{ background: todasOk ? 'rgba(212,168,67,0.1)' : 'rgba(255,107,26,0.1)', border: `1px solid ${todasOk ? 'var(--pf-gold)' : 'var(--pf-orange)'}`, borderRadius: '6px', padding: '10px 14px', marginBottom: '10px', fontSize: '11px', lineHeight: '1.6' }}>
              {todasOk
                ? <span style={{color:'var(--pf-gold)'}}>✅ Wallet correcta conectada. Los NFTs Core se firmarán con tu wallet.</span>
                : <span style={{color:'var(--pf-orange)'}}>⚠️ NFTs Core de <strong>{walletsPendientes.join(', ')}</strong> requieren que conectes esa wallet para firmar la transferencia.</span>
              }
            </div>
          );
        })()}
        <div style={{flexGrow: 1, overflowY: 'auto', margin: '15px 0'}}>
{carrito.map((c, i) => (
  <div key={i} style={{background: 'var(--pf-bg)', border: `1px solid ${c.item.isNFT ? 'var(--pf-gold)' : 'var(--pf-border)'}`, padding: '10px 15px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}>
    <div style={{flex: 1}}>
      <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
        <span style={{fontWeight: '500', color: 'var(--pf-text)'}}>{c.item.name}</span>
        {c.item.isNFT && <span style={{fontSize:'9px', color:'var(--pf-gold)', border:'1px solid var(--pf-gold)', padding:'1px 4px', borderRadius:'3px'}}>NFT</span>}
      </div>
      <span style={{color: 'var(--pf-text-muted)', fontSize: '11px', display: 'block', marginTop: '4px'}}>{t('cartFrom')} {c.aliasOrigen}</span>
    </div>
    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
      <span style={{color: 'var(--pf-orange)'}}>x{c.cantidad}</span>
      <button onClick={() => setCarrito(carrito.filter((_, idx) => idx !== i))} className="icon-btn-danger" title="Eliminar">✖</button>
    </div>
  </div>
))}
          {carrito.length === 0 && <div className="empty-state" style={{border: 'none'}}>{t('empty')}</div>}
        </div>
        <div style={{ marginTop: 'auto', background: 'var(--pf-bg)', padding: '15px', border: '1px solid var(--pf-border)' }}>
          <select value={cuentasRender.some(c => c.direccion === destinoSeleccionado) ? destinoSeleccionado : ""} onChange={e => setDestinoSeleccionado(e.target.value)} className="axon-input" style={{ width: '100%', marginBottom: '15px' }}>
            <option value="">{t('cartDest')}</option>
            {cuentasRender.map(c => <option key={c.direccion} value={c.direccion}>{c.alias}</option>)}
          </select>
          <div style={{ marginBottom: '8px', fontSize: '11px', color: 'var(--pf-text-muted)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em' }}>{t('customDest')}</div>
          <input type="text" placeholder={t('customDestPh')} value={destinoSeleccionado} onChange={e => setDestinoSeleccionado(e.target.value)} className="axon-input" style={{ width: '100%', marginBottom: '15px' }} />
          <button onClick={ejecutarLogistica} disabled={isExecuting || carrito.length === 0 || !destinoSeleccionado} className="axon-btn-primary" style={{ width: '100%', padding: '12px', fontSize: '12px', opacity: (isExecuting || carrito.length === 0 || !destinoSeleccionado) ? 0.5 : 1 }}>
            <span>{isExecuting ? t('cartExecWait') : t('cartExec')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function VistaMercado({ tokensConfig, burner, cuentas, triggerRefresh, refreshTrigger, t, db }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const toast = useToast();
  const PROXY = 'https://valannia-proxy.polarisfuel.workers.dev';

  const [selectedCuenta, setSelectedCuenta] = useState('');
  const [misMateriales, setMisMateriales] = useState([]);
  const [selectedMatAddress, setSelectedMatAddress] = useState('');
  const [sellQty, setSellQty] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const [filterSub, setFilterSub] = useState('');
  const [filterItem, setFilterItem] = useState('');
  const [ordenesActivas, setOrdenesActivas] = useState([]);
  const [libroTipo, setLibroTipo] = useState('venta');
  const [panelTipo, setPanelTipo] = useState('venta');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const ordersInfo = snapshot.docs.map(docSnap => ({ firebaseId: docSnap.id, ...docSnap.data() }));
      setOrdenesActivas(ordersInfo.sort((a, b) => b.id - a.id));
    });
    return () => unsubscribe();
  }, [db]);

  // ── Helper: enviar tx firmada a la red ──────────────────────────────────────
  const sendWorkerTx = async (txBase64, additionalSigners = []) => {
    const txBytes = Uint8Array.from(atob(txBase64), c => c.charCodeAt(0));
    const tx = Transaction.from(txBytes);
    // El wallet conectado firma las instrucciones que le corresponden
    await wallet.signTransaction(tx);
    // Signers adicionales (para multi-sig)
    for (const signer of additionalSigners) tx.partialSign(signer);
    const { blockhash } = await connection.getLatestBlockhash();
    if (!tx.recentBlockhash) tx.recentBlockhash = blockhash;
    const raw = tx.serialize({ requireAllSignatures: false });
    const sig = await connection.sendRawTransaction(raw, { skipPreflight: false });
    await connection.confirmTransaction(sig, 'confirmed');
    return sig;
  };

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const NFT_CATS = {
    'NFTs · Maps': ['Wood Maps','Water Maps','Ore Maps','Fuel Maps','Crystal Maps'],
    'NFTs · Equipment': ['Weapons','Armor','Accessories'],
    'NFTs · Collectibles': ['Badges & Coins','Mounts & Items'],
    'NFTs · Héroes': ['Origin','Beyond','Risen'],
  };
  const NFT_ITEMS = {
    'Wood Maps': ['Woodland Map','Grove Map','Forest Map','Dense Forest Map','Elderbark Forest Map','Ancient Woodland Map'],
    'Water Maps': ['Well Map','River Map','Reservoir Map','Deep Well Map','Wyrdspring Wells Map','Glacial Reservoir Map'],
    'Ore Maps': ['Copper Vein Map','Iron Vein Map','Cinnabar Vein Map','Luminite Vein Map','Scalemourn Vein Map','Small Crystal Vein Map','Medium Crystal Vein Map','Large Crystal Vein Map','Kronyx Vein Map'],
    'Fuel Maps': ['Abandoned Camp Map','Excavation Site Map','Quarry Map','Pit Mine Map','Emberhollow Cavern Map','Deep Ember Pit Map'],
    'Crystal Maps': ['Small Crystal Vein Map','Medium Crystal Vein Map','Large Crystal Vein Map'],
    'Weapons': ['Meadborne Sword','Meadborne Staff','Meadborne Bow','Flametongue Sword','Flametongue Staff','Flametongue Bow','Gleamspar Sword','Gleamspar Staff','Gleamspar Bow','Luminglade Sword','Luminglade Staff','Luminglade Bow','Luminglade Shield'],
    'Armor': ['Ironrot Chestplate','Ironrot Helmet','Ironrot Pants','Ironrot Boots','Ironrot Gauntlets','Petalsteel Chestplate','Petalsteel Helmet','Petalsteel Pants','Petalsteel Boots','Petalsteel Gauntlets','Violetfang Chestguard','Violetfang Helmet','Violetfang Pants','Violetfang Boots','Violetfang Cloak','Violetfang Gloves'],
    'Accessories': ['Copper Ring of Valannite','Copper Ring of Resistance','Iron Pendant of the Dragon','Glasses','Rose Glasses','Pendant of Vital Surge','Ring of Pulse',"Ring of Artisan's Flow",'Powergleam Orb','Wardbound Orb','Heartgrasp Ring','Guardflow Pendant','Dragonbreath Orb','Guardseal Pendant','Fortress Orb'],
    'Badges & Coins': ['1st Place Silvermoon Crafting Festival Badge','Grand Assembly II Coin','Grand Assembly III Coin','Spectral Mirror','Krazy Keg - Valannium Edition'],
    'Mounts & Items': ['Nyxu','Glorb Toolbox'],
    'Origin': ['Bubuk','Dexar','Glorb','Isolde','Kahelu','Kehkai','Lady Moonrise','Master Kapuana','Mcallister','Melisande','Netheros','Olravenour','Olvaney','Oxyboro','Quarthani','Queen Alia','Quelthor','Razuzel','Sir Arcturus','The Great Snake','Whisker','Xyra','Zeltharis','Zlurp'],
    'Beyond': ['Akheton','Blaat','Cercunos','Grunk','Olaventis','Parlok','Phylune','Rakka','Reb Heron','Sir Augustus','Sir Kastain','Sir Mandrake','The Yellow Knight','Zeferlin Quorax','Zindara','Zorvan'],
    'Risen': ['Faerin Plumadorada','Garathos','Malik','Mirix Troumbach','Sir Orion','Thrak','Vintharis','Yzmari'],
  };

  const ordenesDelTipo = ordenesActivas.filter(o => (o.orderType || 'venta') === libroTipo);
  const allCatsInOrders = [...new Set(ordenesDelTipo.map(o => o.category).filter(Boolean))];
  const cats = [...new Set([...Object.keys(NFT_CATS), ...tokensConfig.map(tk => tk.category), ...allCatsInOrders])].filter(Boolean).sort((a,b) => {
    const aIsNFT = a.startsWith('NFTs'), bIsNFT = b.startsWith('NFTs');
    if (aIsNFT && !bIsNFT) return -1; if (!aIsNFT && bIsNFT) return 1; return a.localeCompare(b);
  });
  const subs = filterCat ? [...new Set([...(NFT_CATS[filterCat]||[]), ...tokensConfig.filter(tk=>tk.category===filterCat).map(tk=>tk.subcategory), ...ordenesDelTipo.filter(o=>o.category===filterCat).map(o=>o.subcategory)])].filter(Boolean) : [];
  const itemsFiltro = filterSub ? [...new Set([...(NFT_ITEMS[filterSub]||[]), ...tokensConfig.filter(tk=>tk.subcategory===filterSub).map(tk=>tk.name), ...ordenesDelTipo.filter(o=>o.subcategory===filterSub).map(o=>o.item)])].filter(Boolean) : [];
  const ordenesFiltradas = ordenesDelTipo.filter(orden => {
    if (filterCat && (orden.category || tokensConfig.find(tk=>tk.address===orden.mint)?.category) !== filterCat) return false;
    if (filterSub && (orden.subcategory || tokensConfig.find(tk=>tk.address===orden.mint)?.subcategory) !== filterSub) return false;
    if (filterItem && orden.item !== filterItem) return false;
    return true;
  });

  // ── Materiales de la cuenta seleccionada ────────────────────────────────────
  const fetchMaterialesDeCuenta = useCallback(async (walletAddress) => {
    if (!walletAddress) { setMisMateriales([]); return; }
    try {
      const pubkey = new PublicKey(walletAddress);
      const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      const tokens = await connection.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_PROGRAM_ID });
      const matList = [];
      tokens.value.forEach(acc => {
        const info = acc.account.data.parsed.info;
        if (info.tokenAmount.uiAmount > 0 && info.mint !== VALAN_MINT && info.mint !== USDC_MINT) {
          const tk = tokensConfig.find(t => t.address === info.mint);
          if (tk) matList.push({ ...tk, cantidad: info.tokenAmount.uiAmount });
        }
      });
      try {
        const dasRes = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 'mkt', method: 'getAssetsByOwner',
            params: { ownerAddress: walletAddress, page: 1, limit: 1000, displayOptions: { showFungible: false, showNativeBalance: false } } })
        });
        const dasData = await dasRes.json();
        const items = dasData?.result?.items || [];
        const coreMap = {};
        items.forEach(asset => {
          if (!asset.interface?.startsWith('MplCore')) return;
          const attrs = asset.content?.metadata?.attributes || [];
          const getAttr = (trait) => attrs.find(a => a.trait_type === trait)?.value;
          const name = asset.content?.metadata?.name || asset.id.slice(0, 8);
          const image = asset.content?.links?.image || asset.content?.files?.[0]?.uri || '';
          const richness = getAttr('richness');
          const displayName = richness != null ? `${name} · Richness ${richness}` : name;
          const nName = name.toLowerCase();
          let category = 'NFTs · Core', subcategory = 'Other';
          if (nName.includes('map')) { category='NFTs · Maps'; subcategory=nName.includes('wood')||nName.includes('grove')||nName.includes('forest') ? 'Wood Maps' : nName.includes('well')||nName.includes('river')||nName.includes('reservoir') ? 'Water Maps' : nName.includes('ore')||nName.includes('vein') ? 'Ore Maps' : nName.includes('camp')||nName.includes('excavation')||nName.includes('quarry')||nName.includes('pit') ? 'Fuel Maps' : 'Maps'; }
          else if (nName.includes('sword')||nName.includes('staff')||nName.includes('bow')||nName.includes('shield')) { category='NFTs · Equipment'; subcategory='Weapons'; }
          else if (nName.includes('badge')||nName.includes('coin')||nName.includes('medal')) { category='NFTs · Collectibles'; subcategory='Badges & Coins'; }
          else if (nName.includes('mount')||nName.includes('keg')||nName.includes('suitcase')) { category='NFTs · Collectibles'; subcategory='Mounts & Items'; }
          else { category=getAttr('category')||'NFTs · Core'; subcategory=getAttr('type')||'Other'; }
          const collection = asset.grouping?.find(g=>g.group_key==='collection')?.group_value||null;
          const key = `${displayName}__${subcategory}`;
          if (coreMap[key]) { coreMap[key].cantidad+=1; coreMap[key].allAddresses.push(asset.id); }
          else coreMap[key] = { name: displayName, address: asset.id, allAddresses: [asset.id], category, subcategory, image, cantidad: 1, isNFT: true, collection };
        });
        matList.push(...Object.values(coreMap));
      } catch {}
      setMisMateriales(matList);
    } catch {}
  }, [connection, tokensConfig]);

  useEffect(() => { fetchMaterialesDeCuenta(selectedCuenta); }, [selectedCuenta, refreshTrigger, fetchMaterialesDeCuenta]);

  const totalRecibir = (parseFloat(sellQty||0) * parseFloat(sellPrice||0)).toFixed(4);
  const materialSeleccionadoObjeto = misMateriales.find(m => m.address === selectedMatAddress);

  // ── UMI para NFTs Core ──────────────────────────────────────────────────────
  const makeUmiWallet = () => {
    const umi = createUmi(connection.rpcEndpoint).use(mplCore());
    const walletSigner = {
      publicKey: umiPublicKey(wallet.publicKey.toBase58()),
      signTransaction: async (tx) => { const s=umi.transactions.serialize(tx); const v=VersionedTransaction.deserialize(s); const signed=await wallet.signTransaction(v); return umi.transactions.deserialize(signed.serialize()); },
      signAllTransactions: async (txs) => txs,
      signMessage: async () => new Uint8Array(0),
    };
    umi.use(signerIdentity(walletSigner));
    return umi;
  };

  const makeUmiBurner = () => {
    if (!burner) throw new Error('Burn Wallet no activa');
    const umi = createUmi(connection.rpcEndpoint).use(mplCore());
    const umiKeypair = umi.eddsa.createKeypairFromSecretKey(burner.secretKey);
    umi.use(signerIdentity(createSignerFromKeypair(umi, umiKeypair)));
    return umi;
  };

  // ── ORDEN DE VENTA ───────────────────────────────────────────────────────────
  const crearOrdenVenta = async () => {
    if (!selectedCuenta || !selectedMatAddress || !sellPrice) { toast(t('errFillAll'), 'error'); return; }
    if (!wallet.connected || wallet.publicKey.toBase58() !== selectedCuenta) { toast('Conecta la wallet origen.', 'error'); return; }
    const isNFT = materialSeleccionadoObjeto?.isNFT;
    if (!isNFT && (!sellQty || parseFloat(sellQty) <= 0)) { toast(t('errInvQty'), 'error'); return; }
    if (!window.confirm(t('confirmSell'))) return;
    setIsExecuting(true);
    try {
      if (isNFT) {
        // NFT Core: usar UMI — el escrow es el burner si existe, si no el worker lo indica
        const res = await fetch(`${PROXY}/market/sell/request`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isNFT: true }),
        });
        const data = await res.json();
        const escrowAddr = data.escrowAddr || burner?.publicKey.toBase58();
        if (!escrowAddr) { toast('Activa la Burn Wallet o el escrow del worker.', 'error'); setIsExecuting(false); return; }
        const umi = makeUmiWallet();
        await transferV1(umi, {
          asset: umiPublicKey(materialSeleccionadoObjeto.allAddresses[0]),
          newOwner: umiPublicKey(escrowAddr),
          ...(materialSeleccionadoObjeto.collection ? { collection: umiPublicKey(materialSeleccionadoObjeto.collection) } : {}),
        }).sendAndConfirm(umi);
        await addDoc(collection(db,'orders'), {
          id: Date.now(), orderType: 'venta', sellerAddr: selectedCuenta,
          mint: materialSeleccionadoObjeto.allAddresses[0],
          item: materialSeleccionadoObjeto.name, img: materialSeleccionadoObjeto.image,
          qty: 1, price: parseFloat(sellPrice),
          escrowAddr, isNFT: true,
          nftCollection: materialSeleccionadoObjeto.collection || null,
          category: materialSeleccionadoObjeto.category, subcategory: materialSeleccionadoObjeto.subcategory,
        });
      } else {
        // SPL Token: worker construye la tx, seller firma
        const res = await fetch(`${PROXY}/market/sell/request`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mint: selectedMatAddress, qty: parseInt(sellQty), price: parseFloat(sellPrice), sellerAddr: selectedCuenta, isNFT: false }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        await sendWorkerTx(data.transaction);
        await addDoc(collection(db,'orders'), {
          id: Date.now(), orderType: 'venta', sellerAddr: selectedCuenta,
          mint: selectedMatAddress, item: materialSeleccionadoObjeto.name, img: materialSeleccionadoObjeto.image,
          qty: parseInt(sellQty), price: parseFloat(sellPrice),
          escrowAddr: data.escrowAddr, isNFT: false,
          category: materialSeleccionadoObjeto.category, subcategory: materialSeleccionadoObjeto.subcategory,
        });
      }
      toast(t('mktOrderOk'), 'success');
      setSellQty(''); setSellPrice(''); setSelectedMatAddress(''); triggerRefresh();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    setIsExecuting(false);
  };

  // ── ORDEN DE COMPRA ──────────────────────────────────────────────────────────
  const crearOrdenCompra = async () => {
    if (!wallet.connected) { toast('Conecta tu wallet.', 'error'); return; }
    if (!selectedMatAddress || !sellPrice) { toast(t('errFillAll'), 'error'); return; }
    const isNFT = materialSeleccionadoObjeto?.isNFT;
    if (!isNFT && (!sellQty || parseFloat(sellQty) <= 0)) { toast(t('errInvQty'), 'error'); return; }
    const totalSOL = isNFT ? parseFloat(sellPrice) : parseFloat(sellQty) * parseFloat(sellPrice);
    if (!window.confirm(`¿Publicar orden de compra? Se bloquearán ${totalSOL.toFixed(4)} SOL en escrow hasta que se complete o canceles.`)) return;
    setIsExecuting(true);
    try {
      // Worker construye tx de depósito SOL en escrow
      const res = await fetch(`${PROXY}/market/buy/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: parseFloat(sellPrice), qty: parseInt(sellQty)||1, buyerAddr: wallet.publicKey.toBase58(), isNFT }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await sendWorkerTx(data.transaction);
      await addDoc(collection(db,'orders'), {
        id: Date.now(), orderType: 'compra',
        buyerAddr: wallet.publicKey.toBase58(),
        mint: selectedMatAddress,
        item: materialSeleccionadoObjeto?.name || selectedMatAddress,
        img: materialSeleccionadoObjeto?.image || '',
        qty: parseInt(sellQty)||1, price: parseFloat(sellPrice),
        escrowAddr: data.escrowAddr, isNFT: isNFT || false,
        nftCollection: materialSeleccionadoObjeto?.collection || null,
        category: materialSeleccionadoObjeto?.category || '',
        subcategory: materialSeleccionadoObjeto?.subcategory || '',
      });
      toast('✅ Orden de compra publicada. SOL bloqueado en escrow.', 'success');
      setSellQty(''); setSellPrice(''); setSelectedMatAddress(''); triggerRefresh();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    setIsExecuting(false);
  };

  // ── CANCELAR ─────────────────────────────────────────────────────────────────
  const cancelarOrden = async (orden) => {
    if (!window.confirm(t('confirmCancel'))) return;
    setIsExecuting(true);
    try {
      if (orden.orderType === 'compra') {
        // Worker devuelve el SOL al comprador
        const res = await fetch(`${PROXY}/market/buy/cancel`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ price: orden.price, qty: orden.qty, buyerAddr: orden.buyerAddr, isNFT: orden.isNFT }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        // El escrow ya firmó — solo enviamos (no necesita firma del usuario)
        const txBytes = Uint8Array.from(atob(data.transaction), c => c.charCodeAt(0));
        const tx = Transaction.from(txBytes);
        const raw = tx.serialize({ requireAllSignatures: false });
        await connection.sendRawTransaction(raw, { skipPreflight: false });
      } else {
        // Venta: worker devuelve tokens al seller
        if (orden.isNFT) {
          // NFT Core: UMI desde el burner (el escrow es el burner)
          const umi = makeUmiBurner();
          await transferV1(umi, {
            asset: umiPublicKey(orden.mint), newOwner: umiPublicKey(orden.sellerAddr),
            ...(orden.nftCollection ? { collection: umiPublicKey(orden.nftCollection) } : {}),
          }).sendAndConfirm(umi);
        } else {
          const res = await fetch(`${PROXY}/market/sell/cancel`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mint: orden.mint, qty: orden.qty, sellerAddr: orden.sellerAddr, isNFT: false }),
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          const txBytes = Uint8Array.from(atob(data.transaction), c => c.charCodeAt(0));
          const tx = Transaction.from(txBytes);
          const raw = tx.serialize({ requireAllSignatures: false });
          await connection.sendRawTransaction(raw, { skipPreflight: false });
        }
      }
      await deleteDoc(doc(db,'orders',orden.firebaseId));
      toast(t('mktCancelOk'), 'info'); triggerRefresh();
    } catch (e) { toast('Error cancelando: ' + e.message, 'error'); }
    setIsExecuting(false);
  };

  // ── COMPRAR ORDEN DE VENTA ───────────────────────────────────────────────────
  const comprarOrden = async (orden) => {
    if (!wallet.connected) { toast('Conecta tu wallet.', 'error'); return; }
    if (!window.confirm(t('confirmBuy'))) return;
    setIsExecuting(true);
    try {
      // Worker construye tx atómica: SOL buyer→seller + tokens escrow→buyer
      const res = await fetch(`${PROXY}/market/sell/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint: orden.mint, qty: orden.qty, price: orden.price,
          sellerAddr: orden.sellerAddr, buyerAddr: wallet.publicKey.toBase58(),
          isNFT: orden.isNFT, nftCollection: orden.nftCollection,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.nftTransferClient) {
        // Para NFTs: enviar el pago SOL (worker ya firmó), luego el escrow entrega el NFT
        await sendWorkerTx(data.transaction);
        // El escrow (burner) entrega el NFT
        const umi = makeUmiBurner();
        await transferV1(umi, {
          asset: umiPublicKey(orden.mint), newOwner: umiPublicKey(wallet.publicKey.toBase58()),
          ...(orden.nftCollection ? { collection: umiPublicKey(orden.nftCollection) } : {}),
        }).sendAndConfirm(umi);
      } else {
        // SPL: tx atómica completa — buyer firma el pago SOL, escrow ya firmó la entrega de tokens
        await sendWorkerTx(data.transaction);
      }
      await deleteDoc(doc(db,'orders',orden.firebaseId));
      toast(t('successBuy'), 'success'); triggerRefresh();
    } catch (e) { toast('Error comprando: ' + e.message, 'error'); }
    setIsExecuting(false);
  };

  // ── EJECUTAR ORDEN DE COMPRA (vendedor acepta) ───────────────────────────────
  const ejecutarOrdenCompra = async (orden) => {
    if (!wallet.connected) { toast('Conecta tu wallet para vender.', 'error'); return; }
    if (!window.confirm(`¿Aceptar orden de compra? Entregarás ${orden.qty} ${orden.item} y recibirás ${(orden.qty*orden.price).toFixed(4)} SOL.`)) return;
    setIsExecuting(true);
    try {
      // Worker construye tx: SOL escrow→seller + tokens seller→buyer
      const res = await fetch(`${PROXY}/market/buy/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint: orden.mint, qty: orden.qty, price: orden.price,
          sellerAddr: wallet.publicKey.toBase58(), buyerAddr: orden.buyerAddr,
          isNFT: orden.isNFT, nftCollection: orden.nftCollection,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.nftTransferClient) {
        // Tx tiene el SOL del escrow → seller (escrow ya firmó)
        // El seller además transfiere el NFT
        await sendWorkerTx(data.transaction);
        const umi = makeUmiWallet();
        await transferV1(umi, {
          asset: umiPublicKey(orden.mint), newOwner: umiPublicKey(orden.buyerAddr),
          ...(orden.nftCollection ? { collection: umiPublicKey(orden.nftCollection) } : {}),
        }).sendAndConfirm(umi);
      } else {
        // SPL: tx atómica — seller firma la parte de tokens, escrow ya firmó el SOL
        await sendWorkerTx(data.transaction);
      }
      await deleteDoc(doc(db,'orders',orden.firebaseId));
      toast('✅ Venta completada.', 'success'); triggerRefresh();
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    setIsExecuting(false);
  };

  const esOrdenPropia = (orden) => {
    if (!wallet.connected) return false;
    if (orden.orderType === 'compra') return orden.buyerAddr === wallet.publicKey?.toBase58();
    return orden.sellerAddr === wallet.publicKey?.toBase58();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        select optgroup { background: #1a1208; color: var(--pf-gold); font-weight: bold; font-style: normal; font-size: 10px; letter-spacing: 0.05em; }
        select option { background: #120d05; color: #c8b89a; }
        select option:hover, select option:checked { background: #2a1f0a; }
      `}</style>
      <div className="alert-banner">{t('mktDemoBanner')}</div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setFilterSub(''); setFilterItem(''); }} className="axon-input" style={{minWidth:'200px'}}><option value="">{t('fltAllCat')}</option>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select>
        <select value={filterSub} onChange={(e) => { setFilterSub(e.target.value); setFilterItem(''); }} disabled={!filterCat} className="axon-input" style={{minWidth:'200px',opacity:filterCat?1:0.5}}><option value="">{t('fltAllSub')}</option>{subs.map(s=><option key={s} value={s}>{s}</option>)}</select>
        <select value={filterItem} onChange={(e) => setFilterItem(e.target.value)} disabled={!filterSub} className="axon-input" style={{minWidth:'200px',opacity:filterSub?1:0.5}}><option value="">{t('fltAllItem')}</option>{itemsFiltro.map(i=><option key={i} value={i}>{i}</option>)}</select>
        <button onClick={() => { setFilterCat(''); setFilterSub(''); setFilterItem(''); }} className="axon-btn-secondary" style={{padding:'10px 15px'}}>{t('fltClear')}</button>
      </div>

      <div style={{ display: 'flex', gap: '25px', flexGrow: 1, minHeight: 0 }}>

        {/* ── Libro de Órdenes ── */}
        <div className="glass-card" style={{ flex: 2.5, padding: '25px', display: 'flex', flexDirection: 'column' }}>
          {/* Header con desplegable */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <h3 style={{ color: 'var(--pf-gold-light)', margin: 0, fontSize: '18px', fontFamily: 'var(--font-heading)', whiteSpace: 'nowrap' }}>
              📋 Libro de Órdenes
            </h3>
            <select value={libroTipo} onChange={e => setLibroTipo(e.target.value)} className="axon-input" style={{ width: 'auto', padding: '6px 12px', fontSize: '11px', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>
              <option value="venta">📤 Órdenes de Venta</option>
              <option value="compra">📥 Órdenes de Compra</option>
            </select>
            <span style={{ fontSize: '11px', color: 'var(--pf-text-muted)', marginLeft: 'auto' }}>
              {ordenesFiltradas.length} {ordenesFiltradas.length === 1 ? 'orden' : 'órdenes'}
            </span>
          </div>

          <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '5px' }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th>{t('mktItem')}</th>
                  <th>{t('mktQty')}</th>
                  <th>{t('mktPrice')}</th>
                  <th>{t('mktTotal')}</th>
                  <th>{libroTipo === 'venta' ? t('mktSeller') : 'Comprador'}</th>
                  <th style={{ textAlign: 'right' }}>{t('mktAction')}</th>
                </tr>
              </thead>
              <tbody>
                {ordenesFiltradas.length === 0 ? (
                  <tr><td colSpan="6" className="empty-state" style={{ borderBottom: 'none' }}>
                    {libroTipo === 'venta' ? 'No hay órdenes de venta.' : 'No hay órdenes de compra.'}
                  </td></tr>
                ) : ordenesFiltradas.map((orden) => (
                  <tr key={orden.id}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {orden.img ? <img src={orden.img} className="item-icon" alt="" /> : <div className="item-icon-placeholder" />}
                      <span style={{ fontWeight: '600', color: 'var(--pf-text)' }}>{orden.item}</span>
                      {orden.isNFT && <span style={{ fontSize: '9px', color: 'var(--pf-gold)', border: '1px solid var(--pf-gold)', padding: '1px 5px', marginLeft: '4px', flexShrink: 0 }}>NFT</span>}
                    </td>
                    <td style={{ color: 'var(--pf-orange)', fontWeight: '600' }}>{orden.isNFT ? '1' : orden.qty}</td>
                    <td>{orden.price} <span style={{ fontSize: '10px', color: '#9945FF' }}>SOL</span></td>
                    <td style={{ color: 'var(--pf-gold)', fontWeight: '600' }}>{(orden.qty * orden.price).toFixed(4)} <span style={{ fontSize: '10px', color: '#9945FF' }}>SOL</span></td>
                    <td style={{ color: 'var(--pf-text-muted)', fontFamily: 'monospace' }} title={orden.orderType==='compra' ? orden.buyerAddr : orden.sellerAddr}>
                      {(orden.orderType==='compra' ? orden.buyerAddr : orden.sellerAddr)?.slice(0,4)}...{(orden.orderType==='compra' ? orden.buyerAddr : orden.sellerAddr)?.slice(-4)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {wallet.connected && esOrdenPropia(orden) ? (
                        <button onClick={() => cancelarOrden(orden)} disabled={isExecuting} className="axon-btn-danger">{t('mktCancel')}</button>
                      ) : libroTipo === 'venta' ? (
                        <button onClick={() => comprarOrden(orden)} disabled={isExecuting} className="axon-btn-primary" style={{ padding: '8px 15px', fontSize: '10px' }}><span>{t('mktBuy1Click')}</span></button>
                      ) : (
                        <button onClick={() => ejecutarOrdenCompra(orden)} disabled={isExecuting} className="axon-btn-primary" style={{ padding: '8px 15px', fontSize: '10px' }}><span>⚡ Vender</span></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Panel Crear Orden ── */}
        <div className="glass-card" style={{ flex: 1, padding: '25px', display: 'flex', flexDirection: 'column' }}>
          {/* Header con desplegable */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid var(--pf-border)' }}>
            <select value={panelTipo} onChange={e => { setPanelTipo(e.target.value); setSellQty(''); setSellPrice(''); setSelectedMatAddress(''); }} className="axon-input" style={{ width: '100%', padding: '8px 12px', fontSize: '12px', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em', color: panelTipo === 'venta' ? 'var(--pf-gold)' : '#4A90D9', borderColor: panelTipo === 'venta' ? 'var(--pf-gold)' : '#4A90D9' }}>
              <option value="venta">📤 Orden de Venta</option>
              <option value="compra">📥 Orden de Compra</option>
            </select>
          </div>

          {/* Descripción del tipo */}
          <div style={{ fontSize: '10px', color: 'var(--pf-text-muted)', marginBottom: '16px', padding: '8px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--pf-border)' }}>
            {panelTipo === 'venta'
              ? '📤 Publicas un asset a la venta. Se mueve a la Burn Wallet como garantía hasta que alguien compre o canceles.'
              : '📥 Publicas lo que quieres comprar. El SOL queda bloqueado como garantía. Cualquier vendedor puede aceptar.'}
          </div>

          {cuentas.length === 0 ? (
            <div className="empty-state" style={{ marginTop: '30px' }}>{t('mktNoAccs')}</div>
          ) : (
            <div className="form-group">

              {panelTipo === 'venta' ? (
                /* ── ORDEN DE VENTA: selector de wallet ── */
                <div>
                  <label className="form-label">{t('mktSellerWallet')}</label>
                  <select value={selectedCuenta} onChange={(e) => { setSelectedCuenta(e.target.value); setSelectedMatAddress(''); setSellQty(''); }} className="axon-input">
                    <option value="">{t('mktSelectAcc')}</option>
                    {cuentas.map(c => <option key={c.direccion} value={c.direccion}>{c.alias}</option>)}
                  </select>
                </div>
              ) : (
                /* ── ORDEN DE COMPRA: wallet conectada automática ── */
                <div>
                  <label className="form-label">Wallet de pago</label>
                  <div style={{ padding: '10px 12px', background: 'rgba(74,144,217,0.08)', border: '1px solid #4A90D9', fontSize: '11px', color: '#4A90D9', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>🔗</span>
                    <span>{wallet.connected ? (wallet.publicKey.toBase58().slice(0,6) + '...' + wallet.publicKey.toBase58().slice(-4)) : 'Conecta tu wallet'}</span>
                    {wallet.connected && <span style={{ marginLeft: 'auto', fontSize: '9px', opacity: 0.7 }}>Wallet conectada</span>}
                  </div>
                </div>
              )}

              {/* ── Selector de item ── */}
              <div>
                <label className="form-label">{panelTipo === 'venta' ? t('mktItem') : '¿Qué quieres comprar?'}</label>
                {panelTipo === 'venta' ? (
                  <select value={selectedMatAddress} onChange={(e) => { setSelectedMatAddress(e.target.value); setSellQty(''); }} disabled={!selectedCuenta} className="axon-input">
                    <option value="">{t('mktSelectMat')}</option>
                    {misMateriales.map(mat => <option key={mat.address} value={mat.address}>{mat.name} {mat.isNFT ? '· NFT' : `(Disp: ${mat.cantidad})`}</option>)}
                  </select>
                ) : (
                  /* Orden de compra: todos los items de Valannia por categoría */
                  <select value={selectedMatAddress} onChange={(e) => { setSelectedMatAddress(e.target.value); setSellQty(''); }} className="axon-input">
                    <option value="">Selecciona un item...</option>
                    {(() => {
                      const byCat = {};
                      tokensConfig.forEach(tk => {
                        const cat = tk.category || 'Otros';
                        const sub = tk.subcategory || 'General';
                        if (!byCat[cat]) byCat[cat] = {};
                        if (!byCat[cat][sub]) byCat[cat][sub] = [];
                        byCat[cat][sub].push(tk);
                      });
                      return Object.keys(byCat).sort().map(cat => (
                        Object.keys(byCat[cat]).sort().map(sub => (
                          <optgroup key={`${cat}__${sub}`} label={`${cat} › ${sub}`}>
                            {byCat[cat][sub].sort((a,b)=>a.name.localeCompare(b.name)).map(tk => (
                              <option key={tk.address} value={tk.address}>{tk.name}</option>
                            ))}
                          </optgroup>
                        ))
                      ));
                    })()}
                    {/* NFTs Core: catálogo completo de Valannia */}
                    <optgroup label="── NFTs · Maps › Madera ──">
                      {['Woodland Map','Grove Map','Forest Map','Dense Forest Map','Elderbark Forest Map','Ancient Woodland Map'].map(n=><option key={n} value={n}>{n}</option>)}
                    </optgroup>
                    <optgroup label="── NFTs · Maps › Agua ──">
                      {['Well Map','River Map','Reservoir Map','Deep Well Map','Wyrdspring Wells Map','Glacial Reservoir Map'].map(n=><option key={n} value={n}>{n}</option>)}
                    </optgroup>
                    <optgroup label="── NFTs · Maps › Mineral ──">
                      {['Copper Vein Map','Iron Vein Map','Cinnabar Vein Map','Luminite Vein Map','Scalemourn Vein Map','Small Crystal Vein Map','Medium Crystal Vein Map','Large Crystal Vein Map','Kronyx Vein Map'].map(n=><option key={n} value={n}>{n}</option>)}
                    </optgroup>
                    <optgroup label="── NFTs · Maps › Combustible ──">
                      {['Abandoned Camp Map','Excavation Site Map','Quarry Map','Pit Mine Map','Emberhollow Cavern Map','Deep Ember Pit Map'].map(n=><option key={n} value={n}>{n}</option>)}
                    </optgroup>
                    <optgroup label="── NFTs · Equipment › Armas ──">
                      {['Meadborne Sword','Meadborne Staff','Meadborne Bow','Flametongue Sword','Flametongue Staff','Flametongue Bow','Gleamspar Sword','Gleamspar Staff','Gleamspar Bow','Luminglade Sword','Luminglade Staff','Luminglade Bow','Luminglade Shield'].map(n=><option key={n} value={n}>{n}</option>)}
                    </optgroup>
                    <optgroup label="── NFTs · Equipment › Armadura ──">
                      {['Ironrot Chestplate','Ironrot Helmet','Ironrot Pants','Ironrot Boots','Ironrot Gauntlets','Petalsteel Chestplate','Petalsteel Helmet','Petalsteel Pants','Petalsteel Boots','Petalsteel Gauntlets','Violetfang Chestguard','Violetfang Helmet','Violetfang Pants','Violetfang Boots','Violetfang Cloak','Violetfang Gloves',"Apprentice's Tunic","Apprentice's Hat","Apprentice's Pants","Apprentice's Boots","Apprentice's Gloves","Apprentice's Cape",'Umberthread Tunic','Umberthread Hat','Umberthread Pants','Umberthread Boots','Umberthread Gloves','Umberthread Cape'].map(n=><option key={n} value={n}>{n}</option>)}
                    </optgroup>
                    <optgroup label="── NFTs · Equipment › Accesorios ──">
                      {['Copper Ring of Valannite','Copper Ring of Resistance','Iron Pendant of the Dragon','Infused Iron Ring of Valannite','Infused Iron Ring of Haste','Glasses','Rose Glasses','Pendant of Vital Surge','Ring of Pulse',"Ring of Artisan's Flow",'Powergleam Orb','Quickspark Pendant','Wardbound Orb','Heartgrasp Ring','Guardflow Pendant','Dragonbreath Orb','Guardseal Pendant','Fortress Orb'].map(n=><option key={n} value={n}>{n}</option>)}
                    </optgroup>
                    <optgroup label="── NFTs · Collectibles › Badges ──">
                      {['1st Place Silvermoon Crafting Festival Badge','Grand Assembly II Coin','Grand Assembly III Coin','Spectral Mirror','Krazy Keg - Valannium Edition'].map(n=><option key={n} value={n}>{n}</option>)}
                    </optgroup>
                    <optgroup label="── NFTs · Héroes › Origin ──">
                      {['Bubuk','Dexar','Glorb','Isolde','Kahelu','Kehkai','Lady Moonrise','Master Kapuana','Mcallister','Melisande','Netheros','Olravenour','Olvaney','Oxyboro','Quarthani','Queen Alia','Quelthor','Razuzel','Sir Arcturus','The Great Snake','Whisker','Xyra','Zeltharis','Zlurp'].map(n=><option key={n} value={n}>{n}</option>)}
                    </optgroup>
                    <optgroup label="── NFTs · Héroes › Beyond ──">
                      {['Akheton','Blaat','Cercunos','Grunk','Olaventis','Parlok','Phylune','Rakka','Reb Heron','Sir Augustus','Sir Kastain','Sir Mandrake','The Yellow Knight','Zeferlin Quorax','Zindara','Zorvan'].map(n=><option key={n} value={n}>{n}</option>)}
                    </optgroup>
                    <optgroup label="── NFTs · Héroes › Risen ──">
                      {['Faerin Plumadorada','Garathos','Malik','Mirix Troumbach','Sir Orion','Thrak','Vintharis','Yzmari'].map(n=><option key={n} value={n}>{n}</option>)}
                    </optgroup>
                    <optgroup label="── NFTs · Herramientas ──">
                      {['Glorb Toolbox','Glorb Toolbox Blueprint','Nyxu'].map(n=><option key={n} value={n}>{n}</option>)}
                    </optgroup>
                  </select>
                )}
              </div>

              {!materialSeleccionadoObjeto?.isNFT && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>{panelTipo === 'venta' ? t('mktQtyToSell') : 'Cantidad que quieres'}</label>
                    {panelTipo === 'venta' && materialSeleccionadoObjeto && (
                      <span className="max-btn" onClick={() => setSellQty(materialSeleccionadoObjeto.cantidad)}>MAX</span>
                    )}
                  </div>
                  <input type="number" placeholder="Ej: 100" value={sellQty} onChange={(e) => setSellQty(e.target.value)} className="axon-input" />
                </div>
              )}

              <div>
                <label className="form-label">{panelTipo === 'venta' ? t('mktPrice') : 'Precio por unidad que ofreces'}</label>
                <div className="input-with-suffix">
                  <input type="number" placeholder={t('mktSetPrice')} value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} className="axon-input" style={{ border: 'none', background: 'transparent' }} />
                  <span className="suffix" style={{ color: '#9945FF' }}>SOL</span>
                </div>
              </div>

              <div className="summary-box" style={{ borderColor: panelTipo === 'compra' ? '#4A90D9' : undefined }}>
                <span style={{ fontSize: '12px', color: 'var(--pf-text-muted)' }}>
                  {panelTipo === 'venta' ? t('mktReceiveExact') : 'SOL que bloquearás como garantía'}
                </span>
                <div style={{ fontSize: '22px', color: panelTipo==='venta' ? 'var(--pf-gold)' : '#4A90D9', fontWeight: 'bold', margin: '5px 0' }}>
                  {materialSeleccionadoObjeto?.isNFT ? (sellPrice||'0') : totalRecibir}
                  <span style={{ color: '#9945FF', fontSize: '16px' }}> SOL</span>
                </div>
              </div>

              <button
                onClick={panelTipo === 'venta' ? crearOrdenVenta : crearOrdenCompra}
                disabled={isExecuting || (panelTipo === 'compra' && !wallet.connected)}
                style={{
                  width: '100%', marginTop: '10px',
                  padding: '14px', cursor: 'pointer',
                  fontFamily: 'var(--font-heading)', letterSpacing: '0.15em',
                  fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
                  opacity: (isExecuting || (panelTipo==='compra' && !wallet.connected)) ? 0.5 : 1,
                  background: panelTipo === 'compra' ? 'linear-gradient(135deg, #1a3a5c, #1e5080)' : 'var(--pf-orange)',
                  border: `1px solid ${panelTipo === 'compra' ? '#4A90D9' : 'var(--pf-orange)'}`,
                  color: '#fff',
                  transition: '0.2s',
                }}
              >
                {isExecuting ? '⏳ Procesando...' : panelTipo === 'venta' ? '📤 Publicar Venta' : '📥 Publicar Compra'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


const VALANNIA_RECIPES = {"Explorer Survey 1-1":{"p":"Explorer","l":1,"t":"Craft","s":10800,"i":[["Paper",1]],"o":[]},"Explorer Survey 2-1":{"p":"Explorer","l":2,"t":"Craft","s":10800,"i":[["Paper",1]],"o":[]},"Explorer Survey 3-1":{"p":"Explorer","l":3,"t":"Craft","s":10800,"i":[["Paper",5]],"o":[]},"Explorer Survey 4-1":{"p":"Explorer","l":4,"t":"Craft","s":10800,"i":[["Paper",5]],"o":[]},"Explorer Survey 5-1":{"p":"Explorer","l":5,"t":"Craft","s":14400,"i":[["Canvas Paper",1]],"o":[]},"Explorer Survey 6-1":{"p":"Explorer","l":6,"t":"Craft","s":14400,"i":[["Canvas Paper",1]],"o":[]},"Explorer Survey 7-1":{"p":"Explorer","l":7,"t":"Craft","s":16200,"i":[["Hideleaf",1]],"o":[]},"Explorer Survey 8-1":{"p":"Explorer","l":8,"t":"Craft","s":16200,"i":[["Hideleaf",1]],"o":[]},"Explorer Survey 9-1":{"p":"Explorer","l":9,"t":"Craft","s":18000,"i":[["Heartspire Scroll",1]],"o":[]},"Explorer Survey 10-1":{"p":"Explorer","l":10,"t":"Craft","s":18000,"i":[["Heartspire Scroll",1]],"o":[]},"Explorer Pet 2-1":{"p":"Explorer","l":2,"t":"Pet","s":3600,"i":[["Water",5]],"o":["Meat"]},"Explorer Pet 4-1":{"p":"Explorer","l":4,"t":"Pet","s":3600,"i":[["Water",6]],"o":["Meat"]},"Explorer Pet 6-1":{"p":"Explorer","l":6,"t":"Pet","s":3600,"i":[["Water",7]],"o":["Meat"]},"Explorer Pet 8-1":{"p":"Explorer","l":8,"t":"Pet","s":5400,"i":[["Stormwater",5]],"o":["Meat"]},"Miner Excavation 1-1":{"p":"Miner","l":1,"t":"Craft","s":7200,"i":[["Pickaxe",1]],"o":["Copper Ore"]},"Miner Excavation 1-2":{"p":"Miner","l":1,"t":"Craft","s":7200,"i":[["Shovel",1]],"o":["Charcoal"]},"Miner Excavation 1-3":{"p":"Miner","l":1,"t":"Craft","s":7200,"i":[["Small Crystal Vein Map",1],["Pickaxe",1]],"o":["Small Crystal"]},"Miner Excavation 2-1":{"p":"Miner","l":2,"t":"Craft","s":7200,"i":[["Pickaxe",1]],"o":["Copper Ore","Iron Ore"]},"Miner Excavation 2-2":{"p":"Miner","l":2,"t":"Craft","s":7200,"i":[["Shovel",1]],"o":["Charcoal","Coal"]},"Miner Excavation 3-1":{"p":"Miner","l":3,"t":"Craft","s":7200,"i":[["Iron Pickaxe",1]],"o":["Iron Ore"]},"Miner Excavation 3-2":{"p":"Miner","l":3,"t":"Craft","s":7200,"i":[["Iron Shovel",1]],"o":["Coal"]},"Miner Excavation 3-3":{"p":"Miner","l":3,"t":"Craft","s":10800,"i":[["Medium Crystal Vein Map",1],["Pickaxe",1]],"o":["Medium Crystal"]},"Miner Excavation 4-1":{"p":"Miner","l":4,"t":"Craft","s":7200,"i":[["Iron Pickaxe",1]],"o":["Iron Ore","Cinnabar Ore"]},"Miner Excavation 4-2":{"p":"Miner","l":4,"t":"Craft","s":7200,"i":[["Iron Shovel",1]],"o":["Coal","Meldstone"]},"Miner Excavation 5-2":{"p":"Miner","l":5,"t":"Craft","s":9000,"i":[["Quicksilver Pickaxe",1]],"o":["Cinnabar Ore"]},"Miner Excavation 5-3":{"p":"Miner","l":5,"t":"Craft","s":9000,"i":[["Quicksilver Shovel",1]],"o":["Meldstone"]},"Miner Excavation 5-1":{"p":"Miner","l":5,"t":"Craft","s":14400,"i":[["Large Crystal Vein Map",1],["Pickaxe",1]],"o":["Large Crystal"]},"Miner Extraction 6-1":{"p":"Miner","l":6,"t":"Craft","s":9000,"i":[["Extraction Pipe",1]],"o":["Blackblood","Mirrormist"]},"Miner Excavation 6-2":{"p":"Miner","l":6,"t":"Craft","s":9000,"i":[["Quicksilver Pickaxe",1]],"o":["Cinnabar Ore","Luminite Ore"]},"Miner Excavation 6-3":{"p":"Miner","l":6,"t":"Craft","s":9000,"i":[["Quicksilver Shovel",1]],"o":["Meldstone","Moonslate"]},"Miner Excavation 7-1 Down":{"p":"Miner","l":7,"t":"Craft","s":14400,"i":[["Quicksilver Pickaxe",1]],"o":["Luminite Ore"]},"Miner Excavation 7-2 Down":{"p":"Miner","l":7,"t":"Craft","s":14400,"i":[["Quicksilver Shovel",1]],"o":["Moonslate"]},"Miner Excavation 7-1":{"p":"Miner","l":7,"t":"Craft","s":14400,"i":[["Luminite Pickaxe",1]],"o":["Luminite Ore"]},"Miner Excavation 7-2":{"p":"Miner","l":7,"t":"Craft","s":14400,"i":[["Luminite Shovel",1]],"o":["Moonslate"]},"Miner Excavation 8-1 Down":{"p":"Miner","l":8,"t":"Craft","s":14400,"i":[["Quicksilver Pickaxe",1]],"o":["Luminite Ore","Kronyx Ore"]},"Miner Excavation 8-2 Down":{"p":"Miner","l":8,"t":"Craft","s":14400,"i":[["Quicksilver Shovel",1]],"o":["Moonslate","Pyrestarter"]},"Miner Excavation 8-1":{"p":"Miner","l":8,"t":"Craft","s":14400,"i":[["Kronscale Pickaxe",1]],"o":["Luminite Ore","Kronyx Ore"]},"Miner Excavation 8-2":{"p":"Miner","l":8,"t":"Craft","s":14400,"i":[["Kronscale Shovel",1]],"o":["Moonslate","Pyrestarter"]},"Miner Excavation 9-1 Down":{"p":"Miner","l":9,"t":"Craft","s":19800,"i":[["Kronscale Pickaxe",1]],"o":["Kronyx Ore"]},"Miner Excavation 9-2 Down":{"p":"Miner","l":9,"t":"Craft","s":19800,"i":[["Kronscale Shovel",1]],"o":["Pyrestarter"]},"Miner Extraction 1-1":{"p":"Miner","l":1,"t":"Craft","s":7200,"i":[["Bucket",1]],"o":["Water"]},"Miner Extraction 2-1":{"p":"Miner","l":2,"t":"Craft","s":7200,"i":[["Bucket",1]],"o":["Water","Stormwater"]},"Miner Extraction 3-1":{"p":"Miner","l":3,"t":"Craft","s":7200,"i":[["Improved Bucket",1]],"o":["Stormwater"]},"Miner Extraction 3-2":{"p":"Miner","l":3,"t":"Craft","s":3600,"i":[["Shovel",1]],"o":["Clay"]},"Miner Extraction 4-1":{"p":"Miner","l":4,"t":"Craft","s":7200,"i":[["Improved Bucket",1]],"o":["Stormwater","Blackblood"]},"Miner Extraction 5-1":{"p":"Miner","l":5,"t":"Craft","s":9000,"i":[["Extraction Pipe",1]],"o":["Blackblood"]},"Miner Extraction 7-1 Down":{"p":"Miner","l":7,"t":"Craft","s":14400,"i":[["Plumhide Bucket",1]],"o":["Mirrormist"]},"Miner Extraction 7-1":{"p":"Miner","l":7,"t":"Craft","s":14400,"i":[["Heartspire Bucket",1]],"o":["Mirrormist"]},"Miner Extraction 8-1 Down":{"p":"Miner","l":8,"t":"Craft","s":14400,"i":[["Improved Bucket",1]],"o":["Mirrormist","Elderwater"]},"Miner Extraction 8-1":{"p":"Miner","l":8,"t":"Craft","s":14400,"i":[["Plumhide Bucket",1]],"o":["Mirrormist","Elderwater"]},"Miner Extraction 9-1 Down":{"p":"Miner","l":9,"t":"Craft","s":19800,"i":[["Heartspire Bucket",1]],"o":["Elderwater"]},"Miner Extraction 9-1":{"p":"Miner","l":9,"t":"Craft","s":14400,"i":[["Nightwood Bucket",1]],"o":["Elderwater"]},"Miner Extraction 10-1 Down":{"p":"Miner","l":10,"t":"Craft","s":19800,"i":[["Luminite Shovel",1]],"o":["Pyrestarter"]},"Miner Extraction 10-1":{"p":"Miner","l":10,"t":"Craft","s":16200,"i":[["Kronscale Shovel",1]],"o":["Pyrestarter"]},"Miner Extraction 10-2 Down":{"p":"Miner","l":10,"t":"Craft","s":19800,"i":[["Luminite Pickaxe",1]],"o":["Kronyx Ore"]},"Miner Extraction 10-2":{"p":"Miner","l":10,"t":"Craft","s":16200,"i":[["Kronscale Pickaxe",1]],"o":["Kronyx Ore"]},"Artisan Farm 1-1":{"p":"Artisan","l":1,"t":"Craft","s":7200,"i":[["Axe",1]],"o":["Softwood","Softwood Fibers"]},"Artisan Farm 2-1":{"p":"Artisan","l":2,"t":"Craft","s":7200,"i":[["Axe",1]],"o":["Softwood","Softwood Fibers"]},"Artisan Farm 3-1":{"p":"Artisan","l":3,"t":"Craft","s":7200,"i":[["Iron Axe",1]],"o":["Hardwood","Hardwood Fibers"]},"Artisan Farm 4-1":{"p":"Artisan","l":4,"t":"Craft","s":7200,"i":[["Iron Axe",1]],"o":["Hardwood","Hardwood Fibers"]},"Artisan Farm 5-1":{"p":"Artisan","l":5,"t":"Craft","s":9000,"i":[["Quicksilver Saw",1]],"o":["Plumhide","Plumhide Fibers"]},"Artisan Farm 6-1":{"p":"Artisan","l":6,"t":"Craft","s":9000,"i":[["Quicksilver Saw",1]],"o":["Plumhide","Plumhide Fibers"]},"Artisan Farm 7-1 Down":{"p":"Artisan","l":7,"t":"Craft","s":14400,"i":[["Quicksilver Saw",1]],"o":["Heartspire","Heartspire Fibers"]},"Artisan Farm 7-1":{"p":"Artisan","l":7,"t":"Craft","s":14400,"i":[["Luminite Axe",1]],"o":["Heartspire","Heartspire Fibers"]},"Artisan Farm 8-1":{"p":"Artisan","l":8,"t":"Craft","s":14400,"i":[["Luminite Axe",1]],"o":["Heartspire","Heartspire Fibers"]},"Artisan Farm 9-1 Down":{"p":"Artisan","l":9,"t":"Craft","s":19800,"i":[["Luminite Axe",1]],"o":["Nightwood","Nightwood Fibers"]},"Artisan Farm 9-1":{"p":"Artisan","l":9,"t":"Craft","s":16200,"i":[["Superior Luminite Axe",1]],"o":["Nightwood","Nightwood Fibers"]},"Artisan Craft 1-1":{"p":"Artisan","l":1,"t":"Craft","s":3600,"i":[["Softwood Fibers",1],["Water",1]],"o":["Paper"]},"Artisan Craft 1-2":{"p":"Artisan","l":1,"t":"Craft","s":3600,"i":[["Softwood Fibers",4]],"o":["Cloth"]},"Artisan Craft 1-3":{"p":"Artisan","l":1,"t":"Craft","s":3600,"i":[["Cloth",1]],"o":["Cloth Tool Grip"]},"Artisan Craft 2-1":{"p":"Artisan","l":2,"t":"Craft","s":3600,"i":[["Softwood Beam",1],["Cloth",2]],"o":["Cloth Canopy"]},"Artisan Craft 2-2":{"p":"Artisan","l":2,"t":"Craft","s":3600,"i":[["Softwood",1]],"o":["Softwood Fibers"]},"Artisan Craft 2-3":{"p":"Artisan","l":2,"t":"Craft","s":7200,"i":[["Cloth",3]],"o":["Apprentice's Tunic"]},"Artisan Craft 2-4":{"p":"Artisan","l":2,"t":"Craft","s":7200,"i":[["Cloth",2],["Softwood Fibers",1]],"o":["Apprentice's Hat"]},"Artisan Craft 2-5":{"p":"Artisan","l":2,"t":"Craft","s":7200,"i":[["Cloth",3],["Softwood Fibers",2]],"o":["Apprentice's Pants"]},"Artisan Craft 2-6":{"p":"Artisan","l":2,"t":"Craft","s":7200,"i":[["Cloth",2],["Boots",1]],"o":["Apprentice's Boots"]},"Artisan Craft 2-7":{"p":"Artisan","l":2,"t":"Craft","s":7200,"i":[["Cloth",2]],"o":["Apprentice's Gloves"]},"Artisan Craft 2-8":{"p":"Artisan","l":2,"t":"Craft","s":7200,"i":[["Cloth",4]],"o":["Apprentice's Cape"]},"Artisan Craft 3-2":{"p":"Artisan","l":3,"t":"Craft","s":3600,"i":[["Hardwood Fibers",2]],"o":["Canvas"]},"Artisan Craft 3-3":{"p":"Artisan","l":3,"t":"Craft","s":3600,"i":[["Hardwood Fibers",2]],"o":["Twisted Cord"]},"Artisan Craft 3-4":{"p":"Artisan","l":3,"t":"Craft","s":3600,"i":[["Canvas",1],["Twisted Cord",1]],"o":["Boots"]},"Artisan Craft 3-5":{"p":"Artisan","l":3,"t":"Craft","s":3600,"i":[["Hardwood Fibers",1],["Water",1],["Canvas",1]],"o":["Canvas Paper"]},"Artisan Craft 3-6":{"p":"Artisan","l":3,"t":"Craft","s":3600,"i":[["Canvas",1]],"o":["Canvas Tool Grip"]},"Artisan Craft 4-1":{"p":"Artisan","l":4,"t":"Craft","s":3600,"i":[["Hardwood Beam",1],["Canvas",2]],"o":["Canvas Canopy"]},"Artisan Craft 4-2":{"p":"Artisan","l":4,"t":"Craft","s":14400,"i":[["Canvas",3],["Twisted Cord",1]],"o":["Umberthread Tunic"]},"Artisan Craft 4-3":{"p":"Artisan","l":4,"t":"Craft","s":14400,"i":[["Canvas",2],["Twisted Cord",1]],"o":["Umberthread Hat"]},"Artisan Craft 4-4":{"p":"Artisan","l":4,"t":"Craft","s":14400,"i":[["Canvas",2],["Twisted Cord",2]],"o":["Umberthread Pants"]},"Artisan Craft 4-5":{"p":"Artisan","l":4,"t":"Craft","s":14400,"i":[["Canvas",2],["Twisted Cord",1],["Boots",1]],"o":["Umberthread Boots"]},"Artisan Craft 4-6":{"p":"Artisan","l":4,"t":"Craft","s":14400,"i":[["Canvas",1],["Twisted Cord",2]],"o":["Umberthread Gloves"]},"Artisan Craft 4-7":{"p":"Artisan","l":4,"t":"Craft","s":14400,"i":[["Canvas",4],["Twisted Cord",1]],"o":["Umberthread Cape"]},"Artisan Craft 4-8":{"p":"Artisan","l":4,"t":"Craft","s":3600,"i":[["Hardwood",1]],"o":["Hardwood Fibers"]},"Artisan Craft 5-1":{"p":"Artisan","l":5,"t":"Craft","s":5400,"i":[["Plumhide Fibers",4]],"o":["Leather"]},"Artisan Craft 5-2":{"p":"Artisan","l":5,"t":"Craft","s":5040,"i":[["Plumhide Fibers",2]],"o":["Braided Line"]},"Artisan Craft 5-3":{"p":"Artisan","l":5,"t":"Craft","s":6480,"i":[["Leather",1]],"o":["Leather Tool Grip"]},"Artisan Craft 5-4":{"p":"Artisan","l":5,"t":"Craft","s":5400,"i":[["Plumhide Fibers",1],["Stormwater",1],["Leather",1]],"o":["Hideleaf"]},"Artisan Craft 5-5":{"p":"Artisan","l":5,"t":"Craft","s":7200,"i":[["Leather",1],["Braided Line",1]],"o":["Flexstitch Reinforcement"]},"Artisan Craft 6-1":{"p":"Artisan","l":6,"t":"Craft","s":7200,"i":[["Leather",2],["Iron Ingot",1]],"o":["Leather Straps"]},"Artisan Craft 6-2":{"p":"Artisan","l":6,"t":"Craft","s":10800,"i":[["Leather",2],["Braided Line",1]],"o":["Leather Sack"]},"Artisan Craft 6-3":{"p":"Artisan","l":6,"t":"Craft","s":3600,"i":[["Plumhide",1]],"o":["Plumhide Fibers"]},"Artisan Craft 7-1":{"p":"Artisan","l":7,"t":"Craft","s":7200,"i":[["Heartspire Fibers",4]],"o":["Heartspire Cloth"]},"Artisan Craft 7-2":{"p":"Artisan","l":7,"t":"Craft","s":5400,"i":[["Heartspire Fibers",2]],"o":["Heartspire Rope"]},"Artisan Craft 7-3":{"p":"Artisan","l":7,"t":"Craft","s":5400,"i":[["Heartspire Fibers",1],["Blackblood",1],["Heartspire Cloth",1]],"o":["Heartspire Scroll"]},"Artisan Craft 7-4":{"p":"Artisan","l":7,"t":"Craft","s":43200,"i":[["Hardwood Beam",2],["Twisted Cord",4],["Canvas",5],["Moon Ash",4],["Leather",6],["Heartspire Cloth",5]],"o":["Guild Banner"]},"Artisan Craft 7-5":{"p":"Artisan","l":7,"t":"Craft","s":18000,"i":[["Leather",5],["Braided Line",1]],"o":["Violetfang Cloak"]},"Artisan Craft 7-6":{"p":"Artisan","l":7,"t":"Craft","s":18000,"i":[["Leather",2],["Braided Line",1]],"o":["Violetfang Gloves"]},"Artisan Craft 7-7":{"p":"Artisan","l":7,"t":"Craft","s":18000,"i":[["Leather",3],["Braided Line",1]],"o":["Violetfang Pants"]},"Artisan Craft 7-8":{"p":"Artisan","l":7,"t":"Craft","s":18000,"i":[["Leather",2],["Braided Line",1],["Hardwood",1],["Boots",1],["Leather Straps",1]],"o":["Violetfang Boots"]},"Artisan Craft 7-9":{"p":"Artisan","l":7,"t":"Craft","s":18000,"i":[["Leather",6],["Iron Ingot",1],["Tyxen Toolkit",1],["Quicksilver Ingot",1]],"o":["Violetfang Chestguard"]},"Artisan Craft 7-10":{"p":"Artisan","l":7,"t":"Craft","s":18000,"i":[["Leather",3],["Tyxen Toolkit",1],["Quicksilver Ingot",1]],"o":["Violetfang Helmet"]},"Artisan Craft 7-11":{"p":"Artisan","l":7,"t":"Craft","s":7200,"i":[["Heartspire Cloth",1]],"o":["Heartspire Tool Grip"]},"Artisan Craft 8-1":{"p":"Artisan","l":8,"t":"Craft","s":3600,"i":[["Heartspire",1]],"o":["Heartspire Fibers"]},"Artisan Craft 8-2":{"p":"Artisan","l":8,"t":"Craft","s":12600,"i":[["Heartspire Cloth",2],["Heartspire Rope",2]],"o":["Heartspire Pouch"]},"Artisan Craft 8-3":{"p":"Artisan","l":8,"t":"Craft","s":8100,"i":[["Heartspire Cloth",1],["Heartspire Rope",1]],"o":["Heartspire Reinforcement"]},"Artisan Craft 9-1":{"p":"Artisan","l":9,"t":"Craft","s":6300,"i":[["Nightwood Fibers",1],["Elderwater",1],["Heartspire Cloth",1]],"o":["Nightwood Paper"]},"Artisan Craft 9-2":{"p":"Artisan","l":9,"t":"Craft","s":7200,"i":[["Nightwood Fibers",4]],"o":["Nightwood Cloth"]},"Artisan Craft 9-3":{"p":"Artisan","l":9,"t":"Craft","s":6300,"i":[["Nightwood Fibers",4]],"o":["Nightwood Rope"]},"Artisan Craft 9-4":{"p":"Artisan","l":9,"t":"Craft","s":8100,"i":[["Nightwood Cloth",1]],"o":["Nightwood Tool Grip"]},"Artisan Craft 10-1":{"p":"Artisan","l":10,"t":"Craft","s":19800,"i":[["Heartspire Cloth",4],["Heartspire Rope",2]],"o":["Heartspire Cape"]},"Artisan Craft 10-2":{"p":"Artisan","l":10,"t":"Craft","s":19800,"i":[["Heartspire Cloth",1],["Heartspire Rope",2]],"o":["Heartspire Gloves"]},"Artisan Craft 10-3":{"p":"Artisan","l":10,"t":"Craft","s":19800,"i":[["Heartspire Cloth",2],["Heartspire Rope",2],["Boots",1]],"o":["Heartspire Boots"]},"Artisan Craft 10-4":{"p":"Artisan","l":10,"t":"Craft","s":9000,"i":[["Heartspire Cloth",2],["Quicksilver Ingot",1]],"o":["Heartspire Straps"]},"Artisan Craft 10-5":{"p":"Artisan","l":10,"t":"Craft","s":5400,"i":[["Nightwood",1]],"o":["Nightwood Fibers"]},"Engineer Design 1-2":{"p":"Engineer","l":1,"t":"Craft","s":3600,"i":[["Paper",1]],"o":["Axe Blueprint"]},"Engineer Design 1-3":{"p":"Engineer","l":1,"t":"Craft","s":3600,"i":[["Paper",1]],"o":["Shovel Blueprint"]},"Engineer Design 1-4":{"p":"Engineer","l":1,"t":"Craft","s":3600,"i":[["Paper",1]],"o":["Pickaxe Blueprint"]},"Engineer Design 1-5":{"p":"Engineer","l":1,"t":"Craft","s":3600,"i":[["Paper",1]],"o":["Bucket Blueprint"]},"Engineer Design 1-6":{"p":"Engineer","l":1,"t":"Craft","s":3600,"i":[["Paper",1]],"o":["Glorb Toolbox Blueprint"]},"Engineer Design 3-2":{"p":"Engineer","l":3,"t":"Craft","s":3600,"i":[["Canvas Paper",1]],"o":["Iron Axe Blueprint"]},"Engineer Design 3-3":{"p":"Engineer","l":3,"t":"Craft","s":3600,"i":[["Canvas Paper",1]],"o":["Iron Shovel Blueprint"]},"Engineer Design 3-4":{"p":"Engineer","l":3,"t":"Craft","s":3600,"i":[["Canvas Paper",1]],"o":["Iron Pickaxe Blueprint"]},"Engineer Design 3-5":{"p":"Engineer","l":3,"t":"Craft","s":3600,"i":[["Canvas Paper",1]],"o":["Improved Bucket Blueprint"]},"Engineer Design 3-7":{"p":"Engineer","l":3,"t":"Craft","s":3600,"i":[["Canvas Paper",1]],"o":["Wheel Blueprint"]},"Engineer Design 3-8":{"p":"Engineer","l":3,"t":"Craft","s":3600,"i":[["Canvas Paper",1]],"o":["Tyxen Toolkit Blueprint"]},"Engineer Design 5-1":{"p":"Engineer","l":5,"t":"Craft","s":7200,"i":[["Paper",1],["Hideleaf",1]],"o":["Saw Blueprint"]},"Engineer Design 5-2":{"p":"Engineer","l":5,"t":"Craft","s":7200,"i":[["Paper",1],["Hideleaf",1]],"o":["Quicksilver Pickaxe Blueprint"]},"Engineer Design 5-3":{"p":"Engineer","l":5,"t":"Craft","s":7200,"i":[["Paper",1],["Hideleaf",1]],"o":["Quicksilver Shovel Blueprint"]},"Engineer Design 5-4":{"p":"Engineer","l":5,"t":"Craft","s":7200,"i":[["Paper",1],["Hideleaf",1]],"o":["Extraction Pipe Blueprint"]},"Engineer Design 5-5":{"p":"Engineer","l":5,"t":"Craft","s":7200,"i":[["Paper",1],["Hideleaf",1]],"o":["Alchemical Flask Blueprint"]},"Engineer Design 5-6":{"p":"Engineer","l":5,"t":"Craft","s":7200,"i":[["Paper",1],["Hideleaf",1]],"o":["Pulley Blueprint"]},"Engineer Design 5-7":{"p":"Engineer","l":5,"t":"Craft","s":7200,"i":[["Paper",1],["Hideleaf",1]],"o":["Plumhide Bucket Blueprint"]},"Engineer Design 6-1":{"p":"Engineer","l":6,"t":"Craft","s":28800,"i":[["Hideleaf",1],["Tome of Constructive Order",2]],"o":["Engine Blueprint"]},"Engineer Design 6-2":{"p":"Engineer","l":6,"t":"Craft","s":14400,"i":[["Hideleaf",1],["Tome of Constructive Order",2]],"o":["Gate Blueprint"]},"Engineer Design 7-1":{"p":"Engineer","l":7,"t":"Craft","s":7200,"i":[["Heartspire Scroll",1]],"o":["Compass Blueprint"]},"Engineer Design 7-2":{"p":"Engineer","l":7,"t":"Craft","s":7200,"i":[["Heartspire Scroll",1]],"o":["Alembic and Retort Blueprint"]},"Engineer Design 7-3":{"p":"Engineer","l":8,"t":"Craft","s":259200,"i":[["Heartspire Scroll",1],["Tome of Constructive Order",1]],"o":["Stronghold Blueprint"]},"Engineer Design 7-4":{"p":"Engineer","l":8,"t":"Craft","s":36000,"i":[["Heartspire Scroll",1],["Tome of Constructive Order",1]],"o":["Logging Machine Blueprint"]},"Engineer Design 7-5":{"p":"Engineer","l":8,"t":"Craft","s":36000,"i":[["Heartspire Scroll",1],["Tome of Constructive Order",1]],"o":["Extraction Tower Blueprint"]},"Engineer Design 7-6":{"p":"Engineer","l":7,"t":"Craft","s":7200,"i":[["Heartspire Scroll",1]],"o":["Luminite Axe Blueprint"]},"Engineer Design 7-7":{"p":"Engineer","l":7,"t":"Craft","s":7200,"i":[["Heartspire Scroll",1]],"o":["Luminite Pickaxe Blueprint"]},"Engineer Design 7-8":{"p":"Engineer","l":7,"t":"Craft","s":7200,"i":[["Heartspire Scroll",1]],"o":["Luminite Shovel Blueprint"]},"Engineer Design 7-9":{"p":"Engineer","l":7,"t":"Craft","s":7200,"i":[["Heartspire Scroll",1]],"o":["Heartspire Bucket Blueprint"]},"Engineer Design 8-1":{"p":"Engineer","l":8,"t":"Craft","s":7200,"i":[["Heartspire Scroll",1]],"o":["Luminite Toolkit Blueprint"]},"Engineer Design 9-1":{"p":"Engineer","l":9,"t":"Craft","s":7200,"i":[["Nightwood Paper",1]],"o":["Superior Luminite Axe Blueprint"]},"Engineer Design 9-2":{"p":"Engineer","l":9,"t":"Craft","s":7200,"i":[["Nightwood Paper",1]],"o":["Nightwood Bucket Blueprint"]},"Engineer Design 9-3":{"p":"Engineer","l":9,"t":"Craft","s":7200,"i":[["Nightwood Paper",1]],"o":["Heavy Lift Crane Blueprint"]},"Engineer Design 10-1":{"p":"Engineer","l":10,"t":"Craft","s":7200,"i":[["Nightwood Paper",1]],"o":["Kronscale Shovel Blueprint"]},"Engineer Design 10-2":{"p":"Engineer","l":10,"t":"Craft","s":7200,"i":[["Nightwood Paper",1]],"o":["Kronscale Pickaxe Blueprint"]},"Engineer Component 1-4":{"p":"Engineer","l":1,"t":"Craft","s":3600,"i":[["Copper Ingot",2]],"o":["Copper Wire"]},"Engineer Component 2-1":{"p":"Engineer","l":2,"t":"Craft","s":3600,"i":[["Glorb Toolbox",1],["Softwood Beam",2]],"o":["Frame"]},"Engineer Component 4-1":{"p":"Engineer","l":4,"t":"Craft","s":3600,"i":[["Wheel Blueprint",1],["Iron Hoop",1],["Hardwood Plank",1],["Tyxen Toolkit",1]],"o":["Wheel"]},"Engineer Component 4-2":{"p":"Engineer","l":4,"t":"Craft","s":3600,"i":[["Tyxen Toolkit",1],["Hardwood Beam",2]],"o":["Hardwood Frame"]},"Engineer Component 5-1":{"p":"Engineer","l":5,"t":"Craft","s":5400,"i":[["Glass",1],["Alchemical Flask Blueprint",1],["Plumhide",1]],"o":["Alchemical Flask"]},"Engineer Component 6-1":{"p":"Engineer","l":6,"t":"Craft","s":10800,"i":[["Iron Ingot",1],["Iron Hoop",4],["Pulley Blueprint",1],["Braided Line",4],["Plumhide",2]],"o":["Pulley"]},"Engineer Component 6-2":{"p":"Engineer","l":6,"t":"Craft","s":10800,"i":[["Leather",2],["Paper",15],["Braided Line",1]],"o":["Tome of Constructive Order"]},"Engineer Component 6-3":{"p":"Engineer","l":6,"t":"Craft","s":86400,"i":[["Engine Blueprint",1],["Quicksilver Ingot",4],["Copper Wire",20],["Iron Ingot",10],["Tyxen Toolkit",8],["Machine Chassis",1]],"o":["Engine"]},"Engineer Component 6-4":{"p":"Engineer","l":6,"t":"Craft","s":43200,"i":[["Quicksilver Ingot",10],["Engine",2],["Gate Blueprint",1],["Pulley",8],["Tyxen Toolkit",10],["Hardwood Beam",12],["Iron Ingot",10],["Brick",100]],"o":["Gate"]},"Engineer Component 7-1":{"p":"Engineer","l":8,"t":"Craft","s":21600,"i":[["Rose Glass",1],["Compass Blueprint",1],["Processed Celespar",1],["Quicksilver Hoop",1]],"o":["Compass"]},"Engineer Component 7-2":{"p":"Engineer","l":8,"t":"Craft","s":28800,"i":[["Rose Glass",1],["Alembic and Retort Blueprint",1],["Heartspire",1],["Quicksilver Ingot",1],["Alchemical Flask",1]],"o":["Alembic and Retort"]},"Alchemist Craft 1-1":{"p":"Alchemist","l":1,"t":"Craft","s":14400,"i":[["Charcoal",2],["Water",2],["Copper Ore",4],["Valannite",1]],"o":["Liquid Valannite"]},"Alchemist Craft 2-1":{"p":"Alchemist","l":2,"t":"Craft","s":14400,"i":[["Charcoal",2],["Water",2],["Copper Ore",4],["Honey Drop",2]],"o":["Liquid Honey Drop"]},"Alchemist Craft 2-2":{"p":"Alchemist","l":2,"t":"Craft","s":3600,"i":[["Copper Ingot",2],["Liquid Valannite",1]],"o":["Infused Copper Ingot"]},"Alchemist Craft 3-1":{"p":"Alchemist","l":3,"t":"Craft","s":14400,"i":[["Coal",2],["Stormwater",2],["Iron Ore",4],["Dragon Breath",2]],"o":["Liquid Dragon Breath"]},"Alchemist Craft 3-2":{"p":"Alchemist","l":3,"t":"Craft","s":3600,"i":[["Coal",1],["Stormwater",2]],"o":["Fire Juice"]},"Alchemist Craft 4-1":{"p":"Alchemist","l":4,"t":"Craft","s":3600,"i":[["Iron Ingot",2],["Liquid Valannite",1]],"o":["Infused Iron Ingot"]},"Alchemist Craft 5-1":{"p":"Alchemist","l":5,"t":"Craft","s":7200,"i":[["Cinnabar Ore",1],["Blackblood",1]],"o":["Rose Dust"]},"Alchemist Craft 5-2":{"p":"Alchemist","l":5,"t":"Craft","s":7200,"i":[["Meldstone",1],["Blackblood",1]],"o":["Meld Ash"]},"Alchemist Craft 5-3":{"p":"Alchemist","l":5,"t":"Craft","s":32400,"i":[["Rose Dust",1],["Meld Ash",1],["Processed Celespar",1],["Quicksilver Ingot",1]],"o":["Rose Glass"]},"Alchemist Craft 5-4":{"p":"Alchemist","l":5,"t":"Craft","s":7200,"i":[["Quicksilver Ingot",2],["Liquid Valannite",1]],"o":["Infused Quicksilver Ingot"]},"Alchemist Craft 6-1":{"p":"Alchemist","l":6,"t":"Craft","s":21600,"i":[["Meldstone",2],["Blackblood",2],["Cinnabar Ore",4],["Astralite",2]],"o":["Liquid Astralite"]},"Alchemist Craft 7-1":{"p":"Alchemist","l":7,"t":"Craft","s":10800,"i":[["Luminite Ore",1],["Mirrormist",1]],"o":["Luminous Powder"]},"Alchemist Craft 7-2":{"p":"Alchemist","l":7,"t":"Craft","s":10800,"i":[["Moonslate",1],["Mirrormist",1]],"o":["Moon Ash"]},"Alchemist Craft 7-3":{"p":"Alchemist","l":7,"t":"Craft","s":36000,"i":[["Luminous Powder",1],["Luminite Ingot",1],["Moon Ash",1],["Processed Astralite",1]],"o":["Reflective Glass"]},"Alchemist Craft 8-1":{"p":"Alchemist","l":8,"t":"Craft","s":7200,"i":[["Processed Valannite",1],["Rose Dust",1],["Infused Luminite Ingot",1]],"o":["Valannite Powder"]},"Alchemist Craft 8-2":{"p":"Alchemist","l":8,"t":"Craft","s":9000,"i":[["Luminite Ingot",1],["Liquid Astralite",1]],"o":["Infused Luminite Ingot"]},"Alchemist Craft 8-3":{"p":"Alchemist","l":9,"t":"Craft","s":21600,"i":[["Luminite Ore",4],["Blackblood",2],["Meldstone",2],["Vipharine",2]],"o":["Liquid Vipharine"]},"Alchemist Craft 8-4":{"p":"Alchemist","l":9,"t":"Craft","s":7200,"i":[["Processed Honey Drop",1],["Meld Ash",1],["Infused Luminite Ingot",1]],"o":["Honey Drop Powder"]},"Alchemist Craft 8-5":{"p":"Alchemist","l":10,"t":"Craft","s":10800,"i":[["Valannite Powder",2],["Honey Drop Powder",2],["Elderwater",2]],"o":["Gemweld Resin"]},"Alchemist Craft 8-6":{"p":"Alchemist","l":10,"t":"Craft","s":9000,"i":[["Processed Dragon Breath",1],["Luminous Powder",1],["Infused Luminite Ingot",1]],"o":["Dragon Breath Powder"]},"Alchemist Discovery 1-1":{"p":"Alchemist","l":1,"t":"Craft","s":86400,"i":[["Paper",1],["Copper Ore",1],["Charcoal",1],["Water",1]],"o":["Liquid Valannite","Liquid Honey Drop","Natron","Limestone"]},"Alchemist Discovery 3-1":{"p":"Alchemist","l":3,"t":"Craft","s":86400,"i":[["Canvas Paper",2],["Iron Ore",1],["Coal",1],["Stormwater",1]],"o":["Liquid Honey Drop","Liquid Dragon Breath","Meld Ash","Rose Dust"]},"Alchemist Discovery 6-1":{"p":"Alchemist","l":6,"t":"Craft","s":86400,"i":[["Hideleaf",1],["Cinnabar Ore",1],["Meldstone",1],["Blackblood",1]],"o":["Liquid Dragon Breath","Liquid Celespar","Luminous Powder","Moon Ash"]},"Alchemist Potioncraft 2-1":{"p":"Alchemist","l":2,"t":"Craft","s":3600,"i":[["Paper",1],["Water",1],["Natron",1],["Processed Valannite",1]],"o":["Potion of Strength"]},"Alchemist Potioncraft 3-1":{"p":"Alchemist","l":3,"t":"Craft","s":21600,"i":[["Natron",1],["Limestone",1],["Coal",1]],"o":["Glass"]},"Alchemist Potioncraft 4-1":{"p":"Alchemist","l":4,"t":"Craft","s":3600,"i":[["Canvas Paper",1],["Stormwater",1],["Natron",1],["Processed Dragon Breath",1]],"o":["Potion of Health"]},"Alchemist Potioncraft 4-2":{"p":"Alchemist","l":4,"t":"Craft","s":18000,"i":[["Coal",2],["Stormwater",2],["Iron Ore",4],["Celespar",2]],"o":["Liquid Celespar"]},"Alchemist Potioncraft 5-2":{"p":"Alchemist","l":5,"t":"Craft","s":18000,"i":[["Meld Ash",2],["Liquid Honey Drop",2],["Blackblood",3],["Cinnabar Ore",1]],"o":["Wipe Memory Potion"]},"Alchemist Potioncraft 5-3":{"p":"Alchemist","l":5,"t":"Craft","s":7200,"i":[["Cinnabar Ore",1],["Natron",1],["Processed Celespar",1],["Hideleaf",1]],"o":["Swiftstride Serum"]},"Alchemist Potioncraft 8-1":{"p":"Alchemist","l":8,"t":"Craft","s":7200,"i":[["Processed Honey Drop",1],["Limestone",1],["Luminous Powder",1],["Moon Ash",1],["Alchemical Flask",1]],"o":["Potion of Stamina"]},"Blacksmith Weapon 2-1":{"p":"Blacksmith","l":2,"t":"Craft","s":10800,"i":[["Softwood",2],["Softwood Fibers",2],["Copper Ingot",2],["Softwood Handle",1],["Processed Honey Drop",1],["Cloth Tool Grip",1]],"o":["Meadborne Sword"]},"Blacksmith Weapon 2-2":{"p":"Blacksmith","l":2,"t":"Craft","s":10800,"i":[["Softwood",2],["Softwood Fibers",2],["Copper Ingot",2],["Softwood Handle",1],["Processed Honey Drop",1],["Cloth Tool Grip",1]],"o":["Meadborne Staff"]},"Blacksmith Weapon 2-3":{"p":"Blacksmith","l":2,"t":"Craft","s":10800,"i":[["Softwood",2],["Softwood Fibers",2],["Copper Ingot",2],["Softwood Handle",1],["Processed Honey Drop",1],["Cloth Tool Grip",1]],"o":["Meadborne Bow"]},"Blacksmith Weapon 4-1":{"p":"Blacksmith","l":4,"t":"Craft","s":21600,"i":[["Hardwood",2],["Twisted Cord",2],["Iron Ingot",2],["Hardwood Handle",1],["Processed Dragon Breath",1],["Canvas Tool Grip",1]],"o":["Flametongue Sword"]},"Blacksmith Weapon 4-2":{"p":"Blacksmith","l":4,"t":"Craft","s":21600,"i":[["Hardwood",2],["Twisted Cord",2],["Iron Ingot",2],["Hardwood Handle",1],["Processed Dragon Breath",1],["Canvas Tool Grip",1]],"o":["Flametongue Staff"]},"Blacksmith Weapon 4-3":{"p":"Blacksmith","l":4,"t":"Craft","s":21600,"i":[["Hardwood",2],["Twisted Cord",2],["Iron Ingot",2],["Hardwood Handle",1],["Processed Dragon Breath",1],["Canvas Tool Grip",1]],"o":["Flametongue Bow"]},"Blacksmith Weapon 6-1":{"p":"Blacksmith","l":6,"t":"Craft","s":25200,"i":[["Plumhide",2],["Braided Line",2],["Quicksilver Ingot",2],["Plumhide Handle",1],["Processed Celespar",1],["Leather Tool Grip",1],["Tyxen Toolkit",1]],"o":["Gleamspar Sword"]},"Blacksmith Weapon 6-2":{"p":"Blacksmith","l":6,"t":"Craft","s":25200,"i":[["Plumhide",2],["Braided Line",2],["Quicksilver Ingot",2],["Plumhide Handle",1],["Processed Celespar",1],["Leather Tool Grip",1],["Tyxen Toolkit",1]],"o":["Gleamspar Staff"]},"Blacksmith Weapon 6-3":{"p":"Blacksmith","l":6,"t":"Craft","s":25200,"i":[["Plumhide",2],["Braided Line",2],["Quicksilver Ingot",2],["Plumhide Handle",1],["Processed Celespar",1],["Leather Tool Grip",1],["Tyxen Toolkit",1]],"o":["Gleamspar Bow"]},"Blacksmith Weapon 9-1":{"p":"Blacksmith","l":9,"t":"Craft","s":25200,"i":[["Heartspire",2],["Heartspire Rope",2],["Luminite Ingot",2],["Heartspire Handle",1],["Processed Astralite",1],["Heartspire Tool Grip",1]],"o":["Luminglade Sword"]},"Blacksmith Weapon 9-2":{"p":"Blacksmith","l":9,"t":"Craft","s":25200,"i":[["Heartspire",3],["Heartspire Rope",2],["Luminite Ingot",1],["Heartspire Handle",1],["Processed Astralite",2],["Heartspire Tool Grip",1]],"o":["Luminglade Staff"]},"Blacksmith Weapon 9-3":{"p":"Blacksmith","l":9,"t":"Craft","s":25200,"i":[["Heartspire",3],["Heartspire Rope",3],["Luminite Ingot",1],["Heartspire Handle",1],["Processed Astralite",1],["Heartspire Tool Grip",1]],"o":["Luminglade Bow"]},"Blacksmith Weapon 9-4":{"p":"Blacksmith","l":9,"t":"Craft","s":25200,"i":[["Heartspire",2],["Heartspire Rope",2],["Luminite Ingot",3],["Heartspire Handle",1],["Processed Astralite",1],["Heartspire Tool Grip",1]],"o":["Luminglade Shield"]},"Blacksmith Tool 1-1":{"p":"Blacksmith","l":1,"t":"Craft","s":3600,"i":[["Softwood Handle",1],["Cloth Tool Grip",1],["Copper Ingot",1],["Axe Blueprint",1]],"o":["Axe"]},"Blacksmith Tool 1-2":{"p":"Blacksmith","l":1,"t":"Craft","s":3600,"i":[["Softwood Handle",1],["Cloth Tool Grip",1],["Copper Ingot",1],["Shovel Blueprint",1]],"o":["Shovel"]},"Blacksmith Tool 1-3":{"p":"Blacksmith","l":1,"t":"Craft","s":3600,"i":[["Softwood Handle",1],["Cloth Tool Grip",1],["Copper Ingot",1],["Pickaxe Blueprint",1]],"o":["Pickaxe"]},"Blacksmith Tool 1-4":{"p":"Blacksmith","l":1,"t":"Craft","s":3600,"i":[["Softwood",1],["Softwood Fibers",1],["Copper Ingot",1],["Bucket Blueprint",1]],"o":["Bucket"]},"Blacksmith Tool 1-5":{"p":"Blacksmith","l":1,"t":"Craft","s":3600,"i":[["Copper Ingot",1],["Glorb Toolbox Blueprint",1]],"o":["Glorb Toolbox"]},"Blacksmith Tool 3-1":{"p":"Blacksmith","l":3,"t":"Craft","s":3600,"i":[["Hardwood Handle",1],["Canvas Tool Grip",1],["Iron Ingot",1],["Iron Axe Blueprint",1]],"o":["Iron Axe"]},"Blacksmith Tool 3-2":{"p":"Blacksmith","l":3,"t":"Craft","s":3600,"i":[["Hardwood Handle",1],["Canvas Tool Grip",1],["Iron Ingot",1],["Iron Shovel Blueprint",1]],"o":["Iron Shovel"]},"Blacksmith Tool 3-3":{"p":"Blacksmith","l":3,"t":"Craft","s":3600,"i":[["Hardwood Handle",1],["Canvas Tool Grip",1],["Iron Ingot",1],["Iron Pickaxe Blueprint",1]],"o":["Iron Pickaxe"]},"Blacksmith Tool 3-4":{"p":"Blacksmith","l":3,"t":"Craft","s":3600,"i":[["Hardwood",1],["Twisted Cord",1],["Iron Ingot",1],["Improved Bucket Blueprint",1]],"o":["Improved Bucket"]},"Blacksmith Tool 3-5":{"p":"Blacksmith","l":3,"t":"Craft","s":3600,"i":[["Iron Ingot",2],["Tyxen Toolkit Blueprint",1]],"o":["Tyxen Toolkit"]},"Blacksmith Tool 4-1":{"p":"Blacksmith","l":4,"t":"Craft","s":3600,"i":[["Iron Ingot",2]],"o":["Iron Hoop"]},"Blacksmith Tool 5-1":{"p":"Blacksmith","l":5,"t":"Craft","s":7200,"i":[["Extraction Pipe Blueprint",1],["Quicksilver Ingot",1],["Quicksilver Hoop",2]],"o":["Extraction Pipe"]},"Blacksmith Tool 5-2":{"p":"Blacksmith","l":5,"t":"Craft","s":7200,"i":[["Quicksilver Ingot",2]],"o":["Quicksilver Hoop"]},"Blacksmith Tool 5-3":{"p":"Blacksmith","l":5,"t":"Craft","s":5400,"i":[["Plumhide Handle",1],["Leather Tool Grip",1],["Quicksilver Ingot",1],["Saw Blueprint",1]],"o":["Quicksilver Saw"]},"Blacksmith Tool 5-4":{"p":"Blacksmith","l":5,"t":"Craft","s":5400,"i":[["Plumhide Handle",1],["Leather Tool Grip",1],["Quicksilver Ingot",1],["Quicksilver Shovel Blueprint",1]],"o":["Quicksilver Shovel"]},"Blacksmith Tool 5-5":{"p":"Blacksmith","l":5,"t":"Craft","s":5400,"i":[["Plumhide Handle",1],["Leather Tool Grip",1],["Quicksilver Ingot",1],["Quicksilver Pickaxe Blueprint",1]],"o":["Quicksilver Pickaxe"]},"Blacksmith Tool 5-6":{"p":"Blacksmith","l":5,"t":"Craft","s":5400,"i":[["Plumhide",1],["Braided Line",1],["Quicksilver Ingot",1],["Plumhide Bucket Blueprint",1]],"o":["Plumhide Bucket"]},"Blacksmith Tool 7-1":{"p":"Blacksmith","l":7,"t":"Craft","s":6000,"i":[["Heartspire Tool Grip",1],["Heartspire Handle",1],["Luminite Ingot",1],["Luminite Axe Blueprint",1]],"o":["Luminite Axe"]},"Blacksmith Tool 7-2":{"p":"Blacksmith","l":7,"t":"Craft","s":6000,"i":[["Heartspire Tool Grip",1],["Heartspire Handle",1],["Luminite Ingot",1],["Luminite Pickaxe Blueprint",1]],"o":["Luminite Pickaxe"]},"Blacksmith Tool 7-3":{"p":"Blacksmith","l":7,"t":"Craft","s":6000,"i":[["Heartspire Tool Grip",1],["Heartspire Handle",1],["Luminite Ingot",1],["Luminite Shovel Blueprint",1]],"o":["Luminite Shovel"]},"Blacksmith Tool 7-4":{"p":"Blacksmith","l":7,"t":"Craft","s":6000,"i":[["Heartspire",1],["Heartspire Rope",1],["Luminite Ingot",1],["Heartspire Bucket Blueprint",1]],"o":["Heartspire Bucket"]},"Blacksmith Tool 7-5":{"p":"Blacksmith","l":7,"t":"Craft","s":7200,"i":[["Quicksilver Ingot",1],["Tyxen Toolkit",1]],"o":["Quicksilver Reinforcement"]},"Blacksmith Tool 8-1":{"p":"Blacksmith","l":8,"t":"Craft","s":5400,"i":[["Luminite Ingot",2],["Luminite Toolkit Blueprint",1]],"o":["Luminite Toolkit"]},"Blacksmith Tool 9-1":{"p":"Blacksmith","l":9,"t":"Craft","s":7200,"i":[["Nightwood Tool Grip",1],["Nightwood Tool Handle",1],["Luminite Ingot",1],["Superior Luminite Axe Blueprint",1]],"o":["Superior Luminite Axe"]},"Blacksmith Tool 9-2":{"p":"Blacksmith","l":9,"t":"Craft","s":7200,"i":[["Nightwood",1],["Nightwood Rope",1],["Luminite Ingot",1],["Nightwood Bucket Blueprint",1]],"o":["Nightwood Bucket"]},"Blacksmith Tool 10-1":{"p":"Blacksmith","l":10,"t":"Craft","s":7200,"i":[["Nightwood Tool Grip",1],["Nightwood Tool Handle",1],["Kronscale Ingot",1],["Superior Luminite Axe Blueprint",1]],"o":["Kronscale Pickaxe"]},"Blacksmith Tool 10-2":{"p":"Blacksmith","l":10,"t":"Craft","s":7200,"i":[["Nightwood Tool Grip",1],["Nightwood Tool Handle",1],["Kronscale Ingot",1],["Kronscale Shovel Blueprint",1]],"o":["Kronscale Shovel"]},"Blacksmith Forge 1-1":{"p":"Blacksmith","l":1,"t":"Craft","s":3600,"i":[["Copper Ore",3],["Water",1],["Charcoal",1]],"o":["Copper Ingot"]},"Blacksmith Forge 3-1":{"p":"Blacksmith","l":3,"t":"Craft","s":3600,"i":[["Iron Ore",3],["Stormwater",1],["Coal",1]],"o":["Iron Ingot"]},"Blacksmith Forge 4-1":{"p":"Blacksmith","l":4,"t":"Craft","s":21600,"i":[["Iron Ingot",6],["Tyxen Toolkit",3],["Canvas",3]],"o":["Ironrot Chestplate"]},"Blacksmith Forge 4-2":{"p":"Blacksmith","l":4,"t":"Craft","s":14400,"i":[["Iron Ingot",3],["Tyxen Toolkit",2],["Canvas",2]],"o":["Ironrot Helmet"]},"Blacksmith Forge 4-3":{"p":"Blacksmith","l":4,"t":"Craft","s":18000,"i":[["Iron Ingot",4],["Tyxen Toolkit",2],["Canvas",3]],"o":["Ironrot Pants"]},"Blacksmith Forge 4-4":{"p":"Blacksmith","l":4,"t":"Craft","s":14400,"i":[["Iron Ingot",2],["Tyxen Toolkit",1],["Canvas",2],["Boots",1]],"o":["Ironrot Boots"]},"Blacksmith Forge 4-5":{"p":"Blacksmith","l":4,"t":"Craft","s":10800,"i":[["Iron Ingot",2],["Tyxen Toolkit",1],["Canvas",2]],"o":["Ironrot Gauntlets"]},"Blacksmith Forge 5-1":{"p":"Blacksmith","l":5,"t":"Craft","s":5400,"i":[["Cinnabar Ore",3],["Blackblood",1],["Meldstone",1]],"o":["Quicksilver Ingot"]},"Blacksmith Forge 5-2":{"p":"Blacksmith","l":5,"t":"Craft","s":7200,"i":[["Iron Ingot",1],["Tyxen Toolkit",1]],"o":["Coreplate Reinforcement"]},"Blacksmith Forge 7-1":{"p":"Blacksmith","l":8,"t":"Craft","s":25200,"i":[["Quicksilver Ingot",6],["Tyxen Toolkit",3],["Leather",3]],"o":["Petalsteel Chestplate"]},"Blacksmith Forge 7-2":{"p":"Blacksmith","l":8,"t":"Craft","s":18000,"i":[["Quicksilver Ingot",3],["Tyxen Toolkit",2],["Leather",2]],"o":["Petalsteel Helmet"]},"Blacksmith Forge 7-3":{"p":"Blacksmith","l":8,"t":"Craft","s":21600,"i":[["Quicksilver Ingot",4],["Tyxen Toolkit",2],["Leather",2]],"o":["Petalsteel Pants"]},"Blacksmith Forge 7-4":{"p":"Blacksmith","l":8,"t":"Craft","s":18000,"i":[["Quicksilver Ingot",2],["Tyxen Toolkit",1],["Leather",2],["Boots",1]],"o":["Petalsteel Boots"]},"Blacksmith Forge 7-5":{"p":"Blacksmith","l":8,"t":"Craft","s":14400,"i":[["Quicksilver Ingot",2],["Tyxen Toolkit",1],["Leather",2]],"o":["Petalsteel Gauntlets"]},"Blacksmith Forge 7-6":{"p":"Blacksmith","l":7,"t":"Craft","s":5400,"i":[["Luminite Ore",3],["Mirrormist",1],["Moonslate",1]],"o":["Luminite Ingot"]},"Blacksmith Forge 10-1":{"p":"Blacksmith","l":10,"t":"Craft","s":6300,"i":[["Kronyx Ore",3],["Elderwater",1],["Pyrestarter",1]],"o":["Kronscale Ingot"]},"Blacksmith Forge 10-2":{"p":"Blacksmith","l":10,"t":"Craft","s":7200,"i":[["Luminite Ingot",1],["Luminite Toolkit",1]],"o":["Luminite Reinforcement"]},"Architect Construct 1-3":{"p":"Architect","l":1,"t":"Craft","s":3600,"i":[["Softwood",4]],"o":["Softwood Beam"]},"Architect Construct 1-4":{"p":"Architect","l":1,"t":"Craft","s":3600,"i":[["Softwood",1]],"o":["Softwood Handle"]},"Architect Construct 2-1":{"p":"Architect","l":2,"t":"Craft","s":3600,"i":[["Softwood Plank",3],["Glorb Toolbox",2]],"o":["Stairs"]},"Architect Construct 2-2":{"p":"Architect","l":2,"t":"Craft","s":3600,"i":[["Frame",1],["Cloth Canopy",1]],"o":["Wayfarer's Tent"]},"Architect Construct 2-3":{"p":"Architect","l":2,"t":"Craft","s":3600,"i":[["Softwood Beam",1]],"o":["Softwood Plank"]},"Architect Construct 3-3":{"p":"Architect","l":3,"t":"Craft","s":3600,"i":[["Hardwood",4]],"o":["Hardwood Beam"]},"Architect Construct 3-4":{"p":"Architect","l":3,"t":"Craft","s":3600,"i":[["Hardwood",1]],"o":["Hardwood Handle"]},"Architect Construct 3-5":{"p":"Architect","l":3,"t":"Craft","s":3600,"i":[["Hardwood Fibers",3],["Clay",3],["Stormwater",3]],"o":["Brick"]},"Architect Construct 4-1":{"p":"Architect","l":4,"t":"Craft","s":21600,"i":[["Hardwood Plank",2],["Iron Ingot",3],["Tyxen Toolkit",1]],"o":["Chest"]},"Architect Construct 4-2":{"p":"Architect","l":4,"t":"Craft","s":7200,"i":[["Hardwood Plank",2],["Iron Hoop",2],["Tyxen Toolkit",1]],"o":["Barrel"]},"Architect Construct 4-3":{"p":"Architect","l":4,"t":"Craft","s":3600,"i":[["Hardwood Frame",1],["Canvas Canopy",1]],"o":["Traveler's Tent"]},"Architect Construct 4-4":{"p":"Architect","l":4,"t":"Craft","s":3600,"i":[["Hardwood Beam",1]],"o":["Hardwood Plank"]},"Architect Construct 5-1":{"p":"Architect","l":5,"t":"Craft","s":7200,"i":[["Plumhide",1]],"o":["Plumhide Handle"]},"Architect Construct 6-1":{"p":"Architect","l":6,"t":"Craft","s":14400,"i":[["Frame",2],["Hardwood Frame",2],["Tyxen Toolkit",2],["Quicksilver Ingot",6]],"o":["Machine Chassis"]},"Architect Construct 6-2":{"p":"Architect","l":6,"t":"Craft","s":72000,"i":[["Wayfarer's Tent",5],["Brick",100],["Clay",50],["Tyxen Toolkit",5],["Stairs",10]],"o":["Wall"]},"Architect Construct 6-3":{"p":"Architect","l":6,"t":"Craft","s":86400,"i":[["Traveler's Tent",5],["Brick",100],["Tyxen Toolkit",10],["Plumhide",10],["Stairs",10],["Glass",20]],"o":["Tower"]},"Architect Construct 7-1":{"p":"Architect","l":7,"t":"Craft","s":129600,"i":[["Barrel",20],["Heartspire",50],["Brick",500],["Traveler's Tent",10],["Guild Banner",2],["Chest",20],["Tyxen Toolkit",20],["Glass",50]],"o":["Great Hall"]},"Architect Construct 7-2":{"p":"Architect","l":8,"t":"Craft","s":259200,"i":[["Tower",6],["Wall",10],["Gate",1],["Great Hall",1],["Tyxen Toolkit",20],["Guild Banner",4],["Stronghold Blueprint",1]],"o":["Stronghold"]},"Architect Construct 7-3":{"p":"Architect","l":7,"t":"Craft","s":7200,"i":[["Heartspire",1]],"o":["Heartspire Handle"]},"Architect Construct 8-1":{"p":"Architect","l":8,"t":"Craft","s":7200,"i":[["Heartspire",4]],"o":["Heartspire Beam"]},"Architect Construct 8-2":{"p":"Architect","l":8,"t":"Craft","s":7200,"i":[["Heartspire Beam",1]],"o":["Heartspire Plank"]},"Architect Construct 8-3":{"p":"Architect","l":8,"t":"Craft","s":18000,"i":[["Heartspire Beam",8],["Luminite Toolkit",4],["Luminite Ingot",4],["Wheel",4]],"o":["Cranefoot Foundation"]},"Architect Construct 8-4":{"p":"Architect","l":8,"t":"Craft","s":14400,"i":[["Heartspire",8],["Pulley",2],["Luminite Toolkit",2],["Luminite Ingot",2]],"o":["Crane Mast"]},"Architect Construct 9-1":{"p":"Architect","l":9,"t":"Craft","s":18000,"i":[["Heartspire Plank",8],["Heartspire Beam",4],["Luminite Toolkit",2],["Luminite Ingot",2]],"o":["Crane Descent Platform"]},"Architect Construct 9-2":{"p":"Architect","l":9,"t":"Craft","s":86400,"i":[["Cranefoot Foundation",1],["Engine",1],["Crane Mast",1],["Crane Descent Platform",1],["Heavy Lift Crane Blueprint",1]],"o":["Heavy Lift Crane"]},"Architect Construct 9-3":{"p":"Architect","l":9,"t":"Craft","s":8100,"i":[["Nightwood",1]],"o":["Nightwood Tool Handle"]},"Architect Construct 9-4":{"p":"Architect","l":9,"t":"Craft","s":8100,"i":[["Nightwood",4]],"o":["Nightwood Beam"]},"Architect Construct 10-1":{"p":"Architect","l":10,"t":"Craft","s":10800,"i":[["Nightwood Beam",4],["Luminite Ingot",2],["Luminite Toolkit",2]],"o":["Tunnel Substructure"]},"Architect Construct 10-2":{"p":"Architect","l":10,"t":"Craft","s":9000,"i":[["Luminite Ingot",2],["Luminite Toolkit",2]],"o":["Reinforced Tunnel Arch"]},"Architect Construct 10-3":{"p":"Architect","l":10,"t":"Craft","s":9000,"i":[["Clay",4],["Nightwood Fibers",4],["Elderwater",2],["Gemweld Resin",1]],"o":["Stonebinder"]},"Jeweler Process 1-1":{"p":"Jeweler","l":1,"t":"Craft","s":3600,"i":[["Charcoal",3],["Liquid Valannite",1],["Valannite",1]],"o":["Processed Valannite"]},"Jeweler Process 2-1":{"p":"Jeweler","l":2,"t":"Craft","s":3600,"i":[["Charcoal",3],["Liquid Honey Drop",1],["Honey Drop",1]],"o":["Processed Honey Drop"]},"Jeweler Process 3-1":{"p":"Jeweler","l":3,"t":"Craft","s":7200,"i":[["Coal",3],["Liquid Dragon Breath",1],["Dragon Breath",1]],"o":["Processed Dragon Breath"]},"Jeweler Process 4-1":{"p":"Jeweler","l":4,"t":"Craft","s":7200,"i":[["Coal",3],["Liquid Celespar",1],["Celespar",1]],"o":["Processed Celespar"]},"Jeweler Process 6-1":{"p":"Jeweler","l":6,"t":"Craft","s":9000,"i":[["Meldstone",3],["Liquid Astralite",1],["Astralite",1]],"o":["Processed Astralite"]},"Jeweler Process 9-1":{"p":"Jeweler","l":9,"t":"Craft","s":10800,"i":[["Moonslate",3],["Liquid Vipharine",1],["Vipharine",1]],"o":["Processed Vipharine"]},"Jeweler Adornment 2-1":{"p":"Jeweler","l":2,"t":"Craft","s":3600,"i":[["Processed Valannite",3],["Glorb Toolbox",1],["Copper Ingot",1]],"o":["Copper Ring of Valannite"]},"Jeweler Adornment 3-1":{"p":"Jeweler","l":3,"t":"Craft","s":3600,"i":[["Processed Honey Drop",3],["Glorb Toolbox",1],["Infused Copper Ingot",1]],"o":["Copper Ring of Resistance"]},"Jeweler Adornment 4-1":{"p":"Jeweler","l":4,"t":"Craft","s":3600,"i":[["Processed Dragon Breath",3],["Tyxen Toolkit",1],["Iron Ingot",1]],"o":["Iron Pendant of the Dragon"]},"Jeweler Adornment 5-1":{"p":"Jeweler","l":5,"t":"Craft","s":3600,"i":[["Processed Valannite",3],["Tyxen Toolkit",1],["Infused Iron Ingot",1]],"o":["Infused Iron Ring of Valannite"]},"Jeweler Adornment 5-2":{"p":"Jeweler","l":5,"t":"Craft","s":3600,"i":[["Processed Celespar",3],["Tyxen Toolkit",1],["Infused Iron Ingot",1]],"o":["Infused Iron Ring of Haste"]},"Jeweler Adornment 6-1":{"p":"Jeweler","l":6,"t":"Craft","s":7200,"i":[["Copper Ingot",1],["Quicksilver Ingot",1],["Copper Wire",2],["Tyxen Toolkit",1],["Glass",4],["Liquid Celespar",1]],"o":["Glasses"]},"Jeweler Adornment 6-2":{"p":"Jeweler","l":6,"t":"Craft","s":7200,"i":[["Infused Iron Ingot",1],["Quicksilver Ingot",1],["Processed Dragon Breath",1],["Processed Celespar",1],["Tyxen Toolkit",1]],"o":["Pendant of Vital Surge"]},"Jeweler Adornment 6-3":{"p":"Jeweler","l":6,"t":"Craft","s":7200,"i":[["Iron Ingot",1],["Quicksilver Ingot",1],["Tyxen Toolkit",1],["Processed Dragon Breath",1],["Liquid Honey Drop",1]],"o":["Ring of Pulse"]},"Jeweler Adornment 6-4":{"p":"Jeweler","l":6,"t":"Craft","s":9000,"i":[["Processed Astralite",1],["Tyxen Toolkit",1],["Infused Quicksilver Ingot",1]],"o":["Ring of Artisan's Flow"]},"Jeweler Adornment 7-1":{"p":"Jeweler","l":7,"t":"Craft","s":7200,"i":[["Processed Valannite",5],["Mirrormist",5],["Tyxen Toolkit",1]],"o":["Powergleam Orb"]},"Jeweler Adornment 7-2":{"p":"Jeweler","l":7,"t":"Craft","s":10800,"i":[["Copper Ingot",2],["Copper Wire",2],["Tyxen Toolkit",1],["Rose Glass",4],["Liquid Celespar",1]],"o":["Rose Glasses"]},"Jeweler Adornment 7-3":{"p":"Jeweler","l":7,"t":"Craft","s":12600,"i":[["Processed Astralite",1],["Tyxen Toolkit",1],["Infused Quicksilver Ingot",2]],"o":["Quickspark Pendant"]},"Jeweler Adornment 8-1":{"p":"Jeweler","l":8,"t":"Craft","s":9000,"i":[["Processed Honey Drop",5],["Luminite Ore",5],["Luminite Toolkit",1]],"o":["Wardbound Orb"]},"Jeweler Adornment 8-2":{"p":"Jeweler","l":8,"t":"Craft","s":5400,"i":[["Processed Dragon Breath",3],["Infused Luminite Ingot",1],["Luminite Toolkit",1]],"o":["Heartgrasp Ring"]},"Jeweler Adornment 8-3":{"p":"Jeweler","l":8,"t":"Craft","s":9000,"i":[["Processed Honey Drop",3],["Infused Luminite Ingot",2],["Luminite Toolkit",1]],"o":["Guardflow Pendant"]},"Jeweler Adornment 9-1":{"p":"Jeweler","l":9,"t":"Craft","s":9000,"i":[["Processed Dragon Breath",5],["Luminite Ore",5],["Luminite Toolkit",1]],"o":["Dragonbreath Orb"]},"Jeweler Adornment 10-1":{"p":"Jeweler","l":10,"t":"Craft","s":9000,"i":[["Processed Vipharine",3],["Infused Luminite Ingot",2],["Luminite Toolkit",1]],"o":["Guardseal Pendant"]},"Jeweler Adornment 10-2":{"p":"Jeweler","l":10,"t":"Craft","s":10800,"i":[["Processed Vipharine",4],["Luminite Ore",5],["Luminite Toolkit",1]],"o":["Fortress Orb"]}};
const RECIPE_PROD_INDEX = {"Meat":["Explorer Pet 2-1","Explorer Pet 4-1","Explorer Pet 6-1","Explorer Pet 8-1"],"Copper Ore":["Miner Excavation 1-1","Miner Excavation 2-1"],"Charcoal":["Miner Excavation 1-2","Miner Excavation 2-2"],"Small Crystal":["Miner Excavation 1-3"],"Iron Ore":["Miner Excavation 2-1","Miner Excavation 3-1","Miner Excavation 4-1"],"Coal":["Miner Excavation 2-2","Miner Excavation 3-2","Miner Excavation 4-2"],"Medium Crystal":["Miner Excavation 3-3"],"Cinnabar Ore":["Miner Excavation 4-1","Miner Excavation 5-2","Miner Excavation 6-2"],"Meldstone":["Miner Excavation 4-2","Miner Excavation 5-3","Miner Excavation 6-3"],"Large Crystal":["Miner Excavation 5-1"],"Blackblood":["Miner Extraction 6-1","Miner Extraction 4-1","Miner Extraction 5-1"],"Mirrormist":["Miner Extraction 6-1","Miner Extraction 7-1 Down","Miner Extraction 7-1","Miner Extraction 8-1 Down","Miner Extraction 8-1"],"Luminite Ore":["Miner Excavation 6-2","Miner Excavation 7-1 Down","Miner Excavation 7-1","Miner Excavation 8-1 Down","Miner Excavation 8-1"],"Moonslate":["Miner Excavation 6-3","Miner Excavation 7-2 Down","Miner Excavation 7-2","Miner Excavation 8-2 Down","Miner Excavation 8-2"],"Kronyx Ore":["Miner Excavation 8-1 Down","Miner Excavation 8-1","Miner Excavation 9-1 Down","Miner Extraction 10-2 Down","Miner Extraction 10-2"],"Pyrestarter":["Miner Excavation 8-2 Down","Miner Excavation 8-2","Miner Excavation 9-2 Down","Miner Extraction 10-1 Down","Miner Extraction 10-1"],"Water":["Miner Extraction 1-1","Miner Extraction 2-1"],"Stormwater":["Miner Extraction 2-1","Miner Extraction 3-1","Miner Extraction 4-1"],"Clay":["Miner Extraction 3-2"],"Elderwater":["Miner Extraction 8-1 Down","Miner Extraction 8-1","Miner Extraction 9-1 Down","Miner Extraction 9-1"],"Softwood":["Artisan Farm 1-1","Artisan Farm 2-1"],"Softwood Fibers":["Artisan Farm 1-1","Artisan Farm 2-1","Artisan Craft 2-2"],"Hardwood":["Artisan Farm 3-1","Artisan Farm 4-1"],"Hardwood Fibers":["Artisan Farm 3-1","Artisan Farm 4-1","Artisan Craft 4-8"],"Plumhide":["Artisan Farm 5-1","Artisan Farm 6-1"],"Plumhide Fibers":["Artisan Farm 5-1","Artisan Farm 6-1","Artisan Craft 6-3"],"Heartspire":["Artisan Farm 7-1 Down","Artisan Farm 7-1","Artisan Farm 8-1"],"Heartspire Fibers":["Artisan Farm 7-1 Down","Artisan Farm 7-1","Artisan Farm 8-1","Artisan Craft 8-1"],"Nightwood":["Artisan Farm 9-1 Down","Artisan Farm 9-1"],"Nightwood Fibers":["Artisan Farm 9-1 Down","Artisan Farm 9-1","Artisan Craft 10-5"],"Paper":["Artisan Craft 1-1"],"Cloth":["Artisan Craft 1-2"],"Cloth Tool Grip":["Artisan Craft 1-3"],"Cloth Canopy":["Artisan Craft 2-1"],"Apprentice's Tunic":["Artisan Craft 2-3"],"Apprentice's Hat":["Artisan Craft 2-4"],"Apprentice's Pants":["Artisan Craft 2-5"],"Apprentice's Boots":["Artisan Craft 2-6"],"Apprentice's Gloves":["Artisan Craft 2-7"],"Apprentice's Cape":["Artisan Craft 2-8"],"Canvas":["Artisan Craft 3-2"],"Twisted Cord":["Artisan Craft 3-3"],"Boots":["Artisan Craft 3-4"],"Canvas Paper":["Artisan Craft 3-5"],"Canvas Tool Grip":["Artisan Craft 3-6"],"Canvas Canopy":["Artisan Craft 4-1"],"Umberthread Tunic":["Artisan Craft 4-2"],"Umberthread Hat":["Artisan Craft 4-3"],"Umberthread Pants":["Artisan Craft 4-4"],"Umberthread Boots":["Artisan Craft 4-5"],"Umberthread Gloves":["Artisan Craft 4-6"],"Umberthread Cape":["Artisan Craft 4-7"],"Leather":["Artisan Craft 5-1"],"Braided Line":["Artisan Craft 5-2"],"Leather Tool Grip":["Artisan Craft 5-3"],"Hideleaf":["Artisan Craft 5-4"],"Flexstitch Reinforcement":["Artisan Craft 5-5"],"Leather Straps":["Artisan Craft 6-1"],"Leather Sack":["Artisan Craft 6-2"],"Heartspire Cloth":["Artisan Craft 7-1"],"Heartspire Rope":["Artisan Craft 7-2"],"Heartspire Scroll":["Artisan Craft 7-3"],"Guild Banner":["Artisan Craft 7-4"],"Violetfang Cloak":["Artisan Craft 7-5"],"Violetfang Gloves":["Artisan Craft 7-6"],"Violetfang Pants":["Artisan Craft 7-7"],"Violetfang Boots":["Artisan Craft 7-8"],"Violetfang Chestguard":["Artisan Craft 7-9"],"Violetfang Helmet":["Artisan Craft 7-10"],"Heartspire Tool Grip":["Artisan Craft 7-11"],"Heartspire Pouch":["Artisan Craft 8-2"],"Heartspire Reinforcement":["Artisan Craft 8-3"],"Nightwood Paper":["Artisan Craft 9-1"],"Nightwood Cloth":["Artisan Craft 9-2"],"Nightwood Rope":["Artisan Craft 9-3"],"Nightwood Tool Grip":["Artisan Craft 9-4"],"Heartspire Cape":["Artisan Craft 10-1"],"Heartspire Gloves":["Artisan Craft 10-2"],"Heartspire Boots":["Artisan Craft 10-3"],"Heartspire Straps":["Artisan Craft 10-4"],"Axe Blueprint":["Engineer Design 1-2"],"Shovel Blueprint":["Engineer Design 1-3"],"Pickaxe Blueprint":["Engineer Design 1-4"],"Bucket Blueprint":["Engineer Design 1-5"],"Glorb Toolbox Blueprint":["Engineer Design 1-6"],"Iron Axe Blueprint":["Engineer Design 3-2"],"Iron Shovel Blueprint":["Engineer Design 3-3"],"Iron Pickaxe Blueprint":["Engineer Design 3-4"],"Improved Bucket Blueprint":["Engineer Design 3-5"],"Wheel Blueprint":["Engineer Design 3-7"],"Tyxen Toolkit Blueprint":["Engineer Design 3-8"],"Saw Blueprint":["Engineer Design 5-1"],"Quicksilver Pickaxe Blueprint":["Engineer Design 5-2"],"Quicksilver Shovel Blueprint":["Engineer Design 5-3"],"Extraction Pipe Blueprint":["Engineer Design 5-4"],"Alchemical Flask Blueprint":["Engineer Design 5-5"],"Pulley Blueprint":["Engineer Design 5-6"],"Plumhide Bucket Blueprint":["Engineer Design 5-7"],"Engine Blueprint":["Engineer Design 6-1"],"Gate Blueprint":["Engineer Design 6-2"],"Compass Blueprint":["Engineer Design 7-1"],"Alembic and Retort Blueprint":["Engineer Design 7-2"],"Stronghold Blueprint":["Engineer Design 7-3"],"Logging Machine Blueprint":["Engineer Design 7-4"],"Extraction Tower Blueprint":["Engineer Design 7-5"],"Luminite Axe Blueprint":["Engineer Design 7-6"],"Luminite Pickaxe Blueprint":["Engineer Design 7-7"],"Luminite Shovel Blueprint":["Engineer Design 7-8"],"Heartspire Bucket Blueprint":["Engineer Design 7-9"],"Luminite Toolkit Blueprint":["Engineer Design 8-1"],"Superior Luminite Axe Blueprint":["Engineer Design 9-1"],"Nightwood Bucket Blueprint":["Engineer Design 9-2"],"Heavy Lift Crane Blueprint":["Engineer Design 9-3"],"Kronscale Shovel Blueprint":["Engineer Design 10-1"],"Kronscale Pickaxe Blueprint":["Engineer Design 10-2"],"Copper Wire":["Engineer Component 1-4"],"Frame":["Engineer Component 2-1"],"Wheel":["Engineer Component 4-1"],"Hardwood Frame":["Engineer Component 4-2"],"Alchemical Flask":["Engineer Component 5-1"],"Pulley":["Engineer Component 6-1"],"Tome of Constructive Order":["Engineer Component 6-2"],"Engine":["Engineer Component 6-3"],"Gate":["Engineer Component 6-4"],"Compass":["Engineer Component 7-1"],"Alembic and Retort":["Engineer Component 7-2"],"Liquid Valannite":["Alchemist Craft 1-1","Alchemist Discovery 1-1"],"Liquid Honey Drop":["Alchemist Craft 2-1","Alchemist Discovery 1-1","Alchemist Discovery 3-1"],"Infused Copper Ingot":["Alchemist Craft 2-2"],"Liquid Dragon Breath":["Alchemist Craft 3-1","Alchemist Discovery 3-1","Alchemist Discovery 6-1"],"Fire Juice":["Alchemist Craft 3-2"],"Infused Iron Ingot":["Alchemist Craft 4-1"],"Rose Dust":["Alchemist Craft 5-1","Alchemist Discovery 3-1"],"Meld Ash":["Alchemist Craft 5-2","Alchemist Discovery 3-1"],"Rose Glass":["Alchemist Craft 5-3"],"Infused Quicksilver Ingot":["Alchemist Craft 5-4"],"Liquid Astralite":["Alchemist Craft 6-1"],"Luminous Powder":["Alchemist Craft 7-1","Alchemist Discovery 6-1"],"Moon Ash":["Alchemist Craft 7-2","Alchemist Discovery 6-1"],"Reflective Glass":["Alchemist Craft 7-3"],"Valannite Powder":["Alchemist Craft 8-1"],"Infused Luminite Ingot":["Alchemist Craft 8-2"],"Liquid Vipharine":["Alchemist Craft 8-3"],"Honey Drop Powder":["Alchemist Craft 8-4"],"Gemweld Resin":["Alchemist Craft 8-5"],"Dragon Breath Powder":["Alchemist Craft 8-6"],"Natron":["Alchemist Discovery 1-1"],"Limestone":["Alchemist Discovery 1-1"],"Liquid Celespar":["Alchemist Discovery 6-1","Alchemist Potioncraft 4-2"],"Potion of Strength":["Alchemist Potioncraft 2-1"],"Glass":["Alchemist Potioncraft 3-1"],"Potion of Health":["Alchemist Potioncraft 4-1"],"Wipe Memory Potion":["Alchemist Potioncraft 5-2"],"Swiftstride Serum":["Alchemist Potioncraft 5-3"],"Potion of Stamina":["Alchemist Potioncraft 8-1"],"Meadborne Sword":["Blacksmith Weapon 2-1"],"Meadborne Staff":["Blacksmith Weapon 2-2"],"Meadborne Bow":["Blacksmith Weapon 2-3"],"Flametongue Sword":["Blacksmith Weapon 4-1"],"Flametongue Staff":["Blacksmith Weapon 4-2"],"Flametongue Bow":["Blacksmith Weapon 4-3"],"Gleamspar Sword":["Blacksmith Weapon 6-1"],"Gleamspar Staff":["Blacksmith Weapon 6-2"],"Gleamspar Bow":["Blacksmith Weapon 6-3"],"Luminglade Sword":["Blacksmith Weapon 9-1"],"Luminglade Staff":["Blacksmith Weapon 9-2"],"Luminglade Bow":["Blacksmith Weapon 9-3"],"Luminglade Shield":["Blacksmith Weapon 9-4"],"Axe":["Blacksmith Tool 1-1"],"Shovel":["Blacksmith Tool 1-2"],"Pickaxe":["Blacksmith Tool 1-3"],"Bucket":["Blacksmith Tool 1-4"],"Glorb Toolbox":["Blacksmith Tool 1-5"],"Iron Axe":["Blacksmith Tool 3-1"],"Iron Shovel":["Blacksmith Tool 3-2"],"Iron Pickaxe":["Blacksmith Tool 3-3"],"Improved Bucket":["Blacksmith Tool 3-4"],"Tyxen Toolkit":["Blacksmith Tool 3-5"],"Iron Hoop":["Blacksmith Tool 4-1"],"Extraction Pipe":["Blacksmith Tool 5-1"],"Quicksilver Hoop":["Blacksmith Tool 5-2"],"Quicksilver Saw":["Blacksmith Tool 5-3"],"Quicksilver Shovel":["Blacksmith Tool 5-4"],"Quicksilver Pickaxe":["Blacksmith Tool 5-5"],"Plumhide Bucket":["Blacksmith Tool 5-6"],"Luminite Axe":["Blacksmith Tool 7-1"],"Luminite Pickaxe":["Blacksmith Tool 7-2"],"Luminite Shovel":["Blacksmith Tool 7-3"],"Heartspire Bucket":["Blacksmith Tool 7-4"],"Quicksilver Reinforcement":["Blacksmith Tool 7-5"],"Luminite Toolkit":["Blacksmith Tool 8-1"],"Superior Luminite Axe":["Blacksmith Tool 9-1"],"Nightwood Bucket":["Blacksmith Tool 9-2"],"Kronscale Pickaxe":["Blacksmith Tool 10-1"],"Kronscale Shovel":["Blacksmith Tool 10-2"],"Copper Ingot":["Blacksmith Forge 1-1"],"Iron Ingot":["Blacksmith Forge 3-1"],"Ironrot Chestplate":["Blacksmith Forge 4-1"],"Ironrot Helmet":["Blacksmith Forge 4-2"],"Ironrot Pants":["Blacksmith Forge 4-3"],"Ironrot Boots":["Blacksmith Forge 4-4"],"Ironrot Gauntlets":["Blacksmith Forge 4-5"],"Quicksilver Ingot":["Blacksmith Forge 5-1"],"Coreplate Reinforcement":["Blacksmith Forge 5-2"],"Petalsteel Chestplate":["Blacksmith Forge 7-1"],"Petalsteel Helmet":["Blacksmith Forge 7-2"],"Petalsteel Pants":["Blacksmith Forge 7-3"],"Petalsteel Boots":["Blacksmith Forge 7-4"],"Petalsteel Gauntlets":["Blacksmith Forge 7-5"],"Luminite Ingot":["Blacksmith Forge 7-6"],"Kronscale Ingot":["Blacksmith Forge 10-1"],"Luminite Reinforcement":["Blacksmith Forge 10-2"],"Softwood Beam":["Architect Construct 1-3"],"Softwood Handle":["Architect Construct 1-4"],"Stairs":["Architect Construct 2-1"],"Wayfarer's Tent":["Architect Construct 2-2"],"Softwood Plank":["Architect Construct 2-3"],"Hardwood Beam":["Architect Construct 3-3"],"Hardwood Handle":["Architect Construct 3-4"],"Brick":["Architect Construct 3-5"],"Chest":["Architect Construct 4-1"],"Barrel":["Architect Construct 4-2"],"Traveler's Tent":["Architect Construct 4-3"],"Hardwood Plank":["Architect Construct 4-4"],"Plumhide Handle":["Architect Construct 5-1"],"Machine Chassis":["Architect Construct 6-1"],"Wall":["Architect Construct 6-2"],"Tower":["Architect Construct 6-3"],"Great Hall":["Architect Construct 7-1"],"Stronghold":["Architect Construct 7-2"],"Heartspire Handle":["Architect Construct 7-3"],"Heartspire Beam":["Architect Construct 8-1"],"Heartspire Plank":["Architect Construct 8-2"],"Cranefoot Foundation":["Architect Construct 8-3"],"Crane Mast":["Architect Construct 8-4"],"Crane Descent Platform":["Architect Construct 9-1"],"Heavy Lift Crane":["Architect Construct 9-2"],"Nightwood Tool Handle":["Architect Construct 9-3"],"Nightwood Beam":["Architect Construct 9-4"],"Tunnel Substructure":["Architect Construct 10-1"],"Reinforced Tunnel Arch":["Architect Construct 10-2"],"Stonebinder":["Architect Construct 10-3"],"Processed Valannite":["Jeweler Process 1-1"],"Processed Honey Drop":["Jeweler Process 2-1"],"Processed Dragon Breath":["Jeweler Process 3-1"],"Processed Celespar":["Jeweler Process 4-1"],"Processed Astralite":["Jeweler Process 6-1"],"Processed Vipharine":["Jeweler Process 9-1"],"Copper Ring of Valannite":["Jeweler Adornment 2-1"],"Copper Ring of Resistance":["Jeweler Adornment 3-1"],"Iron Pendant of the Dragon":["Jeweler Adornment 4-1"],"Infused Iron Ring of Valannite":["Jeweler Adornment 5-1"],"Infused Iron Ring of Haste":["Jeweler Adornment 5-2"],"Glasses":["Jeweler Adornment 6-1"],"Pendant of Vital Surge":["Jeweler Adornment 6-2"],"Ring of Pulse":["Jeweler Adornment 6-3"],"Ring of Artisan's Flow":["Jeweler Adornment 6-4"],"Powergleam Orb":["Jeweler Adornment 7-1"],"Rose Glasses":["Jeweler Adornment 7-2"],"Quickspark Pendant":["Jeweler Adornment 7-3"],"Wardbound Orb":["Jeweler Adornment 8-1"],"Heartgrasp Ring":["Jeweler Adornment 8-2"],"Guardflow Pendant":["Jeweler Adornment 8-3"],"Dragonbreath Orb":["Jeweler Adornment 9-1"],"Guardseal Pendant":["Jeweler Adornment 10-1"],"Fortress Orb":["Jeweler Adornment 10-2"]};

const ITEM_IMAGES = {"Tome of Constructive Order":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/tome-of-constructive-order.png","Apprentice's Boots":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/boots/apprentices-boots.png","Violetfang Helmet":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/helmets/violetfang-helmet.png","Traveler's Tent":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/buildings/small-structures/travelers-tent.png","Heartspire Cloth":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/heartspire-cloth.png","Wall":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/buildings/structures/wall.png","Rose Dust":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/rose-dust.png","Processed Celespar":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/processed-gems/processed-celespar.png","Plumhide":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/plumhide.png","Iron Shovel Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/iron-shovel-blueprint.png","Luminite Ingot":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/refined-materials/luminite-ingot.png","Violetfang Pants":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/greaves/violetfang-pants.png","Wipe Memory Potion":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/consumable-components/wipe-memory-potion.png","Hardwood Handle":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/hardwood-handle.png","Ironrot Chestplate":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/chestplate/ironrot-chestplate.png","Petalsteel Chestplate":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/chestplate/petalsteel-chestplate.png","Dragon Breath":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/gems/dragon-breath.png","Extraction Pipe Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/extraction-pipe-blueprint.png","Softwood Plank":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/softwood-plank.png","Softwood Fibers":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/softwood-fibers.png","Tyxen Toolkit":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/tyxen-toolkit.png","Softwood":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/softwood.png","Umberthread Tunic":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/chestplate/umberthread-tunic.png","Iron Axe":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/iron-axe.png","Mirrormist":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/mirrormist.png","Canvas":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/canvas.png","Leather Sack":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/leather-sack.png","Alchemical Flask":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/alchemical-flask.png","Quicksilver Hoop":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/quicksilver-hoop.png","Valannite":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/gems/valannite.png","Braided Line":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/braided-line.png","Ironrot Helmet":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/helmets/ironrot-helmet.png","Barrel":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/barrel.png","Machine Chassis":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/machine-chassis.png","Petalsteel Gauntlets":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/gauntlets/petalsteel-gauntlets.png","Copper Wire":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/copper-wire.png","Improved Bucket Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/improved-bucket-blueprint.png","Umberthread Gloves":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/gauntlets/umberthread-gloves.png","Moon Ash":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/moon-ash.png","Small Crystal":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/small-crystal.png","Hardwood":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/hardwood.png","Processed Astralite":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/processed-gems/processed-astralite.png","Iron Pickaxe Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/iron-pickaxe-blueprint.png","Rose Glasses":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/helmets/rose-glasses.png","Apprentice's Tunic":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/chestplate/apprentices-tunic.png","Heartspire":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/heartspire.png","Flexstitch Reinforcement":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/flexstitch-reinforcement.png","Processed Dragon Breath":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/processed-gems/processed-dragon-breath.png","Shovel":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/shovel.png","Softwood Handle":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/softwood-handle.png","Ironrot Gauntlets":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/gauntlets/ironrot-gauntlets.png","Alembic and Retort Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/alembic-and-retort-blueprint.png","Canvas Paper":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/canvas-paper.png","Softwood Beam":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/softwood-beam.png","Liquid Valannite":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/liquid-gems/liquid-valannite.png","Pickaxe":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/pickaxe.png","Pulley":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/pulley.png","Apprentice's Pants":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/greaves/apprentices-pants.png","Violetfang Chestguard":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/chestplate/violetfang-chestguard.png","Engine Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/engine-blueprint.png","Small Crystal Vein Map":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/maps/crystal-maps/small-crystal-vein-map.png","Tower":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/buildings/structures/tower.png","Saw Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/saw-blueprint.png","Infused Quicksilver Ingot":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/infused-quicksilver-ingot.png","Alchemical Flask Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/alchemical-flask-blueprint.png","Compass Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/compass-blueprint.png","Engine":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/engine.png","Bucket Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/bucket-blueprint.png","Twisted Cord":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/twisted-cord.png","Medium Crystal Vein Map":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/maps/crystal-maps/medium-crystal-vein-map.png","Extraction Pipe":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/extraction-pipe.png","Gate Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/gate-blueprint.png","Apprentice's Hat":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/helmets/apprentices-hat.png","Apprentice's Cape":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/cloak/apprentices-cape.png","Large Crystal Vein Map":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/maps/crystal-maps/large-crystal-vein-map.png","Honey Drop":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/gems/honey-drop.png","Astralite":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/gems/astralite.png","Cloth Canopy":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/cloth-canopy.png","Quicksilver Shovel Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/quicksilver-shovel-blueprint.png","Logging Machine Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/logging-machine-blueprint.png","Wayfarer's Tent":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/buildings/small-structures/wayfarers-tent.png","Gleamspar Bow":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/bows/gleamspar-bow.png","Ring of Pulse":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/rings/ring-of-pulse.png","Glass":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/glass.png","Glorb Toolbox Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/glorb-toolbox-blueprint.png","Petalsteel Boots":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/boots/petalsteel-boots.png","Iron Ore":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/iron-ore.png","Canvas Canopy":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/canvas-canopy.png","Swiftstride Serum":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/consumable-components/swiftstride-serum.png","Water":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/water.png","Ironrot Pants":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/greaves/ironrot-pants.png","Powergleam Orb":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/powergleam-orb.png","Meadborne Sword":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/swords/meadborne-sword.png","Ironrot Boots":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/boots/ironrot-boots.png","Infused Iron Ring of Haste":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/rings/infused-iron-ring-of-haste.png","Frame":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/frame.png","Coal":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/coal.png","Glasses":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/helmets/glasses.png","Guild Banner":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/guild-banner.png","Extraction Tower Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/extraction-tower-blueprint.png","Violetfang Cloak":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/cloak/violetfang-cloak.png","Cloth Tool Grip":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/cloth-tool-grip.png","Hardwood Plank":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/hardwood-plank.png","Copper Ring of Resistance":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/rings/copper-ring-of-resistance.png","Meadborne Staff":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/staffs/meadborne-staff.png","Iron Shovel":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/iron-shovel.png","Axe":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/axe.png","Heartspire Handle":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/heartspire-handle.png","Glorb Toolbox":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/glorb-toolbox.png","Infused Iron Ingot":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/infused-iron-ingot.png","Great Hall":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/buildings/megastructures/great-hall.png","Hardwood Beam":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/hardwood-beam.png","Plumhide Fibers":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/plumhide-fibers.png","Stronghold Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/stronghold-blueprint.png","Vipharine":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/gems/vipharine.png","Processed Honey Drop":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/processed-gems/processed-honey-drop.png","Quickspark Pendant":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/pendants/quickspark-pendant.png","Iron Axe Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/iron-axe-blueprint.png","Wheel":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/wheel.png","Reflective Glass":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/reflective-glass.png","Alembic and Retort":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/alembic-and-retort.png","Blackblood":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/blackblood.png","Bucket":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/bucket.png","Iron Hoop":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/iron-hoop.png","Limestone":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/limestone.png","Potion of Strength":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/consumable-components/potion-of-strength.png","Leather Straps":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/leather-straps.png","Iron Pickaxe":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/iron-pickaxe.png","Umberthread Boots":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/boots/umberthread-boots.png","Compass":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/compass.png","Copper Ring of Valannite":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/rings/copper-ring-of-valannite.png","Plumhide Handle":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/plumhide-handle.png","Luminite Ore":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/luminite-ore.png","Stormwater":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/stormwater.png","Meadborne Bow":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/bows/meadborne-bow.png","Boots":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/boots.png","Quicksilver Shovel":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/quicksilver-shovel.png","Large Crystal":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/large-crystal.png","Clay":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/clay.png","Quicksilver Saw":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/quicksilver-saw.png","Heartspire Rope":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/heartspire-rope.png","Pulley Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/pulley-blueprint.png","Apprentice's Gloves":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/gauntlets/apprentices-gloves.png","Violetfang Boots":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/boots/violetfang-boots.png","Liquid Honey Drop":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/liquid-gems/liquid-honey-drop.png","Meat":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/consumable-components/meat.png","Chest":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/chest.png","Celespar":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/gems/celespar.png","Heartspire Fibers":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/heartspire-fibers.png","Paper":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/paper.png","Processed Valannite":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/processed-gems/processed-valannite.png","Gleamspar Staff":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/staffs/gleamspar-staff.png","Shovel Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/shovel-blueprint.png","Potion of Health":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/consumable-components/potion-of-health.png","Cinnabar Ore":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/cinnabar-ore.png","Cloth":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/cloth.png","Iron Pendant of the Dragon":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/pendants/iron-pendant-of-the-dragon.png","Gleamspar Sword":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/swords/gleamspar-sword.png","Iron Ingot":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/refined-materials/iron-ingot.png","Petalsteel Helmet":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/helmets/petalsteel-helmet.png","Coreplate Reinforcement":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/coreplate-reinforcement.png","Quicksilver Ingot":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/refined-materials/quicksilver-ingot.png","Leather Tool Grip":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/leather-tool-grip.png","Pendant of Vital Surge":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/pendants/pendant-of-vital-surge.png","Heartspire Scroll":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/heartspire-scroll.png","Copper Ore":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/copper-ore.png","Umberthread Cape":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/cloak/umberthread-cape.png","Flametongue Bow":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/bows/flametongue-bow.png","Liquid Astralite":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/liquid-gems/liquid-astralite.png","Flametongue Sword":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/swords/flametongue-sword.png","Wheel Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/wheel-blueprint.png","Moonslate":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/moonslate.png","Gate":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/buildings/structures/gate.png","Hideleaf":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/hideleaf.png","Meldstone":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/meldstone.png","Ring of Artisan's Flow":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/rings/ring-of-artisans-flow.png","Stairs":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/stairs.png","Canvas Tool Grip":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/canvas-tool-grip.png","Umberthread Hat":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/helmets/umberthread-hat.png","Copper Ingot":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/refined-materials/copper-ingot.png","Tyxen Toolkit Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/tyxen-toolkit-blueprint.png","Natron":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/natron.png","Improved Bucket":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/improved-bucket.png","Infused Iron Ring of Valannite":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/rings/infused-iron-ring-of-valannite.png","Liquid Dragon Breath":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/liquid-gems/liquid-dragon-breath.png","Liquid Celespar":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/liquid-gems/liquid-celespar.png","Stronghold":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/buildings/megastructures/stronghold.png","Petalsteel Pants":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/greaves/petalsteel-pants.png","Hardwood Frame":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/hardwood-frame.png","Flametongue Staff":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/staffs/flametongue-staff.png","Charcoal":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/charcoal.png","Quicksilver Pickaxe":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/quicksilver-pickaxe.png","Umberthread Pants":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/greaves/umberthread-pants.png","Violetfang Gloves":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/equipments/gauntlets/violetfang-gloves.png","Hardwood Fibers":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/hardwood-fibers.png","Axe Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/axe-blueprint.png","Rose Glass":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/rose-glass.png","Medium Crystal":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/medium-crystal.png","Pickaxe Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/pickaxe-blueprint.png","Quicksilver Pickaxe Blueprint":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/blueprints/quicksilver-pickaxe-blueprint.png","Infused Copper Ingot":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/infused-copper-ingot.png","Luminous Powder":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/luminous-powder.png","Meld Ash":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/meld-ash.png","Leather":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/leather.png","Fire Juice":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/fire-juice.png","Brick":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/brick.png","Elderwater":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/elderwater.png","Gemweld Resin":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/special-components/gemweld-resin.png","Dragon Breath Powder":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/gem-dust/dragon-breath-powder.png","Honey Drop Powder":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/gem-dust/honey-drop-powder.png","Valannite Powder":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/gem-dust/valannite-powder.png","Processed Vipharine":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/processed-gems/processed-vipharine.png","Liquid Vipharine":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/gems/liquid-gems/liquid-vipharine.png","Pyrestarter":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/pyrestarter.png","Kronyx Ore":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/kronyx-ore.png","Nightwood":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/nightwood.png","Heartspire Beam":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/heartspire-beam.png","Heartspire Plank":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/heartspire-plank.png","Heartspire Pouch":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/heartspire-pouch.png","Heartspire Reinforcement":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/heartspire-reinforcement.png","Heartspire Tool Grip":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/heartspire-tool-grip.png","Heartspire Bucket":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/heartspire-bucket.png","Nightwood Cloth":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/nightwood-cloth.png","Nightwood Rope":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/nightwood-rope.png","Nightwood Paper":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/nightwood-paper.png","Nightwood Fibers":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/raw-materials/nightwood-fibers.png","Nightwood Beam":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/nightwood-beam.png","Nightwood Tool Handle":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/nightwood-tool-handle.png","Kronscale Ingot":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/refined-materials/kronscale-ingot.png","Luminite Toolkit":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/luminite-toolkit.png","Luminite Reinforcement":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/luminite-reinforcement.png","Luminite Axe":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/luminite-axe.png","Luminite Pickaxe":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/luminite-pickaxe.png","Luminite Shovel":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/luminite-shovel.png","Superior Luminite Axe":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/superior-luminite-axe.png","Infused Luminite Ingot":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/resources/refined-materials/infused-luminite-ingot.png","Quicksilver Reinforcement":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/crafted-components/quicksilver-reinforcement.png","Plumhide Bucket":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/plumhide-bucket.png","Nightwood Bucket":"https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/components/tools/nightwood-bucket.png"};

function fmtTime(s) {
  if (!s) return '?';
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

// Recipe types that are gathering/farming (not pure crafting) - treat as raw
const GATHER_TYPES = ['Excavation','Extraction','Farm','Survey','Pet'];
function isGatherRecipe(name) {
  return GATHER_TYPES.some(t => name.includes(t));
}

// Flattens a recipe into raw ingredients recursively, returns {kindName: totalAmount}
// Only decomposes pure craft recipes, treats gathering outputs as raw materials
function flattenIngredients(recipeName, qty, visited = new Set()) {
  const r = VALANNIA_RECIPES[recipeName];
  if (!r) return {};
  const result = {};
  for (const [ing, amt] of r.i) {
    const total = amt * qty;
    // Find a craftable (non-gathering) source for this ingredient
    const sources = (RECIPE_PROD_INDEX[ing] || []).filter(s => !isGatherRecipe(s));
    if (sources.length > 0 && !visited.has(ing)) {
      const sub = flattenIngredients(sources[0], total, new Set([...visited, ing]));
      for (const [k, v] of Object.entries(sub)) {
        result[k] = (result[k] || 0) + v;
      }
    } else {
      // Raw material or gathering ingredient - count as-is
      result[ing] = (result[ing] || 0) + total;
    }
  }
  return result;
}

// Tree node component for visual tree view
function CraftNode({ kindName, amount, depth=0, visited=new Set(), qty=1 }) {
  if (depth > 5 || visited.has(kindName)) return null;
  const nv = new Set(visited); nv.add(kindName);
  const [open, setOpen] = React.useState(depth < 2);
  const allSources = RECIPE_PROD_INDEX[kindName] || [];
  const sources = allSources.filter(s => !isGatherRecipe(s));
  const hasCraft = sources.length > 0;
  const srcRecipe = hasCraft ? VALANNIA_RECIPES[sources[0]] : null;
  const totalAmt = amount * qty;
  const isRaw = !hasCraft;
  const depthColors = ['var(--pf-gold-light)','var(--pf-text)','var(--pf-text-muted)','var(--pf-text-muted)','var(--pf-text-muted)'];

  return (
    <div style={{
      marginLeft: depth > 0 ? 20 : 0,
      borderLeft: depth > 0 ? `1px solid rgba(212,168,67,${0.3 - depth*0.05})` : 'none',
      paddingLeft: depth > 0 ? 10 : 0,
      marginTop: 3
    }}>
      <div style={{
        display:'flex', alignItems:'center', gap:6, padding:'4px 6px',
        background: depth === 0 ? 'rgba(212,168,67,0.05)' : 'transparent',
        border: depth === 0 ? '1px solid var(--pf-border)' : 'none',
        borderRadius: 0
      }}>
        {hasCraft
          ? <button onClick={()=>setOpen(o=>!o)} style={{
              background:'transparent', border:'1px solid var(--pf-border)',
              color:'var(--pf-text-muted)', width:16, height:16, fontSize:9,
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
            }}>{open ? '▼' : '▶'}</button>
          : <span style={{width:16, flexShrink:0, textAlign:'center', fontSize:10, color:'var(--pf-text-muted)'}}>◆</span>
        }
        <span style={{display:'flex', alignItems:'center', gap:6, flex:1}}>
          {ITEM_IMAGES[kindName] && (
            <img
              src={ITEM_IMAGES[kindName]}
              alt={kindName}
              style={{width: depth===0?24:18, height: depth===0?24:18, objectFit:'contain', flexShrink:0,
                filter:'drop-shadow(0 1px 3px rgba(0,0,0,0.5))'}}
              onError={e => { e.target.style.display='none'; }}
            />
          )}
          <span style={{
            fontSize: depth === 0 ? 13 : 11,
            color: depthColors[Math.min(depth, 4)],
            fontFamily: depth === 0 ? 'var(--font-heading)' : 'var(--font-main)',
            fontWeight: depth === 0 ? 700 : 400,
          }}>
            {kindName}
          </span>
        </span>
        <span style={{
          fontSize: 12, fontWeight: 'bold',
          color: isRaw ? 'var(--pf-orange)' : 'var(--pf-gold)',
          background: isRaw ? 'rgba(255,107,26,0.1)' : 'rgba(212,168,67,0.08)',
          border: `1px solid ${isRaw ? 'rgba(255,107,26,0.3)' : 'rgba(212,168,67,0.2)'}`,
          padding:'1px 8px', minWidth:36, textAlign:'center', flexShrink:0
        }}>
          {totalAmt}
        </span>
        {hasCraft && srcRecipe && (
          <span style={{fontSize:9, color:'var(--pf-text-muted)', flexShrink:0, marginLeft:2}}>
            {srcRecipe.p} · {fmtTime(srcRecipe.s)}
          </span>
        )}
        {isRaw && <span style={{fontSize:8, color:'var(--pf-text-muted)', border:'1px solid var(--pf-border)', padding:'1px 3px', flexShrink:0}}>RAW</span>}
      </div>
      {open && hasCraft && srcRecipe && (
        <div>
          {srcRecipe.i.map(([ing, amt]) => (
            <CraftNode key={ing} kindName={ing} amount={amt} depth={depth+1} visited={nv} qty={totalAmt} />
          ))}
        </div>
      )}
    </div>
  );
}

// Main calculator panel - shared between Heroes and Crafting views
function CraftingCalculator({ recipeName, onClose }) {
  const [qty, setQty] = React.useState(1);
  const r = VALANNIA_RECIPES[recipeName];
  if (!r) return null;

  const totalTime = fmtTime(r.s * qty);

  return (
    <div style={{display:'flex', flexDirection:'column', height:'100%', gap:0}}>
      {/* Header */}
      <div style={{
        background:'rgba(212,168,67,0.06)', border:'1px solid var(--pf-border)',
        padding:'12px 16px', marginBottom:12
      }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
          <div>
            <div style={{fontFamily:'var(--font-heading)', color:'var(--pf-gold-light)', fontSize:14, marginBottom:4}}>
              {recipeName}
            </div>
            <div style={{display:'flex', gap:12, fontSize:11, color:'var(--pf-text-muted)', flexWrap:'wrap'}}>
              <span>👤 {r.p}</span>
              <span>⭐ Nivel {r.l}</span>
              <span>⏱ {fmtTime(r.s)} / craft</span>
              <span style={{color:'var(--pf-orange)'}}>{r.t}</span>
            </div>
            {r.o.length > 0 && (
              <div style={{marginTop:6, fontSize:12}}>
                <span style={{color:'var(--pf-text-muted)'}}>Produce: </span>
                {r.o.map(p => <span key={p} style={{color:'var(--pf-gold)', marginRight:8, fontWeight:'bold'}}>{p}</span>)}
              </div>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} style={{background:'transparent', border:'none', color:'var(--pf-text-muted)', cursor:'pointer', fontSize:16, padding:'0 4px'}}>✕</button>
          )}
        </div>

        {/* Quantity selector */}
        <div style={{display:'flex', alignItems:'center', gap:8, marginTop:8}}>
          <span style={{fontSize:11, color:'var(--pf-text-muted)', fontFamily:'var(--font-heading)', letterSpacing:'0.1em', textTransform:'uppercase'}}>Cantidad:</span>
          <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{background:'transparent', border:'1px solid var(--pf-border)', color:'var(--pf-text)', width:26, height:26, cursor:'pointer', fontSize:14}}>−</button>
          <input
            type="number" min="1" max="9999" value={qty}
            onChange={e=>setQty(Math.max(1,parseInt(e.target.value)||1))}
            style={{width:60, textAlign:'center', background:'rgba(212,168,67,0.05)', border:'1px solid var(--pf-border)', color:'var(--pf-gold)', fontFamily:'var(--font-heading)', fontSize:14, padding:'3px 6px'}}
          />
          <button onClick={()=>setQty(q=>q+1)} style={{background:'transparent', border:'1px solid var(--pf-border)', color:'var(--pf-text)', width:26, height:26, cursor:'pointer', fontSize:14}}>+</button>
          {[5,10,25,50,100].map(n=>(
            <button key={n} onClick={()=>setQty(n)} style={{background:qty===n?'rgba(212,168,67,0.15)':'transparent', border:`1px solid ${qty===n?'var(--pf-gold)':'var(--pf-border)'}`, color:qty===n?'var(--pf-gold)':'var(--pf-text-muted)', padding:'3px 8px', cursor:'pointer', fontSize:10, fontFamily:'var(--font-heading)'}}>
              ×{n}
            </button>
          ))}
          <span style={{marginLeft:'auto', fontSize:11, color:'var(--pf-text-muted)'}}>⏱ Total: <strong style={{color:'var(--pf-gold)'}}>{totalTime}</strong></span>
        </div>
      </div>

      <div style={{display:'flex', gap:12, flexGrow:1, minHeight:0}}>
        <div style={{flex:1, display:'flex', flexDirection:'column', minWidth:0}}>
          <div style={{fontSize:10, color:'var(--pf-text-muted)', fontFamily:'var(--font-heading)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6}}>
            🌿 Árbol de crafteo
          </div>
          <div style={{flexGrow:1, overflowY:'auto', background:'rgba(0,0,0,0.2)', border:'1px solid var(--pf-border)', padding:'10px'}}>
            {r.i.map(([ing, amt]) => (
              <CraftNode key={ing} kindName={ing} amount={amt} depth={0} visited={new Set([recipeName])} qty={qty} />
            ))}
          </div>
        </div>


      </div>
    </div>
  );
}

// Hero recipe explorer (used in Heroes tab)
function RecipeExplorer({ hero }) {
  const prof = hero?.item?.attributes?.hero?.profession;
  const lvl = hero?.item?.attributes?.hero?.level || 1;
  const [search, setSearch] = React.useState('');
  const [sel, setSel] = React.useState(null);
  const [craftQty, setCraftQty] = React.useState(1);
  const [isCrafting, setIsCrafting] = React.useState(false);
  const [inventory, setInventory] = React.useState(null); // {kind: {id, amount}}
  const wallet = useWallet();
  const { connection } = useConnection();
  const toast = useToast();

  const valanToken = localStorage.getItem('valannia_v_token');

  // Fetch inventario Valannia al montar
  React.useEffect(() => {
    if (!valanToken) return;
    fetch('https://valannia-proxy.polarisfuel.workers.dev/asset/inventory/list?data=%7B%22pagination%22%3A%7B%22page%22%3A0%2C%22count%22%3A5000%7D%7D', {
      headers: { 'x-auth-token': valanToken, 'Authorization': `Bearer ${valanToken}` }
    }).then(r => r.json()).then(d => {
      const elements = d.result?.elements || [];
      const inv = {};
      elements.forEach(e => { if (e.kind) inv[e.kind] = { id: e.id, amount: e.amount || 1 }; });
      setInventory(inv);
    }).catch(() => {});
  }, [valanToken]);

  // Verifica si hay suficientes ingredientes para craftear qty unidades
  const checkIngredients = (recipeName, qty) => {
    if (!inventory) return null;
    const r = VALANNIA_RECIPES[recipeName];
    if (!r) return null;
    const missing = [];
    r.i.forEach(([ing, amt]) => {
      const needed = amt * qty;
      const have = inventory[ing]?.amount || 0;
      if (have < needed) missing.push({ ing, needed, have });
    });
    return missing;
  };

  const executeCraft = async (recipeName) => {
    if (!valanToken) { toast('Conecta Valannia primero.', 'error'); return; }
    if (!wallet.connected) { toast('Conecta tu wallet para firmar.', 'error'); return; }
    const r = VALANNIA_RECIPES[recipeName];
    if (!r) return;

    // Verificar ingredientes
    const missing = checkIngredients(recipeName, craftQty);
    if (missing && missing.length > 0) {
      toast(`Faltan ingredientes: ${missing.map(m => `${m.ing} (${m.have}/${m.needed})`).join(', ')}`, 'error');
      return;
    }

    // Construir array de ingredient UUIDs
    const ingredients = r.i.map(([ing]) => inventory[ing]?.id).filter(Boolean);
    if (ingredients.length !== r.i.length) {
      toast('No se encontraron todos los ingredientes en el inventario de Valannia.', 'error');
      return;
    }

    setIsCrafting(true);
    try {
      // 1. Request craft → obtener tx base64
      const reqRes = await fetch('https://valannia-proxy.polarisfuel.workers.dev/rtr/commander/craft/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': valanToken, 'Authorization': `Bearer ${valanToken}` },
        body: JSON.stringify({ hero: hero.id, recipe: recipeName, ingredients, count: craftQty })
      });
      const reqData = await reqRes.json();
      if (reqData.state !== 'Ok') throw new Error(reqData.message || 'Error en craft request');

      const txBase64 = reqData.result?.transaction;
      const craftId = reqData.result?.id;
      if (!txBase64) throw new Error('No se recibió transacción');

      // 2. Deserializar y firmar con wallet
      const txBytes = Uint8Array.from(atob(txBase64), c => c.charCodeAt(0));
      const versionedTx = VersionedTransaction.deserialize(txBytes);
      const signedTx = await wallet.signTransaction(versionedTx);

      // 3. Provide — enviar tx firmada
      const signedB64 = btoa(String.fromCharCode(...signedTx.serialize()));
      const provRes = await fetch('https://valannia-proxy.polarisfuel.workers.dev/rtr/commander/craft/provide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': valanToken, 'Authorization': `Bearer ${valanToken}` },
        body: JSON.stringify({ id: craftId, transaction: signedB64 })
      });
      const provData = await provRes.json();
      if (provData.state !== 'Ok') throw new Error(provData.message || 'Error en craft provide');

      toast(`✅ Craft iniciado: ${recipeName} ×${craftQty}`, 'success');

      // 4. Recargar inventario
      setTimeout(() => {
        fetch('https://valannia-proxy.polarisfuel.workers.dev/asset/inventory/list?data=%7B%22pagination%22%3A%7B%22page%22%3A0%2C%22count%22%3A5000%7D%7D', {
          headers: { 'x-auth-token': valanToken, 'Authorization': `Bearer ${valanToken}` }
        }).then(r => r.json()).then(d => {
          const inv = {};
          (d.result?.elements || []).forEach(e => { if (e.kind) inv[e.kind] = { id: e.id, amount: e.amount || 1 }; });
          setInventory(inv);
        });
      }, 2000);

    } catch (e) {
      toast(`Error crafting: ${e.message}`, 'error');
    }
    setIsCrafting(false);
  };

  const PROF_META = {
    Artisan:   { color:'#D4A843', icon:'🪡', logo:'https://portal.valannia.com/professions/logos/artisan.webp',    label:'Artisan'    },
    Blacksmith:{ color:'#CC3300', icon:'⚒️',  logo:'https://portal.valannia.com/professions/logos/blacksmith.webp', label:'Blacksmith' },
    Engineer:  { color:'#4A90D9', icon:'⚙️',  logo:'https://portal.valannia.com/professions/logos/engineering.webp',label:'Engineer'   },
    Alchemist: { color:'#8B5CF6', icon:'⚗️',  logo:'https://portal.valannia.com/professions/logos/alchemy.webp',   label:'Alchemist'  },
    Architect: { color:'#059669', icon:'🏗️',  logo:'https://portal.valannia.com/professions/logos/architecture.webp',label:'Architect' },
    Jeweler:   { color:'#EC4899', icon:'💎',  logo:'https://portal.valannia.com/professions/logos/jewelry.webp',   label:'Jeweler'    },
    Miner:     { color:'#78716C', icon:'⛏️',  logo:'https://portal.valannia.com/professions/logos/mining.webp',    label:'Miner'      },
    Explorer:  { color:'#10B981', icon:'🧭',  logo:'https://portal.valannia.com/professions/logos/exploration.webp',label:'Explorer'  },
  };

  const PROD_ICONS = {
    'Copper Ingot':'🟤','Iron Ingot':'⚙️','Quicksilver Ingot':'🔮','Luminite Ingot':'✨','Kronscale Ingot':'🌟',
    'Cloth':'🧵','Leather':'🟫','Canvas':'📄','Paper':'📃','Boots':'👢',
    'Axe':'🪓','Shovel':'🌿','Pickaxe':'⛏️','Bucket':'🪣',
    'Potion of Strength':'💪','Potion of Health':'❤️','Potion of Stamina':'⚡',
    'Softwood Beam':'🪵','Hardwood Beam':'🪵','Heartspire Beam':'🌲',
    'Copper Ore':'🟤','Iron Ore':'⬛','Luminite Ore':'🔵',
    'Glass':'🪟','Rose Glass':'🌹','Reflective Glass':'🪞',
    'Compass':'🧭','Engine':'⚙️','Gate':'🚪','Stronghold':'🏰',
  };
  const prodIcon = name => PROD_ICONS[name] || '✦';
  const m = PROF_META[prof] || { color: 'var(--pf-gold)', icon: '⚔️' };

  const profRecipes = React.useMemo(() => {
    if (!prof) return [];
    return Object.entries(VALANNIA_RECIPES)
      .filter(([,r]) => r.p===prof && r.l<=lvl)
      .sort((a,b) => a[1].l-b[1].l || a[0].localeCompare(b[0]));
  }, [prof, lvl]);

  const filtered = search
    ? profRecipes.filter(([n,r]) => n.toLowerCase().includes(search.toLowerCase()) || r.o.some(p=>p.toLowerCase().includes(search.toLowerCase())))
    : profRecipes;

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',gap:10}}>
      {/* Header con profesión */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
        <img src={m.logo} alt={prof} style={{width:20,height:20,objectFit:'contain'}} onError={e=>{e.target.style.display='none'}} />
        <span style={{fontFamily:'var(--font-heading)',fontSize:11,color:m.color,letterSpacing:'0.1em',textTransform:'uppercase'}}>
          {prof}
        </span>
        <span style={{fontSize:10,color:'var(--pf-text-muted)'}}>· Lv≤{lvl} · {profRecipes.length} recetas</span>
      </div>

      <input placeholder="Buscar receta o producto..." value={search} onChange={e=>{setSearch(e.target.value);setSel(null);}} className="axon-input" style={{fontSize:11,padding:'6px 10px'}}/>

      <div style={{display:'flex',gap:8,flexGrow:1,minHeight:0}}>
        {/* Lista de recetas — mismo estilo que VistaRecetas */}
        <div style={{width:200,flexShrink:0,overflowY:'auto',display:'flex',flexDirection:'column',gap:2}}>
          {filtered.map(([n,rv])=>{
            const active = sel===n;
            return (
              <button key={n} onClick={()=>setSel(n)}
                style={{background:active?`${m.color}18`:'transparent',border:`1px solid ${active?m.color:'var(--pf-border)'}`,color:active?m.color:'var(--pf-text)',padding:'6px 8px',cursor:'pointer',textAlign:'left',fontSize:'10px',transition:'0.15s'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'2px'}}>
                  <span style={{fontFamily:'var(--font-heading)',fontSize:'11px',letterSpacing:'0.03em',color:active?m.color:'var(--pf-text)',display:'flex',alignItems:'center',gap:'5px'}}>
                    <img src={m.logo} alt={prof} style={{width:13,height:13,objectFit:'contain',flexShrink:0,filter:active?'none':'grayscale(0.5) opacity(0.65)'}} onError={e=>{e.target.style.display='none'}} />
                    {n}
                  </span>
                  <span style={{fontSize:'9px',color:'var(--pf-text-muted)',flexShrink:0,marginLeft:'6px'}}>Lv{rv.l} · {fmtTime(rv.s)}</span>
                </div>
                {rv.o.length>0 && (
                  <div style={{fontSize:'9px',color:'var(--pf-text-muted)',marginTop:'1px'}}>
                    {rv.o.map(p=><span key={p} style={{marginRight:'6px'}}>{prodIcon(p)} {p}</span>)}
                  </div>
                )}
              </button>
            );
          })}
          {!filtered.length && <div style={{color:'var(--pf-text-muted)',fontSize:'12px',padding:'20px 0',textAlign:'center'}}>Sin resultados</div>}
        </div>

        {/* Panel calculadora + crafteo */}
        <div style={{flexGrow:1,overflowY:'auto',minWidth:0,display:'flex',flexDirection:'column',gap:10}}>
          {!sel
            ? <div className="empty-state" style={{marginTop:'40px'}}>Selecciona una receta para ver la calculadora.</div>
            : <>
                <CraftingCalculator recipeName={sel} />

                {/* Panel de crafteo */}
                <div style={{background:'rgba(212,168,67,0.04)',border:'1px solid var(--pf-border)',padding:'14px 16px',marginTop:4}}>
                  <div style={{fontFamily:'var(--font-heading)',fontSize:'10px',letterSpacing:'0.15em',textTransform:'uppercase',color:'var(--pf-text-muted)',marginBottom:10}}>
                    ⚒️ Ejecutar Craft
                  </div>

                  {/* Estado de ingredientes */}
                  {inventory && sel && (() => {
                    const r = VALANNIA_RECIPES[sel];
                    if (!r) return null;
                    return (
                      <div style={{marginBottom:12}}>
                        {r.i.map(([ing, amt]) => {
                          const have = inventory[ing]?.amount || 0;
                          const need = amt * craftQty;
                          const ok = have >= need;
                          return (
                            <div key={ing} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'11px',marginBottom:4}}>
                              <span style={{color:ok?'var(--pf-text)':'var(--pf-text-muted)'}}>{ing}</span>
                              <span style={{color:ok?'#4CAF50':'var(--pf-orange)',fontWeight:'bold',fontSize:'12px'}}>
                                {have}/{need} {ok?'✓':'✗'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {!inventory && valanToken && (
                    <div style={{fontSize:'11px',color:'var(--pf-text-muted)',marginBottom:10}}>Cargando inventario...</div>
                  )}
                  {!valanToken && (
                    <div style={{fontSize:'11px',color:'var(--pf-orange)',marginBottom:10}}>⚠️ Conecta Valannia para craftear.</div>
                  )}

                  {/* Selector cantidad + botón */}
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:'10px',color:'var(--pf-text-muted)',fontFamily:'var(--font-heading)',letterSpacing:'0.1em'}}>CANT:</span>
                    <button onClick={()=>setCraftQty(q=>Math.max(1,q-1))} style={{background:'transparent',border:'1px solid var(--pf-border)',color:'var(--pf-text)',width:24,height:24,cursor:'pointer',fontSize:14}}>−</button>
                    <input type="number" min="1" max="99" value={craftQty}
                      onChange={e=>setCraftQty(Math.max(1,parseInt(e.target.value)||1))}
                      style={{width:50,textAlign:'center',background:'rgba(212,168,67,0.05)',border:'1px solid var(--pf-border)',color:'var(--pf-gold)',fontFamily:'var(--font-heading)',fontSize:13,padding:'3px 6px'}}
                    />
                    <button onClick={()=>setCraftQty(q=>q+1)} style={{background:'transparent',border:'1px solid var(--pf-border)',color:'var(--pf-text)',width:24,height:24,cursor:'pointer',fontSize:14}}>+</button>
                    <button
                      onClick={() => executeCraft(sel)}
                      disabled={isCrafting || !valanToken || !wallet.connected}
                      className="axon-btn-primary"
                      style={{flex:1,padding:'8px 12px',fontSize:'10px',opacity:(isCrafting||!valanToken||!wallet.connected)?0.5:1}}
                    >
                      <span>{isCrafting ? '⏳ Crafteando...' : `⚒️ Craftear ×${craftQty}`}</span>
                    </button>
                  </div>
                </div>
              </>
          }
        </div>
      </div>
    </div>
  );
}


const HERO_BASE = 'https://s3.eu-north-1.amazonaws.com/resources.valannia.net/images/heroes';
const HERO_META = {
  'Akheton':{'cat':'beyond-heroes','slug':'akheton'},
  'Blaat':{'cat':'beyond-heroes','slug':'blaat'},
  'Bubuk':{'cat':'origin-heroes','slug':'bubuk'},
  'Cercunos':{'cat':'beyond-heroes','slug':'cercunos'},
  'Dexar':{'cat':'origin-heroes','slug':'dexar'},
  'Faerin Plumadorada':{'cat':'risen-heroes','slug':'faerin-plumadorada'},
  'Garathos':{'cat':'risen-heroes','slug':'garathos'},
  'Glorb':{'cat':'origin-heroes','slug':'glorb'},
  'Grunk':{'cat':'beyond-heroes','slug':'grunk'},
  'Isolde':{'cat':'origin-heroes','slug':'isolde'},
  'Kahelu':{'cat':'origin-heroes','slug':'kahelu'},
  'Kehkai':{'cat':'origin-heroes','slug':'kehkai'},
  'Lady Moonrise':{'cat':'origin-heroes','slug':'lady-moonrise'},
  'Malik':{'cat':'risen-heroes','slug':'malik'},
  'Master Kapuana':{'cat':'origin-heroes','slug':'master-kapuana'},
  'Mcallister':{'cat':'origin-heroes','slug':'mcallister'},
  'Melisande':{'cat':'origin-heroes','slug':'melisande'},
  'Mirix Troumbach':{'cat':'risen-heroes','slug':'mirix-troumbach'},
  'Netheros':{'cat':'origin-heroes','slug':'netheros'},
  'Olaventis':{'cat':'beyond-heroes','slug':'olaventis'},
  'Olravenour':{'cat':'origin-heroes','slug':'olravenour'},
  'Olvaney':{'cat':'origin-heroes','slug':'olvaney'},
  'Oxyboro':{'cat':'origin-heroes','slug':'oxyboro'},
  'Parlok':{'cat':'beyond-heroes','slug':'parlok'},
  'Phylune':{'cat':'beyond-heroes','slug':'phylune'},
  'Quarthani':{'cat':'origin-heroes','slug':'quarthani'},
  'Queen Alia':{'cat':'origin-heroes','slug':'queen-alia'},
  'Quelthor':{'cat':'origin-heroes','slug':'quelthor'},
  'Rakka':{'cat':'beyond-heroes','slug':'rakka'},
  'Razuzel':{'cat':'origin-heroes','slug':'razuzel'},
  'Reb Heron':{'cat':'beyond-heroes','slug':'reb-heron'},
  'Sir Arcturus':{'cat':'origin-heroes','slug':'sir-arcturus'},
  'Sir Augustus':{'cat':'beyond-heroes','slug':'sir-augustus'},
  'Sir Kastain':{'cat':'beyond-heroes','slug':'sir-kastain'},
  'Sir Mandrake':{'cat':'beyond-heroes','slug':'sir-mandrake'},
  'Sir Orion':{'cat':'risen-heroes','slug':'sir-orion'},
  'The Great Snake':{'cat':'origin-heroes','slug':'the-great-snake'},
  'The Yellow Knight':{'cat':'beyond-heroes','slug':'the-yellow-knight'},
  'Thrak':{'cat':'risen-heroes','slug':'thrak'},
  'Vintharis':{'cat':'risen-heroes','slug':'vintharis'},
  'Whisker':{'cat':'origin-heroes','slug':'whisker'},
  'Xyra':{'cat':'origin-heroes','slug':'xyra'},
  'Yzmari':{'cat':'risen-heroes','slug':'yzmari'},
  'Zeferlin Quorax':{'cat':'beyond-heroes','slug':'zeferlin-quorax'},
  'Zeltharis':{'cat':'origin-heroes','slug':'zeltharis'},
  'Zindara':{'cat':'beyond-heroes','slug':'zindara'},
  'Zlurp':{'cat':'origin-heroes','slug':'zlurp'},
  'Zorvan':{'cat':'beyond-heroes','slug':'zorvan'},
};

function getHeroImg(kind, border) {
  const m = HERO_META[kind];
  if (!m) return null;
  const borderSlug = border ? border.toLowerCase() : 'silver';
  return `${HERO_BASE}/${m.cat}/${m.slug}/${m.slug}-${borderSlug}.png`;
}


function VistaCrafteo({ cuentas, t }) {
  // ── PRÓXIMAMENTE — código oculto hasta que Valannia habilite acceso API ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '24px' }}>
      <div style={{ fontSize: '64px', filter: 'grayscale(0.3)' }}>⚔️</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', color: 'var(--pf-gold-light)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Héroes
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--pf-orange)', border: '1px solid var(--pf-orange)', padding: '6px 20px' }}>
        Próximamente
      </div>
      <p style={{ color: 'var(--pf-text-muted)', fontSize: '13px', maxWidth: '360px', textAlign: 'center', lineHeight: '1.7' }}>
        La integración de héroes estará disponible próximamente. Podrás ver tus héroes, gestionar crafts y mucho más.
      </p>
    </div>
  );

  /* eslint-disable no-unreachable */
  const wallet = useWallet();
  const toast = useToast();
  const [selectedCuenta, setSelectedCuenta] = useState("");
  const [misHeroes, setMisHeroes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [valanToken, setValanToken] = useState(() => localStorage.getItem('valannia_v_token') || null);
  const [heroSeleccionado, setHeroSeleccionado] = useState(null);

  const cuentasRender = useMemo(() => cuentas, [cuentas]);

  // ── Auth con Valannia ──────────────────────────────────────────────────
  const conectarValannia = async () => {
    if (!wallet.connected) { toast('Conecta tu wallet primero.', 'error'); return; }
    setIsLoading(true);
    try {
      // Generamos o recuperamos un device UUID persistente
      let device = localStorage.getItem('valannia_device');
      if (!device) { device = crypto.randomUUID(); localStorage.setItem('valannia_device', device); }

      // 1. Obtener challenge
const challengeRes = await fetch('https://valannia-proxy.polarisfuel.workers.dev/user/authentication/solana/challenge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ application: 'Valannia Portal', device, wallet: wallet.publicKey.toBase58() })
});
const challengeData = await challengeRes.json();
const challenge = typeof challengeData.result === 'string' 
  ? challengeData.result 
  : challengeData.result?.challenge;
if (!challenge) throw new Error('No se recibió challenge.');

// Firmar INMEDIATAMENTE sin logs entre medio
const encoded = new TextEncoder().encode(challenge);
const signatureBytes = await wallet.signMessage(encoded);
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
let num = BigInt(0);
for (const byte of signatureBytes) { num = num * 256n + BigInt(byte); }
let signature = '';
while (num > 0n) { signature = ALPHABET[Number(num % 58n)] + signature; num = num / 58n; }
for (const byte of signatureBytes) { if (byte !== 0) break; signature = '1' + signature; }
// Aseguramos que signature está definida antes de continuar
if (!signature) throw new Error('Error generando firma.');
      // 3. Autenticar
     const authRes = await fetch('https://valannia-proxy.polarisfuel.workers.dev/user/authentication/solana/authenticate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    challenge,
    mode: { direct: { device, application: 'Valannia Portal' } },
    verification: { message: signature }
  })
});
const authData = await authRes.json();
console.log('[AXON] Auth response completo:', JSON.stringify(authData, null, 2));
const token = authData.result?.token;
if (!token) throw new Error('No se recibió token.');

localStorage.setItem('valannia_v_token', token);
setValanToken(token);
fetchHeroes(token); // llamada directa sin esperar al useEffect
    } catch (e) {
      toast('Error al conectar con Valannia: ' + e.message, 'error');
    }
    setIsLoading(false);
  };

  const desconectarValannia = () => {
    localStorage.removeItem('valannia_v_token');
    setValanToken(null);
    setMisHeroes([]);
  };


  // ── Fetch héroes ───────────────────────────────────────────────────────
  const fetchHeroes = useCallback(async (token) => {
  if (!token) return;
  setIsLoading(true);
  try {
 const res = await fetch('https://valannia-proxy.polarisfuel.workers.dev/rtr/player/heroes', {
  method: 'POST',
  credentials: 'include',
  headers: { 
    'Content-Type': 'application/json',
    'x-auth-token': token,
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({})
});
    console.log('[AXON] Heroes status:', res.status);
    const data = await res.json();
    console.log('[AXON] Heroes data:', JSON.stringify(data, null, 2));
    if (res.status === 401) { desconectarValannia(); return; }
    setMisHeroes(data.result?.heroes || []);
  } catch (e) {
    console.error('[AXON] Error fetching heroes:', e);
  }
  setIsLoading(false);
}, []);

  // ── Auto-fetch al montar si ya hay token guardado ──────────────────
  useEffect(() => {
    if (valanToken && misHeroes.length === 0) fetchHeroes(valanToken);
  }, [valanToken, fetchHeroes]);

  // ── Colores por border ─────────────────────────────────────────────────
  const borderColor = { Gold: 'var(--pf-gold)', Silver: '#A8A8B3', Bronze: '#CD7F32' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header con estado de conexión */}
      <div className="alert-banner" style={{ border: `1px solid ${valanToken ? 'var(--pf-gold)' : 'var(--pf-orange)'}`, color: valanToken ? 'var(--pf-gold)' : 'var(--pf-orange)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{valanToken ? `✅ Valannia conectado · ${misHeroes.length} héroes` : '🔗 Conecta tu cuenta de Valannia para ver tus héroes'}</span>
        {valanToken
          ? <button onClick={desconectarValannia} className="axon-btn-outline" style={{ fontSize: '10px', padding: '4px 12px' }}>Desconectar</button>
          : <button onClick={conectarValannia} disabled={isLoading || !wallet.connected} className="axon-btn-primary" style={{ fontSize: '10px', padding: '4px 16px' }}><span>{isLoading ? 'Conectando...' : 'Conectar Valannia'}</span></button>
        }
      </div>

      <div style={{ display: 'flex', gap: '20px', flexGrow: 1, minHeight: 0, marginTop: '20px' }}>

        {/* Grid de héroes */}
        <div className="glass-card" style={{ flex: 2, padding: '25px', overflowY: 'auto' }}>
          <h3 style={{ color: 'var(--pf-gold-light)', margin: '0 0 25px 0', fontSize: '20px', fontFamily: 'var(--font-heading)' }}>{t('craftTitle')}</h3>

          {!valanToken && (
            <div className="empty-state">Conecta tu cuenta de Valannia para ver tus héroes.</div>
          )}
          {valanToken && isLoading && (
            <div className="empty-state">{t('invLoading')}</div>
          )}
          {valanToken && !isLoading && misHeroes.length === 0 && (
            <div className="empty-state">{t('craftNoHeroes')}</div>
          )}

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {misHeroes.map((h) => {
              const hero = h.item.attributes.hero;
              const border = borderColor[hero.border] || 'var(--pf-border)';
              const isSelected = heroSeleccionado?.id === h.id;
              const maxHealth = h.trollHealth || 2500;
              const healthPct = Math.min(100, (h.health / 140) * 100);
              // Mastery de la profesión activa
              const profKey = hero.profession.toLowerCase();
              const activeMastery = h.masteries?.[profKey]?.mastery ?? hero.mastery;
              // Vortex countdown
              const vortexEnd = h.vortex ? new Date(h.vortex) : null;
              const now = new Date();
              const inVortex = vortexEnd && vortexEnd > now;
              const vortexMins = inVortex ? Math.ceil((vortexEnd - now) / 60000) : 0;
              // Imagen real del hero desde metadata S3
              const imgSeed = h.item.kind;
              return (
                <div key={h.id} className="hero-card" onClick={() => setHeroSeleccionado(isSelected ? null : h)}
                  style={{ border: `2px solid ${isSelected ? 'var(--pf-orange)' : border}`, cursor: 'pointer', transition: 'border-color 0.2s', position: 'relative', opacity: inVortex ? 0.75 : 1 }}>
                  {/* Badge border */}
                  <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '9px', fontWeight: 'bold', color: border, border: `1px solid ${border}`, padding: '2px 6px', background: 'var(--pf-bg)' }}>{hero.border}</div>
                  {/* Vortex badge */}
                  {inVortex && <div style={{ position: 'absolute', top: '8px', left: '8px', fontSize: '9px', color: '#5B8FA8', border: '1px solid #5B8FA8', padding: '2px 6px', background: 'var(--pf-bg)' }}>⟳ {vortexMins}m</div>}
                  <div className="hero-img-container" style={{position:'relative'}}>
                    {(() => {
                      const heroImg = getHeroImg(h.item.kind, hero.border);
                      return heroImg
                        ? <img src={heroImg} alt={h.item.kind} className="hero-img"
                            style={{objectFit:'cover', objectPosition:'center top'}}
                            onError={e => { e.target.src=`https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${h.item.kind}&backgroundColor=0A0704`; }}
                          />
                        : <img src={`https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${h.item.kind}&backgroundColor=0A0704`} alt={h.item.kind} className="hero-img" />;
                    })()}
                  </div>
                  <h4 className="hero-title">{h.item.kind}</h4>
                  <div style={{ fontSize: '9px', color: 'var(--pf-text-muted)', textAlign: 'center', marginBottom: '6px', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em' }}>{h.item.capital}</div>
                  <div className="hero-stats">
                    <div className="stat-row"><span className="stat-label">{t('craftProfession')}</span><span className="stat-value" style={{ color: 'var(--pf-gold)' }}>{hero.profession}</span></div>
                    <div className="stat-row"><span className="stat-label">{t('craftLevel')}</span><span className="stat-value">Lv {hero.level}</span></div>
                    <div className="stat-row"><span className="stat-label">Mastery</span><span className="stat-value">{activeMastery}</span></div>
                    <div className="stat-row"><span className="stat-label">XP</span><span className="stat-value">{hero.experience.toLocaleString()}</span></div>
                    <div className="stat-row">
                      <span className="stat-label">Health</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'flex-end' }}>
                        <div style={{ width: '55px', height: '4px', background: 'var(--pf-border)' }}>
                          <div style={{ width: `${healthPct}%`, height: '100%', background: healthPct > 60 ? '#4CAF50' : healthPct > 30 ? 'var(--pf-gold)' : 'var(--pf-orange)', transition: 'width 0.3s' }}></div>
                        </div>
                        <span className="stat-value">{h.health}</span>
                      </div>
                    </div>
                    {/* Skills */}
                    {hero.skills?.length > 0 && (
                      <div style={{ marginTop: '6px', display: 'flex', gap: '3px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {hero.skills.map(sk => (
                          <span key={sk.name} style={{ fontSize: '8px', color: 'var(--pf-text-muted)', border: '1px solid var(--pf-border)', padding: '1px 4px' }}>{sk.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel derecho: detalle + explorador de recetas */}
        <div className="glass-card" style={{ flex: 1.4, padding: '20px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!heroSeleccionado ? (
            <div className="empty-state" style={{ marginTop: '40px' }}>Selecciona un héroe para ver detalles.</div>
          ) : (
            <>
              {/* Header héroe */}
              {(() => {
                const h = heroSeleccionado;
                const hero = h.item.attributes.hero;
                const borderCol = { Gold: 'var(--pf-gold)', Silver: '#A8A8B3', Bronze: '#CD7F32' }[hero.border] || 'var(--pf-border)';
                const profKey = hero.profession.toLowerCase();
                const activeMastery = h.masteries?.[profKey]?.mastery ?? hero.mastery;
                const allMasteries = Object.values(h.masteries || {}).filter(m => m.mastery > 0);
                const vortexEnd = h.vortex ? new Date(h.vortex) : null;
                const inVortex = vortexEnd && vortexEnd > new Date();
                const vortexMins = inVortex ? Math.ceil((vortexEnd - new Date()) / 60000) : 0;
                return (
                  <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--pf-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h3 style={{ color: 'var(--pf-gold-light)', margin: 0, fontFamily: 'var(--font-heading)', fontSize: '15px' }}>{h.item.kind}</h3>
                      <span style={{ fontSize: '9px', fontWeight: 'bold', color: borderCol, border: `1px solid ${borderCol}`, padding: '2px 7px' }}>{hero.border}</span>
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--pf-text-muted)', marginBottom: '8px' }}>{h.item.capital}</div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--pf-text-muted)', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--pf-gold)' }}>👤 {hero.profession}</span>
                      <span>⭐ Lv {hero.level}</span>
                      <span>🔮 {activeMastery} mastery</span>
                      <span>💫 {hero.experience.toLocaleString()} XP</span>
                      <span>❤️ {h.health}/140</span>
                    </div>
                    {inVortex && <div style={{ fontSize: '10px', color: '#5B8FA8', border: '1px solid #5B8FA8', padding: '3px 8px', marginBottom: '8px', display: 'inline-block' }}>⟳ En Vórtice · {vortexMins} min restantes</div>}
                    {/* Maestrías de otras profesiones */}
                    {allMasteries.length > 1 && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '9px', color: 'var(--pf-text-muted)', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Maestrías</div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {allMasteries.map(m => (
                            <span key={m.profession} style={{ fontSize: '9px', color: m.profession === hero.profession ? 'var(--pf-gold)' : 'var(--pf-text-muted)', border: `1px solid ${m.profession === hero.profession ? 'var(--pf-gold)' : 'var(--pf-border)'}`, padding: '2px 6px' }}>
                              {m.profession}: {m.mastery}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Skills */}
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {hero.skills.map((s, i) => (
                        <span key={i} style={{ fontSize: '9px', color: 'var(--pf-gold)', border: '1px solid var(--pf-border)', padding: '1px 5px' }}>⚡ {s.name}</span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Explorador de recetas */}
              <div style={{ flexGrow: 1, minHeight: 0 }}>
                <RecipeExplorer hero={heroSeleccionado} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VistaRecetas({ t }) {
  const [search, setSearch] = React.useState('');
  const [profFilter, setProfFilter] = React.useState('');
  const [sel, setSel] = React.useState(null);

  const PROF_META = {
    Artisan:   { color:'#D4A843', icon:'🪡', logo:'https://portal.valannia.com/professions/logos/artisan.webp',    label:'Artisan'    },
    Blacksmith:{ color:'#CC3300', icon:'⚒️',  logo:'https://portal.valannia.com/professions/logos/blacksmith.webp', label:'Blacksmith' },
    Engineer:  { color:'#4A90D9', icon:'⚙️',  logo:'https://portal.valannia.com/professions/logos/engineering.webp',label:'Engineer'   },
    Alchemist: { color:'#8B5CF6', icon:'⚗️',  logo:'https://portal.valannia.com/professions/logos/alchemy.webp',   label:'Alchemist'  },
    Architect: { color:'#059669', icon:'🏗️',  logo:'https://portal.valannia.com/professions/logos/architecture.webp',label:'Architect' },
    Jeweler:   { color:'#EC4899', icon:'💎',  logo:'https://portal.valannia.com/professions/logos/jewelry.webp',   label:'Jeweler'    },
    Miner:     { color:'#78716C', icon:'⛏️',  logo:'https://portal.valannia.com/professions/logos/mining.webp',    label:'Miner'      },
    Explorer:  { color:'#10B981', icon:'🧭',  logo:'https://portal.valannia.com/professions/logos/exploration.webp',label:'Explorer'  },
  };
  const professions = Object.keys(PROF_META);

  const PROD_ICONS = {
    'Copper Ingot':'🟤','Iron Ingot':'⚙️','Quicksilver Ingot':'🔮','Luminite Ingot':'✨','Kronscale Ingot':'🌟',
    'Cloth':'🧵','Leather':'🟫','Canvas':'📄','Paper':'📃','Boots':'👢',
    'Axe':'🪓','Shovel':'🌿','Pickaxe':'⛏️','Bucket':'🪣',
    'Potion of Strength':'💪','Potion of Health':'❤️','Potion of Stamina':'⚡',
    'Softwood Beam':'🪵','Hardwood Beam':'🪵','Heartspire Beam':'🌲',
    'Copper Ore':'🟤','Iron Ore':'⬛','Luminite Ore':'🔵',
    'Glass':'🪟','Rose Glass':'🌹','Reflective Glass':'🪞',
    'Compass':'🧭','Engine':'⚙️','Gate':'🚪','Stronghold':'🏰',
  };
  const prodIcon = name => PROD_ICONS[name] || '✦';

  const filtered = React.useMemo(() => {
    return Object.entries(VALANNIA_RECIPES).filter(([name, r]) => {
      const matchProf = !profFilter || r.p === profFilter;
      const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || r.o.some(p => p.toLowerCase().includes(search.toLowerCase()));
      return matchProf && matchSearch;
    }).sort((a, b) => a[1].p.localeCompare(b[1].p) || a[1].l - b[1].l || a[0].localeCompare(b[0]));
  }, [search, profFilter]);

  const r = sel ? VALANNIA_RECIPES[sel] : null;
  const profColors = Object.fromEntries(Object.entries(PROF_META).map(([k,v])=>[k,v.color]));

  return (
    <div style={{ display: 'flex', height: '100%', gap: '20px' }}>
      {/* Panel izquierdo: filtros + lista */}
      <div className="glass-card" style={{ width: '280px', flexShrink: 0, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ color: 'var(--pf-gold-light)', margin: 0, fontFamily: 'var(--font-heading)', fontSize: '16px' }}>
          🔨 {t('menuRecipes')}
        </h3>

        <input placeholder={t('lang') === 'en' ? 'Search recipe or product...' : 'Buscar receta o producto...'} value={search} onChange={e => { setSearch(e.target.value); setSel(null); }} className="axon-input" style={{ fontSize: '11px', padding: '6px 10px' }} />

        {/* Filtro por profesión */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          <button onClick={() => { setProfFilter(''); setSel(null); }}
            style={{ fontSize: '9px', fontFamily: 'var(--font-heading)', letterSpacing: '0.1em', padding: '4px 8px', background: !profFilter ? 'rgba(212,168,67,0.15)' : 'transparent', border: `1px solid ${!profFilter ? 'var(--pf-gold)' : 'var(--pf-border)'}`, color: !profFilter ? 'var(--pf-gold)' : 'var(--pf-text-muted)', cursor: 'pointer' }}>
            ✦ ALL
          </button>
          {professions.map(p => {
            const m = PROF_META[p];
            const active = profFilter === p;
            return (
              <button key={p} onClick={() => { setProfFilter(active ? '' : p); setSel(null); }}
                style={{ fontSize: '9px', fontFamily: 'var(--font-heading)', letterSpacing: '0.05em', padding: '4px 8px', background: active ? `${m.color}22` : 'transparent', border: `1px solid ${active ? m.color : 'var(--pf-border)'}`, color: active ? m.color : 'var(--pf-text-muted)', cursor: 'pointer', display:'flex', alignItems:'center', gap:'4px' }}>
                <img src={m.logo} alt={p} style={{width:14,height:14,objectFit:'contain',filter:active?'none':'grayscale(0.6) opacity(0.7)'}} onError={e=>{e.target.style.display='none'}} />
                {m.label}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: '10px', color: 'var(--pf-text-muted)' }}>{filtered.length} recetas</div>

        {/* Lista */}
        <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {filtered.map(([name, rv]) => {
            const m = PROF_META[rv.p] || {};
            const active = sel === name;
            return (
              <button key={name} onClick={() => setSel(name)}
                style={{ background: active ? `${m.color}18` : 'transparent', border: `1px solid ${active ? m.color : 'var(--pf-border)'}`, color: active ? m.color : 'var(--pf-text)', padding: '6px 8px', cursor: 'pointer', textAlign: 'left', fontSize: '10px', transition: '0.15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '11px', letterSpacing: '0.03em', color: active ? m.color : 'var(--pf-text)', display:'flex', alignItems:'center', gap:'5px' }}>
                    <img src={m.logo} alt={rv.p} style={{width:13,height:13,objectFit:'contain',flexShrink:0,filter:active?'none':'grayscale(0.5) opacity(0.65)'}} onError={e=>{e.target.style.display='none'}} />
                    {name}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--pf-text-muted)', flexShrink: 0, marginLeft: '6px' }}>Lv{rv.l} · {fmtTime(rv.s)}</span>
                </div>
                {rv.o.length > 0 && (
                  <div style={{ fontSize: '9px', color: 'var(--pf-text-muted)', marginTop: '1px' }}>
                    {rv.o.map(p => <span key={p} style={{ marginRight: '6px' }}>{prodIcon(p)} {p}</span>)}
                  </div>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && <div style={{ color: 'var(--pf-text-muted)', fontSize: '12px', padding: '20px 0', textAlign: 'center' }}>Sin resultados</div>}
        </div>
      </div>

      {/* Panel derecho: calculadora de crafteo */}
      <div className="glass-card" style={{ flexGrow: 1, padding: '20px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!sel
          ? <div className="empty-state" style={{ marginTop: '60px' }}>Selecciona una receta para ver la calculadora de crafteo.</div>
          : <CraftingCalculator recipeName={sel} />
        }
      </div>
    </div>
  );
}

// ==========================================
// APLICACIÓN PRINCIPAL
// ==========================================
// Detecta cambio de cuenta en Solflare/Phantom y fuerza reconexión automática
function WalletAccountWatcher() {
  const { wallet, connected, disconnect, connect, select } = useWallet();

  useEffect(() => {
    const adapter = wallet?.adapter;
    if (!adapter) return;

    const handleAccountChange = async (newPubkey) => {
      if (!newPubkey) {
        // Wallet desconectada
        try { await disconnect(); } catch {}
        return;
      }
      // Solflare cambió de cuenta — reconectar para que wallet-adapter actualice publicKey
      try {
        await disconnect();
        await new Promise(r => setTimeout(r, 200));
        await connect();
      } catch {}
    };

    // Solflare expone window.solflare, Phantom expone window.solana
    const provider = window.solflare || window.solana;
    if (provider?.on) {
      provider.on('accountChanged', handleAccountChange);
      return () => provider.off?.('accountChanged', handleAccountChange);
    }
  }, [wallet, connected]);

  return null;
}


function MainApp() {
  const { t, lang, setLang } = useTranslation();
  const endpoint = useMemo(() => "https://mainnet.helius-rpc.com/?api-key=e7e26294-d604-4942-89fa-1ddf42912366", []);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  
  const [tokensConfig, setTokensConfig] = useState([]);
  const [burner, setBurner] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isAppLaunched, setIsAppLaunched] = useState(false);
  const [tieneAcceso, setTieneAcceso] = useState(false);
  const [cuentas, setCuentas] = useState(() => JSON.parse(localStorage.getItem('valanniaCuentas') || '[]'));
  const [vistaActiva, setVistaActiva] = useState('inventario');

  useEffect(() => {
    if (localStorage.getItem("acceso_beta_concedido") === "true") setTieneAcceso(true);
    fetch(JSON_URL).then(res => res.json()).then(data => setTokensConfig(extractTokens(data)));
  }, []);

  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletAccountWatcher />
          <CustomCursor />
          <FireCanvas />
          
          {!isAppLaunched ? (
             <VistaHome onLaunchApp={() => setIsAppLaunched(true)} lang={lang} setLang={setLang} t={t} />
          ) : !tieneAcceso ? (
             <PantallaBloqueo onAccesoConcedido={() => setTieneAcceso(true)} t={t} />
          ) : (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 10 }}>
              <nav className="glass-card" style={{ margin: '15px 20px 0 20px', padding: '12px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '300px', cursor: 'none' }} onClick={() => setIsAppLaunched(false)}>
                  <img src={logoImg} alt="Axon" className="axon-logo-glow" style={{ width: '40px', height: '40px' }} />
                  <h2 style={{ margin: 0, fontSize: '18px', letterSpacing: '2px', fontWeight: '800', fontFamily: 'var(--font-heading)', color: 'var(--pf-gold-light)' }}>POLARIS FUEL<span style={{color: 'var(--pf-orange)'}}> · Wallet Manager</span></h2>
                  <span style={{fontSize:'10px', border:'1px solid var(--pf-orange)', color: 'var(--pf-orange)', background: 'rgba(255,107,26,0.1)', padding:'3px 8px', borderRadius:'4px', marginLeft: '5px', fontWeight: 'bold'}}>BETA</span>
                </div>
                

                
                <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
                  <HeaderBurner burner={burner} setBurner={setBurner} refreshTrigger={refreshTrigger} triggerRefresh={triggerRefresh} t={t} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '300px', justifyContent: 'flex-end' }}>
                  <a href="https://polarisfuel.app" target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--pf-text-muted)', textDecoration: 'none', border: '1px solid var(--pf-border)', padding: '6px 10px', transition: '0.2s', whiteSpace: 'nowrap' }} onMouseOver={e => { e.target.style.color='var(--pf-gold)'; e.target.style.borderColor='var(--pf-gold)'; }} onMouseOut={e => { e.target.style.color='var(--pf-text-muted)'; e.target.style.borderColor='var(--pf-border)'; }}>
                    🌐 Polaris Fuel
                  </a>
                  <a href="./guide.html" target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--pf-text-muted)', textDecoration: 'none', border: '1px solid var(--pf-border)', padding: '6px 10px', transition: '0.2s', whiteSpace: 'nowrap' }} onMouseOver={e => { e.target.style.color='var(--pf-gold)'; e.target.style.borderColor='var(--pf-gold)'; }} onMouseOut={e => { e.target.style.color='var(--pf-text-muted)'; e.target.style.borderColor='var(--pf-border)'; }}>
                    📖 Guía
                  </a>
                  <select value={lang} onChange={(e) => setLang(e.target.value)} className="axon-input" style={{width: 'auto', padding: '8px 12px'}}>
                    <option value="es" style={{background: 'var(--pf-bg)'}}>ES</option>
                    <option value="en" style={{background: 'var(--pf-bg)'}}>EN</option>
                  </select>
                  <WalletMultiButton style={{ background: 'var(--pf-surface)', border: '1px solid var(--pf-border)', color: 'var(--pf-gold)', fontFamily: 'var(--font-heading)', height: '40px', borderRadius: '4px' }} />
                </div>
              </nav>

              <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden', padding: '20px' }}>
                <aside className="glass-card" style={{ width: '240px', padding: '25px 20px', flexShrink: 0, display: 'flex', flexDirection: 'column', marginRight: '20px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--pf-text-muted)', marginBottom: '20px', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 'bold', fontFamily: 'var(--font-heading)' }}>Dashboard</div>
                  
                  <button className={`sidebar-btn ${vistaActiva === 'inventario' ? 'active' : ''}`} onClick={() => setVistaActiva('inventario')}>
                    <span style={{marginRight: '10px', fontSize: '16px', filter: 'sepia(1) hue-rotate(15deg) contrast(0.8)'}}>📦</span> {t('menuInventory')}
                  </button>
                  <button className={`sidebar-btn ${vistaActiva === 'mercado' ? 'active' : ''}`} onClick={() => setVistaActiva('mercado')}>
                    <span style={{marginRight: '10px', fontSize: '16px', filter: 'sepia(1) hue-rotate(15deg) contrast(0.8)'}}>⚖️</span> {t('menuMarket')}
                  </button>
                  <button className={`sidebar-btn ${vistaActiva === 'crafteo' ? 'active' : ''}`} onClick={() => setVistaActiva('crafteo')}>
                    <span style={{marginRight: '10px', fontSize: '16px', filter: 'sepia(1) hue-rotate(15deg) contrast(0.8)'}}>⚔️</span> {t('menuCrafting')}
                  </button>
                  <button className={`sidebar-btn ${vistaActiva === 'recetas' ? 'active' : ''}`} onClick={() => setVistaActiva('recetas')}>
                    <span style={{marginRight: '10px', fontSize: '16px', filter: 'sepia(1) hue-rotate(15deg) contrast(0.8)'}}>🔨</span> {t('menuRecipes')}
                  </button>

                  <div style={{ marginTop: 'auto', textAlign: 'center', color: 'var(--pf-text-muted)', fontSize: '12px', paddingTop: '20px', borderTop: '1px solid var(--pf-border)' }}>
                    <p style={{ margin: '0 0 12px 0', lineHeight: '1.5' }}>
                      {t('footDev')}<br/><span style={{ color: 'var(--pf-orange)', fontWeight: 'bold' }}>{t('footMem')}</span>.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <a href="https://polarisfuel.app" target="_blank" rel="noreferrer" style={{ display: 'block', fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--pf-text-muted)', textDecoration: 'none', border: '1px solid var(--pf-border)', padding: '6px 8px', transition: '0.2s' }} onMouseOver={e => { e.target.style.color='var(--pf-gold)'; e.target.style.borderColor='var(--pf-gold)'; }} onMouseOut={e => { e.target.style.color='var(--pf-text-muted)'; e.target.style.borderColor='var(--pf-border)'; }}>
                        🌐 Polaris Fuel
                      </a>
                      <a href="./guide.html" target="_blank" rel="noreferrer" style={{ display: 'block', fontFamily: 'var(--font-heading)', fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--pf-text-muted)', textDecoration: 'none', border: '1px solid var(--pf-border)', padding: '6px 8px', transition: '0.2s' }} onMouseOver={e => { e.target.style.color='var(--pf-gold)'; e.target.style.borderColor='var(--pf-gold)'; }} onMouseOut={e => { e.target.style.color='var(--pf-text-muted)'; e.target.style.borderColor='var(--pf-border)'; }}>
                        📖 Guía & FAQs
                      </a>
                    </div>
                  </div>
                </aside>

                <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ flexGrow: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {vistaActiva === 'inventario' && <VistaInventario cuentas={cuentas} setCuentas={setCuentas} tokensConfig={tokensConfig} triggerRefresh={triggerRefresh} refreshTrigger={refreshTrigger} t={t} />}
                    {vistaActiva === 'mercado' && <VistaMercado tokensConfig={tokensConfig} burner={burner} cuentas={cuentas} triggerRefresh={triggerRefresh} refreshTrigger={refreshTrigger} t={t} db={db} />}
                    {vistaActiva === 'crafteo' && <VistaCrafteo cuentas={cuentas} burner={burner} t={t} />}
                    {vistaActiva === 'recetas' && <VistaRecetas t={t} />}
                  </div>
                </main>
              </div>
            </div>
          )}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function App() {
  const [lang, setLangState] = useState(localStorage.getItem('valannia_lang') || 'es');
  const setLang = (newLang) => { setLangState(newLang); localStorage.setItem('valannia_lang', newLang); };

  useEffect(() => { document.title = 'Polaris Fuel · Wallet Manager'; }, []);
  
  const t = useCallback((key, vars = {}) => {
    let str = TRANSLATIONS[lang][key] || key;
    if (str === undefined) return key; 
    if (vars) Object.keys(vars).forEach(k => { str = str.replace(`{${k}}`, vars[k]); });
    return str;
  }, [lang]);

return (
  <LanguageContext.Provider value={{ lang, setLang, t }}>
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  </LanguageContext.Provider>
);
}

export default App;