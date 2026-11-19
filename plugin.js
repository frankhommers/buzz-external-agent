// node_modules/@noble/hashes/_u64.js
var U32_MASK64 = /* @__PURE__ */ (() => BigInt(2 ** 32 - 1))();
var _32n = /* @__PURE__ */ BigInt(32);
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  const len = lst.length;
  let Ah = new Uint32Array(len);
  let Al = new Uint32Array(len);
  for (let i = 0;i < len; i++) {
    const { h, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var fromNumH = (n) => n / 2 ** 32 | 0;
var fromNumL = (n) => n >>> 0;
function setU64FromNum(view, byteOffset, n, isLE) {
  const h = fromNumH(n);
  const l = fromNumL(n);
  view.setUint32(byteOffset, isLE ? l : h, isLE);
  view.setUint32(byteOffset + 4, isLE ? h : l, isLE);
}
var shrSH = (h, _l, s) => h >>> s;
var shrSL = (h, l, s) => h << 32 - s | l >>> s;
var rotrSH = (h, l, s) => h >>> s | l << 32 - s;
var rotrSL = (h, l, s) => h << 32 - s | l >>> s;
var rotrBH = (h, l, s) => h << 64 - s | l >>> s - 32;
var rotrBL = (h, l, s) => h >>> s - 32 | l << 64 - s;
function add(Ah, Al, Bh, Bl) {
  const l = (Al >>> 0) + (Bl >>> 0);
  return { h: Ah + Bh + (l / 2 ** 32 | 0) | 0, l: l | 0 };
}
var add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
var add3H = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0;
var add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
var add4H = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0;
var add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
var add5H = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;

// node_modules/@noble/hashes/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
var atitle = (title) => title ? `"${title}" ` : "";
function anumber(n, title = "") {
  if (typeof n !== "number")
    throw new TypeError(atitle(title) + "expected number, got " + typeof n);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError(atitle(title) + "expected integer >= 0, got " + n);
  return n;
}
function abytes(value, length, title = "") {
  if (isBytes(value) && (length === undefined || value.length === length))
    return value;
  if (length !== undefined)
    anumber(length, "length");
  const bytes = isBytes(value);
  const ofLen = length !== undefined ? ` of length ${length}` : "";
  const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
  const message = atitle(title) + "expected Uint8Array" + ofLen + ", got " + got;
  if (!bytes)
    throw new TypeError(message);
  throw new RangeError(message);
}
function ahash(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new TypeError("expected hash wrapped by utils.createHasher");
  anumber(h.outputLen);
  anumber(h.blockLen);
  if (h.outputLen < 1 || h.blockLen < 1)
    throw new Error("hash blockLen / outputLen must be >= 1");
}
var aobject = (value, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError((label === "object" ? "" : `"${label}" `) + "expected object, got type=" + typeof value);
};
var aopts = (value, label) => {
  aobject(value, label);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null)
    throw new TypeError(`"${label}" expected plain object`);
  if (Object.hasOwn(value, "__proto__"))
    throw new TypeError(`"${label}.__proto__" is not allowed`);
};
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("hash was destroyed");
  if (checkFinished && instance.finished)
    throw new Error("digest() was already called");
}
function aoutput(out, instance) {
  abytes(out, undefined, "output");
  const min = instance.outputLen;
  if (!(out.length >= min)) {
    throw new RangeError('"output" expected length >= ' + min);
  }
}
function u32(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean(...arrays) {
  for (let i = 0;i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr(word, shift) {
  return word << 32 - shift | word >>> shift;
}
function rotl(word, shift) {
  return word << shift | word >>> 32 - shift >>> 0;
}
var isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
function byteSwap(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
function byteSwap32(arr) {
  for (let i = 0;i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
  return arr;
}
var swap32IfBE = isLE ? (u) => u : byteSwap32;
var hasHexBuiltin = /* @__PURE__ */ (() => typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function")();
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex(bytes) {
  abytes(bytes);
  if (hasHexBuiltin)
    return bytes.toHex();
  let hex = "";
  for (let i = 0;i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
function asciiToBase16(ch) {
  return ch >= 48 && ch <= 57 ? ch - 48 : ch >= 65 && ch <= 70 ? ch - (65 - 10) : ch >= 97 && ch <= 102 ? ch - (97 - 10) : undefined;
}
function hexToBytes(hex) {
  if (typeof hex !== "string")
    throw new TypeError("hex string expected, got " + typeof hex);
  if (hasHexBuiltin) {
    try {
      return Uint8Array.fromHex(hex);
    } catch (error) {
      if (error instanceof SyntaxError)
        throw new RangeError(error.message);
      throw error;
    }
  }
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    throw new RangeError("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0;ai < al; ai++, hi += 2) {
    const n1 = asciiToBase16(hex.charCodeAt(hi));
    const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
    if (n1 === undefined || n2 === undefined) {
      const char = hex[hi] + hex[hi + 1];
      throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new TypeError("string expected");
  const encoded = new TextEncoder().encode(str);
  try {
    return new Uint8Array(encoded);
  } finally {
    clean(encoded);
  }
}
function kdfInputToBytes(data, errorTitle = "") {
  if (typeof data === "string")
    return utf8ToBytes(data);
  return abytes(data, undefined, errorTitle);
}
function concatBytes(...arrays) {
  let sum = 0;
  for (let i = 0;i < arrays.length; i++) {
    const a = arrays[i];
    abytes(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0;i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
function checkOpts(defaults, opts, title = "opts") {
  aopts(defaults, "defaults");
  if (opts !== undefined)
    aopts(opts, title);
  const merged = Object.assign(Object.create(null), defaults, opts);
  return merged;
}
function createHasher(hashCons, info = {}) {
  if (typeof hashCons !== "function")
    throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
  info = checkOpts({}, info, "info");
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(undefined);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.canXOF = tmp.canXOF;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
function randomBytes(bytesLength = 32) {
  anumber(bytesLength, "bytesLength");
  const cr = typeof globalThis === "object" ? globalThis.crypto : null;
  if (typeof cr?.getRandomValues !== "function")
    throw new Error("crypto.getRandomValues must be defined");
  if (bytesLength > 65536)
    throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
  return cr.getRandomValues(new Uint8Array(bytesLength));
}
var oidNist = (suffix) => ({
  oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
});

// node_modules/@noble/hashes/_md.js
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}

class HashMD {
  blockLen;
  outputLen;
  canXOF = false;
  padOffset;
  isLE;
  buffer;
  view;
  finished = false;
  length = 0;
  pos = 0;
  destroyed = false;
  constructor(blockLen, outputLen, padOffset, isLE) {
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    let processed = false;
    for (let pos = 0;pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (;blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        processed = true;
        continue;
      }
      buffer.set(pos === 0 && take === len ? data : data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
        processed = true;
      }
    }
    this.length += data.length;
    if (processed)
      this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    buffer.fill(0, pos);
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      buffer.fill(0);
    }
    setU64FromNum(view, blockLen - 8, this.length * 8, isLE);
    this.process(view, 0);
    this.roundClean();
    const oview = out === buffer ? view : createView(out);
    const len = this.outputLen;
    const outLen = len / 4;
    const state = this.get();
    if (len % 4 || outLen > state.length)
      throw new Error("invalid outputLen");
    for (let i = 0;i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneIntoMeta(to) {
    const { buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (pos)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
}
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
var SHA512_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  4089235720,
  3144134277,
  2227873595,
  1013904242,
  4271175723,
  2773480762,
  1595750129,
  1359893119,
  2917565137,
  2600822924,
  725511199,
  528734635,
  4215389547,
  1541459225,
  327033209
]);

// node_modules/@noble/hashes/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);

class SHA2_32B extends HashMD {
  A = 0;
  B = 0;
  C = 0;
  D = 0;
  E = 0;
  F = 0;
  G = 0;
  H = 0;
  constructor(outputLen, IV) {
    super(64, outputLen, 8, false);
    this.A = IV[0] | 0;
    this.B = IV[1] | 0;
    this.C = IV[2] | 0;
    this.D = IV[3] | 0;
    this.E = IV[4] | 0;
    this.F = IV[5] | 0;
    this.G = IV[6] | 0;
    this.H = IV[7] | 0;
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  _cloneInto(to) {
    (to ||= new this.constructor).set(...this.get());
    return this._cloneIntoMeta(to);
  }
  process(view, offset) {
    for (let i = 0;i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16;i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0;i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.destroyed = true;
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
}

class _SHA256 extends SHA2_32B {
  constructor() {
    super(32, SHA256_IV);
  }
}
var K512 = /* @__PURE__ */ (() => split([
  "0x428a2f98d728ae22",
  "0x7137449123ef65cd",
  "0xb5c0fbcfec4d3b2f",
  "0xe9b5dba58189dbbc",
  "0x3956c25bf348b538",
  "0x59f111f1b605d019",
  "0x923f82a4af194f9b",
  "0xab1c5ed5da6d8118",
  "0xd807aa98a3030242",
  "0x12835b0145706fbe",
  "0x243185be4ee4b28c",
  "0x550c7dc3d5ffb4e2",
  "0x72be5d74f27b896f",
  "0x80deb1fe3b1696b1",
  "0x9bdc06a725c71235",
  "0xc19bf174cf692694",
  "0xe49b69c19ef14ad2",
  "0xefbe4786384f25e3",
  "0x0fc19dc68b8cd5b5",
  "0x240ca1cc77ac9c65",
  "0x2de92c6f592b0275",
  "0x4a7484aa6ea6e483",
  "0x5cb0a9dcbd41fbd4",
  "0x76f988da831153b5",
  "0x983e5152ee66dfab",
  "0xa831c66d2db43210",
  "0xb00327c898fb213f",
  "0xbf597fc7beef0ee4",
  "0xc6e00bf33da88fc2",
  "0xd5a79147930aa725",
  "0x06ca6351e003826f",
  "0x142929670a0e6e70",
  "0x27b70a8546d22ffc",
  "0x2e1b21385c26c926",
  "0x4d2c6dfc5ac42aed",
  "0x53380d139d95b3df",
  "0x650a73548baf63de",
  "0x766a0abb3c77b2a8",
  "0x81c2c92e47edaee6",
  "0x92722c851482353b",
  "0xa2bfe8a14cf10364",
  "0xa81a664bbc423001",
  "0xc24b8b70d0f89791",
  "0xc76c51a30654be30",
  "0xd192e819d6ef5218",
  "0xd69906245565a910",
  "0xf40e35855771202a",
  "0x106aa07032bbd1b8",
  "0x19a4c116b8d2d0c8",
  "0x1e376c085141ab53",
  "0x2748774cdf8eeb99",
  "0x34b0bcb5e19b48a8",
  "0x391c0cb3c5c95a63",
  "0x4ed8aa4ae3418acb",
  "0x5b9cca4f7763e373",
  "0x682e6ff3d6b2b8a3",
  "0x748f82ee5defb2fc",
  "0x78a5636f43172f60",
  "0x84c87814a1f0ab72",
  "0x8cc702081a6439ec",
  "0x90befffa23631e28",
  "0xa4506cebde82bde9",
  "0xbef9a3f7b2c67915",
  "0xc67178f2e372532b",
  "0xca273eceea26619c",
  "0xd186b8c721c0c207",
  "0xeada7dd6cde0eb1e",
  "0xf57d4f7fee6ed178",
  "0x06f067aa72176fba",
  "0x0a637dc5a2c898a6",
  "0x113f9804bef90dae",
  "0x1b710b35131c471b",
  "0x28db77f523047d84",
  "0x32caab7b40c72493",
  "0x3c9ebe0a15c9bebc",
  "0x431d67c49c100d4c",
  "0x4cc5d4becb3e42b6",
  "0x597f299cfc657e2a",
  "0x5fcb6fab3ad6faec",
  "0x6c44198c4a475817"
].map((n) => BigInt(n))))();
var SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
var SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
var SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
var SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);

class SHA2_64B extends HashMD {
  Ah = 0;
  Al = 0;
  Bh = 0;
  Bl = 0;
  Ch = 0;
  Cl = 0;
  Dh = 0;
  Dl = 0;
  Eh = 0;
  El = 0;
  Fh = 0;
  Fl = 0;
  Gh = 0;
  Gl = 0;
  Hh = 0;
  Hl = 0;
  constructor(outputLen, IV) {
    super(128, outputLen, 16, false);
    this.Ah = IV[0] | 0;
    this.Al = IV[1] | 0;
    this.Bh = IV[2] | 0;
    this.Bl = IV[3] | 0;
    this.Ch = IV[4] | 0;
    this.Cl = IV[5] | 0;
    this.Dh = IV[6] | 0;
    this.Dl = IV[7] | 0;
    this.Eh = IV[8] | 0;
    this.El = IV[9] | 0;
    this.Fh = IV[10] | 0;
    this.Fl = IV[11] | 0;
    this.Gh = IV[12] | 0;
    this.Gl = IV[13] | 0;
    this.Hh = IV[14] | 0;
    this.Hl = IV[15] | 0;
  }
  get() {
    const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
  }
  set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
    this.Ah = Ah | 0;
    this.Al = Al | 0;
    this.Bh = Bh | 0;
    this.Bl = Bl | 0;
    this.Ch = Ch | 0;
    this.Cl = Cl | 0;
    this.Dh = Dh | 0;
    this.Dl = Dl | 0;
    this.Eh = Eh | 0;
    this.El = El | 0;
    this.Fh = Fh | 0;
    this.Fl = Fl | 0;
    this.Gh = Gh | 0;
    this.Gl = Gl | 0;
    this.Hh = Hh | 0;
    this.Hl = Hl | 0;
  }
  _cloneInto(to) {
    (to ||= new this.constructor).set(...this.get());
    return this._cloneIntoMeta(to);
  }
  process(view, offset) {
    for (let i = 0;i < 16; i++, offset += 4) {
      SHA512_W_H[i] = view.getUint32(offset);
      SHA512_W_L[i] = view.getUint32(offset += 4);
    }
    for (let i = 16;i < 80; i++) {
      const W15h = SHA512_W_H[i - 15] | 0;
      const W15l = SHA512_W_L[i - 15] | 0;
      const s0h = rotrSH(W15h, W15l, 1) ^ rotrSH(W15h, W15l, 8) ^ shrSH(W15h, W15l, 7);
      const s0l = rotrSL(W15h, W15l, 1) ^ rotrSL(W15h, W15l, 8) ^ shrSL(W15h, W15l, 7);
      const W2h = SHA512_W_H[i - 2] | 0;
      const W2l = SHA512_W_L[i - 2] | 0;
      const s1h = rotrSH(W2h, W2l, 19) ^ rotrBH(W2h, W2l, 61) ^ shrSH(W2h, W2l, 6);
      const s1l = rotrSL(W2h, W2l, 19) ^ rotrBL(W2h, W2l, 61) ^ shrSL(W2h, W2l, 6);
      const SUMl = add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
      const SUMh = add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
      SHA512_W_H[i] = SUMh | 0;
      SHA512_W_L[i] = SUMl | 0;
    }
    let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    for (let i = 0;i < 80; i++) {
      const sigma1h = rotrSH(Eh, El, 14) ^ rotrSH(Eh, El, 18) ^ rotrBH(Eh, El, 41);
      const sigma1l = rotrSL(Eh, El, 14) ^ rotrSL(Eh, El, 18) ^ rotrBL(Eh, El, 41);
      const CHIh = Eh & Fh ^ ~Eh & Gh;
      const CHIl = El & Fl ^ ~El & Gl;
      const T1ll = add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
      const T1h = add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
      const T1l = T1ll | 0;
      const sigma0h = rotrSH(Ah, Al, 28) ^ rotrBH(Ah, Al, 34) ^ rotrBH(Ah, Al, 39);
      const sigma0l = rotrSL(Ah, Al, 28) ^ rotrBL(Ah, Al, 34) ^ rotrBL(Ah, Al, 39);
      const MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
      const MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
      Hh = Gh | 0;
      Hl = Gl | 0;
      Gh = Fh | 0;
      Gl = Fl | 0;
      Fh = Eh | 0;
      Fl = El | 0;
      ({ h: Eh, l: El } = add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
      Dh = Ch | 0;
      Dl = Cl | 0;
      Ch = Bh | 0;
      Cl = Bl | 0;
      Bh = Ah | 0;
      Bl = Al | 0;
      const All = add3L(T1l, sigma0l, MAJl);
      Ah = add3H(All, T1h, sigma0h, MAJh);
      Al = All | 0;
    }
    ({ h: Ah, l: Al } = add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
    ({ h: Bh, l: Bl } = add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
    ({ h: Ch, l: Cl } = add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
    ({ h: Dh, l: Dl } = add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
    ({ h: Eh, l: El } = add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
    ({ h: Fh, l: Fl } = add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
    ({ h: Gh, l: Gl } = add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
    ({ h: Hh, l: Hl } = add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
    this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
  }
  roundClean() {
    clean(SHA512_W_H, SHA512_W_L);
  }
  destroy() {
    this.destroyed = true;
    clean(this.buffer);
    this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
}

class _SHA512 extends SHA2_64B {
  constructor() {
    super(64, SHA512_IV);
  }
}
var sha256 = /* @__PURE__ */ createHasher(() => new _SHA256, /* @__PURE__ */ oidNist(1));
var sha512 = /* @__PURE__ */ createHasher(() => new _SHA512, /* @__PURE__ */ oidNist(3));

// node_modules/@noble/curves/utils.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function aarray(item, title, inner = () => {}) {
  if (!Array.isArray(item))
    throw new TypeError(`"${title}" expected array, got type=${typeof item}`);
  for (let i = 0;i < item.length; i++)
    inner(item[i], `${title}[${i}]`);
  return item;
}
var abytes2 = (value, length, title) => abytes(value, length, title);
var anumber2 = anumber;
function astring(value, title = "") {
  if (typeof value !== "string") {
    const prefix = title && `"${title}" `;
    throw new TypeError(prefix + "expected string, got type=" + typeof value);
  }
  return value;
}
function aobject2(value, title = "object") {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(title === "object" ? "expected valid options object" : `"${title}" expected object, got type=${typeof value}`);
  return value;
}
function afunction(value, title) {
  if (typeof value !== "function")
    throw new TypeError(`"${title}" is invalid: expected function, got ${typeof value}`);
  return value;
}
var bytesToHex2 = bytesToHex;
var concatBytes2 = (...arrays) => concatBytes(...arrays);
var hexToBytes2 = (hex) => hexToBytes(hex);
var isBytes2 = isBytes;
var randomBytes2 = (bytesLength) => randomBytes(bytesLength);
var _0n = /* @__PURE__ */ BigInt(0);
var _1n = /* @__PURE__ */ BigInt(1);
var atitle2 = (title) => title ? `"${title}" ` : "";
function abool(value, title = "") {
  if (typeof value !== "boolean")
    throw new TypeError(atitle2(title) + "expected boolean, got type=" + typeof value);
  return value;
}
function abignumber(n) {
  if (typeof n === "bigint") {
    if (!isPosBig(n))
      throw new RangeError("positive bigint expected, got " + n);
  } else
    anumber2(n);
  return n;
}
function asafenumber(value, title = "") {
  if (typeof value !== "number") {
    const prefix = title && `"${title}" `;
    throw new TypeError(prefix + "expected number, got type=" + typeof value);
  }
  if (!Number.isSafeInteger(value)) {
    const prefix = title && `"${title}" `;
    throw new RangeError(prefix + "expected safe integer, got " + value);
  }
}
function numberToHexUnpadded(num) {
  const hex = abignumber(num).toString(16);
  return hex.length & 1 ? "0" + hex : hex;
}
function hexToNumber(hex) {
  if (typeof hex !== "string")
    throw new TypeError("hex string expected, got " + typeof hex);
  return hex === "" ? _0n : BigInt("0x" + hex);
}
function bytesToNumberBE(bytes) {
  return hexToNumber(bytesToHex(bytes));
}
function bytesToNumberLE(bytes) {
  return hexToNumber(bytesToHex(copyBytes(abytes(bytes)).reverse()));
}
function numberToBytesBE(n, len) {
  anumber(len);
  if (len === 0)
    throw new Error("zero output length is invalid");
  n = abignumber(n);
  const expectedLen = len * 2;
  const hex = n.toString(16);
  if (hex.length > expectedLen)
    throw new RangeError("number is too large");
  return hexToBytes(hex.padStart(expectedLen, "0"));
}
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
function copyBytes(bytes) {
  return Uint8Array.from(abytes2(bytes));
}
function asciiToBytes(ascii) {
  if (typeof ascii !== "string")
    throw new TypeError("ascii string expected, got " + typeof ascii);
  return Uint8Array.from(ascii, (c, i) => {
    const charCode = c.charCodeAt(0);
    if (c.length !== 1 || charCode > 127) {
      throw new RangeError(`string contains non-ASCII character "${ascii[i]}" with code ${charCode} at position ${i}`);
    }
    return charCode;
  });
}
function isPosBig(n) {
  return typeof n === "bigint" && _0n <= n;
}
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max))
    throw new RangeError("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
function bitLen(n) {
  if (n < _0n)
    throw new Error("expected non-negative bigint, got " + n);
  return n === _0n ? 0 : n.toString(2).length;
}
var bitMask = (n) => {
  asafenumber(n, "n");
  return (_1n << BigInt(n)) - _1n;
};
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
  anumber(hashLen, "hashLen");
  anumber(qByteLen, "qByteLen");
  if (typeof hmacFn !== "function")
    throw new TypeError("hmacFn must be a function");
  const u8n = (len) => new Uint8Array(len);
  const NULL = Uint8Array.of();
  const byte0 = Uint8Array.of(0);
  const byte1 = Uint8Array.of(1);
  const _maxDrbgIters = 1000;
  let v = u8n(hashLen);
  let k = u8n(hashLen);
  let i = 0;
  const reset = () => {
    v.fill(1);
    k.fill(0);
    i = 0;
  };
  const h = (...msgs) => hmacFn(k, concatBytes2(v, ...msgs));
  const reseed = (seed = NULL) => {
    k = h(byte0, seed);
    v = h();
    if (seed.length === 0)
      return;
    k = h(byte1, seed);
    v = h();
  };
  const gen = () => {
    if (i++ >= _maxDrbgIters)
      throw new Error("drbg: tried max amount of iterations");
    let len = 0;
    const out = [];
    while (len < qByteLen) {
      v = h();
      const sl = v.slice();
      out.push(sl);
      len += v.length;
    }
    return concatBytes2(...out);
  };
  const genUntil = (seed, pred) => {
    reset();
    reseed(seed);
    let res = undefined;
    while ((res = pred(gen())) === undefined)
      reseed();
    reset();
    return res;
  };
  return genUntil;
}
function validateObject(object, fields = {}, optFields = {}, title = "object") {
  aobject2(object, title);
  aobject2(fields, "fields");
  aobject2(optFields, "optFields");
  function checkField(fieldName, expectedType, isOpt) {
    const label = title === "object" ? `param "${String(fieldName)}"` : `"${title}.${String(fieldName)}"`;
    const val = object[fieldName];
    if (!Object.hasOwn(object, fieldName) && (isOpt ? val !== undefined : expectedType !== "function")) {
      throw new TypeError(`${label} is invalid: expected own property`);
    }
    if (isOpt && val === undefined)
      return;
    const current = typeof val;
    if (current !== expectedType || val === null)
      throw new TypeError(`${label} is invalid: expected ${expectedType}, got ${current}`);
  }
  const iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
  iter(fields, false);
  iter(optFields, true);
}

// node_modules/@noble/curves/abstract/modular.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n2 = /* @__PURE__ */ BigInt(0);
var _1n2 = /* @__PURE__ */ BigInt(1);
var _2n = /* @__PURE__ */ BigInt(2);
var _3n = /* @__PURE__ */ BigInt(3);
var _4n = /* @__PURE__ */ BigInt(4);
var _5n = /* @__PURE__ */ BigInt(5);
var _7n = /* @__PURE__ */ BigInt(7);
var _8n = /* @__PURE__ */ BigInt(8);
var _9n = /* @__PURE__ */ BigInt(9);
var _15n = /* @__PURE__ */ BigInt(15);
var _16n = /* @__PURE__ */ BigInt(16);
var POW_WINDOWED_MIN = /* @__PURE__ */ BigInt("0x10000000000000000");
function mod(a, b) {
  if (b <= _0n2)
    throw new Error("mod: expected positive modulus, got " + b);
  const result = a % b;
  return result >= _0n2 ? result : b + result;
}
function pow(num, power, modulo) {
  if (modulo <= _1n2)
    throw new Error("pow: expected modulus > 1, got " + modulo);
  if (typeof power !== "bigint")
    throw new TypeError("invalid exponent: expected bigint, got " + typeof power);
  if (power < _0n2)
    throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n2)
    return _1n2;
  if (power === _1n2)
    return num;
  let d = num % modulo;
  if (d < _0n2)
    d += modulo;
  if (power < POW_WINDOWED_MIN) {
    let p = _1n2;
    while (power > _0n2) {
      if (power & _1n2)
        p = p * d % modulo;
      d = d * d % modulo;
      power >>= _1n2;
    }
    return p;
  }
  const digits = [];
  while (power > _0n2) {
    digits.push(Number(power & _15n));
    power >>= _4n;
  }
  const table = new Array(16);
  table[0] = _1n2;
  table[1] = d;
  for (let i = 2;i < 16; i++)
    table[i] = table[i - 1] * d % modulo;
  let p = table[digits[digits.length - 1]];
  for (let w = digits.length - 2;w >= 0; w--) {
    p = p * p % modulo;
    p = p * p % modulo;
    p = p * p % modulo;
    p = p * p % modulo;
    const digit = digits[w];
    if (digit !== 0)
      p = p * table[digit] % modulo;
  }
  return p;
}
function pow2(x, power, modulo) {
  if (modulo <= _1n2)
    throw new Error("pow2: expected modulus > 1, got " + modulo);
  if (power < _0n2)
    throw new Error("pow2: expected non-negative exponent, got " + power);
  let res = x;
  while (power-- > _0n2) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert(number, modulo) {
  if (number === _0n2)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _1n2)
    throw new Error("invert: expected modulus > 1, got " + modulo);
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n2, u = _1n2;
  while (a !== _0n2) {
    const q = b / a;
    const r = b - a * q;
    const m = x - u * q;
    b = a, a = r, x = u, u = m;
  }
  const gcd = b;
  if (gcd !== _1n2)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function invertCt(a, prime) {
  if (prime <= _1n2)
    throw new Error("invertCt: expected prime modulus > 1, got " + prime);
  const an = mod(a, prime);
  if (an === _0n2)
    throw new Error("invertCt: expected non-zero number");
  const inverse = pow(an, prime - _2n, prime);
  if (mod(an * inverse, prime) !== _1n2)
    throw new Error("invertCt: does not exist");
  return inverse;
}
function assertIsSquare(Fp, root, n) {
  const F = Fp;
  if (!F.eql(F.sqr(root), n))
    throw new Error("Cannot find square root");
}
function aoddModulus(order, fnName) {
  if ((order & _1n2) === _0n2)
    throw new Error(fnName + ": expected odd modulus, got " + order);
}
function sqrt3mod4(Fp, n) {
  const F = Fp;
  const p1div4 = (F.ORDER + _1n2) / _4n;
  const root = F.pow(n, p1div4);
  assertIsSquare(F, root, n);
  return root;
}
function sqrt5mod8(Fp, n) {
  const F = Fp;
  const p5div8 = (F.ORDER - _5n) / _8n;
  const n2 = F.mul(n, _2n);
  const v = F.pow(n2, p5div8);
  const nv = F.mul(n, v);
  const i = F.mul(F.mul(nv, _2n), v);
  const root = F.mul(nv, F.sub(i, F.ONE));
  assertIsSquare(F, root, n);
  return root;
}
function sqrt9mod16(P) {
  const Fp_ = Field(P);
  const tn = tonelliShanks(P);
  const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
  const c2 = tn(Fp_, c1);
  const c3 = tn(Fp_, Fp_.neg(c1));
  const c4 = (P + _7n) / _16n;
  return (Fp, n) => {
    const F = Fp;
    let tv1 = F.pow(n, c4);
    let tv2 = F.mul(tv1, c1);
    const tv3 = F.mul(tv1, c2);
    const tv4 = F.mul(tv1, c3);
    const e1 = F.eql(F.sqr(tv2), n);
    const e2 = F.eql(F.sqr(tv3), n);
    tv1 = F.cmov(tv1, tv2, e1);
    tv2 = F.cmov(tv4, tv3, e2);
    const e3 = F.eql(F.sqr(tv2), n);
    const root = F.cmov(tv1, tv2, e3);
    assertIsSquare(F, root, n);
    return root;
  };
}
function tonelliShanks(P) {
  if (P < _3n)
    throw new Error("sqrt is not defined for small field");
  aoddModulus(P, "tonelliShanks");
  let Q = P - _1n2;
  let S = 0;
  while (Q % _2n === _0n2) {
    Q /= _2n;
    S++;
  }
  let Z = _2n;
  const _Fp = Field(P);
  while (FpLegendre(_Fp, Z) === 1) {
    if (Z++ > 1000)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod4;
  let cc = _Fp.pow(Z, Q);
  const Q1div2 = (Q + _1n2) / _2n;
  return function tonelliSlow(Fp, n) {
    const F = Fp;
    if (F.is0(n))
      return n;
    if (FpLegendre(F, n) !== 1)
      throw new Error("Cannot find square root");
    let M = S;
    let c = F.mul(F.ONE, cc);
    let t = F.pow(n, Q);
    let R = F.pow(n, Q1div2);
    while (!F.eql(t, F.ONE)) {
      if (F.is0(t))
        throw new Error("Cannot find square root: probably non-prime P");
      let i = 1;
      let t_tmp = F.sqr(t);
      while (!F.eql(t_tmp, F.ONE)) {
        i++;
        t_tmp = F.sqr(t_tmp);
        if (i === M)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n2 << BigInt(M - i - 1);
      const b = F.pow(c, exponent);
      M = i;
      c = F.sqr(b);
      t = F.mul(t, c);
      R = F.mul(R, b);
    }
    return R;
  };
}
function FpSqrt(P) {
  aoddModulus(P, "Fp.sqrt");
  if (P % _4n === _3n)
    return sqrt3mod4;
  if (P % _8n === _5n)
    return sqrt5mod8;
  if (P % _16n === _9n)
    return sqrt9mod16(P);
  return tonelliShanks(P);
}
var isNegativeLE = (num, modulo) => (mod(num, modulo) & _1n2) === _1n2;
var FIELD_FIELDS = [
  "create",
  "isValid",
  "is0",
  "neg",
  "inv",
  "sqrt",
  "sqr",
  "eql",
  "add",
  "sub",
  "mul",
  "pow",
  "div",
  "addN",
  "subN",
  "mulN",
  "sqrN"
];
function validateField(field) {
  aobject2(field, "field");
  if (typeof field.ORDER !== "bigint")
    throw new TypeError('param "ORDER" is invalid: expected bigint, got ' + typeof field.ORDER);
  asafenumber(field.BYTES, "BYTES");
  asafenumber(field.BITS, "BITS");
  for (const name of FIELD_FIELDS)
    afunction(field[name], "field." + name);
  if (field.BYTES < 1 || field.BITS < 1)
    throw new Error("invalid field: expected BYTES/BITS > 0");
  if (field.ORDER <= _1n2)
    throw new Error("invalid field: expected ORDER > 1, got " + field.ORDER);
  return field;
}
function FpInvertBatch(Fp, nums, passZero = false) {
  validateField(Fp);
  aarray(nums, "nums");
  abool(passZero, "passZero");
  const F = Fp;
  const inverted = new Array(nums.length).fill(passZero ? F.ZERO : undefined);
  const multipliedAcc = nums.reduce((acc, num, i) => {
    if (F.is0(num))
      return acc;
    inverted[i] = acc;
    return F.mul(acc, num);
  }, F.ONE);
  const invertedAcc = F.inv(multipliedAcc);
  nums.reduceRight((acc, num, i) => {
    if (F.is0(num))
      return acc;
    inverted[i] = F.mul(acc, inverted[i]);
    return F.mul(acc, num);
  }, invertedAcc);
  return inverted;
}
function FpLegendre(Fp, n) {
  validateField(Fp);
  const F = Fp;
  aoddModulus(F.ORDER, "FpLegendre");
  const p1mod2 = (F.ORDER - _1n2) / _2n;
  const powered = F.pow(n, p1mod2);
  const yes = F.eql(powered, F.ONE);
  const zero = F.eql(powered, F.ZERO);
  const no = F.eql(powered, F.neg(F.ONE));
  if (!yes && !zero && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
function nLength(n, nBitLength) {
  if (nBitLength !== undefined)
    anumber2(nBitLength);
  if (n <= _0n2)
    throw new Error("invalid n length: expected positive n, got " + n);
  if (nBitLength !== undefined && nBitLength < 1)
    throw new Error("invalid n length: expected positive bit length, got " + nBitLength);
  const bits = bitLen(n);
  if (nBitLength !== undefined && nBitLength < bits)
    throw new Error(`invalid n length: expected nBitLength (${nBitLength}) >= bitLen(n) (${bits})`);
  const _nBitLength = nBitLength !== undefined ? nBitLength : bits;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
var FIELD_SQRT = new WeakMap;

class _Field {
  ORDER;
  BITS;
  BYTES;
  isLE;
  ZERO = _0n2;
  ONE = _1n2;
  _lengths;
  _mod;
  constructor(ORDER, opts = {}) {
    if (ORDER <= _1n2)
      throw new Error("invalid field: expected ORDER > 1, got " + ORDER);
    let _nbitLength = undefined;
    this.isLE = false;
    if (opts != null && typeof opts === "object") {
      if (typeof opts.BITS === "number")
        _nbitLength = opts.BITS;
      if (typeof opts.sqrt === "function")
        Object.defineProperty(this, "sqrt", { value: opts.sqrt, enumerable: true });
      if (typeof opts.isLE === "boolean")
        this.isLE = opts.isLE;
      if (opts.allowedLengths)
        this._lengths = Object.freeze(opts.allowedLengths.slice());
      if (typeof opts.modFromBytes === "boolean")
        this._mod = opts.modFromBytes;
    }
    const { nBitLength, nByteLength } = nLength(ORDER, _nbitLength);
    if (nByteLength > 2048)
      throw new Error("invalid field: expected ORDER of <= 2048 bytes");
    this.ORDER = ORDER;
    this.BITS = nBitLength;
    this.BYTES = nByteLength;
    Object.freeze(this);
  }
  create(num) {
    return mod(num, this.ORDER);
  }
  isValid(num) {
    if (typeof num !== "bigint")
      throw new TypeError("invalid field element: expected bigint, got " + typeof num);
    return _0n2 <= num && num < this.ORDER;
  }
  is0(num) {
    return num === _0n2;
  }
  isValidNot0(num) {
    return !this.is0(num) && this.isValid(num);
  }
  isOdd(num) {
    return (num & _1n2) === _1n2;
  }
  neg(num) {
    return mod(-num, this.ORDER);
  }
  eql(lhs, rhs) {
    return lhs === rhs;
  }
  sqr(num) {
    return mod(num * num, this.ORDER);
  }
  add(lhs, rhs) {
    return mod(lhs + rhs, this.ORDER);
  }
  sub(lhs, rhs) {
    return mod(lhs - rhs, this.ORDER);
  }
  mul(lhs, rhs) {
    return mod(lhs * rhs, this.ORDER);
  }
  pow(num, power) {
    return pow(num, power, this.ORDER);
  }
  div(lhs, rhs) {
    return mod(lhs * invert(rhs, this.ORDER), this.ORDER);
  }
  sqrN(num) {
    return num * num;
  }
  addN(lhs, rhs) {
    return lhs + rhs;
  }
  subN(lhs, rhs) {
    return lhs - rhs;
  }
  mulN(lhs, rhs) {
    return lhs * rhs;
  }
  inv(num) {
    return invert(num, this.ORDER);
  }
  sqrt(num) {
    let sqrt = FIELD_SQRT.get(this);
    if (!sqrt)
      FIELD_SQRT.set(this, sqrt = FpSqrt(this.ORDER));
    return sqrt(this, num);
  }
  toBytes(num) {
    return this.isLE ? numberToBytesLE(num, this.BYTES) : numberToBytesBE(num, this.BYTES);
  }
  fromBytes(bytes, skipValidation = false) {
    abytes2(bytes);
    const { _lengths: allowedLengths, BYTES, isLE, ORDER, _mod: modFromBytes } = this;
    if (allowedLengths) {
      if (bytes.length < 1 || !allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
        throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
      }
      const padded = new Uint8Array(BYTES);
      padded.set(bytes, isLE ? 0 : padded.length - bytes.length);
      bytes = padded;
    }
    if (bytes.length !== BYTES)
      throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
    let scalar = isLE ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
    if (modFromBytes)
      scalar = mod(scalar, ORDER);
    if (!skipValidation) {
      if (!this.isValid(scalar))
        throw new Error("invalid field element: outside of range 0..ORDER");
    }
    return scalar;
  }
  invertBatch(lst) {
    return FpInvertBatch(this, lst, true);
  }
  cmov(a, b, condition) {
    abool(condition, "condition");
    return condition ? b : a;
  }
}
function Field(ORDER, opts = {}) {
  Object.freeze(_Field.prototype);
  return new _Field(ORDER, opts);
}
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  if (fieldOrder <= _1n2)
    throw new Error("field order must be greater than 1");
  const bitLength = bitLen(fieldOrder - _1n2);
  return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE = false) {
  abytes2(key);
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = Math.max(getMinHashLength(fieldOrder), 16);
  if (len < minLen || len > 1024)
    throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num = isLE ? bytesToNumberLE(key) : bytesToNumberBE(key);
  const reduced = mod(num, fieldOrder - _1n2) + _1n2;
  return isLE ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}

// node_modules/@noble/curves/abstract/curve.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n3 = /* @__PURE__ */ BigInt(0);
var _1n3 = /* @__PURE__ */ BigInt(1);
var _4n2 = /* @__PURE__ */ BigInt(4);
var BLIND_BYTES = 16;
var BLIND_BITS = 128;
var FW_WINDOW = 5;
var TABLE_BYTES_MAX = /* @__PURE__ */ (() => 2 ** 31)();
function validatePointCons(Point) {
  const pc = Point;
  if (typeof pc !== "function")
    throw new TypeError('"Point" expected constructor, got type=' + typeof Point);
  afunction(pc.fromAffine, "Point.fromAffine");
  afunction(pc.fromBytes, "Point.fromBytes");
  afunction(pc.fromHex, "Point.fromHex");
  aobject2(pc.BASE, "Point.BASE");
  aobject2(pc.ZERO, "Point.ZERO");
  validateField(pc.Fp);
  validateField(pc.Fn);
}
function normalizeZ(c, points) {
  validatePointCons(c);
  validateMSMPoints(points, c);
  const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
  return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
function validateW(W, bits, min = 1) {
  if (!Number.isSafeInteger(W) || W < min || W > bits)
    throw new Error("invalid window size, expected [" + min + ".." + bits + "], got W=" + W);
}
function validateTableBytes(numPoints, fpBytes) {
  const bytes = numPoints * (4 * fpBytes + 128);
  if (bytes > TABLE_BYTES_MAX)
    throw new Error("invalid window size: table would need ~" + Math.ceil(bytes / 2 ** 20) + " MiB, max " + TABLE_BYTES_MAX / 2 ** 20 + " MiB");
}
function probeRandomBytes(randomBytes, length) {
  if (randomBytes === undefined)
    return;
  afunction(randomBytes, "randomBytes");
  try {
    const probe = randomBytes(length);
    if (!isBytes2(probe) || probe.length !== length)
      return;
  } catch {
    return;
  }
  return randomBytes;
}
function validateMSMPoints(points, c) {
  aarray(points, "points");
  points.forEach((p, i) => {
    if (!(p instanceof c))
      throw new Error("invalid point at index " + i);
  });
}
function validateMSMScalars(scalars, field, maxScalar) {
  if (!Array.isArray(scalars))
    throw new Error("array of scalars expected");
  scalars.forEach((s, i) => {
    const ok = maxScalar === undefined ? field.isValid(s) : isPosBig(s) && s < maxScalar;
    if (!ok)
      throw new Error("invalid scalar at index " + i);
  });
}
var pointWindowSizes = new WeakMap;
function getWindowSize(P) {
  return pointWindowSizes.get(P) || 1;
}
function oddMultiples(p, size) {
  const dbl = p.double();
  const t = [p];
  for (let j = 1;j < size; j++)
    t.push(t[j - 1].add(dbl));
  return t;
}
function wnafDigits(n, W) {
  const size = 2 ** W;
  const half = size / 2;
  const mask = BigInt(size - 1);
  const d = [];
  while (n > _0n3) {
    let w = 0;
    if (n & _1n3) {
      w = Number(n & mask);
      if (w >= half)
        w -= size;
      n -= BigInt(w);
    }
    d.push(w);
    n >>= _1n3;
  }
  return d;
}
function signedWindowDigits(n, W, windows) {
  const size = 2 ** W;
  const half = size / 2;
  const mask = BigInt(size - 1);
  const shiftBy = BigInt(W);
  const d = [];
  for (let w = 0;w < windows; w++) {
    let v = Number(n & mask);
    n >>= shiftBy;
    if (v > half) {
      v -= size;
      n += _1n3;
    }
    d.push(v);
  }
  if (n !== _0n3)
    throw new Error("invalid wnaf");
  return d;
}
function wnafWalk(zero, tables, digits) {
  let max = 0;
  for (const d of digits)
    max = Math.max(max, d.length);
  let acc = zero;
  for (let bit = max - 1;bit >= 0; bit--) {
    if (bit !== max - 1)
      acc = acc.double();
    for (let i = 0;i < digits.length; i++) {
      const w = digits[i][bit];
      if (w) {
        const item = tables[i][Math.abs(w) - 1 >> 1];
        acc = acc.add(w < 0 ? item.negate() : item);
      }
    }
  }
  return acc;
}

class ScalarMultiplier {
  Point;
  BASE;
  ZERO;
  randomBytes;
  wnafPrecomputes = new WeakMap;
  baseCanBeBlinded;
  bits;
  constructor(Point, randomBytes) {
    validatePointCons(Point);
    this.randomBytes = probeRandomBytes(randomBytes, BLIND_BYTES);
    this.Point = Point;
    this.BASE = Point.BASE;
    this.ZERO = Point.ZERO;
    this.bits = Point.Fn.BITS;
  }
  buildWnafTable(point, W, bits) {
    const windows = Math.ceil(bits / W) + 1;
    const half = 2 ** (W - 1);
    const comp = [];
    let base = point;
    for (let w = 0;w < windows; w++) {
      let acc = base;
      for (let i = 0;i < half; i++) {
        comp.push(acc);
        acc = acc.add(base);
      }
      base = comp[comp.length - 1].double();
    }
    return { W, bits, windows, comp };
  }
  wnafCachedCT(precomputes, n) {
    const { W, windows, comp } = precomputes;
    const half = 2 ** (W - 1);
    const digits = signedWindowDigits(n, W, windows);
    let p = this.ZERO;
    let f = this.BASE;
    for (let w = 0;w < windows; w++) {
      const digit = digits[w];
      const start = w * half;
      const idx = Math.abs(digit) - 1;
      let sel = comp[start];
      for (let i = 1;i < half; i++)
        sel = i === idx ? comp[start + i] : sel;
      const neg = sel.negate();
      if (digit === 0)
        f = f.add(comp[start]);
      else
        p = p.add(digit < 0 ? neg : sel);
    }
    return { p, f };
  }
  getWnafPrecomputes(W, point, bits, transform) {
    let entries = this.wnafPrecomputes.get(point);
    let comp = entries?.find((entry) => entry.W === W && entry.bits === bits);
    if (!comp) {
      comp = this.buildWnafTable(point, W, bits);
      if (typeof transform === "function")
        comp = { ...comp, comp: transform(comp.comp) };
      if (!entries) {
        entries = [];
        this.wnafPrecomputes.set(point, entries);
      }
      entries.push(comp);
    }
    return comp;
  }
  assertPoint(point) {
    if (!(point instanceof this.Point))
      throw new TypeError('"point" expected Point instance, got type=' + typeof point);
  }
  validateMulInput(point, scalar) {
    this.assertPoint(point);
    if (!inRange(scalar, _1n3, this.Point.Fn.ORDER))
      throw new Error("invalid scalar");
  }
  runCT(point, n, bits, transform) {
    const W = getWindowSize(point);
    if (W === 1)
      return this.fixedWindowCT(point, n, bits);
    return this.wnafCachedCT(this.getWnafPrecomputes(W, point, bits, transform), n);
  }
  mulCT(point, scalar, transform) {
    this.validateMulInput(point, scalar);
    return this.runCT(point, scalar, this.bits, transform);
  }
  mulCTBlinded(point, scalar, transform) {
    this.validateMulInput(point, scalar);
    if (this.randomBytes === undefined)
      throw new Error("randomBytes is required for scalar blinding");
    const bits = this.Point.Fn.BITS + BLIND_BITS;
    const blind = this.randomBytes(BLIND_BYTES);
    if (!isBytes2(blind) || blind.length !== BLIND_BYTES)
      throw new Error("randomBytes returned invalid byte array");
    blind[0] = blind[0] & 63 | 128;
    const n = scalar + bytesToNumberBE(blind) * this.Point.Fn.ORDER;
    return this.runCT(point, n, bits, transform);
  }
  fixedWindowCT(point, n, bits) {
    const W = FW_WINDOW;
    const size = 1 << W;
    const mask = bitMask(W);
    const table = new Array(size);
    table[0] = this.ZERO;
    for (let i = 1;i < size; i++)
      table[i] = table[i - 1].add(point);
    const windows = Math.ceil(bits / W);
    let acc = this.ZERO;
    for (let window2 = windows - 1;window2 >= 0; window2--) {
      if (window2 !== windows - 1)
        for (let d = 0;d < W; d++)
          acc = acc.double();
      const digit = Number(n >> BigInt(window2 * W) & mask);
      let sel = table[0];
      for (let i = 1;i < size; i++)
        sel = i === digit ? table[i] : sel;
      acc = acc.add(sel);
    }
    return { p: acc, f: acc };
  }
  shouldBlind(point, cofactor) {
    if (this.randomBytes === undefined)
      return false;
    if (cofactor === _1n3)
      return true;
    if (point !== this.BASE)
      return false;
    if (this.baseCanBeBlinded === undefined)
      this.baseCanBeBlinded = this.mulUnsafe(this.BASE, this.Point.Fn.ORDER).is0();
    return this.baseCanBeBlinded;
  }
  mulSecret(point, scalar, cofactor, transform) {
    return this.shouldBlind(point, cofactor) ? this.mulCTBlinded(point, scalar, transform) : this.mulCT(point, scalar, transform);
  }
  mulUnsafe(point, scalar, transform) {
    this.assertPoint(point);
    if (!isPosBig(scalar))
      throw new Error("invalid scalar");
    const W = getWindowSize(point);
    if (W === 1 || scalar >= this.Point.Fn.ORDER)
      return mulAddUnsafe(this.Point, [point], [scalar], true);
    const precomputes = this.getWnafPrecomputes(W, point, this.bits, transform);
    return this.wnafCachedCT(precomputes, scalar).p;
  }
  setWindowSize(point, W) {
    this.assertPoint(point);
    validateW(W, this.bits);
    const windows = Math.ceil((this.bits + BLIND_BITS) / W) + 1;
    validateTableBytes(windows * 2 ** (W - 1), this.Point.Fp.BYTES);
    pointWindowSizes.set(point, W);
    this.wnafPrecomputes.delete(point);
  }
  hasWindowSize(point) {
    return getWindowSize(point) !== 1;
  }
}
function mulAddUnsafe(c, points, scalars, allowOversized = false) {
  validatePointCons(c);
  validateMSMPoints(points, c);
  abool(allowOversized, "allowOversized");
  validateMSMScalars(scalars, c.Fn, allowOversized ? c.Fn.ORDER ** _4n2 : undefined);
  if (points.length !== scalars.length)
    throw new Error("arrays of points and scalars must have equal length");
  const tables = points.map((p) => oddMultiples(p, 4));
  const digits = scalars.map((n) => wnafDigits(n, 4));
  return wnafWalk(c.ZERO, tables, digits);
}
function createField(order, field, isLE) {
  if (field) {
    if (field.ORDER !== order)
      throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField(field);
    return field;
  } else {
    return Field(order, { isLE });
  }
}
function createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
  if (type !== "weierstrass" && type !== "edwards")
    throw new Error('expected curve type "weierstrass" or "edwards"');
  if (FpFnLE === undefined)
    FpFnLE = type === "edwards";
  if (!CURVE || typeof CURVE !== "object")
    throw new Error(`expected valid ${type} CURVE object`);
  validateObject(curveOpts);
  for (const p of ["p", "n", "h"]) {
    const val = CURVE[p];
    if (!(isPosBig(val) && val !== _0n3))
      throw new Error(`CURVE.${p} must be positive bigint`);
  }
  const Fp = createField(CURVE.p, curveOpts.Fp, FpFnLE);
  const Fn = createField(CURVE.n, curveOpts.Fn, FpFnLE);
  const _b = type === "weierstrass" ? "b" : "d";
  const params = ["Gx", "Gy", "a", _b];
  for (const p of params) {
    if (!Fp.isValid(CURVE[p]))
      throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
  }
  CURVE = Object.freeze(Object.assign({}, CURVE));
  return { CURVE, Fp, Fn };
}
function createKeygen(randomSecretKey, getPublicKey) {
  return function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  };
}

// node_modules/@noble/hashes/hmac.js
class _HMAC {
  oHash;
  iHash;
  blockLen;
  outputLen;
  canXOF = false;
  finished = false;
  destroyed = false;
  constructor(hash, key) {
    ahash(hash);
    abytes(key, undefined, "key");
    this.iHash = hash.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("expected Hash instance");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
    for (let i = 0;i < pad.length; i++)
      pad[i] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash.create();
    for (let i = 0;i < pad.length; i++)
      pad[i] ^= 54 ^ 92;
    this.oHash.update(pad);
    clean(pad);
  }
  update(buf) {
    aexists(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const buf = out.subarray(0, this.outputLen);
    this.iHash.digestInto(buf);
    this.oHash.update(buf);
    this.oHash.digestInto(buf);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to ||= Object.create(Object.getPrototypeOf(this), {});
    const { oHash, iHash, finished, destroyed, blockLen, outputLen, canXOF } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.canXOF = canXOF;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
}
var hmac = /* @__PURE__ */ (() => {
  const hmac_ = (hash, key, message) => new _HMAC(hash, key).update(message).digest();
  hmac_.create = (hash, key) => new _HMAC(hash, key);
  return hmac_;
})();

// node_modules/@noble/curves/abstract/der.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n4 = /* @__PURE__ */ BigInt(0);

class DERErr extends Error {
  constructor(m = "") {
    super(m);
  }
}
var _DER = {
  Err: DERErr,
  _tlv: {
    encode: (tag, data) => {
      const { Err: E } = _DER;
      asafenumber(tag, "tag");
      if (tag < 0 || tag > 255)
        throw new E("tlv.encode: wrong tag");
      astring(data, "data");
      if (data.length & 1)
        throw new E("tlv.encode: unpadded data");
      const dataLen = data.length / 2;
      const len = numberToHexUnpadded(dataLen);
      if (len.length / 2 & 128)
        throw new E("tlv.encode: long form length too big");
      const lenLen = dataLen > 127 ? numberToHexUnpadded(len.length / 2 | 128) : "";
      const t = numberToHexUnpadded(tag);
      return t + lenLen + len + data;
    },
    decode(tag, data) {
      const { Err: E } = _DER;
      data = abytes2(data, undefined, "DER data");
      let pos = 0;
      if (tag < 0 || tag > 255)
        throw new E("tlv.decode: wrong tag");
      if (data.length < 2 || data[pos++] !== tag)
        throw new E("tlv.decode: wrong tlv");
      const first = data[pos++];
      const isLong = !!(first & 128);
      let length = 0;
      if (!isLong)
        length = first;
      else {
        const lenLen = first & 127;
        if (!lenLen)
          throw new E("tlv.decode(long): indefinite length not supported");
        if (lenLen > 4)
          throw new E("tlv.decode(long): byte length is too big");
        const lengthBytes = data.subarray(pos, pos + lenLen);
        if (lengthBytes.length !== lenLen)
          throw new E("tlv.decode: length bytes not complete");
        if (lengthBytes[0] === 0)
          throw new E("tlv.decode(long): zero leftmost byte");
        for (const b of lengthBytes)
          length = length << 8 | b;
        pos += lenLen;
        if (length < 128)
          throw new E("tlv.decode(long): not minimal encoding");
      }
      const v = data.subarray(pos, pos + length);
      if (v.length !== length)
        throw new E("tlv.decode: wrong value length");
      return { v, l: data.subarray(pos + length) };
    }
  },
  _int: {
    encode(num) {
      const { Err: E } = _DER;
      abignumber(num);
      if (num < _0n4)
        throw new E("integer: negative integers are not allowed");
      let hex = numberToHexUnpadded(num);
      if (Number.parseInt(hex[0], 16) & 8)
        hex = "00" + hex;
      if (hex.length & 1)
        throw new E("unexpected DER parsing assertion: unpadded hex");
      return hex;
    },
    decode(data) {
      const { Err: E } = _DER;
      if (data.length < 1)
        throw new E("invalid signature integer: empty");
      if (data[0] & 128)
        throw new E("invalid signature integer: negative");
      if (data.length > 1 && data[0] === 0 && !(data[1] & 128))
        throw new E("invalid signature integer: unnecessary leading zero");
      return bytesToNumberBE(data);
    }
  },
  toSig(bytes, maxScalarBytes) {
    const { Err: E, _int: int, _tlv: tlv } = _DER;
    if (maxScalarBytes !== undefined) {
      asafenumber(maxScalarBytes, "maxScalarBytes");
      if (maxScalarBytes < 1)
        throw new E("invalid signature: maxScalarBytes must be positive");
    }
    const data = abytes2(bytes, undefined, "signature");
    const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
    if (seqLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
    const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
    if (sLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    if (maxScalarBytes !== undefined && (rBytes.length > maxScalarBytes || sBytes.length > maxScalarBytes))
      throw new E("invalid signature: integer too large");
    return { r: int.decode(rBytes), s: int.decode(sBytes) };
  },
  hexFromSig(sig) {
    const { _tlv: tlv, _int: int } = _DER;
    validateObject(sig, { r: "bigint", s: "bigint" }, {}, "sig");
    const rs = tlv.encode(2, int.encode(sig.r));
    const ss = tlv.encode(2, int.encode(sig.s));
    const seq = rs + ss;
    return tlv.encode(48, seq);
  }
};
var DER = /* @__PURE__ */ (() => {
  Object.freeze(_DER._tlv);
  Object.freeze(_DER._int);
  return Object.freeze(_DER);
})();

// node_modules/@noble/curves/abstract/weierstrass.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var divNearest = (num, den) => (num + (num >= 0 ? den : -den) / _2n2) / den;
function _splitEndoScalar(k, basis, n) {
  aInRange("scalar", k, _0n5, n);
  const [[a1, b1], [a2, b2]] = basis;
  const c1 = divNearest(b2 * k, n);
  const c2 = divNearest(-b1 * k, n);
  let k1 = k - c1 * a1 - c2 * a2;
  let k2 = -c1 * b1 - c2 * b2;
  const k1neg = k1 < _0n5;
  const k2neg = k2 < _0n5;
  if (k1neg)
    k1 = -k1;
  if (k2neg)
    k2 = -k2;
  const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n4;
  if (k1 < _0n5 || k1 >= MAX_NUM || k2 < _0n5 || k2 >= MAX_NUM) {
    throw new Error("splitScalar (endomorphism): failed for k");
  }
  return { k1neg, k1, k2neg, k2 };
}
function validateSigFormat(format) {
  if (!["compact", "recovered", "der"].includes(format))
    throw new Error('Signature format must be "compact", "recovered", or "der"');
  return format;
}
function validateSigOpts(opts, def) {
  validateObject(opts);
  const optsn = {};
  for (let optName of Object.keys(def)) {
    optsn[optName] = opts[optName] === undefined ? def[optName] : opts[optName];
  }
  abool(optsn.lowS, "lowS");
  abool(optsn.prehash, "prehash");
  if (optsn.format !== undefined)
    validateSigFormat(optsn.format);
  return optsn;
}
var _0n5 = /* @__PURE__ */ BigInt(0);
var _1n4 = /* @__PURE__ */ BigInt(1);
var _2n2 = /* @__PURE__ */ BigInt(2);
var _3n2 = /* @__PURE__ */ BigInt(3);
var _4n3 = /* @__PURE__ */ BigInt(4);
function weierstrass(params, extraOpts = {}) {
  const validated = createCurveFields("weierstrass", params, extraOpts);
  const Fp = validated.Fp;
  const Fn = validated.Fn;
  let CURVE = validated.CURVE;
  const { h: cofactor, n: CURVE_ORDER } = CURVE;
  validateObject(extraOpts, {}, {
    allowInfinityPoint: "boolean",
    clearCofactor: "function",
    isTorsionFree: "function",
    fromBytes: "function",
    toBytes: "function",
    endo: "object",
    randomBytes: "function"
  });
  const { endo: endoOpts, allowInfinityPoint, clearCofactor, isTorsionFree, fromBytes, toBytes } = extraOpts;
  const randomBytes = extraOpts.randomBytes === undefined ? randomBytes2 : extraOpts.randomBytes;
  if (endoOpts) {
    if (!Fp.is0(CURVE.a) || typeof endoOpts.beta !== "bigint" || !Array.isArray(endoOpts.basises)) {
      throw new Error('invalid endo: expected "beta": bigint and "basises": array');
    }
  }
  const endo = endoOpts ? {
    beta: endoOpts.beta,
    basises: endoOpts.basises.map((basis) => [...basis])
  } : undefined;
  const lengths = getWLengths(Fp, Fn);
  function assertCompressionIsSupported() {
    if (!Fp.isOdd)
      throw new Error("compression is not supported: Field does not have .isOdd()");
  }
  function pointToBytes(_c, point, isCompressed) {
    if (point.is0()) {
      if (!allowInfinityPoint)
        throw new Error("bad point: ZERO");
      return Uint8Array.of(0);
    }
    const { x, y } = point.toAffine();
    const bx = Fp.toBytes(x);
    abool(isCompressed, "isCompressed");
    if (isCompressed) {
      assertCompressionIsSupported();
      const hasEvenY = !Fp.isOdd(y);
      return concatBytes2(pprefix(hasEvenY), bx);
    } else {
      return concatBytes2(Uint8Array.of(4), bx, Fp.toBytes(y));
    }
  }
  function pointFromBytes(bytes) {
    abytes2(bytes, undefined, "Point");
    const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
    const length = bytes.length;
    const head = bytes[0];
    const tail = bytes.subarray(1);
    if (allowInfinityPoint && length === 1 && head === 0)
      return { x: Fp.ZERO, y: Fp.ZERO };
    if (length === comp && (head === 2 || head === 3)) {
      const x = Fp.fromBytes(tail);
      if (!Fp.isValid(x))
        throw new Error("bad point: is not on curve, wrong x");
      const y2 = weierstrassEquation(x);
      let y;
      try {
        y = Fp.sqrt(y2);
      } catch (sqrtError) {
        const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
        throw new Error("bad point: is not on curve, sqrt error" + err);
      }
      assertCompressionIsSupported();
      const evenY = Fp.isOdd(y);
      const evenH = (head & 1) === 1;
      if (evenH !== evenY)
        y = Fp.neg(y);
      return { x, y };
    } else if (length === uncomp && head === 4) {
      const L = Fp.BYTES;
      const x = Fp.fromBytes(tail.subarray(0, L));
      const y = Fp.fromBytes(tail.subarray(L, L * 2));
      if (!isValidXY(x, y))
        throw new Error("bad point: is not on curve");
      return { x, y };
    } else {
      throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
    }
  }
  const encodePoint = toBytes === undefined ? pointToBytes : toBytes;
  const decodePoint = fromBytes === undefined ? pointFromBytes : fromBytes;
  const b3 = Fp.mul(CURVE.b, _3n2);
  const mulA = Fp.is0(CURVE.a) ? (_) => Fp.ZERO : (x) => Fp.mul(CURVE.a, x);
  function weierstrassEquation(x) {
    const x2 = Fp.sqr(x);
    const x3 = Fp.mul(x2, x);
    return Fp.add(Fp.add(x3, Fp.mul(x, CURVE.a)), CURVE.b);
  }
  function isValidXY(x, y) {
    const left = Fp.sqr(y);
    const right = weierstrassEquation(x);
    return Fp.eql(left, right);
  }
  if (!isValidXY(CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n2), _4n3);
  const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
  if (Fp.is0(Fp.add(_4a3, _27b2)))
    throw new Error("bad curve params: a or b");
  function acoord(title, n, banZero = false) {
    if (!Fp.isValid(n) || banZero && Fp.is0(n))
      throw new Error(`bad point coordinate ${title}`);
    return typeof n === "object" && n !== null ? Fp.create(n) : n;
  }
  function aprjpoint(other) {
    if (!(other instanceof Point))
      throw new Error("Weierstrass Point expected");
  }
  function splitEndoScalarN(k) {
    if (!endo || !endo.basises)
      throw new Error("no endo");
    return _splitEndoScalar(k, endo.basises, Fn.ORDER);
  }
  function pushWnafPair(points, scalars, p, k) {
    if (!Fn.isValid(k))
      throw new RangeError("invalid scalar: out of range");
    if (endo) {
      const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(k);
      const psi = new Point(Fp.mul(p.X, endo.beta), p.Y, p.Z);
      points.push(k1neg ? p.negate() : p, k2neg ? psi.negate() : psi);
      scalars.push(k1, k2);
    } else {
      points.push(p);
      scalars.push(k);
    }
  }
  const validityCache = new WeakSet;

  class Point {
    static BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE);
    static ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ZERO);
    static Fp = Fp;
    static Fn = Fn;
    X;
    Y;
    Z;
    constructor(X, Y, Z) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y, true);
      this.Z = acoord("z", Z);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp.isValid(x) || !Fp.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof Point)
        throw new Error("projective point not allowed");
      if (Fp.is0(x) && Fp.is0(y))
        return Point.ZERO;
      return new Point(x, y, Fp.ONE);
    }
    static fromBytes(bytes) {
      const P = Point.fromAffine(decodePoint(abytes2(bytes, undefined, "point")));
      P.assertValidity();
      return P;
    }
    static fromHex(hex) {
      return Point.fromBytes(hexToBytes2(hex));
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    precompute(windowSize = 6, isLazy = true) {
      wnaf.setWindowSize(this, windowSize);
      if (!isLazy)
        this.multiply(_3n2);
      return this;
    }
    assertValidity() {
      const p = this;
      if (p.is0()) {
        if (allowInfinityPoint && Fp.is0(p.X) && Fp.eql(p.Y, Fp.ONE) && Fp.is0(p.Z))
          return;
        throw new Error("bad point: ZERO");
      }
      if (validityCache.has(p))
        return;
      const { x, y } = p.toAffine();
      if (!Fp.isValid(x) || !Fp.isValid(y))
        throw new Error("bad point: x or y not field elements");
      if (!isValidXY(x, y))
        throw new Error("bad point: equation left != right");
      if (!p.isTorsionFree())
        throw new Error("bad point: not in prime-order subgroup");
      validityCache.add(p);
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (!Fp.isOdd)
        throw new Error("Field doesn't support isOdd");
      return !Fp.isOdd(y);
    }
    equals(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
      const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
      return U1 && U2;
    }
    negate() {
      return new Point(this.X, Fp.neg(this.Y), this.Z);
    }
    double() {
      const { X: X1, Y: Y1, Z: Z1 } = this;
      let { ZERO: X3, ZERO: Y3, ZERO: Z3 } = Fp;
      let t0 = Fp.mul(X1, X1);
      let t1 = Fp.mul(Y1, Y1);
      let t2 = Fp.mul(Z1, Z1);
      let t3 = Fp.mul(X1, Y1);
      t3 = Fp.add(t3, t3);
      Z3 = Fp.mul(X1, Z1);
      Z3 = Fp.add(Z3, Z3);
      X3 = mulA(Z3);
      Y3 = Fp.mul(b3, t2);
      Y3 = Fp.add(X3, Y3);
      X3 = Fp.sub(t1, Y3);
      Y3 = Fp.add(t1, Y3);
      Y3 = Fp.mul(X3, Y3);
      X3 = Fp.mul(t3, X3);
      Z3 = Fp.mul(b3, Z3);
      t2 = mulA(t2);
      t3 = Fp.sub(t0, t2);
      t3 = mulA(t3);
      t3 = Fp.add(t3, Z3);
      Z3 = Fp.add(t0, t0);
      t0 = Fp.add(Z3, t0);
      t0 = Fp.add(t0, t2);
      t0 = Fp.mul(t0, t3);
      Y3 = Fp.add(Y3, t0);
      t2 = Fp.mul(Y1, Z1);
      t2 = Fp.add(t2, t2);
      t0 = Fp.mul(t2, t3);
      X3 = Fp.sub(X3, t0);
      Z3 = Fp.mul(t2, t1);
      Z3 = Fp.add(Z3, Z3);
      Z3 = Fp.add(Z3, Z3);
      return new Point(X3, Y3, Z3);
    }
    add(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      let { ZERO: X3, ZERO: Y3, ZERO: Z3 } = Fp;
      let t0 = Fp.mul(X1, X2);
      let t1 = Fp.mul(Y1, Y2);
      let t2 = Fp.mul(Z1, Z2);
      let t3 = Fp.add(X1, Y1);
      let t4 = Fp.add(X2, Y2);
      t3 = Fp.mul(t3, t4);
      t4 = Fp.add(t0, t1);
      t3 = Fp.sub(t3, t4);
      t4 = Fp.add(X1, Z1);
      let t5 = Fp.add(X2, Z2);
      t4 = Fp.mul(t4, t5);
      t5 = Fp.add(t0, t2);
      t4 = Fp.sub(t4, t5);
      t5 = Fp.add(Y1, Z1);
      X3 = Fp.add(Y2, Z2);
      t5 = Fp.mul(t5, X3);
      X3 = Fp.add(t1, t2);
      t5 = Fp.sub(t5, X3);
      Z3 = mulA(t4);
      X3 = Fp.mul(b3, t2);
      Z3 = Fp.add(X3, Z3);
      X3 = Fp.sub(t1, Z3);
      Z3 = Fp.add(t1, Z3);
      Y3 = Fp.mul(X3, Z3);
      t1 = Fp.add(t0, t0);
      t1 = Fp.add(t1, t0);
      t2 = mulA(t2);
      t4 = Fp.mul(b3, t4);
      t1 = Fp.add(t1, t2);
      t2 = Fp.sub(t0, t2);
      t2 = mulA(t2);
      t4 = Fp.add(t4, t2);
      t0 = Fp.mul(t1, t4);
      Y3 = Fp.add(Y3, t0);
      t0 = Fp.mul(t5, t4);
      X3 = Fp.mul(t3, X3);
      X3 = Fp.sub(X3, t0);
      t0 = Fp.mul(t3, t1);
      Z3 = Fp.mul(t5, Z3);
      Z3 = Fp.add(Z3, t0);
      return new Point(X3, Y3, Z3);
    }
    subtract(other) {
      aprjpoint(other);
      return this.add(other.negate());
    }
    is0() {
      return this.equals(Point.ZERO);
    }
    multiply(scalar) {
      if (!Fn.isValidNot0(scalar))
        throw new RangeError("invalid scalar: out of range");
      const { p, f } = wnaf.mulSecret(this, scalar, cofactor, normalize);
      return normalize([p, f])[0];
    }
    multiplyUnsafe(scalar) {
      const p = this;
      const sc = scalar;
      if (!Fn.isValid(sc))
        throw new RangeError("invalid scalar: out of range");
      if (sc === _0n5 || p.is0())
        return Point.ZERO;
      if (sc === _1n4)
        return p;
      if (wnaf.hasWindowSize(this))
        return wnaf.mulUnsafe(p, sc, normalize);
      const points = [];
      const scalars = [];
      pushWnafPair(points, scalars, p, sc);
      return mulAddUnsafe(Point, points, scalars);
    }
    mulAddUnsafe(a, other, b) {
      aprjpoint(other);
      const points = [];
      const scalars = [];
      pushWnafPair(points, scalars, this, a);
      pushWnafPair(points, scalars, other, b);
      return mulAddUnsafe(Point, points, scalars);
    }
    toAffine(invertedZ) {
      const p = this;
      let iz = invertedZ;
      if (iz != null && !Fp.isValid(iz))
        throw new RangeError('"invertedZ" expected valid field element');
      const { X, Y, Z } = p;
      if (Fp.eql(Z, Fp.ONE))
        return { x: X, y: Y };
      const is0 = p.is0();
      if (iz == null)
        iz = is0 ? Fp.ONE : Fp.inv(Z);
      const x = Fp.mul(X, iz);
      const y = Fp.mul(Y, iz);
      const zz = Fp.mul(Z, iz);
      if (is0)
        return { x: Fp.ZERO, y: Fp.ZERO };
      if (!Fp.eql(zz, Fp.ONE))
        throw new Error("invZ was invalid");
      return { x, y };
    }
    isTorsionFree() {
      if (cofactor === _1n4)
        return true;
      if (isTorsionFree)
        return isTorsionFree(Point, this);
      return wnaf.mulUnsafe(this, CURVE_ORDER).is0();
    }
    clearCofactor() {
      if (cofactor === _1n4)
        return this;
      if (clearCofactor)
        return clearCofactor(Point, this);
      return this.multiplyUnsafe(cofactor);
    }
    isSmallOrder() {
      if (cofactor === _1n4)
        return this.is0();
      return this.clearCofactor().is0();
    }
    toBytes(isCompressed = true) {
      abool(isCompressed, "isCompressed");
      this.assertValidity();
      return encodePoint(Point, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex2(this.toBytes(isCompressed));
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
  }
  const normalize = (points) => normalizeZ(Point, points);
  const wnaf = new ScalarMultiplier(Point, randomBytes);
  if (wnaf.bits >= 6)
    Point.BASE.precompute(6);
  Object.freeze(Point.prototype);
  Object.freeze(Point);
  return Point;
}
function pprefix(hasEvenY) {
  return Uint8Array.of(hasEvenY ? 2 : 3);
}
function getWLengths(Fp, Fn) {
  return {
    secretKey: Fn.BYTES,
    publicKey: 1 + Fp.BYTES,
    publicKeyUncompressed: 1 + 2 * Fp.BYTES,
    publicKeyHasPrefix: true,
    signature: 2 * Fn.BYTES
  };
}
function ecdh(Point, ecdhOpts = {}) {
  validatePointCons(Point);
  const { Fn } = Point;
  const randomBytes_ = ecdhOpts.randomBytes === undefined ? randomBytes2 : ecdhOpts.randomBytes;
  const lengths = Object.assign(getWLengths(Point.Fp, Fn), {
    seed: Math.max(getMinHashLength(Fn.ORDER), 16)
  });
  function isValidSecretKey(secretKey) {
    try {
      const num = Fn.fromBytes(secretKey);
      return Fn.isValidNot0(num);
    } catch (error) {
      return false;
    }
  }
  function isValidPublicKey(publicKey, isCompressed) {
    const { publicKey: comp, publicKeyUncompressed } = lengths;
    try {
      const l = publicKey.length;
      if (isCompressed === true && l !== comp)
        return false;
      if (isCompressed === false && l !== publicKeyUncompressed)
        return false;
      return !Point.fromBytes(publicKey).is0();
    } catch (error) {
      return false;
    }
  }
  function randomSecretKey(seed) {
    seed = seed === undefined ? randomBytes_(lengths.seed) : seed;
    return mapHashToField(abytes2(seed, lengths.seed, "seed"), Fn.ORDER);
  }
  function getPublicKey(secretKey, isCompressed = true) {
    return Point.BASE.multiply(Fn.fromBytes(secretKey)).toBytes(isCompressed);
  }
  function isProbPub(item) {
    const { secretKey, publicKey, publicKeyUncompressed } = lengths;
    const allowedLengths = Fn._lengths;
    if (!isBytes2(item))
      return;
    const l = abytes2(item, undefined, "key").length;
    const isPub = l === publicKey || l === publicKeyUncompressed;
    const isSec = l === secretKey || !!allowedLengths?.includes(l);
    if (isPub && isSec)
      return;
    return isPub;
  }
  function getSharedSecret(secretKeyA, publicKeyB, isCompressed = true) {
    if (isProbPub(secretKeyA) === true)
      throw new Error("first arg must be private key");
    if (isProbPub(publicKeyB) === false)
      throw new Error("second arg must be public key");
    const s = Fn.fromBytes(secretKeyA);
    const b = Point.fromBytes(publicKeyB);
    if (b.is0())
      throw new Error("invalid public key: point at infinity");
    return b.multiply(s).toBytes(isCompressed);
  }
  const utils = {
    isValidSecretKey,
    isValidPublicKey,
    randomSecretKey
  };
  const keygen = createKeygen(randomSecretKey, getPublicKey);
  Object.freeze(utils);
  Object.freeze(lengths);
  return Object.freeze({ getPublicKey, getSharedSecret, keygen, Point, utils, lengths });
}
function ecdsa(Point, hash, ecdsaOpts = {}) {
  validatePointCons(Point);
  const hash_ = hash;
  ahash(hash_);
  validateObject(ecdsaOpts, {}, {
    hmac: "function",
    lowS: "boolean",
    randomBytes: "function",
    bits2int: "function",
    bits2int_modN: "function"
  });
  const opts = Object.assign({}, ecdsaOpts);
  const randomBytes = opts.randomBytes === undefined ? randomBytes2 : opts.randomBytes;
  const hmac2 = opts.hmac === undefined ? (key, msg) => hmac(hash_, key, msg) : opts.hmac;
  const { Fp, Fn } = Point;
  const { ORDER: CURVE_ORDER, BITS: fnBits } = Fn;
  const blindLength = getMinHashLength(CURVE_ORDER);
  const csprng = probeRandomBytes(randomBytes, blindLength);
  const { keygen, getPublicKey, getSharedSecret, utils, lengths } = ecdh(Point, opts);
  const defaultSigOpts = {
    prehash: true,
    lowS: typeof opts.lowS === "boolean" ? opts.lowS : true,
    format: "compact",
    extraEntropy: false
  };
  const hasLargeRecoveryLifts = CURVE_ORDER * _2n2 + _1n4 < Fp.ORDER;
  function isBiggerThanHalfOrder(number) {
    const HALF = CURVE_ORDER >> _1n4;
    return number > HALF;
  }
  function validateRS(title, num) {
    if (!Fn.isValidNot0(num))
      throw new Error(`invalid signature ${title}: out of range 1..Point.Fn.ORDER`);
    return num;
  }
  function assertFieldSignIsSupported() {
    if (!Fp.isOdd)
      throw new Error("Field doesn't support isOdd");
  }
  function getRecoveryBit(x, y, r) {
    assertFieldSignIsSupported();
    return (x === r ? 0 : 2) | Number(Fp.isOdd(y));
  }
  function assertRecoverableCurve() {
    if (hasLargeRecoveryLifts)
      throw new Error('"recovered" sig type is not supported for cofactor >2 curves');
  }
  function validateSigLength(bytes, format) {
    validateSigFormat(format);
    const size = lengths.signature;
    const sizer = format === "compact" ? size : format === "recovered" ? size + 1 : undefined;
    return abytes2(bytes, sizer);
  }

  class Signature {
    r;
    s;
    recovery;
    constructor(r, s, recovery) {
      this.r = validateRS("r", r);
      this.s = validateRS("s", s);
      if (recovery != null) {
        assertRecoverableCurve();
        if (![0, 1, 2, 3].includes(recovery))
          throw new Error("invalid recovery id");
        this.recovery = recovery;
      }
      Object.freeze(this);
    }
    static fromBytes(bytes, format = defaultSigOpts.format) {
      validateSigLength(bytes, format);
      let recid;
      if (format === "der") {
        if (bytes.length > 2 * Fn.BYTES + 16)
          throw new DER.Err("invalid signature: DER signature too long");
        const { r, s } = DER.toSig(abytes2(bytes), Fn.BYTES + 1);
        return new Signature(r, s);
      }
      if (format === "recovered") {
        recid = bytes[0];
        format = "compact";
        bytes = bytes.subarray(1);
      }
      const L = lengths.signature / 2;
      const r = bytes.subarray(0, L);
      const s = bytes.subarray(L, L * 2);
      return new Signature(Fn.fromBytes(r), Fn.fromBytes(s), recid);
    }
    static fromHex(hex, format) {
      return this.fromBytes(hexToBytes2(hex), format);
    }
    assertRecovery() {
      const { recovery } = this;
      if (recovery == null)
        throw new Error("invalid recovery id: must be present");
      return recovery;
    }
    addRecoveryBit(recovery) {
      return new Signature(this.r, this.s, recovery);
    }
    recoverPublicKey(messageHash) {
      const { r, s } = this;
      const recovery = this.assertRecovery();
      const radj = recovery === 2 || recovery === 3 ? r + CURVE_ORDER : r;
      if (!Fp.isValid(radj))
        throw new Error("invalid recovery id: sig.r+curve.n != R.x");
      const x = Fp.toBytes(radj);
      const R = Point.fromBytes(concatBytes2(pprefix((recovery & 1) === 0), x));
      const ir = Fn.inv(radj);
      const h = bits2int_modN(abytes2(messageHash, undefined, "msgHash"));
      const u1 = Fn.create(-h * ir);
      const u2 = Fn.create(s * ir);
      const Q = Point.BASE.mulAddUnsafe(u1, R, u2);
      if (Q.is0())
        throw new Error("invalid recovery: point at infinify");
      Q.assertValidity();
      return Q;
    }
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    toBytes(format = defaultSigOpts.format) {
      validateSigFormat(format);
      if (format === "der")
        return hexToBytes2(DER.hexFromSig(this));
      const { r, s } = this;
      const rb = Fn.toBytes(r);
      const sb = Fn.toBytes(s);
      if (format === "recovered") {
        assertRecoverableCurve();
        return concatBytes2(Uint8Array.of(this.assertRecovery()), rb, sb);
      }
      return concatBytes2(rb, sb);
    }
    toHex(format) {
      return bytesToHex2(this.toBytes(format));
    }
  }
  Object.freeze(Signature.prototype);
  Object.freeze(Signature);
  const bits2int = opts.bits2int === undefined ? function bits2int_def(bytes) {
    if (bytes.length > 8192)
      throw new Error("input is too large");
    const num = bytesToNumberBE(bytes);
    const delta = bytes.length * 8 - fnBits;
    return delta > 0 ? num >> BigInt(delta) : num;
  } : opts.bits2int;
  const bits2int_modN = opts.bits2int_modN === undefined ? function bits2int_modN_def(bytes) {
    return Fn.create(bits2int(bytes));
  } : opts.bits2int_modN;
  const ORDER_MASK = bitMask(fnBits);
  function int2octets(num) {
    aInRange("num < 2^" + fnBits, num, _0n5, ORDER_MASK);
    return Fn.toBytes(num);
  }
  function validateMsgAndHash(message, prehash) {
    abytes2(message, undefined, "message");
    return prehash ? abytes2(hash_(message), undefined, "prehashed message") : message;
  }
  function prepSig(message, secretKey, opts) {
    const { lowS, prehash, extraEntropy } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    const h1int = bits2int_modN(message);
    const d = Fn.fromBytes(secretKey);
    if (!Fn.isValidNot0(d))
      throw new Error("invalid private key");
    const seedArgs = [int2octets(d), int2octets(h1int)];
    if (extraEntropy != null && extraEntropy !== false) {
      const e = extraEntropy === true ? randomBytes(lengths.secretKey) : extraEntropy;
      seedArgs.push(abytes2(e, undefined, "extraEntropy"));
    }
    const seed = concatBytes2(...seedArgs);
    const m = h1int;
    function k2sig(kBytes) {
      const k = bits2int(kBytes);
      if (!Fn.isValidNot0(k))
        return;
      const q = Point.BASE.multiply(k).toAffine();
      const r = Fn.create(q.x);
      if (r === _0n5)
        return;
      let s;
      if (csprng !== undefined) {
        const b = bytesToNumberBE(mapHashToField(csprng(blindLength), CURVE_ORDER));
        const ibk = Fn.inv(Fn.mul(b, k));
        const bm = Fn.mul(b, m);
        const bd = Fn.mul(b, d);
        s = Fn.create(ibk * Fn.create(bm + bd * r));
      } else {
        const ik = invertCt(k, CURVE_ORDER);
        s = Fn.create(ik * Fn.create(m + r * d));
      }
      if (s === _0n5)
        return;
      let recovery = getRecoveryBit(q.x, q.y, r);
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = Fn.neg(s);
        recovery ^= 1;
      }
      return new Signature(r, normS, hasLargeRecoveryLifts ? undefined : recovery);
    }
    return { seed, k2sig };
  }
  function sign(message, secretKey, opts = {}) {
    const { seed, k2sig } = prepSig(message, secretKey, opts);
    const drbg = createHmacDrbg(hash_.outputLen, Fn.BYTES, hmac2);
    const sig = drbg(seed, k2sig);
    return sig.toBytes(opts.format);
  }
  function verify(signature, message, publicKey, opts = {}) {
    const { lowS, prehash, format } = validateSigOpts(opts, defaultSigOpts);
    publicKey = abytes2(publicKey, undefined, "publicKey");
    message = validateMsgAndHash(message, prehash);
    if (!isBytes2(signature)) {
      const end = signature instanceof Signature ? ", use sig.toBytes()" : "";
      throw new Error("verify expects Uint8Array signature" + end);
    }
    validateSigLength(signature, format);
    try {
      const sig = Signature.fromBytes(signature, format);
      const P = Point.fromBytes(publicKey);
      if (P.is0())
        return false;
      if (lowS && sig.hasHighS())
        return false;
      const { r, s } = sig;
      const h = bits2int_modN(message);
      const is = Fn.inv(s);
      const u1 = Fn.create(h * is);
      const u2 = Fn.create(r * is);
      const R = Point.BASE.mulAddUnsafe(u1, P, u2);
      if (R.is0())
        return false;
      const q = R.toAffine();
      const v = Fn.create(q.x);
      if (v !== r)
        return false;
      if (format === "recovered" && sig.recovery !== getRecoveryBit(q.x, q.y, r))
        return false;
      return true;
    } catch (e) {
      return false;
    }
  }
  function recoverPublicKey(signature, message, opts = {}) {
    const { prehash } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    return Signature.fromBytes(signature, "recovered").recoverPublicKey(message).toBytes();
  }
  return Object.freeze({
    keygen,
    getPublicKey,
    getSharedSecret,
    utils,
    lengths,
    Point,
    sign,
    verify,
    recoverPublicKey,
    Signature,
    hash: hash_
  });
}

// node_modules/@noble/curves/secp256k1.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var secp256k1_CURVE = {
  p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),
  n: BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),
  h: BigInt(1),
  a: BigInt(0),
  b: BigInt(7),
  Gx: BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"),
  Gy: BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")
};
var secp256k1_ENDO = {
  beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
  basises: [
    [BigInt("0x3086d221a7d46bcde86c90e49284eb15"), -BigInt("0xe4437ed6010e88286f547fa90abfe4c3")],
    [BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"), BigInt("0x3086d221a7d46bcde86c90e49284eb15")]
  ]
};
var _0n6 = /* @__PURE__ */ BigInt(0);
var _2n3 = /* @__PURE__ */ BigInt(2);
function sqrtMod(y) {
  const P = secp256k1_CURVE.p;
  const _3n = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
  const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
  const b2 = y * y * y % P;
  const b3 = b2 * b2 * y % P;
  const b6 = pow2(b3, _3n, P) * b3 % P;
  const b9 = pow2(b6, _3n, P) * b3 % P;
  const b11 = pow2(b9, _2n3, P) * b2 % P;
  const b22 = pow2(b11, _11n, P) * b11 % P;
  const b44 = pow2(b22, _22n, P) * b22 % P;
  const b88 = pow2(b44, _44n, P) * b44 % P;
  const b176 = pow2(b88, _88n, P) * b88 % P;
  const b220 = pow2(b176, _44n, P) * b44 % P;
  const b223 = pow2(b220, _3n, P) * b3 % P;
  const t1 = pow2(b223, _23n, P) * b22 % P;
  const t2 = pow2(t1, _6n, P) * b2 % P;
  const root = pow2(t2, _2n3, P);
  if (!Fpk1.eql(Fpk1.sqr(root), y))
    throw new Error("Cannot find square root");
  return root;
}
var Fpk1 = /* @__PURE__ */ Field(secp256k1_CURVE.p, { sqrt: sqrtMod });
var Pointk1 = /* @__PURE__ */ weierstrass(secp256k1_CURVE, {
  Fp: Fpk1,
  endo: secp256k1_ENDO
});
var secp256k1 = /* @__PURE__ */ ecdsa(Pointk1, sha256);
var TAGGED_HASH_PREFIXES = Object.create(null);
function taggedHash(tag, ...messages) {
  let tagP = TAGGED_HASH_PREFIXES[tag];
  if (tagP === undefined) {
    const tagH = sha256(asciiToBytes(tag));
    tagP = concatBytes2(tagH, tagH);
    TAGGED_HASH_PREFIXES[tag] = tagP;
  }
  return sha256(concatBytes2(tagP, ...messages));
}
var pointToBytes = (point) => point.toBytes(true).slice(1);
var affineXToBytes = ({ x }) => Fpk1.toBytes(x);
var hasEven = (y) => !Fpk1.isOdd(y);
function schnorrGetExtPubKey(priv) {
  const { Fn, BASE } = Pointk1;
  const d_ = Fn.fromBytes(abytes2(priv, 32, "secretKey"));
  const p = BASE.multiply(d_);
  const affine = p.toAffine();
  const scalar = hasEven(affine.y) ? d_ : Fn.neg(d_);
  return { scalar, bytes: affineXToBytes(affine) };
}
function lift_x(x) {
  const Fp = Fpk1;
  if (!Fp.isValidNot0(x))
    throw new Error("invalid x: Fail if x ≥ p");
  const xx = Fp.sqr(x);
  const c = Fp.add(Fp.mulN(xx, x), BigInt(7));
  let y = Fp.sqrt(c);
  if (!hasEven(y))
    y = Fp.neg(y);
  const p = Pointk1.fromAffine({ x, y });
  p.assertValidity();
  return p;
}
var num = bytesToNumberBE;
function challenge(...args) {
  return Pointk1.Fn.create(num(taggedHash("BIP0340/challenge", ...args)));
}
function schnorrGetPublicKey(secretKey) {
  return schnorrGetExtPubKey(secretKey).bytes;
}
function schnorrSign(message, secretKey, auxRand = randomBytes(32)) {
  const { Fn, BASE } = Pointk1;
  const m = copyBytes(abytes2(message, undefined, "message"));
  const { bytes: px, scalar: d } = schnorrGetExtPubKey(secretKey);
  const a = abytes2(auxRand, 32, "auxRand");
  const t = Fn.toBytes(d ^ num(taggedHash("BIP0340/aux", a)));
  const rand = taggedHash("BIP0340/nonce", t, px, m);
  const k_ = Fn.create(num(rand));
  if (k_ === _0n6)
    throw new Error("sign failed: k is zero");
  const p = BASE.multiply(k_);
  const affine = p.toAffine();
  const k = hasEven(affine.y) ? k_ : Fn.neg(k_);
  const rx = affineXToBytes(affine);
  const e = challenge(rx, px, m);
  const sig = new Uint8Array(64);
  sig.set(rx, 0);
  sig.set(Fn.toBytes(Fn.create(k + e * d)), 32);
  if (!schnorrVerify(sig, m, px))
    throw new Error("sign: Invalid signature produced");
  return sig;
}
function schnorrVerify(signature, message, publicKey) {
  const { Fp, Fn, BASE } = Pointk1;
  const sig = abytes2(signature, 64, "signature");
  const m = abytes2(message, undefined, "message");
  const pub = abytes2(publicKey, 32, "publicKey");
  try {
    const P = lift_x(num(pub));
    const rBytes = sig.subarray(0, 32);
    const r = num(rBytes);
    if (!Fp.isValidNot0(r))
      return false;
    const s = num(sig.subarray(32, 64));
    if (!Fn.isValidNot0(s))
      return false;
    const e = challenge(rBytes, pointToBytes(P), m);
    const R = BASE.mulAddUnsafe(s, P, Fn.neg(e));
    const { x, y } = R.toAffine();
    if (R.is0() || !hasEven(y) || !Fp.eql(x, r))
      return false;
    return true;
  } catch (error) {
    return false;
  }
}
var schnorr = /* @__PURE__ */ (() => {
  const size = 32;
  const seedLength = 48;
  const randomSecretKey = (seed) => {
    seed = seed === undefined ? randomBytes(seedLength) : seed;
    return mapHashToField(abytes2(seed, seedLength, "seed"), secp256k1_CURVE.n);
  };
  return Object.freeze({
    keygen: createKeygen(randomSecretKey, schnorrGetPublicKey),
    getPublicKey: schnorrGetPublicKey,
    sign: schnorrSign,
    verify: schnorrVerify,
    Point: Pointk1,
    utils: Object.freeze({
      randomSecretKey,
      taggedHash,
      lift_x,
      pointToBytes
    }),
    lengths: Object.freeze({
      secretKey: size,
      publicKey: size,
      publicKeyHasPrefix: false,
      signature: size * 2,
      seed: seedLength
    })
  });
})();

// src/constants.ts
var PLUGIN_ID = "io.github.frankhommers.selfhosted-agents";
var TYPE_ID = "agent";
var RUNTIME = `${PLUGIN_ID}/agent`;
var STORAGE_PREFIX = `${PLUGIN_ID}:v1:`;
var BLOCK_INFO = "selfhosted-agents";
var ADOPTED_SLOT = "adopted";

// node_modules/@scure/base/index.js
/*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var freeze = (fn) => Object.freeze(fn());
function isBytes3(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
function abytes3(b) {
  if (!isBytes3(b))
    throw new TypeError("Uint8Array expected");
}
function isArrayOf(isString, arr) {
  if (!Array.isArray(arr))
    return false;
  if (arr.length === 0)
    return true;
  if (isString) {
    return arr.every((item) => typeof item === "string");
  } else {
    return arr.every((item) => Number.isSafeInteger(item));
  }
}
function afn(input) {
  if (typeof input !== "function")
    throw new TypeError("function expected");
  return true;
}
function astr(label, input) {
  if (typeof input !== "string")
    throw new TypeError(`${label}: string expected`);
  return true;
}
function anumber3(n, title = "number") {
  if (typeof n !== "number")
    throw new TypeError(`${title}: expected number, got ${typeof n}`);
  if (!Number.isSafeInteger(n))
    throw new RangeError(`${title}: expected safe integer, got ${n}`);
}
function anumArr(label, input) {
  if (!isArrayOf(false, input))
    throw new TypeError(`${label}: array of numbers expected`);
}
function chain(...args) {
  const id = (a) => a;
  const wrap = (a, b) => (c) => a(b(c));
  const encode = args.map((x) => x.encode).reduceRight(wrap, id);
  const decode = args.map((x) => x.decode).reduce(wrap, id);
  return { encode, decode };
}
var powers = /* @__PURE__ */ (() => {
  let res = [];
  for (let i = 0;i < 40; i++)
    res.push(2 ** i);
  return res;
})();
function u8ToNumArr(u8, len = u8.length) {
  const res = new Array(len);
  for (let i = 0;i < len; i++)
    res[i] = u8[i];
  return res;
}
var asciiDecoder = /* @__PURE__ */ (() => {
  try {
    const decoder = new TextDecoder;
    return decoder.decode(Uint8Array.of(65, 48, 43, 127)) === "A0+" ? decoder : undefined;
  } catch (e) {
    return;
  }
})();
var B2S_CHUNK = 8192;
function charcodesToString(codes) {
  const len = codes.length;
  if (asciiDecoder !== undefined && len >= 12)
    return asciiDecoder.decode(codes);
  if (len <= B2S_CHUNK)
    return String.fromCharCode.apply(null, codes);
  let res = "";
  for (let i = 0;i < len; i += B2S_CHUNK)
    res += String.fromCharCode.apply(null, codes.subarray(i, i + B2S_CHUNK));
  return res;
}
function radix2(bits) {
  anumber3(bits);
  if (bits <= 0 || bits > 8)
    throw new RangeError("radix2: bits should be in (0..8]");
  const mask = powers[bits] - 1;
  return {
    encode: (bytes) => {
      abytes3(bytes);
      const len = bytes.length;
      const res = new Uint8Array(Math.ceil(len * 8 / bits));
      let carry = 0;
      let pos = 0;
      let j = 0;
      for (let i = 0;i < len; ) {
        if (i + 2 < len) {
          carry = carry << 24 | bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
          pos += 24;
          i += 3;
        } else {
          carry = (carry << 8 | bytes[i]) & 65535;
          pos += 8;
          i++;
        }
        for (;; ) {
          pos -= bits;
          res[j++] = carry >> pos & mask;
          if (pos < bits)
            break;
        }
      }
      if (pos > 0)
        res[j] = carry << bits - pos & mask;
      return res;
    },
    decode: (digits) => {
      const len = digits.length;
      const res = new Uint8Array(Math.floor(len * bits / 8));
      let carry = 0;
      let pos = 0;
      let j = 0;
      for (let i = 0;i < len; i++) {
        carry = (carry << bits | digits[i]) & 65535;
        pos += bits;
        for (;pos >= 8; pos -= 8)
          res[j++] = carry >> pos - 8 & 255;
      }
      carry = carry << 8 - pos & 255;
      if (pos >= bits)
        throw new Error("Excess padding");
      if (carry > 0)
        throw new Error(`Non-zero padding: ${carry}`);
      return res;
    }
  };
}
function alphabet(letters, aliases) {
  const len = letters.length;
  if (len > 128)
    throw new Error("alphabet: max 128 letters");
  const encTable = new Uint8Array(len);
  const decTable = new Int8Array(128).fill(-1);
  for (let i = 0;i < len; i++) {
    const code = letters.charCodeAt(i);
    if (letters.codePointAt(i) !== code || code > 127)
      throw new Error("alphabet: single-char ASCII letters only");
    encTable[i] = code;
    decTable[code] = i;
  }
  if (aliases !== undefined) {
    for (const alias of Object.keys(aliases)) {
      const code = alias.charCodeAt(0);
      const target = decTable[aliases[alias].charCodeAt(0)];
      if (alias.length !== 1 || code > 127 || target === undefined || target === -1)
        throw new Error(`alphabet: invalid alias ${alias}`);
      decTable[code] = target;
    }
  }
  return {
    encode: (digits) => {
      const codes = new Uint8Array(digits.length);
      for (let i = 0;i < digits.length; i++) {
        const d = digits[i];
        const code = encTable[d];
        if (code === undefined)
          throw new Error(`alphabet.encode: invalid digit ${d}`);
        codes[i] = code;
      }
      return charcodesToString(codes);
    },
    decode: (input) => {
      astr("decode", input);
      const slen = input.length;
      const digits = new Uint8Array(slen);
      for (let i = 0;i < slen; i++) {
        const code = input.charCodeAt(i);
        const digit = code < 128 ? decTable[code] : -1;
        if (digit === -1)
          throw new Error(`Unknown letter "${input[i]}". Allowed: ${letters}`);
        digits[i] = digit;
      }
      return digits;
    }
  };
}
function padding(bits, chr = "=") {
  anumber3(bits);
  astr("padding", chr);
  return {
    encode(data) {
      while (data.length * bits % 8)
        data += chr;
      return data;
    },
    decode(input) {
      astr("decode", input);
      let end = input.length;
      if (end * bits % 8)
        throw new Error("padding: invalid length");
      for (;end > 0 && input[end - 1] === chr; end--) {
        const byte = (end - 1) * bits;
        if (byte % 8 === 0)
          throw new Error("padding: excess padding");
      }
      return input.slice(0, end);
    }
  };
}
function unsafeWrapper(fn) {
  afn(fn);
  return function(...args) {
    try {
      return fn.apply(null, args);
    } catch (e) {}
  };
}
var hasBase64Builtin = /* @__PURE__ */ (() => typeof Uint8Array.from([]).toBase64 === "function" && typeof Uint8Array.fromBase64 === "function")();
var ASCII_WHITESPACE = /[\t\n\f\r ]/;
var decodeBase64Builtin = (s, isUrl) => {
  astr("base64", s);
  const alphabet = isUrl ? "base64url" : "base64";
  if (s.length > 0 && ASCII_WHITESPACE.test(s))
    throw new Error("invalid base64");
  return Uint8Array.fromBase64(s, { alphabet, lastChunkHandling: "strict" });
};
var base64Fallback = /* @__PURE__ */ freeze(() => chain(radix2(6), alphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"), padding(6)));
var base64 = /* @__PURE__ */ freeze(() => hasBase64Builtin ? {
  encode(b) {
    abytes3(b);
    return b.toBase64();
  },
  decode(s) {
    return decodeBase64Builtin(s, false);
  }
} : base64Fallback);
var base64nopad = /* @__PURE__ */ freeze(() => chain(radix2(6), alphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/")));
var BECH_ALPHABET = /* @__PURE__ */ alphabet("qpzry9x8gf2tvdw0s3jn54khce6mua7l");
var BECH_UPPERCASE_PRINTABLE = /^[\x21-\x60\x7b-\x7e]+$/;
function assertBech32Printable(label, value) {
  for (let i = 0;i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 33 || c > 126)
      throw new Error(`${label}: printable ASCII expected`);
  }
}
function wordsToU8(words) {
  const len = words.length;
  const res = new Uint8Array(len);
  for (let i = 0;i < len; i++) {
    const w = words[i];
    if (w < 0 || w >= 32)
      throw new Error(`alphabet.encode: invalid digit ${w}`);
    res[i] = w;
  }
  return res;
}
var POLYMOD_GENERATORS = [996825010, 642813549, 513874426, 1027748829, 705979059];
function bech32Polymod(pre) {
  const b = pre >> 25;
  let chk = (pre & 33554431) << 5;
  for (let i = 0;i < POLYMOD_GENERATORS.length; i++) {
    if ((b >> i & 1) === 1)
      chk ^= POLYMOD_GENERATORS[i];
  }
  return chk;
}
function bechChecksum(prefix, words, encodingConst = 1) {
  const len = prefix.length;
  let chk = 1;
  for (let i = 0;i < len; i++) {
    const c = prefix.charCodeAt(i);
    if (c < 33 || c > 126)
      throw new Error(`Invalid prefix (${prefix})`);
    chk = bech32Polymod(chk) ^ c >> 5;
  }
  chk = bech32Polymod(chk);
  for (let i = 0;i < len; i++)
    chk = bech32Polymod(chk) ^ prefix.charCodeAt(i) & 31;
  for (let v of words)
    chk = bech32Polymod(chk) ^ v;
  for (let i = 0;i < 6; i++)
    chk = bech32Polymod(chk);
  chk ^= encodingConst;
  const sum = new Uint8Array(6);
  for (let i = 0;i < 6; i++)
    sum[i] = chk >>> 5 * (5 - i) & 31;
  return BECH_ALPHABET.encode(sum);
}
function genBech32(encoding) {
  const ENCODING_CONST = encoding === "bech32" ? 1 : 734539939;
  const _words = radix2(5);
  const toWords = (from) => {
    abytes3(from);
    const len = from.length;
    const res = new Array(Math.ceil(len * 8 / 5));
    let carry = 0;
    let pos = 0;
    let j = 0;
    for (let i = 0;i < len; i++) {
      carry = carry << 8 | from[i];
      pos += 8;
      for (;pos >= 5; pos -= 5)
        res[j++] = carry >> pos - 5 & 31;
    }
    if (pos > 0)
      res[j] = carry << 5 - pos & 31;
    return res;
  };
  const fromWords = (to) => {
    anumArr("radix2.decode", to);
    const len = to.length;
    const digits = new Uint8Array(len);
    for (let i = 0;i < len; i++) {
      const w = to[i];
      if (w < 0 || w >= 32)
        throw new Error(`convertRadix2: invalid word=${w}`);
      digits[i] = w;
    }
    return _words.decode(digits);
  };
  const fromWordsUnsafe = unsafeWrapper(fromWords);
  function encode(prefix, words, limit = 90) {
    astr("bech32.encode prefix", prefix);
    if (limit !== false)
      anumber3(limit, "limit");
    if (isBytes3(words))
      words = u8ToNumArr(words);
    anumArr("bech32.encode", words);
    const plen = prefix.length;
    if (plen === 0)
      throw new TypeError(`Invalid prefix length ${plen}`);
    const actualLength = plen + 7 + words.length;
    if (limit !== false && actualLength > limit)
      throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
    assertBech32Printable("bech32.encode prefix", prefix);
    const lowered = prefix.toLowerCase();
    const sum = bechChecksum(lowered, words, ENCODING_CONST);
    return `${lowered}1${BECH_ALPHABET.encode(wordsToU8(words))}${sum}`;
  }
  function decode(str, limit = 90) {
    astr("bech32.decode input", str);
    if (limit !== false)
      anumber3(limit, "limit");
    const slen = str.length;
    if (slen < 8 || limit !== false && slen > limit)
      throw new TypeError(`invalid string length ${slen}, expected (8..${limit})`);
    const lowered = str.toLowerCase();
    if (str !== lowered) {
      if (!BECH_UPPERCASE_PRINTABLE.test(str)) {
        assertBech32Printable("bech32.decode input", str);
        throw new Error(`mixed-case string not allowed`);
      }
    }
    const sepIndex = lowered.lastIndexOf("1");
    if (sepIndex === 0 || sepIndex === -1)
      throw new Error(`invalid separator "1"`);
    const prefix = lowered.slice(0, sepIndex);
    const data = lowered.slice(sepIndex + 1);
    if (data.length < 6)
      throw new Error("invalid data length");
    const digits = BECH_ALPHABET.decode(data);
    const words = u8ToNumArr(digits, digits.length - 6);
    const sum = bechChecksum(prefix, words, ENCODING_CONST);
    if (!data.endsWith(sum))
      throw new Error(`Invalid checksum in ${str}`);
    return { prefix, words };
  }
  const decodeUnsafe = unsafeWrapper(decode);
  function decodeToBytes(str, limit = 90) {
    const { prefix, words } = decode(str, limit);
    return {
      prefix,
      words,
      bytes: fromWords(words)
    };
  }
  function encodeFromBytes(prefix, bytes) {
    return encode(prefix, toWords(bytes));
  }
  return {
    encode,
    decode,
    encodeFromBytes,
    decodeToBytes,
    decodeUnsafe,
    fromWords,
    fromWordsUnsafe,
    toWords
  };
}
var bech32 = /* @__PURE__ */ freeze(() => genBech32("bech32"));

// src/core/keys.ts
var HEX64_PATTERN = /^[0-9a-f]{64}$/;
var BECH32_LIMIT = 1023;
var SECRET_KEY_LENGTH = 32;
var isHex64 = (value) => HEX64_PATTERN.test(value);
var generateSecretKey = () => schnorr.utils.randomSecretKey();
var publicKeyHex = (secret) => bytesToHex(schnorr.getPublicKey(secret));
var encodeNsec = (secret) => {
  if (secret.length !== SECRET_KEY_LENGTH || !secp256k1.utils.isValidSecretKey(secret))
    throw new Error("not a valid secret key");
  return bech32.encode("nsec", bech32.toWords(secret), BECH32_LIMIT);
};
var encodeNpub = (pubHex) => {
  if (!isHex64(pubHex))
    throw new Error("public key must be 64 lowercase hex characters");
  return bech32.encode("npub", bech32.toWords(hexToBytes(pubHex)), BECH32_LIMIT);
};
var decodeNpub = (npub) => {
  const decoded = bech32.decode(npub, BECH32_LIMIT);
  if (decoded.prefix !== "npub")
    throw new Error("not an npub");
  const bytes = bech32.fromWords(decoded.words);
  if (bytes.length !== 32)
    throw new Error("npub must encode 32 bytes");
  return bytesToHex(bytes);
};

// src/core/nipoa.ts
var HEX64_PATTERN2 = /^[0-9a-f]{64}$/;
var HEX128_PATTERN = /^[0-9a-f]{128}$/;
var CANONICAL_NUMBER_PATTERN = /^(0|[1-9][0-9]*)$/;
var MAX_KIND = 65535;
var MAX_CREATED_AT = 4294967295;
var MESSAGE_PREFIX = "nostr:agent-auth:";
var isBoundedNumber = (digits, max) => CANONICAL_NUMBER_PATTERN.test(digits) && Number(digits) <= max;
var isValidClause = (clause) => {
  if (clause.startsWith("kind="))
    return isBoundedNumber(clause.slice(5), MAX_KIND);
  if (clause.startsWith("created_at<") || clause.startsWith("created_at>")) {
    return isBoundedNumber(clause.slice(11), MAX_CREATED_AT);
  }
  return false;
};
var isValidConditions = (conditions) => conditions === "" || conditions.split("&").every(isValidClause);
var parseNipOaTag = (value) => {
  if (!Array.isArray(value) || value.length !== 4)
    return;
  const [name, owner, conditions, signature] = value;
  if (name !== "auth")
    return;
  if (typeof owner !== "string" || !HEX64_PATTERN2.test(owner))
    return;
  if (typeof conditions !== "string" || !isValidConditions(conditions))
    return;
  if (typeof signature !== "string" || !HEX128_PATTERN.test(signature))
    return;
  return ["auth", owner, conditions, signature];
};
var verifyNipOa = (tag, agentPubkey) => {
  const [, owner, conditions, signature] = tag;
  if (!HEX64_PATTERN2.test(owner) || !HEX64_PATTERN2.test(agentPubkey))
    return false;
  if (!HEX128_PATTERN.test(signature) || !isValidConditions(conditions))
    return false;
  if (owner === agentPubkey)
    return false;
  const message = sha256(new TextEncoder().encode(`${MESSAGE_PREFIX}${agentPubkey}:${conditions}`));
  try {
    return schnorr.verify(hexToBytes(signature), message, hexToBytes(owner));
  } catch {
    return false;
  }
};

// src/core/events.ts
var PROFILE_KIND = 0;
var AUTH_KIND = 22242;
var OWNED_TAGS = new Set(["d", "runtime", "client-id"]);
var eventId = (e) => bytesToHex(sha256(new TextEncoder().encode(JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]))));
var signEvent = (secret, unsigned) => {
  const id = eventId(unsigned);
  const sig = bytesToHex(schnorr.sign(hexToBytes(id), secret));
  return { id, ...unsigned, sig };
};
var buildAuthEvent = (secret, relay, challenge, auth, createdAt) => signEvent(secret, {
  pubkey: publicKeyHex(secret),
  created_at: createdAt,
  kind: AUTH_KIND,
  tags: [["relay", relay], ["challenge", challenge], [...auth]],
  content: ""
});
var buildAgentProfile = (input) => {
  const content = JSON.stringify({
    name: input.name,
    display_name: input.name,
    ...input.picture === undefined ? {} : { picture: input.picture },
    bot: true
  });
  return signEvent(input.secret, {
    pubkey: publicKeyHex(input.secret),
    created_at: input.createdAt,
    kind: PROFILE_KIND,
    tags: [[...input.auth]],
    content
  });
};
var verifyEvent = (e) => {
  try {
    if (eventId(e) !== e.id)
      return false;
    return schnorr.verify(hexToBytes(e.sig), hexToBytes(e.id), hexToBytes(e.pubkey));
  } catch {
    return false;
  }
};
var satisfiesConditions = (conditions, e) => conditions === "" || conditions.split("&").every((clause) => {
  if (clause.startsWith("kind="))
    return e.kind === Number(clause.slice(5));
  if (clause.startsWith("created_at<"))
    return e.created_at < Number(clause.slice(11));
  if (clause.startsWith("created_at>"))
    return e.created_at > Number(clause.slice(11));
  return false;
});
var profileOwner = (e) => {
  const authTags = e.tags.filter((tag) => tag[0] === "auth");
  if (authTags.length !== 1)
    return;
  const tag = parseNipOaTag(authTags[0]);
  if (tag === undefined)
    return;
  if (!verifyNipOa(tag, e.pubkey))
    return;
  return satisfiesConditions(tag[2], e) ? tag[1] : undefined;
};
var ownedTags = (pubkey) => [
  ["d", pubkey],
  ["runtime", RUNTIME]
];
var mergeAgentRecord = (prior, i) => {
  const content = { ...prior.content, name: i.name };
  if (i.picture !== undefined)
    content.picture = i.picture;
  if (content.picture === "")
    delete content.picture;
  return {
    content,
    tags: [...ownedTags(i.pubkey), ...prior.tags.filter((tag) => !OWNED_TAGS.has(tag[0] ?? ""))]
  };
};
var recordRuntime = (tags) => tags.find((tag) => tag[0] === "runtime")?.[1];

// src/buzz/agent-publish.ts
var DEADLINE_MS = 20000;
var PHASE_MS = 1e4;
var MS_PER_SECOND = 1000;
var NO_CHALLENGE = "The relay did not ask the agent to sign in";
var NO_ANSWER = "The relay did not answer in time";
var UNREACHABLE = "Could not reach the relay";
var CLOSED = "The relay closed the connection";
var SIGN_IN_REFUSED = "The relay refused the agent sign-in";
var EVENT_REFUSED = "The relay refused the agent profile";
var ABORTED = "Publishing the agent profile was cancelled";
var SIGN_IN_FAILED = "Could not sign in as the agent";
var RELAY_TEXT_MAX = 200;
var CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;
var parseFrame = (data) => {
  if (typeof data !== "string")
    return;
  try {
    const value = JSON.parse(data);
    return Array.isArray(value) ? value : undefined;
  } catch {
    return;
  }
};
var refusal = (prefix, message) => {
  if (typeof message !== "string")
    return prefix;
  const shown = message.replace(CONTROL_CHARACTERS, "").slice(0, RELAY_TEXT_MAX);
  return shown === "" ? prefix : `${prefix}: ${shown}`;
};
var publishAsAgent = (input) => new Promise((resolve, reject) => {
  const { relay, secret, auth, event, signal } = input;
  if (signal?.aborted) {
    reject(signal.reason);
    return;
  }
  const Impl = input.WebSocketImpl ?? globalThis.WebSocket;
  let socket;
  try {
    socket = new Impl(relay);
  } catch {
    reject(new Error(UNREACHABLE));
    return;
  }
  let phase = "challenge";
  let authId = "";
  let settled = false;
  let phaseTimer;
  const timedOut = () => settle(new Error(phase === "challenge" ? NO_CHALLENGE : NO_ANSWER));
  const deadline = setTimeout(timedOut, input.timeoutMs ?? DEADLINE_MS);
  const enter = (next) => {
    phase = next;
    clearTimeout(phaseTimer);
    phaseTimer = setTimeout(timedOut, PHASE_MS);
  };
  const send = (frame) => {
    try {
      socket.send(JSON.stringify(frame));
    } catch {
      settle(new Error(UNREACHABLE));
    }
  };
  const onMessage = (message) => {
    const frame = parseFrame(message.data);
    if (frame === undefined)
      return;
    const [type, first, accepted, text] = frame;
    if (phase === "challenge") {
      if (type !== "AUTH" || typeof first !== "string")
        return;
      const createdAt = Math.floor((input.now ?? Date.now)() / MS_PER_SECOND);
      let authEvent;
      try {
        authEvent = buildAuthEvent(secret, relay, first, auth, createdAt);
      } catch {
        settle(new Error(SIGN_IN_FAILED));
        return;
      }
      authId = authEvent.id;
      enter("auth");
      send(["AUTH", authEvent]);
      return;
    }
    if (type !== "OK" || typeof accepted !== "boolean")
      return;
    if (phase === "auth" && first === authId) {
      if (!accepted) {
        settle(new Error(refusal(SIGN_IN_REFUSED, text)));
        return;
      }
      enter("event");
      send(["EVENT", event]);
    } else if (phase === "event" && first === event.id) {
      settle(accepted ? undefined : new Error(refusal(EVENT_REFUSED, text)));
    }
  };
  const onError = () => settle(new Error(UNREACHABLE));
  const onClose = () => settle(new Error(CLOSED));
  const onAbort = () => settle(signal?.reason ?? new Error(ABORTED));
  function settle(error) {
    if (settled)
      return;
    settled = true;
    clearTimeout(deadline);
    clearTimeout(phaseTimer);
    socket.removeEventListener("message", onMessage);
    socket.removeEventListener("error", onError);
    socket.removeEventListener("close", onClose);
    signal?.removeEventListener("abort", onAbort);
    try {
      socket.close();
    } catch {}
    if (error === undefined)
      resolve();
    else
      reject(error);
  }
  socket.addEventListener("message", onMessage);
  socket.addEventListener("error", onError);
  socket.addEventListener("close", onClose);
  signal?.addEventListener("abort", onAbort);
  enter("challenge");
});

// node_modules/@noble/ciphers/utils.js
/*! noble-ciphers - MIT License (c) 2023 Paul Miller (paulmillr.com) */
function isBytes4(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
}
var atitle3 = (title) => title ? `"${title}" ` : "";
function abool2(value, title = "") {
  if (typeof value !== "boolean")
    throw new TypeError(atitle3(title) + "expected boolean, got type=" + typeof value);
  return value;
}
function anumber4(n, title = "") {
  if (typeof n !== "number")
    throw new TypeError(atitle3(title) + "expected number, got " + typeof n);
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError(atitle3(title) + "expected integer >= 0, got " + n);
  return n;
}
function abytes4(value, length, title = "") {
  if (isBytes4(value) && (length === undefined || value.length === length))
    return value;
  if (length !== undefined)
    anumber4(length, "length");
  const bytes = isBytes4(value);
  const ofLen = length !== undefined ? ` of length ${length}` : "";
  const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
  const message = atitle3(title) + "expected Uint8Array" + ofLen + ", got " + got;
  if (!bytes)
    throw new TypeError(message);
  throw new RangeError(message);
}
var aobject3 = (value, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(label === "object" ? "expected valid options object" : `"${label}" expected object, got type=${typeof value}`);
};
function aexists2(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("hash was destroyed");
  if (checkFinished && instance.finished)
    throw new Error("digest() was already called");
}
function aoutput2(out, instance) {
  abytes4(out, undefined, "output");
  const min = instance.outputLen;
  if (!(out.length >= min)) {
    throw new RangeError('"output" expected length >= ' + min);
  }
}
function u322(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean2(...arrays) {
  for (let i = 0;i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView2(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
var isLE2 = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
function byteSwap2(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
function byteSwap322(arr) {
  for (let i = 0;i < arr.length; i++) {
    arr[i] = byteSwap2(arr[i]);
  }
  return arr;
}
var swap32IfBE2 = isLE2 ? (u) => u : byteSwap322;
function overlapBytes(a, b) {
  if (!a.byteLength || !b.byteLength)
    return false;
  return a.buffer === b.buffer && a.byteOffset < b.byteOffset + b.byteLength && b.byteOffset < a.byteOffset + a.byteLength;
}
function complexOverlapBytes(input, output) {
  if (overlapBytes(input, output) && input.byteOffset < output.byteOffset)
    throw new Error("complex overlap of input and output is not supported");
}
function checkOpts2(defaults, opts) {
  aobject3(defaults, "defaults");
  aobject3(opts, "opts");
  const merged = Object.assign(defaults, opts);
  return merged;
}
function equalBytes(a, b) {
  a = abytes4(a);
  b = abytes4(b);
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0;i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
function wrapMacConstructor(keyLen, macCons, fromMsg) {
  const mac = macCons;
  const getArgs = fromMsg || (() => []);
  const macC = (msg, key) => mac(key, ...getArgs(msg)).update(msg).digest();
  const tmp = mac(new Uint8Array(keyLen), ...getArgs(new Uint8Array(0)));
  macC.outputLen = tmp.outputLen;
  macC.blockLen = tmp.blockLen;
  macC.create = (key, ...args) => mac(key, ...args);
  return macC;
}
var wrapCipher = (params, constructor) => {
  function wrappedCipher(key, ...args) {
    abytes4(key, undefined, "key");
    if (params.nonceLength !== undefined) {
      const nonce = args[0];
      abytes4(nonce, params.varSizeNonce ? undefined : params.nonceLength, "nonce");
    }
    const tagl = params.tagLength;
    const aadStart = params.nonceLength !== undefined ? 1 : 0;
    if (!params.withAAD) {
      for (let i = aadStart;i < args.length; i++)
        if (isBytes4(args[i]))
          throw new Error("AAD not supported");
    }
    if (params.withAAD && args[aadStart] !== undefined)
      abytes4(args[aadStart], undefined, "AAD");
    const cipher = constructor(key, ...args);
    const checkOutput = (fnLength, output) => {
      if (output !== undefined) {
        if (fnLength !== 2)
          throw new Error("cipher output not supported");
        abytes4(output, undefined, "output");
      }
    };
    let called = false;
    const wrCipher = {
      encrypt(data, output) {
        if (called)
          throw new Error("cannot encrypt() twice with same key + nonce");
        called = true;
        abytes4(data, undefined, "data");
        checkOutput(cipher.encrypt.length, output);
        return cipher.encrypt(data, output);
      },
      decrypt(data, output) {
        abytes4(data, undefined, "data");
        if (tagl && data.length < tagl)
          throw new Error('"ciphertext" expected length >= tagLength=' + tagl);
        checkOutput(cipher.decrypt.length, output);
        return cipher.decrypt(data, output);
      }
    };
    return wrCipher;
  }
  Object.assign(wrappedCipher, params);
  return wrappedCipher;
};
function getOutput(expectedLength, out, onlyAligned = true) {
  if (out === undefined)
    return new Uint8Array(expectedLength);
  abytes4(out, expectedLength, "output");
  if (onlyAligned && !isAligned32(out))
    throw new Error("invalid output, must be aligned");
  return out;
}
function u64Lengths(dataLength, aadLength, isLE) {
  anumber4(dataLength);
  anumber4(aadLength);
  abool2(isLE);
  const num = new Uint8Array(16);
  const view = createView2(num);
  view.setBigUint64(0, BigInt(aadLength), isLE);
  view.setBigUint64(8, BigInt(dataLength), isLE);
  return num;
}
function isAligned32(bytes) {
  return bytes.byteOffset % 4 === 0;
}
function copyBytes2(bytes) {
  return Uint8Array.from(abytes4(bytes));
}

// node_modules/@noble/ciphers/_arx.js
var encodeStr = (str) => Uint8Array.from(str.split(""), (c) => c.charCodeAt(0));
var sigma16_32 = /* @__PURE__ */ (() => swap32IfBE2(u322(encodeStr("expand 16-byte k"))))();
var sigma32_32 = /* @__PURE__ */ (() => swap32IfBE2(u322(encodeStr("expand 32-byte k"))))();
function rotl2(a, b) {
  return a << b | a >>> 32 - b;
}
var BLOCK_LEN = 64;
var BLOCK_LEN32 = 16;
var MAX_COUNTER = /* @__PURE__ */ (() => 2 ** 32 - 1)();
var U32_EMPTY = /* @__PURE__ */ Uint32Array.of();
function runCipher(core, sigma, key, nonce, data, output, counter, rounds) {
  const len = data.length;
  const block = new Uint8Array(BLOCK_LEN);
  const b32 = u322(block);
  const isAligned = isLE2 && isAligned32(data) && isAligned32(output);
  const d32 = isAligned ? u322(data) : U32_EMPTY;
  const o32 = isAligned ? u322(output) : U32_EMPTY;
  if (!isLE2) {
    for (let pos = 0;pos < len; counter++) {
      core(sigma, key, nonce, b32, counter, rounds);
      swap32IfBE2(b32);
      if (counter >= MAX_COUNTER)
        throw new Error("arx: counter overflow");
      const take = Math.min(BLOCK_LEN, len - pos);
      for (let j = 0, posj;j < take; j++) {
        posj = pos + j;
        output[posj] = data[posj] ^ block[j];
      }
      pos += take;
    }
    return;
  }
  for (let pos = 0;pos < len; counter++) {
    core(sigma, key, nonce, b32, counter, rounds);
    if (counter >= MAX_COUNTER)
      throw new Error("arx: counter overflow");
    const take = Math.min(BLOCK_LEN, len - pos);
    if (isAligned && take === BLOCK_LEN) {
      const pos32 = pos / 4;
      if (pos % 4 !== 0)
        throw new Error("arx: invalid block position");
      for (let j = 0, posj;j < BLOCK_LEN32; j++) {
        posj = pos32 + j;
        o32[posj] = d32[posj] ^ b32[j];
      }
      pos += BLOCK_LEN;
      continue;
    }
    for (let j = 0, posj;j < take; j++) {
      posj = pos + j;
      output[posj] = data[posj] ^ block[j];
    }
    pos += take;
  }
}
function createCipher(core, opts) {
  const { allowShortKeys, extendNonceFn, counterLength, counterRight, rounds } = checkOpts2({ allowShortKeys: false, counterLength: 8, counterRight: false, rounds: 20 }, opts);
  if (typeof core !== "function")
    throw new Error("core must be a function");
  anumber4(counterLength);
  anumber4(rounds);
  abool2(counterRight);
  abool2(allowShortKeys);
  return (key, nonce, data, output, counter = 0) => {
    abytes4(key, undefined, "key");
    abytes4(nonce, undefined, "nonce");
    abytes4(data, undefined, "data");
    const len = data.length;
    const hasOutput = output !== undefined;
    output = getOutput(len, output, false);
    if (hasOutput)
      complexOverlapBytes(data, output);
    anumber4(counter);
    if (counter < 0 || counter >= MAX_COUNTER)
      throw new Error("arx: counter overflow");
    const toClean = [];
    let l = key.length;
    let k;
    let sigma;
    if (l === 32) {
      toClean.push(k = copyBytes2(key));
      sigma = sigma32_32;
    } else if (l === 16 && allowShortKeys) {
      k = new Uint8Array(32);
      k.set(key);
      k.set(key, 16);
      sigma = sigma16_32;
      toClean.push(k);
    } else {
      abytes4(key, 32, "arx key");
      throw new Error("invalid key size");
    }
    if (!isLE2 || !isAligned32(nonce))
      toClean.push(nonce = copyBytes2(nonce));
    let k32 = u322(k);
    if (extendNonceFn) {
      if (nonce.length !== 24)
        throw new Error("arx: extended nonce must be 24 bytes");
      const n16 = nonce.subarray(0, 16);
      if (isLE2)
        extendNonceFn(sigma, k32, u322(n16), k32);
      else {
        const sigmaRaw = swap32IfBE2(Uint32Array.from(sigma));
        extendNonceFn(sigmaRaw, k32, u322(n16), k32);
        clean2(sigmaRaw);
        swap32IfBE2(k32);
      }
      nonce = nonce.subarray(16);
    } else if (!isLE2)
      swap32IfBE2(k32);
    const nonceNcLen = 16 - counterLength;
    if (nonceNcLen !== nonce.length)
      throw new Error(`arx: nonce must be ${nonceNcLen} or 16 bytes`);
    if (nonceNcLen !== 12) {
      const nc = new Uint8Array(12);
      nc.set(nonce, counterRight ? 0 : 12 - nonce.length);
      nonce = nc;
      toClean.push(nonce);
    }
    const n32 = swap32IfBE2(u322(nonce));
    try {
      runCipher(core, sigma, k32, n32, data, output, counter, rounds);
      return output;
    } finally {
      clean2(...toClean);
    }
  };
}

// node_modules/@noble/ciphers/_poly1305.js
function u8to16(a, i) {
  return a[i++] & 255 | (a[i++] & 255) << 8;
}

class Poly1305 {
  blockLen = 16;
  outputLen = 16;
  buffer = new Uint8Array(16);
  r = new Uint16Array(10);
  h = new Uint16Array(10);
  pad = new Uint16Array(8);
  pos = 0;
  finished = false;
  destroyed = false;
  constructor(key) {
    key = copyBytes2(abytes4(key, 32, "key"));
    const t0 = u8to16(key, 0);
    const t1 = u8to16(key, 2);
    const t2 = u8to16(key, 4);
    const t3 = u8to16(key, 6);
    const t4 = u8to16(key, 8);
    const t5 = u8to16(key, 10);
    const t6 = u8to16(key, 12);
    const t7 = u8to16(key, 14);
    this.r[0] = t0 & 8191;
    this.r[1] = (t0 >>> 13 | t1 << 3) & 8191;
    this.r[2] = (t1 >>> 10 | t2 << 6) & 7939;
    this.r[3] = (t2 >>> 7 | t3 << 9) & 8191;
    this.r[4] = (t3 >>> 4 | t4 << 12) & 255;
    this.r[5] = t4 >>> 1 & 8190;
    this.r[6] = (t4 >>> 14 | t5 << 2) & 8191;
    this.r[7] = (t5 >>> 11 | t6 << 5) & 8065;
    this.r[8] = (t6 >>> 8 | t7 << 8) & 8191;
    this.r[9] = t7 >>> 5 & 127;
    for (let i = 0;i < 8; i++)
      this.pad[i] = u8to16(key, 16 + 2 * i);
  }
  process(data, offset, isLast = false) {
    const hibit = isLast ? 0 : 1 << 11;
    const { h, r } = this;
    const r0 = r[0];
    const r1 = r[1];
    const r2 = r[2];
    const r3 = r[3];
    const r4 = r[4];
    const r5 = r[5];
    const r6 = r[6];
    const r7 = r[7];
    const r8 = r[8];
    const r9 = r[9];
    const t0 = u8to16(data, offset + 0);
    const t1 = u8to16(data, offset + 2);
    const t2 = u8to16(data, offset + 4);
    const t3 = u8to16(data, offset + 6);
    const t4 = u8to16(data, offset + 8);
    const t5 = u8to16(data, offset + 10);
    const t6 = u8to16(data, offset + 12);
    const t7 = u8to16(data, offset + 14);
    let h0 = h[0] + (t0 & 8191);
    let h1 = h[1] + ((t0 >>> 13 | t1 << 3) & 8191);
    let h2 = h[2] + ((t1 >>> 10 | t2 << 6) & 8191);
    let h3 = h[3] + ((t2 >>> 7 | t3 << 9) & 8191);
    let h4 = h[4] + ((t3 >>> 4 | t4 << 12) & 8191);
    let h5 = h[5] + (t4 >>> 1 & 8191);
    let h6 = h[6] + ((t4 >>> 14 | t5 << 2) & 8191);
    let h7 = h[7] + ((t5 >>> 11 | t6 << 5) & 8191);
    let h8 = h[8] + ((t6 >>> 8 | t7 << 8) & 8191);
    let h9 = h[9] + (t7 >>> 5 | hibit);
    let c = 0;
    let d0 = c + h0 * r0 + h1 * (5 * r9) + h2 * (5 * r8) + h3 * (5 * r7) + h4 * (5 * r6);
    c = d0 >>> 13;
    d0 &= 8191;
    d0 += h5 * (5 * r5) + h6 * (5 * r4) + h7 * (5 * r3) + h8 * (5 * r2) + h9 * (5 * r1);
    c += d0 >>> 13;
    d0 &= 8191;
    let d1 = c + h0 * r1 + h1 * r0 + h2 * (5 * r9) + h3 * (5 * r8) + h4 * (5 * r7);
    c = d1 >>> 13;
    d1 &= 8191;
    d1 += h5 * (5 * r6) + h6 * (5 * r5) + h7 * (5 * r4) + h8 * (5 * r3) + h9 * (5 * r2);
    c += d1 >>> 13;
    d1 &= 8191;
    let d2 = c + h0 * r2 + h1 * r1 + h2 * r0 + h3 * (5 * r9) + h4 * (5 * r8);
    c = d2 >>> 13;
    d2 &= 8191;
    d2 += h5 * (5 * r7) + h6 * (5 * r6) + h7 * (5 * r5) + h8 * (5 * r4) + h9 * (5 * r3);
    c += d2 >>> 13;
    d2 &= 8191;
    let d3 = c + h0 * r3 + h1 * r2 + h2 * r1 + h3 * r0 + h4 * (5 * r9);
    c = d3 >>> 13;
    d3 &= 8191;
    d3 += h5 * (5 * r8) + h6 * (5 * r7) + h7 * (5 * r6) + h8 * (5 * r5) + h9 * (5 * r4);
    c += d3 >>> 13;
    d3 &= 8191;
    let d4 = c + h0 * r4 + h1 * r3 + h2 * r2 + h3 * r1 + h4 * r0;
    c = d4 >>> 13;
    d4 &= 8191;
    d4 += h5 * (5 * r9) + h6 * (5 * r8) + h7 * (5 * r7) + h8 * (5 * r6) + h9 * (5 * r5);
    c += d4 >>> 13;
    d4 &= 8191;
    let d5 = c + h0 * r5 + h1 * r4 + h2 * r3 + h3 * r2 + h4 * r1;
    c = d5 >>> 13;
    d5 &= 8191;
    d5 += h5 * r0 + h6 * (5 * r9) + h7 * (5 * r8) + h8 * (5 * r7) + h9 * (5 * r6);
    c += d5 >>> 13;
    d5 &= 8191;
    let d6 = c + h0 * r6 + h1 * r5 + h2 * r4 + h3 * r3 + h4 * r2;
    c = d6 >>> 13;
    d6 &= 8191;
    d6 += h5 * r1 + h6 * r0 + h7 * (5 * r9) + h8 * (5 * r8) + h9 * (5 * r7);
    c += d6 >>> 13;
    d6 &= 8191;
    let d7 = c + h0 * r7 + h1 * r6 + h2 * r5 + h3 * r4 + h4 * r3;
    c = d7 >>> 13;
    d7 &= 8191;
    d7 += h5 * r2 + h6 * r1 + h7 * r0 + h8 * (5 * r9) + h9 * (5 * r8);
    c += d7 >>> 13;
    d7 &= 8191;
    let d8 = c + h0 * r8 + h1 * r7 + h2 * r6 + h3 * r5 + h4 * r4;
    c = d8 >>> 13;
    d8 &= 8191;
    d8 += h5 * r3 + h6 * r2 + h7 * r1 + h8 * r0 + h9 * (5 * r9);
    c += d8 >>> 13;
    d8 &= 8191;
    let d9 = c + h0 * r9 + h1 * r8 + h2 * r7 + h3 * r6 + h4 * r5;
    c = d9 >>> 13;
    d9 &= 8191;
    d9 += h5 * r4 + h6 * r3 + h7 * r2 + h8 * r1 + h9 * r0;
    c += d9 >>> 13;
    d9 &= 8191;
    c = (c << 2) + c | 0;
    c = c + d0 | 0;
    d0 = c & 8191;
    c = c >>> 13;
    d1 += c;
    h[0] = d0;
    h[1] = d1;
    h[2] = d2;
    h[3] = d3;
    h[4] = d4;
    h[5] = d5;
    h[6] = d6;
    h[7] = d7;
    h[8] = d8;
    h[9] = d9;
  }
  finalize() {
    const { h, pad } = this;
    const g = new Uint16Array(10);
    let c = h[1] >>> 13;
    h[1] &= 8191;
    for (let i = 2;i < 10; i++) {
      h[i] += c;
      c = h[i] >>> 13;
      h[i] &= 8191;
    }
    h[0] += c * 5;
    c = h[0] >>> 13;
    h[0] &= 8191;
    h[1] += c;
    c = h[1] >>> 13;
    h[1] &= 8191;
    h[2] += c;
    g[0] = h[0] + 5;
    c = g[0] >>> 13;
    g[0] &= 8191;
    for (let i = 1;i < 10; i++) {
      g[i] = h[i] + c;
      c = g[i] >>> 13;
      g[i] &= 8191;
    }
    g[9] -= 1 << 13;
    let mask = (c ^ 1) - 1;
    for (let i = 0;i < 10; i++)
      g[i] &= mask;
    mask = ~mask;
    for (let i = 0;i < 10; i++)
      h[i] = h[i] & mask | g[i];
    h[0] = (h[0] | h[1] << 13) & 65535;
    h[1] = (h[1] >>> 3 | h[2] << 10) & 65535;
    h[2] = (h[2] >>> 6 | h[3] << 7) & 65535;
    h[3] = (h[3] >>> 9 | h[4] << 4) & 65535;
    h[4] = (h[4] >>> 12 | h[5] << 1 | h[6] << 14) & 65535;
    h[5] = (h[6] >>> 2 | h[7] << 11) & 65535;
    h[6] = (h[7] >>> 5 | h[8] << 8) & 65535;
    h[7] = (h[8] >>> 8 | h[9] << 5) & 65535;
    let f = h[0] + pad[0];
    h[0] = f & 65535;
    for (let i = 1;i < 8; i++) {
      f = (h[i] + pad[i] | 0) + (f >>> 16) | 0;
      h[i] = f & 65535;
    }
    clean2(g);
  }
  update(data) {
    aexists2(this);
    abytes4(data);
    data = copyBytes2(data);
    const { buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0;pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        for (;blockLen <= len - pos; pos += blockLen)
          this.process(data, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(buffer, 0, false);
        this.pos = 0;
      }
    }
    return this;
  }
  destroy() {
    this.destroyed = true;
    clean2(this.h, this.r, this.buffer, this.pad);
  }
  digestInto(out) {
    aexists2(this);
    aoutput2(out, this);
    this.finished = true;
    const { buffer, h } = this;
    let { pos } = this;
    if (pos) {
      buffer[pos++] = 1;
      for (;pos < 16; pos++)
        buffer[pos] = 0;
      this.process(buffer, 0, true);
    }
    this.finalize();
    let opos = 0;
    for (let i = 0;i < 8; i++) {
      out[opos++] = h[i] >>> 0;
      out[opos++] = h[i] >>> 8;
    }
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
}
var poly1305 = /* @__PURE__ */ wrapMacConstructor(32, (key) => new Poly1305(key));

// node_modules/@noble/ciphers/chacha.js
function chachaCore(s, k, n, out, cnt, rounds = 20) {
  let y00 = s[0], y01 = s[1], y02 = s[2], y03 = s[3], y04 = k[0], y05 = k[1], y06 = k[2], y07 = k[3], y08 = k[4], y09 = k[5], y10 = k[6], y11 = k[7], y12 = cnt, y13 = n[0], y14 = n[1], y15 = n[2];
  let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
  for (let r = 0;r < rounds; r += 2) {
    x00 = x00 + x04 | 0;
    x12 = rotl2(x12 ^ x00, 16);
    x08 = x08 + x12 | 0;
    x04 = rotl2(x04 ^ x08, 12);
    x00 = x00 + x04 | 0;
    x12 = rotl2(x12 ^ x00, 8);
    x08 = x08 + x12 | 0;
    x04 = rotl2(x04 ^ x08, 7);
    x01 = x01 + x05 | 0;
    x13 = rotl2(x13 ^ x01, 16);
    x09 = x09 + x13 | 0;
    x05 = rotl2(x05 ^ x09, 12);
    x01 = x01 + x05 | 0;
    x13 = rotl2(x13 ^ x01, 8);
    x09 = x09 + x13 | 0;
    x05 = rotl2(x05 ^ x09, 7);
    x02 = x02 + x06 | 0;
    x14 = rotl2(x14 ^ x02, 16);
    x10 = x10 + x14 | 0;
    x06 = rotl2(x06 ^ x10, 12);
    x02 = x02 + x06 | 0;
    x14 = rotl2(x14 ^ x02, 8);
    x10 = x10 + x14 | 0;
    x06 = rotl2(x06 ^ x10, 7);
    x03 = x03 + x07 | 0;
    x15 = rotl2(x15 ^ x03, 16);
    x11 = x11 + x15 | 0;
    x07 = rotl2(x07 ^ x11, 12);
    x03 = x03 + x07 | 0;
    x15 = rotl2(x15 ^ x03, 8);
    x11 = x11 + x15 | 0;
    x07 = rotl2(x07 ^ x11, 7);
    x00 = x00 + x05 | 0;
    x15 = rotl2(x15 ^ x00, 16);
    x10 = x10 + x15 | 0;
    x05 = rotl2(x05 ^ x10, 12);
    x00 = x00 + x05 | 0;
    x15 = rotl2(x15 ^ x00, 8);
    x10 = x10 + x15 | 0;
    x05 = rotl2(x05 ^ x10, 7);
    x01 = x01 + x06 | 0;
    x12 = rotl2(x12 ^ x01, 16);
    x11 = x11 + x12 | 0;
    x06 = rotl2(x06 ^ x11, 12);
    x01 = x01 + x06 | 0;
    x12 = rotl2(x12 ^ x01, 8);
    x11 = x11 + x12 | 0;
    x06 = rotl2(x06 ^ x11, 7);
    x02 = x02 + x07 | 0;
    x13 = rotl2(x13 ^ x02, 16);
    x08 = x08 + x13 | 0;
    x07 = rotl2(x07 ^ x08, 12);
    x02 = x02 + x07 | 0;
    x13 = rotl2(x13 ^ x02, 8);
    x08 = x08 + x13 | 0;
    x07 = rotl2(x07 ^ x08, 7);
    x03 = x03 + x04 | 0;
    x14 = rotl2(x14 ^ x03, 16);
    x09 = x09 + x14 | 0;
    x04 = rotl2(x04 ^ x09, 12);
    x03 = x03 + x04 | 0;
    x14 = rotl2(x14 ^ x03, 8);
    x09 = x09 + x14 | 0;
    x04 = rotl2(x04 ^ x09, 7);
  }
  let oi = 0;
  out[oi++] = y00 + x00 | 0;
  out[oi++] = y01 + x01 | 0;
  out[oi++] = y02 + x02 | 0;
  out[oi++] = y03 + x03 | 0;
  out[oi++] = y04 + x04 | 0;
  out[oi++] = y05 + x05 | 0;
  out[oi++] = y06 + x06 | 0;
  out[oi++] = y07 + x07 | 0;
  out[oi++] = y08 + x08 | 0;
  out[oi++] = y09 + x09 | 0;
  out[oi++] = y10 + x10 | 0;
  out[oi++] = y11 + x11 | 0;
  out[oi++] = y12 + x12 | 0;
  out[oi++] = y13 + x13 | 0;
  out[oi++] = y14 + x14 | 0;
  out[oi++] = y15 + x15 | 0;
}
var chacha20 = /* @__PURE__ */ createCipher(chachaCore, {
  counterRight: false,
  counterLength: 4,
  allowShortKeys: false
});
var ZEROS16 = /* @__PURE__ */ new Uint8Array(16);
var updatePadded = (h, msg) => {
  h.update(msg);
  const leftover = msg.length % 16;
  if (leftover)
    h.update(ZEROS16.subarray(leftover));
};
var ZEROS32 = /* @__PURE__ */ new Uint8Array(32);
function computeTag(fn, key, nonce, ciphertext, AAD) {
  if (AAD !== undefined)
    abytes4(AAD, undefined, "AAD");
  const authKey = fn(key, nonce, ZEROS32);
  const lengths = u64Lengths(ciphertext.length, AAD ? AAD.length : 0, true);
  const h = poly1305.create(authKey);
  if (AAD)
    updatePadded(h, AAD);
  updatePadded(h, ciphertext);
  h.update(lengths);
  const res = h.digest();
  clean2(authKey, lengths);
  return res;
}
var _poly1305_aead = (xorStream) => (key, nonce, AAD) => {
  const tagLength = 16;
  return {
    encrypt(plaintext, output) {
      const plength = plaintext.length;
      output = getOutput(plength + tagLength, output, false);
      output.set(plaintext);
      const oPlain = output.subarray(0, -tagLength);
      xorStream(key, nonce, oPlain, oPlain, 1);
      const tag = computeTag(xorStream, key, nonce, oPlain, AAD);
      output.set(tag, plength);
      clean2(tag);
      return output;
    },
    decrypt(ciphertext, output) {
      output = getOutput(ciphertext.length - tagLength, output, false);
      const data = ciphertext.subarray(0, -tagLength);
      const passedTag = ciphertext.subarray(-tagLength);
      const tag = computeTag(xorStream, key, nonce, data, AAD);
      if (!equalBytes(passedTag, tag)) {
        clean2(tag);
        throw new Error("invalid tag");
      }
      output.set(ciphertext.subarray(0, -tagLength));
      xorStream(key, nonce, output, output, 1);
      clean2(tag);
      return output;
    }
  };
};
var chacha20poly1305 = /* @__PURE__ */ wrapCipher({ blockSize: 64, nonceLength: 12, tagLength: 16, withAAD: true }, /* @__PURE__ */ _poly1305_aead(chacha20));

// node_modules/@noble/curves/abstract/edwards.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n7 = /* @__PURE__ */ BigInt(0);
var _1n5 = /* @__PURE__ */ BigInt(1);
var _2n4 = /* @__PURE__ */ BigInt(2);
var _4n4 = /* @__PURE__ */ BigInt(4);
var _8n2 = /* @__PURE__ */ BigInt(8);
function isEdValidXY(Fp, CURVE, x, y) {
  const x2 = Fp.sqr(x);
  const y2 = Fp.sqr(y);
  const left = Fp.add(Fp.mul(CURVE.a, x2), y2);
  const right = Fp.add(Fp.ONE, Fp.mul(CURVE.d, Fp.mul(x2, y2)));
  return Fp.eql(left, right);
}
function edwards(params, extraOpts = {}) {
  validateObject(extraOpts, {}, {}, "extraOpts");
  const opts = extraOpts;
  const validated = createCurveFields("edwards", params, opts, opts.FpFnLE);
  const { Fp, Fn } = validated;
  let CURVE = validated.CURVE;
  const { h: cofactor } = CURVE;
  if (FpLegendre(Fp, CURVE.a) !== 1)
    throw new Error("edwards: CURVE.a must be a square in Fp for complete addition formulas");
  if (FpLegendre(Fp, CURVE.d) !== -1)
    throw new Error("edwards: CURVE.d must be a non-square in Fp for complete addition formulas");
  validateObject(opts, {}, { uvRatio: "function", randomBytes: "function" });
  const randomBytes = opts.randomBytes === undefined ? randomBytes2 : opts.randomBytes;
  const MASK = _2n4 << BigInt(Fp.BYTES * 8) - _1n5;
  function isOdd(n) {
    if (!Fp.isOdd)
      throw new Error("Field does not have .isOdd()");
    return Fp.isOdd(n);
  }
  const uvRatio = opts.uvRatio === undefined ? (u, v) => {
    try {
      return { isValid: true, value: Fp.sqrt(Fp.div(u, v)) };
    } catch (e) {
      return { isValid: false, value: _0n7 };
    }
  } : opts.uvRatio;
  if (!isEdValidXY(Fp, CURVE, CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const mulA = Fp.eql(CURVE.a, Fp.neg(Fp.ONE)) ? (x) => Fp.neg(x) : Fp.eql(CURVE.a, Fp.ONE) ? (x) => x : (x) => Fp.mul(CURVE.a, x);
  function acoord(title, n, banZero = false) {
    const min = banZero ? _1n5 : _0n7;
    aInRange("coordinate " + title, n, min, MASK);
    return n;
  }
  function aedpoint(other) {
    if (!(other instanceof Point))
      throw new Error("EdwardsPoint expected");
  }

  class Point {
    static BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE, Fp.mul(CURVE.Gx, CURVE.Gy));
    static ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ONE, Fp.ZERO);
    static Fp = Fp;
    static Fn = Fn;
    X;
    Y;
    Z;
    T;
    constructor(X, Y, Z, T) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y);
      this.Z = acoord("z", Z, true);
      this.T = acoord("t", T);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    static fromAffine(p) {
      if (p instanceof Point)
        throw new Error("extended point not allowed");
      const { x, y } = p || {};
      acoord("x", x);
      acoord("y", y);
      return new Point(x, y, Fp.ONE, Fp.mul(x, y));
    }
    static fromBytes(bytes, zip215 = false) {
      const len = Fp.BYTES;
      const { a, d } = CURVE;
      bytes = copyBytes(abytes2(bytes, len, "point"));
      abool(zip215, "zip215");
      const normed = copyBytes(bytes);
      const lastByte = bytes[len - 1];
      normed[len - 1] = lastByte & ~128;
      const y = bytesToNumberLE(normed);
      const max = zip215 ? MASK : Fp.ORDER;
      aInRange("point.y", y, _0n7, max);
      const y2 = Fp.sqr(y);
      const u = Fp.sub(y2, Fp.ONE);
      const v = Fp.sub(Fp.mulN(d, y2), a);
      let { isValid, value: x } = uvRatio(u, v);
      if (!isValid)
        throw new Error("bad point: invalid y coordinate");
      const isXOdd = isOdd(x);
      const isLastByteOdd = (lastByte & 128) !== 0;
      if (!zip215 && Fp.is0(x) && isLastByteOdd)
        throw new Error("bad point: x=0 and x_0=1");
      if (isLastByteOdd !== isXOdd)
        x = Fp.neg(x);
      return Point.fromAffine({ x, y });
    }
    static fromHex(hex, zip215 = false) {
      return Point.fromBytes(hexToBytes2(hex), zip215);
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    precompute(windowSize = 6, isLazy = true) {
      wnaf.setWindowSize(this, windowSize);
      if (!isLazy)
        this.multiply(_2n4);
      return this;
    }
    assertValidity() {
      const p = this;
      const { a, d } = CURVE;
      if (p.is0())
        throw new Error("bad point: ZERO");
      const { X, Y, Z, T } = p;
      const X2 = Fp.sqr(X);
      const Y2 = Fp.sqr(Y);
      const Z2 = Fp.sqr(Z);
      const Z4 = Fp.sqr(Z2);
      const aX2 = Fp.mul(X2, a);
      const left = Fp.mul(Fp.add(aX2, Y2), Z2);
      const right = Fp.add(Z4, Fp.mul(d, Fp.mul(X2, Y2)));
      if (!Fp.eql(left, right))
        throw new Error("bad point: equation left != right (1)");
      const XY = Fp.mul(X, Y);
      const ZT = Fp.mul(Z, T);
      if (!Fp.eql(XY, ZT))
        throw new Error("bad point: equation left != right (2)");
    }
    equals(other) {
      aedpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const X1Z2 = Fp.mul(X1, Z2);
      const X2Z1 = Fp.mul(X2, Z1);
      const Y1Z2 = Fp.mul(Y1, Z2);
      const Y2Z1 = Fp.mul(Y2, Z1);
      return Fp.eql(X1Z2, X2Z1) && Fp.eql(Y1Z2, Y2Z1);
    }
    is0() {
      return this.equals(Point.ZERO);
    }
    negate() {
      return new Point(Fp.neg(this.X), this.Y, this.Z, Fp.neg(this.T));
    }
    double() {
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const A = Fp.sqr(X1);
      const B = Fp.sqr(Y1);
      const C = Fp.mul(Fp.sqr(Z1), _2n4);
      const D = mulA(A);
      const x1y1 = Fp.addN(X1, Y1);
      const E = Fp.sub(Fp.subN(Fp.sqr(x1y1), A), B);
      const G = Fp.addN(D, B);
      const F = Fp.subN(G, C);
      const H = Fp.subN(D, B);
      const X3 = Fp.mul(E, F);
      const Y3 = Fp.mul(G, H);
      const T3 = Fp.mul(E, H);
      const Z3 = Fp.mul(F, G);
      return new Point(X3, Y3, Z3, T3);
    }
    add(other) {
      aedpoint(other);
      const { d } = CURVE;
      const { X: X1, Y: Y1, Z: Z1, T: T1 } = this;
      const { X: X2, Y: Y2, Z: Z2, T: T2 } = other;
      const A = Fp.mul(X1, X2);
      const B = Fp.mul(Y1, Y2);
      const C = Fp.mul(Fp.mulN(T1, d), T2);
      const D = Fp.mul(Z1, Z2);
      const E = Fp.sub(Fp.subN(Fp.mulN(Fp.addN(X1, Y1), Fp.addN(X2, Y2)), A), B);
      const F = Fp.subN(D, C);
      const G = Fp.addN(D, C);
      const H = Fp.sub(B, mulA(A));
      const X3 = Fp.mul(E, F);
      const Y3 = Fp.mul(G, H);
      const T3 = Fp.mul(E, H);
      const Z3 = Fp.mul(F, G);
      return new Point(X3, Y3, Z3, T3);
    }
    subtract(other) {
      aedpoint(other);
      return this.add(other.negate());
    }
    multiply(scalar) {
      if (!Fn.isValidNot0(scalar))
        throw new RangeError("invalid scalar: expected 1 <= sc < curve.n");
      const { p, f } = wnaf.mulSecret(this, scalar, cofactor, normalize);
      return normalize([p, f])[0];
    }
    multiplyUnsafe(scalar) {
      if (!Fn.isValid(scalar))
        throw new RangeError("invalid scalar: expected 0 <= sc < curve.n");
      if (scalar === _0n7)
        return Point.ZERO;
      if (this.is0() || scalar === _1n5)
        return this;
      return wnaf.mulUnsafe(this, scalar, normalize);
    }
    isSmallOrder() {
      return this.clearCofactor().is0();
    }
    isTorsionFree() {
      return wnaf.mulUnsafe(this, CURVE.n).is0();
    }
    toAffine(invertedZ) {
      const p = this;
      let iz = invertedZ;
      if (iz != null && typeof iz !== "bigint")
        throw new TypeError('"invertedZ" expected bigint, got type=' + typeof iz);
      const { X, Y, Z } = p;
      const is0 = p.is0();
      if (iz == null)
        iz = is0 ? Fp.create(_8n2) : Fp.inv(Z);
      const x = Fp.mul(X, iz);
      const y = Fp.mul(Y, iz);
      const zz = Fp.mul(Z, iz);
      if (is0)
        return { x: Fp.ZERO, y: Fp.ONE };
      if (!Fp.eql(zz, Fp.ONE))
        throw new Error("invZ was invalid");
      return { x, y };
    }
    clearCofactor() {
      if (cofactor === _1n5)
        return this;
      if (cofactor === _2n4)
        return this.double();
      if (cofactor === _4n4)
        return this.double().double();
      if (cofactor === _8n2)
        return this.double().double().double();
      return this.multiplyUnsafe(cofactor);
    }
    toBytes() {
      const { x, y } = this.toAffine();
      const bytes = Fp.toBytes(y);
      bytes[bytes.length - 1] |= isOdd(x) ? 128 : 0;
      return bytes;
    }
    toHex() {
      return bytesToHex2(this.toBytes());
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
  }
  const normalize = (points) => normalizeZ(Point, points);
  const wnaf = new ScalarMultiplier(Point, randomBytes);
  if (wnaf.bits >= 6)
    Point.BASE.precompute(6);
  Object.freeze(Point.prototype);
  Object.freeze(Point);
  return Point;
}
function eddsa(Point, cHash, eddsaOpts = {}) {
  validatePointCons(Point);
  if (typeof cHash !== "function")
    throw new Error('"hash" function param is required');
  const hash = cHash;
  const opts = eddsaOpts;
  validateObject(opts, {}, {
    adjustScalarBytes: "function",
    randomBytes: "function",
    domain: "function",
    prehash: "function",
    zip215: "boolean",
    mapToCurve: "function",
    toMontgomery: "function",
    toMontgomerySecret: "function"
  });
  const { prehash } = opts;
  const { BASE, Fp, Fn } = Point;
  const outputLen = hash.outputLen;
  const expectedLen = 2 * Fp.BYTES;
  if (outputLen !== undefined) {
    asafenumber(outputLen, "hash.outputLen");
    if (outputLen !== expectedLen)
      throw new Error(`hash.outputLen must be ${expectedLen}, got ${outputLen}`);
  }
  const randomBytes = opts.randomBytes === undefined ? randomBytes2 : opts.randomBytes;
  const toMontgomery = opts.toMontgomery;
  const toMontgomerySecret = opts.toMontgomerySecret;
  const adjustScalarBytes = opts.adjustScalarBytes === undefined ? (bytes) => bytes : opts.adjustScalarBytes;
  const domain = opts.domain === undefined ? (data, ctx, phflag) => {
    abool(phflag, "phflag");
    if (ctx.length || phflag)
      throw new Error("Contexts/pre-hash are not supported");
    return data;
  } : opts.domain;
  function modN_LE(hash) {
    return Fn.create(bytesToNumberLE(hash));
  }
  function getPrivateScalar(key) {
    const len = lengths.secretKey;
    abytes2(key, lengths.secretKey, "secretKey");
    const hashed = abytes2(hash(key), 2 * len, "hashedSecretKey");
    const head = adjustScalarBytes(hashed.slice(0, len));
    const prefix = hashed.slice(len, 2 * len);
    const scalar = modN_LE(head);
    return { head, prefix, scalar };
  }
  function getExtendedPublicKey(secretKey) {
    const { head, prefix, scalar } = getPrivateScalar(secretKey);
    const point = BASE.multiply(scalar);
    const pointBytes = point.toBytes();
    return { head, prefix, scalar, point, pointBytes };
  }
  function getPublicKey(secretKey) {
    return getExtendedPublicKey(secretKey).pointBytes;
  }
  function hashDomainToScalar(context = Uint8Array.of(), ...msgs) {
    const msg = concatBytes2(...msgs);
    return modN_LE(hash(domain(msg, abytes2(context, undefined, "context"), !!prehash)));
  }
  function sign(msg, secretKey, options = {}) {
    validateObject(options, {}, {}, "options");
    msg = copyBytes(abytes2(msg, undefined, "message"));
    if (prehash)
      msg = prehash(msg);
    const { prefix, scalar, pointBytes } = getExtendedPublicKey(secretKey);
    const r = hashDomainToScalar(options.context, prefix, msg);
    const R = BASE.multiply(r).toBytes();
    const k = hashDomainToScalar(options.context, R, pointBytes, msg);
    const s = Fn.create(r + k * scalar);
    if (!Fn.isValid(s))
      throw new Error("sign failed: invalid s");
    const rs = concatBytes2(R, Fn.toBytes(s));
    return abytes2(rs, lengths.signature, "result");
  }
  const verifyOpts = {
    zip215: opts.zip215
  };
  function verify(sig, msg, publicKey, options = verifyOpts) {
    validateObject(options);
    const { context } = options;
    const zip215 = options.zip215 === undefined ? !!verifyOpts.zip215 : options.zip215;
    const len = lengths.signature;
    sig = abytes2(sig, len, "signature");
    msg = abytes2(msg, undefined, "message");
    publicKey = abytes2(publicKey, lengths.publicKey, "publicKey");
    if (zip215 !== undefined)
      abool(zip215, "zip215");
    if (prehash)
      msg = prehash(msg);
    const mid = len / 2;
    const r = sig.subarray(0, mid);
    const s = bytesToNumberLE(sig.subarray(mid, len));
    let A, R, SB;
    try {
      A = Point.fromBytes(publicKey, zip215);
      R = Point.fromBytes(r, zip215);
      SB = BASE.multiplyUnsafe(s);
    } catch (error) {
      return false;
    }
    if (!zip215 && A.isSmallOrder())
      return false;
    const k = hashDomainToScalar(context, r, publicKey, msg);
    const RkA = R.add(A.multiplyUnsafe(k));
    return RkA.subtract(SB).clearCofactor().is0();
  }
  const _size = Fp.BYTES;
  const lengths = {
    secretKey: _size,
    publicKey: _size,
    signature: 2 * _size,
    seed: _size
  };
  function randomSecretKey(seed) {
    seed = seed === undefined ? randomBytes(lengths.seed) : seed;
    return abytes2(seed, lengths.seed, "seed");
  }
  function isValidSecretKey(key) {
    return isBytes2(key) && key.length === lengths.secretKey;
  }
  function isValidPublicKey(key, zip215) {
    try {
      return !!Point.fromBytes(key, zip215 === undefined ? verifyOpts.zip215 : zip215);
    } catch (error) {
      return false;
    }
  }
  const utils = {
    getExtendedPublicKey,
    randomSecretKey,
    isValidSecretKey,
    isValidPublicKey,
    toMontgomery(publicKey) {
      if (toMontgomery === undefined)
        throw new Error("Montgomery conversion is not supported for this curve");
      return toMontgomery(Point.fromBytes(publicKey));
    },
    toMontgomerySecret(secretKey) {
      if (toMontgomerySecret === undefined)
        throw new Error("Montgomery conversion is not supported for this curve");
      return toMontgomerySecret(secretKey);
    }
  };
  Object.freeze(lengths);
  Object.freeze(utils);
  return Object.freeze({
    keygen: createKeygen(randomSecretKey, getPublicKey),
    getPublicKey,
    sign,
    verify,
    utils,
    Point,
    lengths
  });
}

// node_modules/@noble/curves/abstract/montgomery.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n8 = /* @__PURE__ */ BigInt(0);
var _1n6 = /* @__PURE__ */ BigInt(1);
var _2n5 = /* @__PURE__ */ BigInt(2);
function cmask(P, swap) {
  return P + swap - (swap >> _1n6 << _1n6);
}
function cswap(P) {
  const offset = BigInt(6) * P;
  return (mask, x_2, x_3) => {
    const sum = x_2 + x_3;
    const d = offset + x_3 - x_2;
    const a = (d * mask + x_2) % P;
    return { x_2: a, x_3: sum - a };
  };
}
function validateOpts(curve) {
  validateObject(curve, {
    P: "bigint",
    type: "string",
    adjustScalarBytes: "function",
    powPminus2: "function"
  }, {
    randomBytes: "function",
    scalarMultBase: "function"
  });
  return Object.freeze({ ...curve });
}
function montgomery(curveDef) {
  const CURVE = validateOpts(curveDef);
  const { P, type, adjustScalarBytes, powPminus2, randomBytes: rand } = CURVE;
  const mulBaseHook = CURVE.scalarMultBase;
  const is25519 = type === "x25519";
  if (!is25519 && type !== "x448")
    throw new Error("invalid type");
  const randomBytes_ = rand === undefined ? randomBytes2 : rand;
  const montgomeryBits = is25519 ? 255 : 448;
  const swap = cswap(P);
  const fieldLen = is25519 ? 32 : 56;
  const Gu = is25519 ? BigInt(9) : BigInt(5);
  const a24 = is25519 ? BigInt(121665) : BigInt(39081);
  const minScalar = is25519 ? _2n5 ** BigInt(254) : _2n5 ** BigInt(447);
  const maxAdded = is25519 ? BigInt(8) * (_2n5 ** BigInt(251) - _1n6) : BigInt(4) * (_2n5 ** BigInt(445) - _1n6);
  const maxScalar = minScalar + maxAdded + _1n6;
  const modP = (n) => mod(n, P);
  const GuBytes = encodeU(Gu);
  function encodeU(u) {
    return numberToBytesLE(modP(u), fieldLen);
  }
  function decodeU(u) {
    const _u = copyBytes(abytes2(u, fieldLen, "uCoordinate"));
    if (is25519)
      _u[31] &= 127;
    return modP(bytesToNumberLE(_u));
  }
  function decodeScalar(scalar) {
    return bytesToNumberLE(adjustScalarBytes(copyBytes(abytes2(scalar, fieldLen, "scalar"))));
  }
  const lowOrderU = new Set(is25519 ? [
    _0n8,
    _1n6,
    P - _1n6,
    BigInt("325606250916557431795983626356110631294008115727848805560023387167927233504"),
    BigInt("39382357235489614581723060781553021112529911719440698176882885853963445705823")
  ] : [_0n8, _1n6, P - _1n6]);
  function scalarMult(scalar, u) {
    const pointU = decodeU(u);
    if (lowOrderU.has(pointU))
      throw new Error("invalid private or public key received");
    const pu = montgomeryLadder(pointU, decodeScalar(scalar));
    if (pu === _0n8)
      throw new Error("invalid private or public key received");
    return encodeU(pu);
  }
  function scalarMultBase(scalar) {
    if (mulBaseHook === undefined)
      return scalarMult(scalar, GuBytes);
    const k = decodeScalar(scalar);
    aInRange("scalar", k, minScalar, maxScalar);
    const pu = modP(mulBaseHook(k));
    if (pu === _0n8)
      throw new Error("invalid private or public key received");
    return encodeU(pu);
  }
  const getPublicKey = scalarMultBase;
  const getSharedSecret = scalarMult;
  function montgomeryLadder(u, scalar) {
    aInRange("u", u, _0n8, P);
    aInRange("scalar", scalar, minScalar, maxScalar);
    const k = scalar;
    const x_1 = u;
    let x_2 = _1n6;
    let z_2 = _0n8;
    let x_3 = u;
    let z_3 = _1n6;
    const kx = k ^ k >> _1n6;
    for (let t = BigInt(montgomeryBits - 1);t >= _0n8; t--) {
      const mask = cmask(P, kx >> t);
      ({ x_2, x_3 } = swap(mask, x_2, x_3));
      ({ x_2: z_2, x_3: z_3 } = swap(mask, z_2, z_3));
      const A = x_2 + z_2;
      const AA = modP(A * A);
      const B = x_2 - z_2;
      const BB = modP(B * B);
      const E = AA - BB;
      const C = x_3 + z_3;
      const D = x_3 - z_3;
      const DA = modP(D * A);
      const CB = modP(C * B);
      const dacb = DA + CB;
      const da_cb = DA - CB;
      x_3 = modP(dacb * dacb);
      z_3 = modP(x_1 * modP(da_cb * da_cb));
      x_2 = modP(AA * BB);
      z_2 = modP(E * (AA + modP(a24 * E)));
    }
    const mask = cmask(P, k);
    ({ x_2, x_3 } = swap(mask, x_2, x_3));
    ({ x_2: z_2, x_3: z_3 } = swap(mask, z_2, z_3));
    const z2 = powPminus2(z_2);
    return modP(x_2 * z2);
  }
  const lengths = {
    secretKey: fieldLen,
    publicKey: fieldLen,
    seed: fieldLen
  };
  const randomSecretKey = (seed) => {
    seed = seed === undefined ? randomBytes_(fieldLen) : seed;
    abytes2(seed, lengths.seed, "seed");
    return seed;
  };
  const utils = { randomSecretKey };
  Object.freeze(lengths);
  Object.freeze(utils);
  return Object.freeze({
    keygen: createKeygen(randomSecretKey, getPublicKey),
    getSharedSecret,
    getPublicKey,
    scalarMult,
    scalarMultBase,
    utils,
    GuBytes: GuBytes.slice(),
    lengths
  });
}

// node_modules/@noble/curves/ed25519.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n9 = /* @__PURE__ */ BigInt(0);
var _1n7 = /* @__PURE__ */ BigInt(1);
var _2n6 = /* @__PURE__ */ BigInt(2);
var _3n3 = /* @__PURE__ */ BigInt(3);
var _5n2 = /* @__PURE__ */ BigInt(5);
var _8n3 = /* @__PURE__ */ BigInt(8);
var ed25519_CURVE_p = /* @__PURE__ */ BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed");
var ed25519_CURVE = /* @__PURE__ */ (() => ({
  p: ed25519_CURVE_p,
  n: BigInt("0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed"),
  h: _8n3,
  a: BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffec"),
  d: BigInt("0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3"),
  Gx: BigInt("0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a"),
  Gy: BigInt("0x6666666666666666666666666666666666666666666666666666666666666658")
}))();
function ed25519_pow_2_252_3(x) {
  const _10n = BigInt(10), _20n = BigInt(20), _40n = BigInt(40), _80n = BigInt(80);
  const P = ed25519_CURVE_p;
  const x2 = x * x % P;
  const b2 = x2 * x % P;
  const b4 = pow2(b2, _2n6, P) * b2 % P;
  const b5 = pow2(b4, _1n7, P) * x % P;
  const b10 = pow2(b5, _5n2, P) * b5 % P;
  const b20 = pow2(b10, _10n, P) * b10 % P;
  const b40 = pow2(b20, _20n, P) * b20 % P;
  const b80 = pow2(b40, _40n, P) * b40 % P;
  const b160 = pow2(b80, _80n, P) * b80 % P;
  const b240 = pow2(b160, _80n, P) * b80 % P;
  const b250 = pow2(b240, _10n, P) * b10 % P;
  const pow_p_5_8 = pow2(b250, _2n6, P) * x % P;
  return { pow_p_5_8, b2 };
}
function adjustScalarBytes(bytes) {
  bytes[0] &= 248;
  bytes[31] &= 127;
  bytes[31] |= 64;
  return bytes;
}
var ED25519_SQRT_M1 = /* @__PURE__ */ BigInt("19681161376707505956807079304988542015446066515923890162744021073123829784752");
function uvRatio(u, v) {
  const P = ed25519_CURVE_p;
  const v3 = mod(v * v * v, P);
  const v7 = mod(v3 * v3 * v, P);
  const pow = ed25519_pow_2_252_3(u * v7).pow_p_5_8;
  let x = mod(u * v3 * pow, P);
  const vx2 = mod(v * x * x, P);
  const root1 = x;
  const root2 = mod(x * ED25519_SQRT_M1, P);
  const useRoot1 = vx2 === u;
  const useRoot2 = vx2 === mod(-u, P);
  const noRoot = vx2 === mod(-u * ED25519_SQRT_M1, P);
  if (useRoot1)
    x = root1;
  if (useRoot2 || noRoot)
    x = root2;
  if (isNegativeLE(x, P))
    x = mod(-x, P);
  return { isValid: useRoot1 || useRoot2, value: x };
}
var ed25519_Point = /* @__PURE__ */ edwards(ed25519_CURVE, { uvRatio });
var Fp = /* @__PURE__ */ (() => ed25519_Point.Fp)();
function toMontgomery(point) {
  const { y } = point;
  return Fp.toBytes(Fp.div(_1n7 + y, _1n7 - y));
}
function toMontgomerySecret(secretKey) {
  const size = ed25519_Point.Fp.BYTES;
  abytes(secretKey, size);
  return adjustScalarBytes(sha512(secretKey.subarray(0, size))).subarray(0, size);
}
function ed(opts) {
  return eddsa(ed25519_Point, sha512, Object.assign({ adjustScalarBytes, toMontgomery, toMontgomerySecret, zip215: true }, opts));
}
var ed25519 = /* @__PURE__ */ ed({});
var x25519 = /* @__PURE__ */ (() => {
  const P = ed25519_CURVE_p;
  const powPminus2 = (x) => {
    const { pow_p_5_8, b2 } = ed25519_pow_2_252_3(x);
    return mod(pow2(pow_p_5_8, _3n3, P) * b2, P);
  };
  return montgomery({
    P,
    type: "x25519",
    powPminus2,
    adjustScalarBytes,
    scalarMultBase: (k) => {
      const kn = mod(k, ed25519_Point.Fn.ORDER);
      if (kn === _0n9)
        return _0n9;
      const p = ed25519_Point.BASE.multiply(kn);
      return mod((p.Z + p.Y) * powPminus2(mod(p.Z - p.Y, P)), P);
    }
  });
})();

// node_modules/@noble/hashes/hkdf.js
function extract(hash, ikm, salt) {
  ahash(hash);
  if (salt === undefined)
    salt = new Uint8Array(hash.outputLen);
  return hmac(hash, salt, ikm);
}
var HKDF_COUNTER = /* @__PURE__ */ Uint8Array.of(0);
var EMPTY_BUFFER = /* @__PURE__ */ Uint8Array.of();
function expand(hash, prk, info, length = 32, _recycled) {
  ahash(hash);
  anumber(length, "length");
  abytes(prk, undefined, "prk");
  const olen = hash.outputLen;
  if (prk.length < olen)
    throw new Error('"prk" must be at least HashLen octets');
  if (length > 255 * olen)
    throw new Error("Length must be <= 255*HashLen");
  const blocks = Math.ceil(length / olen);
  if (info === undefined)
    info = EMPTY_BUFFER;
  else
    abytes(info, undefined, "info");
  if (!blocks) {
    if (_recycled)
      clean(prk);
    return new Uint8Array;
  }
  const okm = _recycled && blocks === 1 ? prk : new Uint8Array(blocks * olen);
  const { iHash, oHash } = hmac.create(hash, prk);
  const T = _recycled ? prk : new Uint8Array(olen);
  const worker = blocks > 1 ? _recycled?.iHash || hash.create() : undefined;
  for (let counter = 0;counter < blocks - 1; counter++) {
    HKDF_COUNTER[0] = counter + 1;
    const iWork = iHash._cloneInto(worker);
    if (counter)
      iWork.update(T);
    iWork.update(info).update(HKDF_COUNTER).digestInto(T);
    oHash._cloneInto(worker).update(T).digestInto(T);
    okm.set(T, olen * counter);
  }
  HKDF_COUNTER[0] = blocks;
  if (blocks > 1)
    iHash.update(T);
  iHash.update(info).update(HKDF_COUNTER).digestInto(T);
  oHash.update(T).digestInto(T);
  okm.set(T, olen * (blocks - 1));
  iHash.destroy();
  oHash.destroy();
  worker?.destroy();
  if (T !== okm)
    clean(T);
  clean(HKDF_COUNTER);
  if (length === okm.length)
    return okm;
  const res = okm.slice(0, length);
  clean(okm);
  return res;
}
var hkdf = (hash, ikm, salt, info, length) => {
  ahash(hash);
  if (salt === undefined)
    salt = new Uint8Array(hash.outputLen);
  const HMAC = hmac.create(hash, salt).update(ikm);
  return expand(hash, HMAC.digest(), info, length, HMAC);
};

// node_modules/@noble/hashes/pbkdf2.js
function pbkdf2Init(hash, _password, _salt, _opts) {
  ahash(hash);
  const opts = checkOpts({ dkLen: 32, asyncTick: 10 }, _opts);
  const { c, dkLen, asyncTick } = opts;
  anumber(c, "c");
  anumber(dkLen, "dkLen");
  anumber(asyncTick, "asyncTick");
  if (c < 1)
    throw new Error('"c" (iterations) must be >= 1');
  if (dkLen < 1)
    throw new Error('"dkLen" must be >= 1');
  if (dkLen > (2 ** 32 - 1) * hash.outputLen)
    throw new Error("derived key too long");
  const p = kdfInputToBytes(_password, "password");
  try {
    const s = kdfInputToBytes(_salt, "salt");
    try {
      const DK = new Uint8Array(dkLen);
      const { iHash, oHash, outputLen } = hmac.create(hash, p);
      const u = new Uint8Array(outputLen);
      const eng = pbkdf2Engine(iHash, oHash, s, u);
      return { c, dkLen, asyncTick, DK, outputLen, eng };
    } finally {
      if (typeof _salt === "string")
        clean(s);
    }
  } finally {
    if (typeof _password === "string")
      clean(p);
  }
}
function pbkdf2Engine(iHash, oHash, salt, u) {
  const counter = new Uint8Array(4);
  const view = createView(counter);
  const salted = iHash._cloneInto().update(salt);
  const work = oHash._cloneInto();
  const iClone = iHash._cloneInto;
  const oClone = oHash._cloneInto;
  return {
    u1: (ti, Ti) => {
      view.setInt32(0, ti, false);
      salted._cloneInto(work).update(counter).digestInto(u);
      oHash._cloneInto(work).update(u).digestInto(u);
      Ti.set(u.subarray(0, Ti.length));
    },
    rounds: (c, Ti) => {
      for (let ui = 1;ui < c; ui++) {
        iClone.call(iHash, work).update(u).digestInto(u);
        oClone.call(oHash, work).update(u).digestInto(u);
        for (let i = 0;i < Ti.length; i++)
          Ti[i] ^= u[i];
      }
    },
    output: (DK) => {
      iHash.destroy();
      oHash.destroy();
      salted.destroy();
      work.destroy();
      clean(u);
      return DK;
    }
  };
}
function pbkdf2(hash, password, salt, opts) {
  const { c, dkLen, DK, outputLen, eng } = pbkdf2Init(hash, password, salt, opts);
  for (let ti = 1, pos = 0;pos < dkLen; ti++, pos += outputLen) {
    const Ti = DK.subarray(pos, pos + outputLen);
    eng.u1(ti, Ti);
    eng.rounds(c, Ti);
  }
  return eng.output(DK);
}

// node_modules/@noble/hashes/scrypt.js
function XorAndSalsa(prev, pi, input, ii, out, oi) {
  let y00 = prev[pi++] ^ input[ii++], y01 = prev[pi++] ^ input[ii++];
  let y02 = prev[pi++] ^ input[ii++], y03 = prev[pi++] ^ input[ii++];
  let y04 = prev[pi++] ^ input[ii++], y05 = prev[pi++] ^ input[ii++];
  let y06 = prev[pi++] ^ input[ii++], y07 = prev[pi++] ^ input[ii++];
  let y08 = prev[pi++] ^ input[ii++], y09 = prev[pi++] ^ input[ii++];
  let y10 = prev[pi++] ^ input[ii++], y11 = prev[pi++] ^ input[ii++];
  let y12 = prev[pi++] ^ input[ii++], y13 = prev[pi++] ^ input[ii++];
  let y14 = prev[pi++] ^ input[ii++], y15 = prev[pi++] ^ input[ii++];
  let x00 = y00, x01 = y01, x02 = y02, x03 = y03, x04 = y04, x05 = y05, x06 = y06, x07 = y07, x08 = y08, x09 = y09, x10 = y10, x11 = y11, x12 = y12, x13 = y13, x14 = y14, x15 = y15;
  for (let i = 0;i < 8; i += 2) {
    x04 ^= rotl(x00 + x12 | 0, 7);
    x08 ^= rotl(x04 + x00 | 0, 9);
    x12 ^= rotl(x08 + x04 | 0, 13);
    x00 ^= rotl(x12 + x08 | 0, 18);
    x09 ^= rotl(x05 + x01 | 0, 7);
    x13 ^= rotl(x09 + x05 | 0, 9);
    x01 ^= rotl(x13 + x09 | 0, 13);
    x05 ^= rotl(x01 + x13 | 0, 18);
    x14 ^= rotl(x10 + x06 | 0, 7);
    x02 ^= rotl(x14 + x10 | 0, 9);
    x06 ^= rotl(x02 + x14 | 0, 13);
    x10 ^= rotl(x06 + x02 | 0, 18);
    x03 ^= rotl(x15 + x11 | 0, 7);
    x07 ^= rotl(x03 + x15 | 0, 9);
    x11 ^= rotl(x07 + x03 | 0, 13);
    x15 ^= rotl(x11 + x07 | 0, 18);
    x01 ^= rotl(x00 + x03 | 0, 7);
    x02 ^= rotl(x01 + x00 | 0, 9);
    x03 ^= rotl(x02 + x01 | 0, 13);
    x00 ^= rotl(x03 + x02 | 0, 18);
    x06 ^= rotl(x05 + x04 | 0, 7);
    x07 ^= rotl(x06 + x05 | 0, 9);
    x04 ^= rotl(x07 + x06 | 0, 13);
    x05 ^= rotl(x04 + x07 | 0, 18);
    x11 ^= rotl(x10 + x09 | 0, 7);
    x08 ^= rotl(x11 + x10 | 0, 9);
    x09 ^= rotl(x08 + x11 | 0, 13);
    x10 ^= rotl(x09 + x08 | 0, 18);
    x12 ^= rotl(x15 + x14 | 0, 7);
    x13 ^= rotl(x12 + x15 | 0, 9);
    x14 ^= rotl(x13 + x12 | 0, 13);
    x15 ^= rotl(x14 + x13 | 0, 18);
  }
  out[oi++] = y00 + x00 | 0;
  out[oi++] = y01 + x01 | 0;
  out[oi++] = y02 + x02 | 0;
  out[oi++] = y03 + x03 | 0;
  out[oi++] = y04 + x04 | 0;
  out[oi++] = y05 + x05 | 0;
  out[oi++] = y06 + x06 | 0;
  out[oi++] = y07 + x07 | 0;
  out[oi++] = y08 + x08 | 0;
  out[oi++] = y09 + x09 | 0;
  out[oi++] = y10 + x10 | 0;
  out[oi++] = y11 + x11 | 0;
  out[oi++] = y12 + x12 | 0;
  out[oi++] = y13 + x13 | 0;
  out[oi++] = y14 + x14 | 0;
  out[oi++] = y15 + x15 | 0;
}
function BlockMix(input, ii, out, oi, r) {
  let head = oi + 0;
  let tail = oi + 16 * r;
  for (let i = 0;i < 16; i++)
    out[tail + i] = input[ii + (2 * r - 1) * 16 + i];
  for (let i = 0;i < r; i++, head += 16, ii += 16) {
    XorAndSalsa(out, tail, input, ii, out, head);
    if (i > 0)
      tail += 16;
    XorAndSalsa(out, head, input, ii += 16, out, tail);
  }
}
var SCRYPT_DEFAULT_MAXMEM = 128 * 8 * (2 ** 20 + 1 + 1);
function scryptInit(password, salt, _opts) {
  const opts = checkOpts({
    dkLen: 32,
    asyncTick: 10,
    maxmem: SCRYPT_DEFAULT_MAXMEM
  }, _opts);
  const { N, r, p, dkLen, asyncTick, maxmem, onProgress } = opts;
  anumber(N, "N");
  anumber(r, "r");
  anumber(p, "p");
  anumber(dkLen, "dkLen");
  anumber(asyncTick, "asyncTick");
  anumber(maxmem, "maxmem");
  if (onProgress !== undefined && typeof onProgress !== "function")
    throw new Error('"onProgress" must be a function');
  if (r < 1)
    throw new Error('"r" expected integer >= 1');
  const blockSize = 128 * r;
  const blockSize32 = blockSize / 4;
  const pow32 = Math.pow(2, 32);
  if (N <= 1 || (N & N - 1) !== 0 || N > pow32)
    throw new Error('"N" expected a power of 2, and 2^1 <= N <= 2^32');
  if (p < 1 || p > (pow32 - 1) * 32 / blockSize)
    throw new Error('"p" expected integer 1..((2^32 - 1) * 32) / (128 * r)');
  if (dkLen < 1 || dkLen > (pow32 - 1) * 32)
    throw new Error('"dkLen" expected integer 1..(2^32 - 1) * 32');
  const memUsed = blockSize * (N + p + 1);
  if (memUsed > maxmem)
    throw new Error('"maxmem" limit was hit: memUsed(128*r*(N+p+1))=' + memUsed + ", maxmem=" + maxmem);
  const B = pbkdf2(sha256, password, salt, { c: 1, dkLen: blockSize * p });
  const B32 = u32(B);
  const V = u32(new Uint8Array(blockSize * N));
  const tmp = u32(new Uint8Array(blockSize));
  let blockMixCb = () => {};
  if (onProgress) {
    const totalBlockMix = 2 * N * p;
    const callbackPer = Math.max(Math.floor(totalBlockMix / 1e4), 1);
    let blockMixCnt = 0;
    blockMixCb = () => {
      blockMixCnt++;
      if (onProgress && (!(blockMixCnt % callbackPer) || blockMixCnt === totalBlockMix)) {
        try {
          onProgress(blockMixCnt / totalBlockMix);
        } catch (e) {
          clean(B, V, tmp);
          throw e;
        }
      }
    };
  }
  return { N, r, p, dkLen, blockSize32, V, B32, B, tmp, blockMixCb, asyncTick };
}
function scryptOutput(password, dkLen, B, V, tmp) {
  const res = pbkdf2(sha256, password, B, { c: 1, dkLen });
  clean(B, V, tmp);
  return res;
}
function scrypt(password, salt, opts) {
  const { N, r, p, dkLen, blockSize32, V, B32, B, tmp, blockMixCb } = scryptInit(password, salt, opts);
  swap32IfBE(B32);
  for (let pi = 0;pi < p; pi++) {
    const Pi = blockSize32 * pi;
    for (let i = 0;i < blockSize32; i++)
      V[i] = B32[Pi + i];
    for (let i = 0, pos = 0;i < N - 1; i++) {
      BlockMix(V, pos, V, pos += blockSize32, r);
      blockMixCb();
    }
    BlockMix(V, (N - 1) * blockSize32, B32, Pi, r);
    blockMixCb();
    for (let i = 0;i < N; i++) {
      const j = (B32[Pi + blockSize32 - 16] & N - 1) >>> 0;
      for (let k = 0;k < blockSize32; k++)
        tmp[k] = B32[Pi + k] ^ V[j * blockSize32 + k];
      BlockMix(tmp, 0, B32, Pi, r);
      blockMixCb();
    }
  }
  swap32IfBE(B32);
  return scryptOutput(password, dkLen, B, V, tmp);
}

// node_modules/@noble/post-quantum/node_modules/@noble/hashes/utils.js
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function isBytes5(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function anumber5(n, title = "") {
  if (!Number.isSafeInteger(n) || n < 0) {
    const prefix = title && `"${title}" `;
    throw new Error(`${prefix}expected integer >= 0, got ${n}`);
  }
}
function abytes5(value, length, title = "") {
  const bytes = isBytes5(value);
  const len = value?.length;
  const needsLen = length !== undefined;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
function ahash2(h) {
  if (typeof h !== "function" || typeof h.create !== "function")
    throw new Error("Hash must wrapped by utils.createHasher");
  anumber5(h.outputLen);
  anumber5(h.blockLen);
}
function aexists3(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput3(out, instance) {
  abytes5(out, undefined, "digestInto() output");
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error('"digestInto() output" expected to be of length >=' + min);
  }
}
function u323(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean3(...arrays) {
  for (let i = 0;i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function createView3(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function rotr2(word, shift) {
  return word << 32 - shift | word >>> shift;
}
var isLE3 = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
function byteSwap3(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
function byteSwap323(arr) {
  for (let i = 0;i < arr.length; i++) {
    arr[i] = byteSwap3(arr[i]);
  }
  return arr;
}
var swap32IfBE3 = isLE3 ? (u) => u : byteSwap323;
var hasHexBuiltin2 = /* @__PURE__ */ (() => typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function")();
var hexes2 = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex3(bytes) {
  abytes5(bytes);
  if (hasHexBuiltin2)
    return bytes.toHex();
  let hex = "";
  for (let i = 0;i < bytes.length; i++) {
    hex += hexes2[bytes[i]];
  }
  return hex;
}
var asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase162(ch) {
  if (ch >= asciis._0 && ch <= asciis._9)
    return ch - asciis._0;
  if (ch >= asciis.A && ch <= asciis.F)
    return ch - (asciis.A - 10);
  if (ch >= asciis.a && ch <= asciis.f)
    return ch - (asciis.a - 10);
  return;
}
function hexToBytes3(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  if (hasHexBuiltin2)
    return Uint8Array.fromHex(hex);
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    throw new Error("hex string expected, got unpadded hex of length " + hl);
  const array = new Uint8Array(al);
  for (let ai = 0, hi = 0;ai < al; ai++, hi += 2) {
    const n1 = asciiToBase162(hex.charCodeAt(hi));
    const n2 = asciiToBase162(hex.charCodeAt(hi + 1));
    if (n1 === undefined || n2 === undefined) {
      const char = hex[hi] + hex[hi + 1];
      throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
    }
    array[ai] = n1 * 16 + n2;
  }
  return array;
}
function concatBytes3(...arrays) {
  let sum = 0;
  for (let i = 0;i < arrays.length; i++) {
    const a = arrays[i];
    abytes5(a);
    sum += a.length;
  }
  const res = new Uint8Array(sum);
  for (let i = 0, pad = 0;i < arrays.length; i++) {
    const a = arrays[i];
    res.set(a, pad);
    pad += a.length;
  }
  return res;
}
function createHasher2(hashCons, info = {}) {
  const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
  const tmp = hashCons(undefined);
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (opts) => hashCons(opts);
  Object.assign(hashC, info);
  return Object.freeze(hashC);
}
function randomBytes4(bytesLength = 32) {
  const cr = typeof globalThis === "object" ? globalThis.crypto : null;
  if (typeof cr?.getRandomValues !== "function")
    throw new Error("crypto.getRandomValues must be defined");
  return cr.getRandomValues(new Uint8Array(bytesLength));
}
var oidNist2 = (suffix) => ({
  oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
});

// node_modules/@noble/post-quantum/node_modules/@noble/curves/utils.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n10 = /* @__PURE__ */ BigInt(0);
var _1n8 = /* @__PURE__ */ BigInt(1);
function abool3(value, title = "") {
  if (typeof value !== "boolean") {
    const prefix = title && `"${title}" `;
    throw new Error(prefix + "expected boolean, got type=" + typeof value);
  }
  return value;
}
function abignumber2(n) {
  if (typeof n === "bigint") {
    if (!isPosBig2(n))
      throw new Error("positive bigint expected, got " + n);
  } else
    anumber5(n);
  return n;
}
function numberToHexUnpadded2(num) {
  const hex = abignumber2(num).toString(16);
  return hex.length & 1 ? "0" + hex : hex;
}
function hexToNumber2(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  return hex === "" ? _0n10 : BigInt("0x" + hex);
}
function bytesToNumberBE2(bytes) {
  return hexToNumber2(bytesToHex3(bytes));
}
function bytesToNumberLE2(bytes) {
  return hexToNumber2(bytesToHex3(copyBytes3(abytes5(bytes)).reverse()));
}
function numberToBytesBE2(n, len) {
  anumber5(len);
  n = abignumber2(n);
  const res = hexToBytes3(n.toString(16).padStart(len * 2, "0"));
  if (res.length !== len)
    throw new Error("number too large");
  return res;
}
function numberToBytesLE2(n, len) {
  return numberToBytesBE2(n, len).reverse();
}
function copyBytes3(bytes) {
  return Uint8Array.from(bytes);
}
function asciiToBytes2(ascii) {
  return Uint8Array.from(ascii, (c, i) => {
    const charCode = c.charCodeAt(0);
    if (c.length !== 1 || charCode > 127) {
      throw new Error(`string contains non-ASCII character "${ascii[i]}" with code ${charCode} at position ${i}`);
    }
    return charCode;
  });
}
var isPosBig2 = (n) => typeof n === "bigint" && _0n10 <= n;
function inRange2(n, min, max) {
  return isPosBig2(n) && isPosBig2(min) && isPosBig2(max) && min <= n && n < max;
}
function aInRange2(title, n, min, max) {
  if (!inRange2(n, min, max))
    throw new Error("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
function bitLen2(n) {
  let len;
  for (len = 0;n > _0n10; n >>= _1n8, len += 1)
    ;
  return len;
}
var bitMask2 = (n) => (_1n8 << BigInt(n)) - _1n8;
function createHmacDrbg2(hashLen, qByteLen, hmacFn) {
  anumber5(hashLen, "hashLen");
  anumber5(qByteLen, "qByteLen");
  if (typeof hmacFn !== "function")
    throw new Error("hmacFn must be a function");
  const u8n = (len) => new Uint8Array(len);
  const NULL = Uint8Array.of();
  const byte0 = Uint8Array.of(0);
  const byte1 = Uint8Array.of(1);
  const _maxDrbgIters = 1000;
  let v = u8n(hashLen);
  let k = u8n(hashLen);
  let i = 0;
  const reset = () => {
    v.fill(1);
    k.fill(0);
    i = 0;
  };
  const h = (...msgs) => hmacFn(k, concatBytes3(v, ...msgs));
  const reseed = (seed = NULL) => {
    k = h(byte0, seed);
    v = h();
    if (seed.length === 0)
      return;
    k = h(byte1, seed);
    v = h();
  };
  const gen = () => {
    if (i++ >= _maxDrbgIters)
      throw new Error("drbg: tried max amount of iterations");
    let len = 0;
    const out = [];
    while (len < qByteLen) {
      v = h();
      const sl = v.slice();
      out.push(sl);
      len += v.length;
    }
    return concatBytes3(...out);
  };
  const genUntil = (seed, pred) => {
    reset();
    reseed(seed);
    let res = undefined;
    while (!(res = pred(gen())))
      reseed();
    reset();
    return res;
  };
  return genUntil;
}
function validateObject2(object, fields = {}, optFields = {}) {
  if (!object || typeof object !== "object")
    throw new Error("expected valid options object");
  function checkField(fieldName, expectedType, isOpt) {
    const val = object[fieldName];
    if (isOpt && val === undefined)
      return;
    const current = typeof val;
    if (current !== expectedType || val === null)
      throw new Error(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
  }
  const iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
  iter(fields, false);
  iter(optFields, true);
}
function memoized(fn) {
  const map = new WeakMap;
  return (arg, ...args) => {
    const val = map.get(arg);
    if (val !== undefined)
      return val;
    const computed = fn(arg, ...args);
    map.set(arg, computed);
    return computed;
  };
}

// node_modules/@noble/post-quantum/node_modules/@noble/curves/abstract/modular.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n11 = /* @__PURE__ */ BigInt(0);
var _1n9 = /* @__PURE__ */ BigInt(1);
var _2n7 = /* @__PURE__ */ BigInt(2);
var _3n4 = /* @__PURE__ */ BigInt(3);
var _4n5 = /* @__PURE__ */ BigInt(4);
var _5n3 = /* @__PURE__ */ BigInt(5);
var _7n2 = /* @__PURE__ */ BigInt(7);
var _8n4 = /* @__PURE__ */ BigInt(8);
var _9n2 = /* @__PURE__ */ BigInt(9);
var _16n2 = /* @__PURE__ */ BigInt(16);
function mod2(a, b) {
  const result = a % b;
  return result >= _0n11 ? result : b + result;
}
function pow22(x, power, modulo) {
  let res = x;
  while (power-- > _0n11) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert2(number, modulo) {
  if (number === _0n11)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _0n11)
    throw new Error("invert: expected positive modulus, got " + modulo);
  let a = mod2(number, modulo);
  let b = modulo;
  let x = _0n11, y = _1n9, u = _1n9, v = _0n11;
  while (a !== _0n11) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    b = a, a = r, x = u, y = v, u = m, v = n;
  }
  const gcd = b;
  if (gcd !== _1n9)
    throw new Error("invert: does not exist");
  return mod2(x, modulo);
}
function assertIsSquare2(Fp, root, n) {
  if (!Fp.eql(Fp.sqr(root), n))
    throw new Error("Cannot find square root");
}
function sqrt3mod42(Fp, n) {
  const p1div4 = (Fp.ORDER + _1n9) / _4n5;
  const root = Fp.pow(n, p1div4);
  assertIsSquare2(Fp, root, n);
  return root;
}
function sqrt5mod82(Fp, n) {
  const p5div8 = (Fp.ORDER - _5n3) / _8n4;
  const n2 = Fp.mul(n, _2n7);
  const v = Fp.pow(n2, p5div8);
  const nv = Fp.mul(n, v);
  const i = Fp.mul(Fp.mul(nv, _2n7), v);
  const root = Fp.mul(nv, Fp.sub(i, Fp.ONE));
  assertIsSquare2(Fp, root, n);
  return root;
}
function sqrt9mod162(P) {
  const Fp_ = Field2(P);
  const tn = tonelliShanks2(P);
  const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
  const c2 = tn(Fp_, c1);
  const c3 = tn(Fp_, Fp_.neg(c1));
  const c4 = (P + _7n2) / _16n2;
  return (Fp, n) => {
    let tv1 = Fp.pow(n, c4);
    let tv2 = Fp.mul(tv1, c1);
    const tv3 = Fp.mul(tv1, c2);
    const tv4 = Fp.mul(tv1, c3);
    const e1 = Fp.eql(Fp.sqr(tv2), n);
    const e2 = Fp.eql(Fp.sqr(tv3), n);
    tv1 = Fp.cmov(tv1, tv2, e1);
    tv2 = Fp.cmov(tv4, tv3, e2);
    const e3 = Fp.eql(Fp.sqr(tv2), n);
    const root = Fp.cmov(tv1, tv2, e3);
    assertIsSquare2(Fp, root, n);
    return root;
  };
}
function tonelliShanks2(P) {
  if (P < _3n4)
    throw new Error("sqrt is not defined for small field");
  let Q = P - _1n9;
  let S = 0;
  while (Q % _2n7 === _0n11) {
    Q /= _2n7;
    S++;
  }
  let Z = _2n7;
  const _Fp = Field2(P);
  while (FpLegendre2(_Fp, Z) === 1) {
    if (Z++ > 1000)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod42;
  let cc = _Fp.pow(Z, Q);
  const Q1div2 = (Q + _1n9) / _2n7;
  return function tonelliSlow(Fp, n) {
    if (Fp.is0(n))
      return n;
    if (FpLegendre2(Fp, n) !== 1)
      throw new Error("Cannot find square root");
    let M = S;
    let c = Fp.mul(Fp.ONE, cc);
    let t = Fp.pow(n, Q);
    let R = Fp.pow(n, Q1div2);
    while (!Fp.eql(t, Fp.ONE)) {
      if (Fp.is0(t))
        return Fp.ZERO;
      let i = 1;
      let t_tmp = Fp.sqr(t);
      while (!Fp.eql(t_tmp, Fp.ONE)) {
        i++;
        t_tmp = Fp.sqr(t_tmp);
        if (i === M)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n9 << BigInt(M - i - 1);
      const b = Fp.pow(c, exponent);
      M = i;
      c = Fp.sqr(b);
      t = Fp.mul(t, c);
      R = Fp.mul(R, b);
    }
    return R;
  };
}
function FpSqrt2(P) {
  if (P % _4n5 === _3n4)
    return sqrt3mod42;
  if (P % _8n4 === _5n3)
    return sqrt5mod82;
  if (P % _16n2 === _9n2)
    return sqrt9mod162(P);
  return tonelliShanks2(P);
}
var FIELD_FIELDS2 = [
  "create",
  "isValid",
  "is0",
  "neg",
  "inv",
  "sqrt",
  "sqr",
  "eql",
  "add",
  "sub",
  "mul",
  "pow",
  "div",
  "addN",
  "subN",
  "mulN",
  "sqrN"
];
function validateField2(field) {
  const initial = {
    ORDER: "bigint",
    BYTES: "number",
    BITS: "number"
  };
  const opts = FIELD_FIELDS2.reduce((map, val) => {
    map[val] = "function";
    return map;
  }, initial);
  validateObject2(field, opts);
  return field;
}
function FpPow(Fp, num, power) {
  if (power < _0n11)
    throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n11)
    return Fp.ONE;
  if (power === _1n9)
    return num;
  let p = Fp.ONE;
  let d = num;
  while (power > _0n11) {
    if (power & _1n9)
      p = Fp.mul(p, d);
    d = Fp.sqr(d);
    power >>= _1n9;
  }
  return p;
}
function FpInvertBatch2(Fp, nums, passZero = false) {
  const inverted = new Array(nums.length).fill(passZero ? Fp.ZERO : undefined);
  const multipliedAcc = nums.reduce((acc, num, i) => {
    if (Fp.is0(num))
      return acc;
    inverted[i] = acc;
    return Fp.mul(acc, num);
  }, Fp.ONE);
  const invertedAcc = Fp.inv(multipliedAcc);
  nums.reduceRight((acc, num, i) => {
    if (Fp.is0(num))
      return acc;
    inverted[i] = Fp.mul(acc, inverted[i]);
    return Fp.mul(acc, num);
  }, invertedAcc);
  return inverted;
}
function FpLegendre2(Fp, n) {
  const p1mod2 = (Fp.ORDER - _1n9) / _2n7;
  const powered = Fp.pow(n, p1mod2);
  const yes = Fp.eql(powered, Fp.ONE);
  const zero = Fp.eql(powered, Fp.ZERO);
  const no = Fp.eql(powered, Fp.neg(Fp.ONE));
  if (!yes && !zero && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
function nLength2(n, nBitLength) {
  if (nBitLength !== undefined)
    anumber5(nBitLength);
  const _nBitLength = nBitLength !== undefined ? nBitLength : n.toString(2).length;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}

class _Field2 {
  ORDER;
  BITS;
  BYTES;
  isLE;
  ZERO = _0n11;
  ONE = _1n9;
  _lengths;
  _sqrt;
  _mod;
  constructor(ORDER, opts = {}) {
    if (ORDER <= _0n11)
      throw new Error("invalid field: expected ORDER > 0, got " + ORDER);
    let _nbitLength = undefined;
    this.isLE = false;
    if (opts != null && typeof opts === "object") {
      if (typeof opts.BITS === "number")
        _nbitLength = opts.BITS;
      if (typeof opts.sqrt === "function")
        this.sqrt = opts.sqrt;
      if (typeof opts.isLE === "boolean")
        this.isLE = opts.isLE;
      if (opts.allowedLengths)
        this._lengths = opts.allowedLengths?.slice();
      if (typeof opts.modFromBytes === "boolean")
        this._mod = opts.modFromBytes;
    }
    const { nBitLength, nByteLength } = nLength2(ORDER, _nbitLength);
    if (nByteLength > 2048)
      throw new Error("invalid field: expected ORDER of <= 2048 bytes");
    this.ORDER = ORDER;
    this.BITS = nBitLength;
    this.BYTES = nByteLength;
    this._sqrt = undefined;
    Object.preventExtensions(this);
  }
  create(num) {
    return mod2(num, this.ORDER);
  }
  isValid(num) {
    if (typeof num !== "bigint")
      throw new Error("invalid field element: expected bigint, got " + typeof num);
    return _0n11 <= num && num < this.ORDER;
  }
  is0(num) {
    return num === _0n11;
  }
  isValidNot0(num) {
    return !this.is0(num) && this.isValid(num);
  }
  isOdd(num) {
    return (num & _1n9) === _1n9;
  }
  neg(num) {
    return mod2(-num, this.ORDER);
  }
  eql(lhs, rhs) {
    return lhs === rhs;
  }
  sqr(num) {
    return mod2(num * num, this.ORDER);
  }
  add(lhs, rhs) {
    return mod2(lhs + rhs, this.ORDER);
  }
  sub(lhs, rhs) {
    return mod2(lhs - rhs, this.ORDER);
  }
  mul(lhs, rhs) {
    return mod2(lhs * rhs, this.ORDER);
  }
  pow(num, power) {
    return FpPow(this, num, power);
  }
  div(lhs, rhs) {
    return mod2(lhs * invert2(rhs, this.ORDER), this.ORDER);
  }
  sqrN(num) {
    return num * num;
  }
  addN(lhs, rhs) {
    return lhs + rhs;
  }
  subN(lhs, rhs) {
    return lhs - rhs;
  }
  mulN(lhs, rhs) {
    return lhs * rhs;
  }
  inv(num) {
    return invert2(num, this.ORDER);
  }
  sqrt(num) {
    if (!this._sqrt)
      this._sqrt = FpSqrt2(this.ORDER);
    return this._sqrt(this, num);
  }
  toBytes(num) {
    return this.isLE ? numberToBytesLE2(num, this.BYTES) : numberToBytesBE2(num, this.BYTES);
  }
  fromBytes(bytes, skipValidation = false) {
    abytes5(bytes);
    const { _lengths: allowedLengths, BYTES, isLE, ORDER, _mod: modFromBytes } = this;
    if (allowedLengths) {
      if (!allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
        throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
      }
      const padded = new Uint8Array(BYTES);
      padded.set(bytes, isLE ? 0 : padded.length - bytes.length);
      bytes = padded;
    }
    if (bytes.length !== BYTES)
      throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
    let scalar = isLE ? bytesToNumberLE2(bytes) : bytesToNumberBE2(bytes);
    if (modFromBytes)
      scalar = mod2(scalar, ORDER);
    if (!skipValidation) {
      if (!this.isValid(scalar))
        throw new Error("invalid field element: outside of range 0..ORDER");
    }
    return scalar;
  }
  invertBatch(lst) {
    return FpInvertBatch2(this, lst);
  }
  cmov(a, b, condition) {
    return condition ? b : a;
  }
}
function Field2(ORDER, opts = {}) {
  return new _Field2(ORDER, opts);
}
function getFieldBytesLength2(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  const bitLength = fieldOrder.toString(2).length;
  return Math.ceil(bitLength / 8);
}
function getMinHashLength2(fieldOrder) {
  const length = getFieldBytesLength2(fieldOrder);
  return length + Math.ceil(length / 2);
}
function mapHashToField2(key, fieldOrder, isLE = false) {
  abytes5(key);
  const len = key.length;
  const fieldLen = getFieldBytesLength2(fieldOrder);
  const minLen = getMinHashLength2(fieldOrder);
  if (len < 16 || len < minLen || len > 1024)
    throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num = isLE ? bytesToNumberLE2(key) : bytesToNumberBE2(key);
  const reduced = mod2(num, fieldOrder - _1n9) + _1n9;
  return isLE ? numberToBytesLE2(reduced, fieldLen) : numberToBytesBE2(reduced, fieldLen);
}

// node_modules/@noble/post-quantum/node_modules/@noble/curves/abstract/curve.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n12 = /* @__PURE__ */ BigInt(0);
var _1n10 = /* @__PURE__ */ BigInt(1);
function negateCt(condition, item) {
  const neg = item.negate();
  return condition ? neg : item;
}
function normalizeZ2(c, points) {
  const invertedZs = FpInvertBatch2(c.Fp, points.map((p) => p.Z));
  return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
function validateW2(W, bits) {
  if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
    throw new Error("invalid window size, expected [1.." + bits + "], got W=" + W);
}
function calcWOpts(W, scalarBits) {
  validateW2(W, scalarBits);
  const windows = Math.ceil(scalarBits / W) + 1;
  const windowSize = 2 ** (W - 1);
  const maxNumber = 2 ** W;
  const mask = bitMask2(W);
  const shiftBy = BigInt(W);
  return { windows, windowSize, mask, maxNumber, shiftBy };
}
function calcOffsets(n, window2, wOpts) {
  const { windowSize, mask, maxNumber, shiftBy } = wOpts;
  let wbits = Number(n & mask);
  let nextN = n >> shiftBy;
  if (wbits > windowSize) {
    wbits -= maxNumber;
    nextN += _1n10;
  }
  const offsetStart = window2 * windowSize;
  const offset = offsetStart + Math.abs(wbits) - 1;
  const isZero = wbits === 0;
  const isNeg = wbits < 0;
  const isNegF = window2 % 2 !== 0;
  const offsetF = offsetStart;
  return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
var pointPrecomputes = new WeakMap;
var pointWindowSizes2 = new WeakMap;
function getW(P) {
  return pointWindowSizes2.get(P) || 1;
}
function assert0(n) {
  if (n !== _0n12)
    throw new Error("invalid wNAF");
}

class wNAF {
  BASE;
  ZERO;
  Fn;
  bits;
  constructor(Point, bits) {
    this.BASE = Point.BASE;
    this.ZERO = Point.ZERO;
    this.Fn = Point.Fn;
    this.bits = bits;
  }
  _unsafeLadder(elm, n, p = this.ZERO) {
    let d = elm;
    while (n > _0n12) {
      if (n & _1n10)
        p = p.add(d);
      d = d.double();
      n >>= _1n10;
    }
    return p;
  }
  precomputeWindow(point, W) {
    const { windows, windowSize } = calcWOpts(W, this.bits);
    const points = [];
    let p = point;
    let base = p;
    for (let window2 = 0;window2 < windows; window2++) {
      base = p;
      points.push(base);
      for (let i = 1;i < windowSize; i++) {
        base = base.add(p);
        points.push(base);
      }
      p = base.double();
    }
    return points;
  }
  wNAF(W, precomputes, n) {
    if (!this.Fn.isValid(n))
      throw new Error("invalid scalar");
    let p = this.ZERO;
    let f = this.BASE;
    const wo = calcWOpts(W, this.bits);
    for (let window2 = 0;window2 < wo.windows; window2++) {
      const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window2, wo);
      n = nextN;
      if (isZero) {
        f = f.add(negateCt(isNegF, precomputes[offsetF]));
      } else {
        p = p.add(negateCt(isNeg, precomputes[offset]));
      }
    }
    assert0(n);
    return { p, f };
  }
  wNAFUnsafe(W, precomputes, n, acc = this.ZERO) {
    const wo = calcWOpts(W, this.bits);
    for (let window2 = 0;window2 < wo.windows; window2++) {
      if (n === _0n12)
        break;
      const { nextN, offset, isZero, isNeg } = calcOffsets(n, window2, wo);
      n = nextN;
      if (isZero) {
        continue;
      } else {
        const item = precomputes[offset];
        acc = acc.add(isNeg ? item.negate() : item);
      }
    }
    assert0(n);
    return acc;
  }
  getPrecomputes(W, point, transform) {
    let comp = pointPrecomputes.get(point);
    if (!comp) {
      comp = this.precomputeWindow(point, W);
      if (W !== 1) {
        if (typeof transform === "function")
          comp = transform(comp);
        pointPrecomputes.set(point, comp);
      }
    }
    return comp;
  }
  cached(point, scalar, transform) {
    const W = getW(point);
    return this.wNAF(W, this.getPrecomputes(W, point, transform), scalar);
  }
  unsafe(point, scalar, transform, prev) {
    const W = getW(point);
    if (W === 1)
      return this._unsafeLadder(point, scalar, prev);
    return this.wNAFUnsafe(W, this.getPrecomputes(W, point, transform), scalar, prev);
  }
  createCache(P, W) {
    validateW2(W, this.bits);
    pointWindowSizes2.set(P, W);
    pointPrecomputes.delete(P);
  }
  hasCache(elm) {
    return getW(elm) !== 1;
  }
}
function mulEndoUnsafe(Point, point, k1, k2) {
  let acc = point;
  let p1 = Point.ZERO;
  let p2 = Point.ZERO;
  while (k1 > _0n12 || k2 > _0n12) {
    if (k1 & _1n10)
      p1 = p1.add(acc);
    if (k2 & _1n10)
      p2 = p2.add(acc);
    acc = acc.double();
    k1 >>= _1n10;
    k2 >>= _1n10;
  }
  return { p1, p2 };
}
function createField2(order, field, isLE) {
  if (field) {
    if (field.ORDER !== order)
      throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField2(field);
    return field;
  } else {
    return Field2(order, { isLE });
  }
}
function createCurveFields2(type, CURVE, curveOpts = {}, FpFnLE) {
  if (FpFnLE === undefined)
    FpFnLE = type === "edwards";
  if (!CURVE || typeof CURVE !== "object")
    throw new Error(`expected valid ${type} CURVE object`);
  for (const p of ["p", "n", "h"]) {
    const val = CURVE[p];
    if (!(typeof val === "bigint" && val > _0n12))
      throw new Error(`CURVE.${p} must be positive bigint`);
  }
  const Fp = createField2(CURVE.p, curveOpts.Fp, FpFnLE);
  const Fn = createField2(CURVE.n, curveOpts.Fn, FpFnLE);
  const _b = type === "weierstrass" ? "b" : "d";
  const params = ["Gx", "Gy", "a", _b];
  for (const p of params) {
    if (!Fp.isValid(CURVE[p]))
      throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
  }
  CURVE = Object.freeze(Object.assign({}, CURVE));
  return { CURVE, Fp, Fn };
}
function createKeygen2(randomSecretKey, getPublicKey) {
  return function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  };
}

// node_modules/@noble/post-quantum/node_modules/@noble/curves/abstract/montgomery.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n13 = BigInt(0);
var _1n11 = BigInt(1);
var _2n8 = BigInt(2);
function validateOpts2(curve) {
  validateObject2(curve, {
    adjustScalarBytes: "function",
    powPminus2: "function"
  });
  return Object.freeze({ ...curve });
}
function montgomery2(curveDef) {
  const CURVE = validateOpts2(curveDef);
  const { P, type, adjustScalarBytes, powPminus2, randomBytes: rand } = CURVE;
  const is25519 = type === "x25519";
  if (!is25519 && type !== "x448")
    throw new Error("invalid type");
  const randomBytes_ = rand || randomBytes4;
  const montgomeryBits = is25519 ? 255 : 448;
  const fieldLen = is25519 ? 32 : 56;
  const Gu = is25519 ? BigInt(9) : BigInt(5);
  const a24 = is25519 ? BigInt(121665) : BigInt(39081);
  const minScalar = is25519 ? _2n8 ** BigInt(254) : _2n8 ** BigInt(447);
  const maxAdded = is25519 ? BigInt(8) * _2n8 ** BigInt(251) - _1n11 : BigInt(4) * _2n8 ** BigInt(445) - _1n11;
  const maxScalar = minScalar + maxAdded + _1n11;
  const modP = (n) => mod2(n, P);
  const GuBytes = encodeU(Gu);
  function encodeU(u) {
    return numberToBytesLE2(modP(u), fieldLen);
  }
  function decodeU(u) {
    const _u = copyBytes3(abytes5(u, fieldLen, "uCoordinate"));
    if (is25519)
      _u[31] &= 127;
    return modP(bytesToNumberLE2(_u));
  }
  function decodeScalar(scalar) {
    return bytesToNumberLE2(adjustScalarBytes(copyBytes3(abytes5(scalar, fieldLen, "scalar"))));
  }
  function scalarMult(scalar, u) {
    const pu = montgomeryLadder(decodeU(u), decodeScalar(scalar));
    if (pu === _0n13)
      throw new Error("invalid private or public key received");
    return encodeU(pu);
  }
  function scalarMultBase(scalar) {
    return scalarMult(scalar, GuBytes);
  }
  const getPublicKey = scalarMultBase;
  const getSharedSecret = scalarMult;
  function cswap(swap, x_2, x_3) {
    const dummy = modP(swap * (x_2 - x_3));
    x_2 = modP(x_2 - dummy);
    x_3 = modP(x_3 + dummy);
    return { x_2, x_3 };
  }
  function montgomeryLadder(u, scalar) {
    aInRange2("u", u, _0n13, P);
    aInRange2("scalar", scalar, minScalar, maxScalar);
    const k = scalar;
    const x_1 = u;
    let x_2 = _1n11;
    let z_2 = _0n13;
    let x_3 = u;
    let z_3 = _1n11;
    let swap = _0n13;
    for (let t = BigInt(montgomeryBits - 1);t >= _0n13; t--) {
      const k_t = k >> t & _1n11;
      swap ^= k_t;
      ({ x_2, x_3 } = cswap(swap, x_2, x_3));
      ({ x_2: z_2, x_3: z_3 } = cswap(swap, z_2, z_3));
      swap = k_t;
      const A = x_2 + z_2;
      const AA = modP(A * A);
      const B = x_2 - z_2;
      const BB = modP(B * B);
      const E = AA - BB;
      const C = x_3 + z_3;
      const D = x_3 - z_3;
      const DA = modP(D * A);
      const CB = modP(C * B);
      const dacb = DA + CB;
      const da_cb = DA - CB;
      x_3 = modP(dacb * dacb);
      z_3 = modP(x_1 * modP(da_cb * da_cb));
      x_2 = modP(AA * BB);
      z_2 = modP(E * (AA + modP(a24 * E)));
    }
    ({ x_2, x_3 } = cswap(swap, x_2, x_3));
    ({ x_2: z_2, x_3: z_3 } = cswap(swap, z_2, z_3));
    const z2 = powPminus2(z_2);
    return modP(x_2 * z2);
  }
  const lengths = {
    secretKey: fieldLen,
    publicKey: fieldLen,
    seed: fieldLen
  };
  const randomSecretKey = (seed = randomBytes_(fieldLen)) => {
    abytes5(seed, lengths.seed, "seed");
    return seed;
  };
  const utils = { randomSecretKey };
  return Object.freeze({
    keygen: createKeygen2(randomSecretKey, getPublicKey),
    getSharedSecret,
    getPublicKey,
    scalarMult,
    scalarMultBase,
    utils,
    GuBytes: GuBytes.slice(),
    lengths
  });
}

// node_modules/@noble/post-quantum/node_modules/@noble/hashes/hmac.js
class _HMAC2 {
  oHash;
  iHash;
  blockLen;
  outputLen;
  finished = false;
  destroyed = false;
  constructor(hash, key) {
    ahash2(hash);
    abytes5(key, undefined, "key");
    this.iHash = hash.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
    for (let i = 0;i < pad.length; i++)
      pad[i] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash.create();
    for (let i = 0;i < pad.length; i++)
      pad[i] ^= 54 ^ 92;
    this.oHash.update(pad);
    clean3(pad);
  }
  update(buf) {
    aexists3(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    aexists3(this);
    abytes5(out, this.outputLen, "output");
    this.finished = true;
    this.iHash.digestInto(out);
    this.oHash.update(out);
    this.oHash.digestInto(out);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to ||= Object.create(Object.getPrototypeOf(this), {});
    const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
}
var hmac2 = (hash, key, message) => new _HMAC2(hash, key).update(message).digest();
hmac2.create = (hash, key) => new _HMAC2(hash, key);

// node_modules/@noble/post-quantum/node_modules/@noble/curves/abstract/weierstrass.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var divNearest2 = (num, den) => (num + (num >= 0 ? den : -den) / _2n9) / den;
function _splitEndoScalar2(k, basis, n) {
  const [[a1, b1], [a2, b2]] = basis;
  const c1 = divNearest2(b2 * k, n);
  const c2 = divNearest2(-b1 * k, n);
  let k1 = k - c1 * a1 - c2 * a2;
  let k2 = -c1 * b1 - c2 * b2;
  const k1neg = k1 < _0n14;
  const k2neg = k2 < _0n14;
  if (k1neg)
    k1 = -k1;
  if (k2neg)
    k2 = -k2;
  const MAX_NUM = bitMask2(Math.ceil(bitLen2(n) / 2)) + _1n12;
  if (k1 < _0n14 || k1 >= MAX_NUM || k2 < _0n14 || k2 >= MAX_NUM) {
    throw new Error("splitScalar (endomorphism): failed, k=" + k);
  }
  return { k1neg, k1, k2neg, k2 };
}
function validateSigFormat2(format) {
  if (!["compact", "recovered", "der"].includes(format))
    throw new Error('Signature format must be "compact", "recovered", or "der"');
  return format;
}
function validateSigOpts2(opts, def) {
  const optsn = {};
  for (let optName of Object.keys(def)) {
    optsn[optName] = opts[optName] === undefined ? def[optName] : opts[optName];
  }
  abool3(optsn.lowS, "lowS");
  abool3(optsn.prehash, "prehash");
  if (optsn.format !== undefined)
    validateSigFormat2(optsn.format);
  return optsn;
}

class DERErr2 extends Error {
  constructor(m = "") {
    super(m);
  }
}
var DER2 = {
  Err: DERErr2,
  _tlv: {
    encode: (tag, data) => {
      const { Err: E } = DER2;
      if (tag < 0 || tag > 256)
        throw new E("tlv.encode: wrong tag");
      if (data.length & 1)
        throw new E("tlv.encode: unpadded data");
      const dataLen = data.length / 2;
      const len = numberToHexUnpadded2(dataLen);
      if (len.length / 2 & 128)
        throw new E("tlv.encode: long form length too big");
      const lenLen = dataLen > 127 ? numberToHexUnpadded2(len.length / 2 | 128) : "";
      const t = numberToHexUnpadded2(tag);
      return t + lenLen + len + data;
    },
    decode(tag, data) {
      const { Err: E } = DER2;
      let pos = 0;
      if (tag < 0 || tag > 256)
        throw new E("tlv.encode: wrong tag");
      if (data.length < 2 || data[pos++] !== tag)
        throw new E("tlv.decode: wrong tlv");
      const first = data[pos++];
      const isLong = !!(first & 128);
      let length = 0;
      if (!isLong)
        length = first;
      else {
        const lenLen = first & 127;
        if (!lenLen)
          throw new E("tlv.decode(long): indefinite length not supported");
        if (lenLen > 4)
          throw new E("tlv.decode(long): byte length is too big");
        const lengthBytes = data.subarray(pos, pos + lenLen);
        if (lengthBytes.length !== lenLen)
          throw new E("tlv.decode: length bytes not complete");
        if (lengthBytes[0] === 0)
          throw new E("tlv.decode(long): zero leftmost byte");
        for (const b of lengthBytes)
          length = length << 8 | b;
        pos += lenLen;
        if (length < 128)
          throw new E("tlv.decode(long): not minimal encoding");
      }
      const v = data.subarray(pos, pos + length);
      if (v.length !== length)
        throw new E("tlv.decode: wrong value length");
      return { v, l: data.subarray(pos + length) };
    }
  },
  _int: {
    encode(num) {
      const { Err: E } = DER2;
      if (num < _0n14)
        throw new E("integer: negative integers are not allowed");
      let hex = numberToHexUnpadded2(num);
      if (Number.parseInt(hex[0], 16) & 8)
        hex = "00" + hex;
      if (hex.length & 1)
        throw new E("unexpected DER parsing assertion: unpadded hex");
      return hex;
    },
    decode(data) {
      const { Err: E } = DER2;
      if (data[0] & 128)
        throw new E("invalid signature integer: negative");
      if (data[0] === 0 && !(data[1] & 128))
        throw new E("invalid signature integer: unnecessary leading zero");
      return bytesToNumberBE2(data);
    }
  },
  toSig(bytes) {
    const { Err: E, _int: int, _tlv: tlv } = DER2;
    const data = abytes5(bytes, undefined, "signature");
    const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
    if (seqLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
    const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
    if (sLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    return { r: int.decode(rBytes), s: int.decode(sBytes) };
  },
  hexFromSig(sig) {
    const { _tlv: tlv, _int: int } = DER2;
    const rs = tlv.encode(2, int.encode(sig.r));
    const ss = tlv.encode(2, int.encode(sig.s));
    const seq = rs + ss;
    return tlv.encode(48, seq);
  }
};
var _0n14 = BigInt(0);
var _1n12 = BigInt(1);
var _2n9 = BigInt(2);
var _3n5 = BigInt(3);
var _4n6 = BigInt(4);
function weierstrass2(params, extraOpts = {}) {
  const validated = createCurveFields2("weierstrass", params, extraOpts);
  const { Fp, Fn } = validated;
  let CURVE = validated.CURVE;
  const { h: cofactor, n: CURVE_ORDER } = CURVE;
  validateObject2(extraOpts, {}, {
    allowInfinityPoint: "boolean",
    clearCofactor: "function",
    isTorsionFree: "function",
    fromBytes: "function",
    toBytes: "function",
    endo: "object"
  });
  const { endo } = extraOpts;
  if (endo) {
    if (!Fp.is0(CURVE.a) || typeof endo.beta !== "bigint" || !Array.isArray(endo.basises)) {
      throw new Error('invalid endo: expected "beta": bigint and "basises": array');
    }
  }
  const lengths = getWLengths2(Fp, Fn);
  function assertCompressionIsSupported() {
    if (!Fp.isOdd)
      throw new Error("compression is not supported: Field does not have .isOdd()");
  }
  function pointToBytes(_c, point, isCompressed) {
    const { x, y } = point.toAffine();
    const bx = Fp.toBytes(x);
    abool3(isCompressed, "isCompressed");
    if (isCompressed) {
      assertCompressionIsSupported();
      const hasEvenY = !Fp.isOdd(y);
      return concatBytes3(pprefix2(hasEvenY), bx);
    } else {
      return concatBytes3(Uint8Array.of(4), bx, Fp.toBytes(y));
    }
  }
  function pointFromBytes(bytes) {
    abytes5(bytes, undefined, "Point");
    const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
    const length = bytes.length;
    const head = bytes[0];
    const tail = bytes.subarray(1);
    if (length === comp && (head === 2 || head === 3)) {
      const x = Fp.fromBytes(tail);
      if (!Fp.isValid(x))
        throw new Error("bad point: is not on curve, wrong x");
      const y2 = weierstrassEquation(x);
      let y;
      try {
        y = Fp.sqrt(y2);
      } catch (sqrtError) {
        const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
        throw new Error("bad point: is not on curve, sqrt error" + err);
      }
      assertCompressionIsSupported();
      const evenY = Fp.isOdd(y);
      const evenH = (head & 1) === 1;
      if (evenH !== evenY)
        y = Fp.neg(y);
      return { x, y };
    } else if (length === uncomp && head === 4) {
      const L = Fp.BYTES;
      const x = Fp.fromBytes(tail.subarray(0, L));
      const y = Fp.fromBytes(tail.subarray(L, L * 2));
      if (!isValidXY(x, y))
        throw new Error("bad point: is not on curve");
      return { x, y };
    } else {
      throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
    }
  }
  const encodePoint = extraOpts.toBytes || pointToBytes;
  const decodePoint = extraOpts.fromBytes || pointFromBytes;
  function weierstrassEquation(x) {
    const x2 = Fp.sqr(x);
    const x3 = Fp.mul(x2, x);
    return Fp.add(Fp.add(x3, Fp.mul(x, CURVE.a)), CURVE.b);
  }
  function isValidXY(x, y) {
    const left = Fp.sqr(y);
    const right = weierstrassEquation(x);
    return Fp.eql(left, right);
  }
  if (!isValidXY(CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n5), _4n6);
  const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
  if (Fp.is0(Fp.add(_4a3, _27b2)))
    throw new Error("bad curve params: a or b");
  function acoord(title, n, banZero = false) {
    if (!Fp.isValid(n) || banZero && Fp.is0(n))
      throw new Error(`bad point coordinate ${title}`);
    return n;
  }
  function aprjpoint(other) {
    if (!(other instanceof Point))
      throw new Error("Weierstrass Point expected");
  }
  function splitEndoScalarN(k) {
    if (!endo || !endo.basises)
      throw new Error("no endo");
    return _splitEndoScalar2(k, endo.basises, Fn.ORDER);
  }
  const toAffineMemo = memoized((p, iz) => {
    const { X, Y, Z } = p;
    if (Fp.eql(Z, Fp.ONE))
      return { x: X, y: Y };
    const is0 = p.is0();
    if (iz == null)
      iz = is0 ? Fp.ONE : Fp.inv(Z);
    const x = Fp.mul(X, iz);
    const y = Fp.mul(Y, iz);
    const zz = Fp.mul(Z, iz);
    if (is0)
      return { x: Fp.ZERO, y: Fp.ZERO };
    if (!Fp.eql(zz, Fp.ONE))
      throw new Error("invZ was invalid");
    return { x, y };
  });
  const assertValidMemo = memoized((p) => {
    if (p.is0()) {
      if (extraOpts.allowInfinityPoint && !Fp.is0(p.Y))
        return;
      throw new Error("bad point: ZERO");
    }
    const { x, y } = p.toAffine();
    if (!Fp.isValid(x) || !Fp.isValid(y))
      throw new Error("bad point: x or y not field elements");
    if (!isValidXY(x, y))
      throw new Error("bad point: equation left != right");
    if (!p.isTorsionFree())
      throw new Error("bad point: not in prime-order subgroup");
    return true;
  });
  function finishEndo(endoBeta, k1p, k2p, k1neg, k2neg) {
    k2p = new Point(Fp.mul(k2p.X, endoBeta), k2p.Y, k2p.Z);
    k1p = negateCt(k1neg, k1p);
    k2p = negateCt(k2neg, k2p);
    return k1p.add(k2p);
  }

  class Point {
    static BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE);
    static ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ZERO);
    static Fp = Fp;
    static Fn = Fn;
    X;
    Y;
    Z;
    constructor(X, Y, Z) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y, true);
      this.Z = acoord("z", Z);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp.isValid(x) || !Fp.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof Point)
        throw new Error("projective point not allowed");
      if (Fp.is0(x) && Fp.is0(y))
        return Point.ZERO;
      return new Point(x, y, Fp.ONE);
    }
    static fromBytes(bytes) {
      const P = Point.fromAffine(decodePoint(abytes5(bytes, undefined, "point")));
      P.assertValidity();
      return P;
    }
    static fromHex(hex) {
      return Point.fromBytes(hexToBytes3(hex));
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    precompute(windowSize = 8, isLazy = true) {
      wnaf.createCache(this, windowSize);
      if (!isLazy)
        this.multiply(_3n5);
      return this;
    }
    assertValidity() {
      assertValidMemo(this);
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (!Fp.isOdd)
        throw new Error("Field doesn't support isOdd");
      return !Fp.isOdd(y);
    }
    equals(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
      const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
      return U1 && U2;
    }
    negate() {
      return new Point(this.X, Fp.neg(this.Y), this.Z);
    }
    double() {
      const { a, b } = CURVE;
      const b3 = Fp.mul(b, _3n5);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      let { ZERO: X3, ZERO: Y3, ZERO: Z3 } = Fp;
      let t0 = Fp.mul(X1, X1);
      let t1 = Fp.mul(Y1, Y1);
      let t2 = Fp.mul(Z1, Z1);
      let t3 = Fp.mul(X1, Y1);
      t3 = Fp.add(t3, t3);
      Z3 = Fp.mul(X1, Z1);
      Z3 = Fp.add(Z3, Z3);
      X3 = Fp.mul(a, Z3);
      Y3 = Fp.mul(b3, t2);
      Y3 = Fp.add(X3, Y3);
      X3 = Fp.sub(t1, Y3);
      Y3 = Fp.add(t1, Y3);
      Y3 = Fp.mul(X3, Y3);
      X3 = Fp.mul(t3, X3);
      Z3 = Fp.mul(b3, Z3);
      t2 = Fp.mul(a, t2);
      t3 = Fp.sub(t0, t2);
      t3 = Fp.mul(a, t3);
      t3 = Fp.add(t3, Z3);
      Z3 = Fp.add(t0, t0);
      t0 = Fp.add(Z3, t0);
      t0 = Fp.add(t0, t2);
      t0 = Fp.mul(t0, t3);
      Y3 = Fp.add(Y3, t0);
      t2 = Fp.mul(Y1, Z1);
      t2 = Fp.add(t2, t2);
      t0 = Fp.mul(t2, t3);
      X3 = Fp.sub(X3, t0);
      Z3 = Fp.mul(t2, t1);
      Z3 = Fp.add(Z3, Z3);
      Z3 = Fp.add(Z3, Z3);
      return new Point(X3, Y3, Z3);
    }
    add(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      let { ZERO: X3, ZERO: Y3, ZERO: Z3 } = Fp;
      const a = CURVE.a;
      const b3 = Fp.mul(CURVE.b, _3n5);
      let t0 = Fp.mul(X1, X2);
      let t1 = Fp.mul(Y1, Y2);
      let t2 = Fp.mul(Z1, Z2);
      let t3 = Fp.add(X1, Y1);
      let t4 = Fp.add(X2, Y2);
      t3 = Fp.mul(t3, t4);
      t4 = Fp.add(t0, t1);
      t3 = Fp.sub(t3, t4);
      t4 = Fp.add(X1, Z1);
      let t5 = Fp.add(X2, Z2);
      t4 = Fp.mul(t4, t5);
      t5 = Fp.add(t0, t2);
      t4 = Fp.sub(t4, t5);
      t5 = Fp.add(Y1, Z1);
      X3 = Fp.add(Y2, Z2);
      t5 = Fp.mul(t5, X3);
      X3 = Fp.add(t1, t2);
      t5 = Fp.sub(t5, X3);
      Z3 = Fp.mul(a, t4);
      X3 = Fp.mul(b3, t2);
      Z3 = Fp.add(X3, Z3);
      X3 = Fp.sub(t1, Z3);
      Z3 = Fp.add(t1, Z3);
      Y3 = Fp.mul(X3, Z3);
      t1 = Fp.add(t0, t0);
      t1 = Fp.add(t1, t0);
      t2 = Fp.mul(a, t2);
      t4 = Fp.mul(b3, t4);
      t1 = Fp.add(t1, t2);
      t2 = Fp.sub(t0, t2);
      t2 = Fp.mul(a, t2);
      t4 = Fp.add(t4, t2);
      t0 = Fp.mul(t1, t4);
      Y3 = Fp.add(Y3, t0);
      t0 = Fp.mul(t5, t4);
      X3 = Fp.mul(t3, X3);
      X3 = Fp.sub(X3, t0);
      t0 = Fp.mul(t3, t1);
      Z3 = Fp.mul(t5, Z3);
      Z3 = Fp.add(Z3, t0);
      return new Point(X3, Y3, Z3);
    }
    subtract(other) {
      return this.add(other.negate());
    }
    is0() {
      return this.equals(Point.ZERO);
    }
    multiply(scalar) {
      const { endo } = extraOpts;
      if (!Fn.isValidNot0(scalar))
        throw new Error("invalid scalar: out of range");
      let point, fake;
      const mul = (n) => wnaf.cached(this, n, (p) => normalizeZ2(Point, p));
      if (endo) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(scalar);
        const { p: k1p, f: k1f } = mul(k1);
        const { p: k2p, f: k2f } = mul(k2);
        fake = k1f.add(k2f);
        point = finishEndo(endo.beta, k1p, k2p, k1neg, k2neg);
      } else {
        const { p, f } = mul(scalar);
        point = p;
        fake = f;
      }
      return normalizeZ2(Point, [point, fake])[0];
    }
    multiplyUnsafe(sc) {
      const { endo } = extraOpts;
      const p = this;
      if (!Fn.isValid(sc))
        throw new Error("invalid scalar: out of range");
      if (sc === _0n14 || p.is0())
        return Point.ZERO;
      if (sc === _1n12)
        return p;
      if (wnaf.hasCache(this))
        return this.multiply(sc);
      if (endo) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(sc);
        const { p1, p2 } = mulEndoUnsafe(Point, p, k1, k2);
        return finishEndo(endo.beta, p1, p2, k1neg, k2neg);
      } else {
        return wnaf.unsafe(p, sc);
      }
    }
    toAffine(invertedZ) {
      return toAffineMemo(this, invertedZ);
    }
    isTorsionFree() {
      const { isTorsionFree } = extraOpts;
      if (cofactor === _1n12)
        return true;
      if (isTorsionFree)
        return isTorsionFree(Point, this);
      return wnaf.unsafe(this, CURVE_ORDER).is0();
    }
    clearCofactor() {
      const { clearCofactor } = extraOpts;
      if (cofactor === _1n12)
        return this;
      if (clearCofactor)
        return clearCofactor(Point, this);
      return this.multiplyUnsafe(cofactor);
    }
    isSmallOrder() {
      return this.multiplyUnsafe(cofactor).is0();
    }
    toBytes(isCompressed = true) {
      abool3(isCompressed, "isCompressed");
      this.assertValidity();
      return encodePoint(Point, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex3(this.toBytes(isCompressed));
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
  }
  const bits = Fn.BITS;
  const wnaf = new wNAF(Point, extraOpts.endo ? Math.ceil(bits / 2) : bits);
  Point.BASE.precompute(8);
  return Point;
}
function pprefix2(hasEvenY) {
  return Uint8Array.of(hasEvenY ? 2 : 3);
}
function getWLengths2(Fp, Fn) {
  return {
    secretKey: Fn.BYTES,
    publicKey: 1 + Fp.BYTES,
    publicKeyUncompressed: 1 + 2 * Fp.BYTES,
    publicKeyHasPrefix: true,
    signature: 2 * Fn.BYTES
  };
}
function ecdh2(Point, ecdhOpts = {}) {
  const { Fn } = Point;
  const randomBytes_ = ecdhOpts.randomBytes || randomBytes4;
  const lengths = Object.assign(getWLengths2(Point.Fp, Fn), { seed: getMinHashLength2(Fn.ORDER) });
  function isValidSecretKey(secretKey) {
    try {
      const num = Fn.fromBytes(secretKey);
      return Fn.isValidNot0(num);
    } catch (error) {
      return false;
    }
  }
  function isValidPublicKey(publicKey, isCompressed) {
    const { publicKey: comp, publicKeyUncompressed } = lengths;
    try {
      const l = publicKey.length;
      if (isCompressed === true && l !== comp)
        return false;
      if (isCompressed === false && l !== publicKeyUncompressed)
        return false;
      return !!Point.fromBytes(publicKey);
    } catch (error) {
      return false;
    }
  }
  function randomSecretKey(seed = randomBytes_(lengths.seed)) {
    return mapHashToField2(abytes5(seed, lengths.seed, "seed"), Fn.ORDER);
  }
  function getPublicKey(secretKey, isCompressed = true) {
    return Point.BASE.multiply(Fn.fromBytes(secretKey)).toBytes(isCompressed);
  }
  function isProbPub(item) {
    const { secretKey, publicKey, publicKeyUncompressed } = lengths;
    if (!isBytes5(item))
      return;
    if ("_lengths" in Fn && Fn._lengths || secretKey === publicKey)
      return;
    const l = abytes5(item, undefined, "key").length;
    return l === publicKey || l === publicKeyUncompressed;
  }
  function getSharedSecret(secretKeyA, publicKeyB, isCompressed = true) {
    if (isProbPub(secretKeyA) === true)
      throw new Error("first arg must be private key");
    if (isProbPub(publicKeyB) === false)
      throw new Error("second arg must be public key");
    const s = Fn.fromBytes(secretKeyA);
    const b = Point.fromBytes(publicKeyB);
    return b.multiply(s).toBytes(isCompressed);
  }
  const utils = {
    isValidSecretKey,
    isValidPublicKey,
    randomSecretKey
  };
  const keygen = createKeygen2(randomSecretKey, getPublicKey);
  return Object.freeze({ getPublicKey, getSharedSecret, keygen, Point, utils, lengths });
}
function ecdsa2(Point, hash, ecdsaOpts = {}) {
  ahash2(hash);
  validateObject2(ecdsaOpts, {}, {
    hmac: "function",
    lowS: "boolean",
    randomBytes: "function",
    bits2int: "function",
    bits2int_modN: "function"
  });
  ecdsaOpts = Object.assign({}, ecdsaOpts);
  const randomBytes = ecdsaOpts.randomBytes || randomBytes4;
  const hmac = ecdsaOpts.hmac || ((key, msg) => hmac2(hash, key, msg));
  const { Fp, Fn } = Point;
  const { ORDER: CURVE_ORDER, BITS: fnBits } = Fn;
  const { keygen, getPublicKey, getSharedSecret, utils, lengths } = ecdh2(Point, ecdsaOpts);
  const defaultSigOpts = {
    prehash: true,
    lowS: typeof ecdsaOpts.lowS === "boolean" ? ecdsaOpts.lowS : true,
    format: "compact",
    extraEntropy: false
  };
  const hasLargeCofactor = CURVE_ORDER * _2n9 < Fp.ORDER;
  function isBiggerThanHalfOrder(number) {
    const HALF = CURVE_ORDER >> _1n12;
    return number > HALF;
  }
  function validateRS(title, num) {
    if (!Fn.isValidNot0(num))
      throw new Error(`invalid signature ${title}: out of range 1..Point.Fn.ORDER`);
    return num;
  }
  function assertSmallCofactor() {
    if (hasLargeCofactor)
      throw new Error('"recovered" sig type is not supported for cofactor >2 curves');
  }
  function validateSigLength(bytes, format) {
    validateSigFormat2(format);
    const size = lengths.signature;
    const sizer = format === "compact" ? size : format === "recovered" ? size + 1 : undefined;
    return abytes5(bytes, sizer);
  }

  class Signature {
    r;
    s;
    recovery;
    constructor(r, s, recovery) {
      this.r = validateRS("r", r);
      this.s = validateRS("s", s);
      if (recovery != null) {
        assertSmallCofactor();
        if (![0, 1, 2, 3].includes(recovery))
          throw new Error("invalid recovery id");
        this.recovery = recovery;
      }
      Object.freeze(this);
    }
    static fromBytes(bytes, format = defaultSigOpts.format) {
      validateSigLength(bytes, format);
      let recid;
      if (format === "der") {
        const { r, s } = DER2.toSig(abytes5(bytes));
        return new Signature(r, s);
      }
      if (format === "recovered") {
        recid = bytes[0];
        format = "compact";
        bytes = bytes.subarray(1);
      }
      const L = lengths.signature / 2;
      const r = bytes.subarray(0, L);
      const s = bytes.subarray(L, L * 2);
      return new Signature(Fn.fromBytes(r), Fn.fromBytes(s), recid);
    }
    static fromHex(hex, format) {
      return this.fromBytes(hexToBytes3(hex), format);
    }
    assertRecovery() {
      const { recovery } = this;
      if (recovery == null)
        throw new Error("invalid recovery id: must be present");
      return recovery;
    }
    addRecoveryBit(recovery) {
      return new Signature(this.r, this.s, recovery);
    }
    recoverPublicKey(messageHash) {
      const { r, s } = this;
      const recovery = this.assertRecovery();
      const radj = recovery === 2 || recovery === 3 ? r + CURVE_ORDER : r;
      if (!Fp.isValid(radj))
        throw new Error("invalid recovery id: sig.r+curve.n != R.x");
      const x = Fp.toBytes(radj);
      const R = Point.fromBytes(concatBytes3(pprefix2((recovery & 1) === 0), x));
      const ir = Fn.inv(radj);
      const h = bits2int_modN(abytes5(messageHash, undefined, "msgHash"));
      const u1 = Fn.create(-h * ir);
      const u2 = Fn.create(s * ir);
      const Q = Point.BASE.multiplyUnsafe(u1).add(R.multiplyUnsafe(u2));
      if (Q.is0())
        throw new Error("invalid recovery: point at infinify");
      Q.assertValidity();
      return Q;
    }
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    toBytes(format = defaultSigOpts.format) {
      validateSigFormat2(format);
      if (format === "der")
        return hexToBytes3(DER2.hexFromSig(this));
      const { r, s } = this;
      const rb = Fn.toBytes(r);
      const sb = Fn.toBytes(s);
      if (format === "recovered") {
        assertSmallCofactor();
        return concatBytes3(Uint8Array.of(this.assertRecovery()), rb, sb);
      }
      return concatBytes3(rb, sb);
    }
    toHex(format) {
      return bytesToHex3(this.toBytes(format));
    }
  }
  const bits2int = ecdsaOpts.bits2int || function bits2int_def(bytes) {
    if (bytes.length > 8192)
      throw new Error("input is too large");
    const num = bytesToNumberBE2(bytes);
    const delta = bytes.length * 8 - fnBits;
    return delta > 0 ? num >> BigInt(delta) : num;
  };
  const bits2int_modN = ecdsaOpts.bits2int_modN || function bits2int_modN_def(bytes) {
    return Fn.create(bits2int(bytes));
  };
  const ORDER_MASK = bitMask2(fnBits);
  function int2octets(num) {
    aInRange2("num < 2^" + fnBits, num, _0n14, ORDER_MASK);
    return Fn.toBytes(num);
  }
  function validateMsgAndHash(message, prehash) {
    abytes5(message, undefined, "message");
    return prehash ? abytes5(hash(message), undefined, "prehashed message") : message;
  }
  function prepSig(message, secretKey, opts) {
    const { lowS, prehash, extraEntropy } = validateSigOpts2(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    const h1int = bits2int_modN(message);
    const d = Fn.fromBytes(secretKey);
    if (!Fn.isValidNot0(d))
      throw new Error("invalid private key");
    const seedArgs = [int2octets(d), int2octets(h1int)];
    if (extraEntropy != null && extraEntropy !== false) {
      const e = extraEntropy === true ? randomBytes(lengths.secretKey) : extraEntropy;
      seedArgs.push(abytes5(e, undefined, "extraEntropy"));
    }
    const seed = concatBytes3(...seedArgs);
    const m = h1int;
    function k2sig(kBytes) {
      const k = bits2int(kBytes);
      if (!Fn.isValidNot0(k))
        return;
      const ik = Fn.inv(k);
      const q = Point.BASE.multiply(k).toAffine();
      const r = Fn.create(q.x);
      if (r === _0n14)
        return;
      const s = Fn.create(ik * Fn.create(m + r * d));
      if (s === _0n14)
        return;
      let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n12);
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = Fn.neg(s);
        recovery ^= 1;
      }
      return new Signature(r, normS, hasLargeCofactor ? undefined : recovery);
    }
    return { seed, k2sig };
  }
  function sign(message, secretKey, opts = {}) {
    const { seed, k2sig } = prepSig(message, secretKey, opts);
    const drbg = createHmacDrbg2(hash.outputLen, Fn.BYTES, hmac);
    const sig = drbg(seed, k2sig);
    return sig.toBytes(opts.format);
  }
  function verify(signature, message, publicKey, opts = {}) {
    const { lowS, prehash, format } = validateSigOpts2(opts, defaultSigOpts);
    publicKey = abytes5(publicKey, undefined, "publicKey");
    message = validateMsgAndHash(message, prehash);
    if (!isBytes5(signature)) {
      const end = signature instanceof Signature ? ", use sig.toBytes()" : "";
      throw new Error("verify expects Uint8Array signature" + end);
    }
    validateSigLength(signature, format);
    try {
      const sig = Signature.fromBytes(signature, format);
      const P = Point.fromBytes(publicKey);
      if (lowS && sig.hasHighS())
        return false;
      const { r, s } = sig;
      const h = bits2int_modN(message);
      const is = Fn.inv(s);
      const u1 = Fn.create(h * is);
      const u2 = Fn.create(r * is);
      const R = Point.BASE.multiplyUnsafe(u1).add(P.multiplyUnsafe(u2));
      if (R.is0())
        return false;
      const v = Fn.create(R.x);
      return v === r;
    } catch (e) {
      return false;
    }
  }
  function recoverPublicKey(signature, message, opts = {}) {
    const { prehash } = validateSigOpts2(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    return Signature.fromBytes(signature, "recovered").recoverPublicKey(message).toBytes();
  }
  return Object.freeze({
    keygen,
    getPublicKey,
    getSharedSecret,
    utils,
    lengths,
    Point,
    sign,
    verify,
    recoverPublicKey,
    Signature,
    hash
  });
}

// node_modules/@noble/post-quantum/node_modules/@noble/hashes/_md.js
function Chi2(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj2(a, b, c) {
  return a & b ^ a & c ^ b & c;
}

class HashMD2 {
  blockLen;
  outputLen;
  padOffset;
  isLE;
  buffer;
  view;
  finished = false;
  length = 0;
  pos = 0;
  destroyed = false;
  constructor(blockLen, outputLen, padOffset, isLE) {
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView3(this.buffer);
  }
  update(data) {
    aexists3(this);
    abytes5(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0;pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView3(data);
        for (;blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists3(this);
    aoutput3(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean3(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos;i < blockLen; i++)
      buffer[i] = 0;
    view.setBigUint64(blockLen - 8, BigInt(this.length * 8), isLE);
    this.process(view, 0);
    const oview = createView3(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen must be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0;i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to ||= new this.constructor;
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
}
var SHA256_IV2 = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
var SHA384_IV2 = /* @__PURE__ */ Uint32Array.from([
  3418070365,
  3238371032,
  1654270250,
  914150663,
  2438529370,
  812702999,
  355462360,
  4144912697,
  1731405415,
  4290775857,
  2394180231,
  1750603025,
  3675008525,
  1694076839,
  1203062813,
  3204075428
]);

// node_modules/@noble/post-quantum/node_modules/@noble/hashes/_u64.js
var U32_MASK642 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
var _32n2 = /* @__PURE__ */ BigInt(32);
function fromBig2(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK642), l: Number(n >> _32n2 & U32_MASK642) };
  return { h: Number(n >> _32n2 & U32_MASK642) | 0, l: Number(n & U32_MASK642) | 0 };
}
function split2(lst, le = false) {
  const len = lst.length;
  let Ah = new Uint32Array(len);
  let Al = new Uint32Array(len);
  for (let i = 0;i < len; i++) {
    const { h, l } = fromBig2(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var shrSH2 = (h, _l, s) => h >>> s;
var shrSL2 = (h, l, s) => h << 32 - s | l >>> s;
var rotrSH2 = (h, l, s) => h >>> s | l << 32 - s;
var rotrSL2 = (h, l, s) => h << 32 - s | l >>> s;
var rotrBH2 = (h, l, s) => h << 64 - s | l >>> s - 32;
var rotrBL2 = (h, l, s) => h >>> s - 32 | l << 64 - s;
var rotlSH = (h, l, s) => h << s | l >>> 32 - s;
var rotlSL = (h, l, s) => l << s | h >>> 32 - s;
var rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
var rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;
function add2(Ah, Al, Bh, Bl) {
  const l = (Al >>> 0) + (Bl >>> 0);
  return { h: Ah + Bh + (l / 2 ** 32 | 0) | 0, l: l | 0 };
}
var add3L2 = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
var add3H2 = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0;
var add4L2 = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
var add4H2 = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0;
var add5L2 = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
var add5H2 = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;

// node_modules/@noble/post-quantum/node_modules/@noble/hashes/sha2.js
var SHA256_K2 = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W2 = /* @__PURE__ */ new Uint32Array(64);

class SHA2_32B2 extends HashMD2 {
  constructor(outputLen) {
    super(64, outputLen, 8, false);
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0;i < 16; i++, offset += 4)
      SHA256_W2[i] = view.getUint32(offset, false);
    for (let i = 16;i < 64; i++) {
      const W15 = SHA256_W2[i - 15];
      const W2 = SHA256_W2[i - 2];
      const s0 = rotr2(W15, 7) ^ rotr2(W15, 18) ^ W15 >>> 3;
      const s1 = rotr2(W2, 17) ^ rotr2(W2, 19) ^ W2 >>> 10;
      SHA256_W2[i] = s1 + SHA256_W2[i - 7] + s0 + SHA256_W2[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0;i < 64; i++) {
      const sigma1 = rotr2(E, 6) ^ rotr2(E, 11) ^ rotr2(E, 25);
      const T1 = H + sigma1 + Chi2(E, F, G) + SHA256_K2[i] + SHA256_W2[i] | 0;
      const sigma0 = rotr2(A, 2) ^ rotr2(A, 13) ^ rotr2(A, 22);
      const T2 = sigma0 + Maj2(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean3(SHA256_W2);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean3(this.buffer);
  }
}

class _SHA2562 extends SHA2_32B2 {
  A = SHA256_IV2[0] | 0;
  B = SHA256_IV2[1] | 0;
  C = SHA256_IV2[2] | 0;
  D = SHA256_IV2[3] | 0;
  E = SHA256_IV2[4] | 0;
  F = SHA256_IV2[5] | 0;
  G = SHA256_IV2[6] | 0;
  H = SHA256_IV2[7] | 0;
  constructor() {
    super(32);
  }
}
var K5122 = /* @__PURE__ */ (() => split2([
  "0x428a2f98d728ae22",
  "0x7137449123ef65cd",
  "0xb5c0fbcfec4d3b2f",
  "0xe9b5dba58189dbbc",
  "0x3956c25bf348b538",
  "0x59f111f1b605d019",
  "0x923f82a4af194f9b",
  "0xab1c5ed5da6d8118",
  "0xd807aa98a3030242",
  "0x12835b0145706fbe",
  "0x243185be4ee4b28c",
  "0x550c7dc3d5ffb4e2",
  "0x72be5d74f27b896f",
  "0x80deb1fe3b1696b1",
  "0x9bdc06a725c71235",
  "0xc19bf174cf692694",
  "0xe49b69c19ef14ad2",
  "0xefbe4786384f25e3",
  "0x0fc19dc68b8cd5b5",
  "0x240ca1cc77ac9c65",
  "0x2de92c6f592b0275",
  "0x4a7484aa6ea6e483",
  "0x5cb0a9dcbd41fbd4",
  "0x76f988da831153b5",
  "0x983e5152ee66dfab",
  "0xa831c66d2db43210",
  "0xb00327c898fb213f",
  "0xbf597fc7beef0ee4",
  "0xc6e00bf33da88fc2",
  "0xd5a79147930aa725",
  "0x06ca6351e003826f",
  "0x142929670a0e6e70",
  "0x27b70a8546d22ffc",
  "0x2e1b21385c26c926",
  "0x4d2c6dfc5ac42aed",
  "0x53380d139d95b3df",
  "0x650a73548baf63de",
  "0x766a0abb3c77b2a8",
  "0x81c2c92e47edaee6",
  "0x92722c851482353b",
  "0xa2bfe8a14cf10364",
  "0xa81a664bbc423001",
  "0xc24b8b70d0f89791",
  "0xc76c51a30654be30",
  "0xd192e819d6ef5218",
  "0xd69906245565a910",
  "0xf40e35855771202a",
  "0x106aa07032bbd1b8",
  "0x19a4c116b8d2d0c8",
  "0x1e376c085141ab53",
  "0x2748774cdf8eeb99",
  "0x34b0bcb5e19b48a8",
  "0x391c0cb3c5c95a63",
  "0x4ed8aa4ae3418acb",
  "0x5b9cca4f7763e373",
  "0x682e6ff3d6b2b8a3",
  "0x748f82ee5defb2fc",
  "0x78a5636f43172f60",
  "0x84c87814a1f0ab72",
  "0x8cc702081a6439ec",
  "0x90befffa23631e28",
  "0xa4506cebde82bde9",
  "0xbef9a3f7b2c67915",
  "0xc67178f2e372532b",
  "0xca273eceea26619c",
  "0xd186b8c721c0c207",
  "0xeada7dd6cde0eb1e",
  "0xf57d4f7fee6ed178",
  "0x06f067aa72176fba",
  "0x0a637dc5a2c898a6",
  "0x113f9804bef90dae",
  "0x1b710b35131c471b",
  "0x28db77f523047d84",
  "0x32caab7b40c72493",
  "0x3c9ebe0a15c9bebc",
  "0x431d67c49c100d4c",
  "0x4cc5d4becb3e42b6",
  "0x597f299cfc657e2a",
  "0x5fcb6fab3ad6faec",
  "0x6c44198c4a475817"
].map((n) => BigInt(n))))();
var SHA512_Kh2 = /* @__PURE__ */ (() => K5122[0])();
var SHA512_Kl2 = /* @__PURE__ */ (() => K5122[1])();
var SHA512_W_H2 = /* @__PURE__ */ new Uint32Array(80);
var SHA512_W_L2 = /* @__PURE__ */ new Uint32Array(80);

class SHA2_64B2 extends HashMD2 {
  constructor(outputLen) {
    super(128, outputLen, 16, false);
  }
  get() {
    const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
  }
  set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
    this.Ah = Ah | 0;
    this.Al = Al | 0;
    this.Bh = Bh | 0;
    this.Bl = Bl | 0;
    this.Ch = Ch | 0;
    this.Cl = Cl | 0;
    this.Dh = Dh | 0;
    this.Dl = Dl | 0;
    this.Eh = Eh | 0;
    this.El = El | 0;
    this.Fh = Fh | 0;
    this.Fl = Fl | 0;
    this.Gh = Gh | 0;
    this.Gl = Gl | 0;
    this.Hh = Hh | 0;
    this.Hl = Hl | 0;
  }
  process(view, offset) {
    for (let i = 0;i < 16; i++, offset += 4) {
      SHA512_W_H2[i] = view.getUint32(offset);
      SHA512_W_L2[i] = view.getUint32(offset += 4);
    }
    for (let i = 16;i < 80; i++) {
      const W15h = SHA512_W_H2[i - 15] | 0;
      const W15l = SHA512_W_L2[i - 15] | 0;
      const s0h = rotrSH2(W15h, W15l, 1) ^ rotrSH2(W15h, W15l, 8) ^ shrSH2(W15h, W15l, 7);
      const s0l = rotrSL2(W15h, W15l, 1) ^ rotrSL2(W15h, W15l, 8) ^ shrSL2(W15h, W15l, 7);
      const W2h = SHA512_W_H2[i - 2] | 0;
      const W2l = SHA512_W_L2[i - 2] | 0;
      const s1h = rotrSH2(W2h, W2l, 19) ^ rotrBH2(W2h, W2l, 61) ^ shrSH2(W2h, W2l, 6);
      const s1l = rotrSL2(W2h, W2l, 19) ^ rotrBL2(W2h, W2l, 61) ^ shrSL2(W2h, W2l, 6);
      const SUMl = add4L2(s0l, s1l, SHA512_W_L2[i - 7], SHA512_W_L2[i - 16]);
      const SUMh = add4H2(SUMl, s0h, s1h, SHA512_W_H2[i - 7], SHA512_W_H2[i - 16]);
      SHA512_W_H2[i] = SUMh | 0;
      SHA512_W_L2[i] = SUMl | 0;
    }
    let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    for (let i = 0;i < 80; i++) {
      const sigma1h = rotrSH2(Eh, El, 14) ^ rotrSH2(Eh, El, 18) ^ rotrBH2(Eh, El, 41);
      const sigma1l = rotrSL2(Eh, El, 14) ^ rotrSL2(Eh, El, 18) ^ rotrBL2(Eh, El, 41);
      const CHIh = Eh & Fh ^ ~Eh & Gh;
      const CHIl = El & Fl ^ ~El & Gl;
      const T1ll = add5L2(Hl, sigma1l, CHIl, SHA512_Kl2[i], SHA512_W_L2[i]);
      const T1h = add5H2(T1ll, Hh, sigma1h, CHIh, SHA512_Kh2[i], SHA512_W_H2[i]);
      const T1l = T1ll | 0;
      const sigma0h = rotrSH2(Ah, Al, 28) ^ rotrBH2(Ah, Al, 34) ^ rotrBH2(Ah, Al, 39);
      const sigma0l = rotrSL2(Ah, Al, 28) ^ rotrBL2(Ah, Al, 34) ^ rotrBL2(Ah, Al, 39);
      const MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
      const MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
      Hh = Gh | 0;
      Hl = Gl | 0;
      Gh = Fh | 0;
      Gl = Fl | 0;
      Fh = Eh | 0;
      Fl = El | 0;
      ({ h: Eh, l: El } = add2(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
      Dh = Ch | 0;
      Dl = Cl | 0;
      Ch = Bh | 0;
      Cl = Bl | 0;
      Bh = Ah | 0;
      Bl = Al | 0;
      const All = add3L2(T1l, sigma0l, MAJl);
      Ah = add3H2(All, T1h, sigma0h, MAJh);
      Al = All | 0;
    }
    ({ h: Ah, l: Al } = add2(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
    ({ h: Bh, l: Bl } = add2(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
    ({ h: Ch, l: Cl } = add2(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
    ({ h: Dh, l: Dl } = add2(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
    ({ h: Eh, l: El } = add2(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
    ({ h: Fh, l: Fl } = add2(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
    ({ h: Gh, l: Gl } = add2(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
    ({ h: Hh, l: Hl } = add2(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
    this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
  }
  roundClean() {
    clean3(SHA512_W_H2, SHA512_W_L2);
  }
  destroy() {
    clean3(this.buffer);
    this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
}
class _SHA384 extends SHA2_64B2 {
  Ah = SHA384_IV2[0] | 0;
  Al = SHA384_IV2[1] | 0;
  Bh = SHA384_IV2[2] | 0;
  Bl = SHA384_IV2[3] | 0;
  Ch = SHA384_IV2[4] | 0;
  Cl = SHA384_IV2[5] | 0;
  Dh = SHA384_IV2[6] | 0;
  Dl = SHA384_IV2[7] | 0;
  Eh = SHA384_IV2[8] | 0;
  El = SHA384_IV2[9] | 0;
  Fh = SHA384_IV2[10] | 0;
  Fl = SHA384_IV2[11] | 0;
  Gh = SHA384_IV2[12] | 0;
  Gl = SHA384_IV2[13] | 0;
  Hh = SHA384_IV2[14] | 0;
  Hl = SHA384_IV2[15] | 0;
  constructor() {
    super(48);
  }
}
var sha2562 = /* @__PURE__ */ createHasher2(() => new _SHA2562, /* @__PURE__ */ oidNist2(1));
var sha384 = /* @__PURE__ */ createHasher2(() => new _SHA384, /* @__PURE__ */ oidNist2(2));

// node_modules/@noble/post-quantum/node_modules/@noble/curves/ed25519.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _1n13 = BigInt(1);
var _2n10 = BigInt(2);
var _3n6 = /* @__PURE__ */ BigInt(3);
var _5n4 = BigInt(5);
var _8n5 = BigInt(8);
var ed25519_CURVE_p2 = BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed");
function ed25519_pow_2_252_32(x) {
  const _10n = BigInt(10), _20n = BigInt(20), _40n = BigInt(40), _80n = BigInt(80);
  const P = ed25519_CURVE_p2;
  const x2 = x * x % P;
  const b2 = x2 * x % P;
  const b4 = pow22(b2, _2n10, P) * b2 % P;
  const b5 = pow22(b4, _1n13, P) * x % P;
  const b10 = pow22(b5, _5n4, P) * b5 % P;
  const b20 = pow22(b10, _10n, P) * b10 % P;
  const b40 = pow22(b20, _20n, P) * b20 % P;
  const b80 = pow22(b40, _40n, P) * b40 % P;
  const b160 = pow22(b80, _80n, P) * b80 % P;
  const b240 = pow22(b160, _80n, P) * b80 % P;
  const b250 = pow22(b240, _10n, P) * b10 % P;
  const pow_p_5_8 = pow22(b250, _2n10, P) * x % P;
  return { pow_p_5_8, b2 };
}
function adjustScalarBytes2(bytes) {
  bytes[0] &= 248;
  bytes[31] &= 127;
  bytes[31] |= 64;
  return bytes;
}
var x255192 = /* @__PURE__ */ (() => {
  const P = ed25519_CURVE_p2;
  return montgomery2({
    P,
    type: "x25519",
    powPminus2: (x) => {
      const { pow_p_5_8, b2 } = ed25519_pow_2_252_32(x);
      return mod2(pow22(pow_p_5_8, _3n6, P) * b2, P);
    },
    adjustScalarBytes: adjustScalarBytes2
  });
})();

// node_modules/@noble/post-quantum/node_modules/@noble/curves/nist.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var p256_CURVE = /* @__PURE__ */ (() => ({
  p: BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"),
  n: BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"),
  h: BigInt(1),
  a: BigInt("0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc"),
  b: BigInt("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"),
  Gx: BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),
  Gy: BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")
}))();
var p384_CURVE = /* @__PURE__ */ (() => ({
  p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffff"),
  n: BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973"),
  h: BigInt(1),
  a: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000fffffffc"),
  b: BigInt("0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aef"),
  Gx: BigInt("0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7"),
  Gy: BigInt("0x3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f")
}))();
var p256_Point = /* @__PURE__ */ weierstrass2(p256_CURVE);
var p256 = /* @__PURE__ */ ecdsa2(p256_Point, sha2562);
var p384_Point = /* @__PURE__ */ weierstrass2(p384_CURVE);
var p384 = /* @__PURE__ */ ecdsa2(p384_Point, sha384);

// node_modules/@noble/post-quantum/node_modules/@noble/hashes/hkdf.js
function extract2(hash, ikm, salt) {
  ahash2(hash);
  if (salt === undefined)
    salt = new Uint8Array(hash.outputLen);
  return hmac2(hash, salt, ikm);
}
var HKDF_COUNTER2 = /* @__PURE__ */ Uint8Array.of(0);
var EMPTY_BUFFER2 = /* @__PURE__ */ Uint8Array.of();
function expand2(hash, prk, info, length = 32) {
  ahash2(hash);
  anumber5(length, "length");
  const olen = hash.outputLen;
  if (length > 255 * olen)
    throw new Error("Length must be <= 255*HashLen");
  const blocks = Math.ceil(length / olen);
  if (info === undefined)
    info = EMPTY_BUFFER2;
  else
    abytes5(info, undefined, "info");
  const okm = new Uint8Array(blocks * olen);
  const HMAC = hmac2.create(hash, prk);
  const HMACTmp = HMAC._cloneInto();
  const T = new Uint8Array(HMAC.outputLen);
  for (let counter = 0;counter < blocks; counter++) {
    HKDF_COUNTER2[0] = counter + 1;
    HMACTmp.update(counter === 0 ? EMPTY_BUFFER2 : T).update(info).update(HKDF_COUNTER2).digestInto(T);
    okm.set(T, olen * counter);
    HMAC._cloneInto(HMACTmp);
  }
  HMAC.destroy();
  HMACTmp.destroy();
  clean3(T, HKDF_COUNTER2);
  return okm.slice(0, length);
}

// node_modules/@noble/post-quantum/node_modules/@noble/hashes/sha3.js
var _0n15 = BigInt(0);
var _1n14 = BigInt(1);
var _2n11 = BigInt(2);
var _7n3 = BigInt(7);
var _256n = BigInt(256);
var _0x71n = BigInt(113);
var SHA3_PI = [];
var SHA3_ROTL = [];
var _SHA3_IOTA = [];
for (let round = 0, R = _1n14, x = 1, y = 0;round < 24; round++) {
  [x, y] = [y, (2 * x + 3 * y) % 5];
  SHA3_PI.push(2 * (5 * y + x));
  SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
  let t = _0n15;
  for (let j = 0;j < 7; j++) {
    R = (R << _1n14 ^ (R >> _7n3) * _0x71n) % _256n;
    if (R & _2n11)
      t ^= _1n14 << (_1n14 << BigInt(j)) - _1n14;
  }
  _SHA3_IOTA.push(t);
}
var IOTAS = split2(_SHA3_IOTA, true);
var SHA3_IOTA_H = IOTAS[0];
var SHA3_IOTA_L = IOTAS[1];
var rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
var rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
function keccakP(s, rounds = 24) {
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds;round < 24; round++) {
    for (let x = 0;x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0;x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0;y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0;t < 24; t++) {
      const shift = SHA3_ROTL[t];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0;y < 50; y += 10) {
      for (let x = 0;x < 10; x++)
        B[x] = s[y + x];
      for (let x = 0;x < 10; x++)
        s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
    }
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
  clean3(B);
}

class Keccak {
  state;
  pos = 0;
  posOut = 0;
  finished = false;
  state32;
  destroyed = false;
  blockLen;
  suffix;
  outputLen;
  enableXOF = false;
  rounds;
  constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
    this.blockLen = blockLen;
    this.suffix = suffix;
    this.outputLen = outputLen;
    this.enableXOF = enableXOF;
    this.rounds = rounds;
    anumber5(outputLen, "outputLen");
    if (!(0 < blockLen && blockLen < 200))
      throw new Error("only keccak-f1600 function is supported");
    this.state = new Uint8Array(200);
    this.state32 = u323(this.state);
  }
  clone() {
    return this._cloneInto();
  }
  keccak() {
    swap32IfBE3(this.state32);
    keccakP(this.state32, this.rounds);
    swap32IfBE3(this.state32);
    this.posOut = 0;
    this.pos = 0;
  }
  update(data) {
    aexists3(this);
    abytes5(data);
    const { blockLen, state } = this;
    const len = data.length;
    for (let pos = 0;pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      for (let i = 0;i < take; i++)
        state[this.pos++] ^= data[pos++];
      if (this.pos === blockLen)
        this.keccak();
    }
    return this;
  }
  finish() {
    if (this.finished)
      return;
    this.finished = true;
    const { state, suffix, pos, blockLen } = this;
    state[pos] ^= suffix;
    if ((suffix & 128) !== 0 && pos === blockLen - 1)
      this.keccak();
    state[blockLen - 1] ^= 128;
    this.keccak();
  }
  writeInto(out) {
    aexists3(this, false);
    abytes5(out);
    this.finish();
    const bufferOut = this.state;
    const { blockLen } = this;
    for (let pos = 0, len = out.length;pos < len; ) {
      if (this.posOut >= blockLen)
        this.keccak();
      const take = Math.min(blockLen - this.posOut, len - pos);
      out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
      this.posOut += take;
      pos += take;
    }
    return out;
  }
  xofInto(out) {
    if (!this.enableXOF)
      throw new Error("XOF is not possible for this instance");
    return this.writeInto(out);
  }
  xof(bytes) {
    anumber5(bytes);
    return this.xofInto(new Uint8Array(bytes));
  }
  digestInto(out) {
    aoutput3(out, this);
    if (this.finished)
      throw new Error("digest() was already called");
    this.writeInto(out);
    this.destroy();
    return out;
  }
  digest() {
    return this.digestInto(new Uint8Array(this.outputLen));
  }
  destroy() {
    this.destroyed = true;
    clean3(this.state);
  }
  _cloneInto(to) {
    const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
    to ||= new Keccak(blockLen, suffix, outputLen, enableXOF, rounds);
    to.state32.set(this.state32);
    to.pos = this.pos;
    to.posOut = this.posOut;
    to.finished = this.finished;
    to.rounds = rounds;
    to.suffix = suffix;
    to.outputLen = outputLen;
    to.enableXOF = enableXOF;
    to.destroyed = this.destroyed;
    return to;
  }
}
var genKeccak = (suffix, blockLen, outputLen, info = {}) => createHasher2(() => new Keccak(blockLen, suffix, outputLen), info);
var sha3_256 = /* @__PURE__ */ genKeccak(6, 136, 32, /* @__PURE__ */ oidNist2(8));
var sha3_512 = /* @__PURE__ */ genKeccak(6, 72, 64, /* @__PURE__ */ oidNist2(10));
var genShake = (suffix, blockLen, outputLen, info = {}) => createHasher2((opts = {}) => new Keccak(blockLen, suffix, opts.dkLen === undefined ? outputLen : opts.dkLen, true), info);
var shake128 = /* @__PURE__ */ genShake(31, 168, 16, /* @__PURE__ */ oidNist2(11));
var shake256 = /* @__PURE__ */ genShake(31, 136, 32, /* @__PURE__ */ oidNist2(12));

// node_modules/@noble/post-quantum/node_modules/@noble/curves/abstract/fft.js
function checkU32(n) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 4294967295)
    throw new Error("wrong u32 integer:" + n);
  return n;
}
function isPowerOfTwo(x) {
  checkU32(x);
  return (x & x - 1) === 0 && x !== 0;
}
function reverseBits(n, bits) {
  checkU32(n);
  let reversed = 0;
  for (let i = 0;i < bits; i++, n >>>= 1)
    reversed = reversed << 1 | n & 1;
  return reversed;
}
function log2(n) {
  checkU32(n);
  return 31 - Math.clz32(n);
}
function bitReversalInplace(values) {
  const n = values.length;
  if (n < 2 || !isPowerOfTwo(n))
    throw new Error("n must be a power of 2 and greater than 1. Got " + n);
  const bits = log2(n);
  for (let i = 0;i < n; i++) {
    const j = reverseBits(i, bits);
    if (i < j) {
      const tmp = values[i];
      values[i] = values[j];
      values[j] = tmp;
    }
  }
  return values;
}
var FFTCore = (F, coreOpts) => {
  const { N, roots, dit, invertButterflies = false, skipStages = 0, brp = true } = coreOpts;
  const bits = log2(N);
  if (!isPowerOfTwo(N))
    throw new Error("FFT: Polynomial size should be power of two");
  const isDit = dit !== invertButterflies;
  return (values) => {
    if (values.length !== N)
      throw new Error("FFT: wrong Polynomial length");
    if (dit && brp)
      bitReversalInplace(values);
    for (let i = 0, g = 1;i < bits - skipStages; i++) {
      const s = dit ? i + 1 + skipStages : bits - i;
      const m = 1 << s;
      const m2 = m >> 1;
      const stride = N >> s;
      for (let k = 0;k < N; k += m) {
        for (let j = 0, grp = g++;j < m2; j++) {
          const rootPos = invertButterflies ? dit ? N - grp : grp : j * stride;
          const i0 = k + j;
          const i1 = k + j + m2;
          const omega = roots[rootPos];
          const b = values[i1];
          const a = values[i0];
          if (isDit) {
            const t = F.mul(b, omega);
            values[i0] = F.add(a, t);
            values[i1] = F.sub(a, t);
          } else if (invertButterflies) {
            values[i0] = F.add(b, a);
            values[i1] = F.mul(F.sub(b, a), omega);
          } else {
            values[i0] = F.add(a, b);
            values[i1] = F.mul(F.sub(a, b), omega);
          }
        }
      }
    }
    if (!dit && brp)
      bitReversalInplace(values);
    return values;
  };
};

// node_modules/@noble/post-quantum/utils.js
/*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
var randomBytes5 = randomBytes4;
function equalBytes2(a, b) {
  if (a.length !== b.length)
    return false;
  let diff = 0;
  for (let i = 0;i < a.length; i++)
    diff |= a[i] ^ b[i];
  return diff === 0;
}
function copyBytes4(bytes) {
  return Uint8Array.from(bytes);
}
function splitCoder(label, ...lengths) {
  const getLength = (c) => typeof c === "number" ? c : c.bytesLen;
  const bytesLen = lengths.reduce((sum, a) => sum + getLength(a), 0);
  return {
    bytesLen,
    encode: (bufs) => {
      const res = new Uint8Array(bytesLen);
      for (let i = 0, pos = 0;i < lengths.length; i++) {
        const c = lengths[i];
        const l = getLength(c);
        const b = typeof c === "number" ? bufs[i] : c.encode(bufs[i]);
        abytes5(b, l, label);
        res.set(b, pos);
        if (typeof c !== "number")
          b.fill(0);
        pos += l;
      }
      return res;
    },
    decode: (buf) => {
      abytes5(buf, bytesLen, label);
      const res = [];
      for (const c of lengths) {
        const l = getLength(c);
        const b = buf.subarray(0, l);
        res.push(typeof c === "number" ? b : c.decode(b));
        buf = buf.subarray(l);
      }
      return res;
    }
  };
}
function vecCoder(c, vecLen) {
  const bytesLen = vecLen * c.bytesLen;
  return {
    bytesLen,
    encode: (u) => {
      if (u.length !== vecLen)
        throw new Error(`vecCoder.encode: wrong length=${u.length}. Expected: ${vecLen}`);
      const res = new Uint8Array(bytesLen);
      for (let i = 0, pos = 0;i < u.length; i++) {
        const b = c.encode(u[i]);
        res.set(b, pos);
        b.fill(0);
        pos += b.length;
      }
      return res;
    },
    decode: (a) => {
      abytes5(a, bytesLen);
      const r = [];
      for (let i = 0;i < a.length; i += c.bytesLen)
        r.push(c.decode(a.subarray(i, i + c.bytesLen)));
      return r;
    }
  };
}
function cleanBytes(...list) {
  for (const t of list) {
    if (Array.isArray(t))
      for (const b of t)
        b.fill(0);
    else
      t.fill(0);
  }
}
function getMask(bits) {
  return (1 << bits) - 1;
}
var EMPTY = Uint8Array.of();

// node_modules/@noble/post-quantum/_crystals.js
/*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
var genCrystals = (opts) => {
  const { newPoly, N, Q, F, ROOT_OF_UNITY, brvBits, isKyber } = opts;
  const mod = (a, modulo = Q) => {
    const result = a % modulo | 0;
    return (result >= 0 ? result | 0 : modulo + result | 0) | 0;
  };
  const smod = (a, modulo = Q) => {
    const r = mod(a, modulo) | 0;
    return (r > modulo >> 1 ? r - modulo | 0 : r) | 0;
  };
  function getZettas() {
    const out = newPoly(N);
    for (let i = 0;i < N; i++) {
      const b = reverseBits(i, brvBits);
      const p = BigInt(ROOT_OF_UNITY) ** BigInt(b) % BigInt(Q);
      out[i] = Number(p) | 0;
    }
    return out;
  }
  const nttZetas = getZettas();
  const field = {
    add: (a, b) => mod((a | 0) + (b | 0)) | 0,
    sub: (a, b) => mod((a | 0) - (b | 0)) | 0,
    mul: (a, b) => mod((a | 0) * (b | 0)) | 0,
    inv: (_a) => {
      throw new Error("not implemented");
    }
  };
  const nttOpts = {
    N,
    roots: nttZetas,
    invertButterflies: true,
    skipStages: isKyber ? 1 : 0,
    brp: false
  };
  const dif = FFTCore(field, { dit: false, ...nttOpts });
  const dit = FFTCore(field, { dit: true, ...nttOpts });
  const NTT = {
    encode: (r) => {
      return dif(r);
    },
    decode: (r) => {
      dit(r);
      for (let i = 0;i < r.length; i++)
        r[i] = mod(F * r[i]);
      return r;
    }
  };
  const bitsCoder = (d, c) => {
    const mask = getMask(d);
    const bytesLen = d * (N / 8);
    return {
      bytesLen,
      encode: (poly) => {
        const r = new Uint8Array(bytesLen);
        for (let i = 0, buf = 0, bufLen = 0, pos = 0;i < poly.length; i++) {
          buf |= (c.encode(poly[i]) & mask) << bufLen;
          bufLen += d;
          for (;bufLen >= 8; bufLen -= 8, buf >>= 8)
            r[pos++] = buf & getMask(bufLen);
        }
        return r;
      },
      decode: (bytes) => {
        const r = newPoly(N);
        for (let i = 0, buf = 0, bufLen = 0, pos = 0;i < bytes.length; i++) {
          buf |= bytes[i] << bufLen;
          bufLen += 8;
          for (;bufLen >= d; bufLen -= d, buf >>= d)
            r[pos++] = c.decode(buf & mask);
        }
        return r;
      }
    };
  };
  return { mod, smod, nttZetas, NTT, bitsCoder };
};
var createXofShake = (shake) => (seed, blockLen) => {
  if (!blockLen)
    blockLen = shake.blockLen;
  const _seed = new Uint8Array(seed.length + 2);
  _seed.set(seed);
  const seedLen = seed.length;
  const buf = new Uint8Array(blockLen);
  let h = shake.create({});
  let calls = 0;
  let xofs = 0;
  return {
    stats: () => ({ calls, xofs }),
    get: (x, y) => {
      _seed[seedLen + 0] = x;
      _seed[seedLen + 1] = y;
      h.destroy();
      h = shake.create({}).update(_seed);
      calls++;
      return () => {
        xofs++;
        return h.xofInto(buf);
      };
    },
    clean: () => {
      h.destroy();
      cleanBytes(buf, _seed);
    }
  };
};
var XOF128 = /* @__PURE__ */ createXofShake(shake128);

// node_modules/@noble/post-quantum/ml-kem.js
/*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
var N = 256;
var Q = 3329;
var F = 3303;
var ROOT_OF_UNITY = 17;
var { mod: mod3, nttZetas, NTT, bitsCoder } = genCrystals({
  N,
  Q,
  F,
  ROOT_OF_UNITY,
  newPoly: (n) => new Uint16Array(n),
  brvBits: 7,
  isKyber: true
});
var PARAMS = {
  512: { N, Q, K: 2, ETA1: 3, ETA2: 2, du: 10, dv: 4, RBGstrength: 128 },
  768: { N, Q, K: 3, ETA1: 2, ETA2: 2, du: 10, dv: 4, RBGstrength: 192 },
  1024: { N, Q, K: 4, ETA1: 2, ETA2: 2, du: 11, dv: 5, RBGstrength: 256 }
};
var compress = (d) => {
  if (d >= 12)
    return { encode: (i) => i, decode: (i) => i };
  const a = 2 ** (d - 1);
  return {
    encode: (i) => ((i << d) + Q / 2) / Q,
    decode: (i) => i * Q + a >>> d
  };
};
var polyCoder = (d) => bitsCoder(d, compress(d));
function polyAdd(a, b) {
  for (let i = 0;i < N; i++)
    a[i] = mod3(a[i] + b[i]);
}
function polySub(a, b) {
  for (let i = 0;i < N; i++)
    a[i] = mod3(a[i] - b[i]);
}
function BaseCaseMultiply(a0, a1, b0, b1, zeta) {
  const c0 = mod3(a1 * b1 * zeta + a0 * b0);
  const c1 = mod3(a0 * b1 + a1 * b0);
  return { c0, c1 };
}
function MultiplyNTTs(f, g) {
  for (let i = 0;i < N / 2; i++) {
    let z = nttZetas[64 + (i >> 1)];
    if (i & 1)
      z = -z;
    const { c0, c1 } = BaseCaseMultiply(f[2 * i + 0], f[2 * i + 1], g[2 * i + 0], g[2 * i + 1], z);
    f[2 * i + 0] = c0;
    f[2 * i + 1] = c1;
  }
  return f;
}
function SampleNTT(xof) {
  const r = new Uint16Array(N);
  for (let j = 0;j < N; ) {
    const b = xof();
    if (b.length % 3)
      throw new Error("SampleNTT: unaligned block");
    for (let i = 0;j < N && i + 3 <= b.length; i += 3) {
      const d1 = (b[i + 0] >> 0 | b[i + 1] << 8) & 4095;
      const d2 = (b[i + 1] >> 4 | b[i + 2] << 4) & 4095;
      if (d1 < Q)
        r[j++] = d1;
      if (j < N && d2 < Q)
        r[j++] = d2;
    }
  }
  return r;
}
function sampleCBD(PRF, seed, nonce, eta) {
  const buf = PRF(eta * N / 4, seed, nonce);
  const r = new Uint16Array(N);
  const b32 = u323(buf);
  let len = 0;
  for (let i = 0, p = 0, bb = 0, t0 = 0;i < b32.length; i++) {
    let b = b32[i];
    for (let j = 0;j < 32; j++) {
      bb += b & 1;
      b >>= 1;
      len += 1;
      if (len === eta) {
        t0 = bb;
        bb = 0;
      } else if (len === 2 * eta) {
        r[p++] = mod3(t0 - bb);
        bb = 0;
        len = 0;
      }
    }
  }
  if (len)
    throw new Error(`sampleCBD: leftover bits: ${len}`);
  return r;
}
var genKPKE = (opts) => {
  const { K, PRF, XOF, HASH512, ETA1, ETA2, du, dv } = opts;
  const poly1 = polyCoder(1);
  const polyV = polyCoder(dv);
  const polyU = polyCoder(du);
  const publicCoder = splitCoder("publicKey", vecCoder(polyCoder(12), K), 32);
  const secretCoder = vecCoder(polyCoder(12), K);
  const cipherCoder = splitCoder("ciphertext", vecCoder(polyU, K), polyV);
  const seedCoder = splitCoder("seed", 32, 32);
  return {
    secretCoder,
    lengths: {
      secretKey: secretCoder.bytesLen,
      publicKey: publicCoder.bytesLen,
      cipherText: cipherCoder.bytesLen
    },
    keygen: (seed) => {
      abytes5(seed, 32, "seed");
      const seedDst = new Uint8Array(33);
      seedDst.set(seed);
      seedDst[32] = K;
      const seedHash = HASH512(seedDst);
      const [rho, sigma] = seedCoder.decode(seedHash);
      const sHat = [];
      const tHat = [];
      for (let i = 0;i < K; i++)
        sHat.push(NTT.encode(sampleCBD(PRF, sigma, i, ETA1)));
      const x = XOF(rho);
      for (let i = 0;i < K; i++) {
        const e = NTT.encode(sampleCBD(PRF, sigma, K + i, ETA1));
        for (let j = 0;j < K; j++) {
          const aji = SampleNTT(x.get(j, i));
          polyAdd(e, MultiplyNTTs(aji, sHat[j]));
        }
        tHat.push(e);
      }
      x.clean();
      const res = {
        publicKey: publicCoder.encode([tHat, rho]),
        secretKey: secretCoder.encode(sHat)
      };
      cleanBytes(rho, sigma, sHat, tHat, seedDst, seedHash);
      return res;
    },
    encrypt: (publicKey, msg, seed) => {
      const [tHat, rho] = publicCoder.decode(publicKey);
      const rHat = [];
      for (let i = 0;i < K; i++)
        rHat.push(NTT.encode(sampleCBD(PRF, seed, i, ETA1)));
      const x = XOF(rho);
      const tmp2 = new Uint16Array(N);
      const u = [];
      for (let i = 0;i < K; i++) {
        const e1 = sampleCBD(PRF, seed, K + i, ETA2);
        const tmp = new Uint16Array(N);
        for (let j = 0;j < K; j++) {
          const aij = SampleNTT(x.get(i, j));
          polyAdd(tmp, MultiplyNTTs(aij, rHat[j]));
        }
        polyAdd(e1, NTT.decode(tmp));
        u.push(e1);
        polyAdd(tmp2, MultiplyNTTs(tHat[i], rHat[i]));
        cleanBytes(tmp);
      }
      x.clean();
      const e2 = sampleCBD(PRF, seed, 2 * K, ETA2);
      polyAdd(e2, NTT.decode(tmp2));
      const v = poly1.decode(msg);
      polyAdd(v, e2);
      cleanBytes(tHat, rHat, tmp2, e2);
      return cipherCoder.encode([u, v]);
    },
    decrypt: (cipherText, privateKey) => {
      const [u, v] = cipherCoder.decode(cipherText);
      const sk = secretCoder.decode(privateKey);
      const tmp = new Uint16Array(N);
      for (let i = 0;i < K; i++)
        polyAdd(tmp, MultiplyNTTs(sk[i], NTT.encode(u[i])));
      polySub(v, NTT.decode(tmp));
      cleanBytes(tmp, sk, u);
      return poly1.encode(v);
    }
  };
};
function createKyber(opts) {
  const KPKE = genKPKE(opts);
  const { HASH256, HASH512, KDF } = opts;
  const { secretCoder: KPKESecretCoder, lengths } = KPKE;
  const secretCoder = splitCoder("secretKey", lengths.secretKey, lengths.publicKey, 32, 32);
  const msgLen = 32;
  const seedLen = 64;
  return {
    info: { type: "ml-kem" },
    lengths: {
      ...lengths,
      seed: 64,
      msg: msgLen,
      msgRand: msgLen,
      secretKey: secretCoder.bytesLen
    },
    keygen: (seed = randomBytes5(seedLen)) => {
      abytes5(seed, seedLen, "seed");
      const { publicKey, secretKey: sk } = KPKE.keygen(seed.subarray(0, 32));
      const publicKeyHash = HASH256(publicKey);
      const secretKey = secretCoder.encode([sk, publicKey, publicKeyHash, seed.subarray(32)]);
      cleanBytes(sk, publicKeyHash);
      return { publicKey, secretKey };
    },
    getPublicKey: (secretKey) => {
      const [_sk, publicKey, _publicKeyHash, _z] = secretCoder.decode(secretKey);
      return Uint8Array.from(publicKey);
    },
    encapsulate: (publicKey, msg = randomBytes5(msgLen)) => {
      abytes5(publicKey, lengths.publicKey, "publicKey");
      abytes5(msg, msgLen, "message");
      const eke = publicKey.subarray(0, 384 * opts.K);
      const ek = KPKESecretCoder.encode(KPKESecretCoder.decode(copyBytes4(eke)));
      if (!equalBytes2(ek, eke)) {
        cleanBytes(ek);
        throw new Error("ML-KEM.encapsulate: wrong publicKey modulus");
      }
      cleanBytes(ek);
      const kr = HASH512.create().update(msg).update(HASH256(publicKey)).digest();
      const cipherText = KPKE.encrypt(publicKey, msg, kr.subarray(32, 64));
      cleanBytes(kr.subarray(32));
      return { cipherText, sharedSecret: kr.subarray(0, 32) };
    },
    decapsulate: (cipherText, secretKey) => {
      abytes5(secretKey, secretCoder.bytesLen, "secretKey");
      abytes5(cipherText, lengths.cipherText, "cipherText");
      const k768 = secretCoder.bytesLen - 96;
      const start = k768 + 32;
      const test = HASH256(secretKey.subarray(k768 / 2, start));
      if (!equalBytes2(test, secretKey.subarray(start, start + 32)))
        throw new Error("invalid secretKey: hash check failed");
      const [sk, publicKey, publicKeyHash, z] = secretCoder.decode(secretKey);
      const msg = KPKE.decrypt(cipherText, sk);
      const kr = HASH512.create().update(msg).update(publicKeyHash).digest();
      const Khat = kr.subarray(0, 32);
      const cipherText2 = KPKE.encrypt(publicKey, msg, kr.subarray(32, 64));
      const isValid = equalBytes2(cipherText, cipherText2);
      const Kbar = KDF.create({ dkLen: 32 }).update(z).update(cipherText).digest();
      cleanBytes(msg, cipherText2, !isValid ? Khat : Kbar);
      return isValid ? Khat : Kbar;
    }
  };
}
function shakePRF(dkLen, key, nonce) {
  return shake256.create({ dkLen }).update(key).update(new Uint8Array([nonce])).digest();
}
var opts = {
  HASH256: sha3_256,
  HASH512: sha3_512,
  KDF: shake256,
  XOF: XOF128,
  PRF: shakePRF
};
var ml_kem512 = /* @__PURE__ */ createKyber({
  ...opts,
  ...PARAMS[512]
});
var ml_kem768 = /* @__PURE__ */ createKyber({
  ...opts,
  ...PARAMS[768]
});
var ml_kem1024 = /* @__PURE__ */ createKyber({
  ...opts,
  ...PARAMS[1024]
});

// node_modules/@noble/post-quantum/hybrid.js
/*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
function ecKeygen(curve, allowZeroKey = false) {
  const lengths = curve.lengths;
  let keygen = curve.keygen;
  if (allowZeroKey) {
    const wCurve = curve;
    const Fn = wCurve.Point.Fn;
    if (!Fn)
      throw new Error("No Point.Fn");
    keygen = (seed = randomBytes5(lengths.seed)) => {
      abytes5(seed, lengths.seed, "seed");
      const seedScalar = Fn.isLE ? bytesToNumberLE2(seed) : bytesToNumberBE2(seed);
      const secretKey = Fn.toBytes(Fn.create(seedScalar));
      return { secretKey, publicKey: curve.getPublicKey(secretKey) };
    };
  }
  return {
    lengths: { secretKey: lengths.secretKey, publicKey: lengths.publicKey, seed: lengths.seed },
    keygen,
    getPublicKey: (secretKey) => curve.getPublicKey(secretKey)
  };
}
function ecdhKem(curve, allowZeroKey = false) {
  const kg = ecKeygen(curve, allowZeroKey);
  if (!curve.getSharedSecret)
    throw new Error("wrong curve");
  return {
    lengths: { ...kg.lengths, msg: kg.lengths.seed, cipherText: kg.lengths.publicKey },
    keygen: kg.keygen,
    getPublicKey: kg.getPublicKey,
    encapsulate(publicKey, rand = randomBytes5(curve.lengths.seed)) {
      const ek = this.keygen(rand).secretKey;
      const sharedSecret = this.decapsulate(publicKey, ek);
      const cipherText = curve.getPublicKey(ek);
      cleanBytes(ek);
      return { sharedSecret, cipherText };
    },
    decapsulate(cipherText, secretKey) {
      const res = curve.getSharedSecret(secretKey, cipherText);
      return curve.lengths.publicKeyHasPrefix ? res.subarray(1) : res;
    }
  };
}
function splitLengths(lst, name) {
  return splitCoder(name, ...lst.map((i) => {
    if (typeof i.lengths[name] !== "number")
      throw new Error("wrong length: " + name);
    return i.lengths[name];
  }));
}
function expandSeedXof(xof) {
  return (seed, seedLen) => xof(seed, { dkLen: seedLen });
}
function combineKeys(realSeedLen, expandSeed, ...ck) {
  const seedCoder = splitLengths(ck, "seed");
  const pkCoder = splitLengths(ck, "publicKey");
  if (realSeedLen === undefined)
    realSeedLen = seedCoder.bytesLen;
  anumber5(realSeedLen);
  function expandDecapsulationKey(seed) {
    abytes5(seed, realSeedLen);
    const expanded = seedCoder.decode(expandSeed(seed, seedCoder.bytesLen));
    const keys = ck.map((i, j) => i.keygen(expanded[j]));
    const secretKey = keys.map((i) => i.secretKey);
    const publicKey = keys.map((i) => i.publicKey);
    return { secretKey, publicKey };
  }
  return {
    info: { lengths: { seed: realSeedLen, publicKey: pkCoder.bytesLen, secretKey: realSeedLen } },
    getPublicKey(secretKey) {
      return this.keygen(secretKey).publicKey;
    },
    keygen(seed = randomBytes5(realSeedLen)) {
      const { publicKey: pk, secretKey } = expandDecapsulationKey(seed);
      const publicKey = pkCoder.encode(pk);
      cleanBytes(pk);
      cleanBytes(secretKey);
      return { secretKey: seed, publicKey };
    },
    expandDecapsulationKey,
    realSeedLen
  };
}
function combineKEMS(realSeedLen, realMsgLen, expandSeed, combiner, ...kems) {
  const keys = combineKeys(realSeedLen, expandSeed, ...kems);
  const ctCoder = splitLengths(kems, "cipherText");
  const pkCoder = splitLengths(kems, "publicKey");
  const msgCoder = splitLengths(kems, "msg");
  if (realMsgLen === undefined)
    realMsgLen = msgCoder.bytesLen;
  anumber5(realMsgLen);
  return {
    lengths: {
      ...keys.info.lengths,
      msg: realMsgLen,
      msgRand: msgCoder.bytesLen,
      cipherText: ctCoder.bytesLen
    },
    getPublicKey: keys.getPublicKey,
    keygen: keys.keygen,
    encapsulate(pk, randomness = randomBytes5(msgCoder.bytesLen)) {
      const pks = pkCoder.decode(pk);
      const rand = msgCoder.decode(randomness);
      const enc = kems.map((i, j) => i.encapsulate(pks[j], rand[j]));
      const sharedSecret = enc.map((i) => i.sharedSecret);
      const cipherText = enc.map((i) => i.cipherText);
      const res = {
        sharedSecret: combiner(pks, cipherText, sharedSecret),
        cipherText: ctCoder.encode(cipherText)
      };
      cleanBytes(sharedSecret, cipherText);
      return res;
    },
    decapsulate(ct, seed) {
      const cts = ctCoder.decode(ct);
      const { publicKey, secretKey } = keys.expandDecapsulationKey(seed);
      const sharedSecret = kems.map((i, j) => i.decapsulate(cts[j], secretKey[j]));
      return combiner(publicKey, cts, sharedSecret);
    }
  };
}
function QSF(label, pqc, curveKEM, xof, kdf) {
  ahash2(xof);
  ahash2(kdf);
  return combineKEMS(32, 32, expandSeedXof(xof), (pk, ct, ss) => kdf(concatBytes3(ss[0], ss[1], ct[1], pk[1], asciiToBytes2(label))), pqc, curveKEM);
}
var QSF_ml_kem768_p256 = QSF("QSF-KEM(ML-KEM-768,P-256)-XOF(SHAKE256)-KDF(SHA3-256)", ml_kem768, ecdhKem(p256, true), shake256, sha3_256);
var QSF_ml_kem1024_p384 = QSF("QSF-KEM(ML-KEM-1024,P-384)-XOF(SHAKE256)-KDF(SHA3-256)", ml_kem1024, ecdhKem(p384, true), shake256, sha3_256);
function createKitchenSink(label, pqc, curveKEM, xof, hash) {
  ahash2(xof);
  ahash2(hash);
  return combineKEMS(32, 32, expandSeedXof(xof), (pk, ct, ss) => {
    const preimage = concatBytes3(ss[0], ss[1], ct[0], pk[0], ct[1], pk[1], asciiToBytes2(label));
    const len = 32;
    const ikm = concatBytes3(asciiToBytes2("hybrid_prk"), preimage);
    const prk = extract2(hash, ikm);
    const info = concatBytes3(numberToBytesBE2(len, 2), asciiToBytes2("shared_secret"), asciiToBytes2(""));
    const res = expand2(hash, prk, info, len);
    cleanBytes(prk, info, ikm, preimage);
    return res;
  }, pqc, curveKEM);
}
var x25519kem = ecdhKem(x255192);
var KitchenSink_ml_kem768_x25519 = createKitchenSink("KitchenSink-KEM(ML-KEM-768,X25519)-XOF(SHAKE256)-KDF(HKDF-SHA-256)", ml_kem768, x25519kem, shake256, sha2562);
var ml_kem768_x25519 = /* @__PURE__ */ (() => combineKEMS(32, 32, expandSeedXof(shake256), (pk, ct, ss) => sha3_256(concatBytes3(ss[0], ss[1], ct[1], pk[1], asciiToBytes2("\\.//^\\"))), ml_kem768, x25519kem))();
function nistCurveKem(curve, scalarLen, elemLen, nseed) {
  const Fn = curve.Point.Fn;
  if (!Fn)
    throw new Error("no Point.Fn");
  function rejectionSampling(seed) {
    let sk;
    for (let start = 0, end = scalarLen;; start = end, end += scalarLen) {
      if (end > seed.length)
        throw new Error("rejection sampling failed");
      sk = Fn.fromBytes(seed.subarray(start, end), true);
      if (Fn.isValidNot0(sk))
        break;
    }
    const secretKey = Fn.toBytes(Fn.create(sk));
    const publicKey = curve.getPublicKey(secretKey, false);
    return { secretKey, publicKey };
  }
  return {
    lengths: {
      secretKey: scalarLen,
      publicKey: elemLen,
      seed: nseed,
      msg: nseed,
      cipherText: elemLen
    },
    keygen(seed = randomBytes5(nseed)) {
      abytes5(seed, nseed, "seed");
      return rejectionSampling(seed);
    },
    getPublicKey(secretKey) {
      return curve.getPublicKey(secretKey, false);
    },
    encapsulate(publicKey, rand = randomBytes5(nseed)) {
      abytes5(rand, nseed, "rand");
      const { secretKey: ek } = rejectionSampling(rand);
      const sharedSecret = this.decapsulate(publicKey, ek);
      const cipherText = curve.getPublicKey(ek, false);
      cleanBytes(ek);
      return { sharedSecret, cipherText };
    },
    decapsulate(cipherText, secretKey) {
      const full = curve.getSharedSecret(secretKey, cipherText);
      return full.subarray(1);
    }
  };
}
function concreteHybridKem(label, mlkem, curve, nseed) {
  const { secretKey: scalarLen, publicKeyUncompressed: elemLen } = curve.lengths;
  if (!scalarLen || !elemLen)
    throw new Error("wrong curve");
  const curveKem = nistCurveKem(curve, scalarLen, elemLen, nseed);
  const mlkemSeedLen = 64;
  const totalSeedLen = mlkemSeedLen + nseed;
  return combineKEMS(32, 32, (seed) => {
    abytes5(seed, 32);
    const expanded = shake256(seed, { dkLen: totalSeedLen });
    const mlkemSeed = expanded.subarray(0, mlkemSeedLen);
    const curveSeed = expanded.subarray(mlkemSeedLen, totalSeedLen);
    return concatBytes3(mlkemSeed, curveSeed);
  }, (pk, ct, ss) => sha3_256(concatBytes3(ss[0], ss[1], ct[1], pk[1], asciiToBytes2(label))), mlkem, curveKem);
}
var ml_kem768_p256 = /* @__PURE__ */ (() => concreteHybridKem("MLKEM768-P256", ml_kem768, p256, 128))();
var MLKEM768X25519 = ml_kem768_x25519;
var MLKEM768P256 = ml_kem768_p256;

// node_modules/@noble/curves/nist.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var p256_CURVE2 = /* @__PURE__ */ (() => ({
  p: BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff"),
  n: BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"),
  h: BigInt(1),
  a: BigInt("0xffffffff00000001000000000000000000000000fffffffffffffffffffffffc"),
  b: BigInt("0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b"),
  Gx: BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),
  Gy: BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")
}))();
var p256_Point2 = /* @__PURE__ */ weierstrass(p256_CURVE2);
var p2562 = /* @__PURE__ */ ecdsa(p256_Point2, sha256);

// node_modules/age-encryption/dist/x25519.js
var exportable = false;
var webCryptoOff = false;
async function webCryptoFallback(func, fallback) {
  if (webCryptoOff) {
    return await fallback();
  }
  try {
    return await func();
  } catch (error) {
    if (error instanceof ReferenceError || error instanceof DOMException && error.name === "NotSupportedError") {
      return await fallback();
    } else {
      throw error;
    }
  }
}
async function scalarMult(scalar, u) {
  return await webCryptoFallback(async () => {
    const key = isCryptoKey(scalar) ? scalar : await importX25519Key(scalar);
    const peer = await crypto.subtle.importKey("raw", domBuffer(u), { name: "X25519" }, exportable, []);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: "X25519", public: peer }, key, 256));
  }, () => {
    if (isCryptoKey(scalar)) {
      throw new Error("CryptoKey provided but X25519 WebCrypto is not supported");
    }
    return x25519.scalarMult(scalar, u);
  });
}
async function scalarMultBase(scalar) {
  return await webCryptoFallback(async () => {
    return scalarMult(scalar, x25519.GuBytes);
  }, () => {
    if (isCryptoKey(scalar)) {
      throw new Error("CryptoKey provided but X25519 WebCrypto is not supported");
    }
    return x25519.scalarMultBase(scalar);
  });
}
var pkcs8Prefix = /* @__PURE__ */ new Uint8Array([
  48,
  46,
  2,
  1,
  0,
  48,
  5,
  6,
  3,
  43,
  101,
  110,
  4,
  34,
  4,
  32
]);
async function importX25519Key(key) {
  if (key.length !== 32) {
    throw new Error("X25519 private key must be 32 bytes");
  }
  const pkcs8 = new Uint8Array([...pkcs8Prefix, ...key]);
  return crypto.subtle.importKey("pkcs8", pkcs8, { name: "X25519" }, exportable, ["deriveBits"]);
}
function isCryptoKey(key) {
  return typeof CryptoKey !== "undefined" && key instanceof CryptoKey;
}
function domBuffer(arr) {
  return arr;
}

// node_modules/age-encryption/dist/io.js
function flatten(arr) {
  const len = arr.reduce((sum, line) => sum + line.length, 0);
  const out = new Uint8Array(len);
  let n = 0;
  for (const a of arr) {
    out.set(a, n);
    n += a.length;
  }
  return out;
}
function prepend(s, ...prefixes) {
  return s.pipeThrough(new TransformStream({
    start(controller) {
      for (const p of prefixes) {
        controller.enqueue(p);
      }
    }
  }));
}
function stream(a) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(a);
      controller.close();
    }
  });
}
async function readAll(stream) {
  if (!(stream instanceof ReadableStream)) {
    throw new Error("readAll expects a ReadableStream<Uint8Array>");
  }
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// node_modules/age-encryption/dist/format.js
class Stanza {
  args;
  body;
  constructor(args, body) {
    this.args = args;
    this.body = body;
  }
}
function encodeHeaderNoMAC(recipients) {
  const lines = [];
  lines.push(`age-encryption.org/v1
`);
  for (const s of recipients) {
    lines.push("-> " + s.args.join(" ") + `
`);
    for (let i = 0;i < s.body.length; i += 48) {
      let end = i + 48;
      if (end > s.body.length)
        end = s.body.length;
      lines.push(base64nopad.encode(s.body.subarray(i, end)) + `
`);
    }
    if (s.body.length % 48 === 0)
      lines.push(`
`);
  }
  lines.push("---");
  return new TextEncoder().encode(lines.join(""));
}
function encodeHeader(recipients, MAC) {
  return flatten([
    encodeHeaderNoMAC(recipients),
    new TextEncoder().encode(" " + base64nopad.encode(MAC) + `
`)
  ]);
}

// node_modules/age-encryption/dist/recipients.js
class HybridRecipient {
  recipient;
  constructor(s) {
    const { prefix, words } = bech32.decode(s, false);
    const bytes = bech32.fromWords(words);
    if (!s.startsWith("age1pq1") || prefix.toLowerCase() !== "age1pq" || bytes.length !== 1216) {
      throw Error("invalid recipient");
    }
    this.recipient = bytes;
  }
  wrapFileKey(fileKey) {
    const { cipherText: encapsulatedKey, sharedSecret } = MLKEM768X25519.encapsulate(this.recipient);
    const label = new TextEncoder().encode("age-encryption.org/mlkem768x25519");
    const { key, nonce } = hpkeContext(hpkeMLKEM768X25519, sharedSecret, label);
    const ciphertext = chacha20poly1305(key, nonce).encrypt(fileKey);
    return [new Stanza(["mlkem768x25519", base64nopad.encode(encapsulatedKey)], ciphertext)];
  }
}
var hpkeMLKEM768X25519 = 25722;
var hpkeMLKEM768P256 = 80;
var hpkeDHKEMP256 = 16;
function hpkeContext(kemID, sharedSecret, info) {
  const suiteID = hpkeSuiteID(kemID);
  const pskIDHash = hpkeLabeledExtract(suiteID, undefined, "psk_id_hash", new Uint8Array(0));
  const infoHash = hpkeLabeledExtract(suiteID, undefined, "info_hash", info);
  const ksContext = new Uint8Array(1 + pskIDHash.length + infoHash.length);
  ksContext[0] = 0;
  ksContext.set(pskIDHash, 1);
  ksContext.set(infoHash, 1 + pskIDHash.length);
  const secret = hpkeLabeledExtract(suiteID, sharedSecret, "secret", new Uint8Array(0));
  const key = hpkeLabeledExpand(suiteID, secret, "key", ksContext, 32);
  const nonce = hpkeLabeledExpand(suiteID, secret, "base_nonce", ksContext, 12);
  return { key, nonce };
}
function hpkeSuiteID(kemID) {
  const suiteID = new Uint8Array(10);
  suiteID.set(new TextEncoder().encode("HPKE"), 0);
  suiteID[4] = kemID >> 8 & 255;
  suiteID[5] = kemID & 255;
  suiteID[6] = 0;
  suiteID[7] = 1;
  suiteID[8] = 0;
  suiteID[9] = 3;
  return suiteID;
}
function hpkeLabeledExtract(suiteID, salt, label, ikm) {
  const labeledIKM = new Uint8Array(7 + suiteID.length + label.length + ikm.length);
  let offset = 0;
  labeledIKM.set(new TextEncoder().encode("HPKE-v1"), offset);
  offset += "HPKE-v1".length;
  labeledIKM.set(suiteID, offset);
  offset += suiteID.length;
  labeledIKM.set(new TextEncoder().encode(label), offset);
  offset += label.length;
  labeledIKM.set(ikm, offset);
  return extract(sha256, labeledIKM, salt);
}
function hpkeLabeledExpand(suiteID, prk, label, info, length) {
  const labeledInfo = new Uint8Array(2 + 7 + suiteID.length + label.length + info.length);
  let offset = 0;
  labeledInfo[offset] = length >> 8 & 255;
  labeledInfo[offset + 1] = length & 255;
  offset += 2;
  labeledInfo.set(new TextEncoder().encode("HPKE-v1"), offset);
  offset += "HPKE-v1".length;
  labeledInfo.set(suiteID, offset);
  offset += suiteID.length;
  labeledInfo.set(new TextEncoder().encode(label), offset);
  offset += label.length;
  labeledInfo.set(info, offset);
  return expand(sha256, prk, labeledInfo, length);
}
function hpkeDHKEMP256Encapsulate(recipient) {
  if (recipient.length !== p2562.lengths.publicKeyUncompressed) {
    recipient = p2562.Point.fromBytes(recipient).toBytes(false);
  }
  const ephemeral = p2562.utils.randomSecretKey();
  const encapsulatedKey = p2562.getPublicKey(ephemeral, false);
  const ss = p2562.getSharedSecret(ephemeral, recipient, true).subarray(1);
  const kemContext = new Uint8Array(encapsulatedKey.length + recipient.length);
  kemContext.set(encapsulatedKey, 0);
  kemContext.set(recipient, encapsulatedKey.length);
  const suiteID = new Uint8Array(5);
  suiteID.set(new TextEncoder().encode("KEM"), 0);
  suiteID[3] = hpkeDHKEMP256 >> 8;
  suiteID[4] = hpkeDHKEMP256 & 255;
  const eaePRK = hpkeLabeledExtract(suiteID, undefined, "eae_prk", ss);
  const sharedSecret = hpkeLabeledExpand(suiteID, eaePRK, "shared_secret", kemContext, 32);
  return { encapsulatedKey, sharedSecret };
}

class TagRecipient {
  recipient;
  constructor(s) {
    const res = bech32.decodeToBytes(s);
    if (!s.startsWith("age1tag1") || res.prefix.toLowerCase() !== "age1tag" || res.bytes.length !== 33) {
      throw Error("invalid recipient");
    }
    this.recipient = res.bytes;
  }
  wrapFileKey(fileKey) {
    const { encapsulatedKey, sharedSecret } = hpkeDHKEMP256Encapsulate(this.recipient);
    const label = new TextEncoder().encode("age-encryption.org/p256tag");
    const tag = (() => {
      const recipientHash = sha256(this.recipient).subarray(0, 4);
      const ikm = new Uint8Array(encapsulatedKey.length + recipientHash.length);
      ikm.set(encapsulatedKey, 0);
      ikm.set(recipientHash, encapsulatedKey.length);
      return extract(sha256, ikm, label).subarray(0, 4);
    })();
    const { key, nonce } = hpkeContext(hpkeDHKEMP256, sharedSecret, label);
    const ciphertext = chacha20poly1305(key, nonce).encrypt(fileKey);
    return [new Stanza(["p256tag", base64nopad.encode(tag), base64nopad.encode(encapsulatedKey)], ciphertext)];
  }
}

class HybridTagRecipient {
  recipient;
  constructor(s) {
    const { prefix, words } = bech32.decode(s, false);
    const bytes = bech32.fromWords(words);
    if (!s.startsWith("age1tagpq1") || prefix.toLowerCase() !== "age1tagpq" || bytes.length !== 1249) {
      throw Error("invalid recipient");
    }
    this.recipient = bytes;
  }
  wrapFileKey(fileKey) {
    const { cipherText: encapsulatedKey, sharedSecret } = MLKEM768P256.encapsulate(this.recipient);
    const label = new TextEncoder().encode("age-encryption.org/mlkem768p256tag");
    const tag = (() => {
      const recipientHash = sha256(this.recipient.subarray(1184)).subarray(0, 4);
      const ikm = new Uint8Array(encapsulatedKey.length + recipientHash.length);
      ikm.set(encapsulatedKey, 0);
      ikm.set(recipientHash, encapsulatedKey.length);
      return extract(sha256, ikm, label).subarray(0, 4);
    })();
    const { key, nonce } = hpkeContext(hpkeMLKEM768P256, sharedSecret, label);
    const ciphertext = chacha20poly1305(key, nonce).encrypt(fileKey);
    return [new Stanza(["mlkem768p256tag", base64nopad.encode(tag), base64nopad.encode(encapsulatedKey)], ciphertext)];
  }
}

class X25519Recipient {
  recipient;
  constructor(s) {
    const res = bech32.decodeToBytes(s);
    if (!s.startsWith("age1") || res.prefix.toLowerCase() !== "age" || res.bytes.length !== 32) {
      throw Error("invalid recipient");
    }
    this.recipient = res.bytes;
  }
  async wrapFileKey(fileKey) {
    const ephemeral = randomBytes(32);
    const share = await scalarMultBase(ephemeral);
    const secret = await scalarMult(ephemeral, this.recipient);
    const salt = new Uint8Array(share.length + this.recipient.length);
    salt.set(share);
    salt.set(this.recipient, share.length);
    const label = new TextEncoder().encode("age-encryption.org/v1/X25519");
    const key = hkdf(sha256, secret, salt, label, 32);
    return [new Stanza(["X25519", base64nopad.encode(share)], encryptFileKey(fileKey, key))];
  }
}
class ScryptRecipient {
  passphrase;
  logN;
  constructor(passphrase, logN) {
    this.passphrase = passphrase;
    this.logN = logN;
  }
  wrapFileKey(fileKey) {
    const salt = randomBytes(16);
    const label = "age-encryption.org/v1/scrypt";
    const labelAndSalt = new Uint8Array(label.length + 16);
    labelAndSalt.set(new TextEncoder().encode(label));
    labelAndSalt.set(salt, label.length);
    const key = scrypt(this.passphrase, labelAndSalt, { N: 2 ** this.logN, r: 8, p: 1, dkLen: 32 });
    return [new Stanza(["scrypt", base64nopad.encode(salt), this.logN.toString()], encryptFileKey(fileKey, key))];
  }
}
function encryptFileKey(fileKey, key) {
  const nonce = new Uint8Array(12);
  return chacha20poly1305(key, nonce).encrypt(fileKey);
}

// node_modules/age-encryption/dist/stream.js
var chacha20poly1305Overhead = 16;
var chunkSize = /* @__PURE__ */ (() => 64 * 1024)();
function encryptSTREAM(key) {
  const streamNonce = new Uint8Array(12);
  const incNonce = () => {
    for (let i = streamNonce.length - 2;i >= 0; i--) {
      streamNonce[i]++;
      if (streamNonce[i] !== 0)
        break;
    }
  };
  const plaintextBuffer = new Uint8Array(chunkSize);
  let plaintextBufferUsed = 0;
  return new TransformStream({
    transform(chunk, controller) {
      while (chunk.length > 0) {
        if (plaintextBufferUsed === plaintextBuffer.length) {
          const encryptedChunk = chacha20poly1305(key, streamNonce).encrypt(plaintextBuffer);
          controller.enqueue(encryptedChunk);
          incNonce();
          plaintextBufferUsed = 0;
        }
        const n = Math.min(plaintextBuffer.length - plaintextBufferUsed, chunk.length);
        plaintextBuffer.set(chunk.subarray(0, n), plaintextBufferUsed);
        plaintextBufferUsed += n;
        chunk = chunk.subarray(n);
      }
    },
    flush(controller) {
      streamNonce[11] = 1;
      const encryptedChunk = chacha20poly1305(key, streamNonce).encrypt(plaintextBuffer.subarray(0, plaintextBufferUsed));
      controller.enqueue(encryptedChunk);
    }
  });
}
function ciphertextSize(plaintextSize) {
  const chunks = Math.max(1, Math.ceil(plaintextSize / chunkSize));
  return plaintextSize + chacha20poly1305Overhead * chunks;
}

// node_modules/age-encryption/dist/armor.js
function encode(file) {
  const lines = [];
  lines.push(`-----BEGIN AGE ENCRYPTED FILE-----
`);
  for (let i = 0;i < file.length; i += 48) {
    let end = i + 48;
    if (end > file.length)
      end = file.length;
    lines.push(base64.encode(file.subarray(i, end)) + `
`);
  }
  lines.push(`-----END AGE ENCRYPTED FILE-----
`);
  return lines.join("");
}
// node_modules/age-encryption/dist/index.js
class Encrypter {
  passphrase = null;
  scryptWorkFactor = 18;
  recipients = [];
  setPassphrase(s) {
    if (this.passphrase !== null) {
      throw new Error("can encrypt to at most one passphrase");
    }
    if (this.recipients.length !== 0) {
      throw new Error("can't encrypt to both recipients and passphrases");
    }
    this.passphrase = s;
  }
  setScryptWorkFactor(logN) {
    this.scryptWorkFactor = logN;
  }
  addRecipient(s) {
    if (this.passphrase !== null) {
      throw new Error("can't encrypt to both recipients and passphrases");
    }
    if (typeof s === "string") {
      if (s.startsWith("age1pq1")) {
        this.recipients.push(new HybridRecipient(s));
      } else if (s.startsWith("age1tag1")) {
        this.recipients.push(new TagRecipient(s));
      } else if (s.startsWith("age1tagpq1")) {
        this.recipients.push(new HybridTagRecipient(s));
      } else if (s.startsWith("age1")) {
        this.recipients.push(new X25519Recipient(s));
      } else {
        throw new Error("unrecognized recipient type");
      }
    } else {
      this.recipients.push(s);
    }
  }
  async encrypt(file) {
    const fileKey = randomBytes(16);
    const stanzas = [];
    let recipients = this.recipients;
    if (this.passphrase !== null) {
      recipients = [new ScryptRecipient(this.passphrase, this.scryptWorkFactor)];
    }
    for (const recipient of recipients) {
      stanzas.push(...await recipient.wrapFileKey(fileKey));
    }
    const labelHeader = new TextEncoder().encode("header");
    const hmacKey = hkdf(sha256, fileKey, undefined, labelHeader, 32);
    const mac = hmac(sha256, hmacKey, encodeHeaderNoMAC(stanzas));
    const header = encodeHeader(stanzas, mac);
    const nonce = randomBytes(16);
    const labelPayload = new TextEncoder().encode("payload");
    const streamKey = hkdf(sha256, fileKey, nonce, labelPayload, 32);
    const encrypter = encryptSTREAM(streamKey);
    if (!(file instanceof ReadableStream)) {
      if (typeof file === "string")
        file = new TextEncoder().encode(file);
      return await readAll(prepend(stream(file).pipeThrough(encrypter), header, nonce));
    }
    return Object.assign(prepend(file.pipeThrough(encrypter), header, nonce), {
      size: (size) => ciphertextSize(size) + header.length + nonce.length
    });
  }
}

// src/core/seal.ts
var SSH_ED25519 = "ssh-ed25519";
var AGE_SSH_ED25519_LABEL = new TextEncoder().encode("age-encryption.org/v1/ssh-ed25519");
var KEY_TYPE_BYTES = new TextEncoder().encode(SSH_ED25519);
var BLOB_LENGTH = 4 + KEY_TYPE_BYTES.length + 4 + 32;
var ZERO_NONCE = new Uint8Array(12);
var decodeBlob = (encoded) => {
  let blob;
  try {
    blob = base64.decode(encoded);
  } catch {
    throw new Error("Not a valid SSH public key");
  }
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  const isValid = blob.length === BLOB_LENGTH && view.getUint32(0) === KEY_TYPE_BYTES.length && KEY_TYPE_BYTES.every((byte, index) => blob[4 + index] === byte) && view.getUint32(4 + KEY_TYPE_BYTES.length) === 32;
  if (!isValid)
    throw new Error("Not a valid SSH public key");
  try {
    ed25519.utils.toMontgomery(blob.slice(BLOB_LENGTH - 32));
  } catch {
    throw new Error("Not a valid SSH public key");
  }
  return blob;
};
var parseHostKey = (text) => {
  const [type, encoded] = text.trim().split(/\s+/);
  if (type !== SSH_ED25519)
    throw new Error("Only ssh-ed25519 host keys are supported");
  if (!encoded)
    throw new Error("Not a valid SSH public key");
  const blob = decodeBlob(encoded);
  return {
    line: `${SSH_ED25519} ${encoded}`,
    fingerprint: `SHA256:${base64nopad.encode(sha256(blob))}`
  };
};

class SshEd25519Recipient {
  #blob;
  #montgomeryKey;
  constructor(blob) {
    this.#blob = blob;
    this.#montgomeryKey = ed25519.utils.toMontgomery(blob.slice(BLOB_LENGTH - 32));
  }
  wrapFileKey(fileKey) {
    const ephemeral = x25519.utils.randomSecretKey();
    const ephemeralShare = x25519.getPublicKey(ephemeral);
    const tweak = hkdf(sha256, new Uint8Array(0), this.#blob, AGE_SSH_ED25519_LABEL, 32);
    const shared = x25519.getSharedSecret(tweak, x25519.getSharedSecret(ephemeral, this.#montgomeryKey));
    const salt = new Uint8Array([...ephemeralShare, ...this.#montgomeryKey]);
    const wrapKey = hkdf(sha256, shared, salt, AGE_SSH_ED25519_LABEL, 32);
    const body = chacha20poly1305(wrapKey, ZERO_NONCE).encrypt(fileKey);
    const tag = base64nopad.encode(sha256(this.#blob).slice(0, 4));
    return [new Stanza([SSH_ED25519, tag, base64nopad.encode(ephemeralShare)], body)];
  }
}
var sealSecret = async (secret, host) => {
  const [, encoded] = host.line.split(" ");
  const encrypter = new Encrypter;
  encrypter.addRecipient(new SshEd25519Recipient(decodeBlob(encoded ?? "")));
  const ciphertext = await encrypter.encrypt(`${encodeNsec(secret)}
`);
  return encode(ciphertext);
};

// src/core/messages.ts
var AGE_ARMOR_HEADER = "-----BEGIN AGE ENCRYPTED FILE-----";
var MAX_SEALED_BYTES = 4096;
var SECRET_MARKER = "nsec1";
var SLOT_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
var FENCE_PATTERN = new RegExp(`(?:^|\\n)\`\`\`${BLOCK_INFO}[ \\t]*\\r?\\n([\\s\\S]*?)\\r?\\n\`\`\``, "g");
var MAX_HOST_KEY_LENGTH = 512;
var MAX_LABEL_LENGTH = 80;
var MAX_NAME_LENGTH = 80;
var NO_CONTROL_PATTERN = /^[^\p{Cc}]*$/u;
var TITLE = "Self-hosted agents";
var isString = (value) => typeof value === "string";
var codePoints = (value) => [...value].length;
var isValidHostKey = (value) => {
  try {
    parseHostKey(value);
    return true;
  } catch {
    return false;
  }
};
var isWssUrl = (value) => {
  try {
    return new URL(value).protocol === "wss:";
  } catch {
    return false;
  }
};
var isSlotId = (value) => SLOT_PATTERN.test(value);
var isSlotLabel = (value) => codePoints(value) <= MAX_LABEL_LENGTH;
var isSlot = (value) => isString(value) && isSlotId(value);
var isPubkey = (value) => isString(value) && isHex64(value);
var isLabel = (value) => isString(value) && isSlotLabel(value);
var isName = (value) => isString(value) && codePoints(value) >= 1 && codePoints(value) <= MAX_NAME_LENGTH && NO_CONTROL_PATTERN.test(value);
var isHostKey = (value) => isString(value) && codePoints(value) <= MAX_HOST_KEY_LENGTH && isValidHostKey(value);
var isCommunity = (value) => isString(value) && isWssUrl(value);
var isAuth = (value) => parseNipOaTag(value) !== undefined;
var isSealed = (value) => isString(value) && value.startsWith(AGE_ARMOR_HEADER) && new TextEncoder().encode(value).length <= MAX_SEALED_BYTES;
var FIELDS = {
  "slot-offer": { slot: isSlot, label: isLabel, hostKey: isHostKey, community: isCommunity },
  "install-request": {
    slot: isSlot,
    pubkey: isPubkey,
    name: isName,
    auth: isAuth,
    sealed: isSealed
  },
  "retire-request": { slot: isSlot, pubkey: isPubkey },
  retired: { slot: isSlot, pubkey: isPubkey },
  installed: { slot: isSlot, pubkey: isPubkey }
};
var isBlockType = (value) => isString(value) && Object.hasOwn(FIELDS, value);
var toBlock = (value) => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return;
  const input = value;
  if (!Object.hasOwn(input, "v") || input.v !== 1)
    return;
  if (!Object.hasOwn(input, "type") || !isBlockType(input.type))
    return;
  const fields = FIELDS[input.type];
  for (const key of Object.keys(input)) {
    if (key !== "v" && key !== "type" && !Object.hasOwn(fields, key))
      return;
  }
  const block = { v: 1, type: input.type };
  for (const [key, check] of Object.entries(fields)) {
    if (!Object.hasOwn(input, key) || !check(input[key]))
      return;
    block[key] = input[key];
  }
  return block;
};
var shortKey = (pubkey) => pubkey.slice(0, 8);
var humanLine = (block) => {
  switch (block.type) {
    case "slot-offer":
      return `Server ${block.label} is ready for you (${TITLE}).`;
    case "install-request":
      return `Please install agent ${block.name} (${TITLE}).`;
    case "retire-request":
      return `Please retire agent ${shortKey(block.pubkey)} (${TITLE}).`;
    case "retired":
      return `Agent ${shortKey(block.pubkey)} has been retired.`;
    case "installed":
      return `Agent ${shortKey(block.pubkey)} has been installed.`;
  }
};
var singleLine = (text) => text.replace(/\s+/g, " ").trim();
var encodeBlock = (block) => {
  const json = JSON.stringify(block);
  if (json.includes(SECRET_MARKER))
    throw new Error("Refusing to send secret material");
  return `${singleLine(humanLine(block))}

\`\`\`${BLOCK_INFO}
${json}
\`\`\``;
};
var parseOne = (raw) => {
  if (raw.includes(SECRET_MARKER))
    return;
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return;
  }
  return toBlock(json);
};
var parseBlocks = (text) => Array.from(text.matchAll(FENCE_PATTERN), (match) => parseOne(match[1] ?? "")).filter((block) => block !== undefined);
var acceptBlock = (block, sender, ctx) => {
  const from = sender.toLowerCase();
  const operator = ctx.operator.toLowerCase();
  const viewer = ctx.viewer.toLowerCase();
  switch (block.type) {
    case "slot-offer":
    case "retired":
    case "installed":
      return from === operator;
    case "install-request":
    case "retire-request":
      return viewer === operator && from !== viewer;
  }
};

// src/core/store.ts
var operatorPubkey = (settings) => {
  const operator = settings.operator?.trim();
  if (!operator)
    return;
  if (isHex64(operator))
    return operator;
  try {
    return decodeNpub(operator);
  } catch {
    return;
  }
};
var NO_STATUS = "none";
var SECRET_PATTERN = /nsec1[02-9ac-hj-np-z]{20,}/i;
var STATUSES = new Set([
  "awaiting-install",
  "installed",
  "retire-requested",
  "retired"
]);
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var upsert = (list, item, same) => {
  const index = list.findIndex(same);
  return index < 0 ? [...list, item] : list.map((existing, i) => i === index ? item : existing);
};
var createStore = (storage, scope) => {
  const keyFor = (name) => `${STORAGE_PREFIX}${encodeURIComponent(scope.origin)}:${scope.viewer}:${name}`;
  const read = (name) => {
    try {
      const raw = storage.getItem(keyFor(name));
      return raw === null ? undefined : JSON.parse(raw);
    } catch {
      return;
    }
  };
  const write = (name, value) => {
    const serialized = JSON.stringify(value);
    if (SECRET_PATTERN.test(serialized)) {
      throw new Error("Refusing to store secret material");
    }
    storage.setItem(keyFor(name), serialized);
  };
  const readList = (name) => {
    const value = read(name);
    return Array.isArray(value) ? value.filter(isRecord) : [];
  };
  const readStatuses = () => {
    const value = read("status");
    if (!isRecord(value)) {
      return {};
    }
    const result = {};
    for (const [pubkey, status] of Object.entries(value)) {
      if (typeof status === "string" && STATUSES.has(status)) {
        result[pubkey] = status;
      }
    }
    return result;
  };
  const setStatus = (pubkey, status) => write("status", { ...readStatuses(), [pubkey]: status });
  const readPriors = () => {
    const value = read("prior-status");
    if (!isRecord(value))
      return {};
    const result = {};
    for (const [pubkey, prior] of Object.entries(value))
      if (prior === NO_STATUS || typeof prior === "string" && STATUSES.has(prior))
        result[pubkey] = prior;
    return result;
  };
  const withoutKey = (record, key) => Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
  return {
    settings: () => {
      const value = read("settings");
      if (!isRecord(value)) {
        return {};
      }
      const settings = {};
      if (typeof value.operator === "string") {
        settings.operator = value.operator;
      }
      if (typeof value.template === "string") {
        settings.template = value.template;
      }
      if (Array.isArray(value.owners)) {
        settings.owners = value.owners.filter((owner) => typeof owner === "string" && isHex64(owner));
      }
      return settings;
    },
    setSettings: (settings) => write("settings", settings),
    offers: () => readList("offers"),
    addOffer: (offer) => write("offers", upsert(readList("offers"), offer, (o) => o.slot === offer.slot)),
    pending: () => readList("pending"),
    putPending: (pending) => write("pending", upsert(readList("pending"), pending, (p) => p.slot === pending.slot)),
    pendingFor: (slot) => readList("pending").find((p) => p.slot === slot),
    deletePending: (pubkey) => write("pending", readList("pending").filter((p) => p.pubkey !== pubkey)),
    markInstalled: (pubkey) => setStatus(pubkey, "installed"),
    markRetired: (pubkey) => setStatus(pubkey, "retired"),
    isRetired: (pubkey) => readStatuses()[pubkey] === "retired",
    statusOf: (pubkey) => readStatuses()[pubkey],
    setStatus,
    requestRetire: (pubkey) => {
      write("prior-status", { ...readPriors(), [pubkey]: readStatuses()[pubkey] ?? NO_STATUS });
      setStatus(pubkey, "retire-requested");
    },
    cancelRetire: (pubkey) => {
      const statuses = readStatuses();
      if (statuses[pubkey] !== "retire-requested")
        return;
      const priors = readPriors();
      const prior = priors[pubkey] ?? "installed";
      write("status", prior === NO_STATUS ? withoutKey(statuses, pubkey) : { ...statuses, [pubkey]: prior });
      write("prior-status", withoutKey(priors, pubkey));
    },
    slots: () => readList("slots"),
    putSlot: (slot) => write("slots", upsert(readList("slots"), slot, (s) => s.slot === slot.slot)),
    requests: () => readList("requests"),
    addRequest: (request) => write("requests", upsert(readList("requests"), request, (r) => r.slot === request.slot && r.pubkey === request.pubkey)),
    putSlotRequest: (request) => write("requests", [
      ...readList("requests").filter((r) => r.slot !== request.slot),
      request
    ]),
    retireRequests: () => readList("retire-requests"),
    addRetireRequest: (request) => write("retire-requests", upsert(readList("retire-requests"), request, (r) => r.owner === request.owner && r.pubkey === request.pubkey))
  };
};

// src/core/template.ts
var PLACEHOLDER_PATTERN = /\{([a-z_]+)\}/g;
var shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
var renderTemplate = (template, vars) => template.replace(PLACEHOLDER_PATTERN, (_match, key) => {
  if (!Object.hasOwn(vars, key))
    throw new Error(`Unknown placeholder {${key}}`);
  return shellQuote(vars[key]);
});

// src/buzz/poll.ts
var POLL_INTERVAL_MS = 60000;
var createPoll = (read, what) => {
  let inFlight;
  const poll = () => {
    inFlight ??= read().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };
  return {
    poll,
    pollSafely: async () => {
      try {
        await poll();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Self-hosted agents: ${what} failed: ${message}`);
      }
    }
  };
};

// src/buzz/operator.ts
var BAD_OWNER = "Enter the owner as an npub";
var BAD_SLOT_ID = "The slot id may only use lowercase letters, digits and dashes";
var RESERVED_SLOT_ID = `The slot id "${ADOPTED_SLOT}" is reserved`;
var BAD_LABEL = "Give the server a label of at most 80 characters";
var ALREADY_OFFERED = "This server was already offered";
var BAD_IMPORT = 'Import must be a JSON list of {"slot", "label", "hostKey"} objects';
var UNKNOWN_REQUEST = "There is no open request for this agent";
var REQUESTABLE = new Set(["offered", "requested"]);
var ACTIVE = new Set(["offered", "requested", "installed"]);
var RETIRABLE = new Set(["requested", "installed"]);
var SAMPLE_VARS = {
  name: "name",
  slot: "slot",
  host: "host",
  relay: "relay",
  pubkey: "pubkey",
  npub: "npub",
  auth_tag: "auth_tag",
  file: "file"
};
var messageOf = (error) => error instanceof Error ? error.message : String(error);
var slotNamed = (store, slot) => store.slots().find((s) => s.slot === slot);
var deliver = async (relay, store, to, block) => {
  const { viewer } = await relay.ready();
  if (to !== viewer)
    return relay.sendBlock(to, block);
  if (block.type === "slot-offer")
    store.addOffer(block);
  else if (block.type === "retired")
    store.markRetired(block.pubkey);
  else {
    const status = store.statusOf(block.pubkey);
    if (status !== "retire-requested" && status !== "retired")
      store.markInstalled(block.pubkey);
  }
};
var checkSlotId = (slot) => {
  if (!isSlotId(slot))
    throw new Error(BAD_SLOT_ID);
  if (slot === ADOPTED_SLOT)
    throw new Error(RESERVED_SLOT_ID);
};
var checkLabel = (label) => {
  if (label === "" || !isSlotLabel(label))
    throw new Error(BAD_LABEL);
};
var offerSlot = async (relay, store, input) => {
  const slot = input.slot.trim();
  const label = input.label.trim();
  checkSlotId(slot);
  checkLabel(label);
  const host = parseHostKey(input.hostKeyText);
  let owner;
  try {
    owner = decodeNpub(input.owner.trim());
  } catch {
    throw new Error(BAD_OWNER);
  }
  const existing = slotNamed(store, slot);
  if (existing !== undefined && existing.state !== "open")
    throw new Error(ALREADY_OFFERED);
  const { community } = await relay.ready();
  store.putSlot({ slot, label, host, state: "open" });
  const offer = { v: 1, type: "slot-offer", slot, label, hostKey: host.line, community };
  await deliver(relay, store, owner, offer);
  store.putSlot({ slot, label, host, owner, state: "offered" });
};
var isRecord2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var importSlots = (text, existing = []) => {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(BAD_IMPORT);
  }
  if (!Array.isArray(parsed))
    throw new Error(BAD_IMPORT);
  const taken = new Set(existing.map((s) => s.slot));
  const seen = new Set;
  return parsed.map((item, index) => {
    if (!isRecord2(item) || typeof item.slot !== "string" || typeof item.label !== "string" || typeof item.hostKey !== "string")
      throw new Error(`Item ${index + 1}: ${BAD_IMPORT}`);
    const slot = item.slot.trim();
    const label = item.label.trim();
    try {
      checkSlotId(slot);
      checkLabel(label);
    } catch (error) {
      throw new Error(`Item ${index + 1}: ${messageOf(error)}`);
    }
    if (seen.has(slot))
      throw new Error(`Duplicate slot id "${slot}"`);
    if (taken.has(slot))
      throw new Error(`Slot "${slot}" already exists`);
    seen.add(slot);
    let host;
    try {
      host = parseHostKey(item.hostKey);
    } catch (error) {
      throw new Error(`Slot "${slot}": ${messageOf(error)}`);
    }
    return { slot, label, host, state: "open" };
  });
};
var handoff = (request, slot, relay, template) => {
  const { name, pubkey, auth } = request;
  const filename = `${slot.slot}.age`;
  const result = {
    filename,
    fileText: request.sealed,
    publicJson: JSON.stringify({ name, host: slot.label, relay, pubkey, auth_tag: auth }, null, 2)
  };
  if (template === undefined || template.trim() === "")
    return result;
  result.command = renderTemplate(template, {
    name,
    slot: slot.slot,
    host: slot.label,
    relay,
    pubkey,
    npub: encodeNpub(pubkey),
    auth_tag: JSON.stringify(auth),
    file: filename
  });
  return result;
};
var confirm = async (relay, store, kind, id) => {
  const { slot: slotId, pubkey, owner } = id;
  if (kind === "installed") {
    const request = store.requests().find((r) => r.slot === slotId && r.pubkey === pubkey);
    const slot = request === undefined ? undefined : slotNamed(store, slotId);
    if (slot?.owner !== owner || slot.state !== "requested")
      throw new Error(UNKNOWN_REQUEST);
    const block = { v: 1, type: "installed", slot: slotId, pubkey };
    await deliver(relay, store, owner, block);
    store.putSlot({ ...slot, state: "installed" });
    return;
  }
  const request = store.retireRequests().find((r) => r.slot === slotId && r.pubkey === pubkey && r.owner === owner && r.retired !== true);
  if (request === undefined)
    throw new Error(UNKNOWN_REQUEST);
  const block = { v: 1, type: "retired", slot: slotId, pubkey };
  if (slotId === ADOPTED_SLOT) {
    await deliver(relay, store, owner, block);
  } else {
    const slot = slotNamed(store, slotId);
    if (slot?.owner !== owner || !RETIRABLE.has(slot.state))
      throw new Error(UNKNOWN_REQUEST);
    await deliver(relay, store, owner, block);
    store.putSlot({ ...slot, state: "retired" });
  }
  store.addRetireRequest({ ...request, retired: true });
};
var offeredTo = (slot, owner) => slot !== undefined && slot.owner === owner;
var profileName = (profile) => {
  try {
    const content = JSON.parse(profile.content);
    if (typeof content !== "object" || content === null)
      return;
    const name = content.name;
    return typeof name === "string" && name.trim() !== "" ? name.trim() : undefined;
  } catch {
    return;
  }
};
var verifiedProfileOwner = (profile, pubkey) => profile !== undefined && profile.pubkey === pubkey && verifyEvent(profile) ? profileOwner(profile) : undefined;
var applyRequest = async (store, sender, block, context) => {
  if (block.type === "install-request") {
    if (store.requests().some((r) => r.pubkey === block.pubkey && r.slot === block.slot))
      return;
  } else if (store.retireRequests().some((r) => r.pubkey === block.pubkey && r.owner === sender))
    return;
  if (sender !== context.owner)
    return "not sent by this owner";
  const slot = slotNamed(store, block.slot);
  if (block.type === "install-request") {
    if (!verifyNipOa(block.auth, block.pubkey))
      return "owner proof does not verify";
    if (block.auth[1] !== sender)
      return "owner proof names someone else";
    const profileOwnerOf = verifiedProfileOwner(await context.readProfile(block.pubkey), block.pubkey);
    if (profileOwnerOf === undefined)
      return "agent profile missing or unverified";
    if (profileOwnerOf !== sender)
      return "agent is owned by someone else";
    if (!offeredTo(slot, sender) || !REQUESTABLE.has(slot.state))
      return "not a server offered to this owner";
    if (store.requests().some((r) => r.pubkey === block.pubkey && r.slot !== block.slot))
      return "agent already requested on another server";
    store.putSlotRequest(block);
    store.putSlot({ ...slot, state: "requested" });
    return;
  }
  if (block.slot === ADOPTED_SLOT) {
    const profile = await context.readProfile(block.pubkey);
    const owner = verifiedProfileOwner(profile, block.pubkey);
    if (owner === undefined)
      return "agent profile missing or unverified";
    if (owner !== sender)
      return "agent is owned by someone else";
    const name = profile === undefined ? undefined : profileName(profile);
    store.addRetireRequest({ ...block, owner: sender, ...name === undefined ? {} : { name } });
    return;
  }
  if (!offeredTo(slot, sender) || !RETIRABLE.has(slot.state))
    return "not a server offered to this owner";
  if (!store.requests().some((r) => r.pubkey === block.pubkey && r.slot === slot.slot))
    return "not an agent requested on this server";
  store.addRetireRequest({ ...block, owner: sender });
  return;
};
var applyOwnerBlocks = async (store, messages, context) => {
  const rejected = [];
  const accepted = messages.filter(({ sender, block }) => acceptBlock(block, sender, context));
  const newestInstall = new Map;
  for (const { block } of accepted)
    if (block.type === "install-request")
      newestInstall.set(block.slot, block);
  for (const { sender, block } of accepted) {
    if (block.type !== "install-request" && block.type !== "retire-request")
      continue;
    if (block.type === "install-request" && newestInstall.get(block.slot) !== block)
      continue;
    const reason = await applyRequest(store, sender, block, context);
    if (reason !== undefined)
      rejected.push({ type: block.type, slot: block.slot, pubkey: block.pubkey, reason });
  }
  return rejected;
};
var receiveOwnRequest = async (store, block, context) => {
  const reason = await applyRequest(store, context.viewer, block, {
    owner: context.viewer,
    readProfile: context.readProfile
  });
  if (reason !== undefined)
    throw new Error(`The request was refused: ${reason}`);
};
var npubOf = (pubkey) => pubkey === undefined ? "" : encodeNpub(pubkey);
var isOpenAdopted = (request) => request.slot === ADOPTED_SLOT && request.retired !== true;
var buildOperatorView = (store, community) => {
  const settings = store.settings();
  const template = settings.template ?? "";
  const slots = store.slots();
  const byId = new Map(slots.map((s) => [s.slot, s]));
  const installs = [];
  for (const request of store.requests()) {
    const slot = byId.get(request.slot);
    if (slot?.state !== "requested")
      continue;
    const row = {
      id: { slot: slot.slot, pubkey: request.pubkey, owner: slot.owner ?? "" },
      pubkey: request.pubkey,
      name: request.name,
      slot: slot.slot,
      label: slot.label,
      owner: npubOf(slot.owner)
    };
    try {
      installs.push({ ...row, handoff: handoff(request, slot, community, template) });
    } catch (error) {
      installs.push({
        ...row,
        handoff: handoff(request, slot, community),
        commandError: messageOf(error)
      });
    }
  }
  const retires = [];
  const retireRequests = store.retireRequests();
  for (const request of retireRequests) {
    const slot = request.slot === ADOPTED_SLOT ? undefined : byId.get(request.slot);
    if (slot === undefined || !RETIRABLE.has(slot.state) || request.retired === true)
      continue;
    retires.push({
      id: { slot: slot.slot, pubkey: request.pubkey, owner: request.owner },
      pubkey: request.pubkey,
      slot: slot.slot,
      label: slot.label,
      owner: npubOf(request.owner)
    });
  }
  return {
    template,
    owners: (settings.owners ?? []).map(encodeNpub),
    slots: slots.map((s) => ({
      slot: s.slot,
      label: s.label,
      fingerprint: s.host.fingerprint,
      owner: npubOf(s.owner),
      state: s.state
    })),
    installs,
    retires,
    adopted: retireRequests.filter(isOpenAdopted).map((request) => ({
      id: { slot: request.slot, pubkey: request.pubkey, owner: request.owner },
      pubkey: request.pubkey,
      name: request.name ?? encodeNpub(request.pubkey),
      owner: encodeNpub(request.owner)
    }))
  };
};
var createOperator = (deps) => {
  const listeners = new Set;
  const notify = () => {
    for (const listener of [...listeners])
      listener();
  };
  const warned = new Set;
  const open = async () => {
    const { origin, viewer, community } = await deps.relay.ready();
    const store = deps.storeFor({ origin, viewer });
    return { store, viewer, community, isOperator: operatorPubkey(store.settings()) === viewer };
  };
  const openAsOperator = async () => {
    const { store, isOperator } = await open();
    if (!isOperator)
      throw new Error("Only the operator can do this");
    return store;
  };
  const readOwners = async () => {
    let opened;
    try {
      opened = await open();
    } catch {
      return;
    }
    const { store, viewer, isOperator } = opened;
    if (!isOperator)
      return;
    const owners = new Set([
      ...store.slots().filter((s) => ACTIVE.has(s.state)).flatMap((s) => s.owner === undefined ? [] : [s.owner]),
      ...store.settings().owners ?? []
    ]);
    owners.delete(viewer);
    const failures = [];
    for (const owner of owners) {
      try {
        const messages = await deps.relay.readBlocks(owner);
        const context = {
          operator: viewer,
          viewer,
          owner,
          readProfile: (pubkey) => deps.relay.readProfile(pubkey)
        };
        for (const r of await applyOwnerBlocks(store, messages, context)) {
          const key = `${r.type}:${r.slot}:${r.pubkey}:${r.reason}`;
          if (warned.has(key))
            continue;
          warned.add(key);
          console.warn(`Self-hosted agents: ignored ${r.type} for slot ${r.slot}, agent ${r.pubkey}: ${r.reason}`);
        }
      } catch (error) {
        failures.push(messageOf(error));
      }
    }
    notify();
    if (failures.length > 0)
      throw new Error(failures.join("; "));
  };
  const { poll, pollSafely } = createPoll(readOwners, "reading owner messages");
  return {
    view: async () => {
      const { store, community, isOperator } = await open();
      return isOperator ? buildOperatorView(store, community) : undefined;
    },
    offer: async (input) => {
      const store = await openAsOperator();
      await offerSlot(deps.relay, store, input);
      notify();
    },
    offerOpen: async (slotId, owner) => {
      const store = await openAsOperator();
      const slot = slotNamed(store, slotId);
      if (slot?.state !== "open")
        throw new Error(ALREADY_OFFERED);
      await offerSlot(deps.relay, store, {
        slot: slot.slot,
        label: slot.label,
        hostKeyText: slot.host.line,
        owner
      });
      notify();
    },
    importSlots: async (text) => {
      const store = await openAsOperator();
      const slots = importSlots(text, store.slots());
      for (const slot of slots)
        store.putSlot(slot);
      notify();
      return slots.length;
    },
    saveOwners: async (text) => {
      const store = await openAsOperator();
      const owners = [];
      for (const token of text.split(/[\s,]+/).filter((t) => t !== "")) {
        let owner;
        try {
          owner = decodeNpub(token);
        } catch {
          throw new Error(`Not an npub: ${token}`);
        }
        if (!owners.includes(owner))
          owners.push(owner);
      }
      store.setSettings({ ...store.settings(), owners });
      notify();
    },
    saveTemplate: async (template) => {
      const store = await openAsOperator();
      renderTemplate(template, SAMPLE_VARS);
      store.setSettings({ ...store.settings(), template });
      notify();
    },
    confirm: async (kind, id) => {
      const store = await openAsOperator();
      await confirm(deps.relay, store, kind, id);
      notify();
    },
    poll,
    pollSafely,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    }
  };
};

// src/buzz/operator-visibility.ts
var isOperatorViewer = (snapshot, storeFor) => {
  const { origin, viewer } = snapshot;
  if (origin === undefined || viewer === undefined)
    return false;
  return operatorPubkey(storeFor({ origin, viewer }).settings()) === viewer;
};
var operatorCardVisibility = (deps) => ({
  snapshot: () => {
    try {
      return isOperatorViewer(deps.relay.snapshot(), deps.storeFor);
    } catch {
      return false;
    }
  },
  subscribe: (listener) => {
    const stopRelay = deps.relay.subscribe(listener);
    const stopOwner = deps.owner.subscribe(listener);
    return () => {
      stopRelay();
      stopOwner();
    };
  },
  ensure: () => () => {}
});

// src/buzz/owner.ts
var NO_OPERATOR = "Set the operator first";
var BAD_OPERATOR = "Enter the operator as an npub";
var NOT_RETIRABLE = "This agent cannot be retired from here";
var NO_RETIRE_REQUEST = "There is no retire request to cancel";
var STATUS_TEXT = {
  none: "Hosted on your server",
  "awaiting-install": "Waiting for installation",
  installed: "Installed by the operator",
  "retire-requested": "Waiting for the operator",
  retired: "Stopped by the operator — you can delete it now"
};
var TAB_STATUS_TEXT = {
  none: "Unknown — set up outside this device",
  "awaiting-install": "Waiting for installation",
  installed: "Installed",
  "retire-requested": "Retirement requested — waiting for the operator",
  retired: "Stopped by the operator — you can delete it now"
};
var operatorHex = (store) => operatorPubkey(store.settings());
var isRetiring = (status) => status === "retire-requested" || status === "retired";
var canRetire = (store, pubkey, status) => !isRetiring(status) && !(status === undefined && store.pending().some((p) => p.pubkey === pubkey));
var statusView = (store, pubkey, texts) => {
  const status = store.statusOf(pubkey);
  return {
    text: texts[status ?? "none"],
    canRetire: canRetire(store, pubkey, status),
    canCancelRetire: status === "retire-requested"
  };
};
var applyOperatorBlocks = (store, messages, context) => {
  for (const { sender, block } of messages) {
    if (!acceptBlock(block, sender, context))
      continue;
    switch (block.type) {
      case "slot-offer":
        if (block.community === context.community)
          store.addOffer(block);
        break;
      case "installed":
        if (!isRetiring(store.statusOf(block.pubkey)))
          store.markInstalled(block.pubkey);
        break;
      case "retired":
        store.markRetired(block.pubkey);
        break;
      default:
        break;
    }
  }
};
var isSent = (store, slot) => {
  const pending = store.pendingFor(slot);
  return pending !== undefined && store.statusOf(pending.pubkey) !== undefined;
};
var ourAgents = (agents) => agents.filter((agent) => agent.type === RUNTIME);
var buildOwnerView = (store, agents, community) => ({
  operator: store.settings().operator ?? "",
  offers: store.offers().filter((offer) => offer.community === community && !isSent(store, offer.slot)).map(({ slot, label }) => ({ slot, label })),
  agents: ourAgents(agents).map((agent) => {
    const { text, ...actions } = statusView(store, agent.pubkey, STATUS_TEXT);
    return { pubkey: agent.pubkey, name: agent.name, status: text, ...actions };
  })
});
var createOwner = (deps) => {
  const listeners = new Set;
  const notify = () => {
    for (const listener of [...listeners])
      listener();
  };
  const open = async () => {
    const { origin, viewer, community } = await deps.relay.ready();
    return { store: deps.storeFor({ origin, viewer }), viewer, community };
  };
  const readOperator = async () => {
    let opened;
    try {
      opened = await open();
    } catch {
      return;
    }
    const { store, viewer, community } = opened;
    const operator = operatorHex(store);
    if (operator === undefined || operator === viewer)
      return;
    const messages = await deps.relay.readBlocks(operator);
    applyOperatorBlocks(store, messages, { operator, viewer, community });
    notify();
  };
  const { poll, pollSafely } = createPoll(readOperator, "reading operator messages");
  return {
    view: async () => {
      const { store, community } = await open();
      return buildOwnerView(store, deps.agents.snapshot().agents, community);
    },
    saveOperator: async (input) => {
      const operator = input.trim();
      try {
        decodeNpub(operator);
      } catch {
        throw new Error(BAD_OPERATOR);
      }
      const { store } = await open();
      store.setSettings({ ...store.settings(), operator });
      notify();
    },
    agentStatus: async (pubkey) => {
      const { store } = await open();
      return statusView(store, pubkey, TAB_STATUS_TEXT);
    },
    retire: async (pubkey) => {
      const { store, viewer } = await open();
      const operator = operatorHex(store);
      if (operator === undefined)
        throw new Error(NO_OPERATOR);
      const ours = ourAgents(deps.agents.snapshot().agents).some((a) => a.pubkey === pubkey);
      if (!ours || !canRetire(store, pubkey, store.statusOf(pubkey)))
        throw new Error(NOT_RETIRABLE);
      const slot = store.pending().find((p) => p.pubkey === pubkey)?.slot ?? ADOPTED_SLOT;
      const request = { v: 1, type: "retire-request", slot, pubkey };
      if (operator === viewer)
        await receiveOwnRequest(store, request, {
          viewer,
          readProfile: (key) => deps.relay.readProfile(key)
        });
      else
        await deps.relay.sendBlock(operator, request);
      store.requestRetire(pubkey);
      notify();
    },
    cancelRetire: async (pubkey) => {
      const { store } = await open();
      if (store.statusOf(pubkey) !== "retire-requested")
        throw new Error(NO_RETIRE_REQUEST);
      store.cancelRetire(pubkey);
      notify();
    },
    poll,
    pollSafely,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    }
  };
};

// src/buzz/provider.ts
var TITLE2 = "Self-hosted agent";
var MAX_NAME_LENGTH2 = 80;
var NO_CONTROL_PATTERN2 = /^[^\p{Cc}]*$/u;
var MS_PER_SECOND2 = 1000;
var NO_OPERATOR2 = "Set the operator in Settings → Self-hosted agents first";
var NO_SLOT = "Choose a server offered to you for this community";
var SLOT_TAKEN = "This server is already being set up for another agent";
var SLOT_IN_USE = "This server already runs an agent";
var BAD_NAME = `Use a name of 1 to ${MAX_NAME_LENGTH2} characters`;
var BAD_AUTH = "Buzz did not return a valid owner proof for this agent";
var UNKNOWN_SETUP = "Unknown agent setup";
var PROFILE_HELD = "Change the name or avatar on the server; this agent's key is not held in Buzz";
var RETIRE_FIRST = "Retire this agent first, then delete it again";
var OTHER_COMMUNITY = "Switch to this agent's community in Buzz, then try again";
var RETIRING = "This agent is retired or being retired; it cannot be installed again";
var NOT_PUBLISHED = "The agent profile could not be published; retire this agent and try again";
var SETTING_UP = "This server is still being set up; wait for it to finish";
var SETUP_CHANGED = "The setup for this server changed while it was being created; try again";
var operatorOf = (store) => {
  const operator = store.settings().operator?.trim();
  if (!operator)
    throw new Error(NO_OPERATOR2);
  if (isHex64(operator))
    return operator;
  try {
    return decodeNpub(operator);
  } catch {
    throw new Error(NO_OPERATOR2);
  }
};
var slotOf = (config) => {
  if (typeof config !== "object" || config === null)
    return;
  const slot = config.slot;
  return typeof slot === "string" && slot !== "" ? slot : undefined;
};
var isValidName = (name) => name.length >= 1 && name.length <= MAX_NAME_LENGTH2 && NO_CONTROL_PATTERN2.test(name);
var withPicture = (picture) => picture === undefined ? {} : { picture };
var resultOf = (pending) => ({
  pubkey: pending.pubkey,
  ...withPicture(pending.picture)
});
var authOf = (pending) => parseNipOaTag(pending.profile.tags.find((tag) => tag[0] === "auth"));
var createProvider = (deps) => {
  const inFlight = new Map;
  const open = async () => {
    const { origin, viewer } = await deps.relay.ready();
    return { viewer, store: deps.storeFor({ origin, viewer }) };
  };
  const openFor = async (community, signal) => {
    const ready = await deps.relay.whenReady(signal);
    if (ready.community !== community)
      throw new Error(OTHER_COMMUNITY);
    return {
      viewer: ready.viewer,
      store: deps.storeFor({ origin: ready.origin, viewer: ready.viewer })
    };
  };
  const authorize = async (pubkey, viewer, signal) => {
    const tag = parseNipOaTag(await deps.host.prepareRemoteAgentAuthorization(pubkey, signal));
    if (tag === undefined || tag[1] !== viewer || !verifyNipOa(tag, pubkey)) {
      throw new Error(BAD_AUTH);
    }
    return tag;
  };
  const provisionOnce = async ({
    name,
    picture,
    community,
    config,
    signal
  }) => {
    signal.throwIfAborted();
    const { viewer, store } = await open();
    operatorOf(store);
    const slot = slotOf(config);
    const offer = store.offers().find((o) => o.slot === slot && o.community === community);
    if (slot === undefined || offer === undefined)
      throw new Error(NO_SLOT);
    const host = parseHostKey(offer.hostKey);
    const existing = store.pendingFor(slot);
    if (existing !== undefined) {
      if (existing.community !== community || existing.hostFingerprint !== host.fingerprint) {
        throw new Error(SLOT_TAKEN);
      }
      const status = store.statusOf(existing.pubkey);
      if (status !== undefined && status !== "awaiting-install")
        throw new Error(SLOT_IN_USE);
      const profile = await deps.relay.readProfile(existing.pubkey);
      if (profile !== undefined && profile.pubkey === existing.pubkey && verifyEvent(profile)) {
        return resultOf(existing);
      }
      if (status !== undefined)
        throw new Error(NOT_PUBLISHED);
    }
    if (!isValidName(name))
      throw new Error(BAD_NAME);
    if (existing !== undefined)
      store.deletePending(existing.pubkey);
    signal.throwIfAborted();
    const secret = generateSecretKey();
    try {
      const pubkey = publicKeyHex(secret);
      const auth = await authorize(pubkey, viewer, signal);
      signal.throwIfAborted();
      const profile = buildAgentProfile({
        secret,
        name,
        ...withPicture(picture),
        auth,
        createdAt: Math.floor(deps.now() / MS_PER_SECOND2)
      });
      const sealed = await sealSecret(secret, host);
      const pending = {
        slot,
        community,
        owner: viewer,
        hostFingerprint: host.fingerprint,
        pubkey,
        sealed,
        profile,
        name,
        ...withPicture(picture)
      };
      store.putPending(pending);
      await deps.publishAsAgent({ relay: community, secret, auth, event: profile, signal });
      if (store.pendingFor(slot)?.pubkey !== pubkey)
        throw new Error(SETUP_CHANGED);
      return resultOf(pending);
    } finally {
      secret.fill(0);
    }
  };
  return {
    provision: async (input) => {
      input.signal.throwIfAborted();
      const key = `${input.community}
${slotOf(input.config) ?? ""}`;
      const running = inFlight.get(key);
      if (running !== undefined) {
        if (running.name !== input.name)
          throw new Error(SETTING_UP);
        return running.result;
      }
      const result = provisionOnce(input);
      inFlight.set(key, { name: input.name, result });
      try {
        return await result;
      } finally {
        inFlight.delete(key);
      }
    },
    activate: async ({ pubkey, community, signal }) => {
      signal.throwIfAborted();
      const { viewer, store } = await openFor(community, signal);
      const pending = store.pending().find((p) => p.pubkey === pubkey);
      const auth = pending === undefined ? undefined : authOf(pending);
      if (pending === undefined || auth === undefined)
        throw new Error(UNKNOWN_SETUP);
      const status = store.statusOf(pubkey);
      if (status === "retire-requested" || status === "retired")
        throw new Error(RETIRING);
      const operator = operatorOf(store);
      const request = {
        v: 1,
        type: "install-request",
        slot: pending.slot,
        pubkey,
        name: pending.name,
        auth,
        sealed: pending.sealed
      };
      signal.throwIfAborted();
      if (operator === viewer) {
        await receiveOwnRequest(store, request, {
          viewer,
          readProfile: (key) => deps.relay.readProfile(key)
        });
        if (status === undefined)
          store.setStatus(pubkey, "awaiting-install");
        return;
      }
      if (status === undefined)
        store.setStatus(pubkey, "awaiting-install");
      await deps.relay.sendBlock(operator, request);
    },
    profile: async () => {
      throw new Error(PROFILE_HELD);
    },
    remove: async ({ pubkey, community, signal }) => {
      signal.throwIfAborted();
      const { store } = await openFor(community, signal);
      const unsent = store.statusOf(pubkey) === undefined && store.pending().some((p) => p.pubkey === pubkey);
      if (unsent) {
        store.deletePending(pubkey);
        return;
      }
      if (!store.isRetired(pubkey))
        throw new Error(RETIRE_FIRST);
    }
  };
};
var agentType = (deps) => ({
  id: TYPE_ID,
  title: TITLE2,
  defaults: () => ({ config: { slot: "" } }),
  summary: () => "Runs on your own server",
  ...deps.createConfiguration === undefined ? {} : { CreateConfiguration: deps.createConfiguration },
  remote: createProvider(deps)
});

// src/buzz/relay.ts
var AGENT_RECORD_KIND = 30177;
var PROFILE_KIND2 = 0;
var DM_MESSAGE_KIND = 9;
var RECORD_LIMIT = 500;
var PROFILE_LIMIT = 20;
var DM_LIMIT = 200;
var DM_OPEN_TIMEOUT_MS = 30000;
var AGENTS_LOADING = "Buzz is still loading agents, try again";
var NOT_CONNECTED = "Not connected to a community yet";
var READY_WAIT_MS = 5000;
var wssOf = (origin) => origin.replace(/\/+$/, "").replace(/^https:/, "wss:");
var isNewer = (candidate, current) => current === undefined || candidate.created_at > current.created_at || candidate.created_at === current.created_at && candidate.id > current.id;
var tagValue = (event, name) => event.tags.find((tag) => tag[0] === name)?.[1];
var toSigned = (event) => event.sig === undefined ? undefined : {
  id: event.id,
  pubkey: event.pubkey,
  created_at: event.created_at,
  kind: event.kind,
  tags: event.tags.map((tag) => [...tag]),
  content: event.content,
  sig: event.sig
};
var parseContent = (content) => {
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};
var isUndelivered = (event) => event.delivery === "failed" || event.delivery === "unknown";
var delivered = (outbox, id, failure) => new Promise((resolve, reject) => {
  let stop = () => {};
  const inspect = () => {
    const item = outbox.snapshot().find((entry) => entry.event.id === id);
    if (item === undefined || item.delivery === "accepted" || item.delivery === "seen") {
      stop();
      resolve();
    } else if (item.delivery !== "sending") {
      stop();
      reject(new Error(item.error ?? failure));
    }
  };
  stop = outbox.subscribe(inspect);
  inspect();
});
var createRelay = (ctx) => {
  const live = () => {
    const snapshot = ctx.relay.snapshot();
    if (snapshot.status !== "ready" || snapshot.cached === true || snapshot.origin === undefined || snapshot.viewer === undefined)
      throw new Error(NOT_CONNECTED);
    return { session: snapshot.session, origin: snapshot.origin, viewer: snapshot.viewer };
  };
  const readyNow = () => {
    const { origin, viewer } = live();
    return { origin, viewer, community: wssOf(origin) };
  };
  const isReady = () => {
    try {
      live();
      return true;
    } catch {
      return false;
    }
  };
  const openDirectMessage = async (session, pubkey) => {
    if (!isHex64(pubkey))
      throw new Error("Invalid public key");
    if (!session.directMessages.available)
      throw new Error("Direct messages are unavailable here");
    return session.directMessages.open([pubkey], AbortSignal.timeout(DM_OPEN_TIMEOUT_MS));
  };
  return {
    ready: async () => readyNow(),
    whenReady: (signal, timeoutMs = READY_WAIT_MS) => new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      if (isReady()) {
        resolve(readyNow());
        return;
      }
      let settled = false;
      let unsubscribe = () => {};
      const onAbort = () => {
        finish();
        reject(signal.reason);
      };
      const timer = setTimeout(() => {
        finish();
        reject(new Error(NOT_CONNECTED));
      }, timeoutMs);
      const finish = () => {
        settled = true;
        unsubscribe();
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
      };
      signal.addEventListener("abort", onAbort, { once: true });
      unsubscribe = ctx.relay.subscribe(() => {
        if (settled || !isReady())
          return;
        finish();
        resolve(readyNow());
      });
      if (settled)
        unsubscribe();
    }),
    readOwnRecords: async () => {
      try {
        const { session, viewer } = live();
        const events = await session.read([{ kinds: [AGENT_RECORD_KIND], authors: [viewer], limit: RECORD_LIMIT }], { fresh: true, priority: "foreground" });
        const newest = new Map;
        for (const event of events) {
          const d = tagValue(event, "d");
          if (event.kind !== AGENT_RECORD_KIND || event.pubkey !== viewer)
            continue;
          if (d === undefined || !isHex64(d) || isUndelivered(event))
            continue;
          if (isNewer(event, newest.get(d)))
            newest.set(d, event);
        }
        const records = new Map;
        for (const [d, event] of newest)
          records.set(d, {
            content: parseContent(event.content),
            tags: event.tags.map((tag) => [...tag])
          });
        return { ok: true, records };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    readProfile: async (pubkey) => {
      const { session } = live();
      const events = await session.read([{ kinds: [PROFILE_KIND2], authors: [pubkey], limit: PROFILE_LIMIT }], { fresh: true, priority: "foreground" });
      let head;
      for (const event of events)
        if (event.kind === PROFILE_KIND2 && event.pubkey === pubkey && isNewer(event, head))
          head = event;
      const signed = head === undefined ? undefined : toSigned(head);
      return signed !== undefined && verifyEvent(signed) ? signed : undefined;
    },
    publishRecord: async (record) => {
      const { session } = live();
      const outbox = session.outbox;
      if (outbox?.supports(AGENT_RECORD_KIND) !== true)
        throw new Error("This community cannot list agents.");
      await outbox.ready();
      const id = outbox.send({
        kind: AGENT_RECORD_KIND,
        content: JSON.stringify(record.content),
        tags: record.tags.map((tag) => [...tag])
      });
      await delivered(outbox, id, "The agent list was not updated. Retry.");
      await outbox.dismiss(id);
    },
    sendBlock: async (to, block) => {
      const text = encodeBlock(block);
      const { session } = live();
      const outbox = session.outbox;
      if (outbox === undefined)
        throw new Error("Sending is unavailable.");
      const channelId = await openDirectMessage(session, to);
      const id = session.messages.send(channelId, text);
      await delivered(outbox, id, "The message was not sent. Retry.");
      await outbox.dismiss(id);
    },
    readBlocks: async (withPubkey) => {
      const { session, viewer } = live();
      const channelId = await openDirectMessage(session, withPubkey);
      const events = await session.read([
        { kinds: [DM_MESSAGE_KIND], "#h": [channelId], limit: DM_LIMIT }
      ]);
      return events.filter((event) => event.kind === DM_MESSAGE_KIND && tagValue(event, "h") === channelId && (event.pubkey === viewer || event.pubkey === withPubkey)).sort((a, b) => a.created_at - b.created_at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).flatMap((event) => parseBlocks(event.content).map((block) => ({ sender: event.pubkey, block })));
    },
    isLocalIdentity: (pubkey) => {
      const snapshot = ctx.agents.snapshot();
      if (snapshot.status !== "ready")
        throw new Error(AGENTS_LOADING);
      return [...snapshot.agents, ...snapshot.running].some((agent) => agent.pubkey === pubkey && agent.place === "here");
    }
  };
};

// src/ui/styles.ts
var CARD = {
  padding: "var(--space-panel-inset)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-6)",
  color: "var(--text-standard)"
};
var SECTION = { display: "flex", flexDirection: "column", gap: "var(--space-3)" };
var HEADING = {
  margin: 0,
  fontSize: "var(--text-label)",
  fontWeight: "var(--type-weight-medium)",
  color: "var(--text-standard)"
};
var TEXT = { margin: 0, fontSize: "var(--text-body)" };
var HINT = {
  margin: 0,
  fontSize: "var(--text-body-sm)",
  color: "var(--text-subtle)"
};
var STATUS = {
  margin: 0,
  fontSize: "var(--text-body-sm)",
  color: "var(--text-subtle)"
};
var ERROR = {
  margin: 0,
  fontSize: "var(--text-body-sm)",
  color: "var(--text-danger)"
};
var FIELD = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
  flex: "1 1 14rem",
  minWidth: 0
};
var WIDE_FIELD = { ...FIELD, flex: "1 1 100%" };
var LABEL = { fontSize: "var(--text-body-sm)", color: "var(--text-standard)" };
var INPUT = {
  boxSizing: "border-box",
  width: "100%",
  minWidth: 0,
  border: "1px solid var(--border-standard)",
  borderRadius: "var(--radius-control)",
  padding: "var(--space-2) var(--space-3)",
  background: "var(--surface-inset)",
  color: "var(--text-standard)",
  font: "inherit",
  fontSize: "var(--text-body)"
};
var TEXTAREA = {
  ...INPUT,
  borderRadius: "var(--radius-row)",
  minHeight: "6rem",
  resize: "vertical",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-body-sm)"
};
var ROW = {
  display: "flex",
  gap: "var(--space-2)",
  alignItems: "center",
  flexWrap: "wrap"
};
var FIELD_ROW = { ...ROW, alignItems: "flex-start", gap: "var(--space-3)" };
var BUTTON = {
  border: "1px solid var(--border-standard)",
  borderRadius: "var(--radius-pill)",
  padding: "var(--space-1h) var(--space-4)",
  background: "var(--surface-panel)",
  color: "var(--text-standard)",
  font: "inherit",
  fontSize: "var(--text-body-sm)",
  fontWeight: "var(--type-weight-medium)",
  whiteSpace: "nowrap",
  cursor: "pointer"
};
var DISABLED_BUTTON = { ...BUTTON, opacity: 0.5, cursor: "default" };
var buttonStyle = (disabled) => disabled ? DISABLED_BUTTON : BUTTON;
var LIST = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
  textAlign: "start"
};
var LIST_ITEM = {
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "flex-start",
  textAlign: "start",
  gap: "var(--space-2)",
  padding: "var(--space-2) var(--space-3)",
  border: "1px solid var(--border-standard)",
  borderRadius: "var(--radius-row)"
};
var LIST_ROW = { ...LIST_ITEM, ...ROW, flexDirection: "row", alignItems: "center" };
var ROW_TEXT = {
  ...TEXT,
  flex: "1 1 auto",
  minWidth: 0,
  overflowWrap: "anywhere",
  textAlign: "start"
};
var TABLE_WRAP = { overflowX: "auto", maxWidth: "100%" };
var TABLE = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "var(--text-body-sm)"
};
var TH = {
  textAlign: "left",
  padding: "var(--space-1h) var(--space-2)",
  borderBottom: "1px solid var(--border-standard)",
  color: "var(--text-subtle)",
  fontWeight: "var(--type-weight-medium)",
  whiteSpace: "nowrap"
};
var TD = {
  padding: "var(--space-1h) var(--space-2)",
  borderBottom: "1px solid var(--border-standard)",
  verticalAlign: "middle",
  whiteSpace: "nowrap"
};
var TD_KEY = {
  ...TD,
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  minWidth: "10rem",
  maxWidth: "18rem"
};
var TD_OWNER_INPUT = { ...TD, minWidth: "32rem" };
var OWNER_INPUT = {
  ...INPUT,
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)"
};
var PRE = {
  margin: 0,
  padding: "var(--space-2) var(--space-3)",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  background: "var(--surface-inset)",
  borderRadius: "var(--radius-row)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)"
};
var NO_NOTICE = { text: "", error: false };
var noticeProps = (notice) => notice.error ? { role: "alert", style: ERROR } : { role: "status", style: STATUS };

// src/ui/CreateConfiguration.ts
var NO_OFFERS_TEXT = "No server is ready for you yet. Ask your operator.";
var LOADING_TEXT = "Looking for your servers…";
var ERROR_TEXT = "Could not read your servers: ";
var OfferList = (react, props) => {
  const h = react.createElement;
  if (props.offers.length === 0)
    return h("p", { style: HINT }, NO_OFFERS_TEXT);
  return h("div", { role: "radiogroup", "aria-label": "Server", style: SECTION }, ...props.offers.map((offer) => h("label", { key: offer.slot, style: { ...ROW, flexWrap: "nowrap", cursor: "pointer" } }, h("input", {
    type: "radio",
    name: "selfhosted-agents-slot",
    value: offer.slot,
    checked: props.slot === offer.slot,
    disabled: props.disabled,
    onChange: () => props.onChoose(offer.slot)
  }), h("span", { style: TEXT }, `${offer.label} (${offer.slot})`))));
};
var isReady = (offers, slot) => offers.some((offer) => offer.slot === slot);
var messageOf2 = (error) => error instanceof Error ? error.message : String(error);
var createConfiguration = (deps) => function CreateConfiguration(props) {
  const { react, owner } = deps;
  const h = react.createElement;
  const [offers, setOffers] = react.useState(undefined);
  const [error, setError] = react.useState("");
  const { onReadyChange } = props;
  react.useEffect(() => {
    let live = true;
    owner.view().then((view) => {
      if (live)
        setOffers(view.offers);
    }, (failure) => {
      if (live)
        setError(messageOf2(failure));
    });
    return () => {
      live = false;
    };
  }, []);
  const ready = offers !== undefined && isReady(offers, props.config.slot);
  react.useEffect(() => {
    onReadyChange?.(ready);
    return;
  }, [onReadyChange, ready]);
  const list = error !== "" ? h("p", { role: "alert", style: ERROR }, `${ERROR_TEXT}${error}`) : offers === undefined ? h("p", { style: HINT }, LOADING_TEXT) : OfferList(react, {
    offers,
    slot: props.config.slot,
    disabled: props.disabled,
    onChoose: (slot) => props.onChange({ slot })
  });
  return h("div", { style: SECTION }, props.harnessControl, list);
};

// src/ui/OperatorCard.ts
var TEMPLATE_HELP = "Placeholders: {name}, {slot}, {host}, {relay}, {pubkey}, {npub}, {auth_tag}, {file}. " + "{host} = the slot's server label, {relay} = the community relay URL. " + "Do not put quotes around placeholders; values are shell-quoted automatically.";
var OperatorPanel = (react, props) => {
  const h = react.createElement;
  const { view, busy, drafts } = props;
  const draft = (key, fallback = "") => drafts[key] ?? fallback;
  const input = (key, placeholder, extra = {}) => h("input", {
    type: "text",
    value: draft(key),
    placeholder,
    spellCheck: false,
    style: INPUT,
    onChange: (event) => props.onDraft(key, event.target.value),
    ...extra
  });
  const field = (key, label, placeholder, wide = false) => h("label", { style: wide ? WIDE_FIELD : FIELD }, h("span", { style: LABEL }, label), input(key, placeholder));
  const area = (key, label, placeholder, fallback = "") => h("label", { style: WIDE_FIELD }, h("span", { style: LABEL }, label), h("textarea", {
    value: draft(key, fallback),
    placeholder,
    rows: 3,
    spellCheck: false,
    style: TEXTAREA,
    onChange: (event) => props.onDraft(key, event.target.value)
  }));
  const button = (label, onClick) => h("button", { type: "button", disabled: busy, onClick, style: buttonStyle(busy) }, label);
  const actions = (...children) => h("div", { style: ROW }, ...children);
  const heading = (text) => h("h3", { style: HEADING }, text);
  const hint = (text) => h("p", { style: HINT }, text);
  const slotsTable = h("div", { style: TABLE_WRAP }, h("table", { style: TABLE }, h("thead", null, h("tr", null, ...["Server", "Slot", "Host key", "Owner", "State", ""].map((title) => h("th", { key: title, style: TH }, title)))), h("tbody", null, ...view.slots.map((slot) => h("tr", { key: slot.slot }, h("td", { style: TD }, slot.label), h("td", { style: TD }, slot.slot), h("td", { style: TD_KEY }, slot.fingerprint), slot.state === "open" ? h("td", { style: TD_OWNER_INPUT }, input(`offer.${slot.slot}`, "npub1…", {
    "aria-label": `Owner npub for ${slot.slot}`,
    style: OWNER_INPUT
  })) : h("td", { style: TD_KEY }, slot.owner), h("td", { style: TD }, slot.state), h("td", { style: TD }, slot.state === "open" ? button("Offer", () => props.onOfferOpen(slot.slot, draft(`offer.${slot.slot}`))) : null))))));
  const slotsSection = h("div", { style: SECTION }, heading("Servers"), view.slots.length === 0 ? hint("No servers yet. Add one below or import a list.") : slotsTable, actions(button("Check now", props.onCheck)));
  const addSection = h("div", { style: SECTION }, heading("Offer a server"), hint("Take the host key from your provisioning tool, or from ssh-keyscan checked against a " + "known fingerprint. Only ssh-ed25519 keys are accepted."), h("div", { style: FIELD_ROW }, field("add.slot", "Slot id", "vps-1"), field("add.label", "Server label", "My server"), field("add.owner", "Owner npub", "npub1…", true), area("add.hostKey", "SSH host public key", "ssh-ed25519 AAAA…")), actions(button("Offer", () => props.onOffer({
    slot: draft("add.slot"),
    label: draft("add.label"),
    hostKeyText: draft("add.hostKey"),
    owner: draft("add.owner")
  }))));
  const importSection = h("div", { style: SECTION }, heading("Import servers"), hint('A JSON list of {"slot", "label", "hostKey"}; offer each one above.'), area("import", "Servers as JSON", '[{"slot": "vps-1", "label": "…", "hostKey": "ssh-ed25519 …"}]'), actions(button("Import", () => props.onImport(draft("import")))));
  const installsSection = h("div", { style: SECTION }, heading("Install requests"), view.installs.length === 0 ? hint("No open install requests.") : h("ul", { style: LIST }, ...view.installs.map((install) => h("li", { key: install.pubkey, style: LIST_ITEM }, h("p", { style: { ...TEXT, overflowWrap: "anywhere" } }, `${install.name} on ${install.label} (${install.slot}) for ${install.owner}`), actions(button(`Download ${install.handoff.filename}`, () => props.onDownload(install.handoff)), button("Copy public data", () => props.onCopy(install.handoff.publicJson, "Public data")), install.handoff.command === undefined ? null : button("Copy command", () => props.onCopy(install.handoff.command ?? "", "Command")), button("Installed", () => props.onConfirm("installed", install.id))), install.handoff.command === undefined ? null : h("pre", { style: PRE }, install.handoff.command), install.commandError === undefined ? null : h("p", { role: "alert", style: ERROR }, `Command template: ${install.commandError}`)))));
  const retireRow = (id, text) => h("li", { key: `${id.slot}:${id.pubkey}`, style: LIST_ROW }, h("span", { style: ROW_TEXT }, text), button("Retired", () => props.onConfirm("retired", id)));
  const noRetires = view.retires.length === 0 && view.adopted.length === 0;
  const retiresSection = h("div", { style: SECTION }, heading("Retire requests"), noRetires ? hint("No open retire requests.") : h("ul", { style: LIST }, ...view.retires.map((retire) => retireRow(retire.id, `Agent ${retire.pubkey.slice(0, 8)} on ${retire.label} (${retire.slot}) for ${retire.owner}`)), ...view.adopted.map((retire) => retireRow(retire.id, `Existing agent ${retire.name} — owner ${retire.owner}`))));
  const ownersSection = h("div", { style: SECTION }, heading("Known owners"), hint("Owners whose existing agents you run. Their messages are read even without a server " + "offered here, so they can ask you to retire an agent. One npub per line."), area("owners", "Known owners", "npub1…", view.owners.join(`
`)), actions(button("Save owners", () => props.onSaveOwners(draft("owners", view.owners.join(`
`))))));
  const templateSection = h("div", { style: SECTION }, heading("Command template"), hint(TEMPLATE_HELP), area("template", "Command template", "./deploy-agent {host} {file} {pubkey}", view.template), actions(button("Save template", () => props.onSaveTemplate(draft("template", view.template)))));
  return h("section", { className: "ui-card", style: CARD }, props.notice.text === "" ? null : h("p", noticeProps(props.notice), props.notice.text), slotsSection, addSection, importSection, installsSection, retiresSection, ownersSection, templateSection);
};
var downloadFile = (filename, text, env = globalThis) => {
  const url = env.URL.createObjectURL(new Blob([text], { type: "application/octet-stream" }));
  const anchor = env.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  env.document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    env.URL.revokeObjectURL(url);
  }
};
var messageOf3 = (error) => error instanceof Error ? error.message : String(error);
var operatorCard = (deps) => function OperatorCard(props) {
  const { react, operator } = deps;
  const [view, setView] = react.useState(undefined);
  const [drafts, setDrafts] = react.useState({});
  const [notice, setNotice] = react.useState(NO_NOTICE);
  const [busy, setBusy] = react.useState(false);
  react.useEffect(() => {
    let live = true;
    const refresh = () => {
      operator.view().then((next) => {
        if (live)
          setView(next);
      }, () => {
        if (live)
          setView(undefined);
      });
    };
    refresh();
    const stop = operator.subscribe(refresh);
    operator.pollSafely();
    return () => {
      live = false;
      stop();
    };
  }, []);
  if (view === undefined)
    return null;
  const run = (action) => {
    if (busy || !props.active())
      return;
    setBusy(true);
    setNotice(NO_NOTICE);
    action().then((done) => {
      setNotice({ text: done, error: false });
      setBusy(false);
    }, (error) => {
      setNotice({ text: messageOf3(error), error: true });
      setBusy(false);
    });
  };
  const clearDrafts = (...keys) => setDrafts((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => !keys.includes(key))));
  return OperatorPanel(react, {
    view,
    busy,
    notice,
    drafts,
    onDraft: (key, value) => setDrafts((previous) => ({ ...previous, [key]: value })),
    onOffer: (input) => run(async () => {
      await operator.offer(input);
      clearDrafts("add.slot", "add.label", "add.hostKey", "add.owner");
      return `Offered ${input.slot} to the owner.`;
    }),
    onOfferOpen: (slot, owner) => run(async () => {
      await operator.offerOpen(slot, owner);
      clearDrafts(`offer.${slot}`);
      return `Offered ${slot} to the owner.`;
    }),
    onImport: (text) => run(async () => {
      const count = await operator.importSlots(text);
      clearDrafts("import");
      return `Imported ${count} server${count === 1 ? "" : "s"}.`;
    }),
    onSaveOwners: (text) => run(async () => {
      await operator.saveOwners(text);
      clearDrafts("owners");
      return "Known owners saved.";
    }),
    onSaveTemplate: (template) => run(async () => {
      await operator.saveTemplate(template);
      clearDrafts("template");
      return "Template saved.";
    }),
    onDownload: (handoff) => {
      try {
        downloadFile(handoff.filename, handoff.fileText);
      } catch (error) {
        setNotice({ text: messageOf3(error), error: true });
      }
    },
    onCopy: (text, what) => run(async () => {
      await globalThis.navigator.clipboard.writeText(text);
      return `${what} copied.`;
    }),
    onConfirm: (kind, id) => run(async () => {
      await operator.confirm(kind, id);
      return kind === "installed" ? "Told the owner it is installed." : "Told the owner it is retired.";
    }),
    onCheck: () => run(async () => {
      await operator.poll();
      return "Checked for messages from owners.";
    })
  });
};

// src/buzz/adopt.ts
var NOT_FOUND = "This agent has no record in this community";
var REFUSALS = {
  "unverified-owner": "Cannot verify that you own this agent",
  "local-key": "This agent's key is held in this Buzz; it cannot be brought in",
  "other-runtime": "Another runtime manages this agent",
  already: "This agent is already a self-hosted agent"
};
var messageOf4 = (error) => error instanceof Error ? error.message : String(error);
var nameOf = (record) => {
  const name = record.content.name;
  return typeof name === "string" ? name : "";
};
var stateOf = async (relay, viewer, pubkey, record) => {
  const runtime = recordRuntime(record.tags) || undefined;
  if (runtime === RUNTIME)
    return "already";
  if (relay.isLocalIdentity(pubkey))
    return "local-key";
  if (nameOf(record).trim() === "")
    return "unverified-owner";
  const profile = await relay.readProfile(pubkey);
  if (profile === undefined || !verifyEvent(profile) || profileOwner(profile) !== viewer)
    return "unverified-owner";
  return runtime === undefined ? "ready" : "other-runtime";
};
var itemOf = async (relay, viewer, pubkey, record) => {
  const state = await stateOf(relay, viewer, pubkey, record);
  const runtime = recordRuntime(record.tags);
  return {
    pubkey,
    name: nameOf(record).trim(),
    state,
    ...state === "other-runtime" && runtime !== undefined ? { runtime } : {}
  };
};
var findAdoptable = async (relay) => {
  try {
    const { viewer } = await relay.ready();
    const read = await relay.readOwnRecords();
    if (!read.ok)
      return read;
    const items = [];
    for (const [pubkey, record] of read.records)
      items.push(await itemOf(relay, viewer, pubkey, record));
    return { ok: true, items };
  } catch (error) {
    return { ok: false, error: messageOf4(error) };
  }
};
var adopt = async (relay, pubkey, options = {}) => {
  const { viewer } = await relay.ready();
  const read = await relay.readOwnRecords();
  if (!read.ok)
    throw new Error(read.error);
  const prior = read.records.get(pubkey);
  if (prior === undefined)
    throw new Error(NOT_FOUND);
  const state = await stateOf(relay, viewer, pubkey, prior);
  const takingOver = state === "other-runtime" && options.takeOver === true;
  if (state !== "ready" && !takingOver)
    throw new Error(REFUSALS[state]);
  const picture = prior.content.picture;
  await relay.publishRecord(mergeAgentRecord(prior, {
    pubkey,
    name: nameOf(prior),
    ...typeof picture === "string" ? { picture } : {}
  }));
};

// src/ui/OwnerCard.ts
var ADOPT_STATE_TEXT = {
  ready: "Can be brought into Buzz",
  "unverified-owner": "Cannot verify owner",
  "local-key": "Its key is held in this Buzz",
  "other-runtime": "Managed by another runtime",
  already: "Already a self-hosted agent"
};
var TAKE_OVER_WARNING = "Take it over only if it runs on your own server and no other Buzz runs it; " + "that runtime then no longer manages it.";
var ADOPTED_NOTICE = "It appears on the Agents page after Buzz reconnects or restarts.";
var messageOf5 = (error) => error instanceof Error ? error.message : String(error);
var shortNpub = (pubkey) => `${encodeNpub(pubkey).slice(0, 16)}…`;
var ownerCard = (deps) => function OwnerCard(props) {
  const { react, owner, relay } = deps;
  const h = react.createElement;
  const [view, setView] = react.useState(undefined);
  const [viewError, setViewError] = react.useState("");
  const [operatorDraft, setOperatorDraft] = react.useState(undefined);
  const [notice, setNotice] = react.useState(NO_NOTICE);
  const [busy, setBusy] = react.useState(false);
  const [adoptables, setAdoptables] = react.useState(undefined);
  const [takeOver, setTakeOver] = react.useState(undefined);
  react.useEffect(() => {
    let live = true;
    const refresh = () => {
      owner.view().then((next) => {
        if (!live)
          return;
        setView(next);
        setViewError("");
      }, (error) => {
        if (live)
          setViewError(messageOf5(error));
      });
    };
    refresh();
    const stopOwner = owner.subscribe(refresh);
    const stopAgents = deps.agents.subscribe(refresh);
    owner.pollSafely();
    return () => {
      live = false;
      stopOwner();
      stopAgents();
    };
  }, []);
  const loadAdoptables = () => {
    setAdoptables(undefined);
    findAdoptable(relay).then(setAdoptables, (error) => setAdoptables({ ok: false, error: messageOf5(error) }));
  };
  react.useEffect(() => {
    loadAdoptables();
    return;
  }, []);
  const run = (action) => {
    if (busy || !props.active())
      return;
    setBusy(true);
    setNotice(NO_NOTICE);
    action().then((done) => {
      setNotice({ text: done, error: false });
      setBusy(false);
    }, (error) => {
      setNotice({ text: messageOf5(error), error: true });
      setBusy(false);
    });
  };
  const button = (label, onClick) => h("button", { type: "button", disabled: busy, onClick, style: buttonStyle(busy) }, label);
  const heading = (text) => h("h3", { style: HEADING }, text);
  const hint = (text) => h("p", { style: HINT }, text);
  const item = (key, text, ...actions) => h("li", { key, style: LIST_ROW }, h("span", { style: ROW_TEXT }, text), ...actions);
  const operatorValue = operatorDraft ?? view?.operator ?? "";
  const operatorSection = h("div", { style: SECTION }, heading("Operator"), hint("The Buzz account that runs your servers. Paste their npub."), h("label", { style: WIDE_FIELD }, h("span", { style: LABEL }, "Operator npub"), h("input", {
    type: "text",
    value: operatorValue,
    placeholder: "npub1…",
    spellCheck: false,
    style: INPUT,
    onChange: (event) => setOperatorDraft(event.target.value)
  })), h("div", { style: ROW }, button("Save", () => run(async () => {
    await owner.saveOperator(operatorValue);
    setOperatorDraft(undefined);
    return "Operator saved.";
  }))));
  const offers = view?.offers ?? [];
  const offersSection = h("div", { style: SECTION }, heading("Servers offered to you"), offers.length === 0 ? hint("No servers offered yet.") : h("ul", { style: LIST }, ...offers.map((offer) => item(offer.slot, `${offer.label} (${offer.slot}) — use it in New agent → Self-hosted agent.`))), h("div", { style: ROW }, button("Check now", () => run(async () => {
    await owner.poll();
    return "Checked for messages from the operator.";
  }))));
  const agents = view?.agents ?? [];
  const agentsSection = h("div", { style: SECTION }, heading("Your self-hosted agents"), agents.length === 0 ? hint("None in this community.") : h("ul", { style: LIST }, ...agents.map((agent) => item(agent.pubkey, `${agent.name || shortNpub(agent.pubkey)} — ${agent.status}`, agent.canRetire ? button("Retire", () => run(async () => {
    await owner.retire(agent.pubkey);
    return "Asked the operator to retire the agent.";
  })) : null, agent.canCancelRetire ? button("Cancel retire request", () => run(async () => {
    await owner.cancelRetire(agent.pubkey);
    return "Retire request cancelled.";
  })) : null))));
  const adoptList = adoptables === undefined ? hint("Looking for your agents…") : !adoptables.ok ? h("p", { role: "alert", style: ERROR }, `Could not read your agents: ${adoptables.error}`) : adoptables.items.length === 0 ? hint("You have no agents in this community.") : h("ul", { style: LIST }, ...adoptables.items.map((adoptable) => {
    const label = adoptable.name || shortNpub(adoptable.pubkey);
    const bringIn = (options) => run(async () => {
      await adopt(relay, adoptable.pubkey, options);
      setTakeOver(undefined);
      loadAdoptables();
      return ADOPTED_NOTICE;
    });
    if (adoptable.state === "ready")
      return item(adoptable.pubkey, `${label} — ${ADOPT_STATE_TEXT.ready}`, button("Bring into Buzz", () => bringIn({})));
    if (adoptable.state !== "other-runtime")
      return item(adoptable.pubkey, `${label} — ${ADOPT_STATE_TEXT[adoptable.state]}`);
    const managed = `${label} — Managed by ${adoptable.runtime ?? "another runtime"}`;
    return takeOver === adoptable.pubkey ? item(adoptable.pubkey, `${managed}. ${TAKE_OVER_WARNING}`, button("Confirm take over", () => bringIn({ takeOver: true })), button("Cancel", () => setTakeOver(undefined))) : item(adoptable.pubkey, managed, button("Take over", () => setTakeOver(adoptable.pubkey)));
  }));
  const adoptSection = h("div", { style: SECTION }, heading("Bring into Buzz"), hint("Agents you already run elsewhere and own can be listed here as hosted."), adoptList, h("div", { style: ROW }, button("Refresh", loadAdoptables)));
  return h("section", { className: "ui-card", style: CARD }, viewError === "" ? null : h("p", { role: "alert", style: ERROR }, viewError), notice.text === "" ? null : h("p", noticeProps(notice), notice.text), operatorSection, offersSection, agentsSection, adoptSection);
};

// src/ui/StatusTab.ts
var LOADING_TEXT2 = "Checking the server…";
var StatusView = (react, props) => {
  const h = react.createElement;
  const button = (label, onClick) => h("button", { type: "button", disabled: props.busy, onClick, style: buttonStyle(props.busy) }, label);
  const canRetire = props.status?.canRetire === true;
  const canCancelRetire = props.status?.canCancelRetire === true;
  return h("section", { style: CARD }, h("p", { style: TEXT }, props.status?.text ?? LOADING_TEXT2), canRetire || canCancelRetire ? h("div", { style: ROW }, canRetire ? button("Retire", props.onRetire) : null, canCancelRetire ? button("Cancel retire request", props.onCancelRetire) : null) : null, props.notice === "" ? null : h("p", { role: "alert", style: ERROR }, props.notice));
};
var messageOf6 = (error) => error instanceof Error ? error.message : String(error);
var statusTab = (deps) => {
  const { react, owner } = deps;
  return {
    id: "status",
    title: "Server",
    when: (agent) => agent.type === RUNTIME,
    component: function StatusTab(props) {
      const { pubkey } = props.agent;
      const [status, setStatus] = react.useState(undefined);
      const [busy, setBusy] = react.useState(false);
      const [notice, setNotice] = react.useState("");
      react.useEffect(() => {
        let live = true;
        const refresh = () => {
          owner.agentStatus(pubkey).then((next) => {
            if (live)
              setStatus(next);
          }, (error) => {
            if (live)
              setNotice(messageOf6(error));
          });
        };
        refresh();
        const stop = owner.subscribe(refresh);
        return () => {
          live = false;
          stop();
        };
      }, [pubkey]);
      const run = (action) => {
        if (busy)
          return;
        setBusy(true);
        setNotice("");
        action(pubkey).then(() => setBusy(false), (error) => {
          setNotice(messageOf6(error));
          setBusy(false);
        });
      };
      return StatusView(react, {
        status,
        busy,
        notice,
        onRetire: () => run((key) => owner.retire(key)),
        onCancelRetire: () => run((key) => owner.cancelRetire(key))
      });
    }
  };
};

// src/plugin.ts
var OPERATOR_CARD_TITLE = "Agent servers";
var inject = ["react", "agents", "relay", "host", "settingsCards"];
function apply(ctx) {
  const relay = createRelay(ctx);
  const storeFor = (scope) => createStore(globalThis.localStorage, scope);
  const owner = createOwner({ relay, storeFor, agents: ctx.agents });
  const operator = createOperator({ relay, storeFor });
  ctx.agents.register(agentType({
    relay,
    storeFor,
    host: ctx.host,
    now: () => Date.now(),
    publishAsAgent,
    createConfiguration: createConfiguration({ react: ctx.react, owner })
  }));
  ctx.agents.registerTab(statusTab({ react: ctx.react, owner }));
  ctx.effect(() => {
    const timer = setInterval(() => {
      owner.pollSafely();
      operator.pollSafely();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  });
  ctx.settingsCards.register({
    id: "owner",
    title: "Self-hosted agents",
    component: ownerCard({ react: ctx.react, owner, relay, agents: ctx.agents })
  });
  ctx.settingsCards.register({
    id: "operator",
    title: OPERATOR_CARD_TITLE,
    component: operatorCard({ react: ctx.react, operator }),
    visibility: operatorCardVisibility({ relay: ctx.relay, owner, storeFor })
  });
}
export {
  apply,
  inject
};
