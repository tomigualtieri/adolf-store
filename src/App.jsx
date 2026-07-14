import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ShoppingBag, X, Plus, Minus, Check, Upload, ArrowLeft,
  Search, User, Menu, Trash2, Lock, Pencil, ImagePlus,
} from "lucide-react";
import { supabase } from "./supabaseClient";

/* ============================================================
   CONFIGURACIÓN — identidad de marca, no tocar sin pedido expreso
   ============================================================ */
const CONFIG = {
  storeName: "ADOLF",
  tagline: "Prendas de punto y tejido, una por una",
  whatsappNumber: "5492213081481",
  bank: {
    titular: "Juliana Garavaglia",
    alias: "Garavaglia.juliana",
    cbu: "0140188803520052703915",
  },
  // ⚠️ Cambiá esta clave por una propia. Es un candado simple del lado del
  // navegador: alcanza para que no cualquiera edite el catálogo, pero no
  // reemplaza un login real con backend.
  adminPassword: "adolf2026",
};

const COLOR_HEX = {
  "Bordó": "#7B2D2A",
  "Beige": "#D9BFA0",
  "Blanco": "#F7F3EC",
  "Negro": "#231F1C",
  "Marrón": "#6E4B32",
  "Gris": "#9B9691",
  "Azul": "#3F5770",
  "Verde": "#5C6B4E",
  "Celeste": "#A9C4CB",
  "Óxido": "#A15831",
};

const splitColors = (raw) => raw.replace(" con ", "/").split("/").map((c) => c.trim());

/* ============================================================
   CATÁLOGO POR DEFECTO — se usa solo la primera vez, después
   todo se edita y guarda desde el panel de administración
   ============================================================ */
const RAW_PRODUCTS = [
  { name: "Luna", tipo: "Media polera", category: "Poleras", price: 17000, stock: 10, colors: ["Bordó", "Beige"], sizes: ["S", "M", "L"] },
  { name: "Nieve", tipo: "Polera", category: "Poleras", price: 18000, stock: 10, colors: ["Blanco"], sizes: ["S", "M", "L"] },
  { name: "Tokyo", tipo: "Remera estilo china", category: "Remeras", price: 19900, stock: 10, colors: ["Negro", "Marrón"], sizes: ["S", "M", "L"] },
  { name: "Brooke", tipo: "Body con hebilla", category: "Bodies", price: 17900, stock: 10, colors: ["Negro", "Blanco", "Marrón"], sizes: ["S", "M", "L"] },
  { name: "Emma", tipo: "Sweater con botones", category: "Sweaters", price: 25600, stock: 10, colors: ["Gris", "Azul"], sizes: ["S", "M", "L"] },
  { name: "Ray", tipo: "Sweater a líneas", category: "Sweaters", price: 24000, stock: 10, colors: ["Marrón/Blanco", "Gris/Blanco"], sizes: ["S", "M", "L"] },
  { name: "Nora", tipo: "Sweater con cuello a líneas", category: "Sweaters", price: 29900, stock: 10, colors: ["Gris/Verde", "Marrón/Celeste"], sizes: ["S", "M", "L"] },
  { name: "Perla", tipo: "Sweater blanco con cuello", category: "Sweaters", price: 28000, stock: 10, colors: ["Blanco"], sizes: ["S", "M", "L"] },
  { name: "Cebra", tipo: "Sweater con líneas negras y blancas", category: "Sweaters", price: 26600, stock: 10, colors: ["Negro/Blanco"], sizes: ["S", "M", "L"] },
  { name: "Mía Set", tipo: "Conjunto chaleco y pollera", category: "Sets", price: 50000, stock: 10, colors: ["Beige", "Verde"], sizes: ["S", "M", "L"] },
  { name: "Lola", tipo: "Short pollera", category: "Shorts", price: 18000, stock: 10, colors: ["Negro"], sizes: ["S", "M", "L"] },
  { name: "Milan", tipo: "Jean Oxford", category: "Jeans", price: 32000, stock: 10, colors: ["Negro"], sizes: ["36", "38", "40", "42"] },
  { name: "Rust", tipo: "Jean óxido", category: "Jeans", price: 32000, stock: 10, colors: ["Azul con óxido"], sizes: ["36", "38", "40", "42"] },
];

const DEFAULT_PRODUCTS = RAW_PRODUCTS.map((p, i) => ({
  id: `p${i + 1}`,
  ref: `AD-${String(i + 1).padStart(3, "0")}`,
  images: [],
  ...p,
}));

const money = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

const parseColors = (product) => (product.colors || []).map((c) => (typeof c === "string" ? { label: c, parts: splitColors(c) } : c));

