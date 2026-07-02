// ============================================================
// REFERENCE FILE — for understanding only, not part of LPS.
// Safe to run standalone. Uses a throwaway key, not your real one.
// Run with: node this-file.mjs
// ============================================================

import { generateKeyPairSync, createSign, createVerify } from 'crypto';

// ------------------------------------------------------------
// TERM 1 — "P-256" / "prime256v1"
// ------------------------------------------------------------
// This is the elliptic curve. Think of it as the specific
// mathematical "shape" of math problem your keys are built on.
// ECDSA (Elliptic Curve Digital Signature Algorithm) is the
// signing METHOD. P-256 is the specific curve variant that
// method runs on. Different curves exist (P-384, P-521, etc) —
// C2PA and most web standards default to P-256, so that's
// what LPS uses too, to stay compatible.

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1' // this IS P-256 — two names, same curve
});

console.log('Step 1: generated a throwaway EC key pair on P-256.');
console.log('This is the same curve LPS uses for real signing.\n');


// ------------------------------------------------------------
// TERM 2 — "SHA-256" (the string 'SHA256' in your code)
// ------------------------------------------------------------
// Before anything gets signed, the data first gets HASHED.
// A hash takes data of any size and crunches it down into a
// fixed-size fingerprint (256 bits = 32 bytes here). Change
// even one character of the input and the hash comes out
// completely different.
//
// WHY hash before signing instead of signing the raw manifest
// directly? Two reasons:
//   1. Signing algorithms work on fixed-size inputs efficiently.
//      A manifest could be 50 bytes or 50,000 bytes — hashing
//      first means the signing math always works on the same
//      32-byte size regardless of manifest size.
//   2. The hash IS the fingerprint of the exact manifest. If
//      anyone changes the manifest later, hashing it again
//      produces a different fingerprint, which is how tampering
//      gets caught downstream.
//
// 'SHA256' in createSign('SHA256') tells Node: "before you sign,
// run the input through the SHA-256 hashing algorithm first."
// This step has NOTHING to do with the encoding question below.
// It only ever decided WHICH hash function runs. It was never
// broken, never changed, never part of the bug we fixed.

const data = Buffer.from('this represents your canonical manifest bytes');

console.log('Step 2: SHA-256 is the hash function.');
console.log('It runs INSIDE createSign/createVerify automatically.');
console.log('It is what makes the signature sensitive to every byte');
console.log('of the manifest — change one byte, the hash changes,');
console.log('the old signature no longer matches.\n');


// ------------------------------------------------------------
// TERM 3 — what SIGNING actually produces, and "DER"
// ------------------------------------------------------------
// ECDSA signing produces TWO numbers, mathematically — called
// "r" and "s". That's just how the ECDSA math works: the output
// of the signing operation is always a pair of numbers (r, s),
// not a single blob. Every library has to decide HOW to package
// those two numbers into actual bytes you can store or send.
// That packaging choice is the "encoding."
//
// DER (Distinguished Encoding Rules) is one such packaging
// format. It's a general-purpose, very old encoding standard
// used all over cryptography (X.509 certificates use it too).
// DER wraps r and s in a tagged, length-prefixed structure:
//   SEQUENCE { INTEGER r, INTEGER s }
// Because DER encodes each integer with its own length prefix,
// and r/s can vary slightly in byte-length depending on their
// numeric value, a DER-encoded ECDSA signature on P-256 usually
// comes out around 70-72 bytes — NOT a fixed size every time.
//
// DER is Node's DEFAULT encoding if you don't ask for anything
// else. This is what your code was doing before the fix.

const signerDER = createSign('SHA256');
signerDER.update(data);
signerDER.end();
const sigDER = signerDER.sign(privateKey); // no dsaEncoding = DER default

console.log('Step 3: signed using DER (the default).');
console.log('DER signature byte length:', sigDER.length);
console.log('Notice: this number can vary slightly between runs —');
console.log('that variability is part of what DER encoding allows.\n');


