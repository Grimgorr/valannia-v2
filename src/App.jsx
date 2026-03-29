import React, { useMemo, useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { ConnectionProvider, WalletProvider, useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction, Keypair, SystemProgram } from '@solana/web3.js'; 
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferInstruction, createApproveInstruction } from '@solana/spl-token'; 
import { deriveBurner } from './logistics';
// AÑADIR junto a los otros imports
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { transferV1, mplCore } from '@metaplex-foundation/mpl-core';
import { publicKey as umiPublicKey } from '@metaplex-foundation/umi';

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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
    menuInventory: "Inventario", menuMarket: "Mercado P2P", menuCrafting: "Crafteo", menuAnalytics: "Radar VALAN",
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
    menuInventory: "Inventory", menuMarket: "P2P Market", menuCrafting: "Crafting", menuAnalytics: "VALAN Radar",
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

function CuentaFila({ cuenta, index, eliminarCuenta, tokensConfig, isActive, onSelect, onUpdateData, burner, refreshTrigger, t }) {
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
  const category = getAttr('category') || 'NFTs · Core';   // "Maps", "Weapons", etc.
  const type     = getAttr('type')     || 'Unknown';        // "Fuel Maps", etc.
  const tier     = getAttr('tier');                         // 1, 2, 3...
  const richness = getAttr('richness');                     // dato extra

  // El nombre que se muestra en el panel incluye el tier si existe
const displayName = richness != null ? `${name} · Richness ${richness}` : name;

const existing = coreAssets.find(a => a.name === displayName && a.subcategory === type);
if (existing) {
  existing.cantidad += 1;
} else {
  coreAssets.push({
    name: displayName,
    address: asset.id,
    category,
    subcategory: type,
    image,
    cantidad: 1,
    isNFT: true
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

  const otorgarPermisos = async () => {
    if (!wallet.connected || wallet.publicKey.toBase58() !== cuenta.direccion) { toast(t('accPermReq'), 'error'); return; }
    try {
      const tokens = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, { programId: TOKEN_PROGRAM_ID });
      const tokensValannia = tokens.value.filter(acc => { const mint = acc.account.data.parsed.info.mint; const balance = acc.account.data.parsed.info.tokenAmount.uiAmount; return balance > 0 && mint !== VALAN_MINT && mint !== "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" && tokensConfig.some(tk => tk.address === mint); });
      if (tokensValannia.length === 0) { toast(t('accNoMats'), 'info'); return; }
      let lotes = []; for (let i = 0; i < tokensValannia.length; i += 10) lotes.push(tokensValannia.slice(i, i + 10));
      for (let i = 0; i < lotes.length; i++) {
        const { blockhash } = await connection.getLatestBlockhash();
        const tx = new Transaction({ feePayer: wallet.publicKey, recentBlockhash: blockhash });
        lotes[i].forEach(acc => { tx.add(createApproveInstruction(new PublicKey(acc.pubkey), burner.publicKey, wallet.publicKey, BigInt("1000000000000"))); });
        await wallet.sendTransaction(tx, connection);
      }
      toast(t('accPermOk'), 'success');
    } catch (e) { console.error(e); }
  };

  return (
    <li className={`wallet-row ${isActive ? 'active' : ''}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: '600', letterSpacing: '0.5px' }}>{cuenta.alias}</span>
        {!cuenta.isBurner && ( <button onClick={() => eliminarCuenta(index)} className="icon-btn-danger">✖</button> )}
      </div>
      <div style={{ display: 'flex', gap: '8px', margin: '12px 0' }}>
        <div className="balance-pill-small"><span style={{ color: 'var(--pf-gold)' }}>{sol} SOL</span></div>
        <div className="balance-pill-small"><span style={{ color: 'var(--pf-orange)' }}>{valan} VALAN</span></div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {!cuenta.isBurner && burner && ( <button onClick={otorgarPermisos} className="axon-btn-outline" style={{flex: 1, fontSize: '10px'}}>{t('btnPerms')}</button> )}
        <button onClick={onSelect} className="axon-btn-secondary" style={{flex: 1, padding: '8px', fontSize: '10px'}}>{t('btnViewMats')}</button>
      </div>
    </li>
  );
}

function VistaInventario({ cuentas, setCuentas, tokensConfig, burner, triggerRefresh, refreshTrigger, t }) {
  const { connection } = useConnection();
  const toast = useToast();
  const [alias, setAlias] = useState(''); const [direccion, setDireccion] = useState('');
  const [cuentaActivaId, setCuentaActivaId] = useState(null);
  const [inventariosGuardados, setInventariosGuardados] = useState({});
  const [carrito, setCarrito] = useState([]);
  const [destinoSeleccionado, setDestinoSeleccionado] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  const cuentasRender = useMemo(() => { if (burner) return [{ alias: "🔥 Burn Wallet", direccion: burner.publicKey.toBase58(), isBurner: true }, ...cuentas]; return cuentas; }, [cuentas, burner]);
  const handleUpdateData = useCallback((dir, ali, agr, tot) => { setInventariosGuardados(prev => ({ ...prev, [dir]: { direccion: dir, alias: ali, agrupado: agr, totalItems: tot } })); }, []);

const ejecutarLogistica = async () => {
  if (!burner || carrito.length === 0 || !destinoSeleccionado) return;
  setIsExecuting(true);
  let destPK;
  try { destPK = new PublicKey(destinoSeleccionado); } 
  catch (err) { toast(t('errInvalidAddr'), 'error'); setIsExecuting(false); return; }

  // Separar SPL y NFTs Core
  const enviosSPL  = carrito.filter(c => !c.item.isNFT);
  const enviosCore = carrito.filter(c =>  c.item.isNFT);

  try {
    const resumenItems = carrito.map(c => `- ${c.cantidad}x ${c.item.name}`).join('\n');

    // ── SPL clásico ────────────────────────────────────────────────────
    for (const envio of enviosSPL) {
      const mintPK   = new PublicKey(envio.item.address);
      const origenPK = new PublicKey(envio.origen);
      const ataOrigen  = await getAssociatedTokenAddress(mintPK, origenPK);
      const ataDestino = await getAssociatedTokenAddress(mintPK, destPK);
      const tx = new Transaction();
      const infoDestino = await connection.getAccountInfo(ataDestino);
      if (!infoDestino) tx.add(createAssociatedTokenAccountInstruction(burner.publicKey, ataDestino, destPK, mintPK));
      tx.add(createTransferInstruction(ataOrigen, ataDestino, burner.publicKey, envio.cantidad));
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash; tx.feePayer = burner.publicKey; tx.partialSign(burner);
      await connection.sendRawTransaction(tx.serialize());
    }

    // ── Metaplex Core ──────────────────────────────────────────────────
    if (enviosCore.length > 0) {
      const umi = createUmi(connection.rpcEndpoint).use(mplCore());
      // Inyectamos el burner keypair como signer de umi
      const burnerSigner = {
        publicKey: umiPublicKey(burner.publicKey.toBase58()),
        signTransaction: async (tx) => { tx.signatures.push({ signature: null, signer: burnerSigner }); return tx; },
        signAllTransactions: async (txs) => txs,
        signMessage: async (msg) => msg,
      };
      umi.use({ install(umi) { umi.identity = burnerSigner; umi.payer = burnerSigner; } });

      for (const envio of enviosCore) {
        // Cada NFT Core es único — enviamos uno a uno
        await transferV1(umi, {
          asset:       umiPublicKey(envio.item.address),
          newOwner:    umiPublicKey(destinoSeleccionado),
        }).sendAndConfirm(umi);
      }
    }

    setTimeout(() => { triggerRefresh(); toast(t('cartSuccessDetails'), 'success'); }, 1000);
    setCarrito([]);
  } catch (e) { toast(`${t('cartErr')} ${e.message}`, 'error'); } 
  finally { setIsExecuting(false); }
};

  const agregarCuenta = () => { if (!alias || !direccion) return; const n = [...cuentas, { alias, direccion }]; setCuentas(n); localStorage.setItem('valanniaCuentas', JSON.stringify(n)); setAlias(''); setDireccion(''); };
  const eliminarCuentaDeLibreta = (indexRender) => { const indexReal = burner ? indexRender - 1 : indexRender; const nuevasCuentas = cuentas.filter((_, id) => id !== indexReal); setCuentas(nuevasCuentas); localStorage.setItem('valanniaCuentas', JSON.stringify(nuevasCuentas)); if (cuentaActivaId === cuentas[indexReal]?.direccion) setCuentaActivaId(null); };

  return (
    <div style={{ display: 'flex', gap: '25px', flexGrow: 1, minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div className="glass-card" style={{ padding: '15px', marginBottom: '15px', display: 'flex', gap: '10px' }}>
           <input placeholder={t('cartAlias')} value={alias} onChange={e => setAlias(e.target.value)} className="axon-input" style={{ flex: 1 }}/>
           <input placeholder={t('cartAddr')} value={direccion} onChange={e => setDireccion(e.target.value)} className="axon-input" style={{ flex: 2 }}/>
           <button onClick={agregarCuenta} className="axon-btn-primary" style={{ padding: '0 15px', fontSize: '18px' }}><span>+</span></button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: 'auto' }}>
          {cuentasRender.map((c, i) => <CuentaFila key={c.direccion} cuenta={c} index={i} tokensConfig={tokensConfig} burner={burner} refreshTrigger={refreshTrigger} t={t} isActive={cuentaActivaId === c.direccion} onSelect={() => setCuentaActivaId(c.direccion)} onUpdateData={handleUpdateData} eliminarCuenta={eliminarCuentaDeLibreta} />)}
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
        <div style={{flexGrow: 1, overflowY: 'auto', margin: '15px 0'}}>
          {carrito.map((c, i) => (
            <div key={i} style={{background: 'var(--pf-bg)', border: '1px solid var(--pf-border)', padding: '10px 15px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}>
              <span style={{fontWeight: '500', color: 'var(--pf-text)'}}>{c.item.name}</span>
              <span style={{color: 'var(--pf-orange)'}}>x{c.cantidad}</span>
              <span style={{color: 'var(--pf-text-muted)', fontSize: '11px', width: '100%', display: 'block', marginTop: '4px'}}>{t('cartFrom')} {c.aliasOrigen}</span>
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
  const toast = useToast();
  const [selectedCuenta, setSelectedCuenta] = useState(""); const [misMateriales, setMisMateriales] = useState([]); const [selectedMatAddress, setSelectedMatAddress] = useState(""); const [sellQty, setSellQty] = useState(""); const [sellPrice, setSellPrice] = useState(""); const [isExecuting, setIsExecuting] = useState(false); const [filterCat, setFilterCat] = useState(""); const [filterSub, setFilterSub] = useState(""); const [filterItem, setFilterItem] = useState(""); const [ordenesActivas, setOrdenesActivas] = useState([]);

  useEffect(() => { const unsubscribe = onSnapshot(collection(db, "orders"), (snapshot) => { const ordersInfo = snapshot.docs.map(docSnap => ({ firebaseId: docSnap.id, ...docSnap.data() })); setOrdenesActivas(ordersInfo.sort((a, b) => b.id - a.id)); }); return () => unsubscribe(); }, [db]);

  // ── Filtros: combina tokensConfig SPL + categorías Core de las órdenes activas ──
  const allCatsInOrders = [...new Set(ordenesActivas.map(o => o.category).filter(Boolean))];
  const cats = [...new Set([...tokensConfig.map(tk => tk.category), ...allCatsInOrders])].filter(Boolean);
  const subs = filterCat ? [...new Set([
    ...tokensConfig.filter(tk => tk.category === filterCat).map(tk => tk.subcategory),
    ...ordenesActivas.filter(o => o.category === filterCat).map(o => o.subcategory)
  ])].filter(Boolean) : [];
  const itemsFiltro = filterSub ? [...new Set([
    ...tokensConfig.filter(tk => tk.subcategory === filterSub).map(tk => tk.name),
    ...ordenesActivas.filter(o => o.subcategory === filterSub).map(o => o.item)
  ])].filter(Boolean) : [];

  const ordenesFiltradas = ordenesActivas.filter(orden => {
    if (filterCat && (orden.category || tokensConfig.find(tk => tk.address === orden.mint)?.category) !== filterCat) return false;
    if (filterSub && (orden.subcategory || tokensConfig.find(tk => tk.address === orden.mint)?.subcategory) !== filterSub) return false;
    if (filterItem && orden.item !== filterItem) return false;
    return true;
  });

  const fetchMaterialesDeCuenta = useCallback(async (walletAddress) => {
    if (!walletAddress) { setMisMateriales([]); return; }
    try {
      const pubkey = new PublicKey(walletAddress);
      // ── 1. SPL — excluir VALAN y USDC ───────────────────────────────
      const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const tokens = await connection.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_PROGRAM_ID });
      const matList = [];
      tokens.value.forEach(acc => {
        const info = acc.account.data.parsed.info;
        const mint = info.mint; const amt = info.tokenAmount.uiAmount;
        if (amt > 0 && mint !== VALAN_MINT && mint !== USDC_MINT) {
          const configObj = tokensConfig.find(tk => tk.address === mint);
          if (configObj) matList.push({ ...configObj, cantidad: amt });
        }
      });
      // ── 2. NFTs Metaplex Core via Helius DAS ─────────────────────────
      try {
        const dasRes = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 'axon-mkt', method: 'getAssetsByOwner',
            params: { ownerAddress: walletAddress, page: 1, limit: 1000,
              displayOptions: { showFungible: false, showNativeBalance: false } } })
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
          const category = getAttr('category') || 'NFTs · Core';
          const type = getAttr('type') || 'Unknown';
          const key = `${displayName}__${type}`;
          // Guardamos allAddresses para poder vender uno a uno
          if (coreMap[key]) { coreMap[key].cantidad += 1; coreMap[key].allAddresses.push(asset.id); }
          else { coreMap[key] = { name: displayName, address: asset.id, allAddresses: [asset.id], category, subcategory: type, image, cantidad: 1, isNFT: true }; }
        });
        matList.push(...Object.values(coreMap));
      } catch (coreErr) { console.warn('[Axon] Core NFTs mercado error:', coreErr); }
      setMisMateriales(matList);
    } catch (e) {}
  }, [connection, tokensConfig]);

  useEffect(() => { fetchMaterialesDeCuenta(selectedCuenta); }, [selectedCuenta, refreshTrigger, fetchMaterialesDeCuenta]);

  const totalRecibir = (parseFloat(sellQty || 0) * parseFloat(sellPrice || 0)).toFixed(2);
  const materialSeleccionadoObjeto = misMateriales.find(m => m.address === selectedMatAddress);

  // ── Helper UMI burner signer ──────────────────────────────────────────────
  const makeUmiBurner = () => {
    const umi = createUmi(connection.rpcEndpoint).use(mplCore());
    const burnerSigner = {
      publicKey: umiPublicKey(burner.publicKey.toBase58()),
      signTransaction: async (tx) => tx,
      signAllTransactions: async (txs) => txs,
      signMessage: async (msg) => msg,
    };
    umi.use({ install(u) { u.identity = burnerSigner; u.payer = burnerSigner; } });
    return umi;
  };

  const crearOrden = async () => {
    if (!burner) { toast(t('errNeedBurner'), 'error'); return; }
    if (!selectedCuenta || !selectedMatAddress || !sellPrice) { toast(t('errFillAll'), 'error'); return; }
    const isNFT = materialSeleccionadoObjeto?.isNFT;
    if (!isNFT) {
      if (!sellQty || parseFloat(sellQty) <= 0) { toast(t('errInvQty'), 'error'); return; }
      if (parseFloat(sellQty) > (materialSeleccionadoObjeto?.cantidad || 0)) { toast(t('errNotEnough'), 'error'); return; }
    }
    const confirmacion = window.confirm(t('confirmSell')); if (!confirmacion) return;
    setIsExecuting(true);
    try {
      if (isNFT) {
        // ── Core NFT: transferV1 al burner como escrow ──────────────────
        const assetToSell = materialSeleccionadoObjeto.allAddresses[0];
        const umi = makeUmiBurner();
        await transferV1(umi, {
          asset: umiPublicKey(assetToSell),
          newOwner: umiPublicKey(burner.publicKey.toBase58()),
        }).sendAndConfirm(umi);
        await addDoc(collection(db, "orders"), {
          id: Date.now(), sellerAddr: selectedCuenta, mint: assetToSell,
          item: materialSeleccionadoObjeto.name, img: materialSeleccionadoObjeto.image,
          qty: 1, price: parseFloat(sellPrice),
          ownerBurner: burner.publicKey.toBase58(),
          isNFT: true,
          category: materialSeleccionadoObjeto.category,
          subcategory: materialSeleccionadoObjeto.subcategory,
        });
      } else {
        // ── SPL clásico ─────────────────────────────────────────────────
        const mintPK = new PublicKey(selectedMatAddress);
        const sourcePK = new PublicKey(selectedCuenta);
        const burnerATA = await getAssociatedTokenAddress(mintPK, burner.publicKey);
        const tx = new Transaction();
        const infoDestino = await connection.getAccountInfo(burnerATA);
        if (!infoDestino) tx.add(createAssociatedTokenAccountInstruction(burner.publicKey, burnerATA, burner.publicKey, mintPK));
        tx.add(createTransferInstruction(await getAssociatedTokenAddress(mintPK, sourcePK), burnerATA, burner.publicKey, parseInt(sellQty)));
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash; tx.feePayer = burner.publicKey; tx.partialSign(burner);
        await connection.sendRawTransaction(tx.serialize());
        await addDoc(collection(db, "orders"), {
          id: Date.now(), sellerAddr: selectedCuenta, mint: selectedMatAddress,
          item: materialSeleccionadoObjeto.name, img: materialSeleccionadoObjeto.image,
          qty: parseInt(sellQty), price: parseFloat(sellPrice),
          ownerBurner: burner.publicKey.toBase58(),
          isNFT: false,
          category: materialSeleccionadoObjeto.category,
          subcategory: materialSeleccionadoObjeto.subcategory,
        });
      }
      toast(t('mktOrderOk'), 'success');
      setSellQty(""); setSellPrice(""); setSelectedMatAddress(""); triggerRefresh();
    } catch (e) { toast(t('errPermissions').replace('{msg}', e.message), 'error'); }
    setIsExecuting(false);
  };

  const cancelarOrden = async (orden) => {
    if (!burner) return;
    const confirmacion = window.confirm(t('confirmCancel')); if (!confirmacion) return;
    setIsExecuting(true);
    try {
      if (orden.isNFT) {
        // ── Core NFT: devolver al vendedor con transferV1 ───────────────
        const umi = makeUmiBurner();
        await transferV1(umi, {
          asset: umiPublicKey(orden.mint),
          newOwner: umiPublicKey(orden.sellerAddr),
        }).sendAndConfirm(umi);
      } else {
        // ── SPL: devolver al vendedor ────────────────────────────────────
        const mintPK = new PublicKey(orden.mint);
        const destPK = new PublicKey(orden.sellerAddr);
        const destATA = await getAssociatedTokenAddress(mintPK, destPK);
        const tx = new Transaction();
        const infoDest = await connection.getAccountInfo(destATA);
        if (!infoDest) tx.add(createAssociatedTokenAccountInstruction(burner.publicKey, destATA, destPK, mintPK));
        tx.add(createTransferInstruction(await getAssociatedTokenAddress(mintPK, burner.publicKey), destATA, burner.publicKey, orden.qty));
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash; tx.feePayer = burner.publicKey; tx.partialSign(burner);
        await connection.sendRawTransaction(tx.serialize());
      }
      await deleteDoc(doc(db, "orders", orden.firebaseId));
      toast(t('mktCancelOk'), 'info'); triggerRefresh();
    } catch (e) { toast(t('errDevRefund').replace('{msg}', e.message), 'error'); }
    setIsExecuting(false);
  };

  const comprarOrden = async (orden) => {
    if (!burner) { toast(t('errNeedBurner'), 'error'); return; }
    const costTotal = orden.qty * orden.price;
    const confirmacion = window.confirm(t('confirmBuy')); if (!confirmacion) return;
    setIsExecuting(true);
    try {
      // ── Paso 1: pagar en VALAN al vendedor ──────────────────────────
      const valanPK = new PublicKey(VALAN_MINT);
      const buyerValanATA = await getAssociatedTokenAddress(valanPK, burner.publicKey);
      const sellerValanATA = await getAssociatedTokenAddress(valanPK, new PublicKey(orden.ownerBurner));
      const tx = new Transaction();
      const infoSeller = await connection.getAccountInfo(sellerValanATA);
      if (!infoSeller) tx.add(createAssociatedTokenAccountInstruction(burner.publicKey, sellerValanATA, new PublicKey(orden.ownerBurner), valanPK));
      tx.add(createTransferInstruction(buyerValanATA, sellerValanATA, burner.publicKey, costTotal * Math.pow(10, 6)));
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash; tx.feePayer = burner.publicKey; tx.partialSign(burner);
      await connection.sendRawTransaction(tx.serialize());

      // ── Paso 2: entregar el activo al comprador ─────────────────────
      if (orden.isNFT) {
        // Core NFT: transferV1 del burner escrow al comprador
        const umi = makeUmiBurner();
        await transferV1(umi, {
          asset: umiPublicKey(orden.mint),
          newOwner: umiPublicKey(burner.publicKey.toBase58()),
        }).sendAndConfirm(umi);
      } else {
        // SPL: transferir tokens del burner al comprador
        const mintPK = new PublicKey(orden.mint);
        const buyerATA = await getAssociatedTokenAddress(mintPK, burner.publicKey);
        const tx2 = new Transaction();
        const infoBuyer = await connection.getAccountInfo(buyerATA);
        if (!infoBuyer) tx2.add(createAssociatedTokenAccountInstruction(burner.publicKey, buyerATA, burner.publicKey, mintPK));
        tx2.add(createTransferInstruction(await getAssociatedTokenAddress(mintPK, new PublicKey(orden.ownerBurner)), buyerATA, burner.publicKey, orden.qty));
        const { blockhash: bh2 } = await connection.getLatestBlockhash();
        tx2.recentBlockhash = bh2; tx2.feePayer = burner.publicKey; tx2.partialSign(burner);
        await connection.sendRawTransaction(tx2.serialize());
      }
      await deleteDoc(doc(db, "orders", orden.firebaseId));
      toast(t('successBuy'), 'success'); triggerRefresh();
    } catch (e) { toast(t('errBuy').replace('{msg}', e.message), 'error'); }
    setIsExecuting(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="alert-banner">{t('mktDemoBanner')}</div>
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <select value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setFilterSub(""); setFilterItem(""); }} className="axon-input" style={{minWidth: '200px'}}><option value="">{t('fltAllCat')}</option>{cats.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select value={filterSub} onChange={(e) => { setFilterSub(e.target.value); setFilterItem(""); }} disabled={!filterCat} className="axon-input" style={{minWidth: '200px', opacity: filterCat ? 1 : 0.5}}><option value="">{t('fltAllSub')}</option>{subs.map(s => <option key={s} value={s}>{s}</option>)}</select>
        <select value={filterItem} onChange={(e) => setFilterItem(e.target.value)} disabled={!filterSub} className="axon-input" style={{minWidth: '200px', opacity: filterSub ? 1 : 0.5}}><option value="">{t('fltAllItem')}</option>{itemsFiltro.map(i => <option key={i} value={i}>{i}</option>)}</select>
        <button onClick={() => { setFilterCat(""); setFilterSub(""); setFilterItem(""); }} className="axon-btn-secondary" style={{padding: '10px 15px'}}>{t('fltClear')}</button>
      </div>
      <div style={{ display: 'flex', gap: '25px', flexGrow: 1, minHeight: 0 }}>
        <div className="glass-card" style={{ flex: 2.5, padding: '25px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ color: 'var(--pf-gold-light)', margin: '0 0 20px 0', fontSize: '20px', fontFamily: 'var(--font-heading)' }}>{t('mktActiveOrders')}</h3>
          <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '5px' }}>
            <table className="modern-table">
              <thead><tr><th>{t('mktItem')}</th><th>{t('mktQty')}</th><th>{t('mktPrice')}</th><th>{t('mktTotal')}</th><th>{t('mktSeller')}</th><th style={{ textAlign: 'right' }}>{t('mktAction')}</th></tr></thead>
              <tbody>
                {ordenesFiltradas.length === 0 ? ( <tr><td colSpan="6" className="empty-state" style={{borderBottom: 'none'}}>{t('mktNoOrdersFlt')}</td></tr> ) : (
                  ordenesFiltradas.map((orden) => (
                    <tr key={orden.id}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {orden.img ? <img src={orden.img} className="item-icon" alt="img"/> : <div className="item-icon-placeholder"></div>}
                        <span style={{ fontWeight: '600', color: 'var(--pf-text)' }}>{orden.item}</span>
                        {orden.isNFT && <span style={{fontSize:'9px', color:'var(--pf-gold)', border:'1px solid var(--pf-gold)', padding:'1px 5px', borderRadius:'3px', marginLeft:'4px', flexShrink:0}}>NFT</span>}
                      </td>
                      <td style={{ color: 'var(--pf-orange)', fontWeight: '600' }}>{orden.isNFT ? '1' : orden.qty}</td>
                      <td>{orden.price} <span style={{ fontSize: '10px', color: 'var(--pf-gold)' }}>VALAN</span></td>
                      <td style={{ color: 'var(--pf-gold)', fontWeight: '600' }}>{(orden.qty * orden.price).toLocaleString()} <span style={{ fontSize: '10px' }}>VALAN</span></td>
                      <td style={{ color: 'var(--pf-text-muted)', fontFamily: 'monospace' }} title={orden.sellerAddr}>{shortenAddress(orden.sellerAddr)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {burner && orden.ownerBurner === burner.publicKey.toBase58() ? ( <button onClick={() => cancelarOrden(orden)} disabled={isExecuting} className="axon-btn-danger">{t('mktCancel')}</button> ) : ( <button onClick={() => comprarOrden(orden)} disabled={isExecuting} className="axon-btn-primary" style={{padding: '8px 15px', fontSize: '10px'}}><span>{t('mktBuy1Click')}</span></button> )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="glass-card" style={{ flex: 1, padding: '25px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ color: 'var(--pf-text)', margin: '0 0 20px 0', borderBottom: '1px solid var(--pf-border)', paddingBottom: '15px', fontFamily: 'var(--font-heading)' }}>{t('mktCreateOrder')}</h3>
          {cuentas.length === 0 ? ( <div className="empty-state" style={{marginTop: '30px'}}>{t('mktNoAccs')}</div> ) : (
            <div className="form-group">
              <div><label className="form-label">{t('mktSellerWallet')}</label><select value={selectedCuenta} onChange={(e) => { setSelectedCuenta(e.target.value); setSelectedMatAddress(""); setSellQty(""); }} className="axon-input"><option value="">{t('mktSelectAcc')}</option>{cuentas.map(c => <option key={c.direccion} value={c.direccion}>{c.alias}</option>)}</select></div>
              <div><label className="form-label">{t('mktItem')}</label><select value={selectedMatAddress} onChange={(e) => { setSelectedMatAddress(e.target.value); setSellQty(""); }} disabled={!selectedCuenta} className="axon-input"><option value="">{t('mktSelectMat')}</option>{misMateriales.map((mat) => ( <option key={mat.address} value={mat.address}>{mat.name} {mat.isNFT ? '· NFT' : `(Disp: ${mat.cantidad})`}</option> ))}</select></div>
              {!materialSeleccionadoObjeto?.isNFT && (
                <div><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><label className="form-label" style={{marginBottom: 0}}>{t('mktQtyToSell')}</label>{materialSeleccionadoObjeto && ( <span className="max-btn" onClick={() => setSellQty(materialSeleccionadoObjeto.cantidad)}>MAX</span> )}</div><input type="number" placeholder="Ej: 100" value={sellQty} onChange={(e) => setSellQty(e.target.value)} className="axon-input" /></div>
              )}
              <div><label className="form-label">{t('mktPrice')}</label><div className="input-with-suffix"><input type="number" placeholder={t('mktSetPrice')} value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} className="axon-input" style={{border: 'none', background: 'transparent'}} /><span className="suffix">VALAN</span></div></div>
              <div className="summary-box"><span style={{ fontSize: '12px', color: 'var(--pf-text-muted)' }}>{t('mktReceiveExact')}</span><div style={{ fontSize: '22px', color: 'var(--pf-gold)', fontWeight: 'bold', margin: '5px 0' }}>{materialSeleccionadoObjeto?.isNFT ? (sellPrice || '0') : totalRecibir} VALAN</div></div>
              <button onClick={crearOrden} disabled={isExecuting} className="axon-btn-primary" style={{ width: '100%', marginTop: '10px', opacity: isExecuting ? 0.5 : 1 }}><span>{isExecuting ? t('cartExecWait') : t('mktBtnSell')}</span></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VistaCrafteo({ cuentas, burner, t }) {
  const wallet = useWallet();
  const toast = useToast();
  const [selectedCuenta, setSelectedCuenta] = useState("");
  const [misHeroes, setMisHeroes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [valanToken, setValanToken] = useState(() => localStorage.getItem('valannia_v_token') || null);
  const [heroSeleccionado, setHeroSeleccionado] = useState(null);

  const cuentasRender = useMemo(() => {
    if (burner) return [{ alias: "🔥 Burn Wallet", direccion: burner.publicKey.toBase58(), isBurner: true }, ...cuentas];
    return cuentas;
  }, [cuentas, burner]);

  // ── Auth con Valannia ──────────────────────────────────────────────────
  const conectarValannia = async () => {
    if (!wallet.connected) { toast('Conecta tu wallet primero.', 'error'); return; }
    setIsLoading(true);
    try {
      // Generamos o recuperamos un device UUID persistente
      let device = localStorage.getItem('valannia_device');
      if (!device) { device = crypto.randomUUID(); localStorage.setItem('valannia_device', device); }

      // 1. Obtener challenge
const challengeRes = await fetch('https://api.valannia.com/user/authentication/solana/challenge', {
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
     const authRes = await fetch('https://api.valannia.com/user/authentication/solana/authenticate', {
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
 const res = await fetch('https://api.valannia.com/rtr/player/heroes', {
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
              return (
                <div key={h.id} className="hero-card" onClick={() => setHeroSeleccionado(isSelected ? null : h)}
                  style={{ border: `2px solid ${isSelected ? 'var(--pf-orange)' : border}`, cursor: 'pointer', transition: 'border-color 0.2s', position: 'relative' }}>
                  {/* Badge border */}
                  <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '9px', fontWeight: 'bold', color: border, border: `1px solid ${border}`, padding: '2px 6px', borderRadius: '4px', background: 'var(--pf-bg)' }}>{hero.border}</div>
                  <div className="hero-img-container">
                    <img src={`https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${h.item.kind}&backgroundColor=0A0704`} alt={h.item.kind} className="hero-img" />
                  </div>
                  <h4 className="hero-title">{h.item.kind}</h4>
                  <div className="hero-stats">
                    <div className="stat-row"><span className="stat-label">{t('craftProfession')}</span><span className="stat-value">{hero.profession}</span></div>
                    <div className="stat-row"><span className="stat-label">{t('craftLevel')}</span><span className="stat-value">{hero.level}</span></div>
                    <div className="stat-row"><span className="stat-label">Mastery</span><span className="stat-value">{hero.mastery}</span></div>
                    <div className="stat-row"><span className="stat-label">XP</span><span className="stat-value">{hero.experience.toLocaleString()}</span></div>
                    <div className="stat-row"><span className="stat-label">Health</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '60px', height: '4px', background: 'var(--pf-border)', borderRadius: '2px' }}>
                          <div style={{ width: `${(h.health / 140) * 100}%`, height: '100%', background: h.health > 80 ? '#4CAF50' : h.health > 40 ? 'var(--pf-gold)' : 'var(--pf-orange)', borderRadius: '2px', transition: 'width 0.3s' }}></div>
                        </div>
                        <span className="stat-value">{h.health}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel detalle héroe seleccionado */}
        <div className="glass-card" style={{ flex: 1, padding: '25px', display: 'flex', flexDirection: 'column' }}>
          {!heroSeleccionado ? (
            <div className="empty-state" style={{ marginTop: '40px' }}>Selecciona un héroe para ver detalles.</div>
          ) : (
            <>
              <h3 style={{ color: 'var(--pf-gold-light)', margin: '0 0 20px 0', fontFamily: 'var(--font-heading)' }}>{heroSeleccionado.item.kind}</h3>

              {/* Skills */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', color: 'var(--pf-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 'bold' }}>Skills</div>
                {heroSeleccionado.item.attributes.hero.skills.map((s, i) => (
                  <div key={i} style={{ background: 'var(--pf-bg)', border: '1px solid var(--pf-border)', padding: '8px 12px', marginBottom: '6px', borderRadius: '4px', fontSize: '12px', color: 'var(--pf-gold)' }}>⚡ {s.name}</div>
                ))}
              </div>

              {/* Maestrías */}
              <div>
                <div style={{ fontSize: '11px', color: 'var(--pf-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 'bold' }}>Maestrías</div>
                {Object.values(heroSeleccionado.masteries)
                  .filter(m => m.mastery > 0)
                  .sort((a, b) => b.mastery - a.mastery)
                  .map((m, i) => (
                    <div key={i} style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                        <span style={{ color: 'var(--pf-text)' }}>{m.profession}</span>
                        <span style={{ color: 'var(--pf-gold)' }}>{m.mastery}</span>
                      </div>
                      <div style={{ width: '100%', height: '3px', background: 'var(--pf-border)', borderRadius: '2px' }}>
                        <div style={{ width: `${Math.min((m.mastery / 300) * 100, 100)}%`, height: '100%', background: 'var(--pf-orange)', borderRadius: '2px' }}></div>
                      </div>
                    </div>
                  ))}
                {Object.values(heroSeleccionado.masteries).every(m => m.mastery === 0) && (
                  <div style={{ fontSize: '12px', color: 'var(--pf-text-muted)' }}>Sin maestrías aún.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VistaEstadisticas({ t }) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [chartData, setChartData] = useState([]);
  
  useEffect(() => {
    const emptyData = []; const today = new Date();
    for (let i = 6; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); emptyData.push({ name: d.toLocaleDateString(), fees: 0, rewards: 0 }); }
    setChartData(emptyData);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      <div className="glass-card" style={{ padding: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ color: 'var(--pf-gold-light)', margin: '0 0 5px 0', fontSize: '22px', fontFamily: 'var(--font-heading)' }}>{t('statTitle')}</h3>
          <p style={{ color: 'var(--pf-text-muted)', margin: 0, fontSize: '13px' }}>{t('statSubtitle')} <span style={{fontFamily: 'monospace'}}>{shortenAddress(TARGET_ADDRESS)}</span></p>
        </div>
        <button onClick={() => { setIsExtracting(true); setTimeout(() => setIsExtracting(false), 2000); }} disabled={isExtracting} className="axon-btn-primary" style={{ height: '42px' }}>
          <span>{isExtracting ? t('statBtnExtracting') : t('statBtnExtract')}</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
         <div className="glass-card" style={{ flex: 1, padding: '20px', textAlign: 'center', borderBottom: '4px solid var(--pf-gold)' }}>
            <div style={{ fontSize: '11px', color: 'var(--pf-text-muted)', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 'bold' }}>{t('statCardIn')}</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--pf-gold)' }}>+0.00 <span style={{fontSize: '12px'}}>VALAN</span></div>
         </div>
         <div className="glass-card" style={{ flex: 1, padding: '20px', textAlign: 'center', borderBottom: '4px solid var(--pf-orange)' }}>
            <div style={{ fontSize: '11px', color: 'var(--pf-text-muted)', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 'bold' }}>{t('statCardOut')}</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--pf-orange)' }}>-0.00 <span style={{fontSize: '12px'}}>VALAN</span></div>
         </div>
      </div>

      <div className="glass-card" style={{ flexGrow: 1, padding: '30px', display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ color: 'var(--pf-text-muted)', marginTop: 0, marginBottom: '20px', fontSize: '14px', fontWeight: 'normal' }}>Tendencia últimos 7 días</h4>
        <div style={{ width: '100%', height: '100%', minHeight: '250px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorFees" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#D4A843" stopOpacity={0.5}/><stop offset="95%" stopColor="#D4A843" stopOpacity={0}/></linearGradient>
                <linearGradient id="colorRewards" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#FF6B1A" stopOpacity={0.5}/><stop offset="95%" stopColor="#FF6B1A" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pf-border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--pf-text-muted)" tick={{ fill: 'var(--pf-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis stroke="var(--pf-text-muted)" tick={{ fill: 'var(--pf-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} dx={-10} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--pf-surface)', border: '1px solid var(--pf-border)', borderRadius: '8px', color: 'var(--pf-text)' }} />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: 'var(--pf-text-muted)' }}/>
              <Area type="monotone" dataKey="rewards" name={t('statCardOut')} stroke="var(--pf-orange)" strokeWidth={3} fillOpacity={1} fill="url(#colorRewards)" />
              <Area type="monotone" dataKey="fees" name={t('statCardIn')} stroke="var(--pf-gold)" strokeWidth={3} fillOpacity={1} fill="url(#colorFees)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// APLICACIÓN PRINCIPAL
// ==========================================
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
                    <span style={{marginRight: '10px', fontSize: '16px', filter: 'sepia(1) hue-rotate(15deg) contrast(0.8)'}}>🔨</span> {t('menuCrafting')}
                  </button>
                  <button className={`sidebar-btn ${vistaActiva === 'estadisticas' ? 'active' : ''}`} onClick={() => setVistaActiva('estadisticas')}>
                    <span style={{marginRight: '10px', fontSize: '16px', filter: 'sepia(1) hue-rotate(15deg) contrast(0.8)'}}>📊</span> {t('menuAnalytics')}
                  </button>

                  <div style={{ marginTop: 'auto', textAlign: 'center', color: 'var(--pf-text-muted)', fontSize: '12px', paddingTop: '20px', borderTop: '1px solid var(--pf-border)' }}>
                    <p style={{ margin: '0 0 8px 0', lineHeight: '1.5' }}>
                      {t('footDev')}<br/><span style={{ color: 'var(--pf-orange)', fontWeight: 'bold' }}>{t('footMem')}</span>.
                    </p>
                  </div>
                </aside>

                <main style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ flexGrow: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {vistaActiva === 'inventario' && <VistaInventario cuentas={cuentas} setCuentas={setCuentas} tokensConfig={tokensConfig} burner={burner} triggerRefresh={triggerRefresh} refreshTrigger={refreshTrigger} t={t} />}
                    {vistaActiva === 'mercado' && <VistaMercado tokensConfig={tokensConfig} burner={burner} cuentas={cuentas} triggerRefresh={triggerRefresh} refreshTrigger={refreshTrigger} t={t} db={db} />}
                    {vistaActiva === 'crafteo' && <VistaCrafteo cuentas={cuentas} burner={burner} t={t} />}
                    {vistaActiva === 'estadisticas' && <VistaEstadisticas t={t} />}
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