/* ---------- Supabase: catálogo ---------- */
async function fetchProducts() {
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
async function insertProduct(product) {
  const { data, error } = await supabase.from("products").insert([product]).select();
  if (error) throw error;
  return data[0];
}
async function updateProductRow(id, fields) {
  const { error } = await supabase.from("products").update(fields).eq("id", id);
  if (error) throw error;
}
async function deleteProductRow(id) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}
async function seedProducts() {
  const { data, error } = await supabase.from("products").insert(DEFAULT_PRODUCTS).select();
  if (error) throw error;
  return data || [];
}
/* ---------- Supabase: imágenes ---------- */
async function uploadImage(file) {
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

/* ============================================================
   Reveal — fade-up al entrar en pantalla (IntersectionObserver)
   ============================================================ */
function Reveal({ children, delay = 0, className = "", as: Tag = "div" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } }),
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${visible ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

function ColorSwatch({ parts, size = 18 }) {
  if (parts.length === 1) {
    return <span className="swatch-dot" style={{ width: size, height: size, background: COLOR_HEX[parts[0]] || "#b9ab98" }} />;
  }
  return (
    <span className="swatch-dot split" style={{ width: size, height: size }}>
      <span style={{ background: COLOR_HEX[parts[0]] || "#b9ab98" }} />
      <span style={{ background: COLOR_HEX[parts[1]] || "#b9ab98" }} />
    </span>
  );
}

/* Medio visual del producto: usa fotos reales si hay, si no cae al cuero de marca */
function Media({ product, activeImg = 0, alt: altImg = 1, hovered, className = "" }) {
  const heroColor = COLOR_HEX[parseColors(product)[0]?.parts[0]] || "#6f4e30";
  const imgs = product.images || [];
  if (imgs.length > 0) {
    return (
      <div className={`media-wrap ${className}`}>
        <img src={imgs[activeImg] || imgs[0]} className={`media-photo photo-a ${hovered ? "hide" : ""}`} alt={product.name} />
        <img src={imgs[altImg] || imgs[0]} className={`media-photo photo-b ${hovered ? "show" : ""}`} alt={product.name} />
      </div>
    );
  }
  return (
    <div className={`media-wrap leather ${className}`} style={{ "--tint": heroColor }}>
      <div className="stitch" />
    </div>
  );
}

/* ============================================================
   ProductCard
   ============================================================ */
function ProductCard({ product, onOpen, onQuickAdd, delay = 0 }) {
  const [hovered, setHovered] = useState(false);
  const colors = parseColors(product);
  const outOfStock = (product.stock ?? 0) <= 0;

  return (
    <Reveal delay={delay} className="pcard-wrap">
      <div className="pcard" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div className="pcard-media" onClick={() => onOpen(product)}>
          <Media product={product} hovered={hovered} />
          <span className="pcard-ref">{product.ref}</span>
          {outOfStock && <span className="stock-badge">Sin stock</span>}
          <div className={`pcard-actions ${hovered ? "show" : ""}`}>
            <button
              className="quick-add"
              disabled={outOfStock}
              onClick={(e) => { e.stopPropagation(); onQuickAdd(product); }}
            >
              {outOfStock ? "Sin stock" : "Agregar rápido"}
            </button>
          </div>
        </div>
        <div className="pcard-info" onClick={() => onOpen(product)}>
          <div className="pcard-cat">{product.category}</div>
          <h3 className="pcard-name">{product.name}</h3>
          <div className="pcard-tipo">{product.tipo}</div>
          <div className="pcard-bottom">
            <span className="pcard-price">{money(product.price)}</span>
            <span className="pcard-colors">{colors.map((c) => <ColorSwatch key={c.label} parts={c.parts} size={12} />)}</span>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* ============================================================
   ProductDetail
   ============================================================ */
function ProductDetail({ product, allProducts, onBack, onAdd, onOpenRelated }) {
  const colors = parseColors(product);
  const [color, setColor] = useState(colors[0]?.label);
  const [size, setSize] = useState(null);
  const [err, setErr] = useState(null);
  const [added, setAdded] = useState(false);
  const [activeThumb, setActiveThumb] = useState(0);
  const outOfStock = (product.stock ?? 0) <= 0;
  const imgs = product.images || [];

  useEffect(() => {
    setColor(colors[0]?.label);
    setSize(null);
    setActiveThumb(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  const related = allProducts.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  const handleAdd = () => {
    if (outOfStock) return;
    if (!size) return setErr("Elegí un talle");
    onAdd(product, color, size, imgs[0]);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="detail-wrap">
      <Reveal><button className="back-link" onClick={onBack}><ArrowLeft size={14} /> Volver al catálogo</button></Reveal>

      <div className="detail-grid">
        <Reveal className="gallery">
          {imgs.length > 0 ? (
            <img src={imgs[activeThumb] || imgs[0]} className="gallery-main-img" alt={product.name} />
          ) : (
            <div className="gallery-main leather" style={{ "--tint": COLOR_HEX[colors[0]?.parts[0]] || "#6f4e30" }}>
              <div className="stitch" />
              <span className="pcard-ref">{product.ref}</span>
            </div>
          )}
          {imgs.length > 1 && (
            <div className="gallery-thumbs">
              {imgs.map((src, i) => (
                <button key={i} className={`thumb img-thumb ${activeThumb === i ? "active" : ""}`} onClick={() => setActiveThumb(i)}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </Reveal>

        <Reveal delay={100} className="detail-info">
          <div className="pcard-cat">{product.category}</div>
          <h1 className="detail-name">{product.name}</h1>
          <div className="detail-tipo">{product.tipo}</div>
          <div className="detail-price">{money(product.price)}</div>
          {outOfStock && <div className="tag-error" style={{ marginBottom: 16 }}>Sin stock por el momento</div>}

          <div className="opt-label">Color — {color}</div>
          <div className="tag-colors">
            {colors.map((c) => (
              <button key={c.label} className={`color-btn ${color === c.label ? "active" : ""}`} onClick={() => setColor(c.label)}>
                <ColorSwatch parts={c.parts} /><span>{c.label}</span>
              </button>
            ))}
          </div>

          <div className="opt-label">Talle</div>
          <div className="tag-sizes">
            {(product.sizes || []).map((s) => (
              <button key={s} className={`size-btn ${size === s ? "active" : ""}`} onClick={() => { setSize(s); setErr(null); }}>{s}</button>
            ))}
          </div>
          {err && <div className="tag-error">{err}</div>}

          <button className={`add-cta leather ${added ? "added" : ""}`} disabled={outOfStock} onClick={handleAdd}>
            <span className="add-cta-label default">{outOfStock ? "Sin stock" : "Agregar al carrito"}</span>
            <span className="add-cta-label success"><Check size={15} /> Agregado</span>
          </button>

          <div className="detail-meta">
            <p>Prenda de punto trabajada a mano, terminaciones reforzadas y tejido de temporada.</p>
            <p>Envíos a todo el país o retiro a coordinar por WhatsApp.</p>
          </div>
        </Reveal>
      </div>

      {related.length > 0 && (
        <div className="related">
          <Reveal><span className="section-label">También te puede interesar</span></Reveal>
          <div className="catalog related-grid">
            {related.map((p, i) => <ProductCard key={p.id} product={p} onOpen={onOpenRelated} onQuickAdd={() => {}} delay={i * 60} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ADMIN — alta/edición de productos, precios, stock e imágenes
   ============================================================ */
const emptyForm = { name: "", tipo: "", category: "", price: "", stock: "", colors: "", sizes: "" };

function ProductRow({ product, onSave, onDelete }) {
  const [form, setForm] = useState({
    name: product.name, tipo: product.tipo, category: product.category,
    price: product.price, stock: product.stock ?? 0,
    colors: (product.colors || []).map((c) => (typeof c === "string" ? c : c.label)).join(", "),
    sizes: (product.sizes || []).join(", "),
  });
  const [images, setImages] = useState(product.images || []);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const update = (field, val) => { setForm((f) => ({ ...f, [field]: val })); setDirty(true); };

  const addImages = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const url = await uploadImage(file);
        setImages((prev) => [...prev, url]);
        setDirty(true);
      }
    } catch (err) {
      alert("No se pudo subir la imagen: " + err.message);
    } finally {
      setUploading(false);
    }
  };
  const removeImage = (idx) => { setImages((prev) => prev.filter((_, i) => i !== idx)); setDirty(true); };

  const save = async () => {
    await onSave(product.id, {
      ...product,
      name: form.name, tipo: form.tipo, category: form.category,
      price: Number(form.price) || 0, stock: Number(form.stock) || 0,
      colors: form.colors.split(",").map((s) => s.trim()).filter(Boolean),
      sizes: form.sizes.split(",").map((s) => s.trim()).filter(Boolean),
      images,
    });
    setDirty(false);
  };

  return (
    <div className="admin-row">
      <div className="admin-row-imgs">
        {images.map((src, i) => (
          <div className="admin-thumb" key={i}>
            <img src={src} alt="" />
            <button onClick={() => removeImage(i)}><X size={12} /></button>
          </div>
        ))}
        <button className="admin-thumb add" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <span className="mini-spinner" /> : <ImagePlus size={16} />}
        </button>
        <input type="file" accept="image/*" multiple ref={fileRef} style={{ display: "none" }} onChange={addImages} />
      </div>

      <div className="admin-fields">
        <input className="admin-input" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Nombre" />
        <input className="admin-input" value={form.tipo} onChange={(e) => update("tipo", e.target.value)} placeholder="Tipo de prenda" />
        <input className="admin-input" value={form.category} onChange={(e) => update("category", e.target.value)} placeholder="Categoría" />
        <input className="admin-input" type="number" value={form.price} onChange={(e) => update("price", e.target.value)} placeholder="Precio" />
        <input className="admin-input" type="number" value={form.stock} onChange={(e) => update("stock", e.target.value)} placeholder="Stock" />
        <input className="admin-input" value={form.colors} onChange={(e) => update("colors", e.target.value)} placeholder="Colores (separados por coma)" />
        <input className="admin-input" value={form.sizes} onChange={(e) => update("sizes", e.target.value)} placeholder="Talles (separados por coma)" />
      </div>

      <div className="admin-row-actions">
        <button className="admin-save" disabled={!dirty || uploading} onClick={save}><Pencil size={13} /> Guardar</button>
        <button className="admin-del" onClick={() => onDelete(product.id)}><Trash2 size={13} /> Eliminar</button>
      </div>
    </div>
  );
}

function AdminPage({ products, setProducts, onExit }) {
  const [unlocked, setUnlocked] = useState(false);
  const [pass, setPass] = useState("");
  const [passErr, setPassErr] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [newImages, setNewImages] = useState([]);
  const [uploadingNew, setUploadingNew] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [busyMsg, setBusyMsg] = useState(null);
  const newFileRef = useRef(null);

  const tryUnlock = (e) => {
    e.preventDefault();
    if (pass === CONFIG.adminPassword) setUnlocked(true);
    else setPassErr(true);
  };

  const saveProduct = async (id, updated) => {
    setBusyMsg(null);
    try {
      await updateProductRow(id, {
        name: updated.name, tipo: updated.tipo, category: updated.category,
        price: updated.price, stock: updated.stock, colors: updated.colors,
        sizes: updated.sizes, images: updated.images,
      });
      setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      setBusyMsg("No se pudo guardar: " + err.message);
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm("¿Eliminar este producto del catálogo?")) return;
    try {
      await deleteProductRow(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setBusyMsg("No se pudo eliminar: " + err.message);
    }
  };

  const addNewImages = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploadingNew(true);
    try {
      for (const file of files) {
        const url = await uploadImage(file);
        setNewImages((prev) => [...prev, url]);
      }
    } catch (err) {
      setBusyMsg("No se pudo subir la imagen: " + err.message);
    } finally {
      setUploadingNew(false);
    }
  };

  const addProduct = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price) return;
    setBusyMsg(null);
    const id = `p_${Date.now()}`;
    const ref = `AD-${String(products.length + 1).padStart(3, "0")}`;
    const newProduct = {
      id, ref,
      name: form.name, tipo: form.tipo, category: form.category || "General",
      price: Number(form.price) || 0, stock: Number(form.stock) || 0,
      colors: form.colors.split(",").map((s) => s.trim()).filter(Boolean),
      sizes: form.sizes.split(",").map((s) => s.trim()).filter(Boolean),
      images: newImages,
    };
    try {
      const inserted = await insertProduct(newProduct);
      setProducts((prev) => [...prev, inserted]);
      setForm(emptyForm);
      setNewImages([]);
    } catch (err) {
      setBusyMsg("No se pudo agregar el producto: " + err.message);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setBusyMsg(null);
    try {
      const seeded = await seedProducts();
      setProducts(seeded);
    } catch (err) {
      setBusyMsg("No se pudo cargar el catálogo de ejemplo: " + err.message);
    } finally {
      setSeeding(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="admin-lock">
        <div className="admin-lock-box">
          <Lock size={22} />
          <h2>Panel de administración</h2>
          <p>Ingresá la clave para editar el catálogo de {CONFIG.storeName}.</p>
          <form onSubmit={tryUnlock}>
            <input type="password" value={pass} onChange={(e) => { setPass(e.target.value); setPassErr(false); }} placeholder="Clave" autoFocus />
            {passErr && <div className="tag-error">Clave incorrecta</div>}
            <button type="submit" className="admin-save wide">Entrar</button>
          </form>
          <button className="back-link" onClick={onExit}><ArrowLeft size={14} /> Volver a la tienda</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-wrap">
      <div className="admin-head">
        <div>
          <h2>Panel de administración</h2>
          <p className="checkout-sub">Editá precios, stock, colores, talles e imágenes. Los cambios se guardan en Supabase y los ve cualquiera que entre al sitio.</p>
        </div>
        <button className="back-link" onClick={onExit}><ArrowLeft size={14} /> Volver a la tienda</button>
      </div>

      {busyMsg && <div className="tag-error" style={{ marginBottom: 20 }}>{busyMsg}</div>}

      {products.length === 0 && (
        <div className="bank-box" style={{ marginBottom: 40 }}>
          <h3>Catálogo vacío</h3>
          <p style={{ fontSize: 13, marginBottom: 14, opacity: 0.8 }}>Todavía no hay productos cargados en Supabase. Podés empezar de cero con "Agregar producto nuevo" más abajo, o precargar el catálogo de ejemplo con precios y prendas ya cargadas.</p>
          <button className="admin-save" disabled={seeding} onClick={handleSeed}>{seeding ? "Cargando…" : "Precargar catálogo de ejemplo"}</button>
        </div>
      )}

      <div className="admin-list">
        {products.map((p) => <ProductRow key={p.id} product={p} onSave={saveProduct} onDelete={deleteProduct} />)}
      </div>

      <div className="admin-new">
        <h3>Agregar producto nuevo</h3>
        <form onSubmit={addProduct} className="admin-fields admin-fields-new">
          <input className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre" required />
          <input className="admin-input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="Tipo de prenda" />
          <input className="admin-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Categoría" />
          <input className="admin-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Precio" required />
          <input className="admin-input" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="Stock" />
          <input className="admin-input" value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} placeholder="Colores (Negro, Beige...)" />
          <input className="admin-input" value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} placeholder="Talles (S, M, L...)" />

          <div className="admin-row-imgs" style={{ gridColumn: "1 / -1" }}>
            {newImages.map((src, i) => (
              <div className="admin-thumb" key={i}>
                <img src={src} alt="" />
                <button type="button" onClick={() => setNewImages((prev) => prev.filter((_, ix) => ix !== i))}><X size={12} /></button>
              </div>
            ))}
            <button type="button" className="admin-thumb add" onClick={() => newFileRef.current?.click()} disabled={uploadingNew}>
              {uploadingNew ? <span className="mini-spinner" /> : <ImagePlus size={16} />}
            </button>
            <input type="file" accept="image/*" multiple ref={newFileRef} style={{ display: "none" }} onChange={addNewImages} />
          </div>

          <button type="submit" className="admin-save wide" disabled={uploadingNew} style={{ gridColumn: "1 / -1" }}><Plus size={14} /> Agregar producto</button>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   App
   ============================================================ */
export default function App() {
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchProducts()
      .then((data) => { if (alive) setProducts(data); })
      .catch((err) => { if (alive) setProductsError(err.message); })
      .finally(() => { if (alive) setProductsLoading(false); });
    return () => { alive = false; };
  }, []);

  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [bump, setBump] = useState(false);
  const [view, setView] = useState(() => (window.location.hash === "#admin" ? "admin" : "store"));
  const [activeProduct, setActiveProduct] = useState(null);
  const [buyer, setBuyer] = useState({ nombre: "", telefono: "", entrega: "envio", direccion: "", notas: "" });
  const [comprobante, setComprobante] = useState(null);
  const fileRef = useRef(null);

  const [scrolled, setScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(null);
  const megaTimer = useRef(null);

  useEffect(() => {
    const onScroll = () => { setScrolled(window.scrollY > 40); setScrollY(window.scrollY); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const CATEGORIES = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);

  const openMega = () => { clearTimeout(megaTimer.current); setMegaOpen(true); };
  const closeMegaDelayed = () => { megaTimer.current = setTimeout(() => setMegaOpen(false), 150); };

  const goStore = () => { setView("store"); setActiveProduct(null); setMobileOpen(false); window.location.hash = ""; };
  const goAdmin = () => { setView("admin"); setMobileOpen(false); window.location.hash = "admin"; };

  const openProduct = (p) => { setActiveProduct(p); setView("product"); setMobileOpen(false); setSearchOpen(false); };

  const scrollToCatalog = (cat) => {
    setCategoryFilter(cat); goStore(); setMegaOpen(false);
    setTimeout(() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const triggerBump = () => { setBump(true); setTimeout(() => setBump(false), 500); };

  const addToCart = (product, color, size, image) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id && i.color === color && i.size === size);
      if (existing) return prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { id: product.id, name: product.name, price: product.price, color, size, qty: 1, image: image || (product.images || [])[0] }];
    });
    triggerBump();
  };

  const quickAdd = (product) => {
    if ((product.stock ?? 0) <= 0) return;
    const colors = parseColors(product);
    addToCart(product, colors[0]?.label, (product.sizes || [])[0], (product.images || [])[0]);
    setCartOpen(true);
  };

  const changeQty = (idx, delta) => setCart((prev) => prev.map((i, ix) => (ix === idx ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0));
  const removeItem = (idx) => setCart((prev) => prev.filter((_, ix) => ix !== idx));

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const count = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setComprobante({ name: file.name, dataUrl: reader.result });
    reader.readAsDataURL(file);
  };

  const joinLines = (arr) => arr.join("\n");
  const buildMessage = () => {
    const lines = cart.map((i) => `• ${i.name} — ${i.color}, talle ${i.size} x${i.qty} — ${money(i.price * i.qty)}`);
    const msg = [
      `Hola ${CONFIG.storeName}! Quiero confirmar un pedido y ya hice la transferencia.`, ``,
      `*Pedido:*`, ...lines, ``, `*Total: ${money(total)}*`, ``,
      `*Datos de contacto:*`, `Nombre: ${buyer.nombre}`, `Teléfono: ${buyer.telefono}`,
      `Entrega: ${buyer.entrega === "envio" ? "Envío a domicilio" : "Retiro"}`,
      buyer.entrega === "envio" ? `Dirección: ${buyer.direccion}` : null,
      buyer.notas ? `Notas: ${buyer.notas}` : null, ``,
      comprobante ? `Te adjunto el comprobante de la transferencia en este chat.` : `(Todavía no adjunté el comprobante, lo mando en este chat)`,
    ].filter(Boolean);
    return encodeURIComponent(joinLines(msg));
  };

  const handleConfirm = (e) => {
    e.preventDefault();
    if (!buyer.nombre || !buyer.telefono || (buyer.entrega === "envio" && !buyer.direccion)) return;
    window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${buildMessage()}`, "_blank");
    setView("confirmed");
  };

  const resetAll = () => {
    setCart([]); setBuyer({ nombre: "", telefono: "", entrega: "envio", direccion: "", notas: "" });
    setComprobante(null); goStore();
  };

  const filteredProducts = useMemo(() => (!categoryFilter ? products : products.filter((p) => p.category === categoryFilter)), [products, categoryFilter]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.tipo.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)).slice(0, 6);
  }, [query, products]);

  const headerTransparent = view === "store" && !scrolled && !mobileOpen;

  if (productsLoading) {
    return (
      <div className="app">
        <style>{`.app{font-family:'Inter',sans-serif;background:#F8F1E8;color:#5B4027;min-height:100vh;display:flex;align-items:center;justify-content:center;}
          .mini-spinner{width:16px;height:16px;border:2px solid rgba(91,64,39,0.25);border-top-color:#5B4027;border-radius:50%;display:inline-block;animation:spin .7s linear infinite;}
          @keyframes spin{to{transform:rotate(360deg);}}`}</style>
        <span className="mini-spinner" style={{ width: 26, height: 26, borderWidth: 3 }} />
      </div>
    );
  }
  if (productsError) {
    return (
      <div className="app" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 28 }}>
        <style>{`.app{font-family:'Inter',sans-serif;background:#F8F1E8;color:#5B4027;}`}</style>
        <div style={{ maxWidth: 440, textAlign: "center" }}>
          <h2 style={{ marginBottom: 12 }}>No se pudo conectar con la base de datos</h2>
          <p style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.6 }}>{productsError}</p>
          <p style={{ fontSize: 13, opacity: 0.6, marginTop: 14 }}>
            Revisá que existan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (en tu archivo .env local, o en
            las variables de entorno del proyecto en Vercel) y que la tabla "products" exista en Supabase.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,600;0,6..96,700&family=Inter:wght@400;500;600&display=swap');

        :root{
          --cream:#F8F1E8; --blush:#F4D8C4; --sand:#E6D0B8; --oat:#E9D7C4;
          --clay:#D6B090; --clay-2:#D0A080; --taupe:#A68A72; --umber:#8B6A4D;
          --walnut:#6F5030; --ink:#5B4027; --paper:var(--cream); --line:var(--clay);
          --serif:'Bodoni Moda', 'Didot', Georgia, serif; --ease:cubic-bezier(.22,1,.36,1);
        }
        *{box-sizing:border-box;}
        html{scroll-behavior:smooth;}
        .app{ font-family:'Inter',sans-serif; background:var(--paper); color:var(--ink); min-height:100vh; -webkit-font-smoothing:antialiased; overflow-x:hidden; }
        button{font-family:inherit; cursor:pointer;}
        button:disabled{ cursor:not-allowed; }
        a{color:inherit;}

        .reveal{ opacity:0; transform:translateY(26px); transition:opacity .6s var(--ease), transform .6s var(--ease); }
        .reveal.in{ opacity:1; transform:translateY(0); }

        .leather{ position:relative; overflow:hidden;
          background:
            radial-gradient(120% 140% at 20% -10%, rgba(255,255,255,0.10), transparent 55%),
            linear-gradient(155deg, color-mix(in srgb, var(--tint, #8a6642) 55%, #8a6642) 0%, #6f4e30 40%, #573b23 72%, #452e1a 100%);
        }
        .leather::before{
          content:""; position:absolute; inset:0;
          background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
          mix-blend-mode:overlay; opacity:0.35; pointer-events:none;
        }
        .leather::after{ content:""; position:absolute; inset:0; background:radial-gradient(160% 90% at 50% 0%, rgba(255,255,255,0.14), transparent 60%); mix-blend-mode:soft-light; pointer-events:none; }
        .stitch{ position:absolute; inset:7px; border:1px dashed rgba(248,241,232,0.35); border-radius:2px; pointer-events:none; }

        .media-wrap{ position:absolute; inset:0; }
        .media-photo{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:opacity .45s var(--ease), transform .5s var(--ease); }
        .photo-a{ opacity:1; } .photo-a.hide{ opacity:0; }
        .photo-b{ opacity:0; } .photo-b.show{ opacity:1; transform:scale(1.045); }

        /* ---------- Header ---------- */
        .header{ position:fixed; top:0; left:0; right:0; z-index:50; display:flex; align-items:center; justify-content:space-between; padding:22px 28px; transition:background .35s var(--ease), box-shadow .35s var(--ease), padding .35s var(--ease), border-color .35s var(--ease); background:transparent; border-bottom:1px solid transparent; }
        .header.solid{ background:rgba(248,241,232,0.96); backdrop-filter:blur(8px); border-bottom:1px solid var(--line); padding:14px 28px; box-shadow:0 6px 20px -12px rgba(69,46,26,0.25); }
        .header-side{ display:flex; align-items:center; gap:22px; flex:1; }
        .header-side.right{ justify-content:flex-end; }
        .hamburger{ display:none; background:none; border:none; }
        .logo{ font-family:var(--serif); font-weight:500; font-size:23px; letter-spacing:0.3em; text-transform:uppercase; background:none; border:none; padding:0; color:var(--hcolor,var(--cream)); transition:color .35s var(--ease); }
        .header.solid .logo{ --hcolor:var(--ink); }
        .nav{ display:flex; gap:30px; align-items:center; }
        .nav-item{ position:relative; }
        .nav-link{ background:none; border:none; font-size:11px; letter-spacing:0.16em; text-transform:uppercase; padding:6px 0; color:var(--hcolor,var(--cream)); transition:color .35s var(--ease); position:relative; }
        .header.solid .nav-link{ --hcolor:var(--ink); }
        .nav-link::after{ content:""; position:absolute; left:0; bottom:0; height:1px; width:0; background:currentColor; transition:width .3s var(--ease); }
        .nav-link:hover::after{ width:100%; }
        .mega{ position:absolute; top:100%; left:50%; transform:translate(-50%,8px); margin-top:18px; background:var(--cream); border:1px solid var(--line); box-shadow:0 20px 40px -14px rgba(69,46,26,0.3); padding:22px 26px; display:flex; gap:30px; opacity:0; pointer-events:none; transition:opacity .3s var(--ease), transform .3s var(--ease); white-space:nowrap; }
        .mega.open{ opacity:1; pointer-events:auto; transform:translate(-50%,0); }
        .mega-col button{ display:block; background:none; border:none; text-align:left; padding:6px 0; font-family:var(--serif); font-size:14px; letter-spacing:0.05em; color:var(--ink); text-transform:uppercase; transition:opacity .2s var(--ease); opacity:0.7; }
        .mega-col button:hover{ opacity:1; }
        .icon-row{ display:flex; align-items:center; gap:18px; }
        .icon-plain{ background:none; border:none; color:var(--hcolor,var(--cream)); transition:color .35s var(--ease), transform .2s var(--ease); position:relative; display:flex; }
        .header.solid .icon-plain{ --hcolor:var(--ink); }
        .icon-plain:hover{ transform:translateY(-1px); }
        .cart-dot{ position:absolute; top:-7px; right:-8px; background:var(--ink); color:var(--cream); font-size:9px; width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Inter',sans-serif; transition:transform .3s var(--ease); }
        .cart-dot.bump{ transform:scale(1.4); }

        .search-panel{ position:fixed; top:0; left:0; right:0; z-index:60; background:var(--cream); border-bottom:1px solid var(--line); overflow:hidden; max-height:0; transition:max-height .4s var(--ease); box-shadow:0 20px 40px -20px rgba(69,46,26,0.3); }
        .search-panel.open{ max-height:420px; }
        .search-inner{ max-width:720px; margin:0 auto; padding:34px 28px; }
        .search-input-row{ display:flex; align-items:center; gap:14px; border-bottom:1px solid var(--line); padding-bottom:14px; }
        .search-input-row input{ flex:1; border:none; background:transparent; font-family:var(--serif); font-size:22px; letter-spacing:0.02em; color:var(--ink); outline:none; }
        .search-results{ margin-top:20px; display:flex; flex-direction:column; gap:4px; }
        .search-result{ display:flex; justify-content:space-between; align-items:center; padding:10px 4px; background:none; border:none; text-align:left; border-radius:2px; transition:background .2s var(--ease); }
        .search-result:hover{ background:var(--oat); }
        .search-result-name{ font-family:var(--serif); font-size:14px; text-transform:uppercase; letter-spacing:0.04em; }
        .search-result-meta{ font-size:11px; color:var(--taupe); }
        .search-empty{ font-size:12px; color:var(--taupe); margin-top:18px; }

        .mobile-nav{ position:fixed; inset:0; background:var(--cream); z-index:55; padding:100px 32px 40px; transform:translateX(100%); transition:transform .4s var(--ease); display:flex; flex-direction:column; gap:4px; }
        .mobile-nav.open{ transform:translateX(0); }
        .mobile-nav button{ background:none; border:none; text-align:left; font-family:var(--serif); font-size:26px; text-transform:uppercase; letter-spacing:0.05em; padding:14px 0; border-bottom:1px solid var(--line); color:var(--ink); }

        .hero{ position:relative; height:92vh; min-height:560px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .hero-bg{ position:absolute; inset:-8% -4%; }
        .hero-content{ position:relative; z-index:2; text-align:center; color:var(--cream); padding:0 24px; }
        .hero-eyebrow{ font-size:11px; letter-spacing:0.4em; text-transform:uppercase; margin-bottom:22px; opacity:0.85; }
        .hero h1{ font-family:var(--serif); font-size:clamp(38px,7vw,74px); font-weight:500; text-transform:uppercase; letter-spacing:0.05em; line-height:1.08; margin:0 0 22px; }
        .hero p{ font-size:15px; max-width:440px; margin:0 auto 34px; opacity:0.85; line-height:1.7; }
        .hero-cta{ position:relative; overflow:hidden; border:1px solid var(--cream); background:transparent; color:var(--cream); padding:15px 36px; font-size:11px; letter-spacing:0.2em; text-transform:uppercase; }
        .hero-cta span{ position:relative; z-index:1; transition:color .35s var(--ease); }
        .hero-cta::before{ content:""; position:absolute; inset:0; background:var(--cream); transform:scaleX(0); transform-origin:left; transition:transform .35s var(--ease); }
        .hero-cta:hover::before{ transform:scaleX(1); }
        .hero-cta:hover span{ color:var(--ink); }
        .hero-scroll{ position:absolute; bottom:34px; left:50%; transform:translateX(-50%); z-index:2; width:1px; height:46px; background:rgba(248,241,232,0.5); overflow:hidden; }
        .hero-scroll::after{ content:""; position:absolute; top:-100%; left:0; width:100%; height:100%; background:var(--cream); animation:scrollLine 1.8s var(--ease) infinite; }
        @keyframes scrollLine{ to{ top:100%; } }

        .section-label{ font-size:11px; letter-spacing:0.28em; text-transform:uppercase; color:var(--taupe); padding:0 28px; max-width:1200px; margin:0 auto; display:block; margin-bottom:20px; font-weight:600; }
        .strip{ padding:90px 28px 20px; max-width:1200px; margin:0 auto; text-align:center; }
        .strip h2{ font-family:var(--serif); font-size:clamp(26px,4vw,38px); text-transform:uppercase; letter-spacing:0.05em; color:var(--ink); margin:0 0 14px; }
        .strip p{ max-width:480px; margin:0 auto; font-size:14px; line-height:1.7; opacity:0.75; }

        .filters{ display:flex; gap:10px; flex-wrap:wrap; padding:0 28px; max-width:1200px; margin:0 auto 30px; }
        .filter-chip{ border:1px solid var(--line); background:transparent; padding:8px 16px; border-radius:20px; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:var(--ink); transition:all .25s var(--ease); }
        .filter-chip.active{ background:var(--ink); color:var(--cream); border-color:var(--ink); }

        .catalog{ padding:0 28px 100px; display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:30px 26px; max-width:1200px; margin:0 auto; }
        .related-grid{ padding:0; margin-top:10px; }

        .pcard{ cursor:pointer; }
        .pcard-media{ position:relative; height:340px; border-radius:2px; overflow:hidden; box-shadow:inset 0 1px 0 rgba(255,255,255,0.12); }
        .pcard:hover .media-photo{ transform:scale(1.045); }
        .pcard-ref{ position:absolute; bottom:14px; left:14px; z-index:2; font-family:var(--serif); font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:rgba(248,241,232,0.85); }
        .stock-badge{ position:absolute; top:14px; left:14px; z-index:2; background:rgba(35,31,28,0.85); color:var(--cream); font-size:9px; letter-spacing:0.12em; text-transform:uppercase; padding:5px 9px; border-radius:2px; }
        .pcard-actions{ position:absolute; bottom:0; left:0; right:0; z-index:2; padding:14px; display:flex; justify-content:center; transform:translateY(14px); opacity:0; transition:opacity .3s var(--ease), transform .3s var(--ease); }
        .pcard-actions.show{ opacity:1; transform:translateY(0); }
        .quick-add{ background:var(--cream); color:var(--ink); border:none; padding:11px 20px; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; border-radius:1px; box-shadow:0 8px 20px -8px rgba(0,0,0,0.4); }
        .quick-add:hover{ background:var(--oat); }
        .quick-add:disabled{ opacity:0.5; }
        .pcard-info{ padding-top:16px; }
        .pcard-cat{ font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:var(--taupe); margin-bottom:6px; font-weight:600; }
        .pcard-name{ font-family:var(--serif); font-size:19px; text-transform:uppercase; letter-spacing:0.04em; margin:0 0 3px; color:var(--ink); }
        .pcard-tipo{ font-size:12px; opacity:0.65; margin-bottom:10px; }
        .pcard-bottom{ display:flex; justify-content:space-between; align-items:center; }
        .pcard-price{ font-family:var(--serif); font-size:15px; color:var(--umber); letter-spacing:0.02em; }
        .pcard-colors{ display:flex; gap:5px; }

        .detail-wrap{ max-width:1200px; margin:0 auto; padding:150px 28px 100px; }
        .back-link{ display:flex; align-items:center; gap:6px; background:none; border:none; font-size:12px; letter-spacing:0.08em; color:var(--taupe); margin-bottom:36px; padding:0; }
        .detail-grid{ display:grid; grid-template-columns:1.1fr 1fr; gap:60px; }
        .gallery-main{ height:520px; border-radius:2px; margin-bottom:14px; box-shadow:inset 0 1px 0 rgba(255,255,255,0.12); }
        .gallery-main-img{ width:100%; height:520px; object-fit:cover; border-radius:2px; margin-bottom:14px; }
        .gallery-thumbs{ display:flex; gap:12px; }
        .thumb{ width:74px; height:90px; border-radius:2px; border:2px solid transparent; opacity:0.6; transition:opacity .25s var(--ease), border-color .25s var(--ease); overflow:hidden; padding:0; }
        .thumb.active{ opacity:1; border-color:var(--ink); }
        .thumb.img-thumb img{ width:100%; height:100%; object-fit:cover; }
        .detail-name{ font-family:var(--serif); font-size:38px; text-transform:uppercase; letter-spacing:0.04em; margin:4px 0 4px; }
        .detail-tipo{ font-size:14px; opacity:0.65; margin-bottom:14px; }
        .detail-price{ font-family:var(--serif); font-size:22px; color:var(--umber); margin-bottom:30px; }
        .add-cta{ position:relative; overflow:hidden; width:100%; border:none; color:var(--cream); padding:18px; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; border-radius:1px; margin-top:8px; }
        .add-cta:disabled{ opacity:0.45; }
        .add-cta-label{ position:relative; z-index:1; display:flex; align-items:center; justify-content:center; gap:8px; transition:opacity .25s var(--ease), transform .25s var(--ease); }
        .add-cta-label.default{ opacity:1; }
        .add-cta-label.success{ position:absolute; inset:0; align-items:center; opacity:0; transform:translateY(8px); }
        .add-cta.added .add-cta-label.default{ opacity:0; transform:translateY(-8px); }
        .add-cta.added .add-cta-label.success{ opacity:1; transform:translateY(0); }
        .detail-meta{ margin-top:30px; border-top:1px solid var(--line); padding-top:20px; }
        .detail-meta p{ font-size:13px; line-height:1.8; opacity:0.75; margin:0 0 8px; }
        .related{ margin-top:110px; }

        .opt-label{ font-size:10px; text-transform:uppercase; letter-spacing:0.16em; color:var(--taupe); margin-bottom:8px; font-weight:600; }
        .tag-colors{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px; }
        .color-btn{ display:flex; align-items:center; gap:6px; border:1px solid var(--line); background:transparent; padding:6px 12px 6px 7px; border-radius:20px; font-size:11px; letter-spacing:0.03em; transition:border-color .2s var(--ease), background .2s var(--ease); }
        .color-btn.active{ border-color:var(--ink); background:var(--oat); }
        .swatch-dot{ border-radius:50%; display:inline-block; border:1px solid rgba(0,0,0,0.2); overflow:hidden; box-shadow:inset 0 0 0 1px rgba(255,255,255,0.25); }
        .swatch-dot.split{ display:flex; padding:0; }
        .swatch-dot.split span{ flex:1; }
        .tag-sizes{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }
        .size-btn{ border:1px solid var(--line); background:transparent; padding:8px 14px; font-size:12px; border-radius:1px; font-family:var(--serif); letter-spacing:0.04em; transition:all .2s var(--ease); }
        .size-btn.active{ background:var(--ink); color:var(--cream); border-color:var(--ink); }
        .tag-error{ font-size:11px; color:#93331b; margin-bottom:10px; }

        .overlay{ position:fixed; inset:0; background:rgba(91,64,39,0.4); z-index:70; opacity:0; animation:fadeIn .3s var(--ease) forwards; }
        @keyframes fadeIn{ to{ opacity:1; } }
        .drawer{ position:fixed; top:0; right:0; height:100%; width:min(420px,100%); background:var(--cream); z-index:71; display:flex; flex-direction:column; box-shadow:-10px 0 34px rgba(91,64,39,0.2); transform:translateX(100%); animation:slideIn .38s var(--ease) forwards; }
        @keyframes slideIn{ to{ transform:translateX(0); } }
        .drawer-head{ padding:26px 26px 20px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; }
        .drawer-head h2{ font-family:var(--serif); font-size:20px; margin:0; color:var(--ink); text-transform:uppercase; letter-spacing:0.12em; font-weight:500; }
        .icon-btn{ background:none; border:none; padding:4px; display:flex; color:var(--ink); }
        .drawer-items{ flex:1; overflow-y:auto; padding:14px 26px; }
        .cart-item{ display:flex; gap:14px; padding:16px 0; border-bottom:1px solid var(--oat); animation:fadeIn .35s var(--ease); }
        .cart-swatch{ width:50px; height:64px; border-radius:2px; flex-shrink:0; object-fit:cover; }
        .cart-item-info{ flex:1; }
        .cart-item-name{ font-family:var(--serif); font-size:15px; letter-spacing:0.02em; text-transform:uppercase; margin-bottom:3px; }
        .cart-item-size{ font-size:11px; color:var(--taupe); letter-spacing:0.03em; }
        .qty-row{ display:flex; align-items:center; gap:10px; margin-top:10px; flex-wrap:wrap; }
        .qty-btn{ width:24px; height:24px; border:1px solid var(--line); background:transparent; display:flex; align-items:center; justify-content:center; border-radius:2px; transition:background .2s var(--ease); }
        .qty-btn:hover{ background:var(--oat); }
        .qty-val{ font-size:13px; min-width:16px; text-align:center; }
        .cart-item-price{ font-family:var(--serif); font-size:13px; }
        .remove-x{ background:none; border:none; color:var(--taupe); font-size:11px; text-decoration:underline; margin-left:auto; }
        .empty-cart{ padding:60px 0; text-align:center; color:var(--taupe); font-size:13px; }
        .drawer-foot{ padding:22px 26px; border-top:1px solid var(--line); }
        .total-row{ display:flex; justify-content:space-between; margin-bottom:16px; font-size:14px; }
        .total-row strong{ font-family:var(--serif); font-size:19px; color:var(--ink); }
        .checkout-btn{ position:relative; overflow:hidden; width:100%; color:var(--cream); border:none; padding:16px; font-size:11px; font-weight:600; border-radius:1px; letter-spacing:0.18em; text-transform:uppercase; }
        .checkout-btn > *{ position:relative; z-index:1; }
        .checkout-btn:disabled{ opacity:0.4; cursor:not-allowed; }

        .checkout-wrap{ max-width:640px; margin:0 auto; padding:150px 28px 100px; }
        .checkout-wrap h2{ font-family:var(--serif); font-size:30px; margin:0 0 8px; color:var(--ink); text-transform:uppercase; letter-spacing:0.06em; font-weight:500; }
        .checkout-sub{ color:var(--ink); opacity:0.75; font-size:14px; margin-bottom:32px; }
        .bank-box{ background:var(--blush); border:1px solid var(--clay-2); border-radius:2px; padding:22px; margin-bottom:32px; }
        .bank-box h3{ font-family:var(--serif); font-size:12px; text-transform:uppercase; letter-spacing:0.22em; margin:0 0 14px; color:var(--ink); font-weight:500; }
        .bank-row{ display:flex; justify-content:space-between; font-size:14px; padding:6px 0; border-bottom:1px dashed rgba(111,80,48,0.25); }
        .bank-row:last-child{ border-bottom:none; }
        .bank-row span:first-child{ color:var(--ink); opacity:0.75; }
        .bank-row span:last-child{ font-weight:600; color:var(--ink); }
        .field{ margin-bottom:18px; }
        .field label{ display:block; font-size:13px; font-weight:600; margin-bottom:6px; }
        .field input, .field textarea{ width:100%; border:1px solid var(--line); background:var(--cream); padding:12px 13px; font-family:inherit; font-size:14px; border-radius:2px; color:var(--ink); transition:border-color .2s var(--ease); }
        .field input:focus, .field textarea:focus{ outline:none; border-color:var(--ink); }
        .radio-row{ display:flex; gap:16px; }
        .radio-opt{ display:flex; align-items:center; gap:6px; font-size:14px; }
        .upload-box{ border:1px dashed var(--line); border-radius:3px; padding:22px; text-align:center; margin-bottom:26px; cursor:pointer; transition:border-color .2s var(--ease); }
        .upload-box:hover{ border-color:var(--umber); }
        .upload-box p{ font-size:13px; color:var(--taupe); margin:8px 0 0; }
        .comprobante-preview{ display:flex; align-items:center; gap:10px; font-size:13px; justify-content:center; }
        .comprobante-preview img{ width:44px; height:44px; object-fit:cover; border-radius:2px; }
        .submit-btn{ position:relative; overflow:hidden; width:100%; color:var(--cream); border:none; padding:18px; font-size:11px; font-weight:600; letter-spacing:0.18em; text-transform:uppercase; border-radius:1px; display:flex; align-items:center; justify-content:center; gap:10px; }
        .submit-btn > *{ position:relative; z-index:1; }
        .whatsapp-note{ font-size:12px; color:var(--taupe); margin-top:14px; line-height:1.6; }

        .confirmed-wrap{ max-width:480px; margin:0 auto; padding:190px 28px 120px; text-align:center; }
        .check-circle{ width:58px; height:58px; border-radius:50%; color:var(--cream); display:flex; align-items:center; justify-content:center; margin:0 auto 26px; }
        .confirmed-wrap h2{ font-family:var(--serif); font-size:26px; margin:0 0 14px; color:var(--ink); text-transform:uppercase; letter-spacing:0.08em; font-weight:500; }
        .confirmed-wrap p{ color:var(--ink); opacity:0.75; font-size:14px; line-height:1.6; margin-bottom:28px; }
        .new-order-btn{ background:transparent; border:1px solid var(--ink); padding:13px 26px; border-radius:1px; font-size:11px; font-weight:600; color:var(--ink); letter-spacing:0.14em; text-transform:uppercase; }

        .footer{ border-top:1px solid var(--line); padding:40px 28px; text-align:center; font-family:var(--serif); font-size:11px; letter-spacing:0.14em; color:var(--taupe); text-transform:uppercase; }
        .footer-admin-link{ background:none; border:none; color:var(--taupe); font-family:var(--serif); font-size:11px; letter-spacing:0.14em; text-transform:uppercase; text-decoration:underline; margin-left:14px; }

        /* ---------- Admin ---------- */
        .admin-lock{ min-height:100vh; display:flex; align-items:center; justify-content:center; padding:28px; }
        .admin-lock-box{ max-width:360px; text-align:center; }
        .admin-lock-box h2{ font-family:var(--serif); font-size:22px; text-transform:uppercase; letter-spacing:0.06em; margin:16px 0 8px; }
        .admin-lock-box p{ font-size:13px; opacity:0.7; margin-bottom:22px; }
        .admin-lock-box input{ width:100%; border:1px solid var(--line); background:var(--cream); padding:12px 13px; font-size:14px; border-radius:2px; margin-bottom:14px; color:var(--ink); }
        .admin-lock-box .back-link{ justify-content:center; margin-top:22px; }

        .admin-wrap{ max-width:1100px; margin:0 auto; padding:60px 28px 100px; }
        .admin-head{ display:flex; justify-content:space-between; align-items:flex-start; gap:20px; margin-bottom:34px; flex-wrap:wrap; }
        .admin-head h2{ font-family:var(--serif); font-size:26px; text-transform:uppercase; letter-spacing:0.05em; margin:0 0 8px; }
        .admin-list{ display:flex; flex-direction:column; gap:18px; margin-bottom:50px; }
        .admin-row{ border:1px solid var(--line); border-radius:2px; padding:16px; display:grid; grid-template-columns:auto 1fr auto; gap:18px; align-items:center; background:var(--cream); }
        .admin-row-imgs{ display:flex; gap:8px; flex-wrap:wrap; max-width:160px; }
        .admin-thumb{ position:relative; width:44px; height:54px; border-radius:2px; overflow:hidden; border:1px solid var(--line); }
        .admin-thumb img{ width:100%; height:100%; object-fit:cover; }
        .admin-thumb button{ position:absolute; top:1px; right:1px; background:rgba(35,31,28,0.75); border:none; color:var(--cream); border-radius:50%; width:14px; height:14px; display:flex; align-items:center; justify-content:center; }
        .admin-thumb.add{ display:flex; align-items:center; justify-content:center; background:var(--oat); color:var(--taupe); border-style:dashed; }
        .admin-fields{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
        .admin-fields-new{ grid-template-columns:repeat(4,1fr); }
        .admin-input{ border:1px solid var(--line); background:var(--paper); padding:9px 11px; font-size:12px; border-radius:2px; color:var(--ink); font-family:'Inter',sans-serif; }
        .admin-input:focus{ outline:none; border-color:var(--ink); }
        .admin-row-actions{ display:flex; flex-direction:column; gap:8px; }
        .admin-save{ display:flex; align-items:center; gap:6px; justify-content:center; background:var(--ink); color:var(--cream); border:none; padding:9px 14px; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; border-radius:1px; }
        .admin-save:disabled{ opacity:0.35; cursor:not-allowed; }
        .admin-save.wide{ width:100%; padding:13px; margin-top:4px; }
        .admin-del{ display:flex; align-items:center; gap:6px; justify-content:center; background:none; color:#93331b; border:1px solid #93331b; padding:8px 14px; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; border-radius:1px; }
        .admin-new{ border-top:1px solid var(--line); padding-top:34px; }
        .admin-new h3{ font-family:var(--serif); font-size:18px; text-transform:uppercase; letter-spacing:0.06em; margin:0 0 18px; }
        .mini-spinner{ width:14px; height:14px; border:2px solid rgba(91,64,39,0.25); border-top-color:var(--ink); border-radius:50%; display:inline-block; animation:spin .7s linear infinite; }
        @keyframes spin{ to{ transform:rotate(360deg); } }

        @media (max-width:860px){
          .nav{ display:none; }
          .hamburger{ display:flex; }
          .detail-grid{ grid-template-columns:1fr; gap:34px; }
          .detail-wrap, .checkout-wrap, .confirmed-wrap{ padding-top:120px; }
          .admin-row{ grid-template-columns:1fr; }
          .admin-fields, .admin-fields-new{ grid-template-columns:1fr 1fr; }
        }
      `}</style>

      {view !== "admin" && (
        <>
          <header className={`header ${headerTransparent ? "" : "solid"}`}>
            <div className="header-side">
              <button className="hamburger icon-plain" onClick={() => setMobileOpen(true)}><Menu size={22} /></button>
              <nav className="nav">
                <div className="nav-item" onMouseEnter={openMega} onMouseLeave={closeMegaDelayed}>
                  <button className="nav-link" onClick={openMega}>Colección</button>
                  <div className={`mega ${megaOpen ? "open" : ""}`} onMouseEnter={openMega} onMouseLeave={closeMegaDelayed}>
                    <div className="mega-col">
                      <button onClick={() => scrollToCatalog(null)}>Ver todo</button>
                      {CATEGORIES.map((c) => <button key={c} onClick={() => scrollToCatalog(c)}>{c}</button>)}
                    </div>
                  </div>
                </div>
                <button className="nav-link" onClick={() => scrollToCatalog(null)}>Novedades</button>
                <button className="nav-link" onClick={() => document.getElementById("marca")?.scrollIntoView({ behavior: "smooth" })}>La marca</button>
              </nav>
            </div>

            <button className="logo" onClick={goStore}>{CONFIG.storeName}</button>

            <div className="header-side right">
              <div className="icon-row">
                <button className="icon-plain" onClick={() => setSearchOpen((s) => !s)}><Search size={18} /></button>
                <button className="icon-plain"><User size={18} /></button>
                <button className="icon-plain" onClick={() => setCartOpen(true)}>
                  <ShoppingBag size={18} />
                  {count > 0 && <span className={`cart-dot ${bump ? "bump" : ""}`}>{count}</span>}
                </button>
              </div>
            </div>
          </header>

          <div className={`search-panel ${searchOpen ? "open" : ""}`}>
            <div className="search-inner">
              <div className="search-input-row">
                <Search size={18} />
                <input autoFocus={searchOpen} placeholder="Buscar prendas…" value={query} onChange={(e) => setQuery(e.target.value)} />
                <button className="icon-plain" style={{ color: "var(--ink)" }} onClick={() => setSearchOpen(false)}><X size={18} /></button>
              </div>
              {query.trim() && (
                <div className="search-results">
                  {searchResults.length === 0 && <div className="search-empty">Sin resultados para "{query}"</div>}
                  {searchResults.map((p) => (
                    <button key={p.id} className="search-result" onClick={() => { openProduct(p); setSearchOpen(false); setQuery(""); }}>
                      <span className="search-result-name">{p.name}</span>
                      <span className="search-result-meta">{p.category} · {money(p.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`mobile-nav ${mobileOpen ? "open" : ""}`}>
            <button className="icon-plain" style={{ color: "var(--ink)", alignSelf: "flex-end", marginBottom: 20 }} onClick={() => setMobileOpen(false)}><X size={24} /></button>
            <button onClick={() => scrollToCatalog(null)}>Ver todo</button>
            {CATEGORIES.map((c) => <button key={c} onClick={() => scrollToCatalog(c)}>{c}</button>)}
          </div>
        </>
      )}

      {view === "store" && (
        <>
          <section className="hero">
            <div className="hero-bg leather" style={{ transform: `translateY(${scrollY * 0.28}px)` }} />
            <div className="hero-content">
              <div className="hero-eyebrow">Colección de temporada</div>
              <h1>{CONFIG.tagline}</h1>
              <p>Sweaters, poleras y básicos de punto en colores tierra, pensados para durar temporada tras temporada.</p>
              <button className="hero-cta" onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}><span>Ver colección</span></button>
            </div>
            <div className="hero-scroll" />
          </section>

          <div className="strip" id="marca">
            <Reveal><h2>Tejido con intención</h2></Reveal>
            <Reveal delay={100}><p>Cada prenda de {CONFIG.storeName} se piensa como una pieza de guardarropa duradera: materiales nobles, colores tierra y una paleta que envejece bien.</p></Reveal>
          </div>

          <Reveal as="span" className="section-label" delay={0}>
            <span id="catalogo" style={{ display: "block", paddingTop: 70 }}>Catálogo{categoryFilter ? ` — ${categoryFilter}` : ""}</span>
          </Reveal>

          <div className="filters">
            <button className={`filter-chip ${!categoryFilter ? "active" : ""}`} onClick={() => setCategoryFilter(null)}>Todo</button>
            {CATEGORIES.map((c) => <button key={c} className={`filter-chip ${categoryFilter === c ? "active" : ""}`} onClick={() => setCategoryFilter(c)}>{c}</button>)}
          </div>

          <div className="catalog">
            {filteredProducts.map((p, i) => <ProductCard key={p.id} product={p} onOpen={openProduct} onQuickAdd={quickAdd} delay={(i % 6) * 70} />)}
          </div>

          <footer className="footer">
            {CONFIG.storeName}
            <button className="footer-admin-link" onClick={goAdmin}>Administrar productos</button>
          </footer>
        </>
      )}

      {view === "product" && activeProduct && (
        <ProductDetail product={activeProduct} allProducts={products} onBack={goStore} onAdd={addToCart} onOpenRelated={openProduct} />
      )}

      {view === "checkout" && (
        <div className="checkout-wrap">
          <button className="back-link" onClick={goStore}><ArrowLeft size={14} /> Seguir comprando</button>
          <h2>Finalizar pedido</h2>
          <p className="checkout-sub">Hacé la transferencia con los datos de abajo y completá tus datos. Al confirmar se abre WhatsApp con el pedido armado para que lo envíes.</p>

          <div className="bank-box">
            <h3>Datos para transferir</h3>
            <div className="bank-row"><span>Titular</span><span>{CONFIG.bank.titular}</span></div>
            <div className="bank-row"><span>Alias</span><span>{CONFIG.bank.alias}</span></div>
            <div className="bank-row"><span>CBU</span><span>{CONFIG.bank.cbu}</span></div>
            <div className="bank-row"><span>Total a transferir</span><span>{money(total)}</span></div>
          </div>

          <form onSubmit={handleConfirm}>
            <div className="field"><label>Nombre y apellido</label><input value={buyer.nombre} onChange={(e) => setBuyer({ ...buyer, nombre: e.target.value })} placeholder="Ej: Julieta Gómez" required /></div>
            <div className="field"><label>Teléfono de contacto</label><input value={buyer.telefono} onChange={(e) => setBuyer({ ...buyer, telefono: e.target.value })} placeholder="Ej: 221 5 123456" required /></div>
            <div className="field">
              <label>Forma de entrega</label>
              <div className="radio-row">
                <label className="radio-opt"><input type="radio" checked={buyer.entrega === "envio"} onChange={() => setBuyer({ ...buyer, entrega: "envio" })} /> Envío</label>
                <label className="radio-opt"><input type="radio" checked={buyer.entrega === "retiro"} onChange={() => setBuyer({ ...buyer, entrega: "retiro" })} /> Retiro</label>
              </div>
            </div>
            {buyer.entrega === "envio" && (
              <div className="field"><label>Dirección de envío</label><input value={buyer.direccion} onChange={(e) => setBuyer({ ...buyer, direccion: e.target.value })} placeholder="Calle, número, ciudad" required /></div>
            )}
            <div className="field"><label>Notas (opcional)</label><textarea rows={3} value={buyer.notas} onChange={(e) => setBuyer({ ...buyer, notas: e.target.value })} placeholder="Referencias de entrega, horarios, etc." /></div>

            <input type="file" accept="image/*" ref={fileRef} onChange={handleFile} style={{ display: "none" }} />
            <div className="upload-box" onClick={() => fileRef.current?.click()}>
              {comprobante ? (
                <div className="comprobante-preview"><img src={comprobante.dataUrl} alt="comprobante" /><span>{comprobante.name} — cargado</span></div>
              ) : (
                <><Upload size={20} style={{ margin: "0 auto" }} /><p>Adjuntar comprobante de transferencia (opcional acá)</p></>
              )}
            </div>

            <button type="submit" className="submit-btn leather">
              <ShoppingBag size={15} />
              <span>Confirmar y avisar por WhatsApp</span>
            </button>
            <p className="whatsapp-note">
              Nota: WhatsApp no permite adjuntar imágenes automáticamente desde un link. Se va a abrir el chat con
              todo el pedido y los datos ya escritos — el comprobante que subiste acá lo tenés que reenviar
              manualmente en ese mismo chat.
            </p>
          </form>
        </div>
      )}

      {view === "confirmed" && (
        <div className="confirmed-wrap">
          <div className="check-circle leather"><Check size={24} style={{ position: "relative", zIndex: 1 }} /></div>
          <h2>¡Pedido enviado!</h2>
          <p>Se abrió WhatsApp con el detalle de tu pedido. No te olvides de adjuntar ahí la foto o captura del comprobante de la transferencia para que podamos confirmarlo.</p>
          <button className="new-order-btn" onClick={resetAll}>Hacer otro pedido</button>
        </div>
      )}

      {view === "admin" && <AdminPage products={products} setProducts={setProducts} onExit={goStore} />}

      {cartOpen && (
        <>
          <div className="overlay" onClick={() => setCartOpen(false)} />
          <div className="drawer">
            <div className="drawer-head">
              <h2>Tu carrito</h2>
              <button className="icon-btn" onClick={() => setCartOpen(false)}><X size={20} /></button>
            </div>
            <div className="drawer-items">
              {cart.length === 0 && <div className="empty-cart">Todavía no agregaste productos</div>}
              {cart.map((item, idx) => (
                <div className="cart-item" key={idx}>
                  {item.image ? (
                    <img src={item.image} className="cart-swatch" alt={item.name} />
                  ) : (
                    <div className="cart-swatch leather" style={{ "--tint": COLOR_HEX[splitColors(item.color || "")[0]] || "#6f4e30" }} />
                  )}
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-size">{item.color} · Talle {item.size}</div>
                    <div className="qty-row">
                      <button className="qty-btn" onClick={() => changeQty(idx, -1)}><Minus size={12} /></button>
                      <span className="qty-val">{item.qty}</span>
                      <button className="qty-btn" onClick={() => changeQty(idx, 1)}><Plus size={12} /></button>
                      <span className="cart-item-price">{money(item.price * item.qty)}</span>
                      <button className="remove-x" onClick={() => removeItem(idx)}>quitar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="drawer-foot">
              <div className="total-row"><span>Total</span><strong>{money(total)}</strong></div>
              <button className="checkout-btn leather" disabled={cart.length === 0} onClick={() => { setCartOpen(false); setView("checkout"); }}>
                <span>Ir a finalizar pedido</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