// ------------------------------------------------------------
// TERM 4 — "dsaEncoding" and "ieee-p1363"
// ------------------------------------------------------------
// "dsaEncoding" is just the NAME of the option in Node's crypto
// module that lets you choose the packaging format instead of
// accepting DER by default.
//
// "IEEE P1363" is a DIFFERENT packaging format for the same two
// numbers (r and s). Instead of DER's tagged/length-prefixed
// structure, P1363 just concatenates r and s directly as raw
// fixed-length bytes: 32 bytes of r, followed immediately by
// 32 bytes of s, for P-256 specifically. No tags. No length
// prefixes. Always exactly 64 bytes, every single time.
//
// Same mathematical signature. Same two numbers r and s.
// Completely different byte packaging.

const signerP1363 = createSign('SHA256');
signerP1363.update(data);
signerP1363.end();
const sigP1363 = signerP1363.sign({
  key: privateKey,
  dsaEncoding: 'ieee-p1363' // <-- this is the ENTIRE fix from yesterday
});

console.log('Step 4: signed using IEEE P1363 (raw r‖s).');
console.log('P1363 signature byte length:', sigP1363.length);
console.log('This is ALWAYS 64 for P-256 — fixed, never variable.\n');


// ------------------------------------------------------------
// TERM 5 — "es256" (the algorithm field in your manifest)
// ------------------------------------------------------------
// "ES256" is not Node's invention — it's a name defined by
// external standards (JOSE, and COSE which C2PA uses). It is
// short for: "ECDSA signature, P-256 curve, SHA-256 hash,
// signature packaged as raw r‖s (P1363-style, 64 bytes)."
//
// That definition is fixed by the spec. It is NOT optional or
// negotiable — if you write algorithm: "es256" in a manifest,
// anyone reading that field assumes ALL FOUR of those things:
// curve = P-256, hash = SHA-256, encoding = raw r‖s, length = 64.
//
// THIS is exactly where yesterday's bug lived:
//   Your code wrote algorithm: "es256" into every manifest
//   (correct curve, correct hash) — but was actually producing
//   DER-encoded signatures (wrong encoding, wrong/variable length).
//   The LABEL said one thing. The BYTES did another thing.
//   Anyone using a real ES256/COSE verifier from outside your
//   codebase would read your 70-72 byte DER blob, expect 64
//   raw bytes per the es256 spec, and reject it as malformed.

console.log('Step 5: this is the entire bug, summarized.');
console.log('Label said: es256 (implies 64-byte raw r‖s)');
console.log('Bytes were: DER (', sigDER.length, 'bytes, variable)');
console.log('Bytes now: P1363 (', sigP1363.length, 'bytes, fixed) — matches the label.\n');


// ------------------------------------------------------------
// TERM 6 — verifying, and why dsaEncoding has to match on both ends
// ------------------------------------------------------------
// Verification reverses the process: take the signature bytes,
// unpack r and s out of them using the SAME packaging format
// that was used to pack them, redo the hash on the received
// data, and check the math.
//
// If you SIGN with P1363 but try to VERIFY assuming DER, the
// verifier will try to parse a DER tag structure out of 64 raw
// bytes that have no tags in them — and verification fails or
// throws, even though the underlying signature is perfectly valid.
// The encoding has to match on both ends. That's why both
// signingLayer.mjs AND verificationTool.mjs had to change together.

const verifyCorrect = createVerify('SHA256');
verifyCorrect.update(data);
verifyCorrect.end();
const resultCorrect = verifyCorrect.verify(
  { key: publicKey, dsaEncoding: 'ieee-p1363' }, // matches how it was signed
  sigP1363
);
console.log('Step 6a: verify P1363 signature WITH dsaEncoding set:', resultCorrect);
console.log('(should be true — encoding matches on both ends)\n');

try {
  const verifyMismatch = createVerify('SHA256');
  verifyMismatch.update(data);
  verifyMismatch.end();
  const resultMismatch = verifyMismatch.verify(
    publicKey, // no dsaEncoding = assumes DER
    sigP1363   // but this signature is actually P1363
  );
  console.log('Step 6b: verify P1363 signature WITHOUT dsaEncoding set:', resultMismatch);
} catch (err) {
  console.log('Step 6b: verify P1363 signature WITHOUT dsaEncoding set: THREW AN ERROR');
  console.log('(', err.message, ')');
}
console.log('This mismatch is exactly what an external ES256 verifier');
console.log('would have hit against your OLD signingLayer.mjs output —');
console.log('except in reverse: your old code signed as DER while');
console.log('labeling it es256, so an external P1363-expecting verifier');
console.log('would have failed against YOUR signatures.\n');

console.log('=== END ===');