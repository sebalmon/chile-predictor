import { test } from "node:test";
import assert from "node:assert/strict";
import { composicionPorPuesto, generarSobre, gastarDuplicados, cartaImg } from "./sobre.js";

test("composicionPorPuesto: límites de cada tier", () => {
  assert.deepEqual(composicionPorPuesto(1),   { laminas:4, cartas:[] });
  assert.deepEqual(composicionPorPuesto(3),   { laminas:4, cartas:[] });
  assert.deepEqual(composicionPorPuesto(null),{ laminas:4, cartas:[] });
  assert.deepEqual(composicionPorPuesto(4),   { laminas:3, cartas:[{mult:2,n:1}] });
  assert.deepEqual(composicionPorPuesto(7),   { laminas:3, cartas:[{mult:2,n:1}] });
  assert.deepEqual(composicionPorPuesto(8),   { laminas:3, cartas:[{mult:3,n:1}] });
  assert.deepEqual(composicionPorPuesto(14),  { laminas:3, cartas:[{mult:3,n:1}] });
  assert.deepEqual(composicionPorPuesto(15),  { laminas:3, cartas:[{mult:4,n:1}] });
  assert.deepEqual(composicionPorPuesto(22),  { laminas:3, cartas:[{mult:4,n:1}] });
  assert.deepEqual(composicionPorPuesto(23),  { laminas:2, cartas:[{mult:4,n:2}] });
  assert.deepEqual(composicionPorPuesto(999), { laminas:2, cartas:[{mult:4,n:2}] });
});

test("generarSobre: cuenta láminas y permite repetidas", () => {
  const cat = [{file:"A"},{file:"B"}];
  const s = generarSobre(cat, { laminas:4, cartas:[] }, () => 0); // rnd=0 -> siempre A
  assert.equal(s.laminas.length, 4);
  assert.ok(s.laminas.every(l => l.file === "A")); // repetición permitida
  assert.equal(s.cartas.length, 0);
});

test("generarSobre: tier 23+ da 2 láminas y 2 cartas ×4", () => {
  const s = generarSobre([{file:"A"}], composicionPorPuesto(23));
  assert.equal(s.laminas.length, 2);
  assert.equal(s.cartas.length, 2);
  assert.ok(s.cartas.every(c => c.multiplicador === 4));
});

test("gastarDuplicados: respeta sobrante y nunca baja de 1", () => {
  const lu = { A:3, B:2, C:1 }; // sobrantes A2 B1 C0 = 3
  assert.equal(gastarDuplicados(lu, 4).ok, false);     // no alcanza
  const r = gastarDuplicados(lu, 3);
  assert.equal(r.ok, true);
  const suma = Object.values(r.decrementos).reduce((s,v)=>s+v,0);
  assert.equal(suma, -3);                               // gasta exactamente 3
  assert.ok((r.decrementos.A ?? 0) >= -2);              // A no baja de 1
  assert.ok(!("C" in r.decrementos));                  // C no tiene sobrante
});

test("cartaImg: ruta .jpg", () => {
  assert.equal(cartaImg("el-maracanazo"), "/cartas/el-maracanazo.jpg");
});

test("categoriaCompleta / albumCompleto", async () => {
  const { categoriaCompleta, albumCompleto } = await import("./sobre.js");
  const cat = [
    {file:"RE_A",categoria:"RE"}, {file:"RE_B",categoria:"RE"},
    {file:"CU_A",categoria:"CU"},
  ];
  assert.equal(categoriaCompleta({RE_A:1,RE_B:2}, cat, "RE"), true);
  assert.equal(categoriaCompleta({RE_A:1}, cat, "RE"), false);   // falta RE_B
  assert.equal(albumCompleto({RE_A:1,RE_B:1}, cat), false);      // falta CU_A
  assert.equal(albumCompleto({RE_A:1,RE_B:1,CU_A:1}, cat), true);
});

test("recompensasPendientes: completas no reclamadas", async () => {
  const { recompensasPendientes } = await import("./sobre.js");
  const cat = [{file:"RE_A",categoria:"RE"},{file:"CU_A",categoria:"CU"}];
  // RE completa y no reclamada; CU incompleta; álbum incompleto
  const p = recompensasPendientes({RE_A:2}, cat, {});
  assert.deepEqual(p, [{tipo:"categoria", key:"RE", cartas:[{mult:2,n:1}]}]);
  // todo completo, RE ya reclamada -> queda CU + album
  const q = recompensasPendientes({RE_A:1,CU_A:1}, cat, {cat_RE:true});
  assert.deepEqual(q, [
    {tipo:"categoria", key:"CU", cartas:[{mult:2,n:1}]},
    {tipo:"album", key:"album", cartas:[{mult:4,n:2}]},
  ]);
});
