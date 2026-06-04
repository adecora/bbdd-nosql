print(`Base de datos por defecto: ${db.getName()}`);

print(`\nSeleccionamos las base de datos "raw_db"`);
print('='.repeat(40));

// Ver: https://www.mongodb.com/docs/manual/reference/method/db.getSiblingDB/#example
db = db.getSiblingDB('raw_db');
print(`Base de datos actual: "${db.getName()}"`);

print(`\nListamos las colecciones disponibles`);
print('='.repeat(40));
print(
  `Colecciones disponibles: ${db
    .getCollectionNames()
    .map((collection) => `"${collection}"`)
    .join(', ')}`
);

// a. Recuperar el total de locales, terrazas, licencias y actividades económicas

print(
  `\na) Recuperar el total de locales, terrazas, licencias y actividades económicas`
);
print('='.repeat(80));
for (let collection of db.getCollectionNames()) {
  let count = db[collection].countDocuments();
  print(`"${collection}":`.padEnd(15), `${count.toLocaleString()}`);
}

// b. Identifica todos los valores distintos para los campos: "terrazas.desc_situacion_terraza",
//    "terrazas.desc_periodo_terraza", "locales.desc_situacion_local" y "licencias.desc_tipo_licencia"
print(`\nb) Identificar valores distintos para campos específicos`);
print('='.repeat(80));

const fieldsToCheck = [
  'terrazas.desc_situacion_terraza',
  'terrazas.desc_periodo_terraza',
  'locales.desc_situacion_local',
  'licencias.desc_tipo_licencia',
];

for (let field of fieldsToCheck) {
  let [collectionName, fieldName] = field.split('.');

  print(`\nValores distintos para "${field}":`);
  db[collectionName]
    .distinct(fieldName)
    .forEach((value) => print(`- ${value}`));
  print('-'.repeat(40));
}

// c. Contruye dos consultas donde uses los operadores lógicos $and, $or y $not.
print(`\nc) Consultas con operadores lógicos $and, $or y $not`);
print('='.repeat(80));

// Consulta 1: Terrazas en la zona de "SAN DIEGO", excluyendo la "ALBUFERA"
//             con la terraza abierta entre 10 y 15 horas en periodo "ANUAL"

print(
  `\nConsulta 1: Terrazas en la zona de "SAN DIEGO", excluyendo la "ALBUFERA" con la terraza abierta entre 10 y 15 horas en periodo "ANUAL"`
);

let filter = {
  desc_periodo_terraza: 'ANUAL',
  desc_barrio_local: 'SAN DIEGO',
  $and: [
    { duracion_lj_ra: { $exists: true } },
    { duracion_lj_ra: { $gte: 10 } },
    { duracion_lj_ra: { $lte: 15 } },
  ],
  desc_vial_edificio: { $not: /^ALBUFERA$/ },
};

let projection = {
  _id: 0,
  direccion_local: {
    $concat: ['$clase_vial_edificio', ' ', '$desc_vial_edificio'],
  },
  rotulo: 1,
  desc_situacion_terraza: 1,
  ubicacion_terraza: {
    $concat: [
      '$desc_ubicacion_terraza',
      ', EN ',
      '$desc_clase',
      ' ',
      '$desc_nombre',
    ],
  },
  superficie_es: 1,
  mesas_es: 1,
  mesas_ra: 1,
  hora_ini_lj_ra: 1,
  hora_fin_lj_ra: 1,
  duracion_lj_ra: 1,
};

let query = db.terrazas.countDocuments(filter);

print(`\nTotal del terrazas que cumplen esta condiciones: ${query}`);
print('\nTerrazas que cumplen esta condición');
print('-'.repeat(40));
db.terrazas.find(filter, projection).forEach(printjson);

// Consulta 2: Top3 de actividades económicas en la zona de "SAN DIEGO" excluyendo aquellas que tengan "NULO" o "SIN ACTIVIDAD" en su descripción

print(
  `\nConsulta 2: Top3 de actividades económicas en la zona de "SAN DIEGO"\n`
);

// Ver: https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/#group-titles-by-year
db.actividades
  .aggregate([
    {
      $match: {
        desc_barrio_local: 'SAN DIEGO',
        $nor: [{ desc_epigrafe: /NULO/ }, { desc_epigrafe: /SIN ACTIVIDAD/ }],
      },
    },
    {
      $group: {
        _id: '$desc_epigrafe',
        count: { $count: {} },
        locales: { $push: '$rotulo' },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 3 },
  ])
  .forEach(printjson);

// d. Construye dos consultas donde uses los operadores $exists y $type juntos.
print(`\nd) Consultas con operadores $exists y $type juntos`);
print('='.repeat(80));

// En la colección de locales, los campos: `id_planta_agrupado`, `id_local_agrupado` y `rotulo` son de tipo mixed.
// Consulta 1: Consultar el número de locales que tienen un valor definido para el campo `id_planta_agrupada` en función de su tipo de dato (string o number).
print(
  `\nConsulta 1: Número de locales con un valor definido para el campo "id_planta_agrupado" en función de su tipo de dato (string o number)`
);

print(`Valores distintos para el campo "id_planta_agrupado":`);
db.locales
  .aggregate([
    {
      $group: {
        _id: { $type: '$id_planta_agrupado' },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $project: { _id: 0, tipo: '$_id', count: 1 } },
  ])
  .forEach(printjson);

print(`Número total de locales:`.padEnd(60), db.locales.countDocuments());
query = db.locales.countDocuments({
  id_planta_agrupado: { $exists: true, $type: 'string' },
});
print(
  `Número de locales con "id_planta_agrupado" de tipo string:`.padEnd(60),
  `${query}`
);

query = db.locales.countDocuments({
  id_planta_agrupado: { $exists: true, $type: 'number' },
});
print(
  `Número de locales con "id_planta_agrupado" de tipo number:`.padEnd(60),
  `${query}`
);

query = db.locales.countDocuments({ id_planta_agrupado: { $exists: false } });
print(
  `Número de locales sin el campo "id_planta_agrupado":`.padEnd(60),
  `${query}`
);

// Consulta 2: Consultar el número de licencias de cada barrio de distrito "PUENTE DE VALLECAS" indicando la fecha mínima y máxima de concesión de licencia en cada barrio.
print(
  `\nConsulta 2: Consultar el número de licencias de cada barrio de distrito "PUENTE DE VALLECAS" indicando la fecha mínima y máxima de concesión de licencia en cada barrio`
);

// Ver: https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/#optimization-to-return-the-first-or-last-document-of-each-group
db.licencias
  .aggregate([
    {
      $match: {
        desc_distrito_local: 'PUENTE DE VALLECAS',
        fecha_dec_lic: { $exists: true, $type: 'date' },
      },
    },
    { $sort: { desc_barrio_local: 1, fecha_dec_lic: 1 } },
    {
      $group: {
        _id: '$desc_barrio_local',
        licencias: { $count: {} },
        min_fecha: { $first: '$fecha_dec_lic' },
        max_fecha: { $last: '$fecha_dec_lic' },
      },
    },
    { $sort: { licencias: -1 } },
  ])
  .forEach(printjson);

// e. Encuentra locales, terrazas o licencias cuyo rotulo contenga "CAFE" o "RESTAURANTE" (insensible a mayúsculas).
print(
  `\ne) Licencias cuyo rotulo contiene "CAFE" o "RESTAURANTE" (insensible a mayúsculas)`
);
print('='.repeat(80));

filter = {
  rotulo: /^(CAFE|RESTAURANTE)/i,
};

for (let collection of ['locales', 'terrazas', 'licencias']) {
  query = db[collection].countDocuments(filter);
  print(
    `Total locales cuyo rótulo comienza por "CAFE" o "RESTAURANTE" para la colección "${collection}": ${query}`
  );
}

// f. Sobre la colección terrazas, explica qué devuelve la siguiente consulta:
print(
  `\nf) Total de terrazas abiertas por distrito local, sumando el número de mesas, sillas y superficie de cada terraza, ordenado de mayor a menor por número de terrazas abiertas`
);
print('='.repeat(80));

db.terrazas
  .aggregate([
    { $match: { desc_situacion_terraza: 'ABIERTA' } },
    {
      $group: {
        _id: '$desc_distrito_local',
        total_terrazas: { $sum: 1 },
        total_mesas_es: { $sum: '$mesas_es' },
        total_sillas_es: { $sum: '$sillas_es' },
        total_superficie_es: { $sum: '$superficie_es' },
      },
    },
    { $sort: { total_terrazas: -1 } },
  ])
  .forEach(printjson);

// g. Utiliza el operador $lookup con dos colecciones.
print(`\ng) Utilizar el operador $lookup con dos colecciones`);
print('='.repeat(80));

print(
  `Top 3 de bares, cafeterías o restaurantes en la calle "LOPEZ DE HOYOS" con terraza más grande (superficie)`
);
db.actividades
  .aggregate([
    {
      $match: {
        desc_vial_acceso: 'LOPEZ DE HOYOS',
        desc_epigrafe: /\b(CAFETERIA|BAR|RESTAURANTE)\b/,
      },
    },
    {
      $lookup: {
        from: 'terrazas',
        localField: 'id_local',
        foreignField: 'id_local',
        as: 'terrazas',
      },
    },
    {
      $set: {
        terraza: { $first: '$terrazas' },
      },
    },
    {
      $project: {
        _id: 0,
        rotulo: 1,
        desc_seccion: 1,
        lon: 1,
        lat: 1,
        terraza: {
          desc_situacion_terraza: '$terraza.desc_situacion_terraza',
          desc_periodo_terraza: '$terraza.desc_periodo_terraza',
          fecha_confir_ult_decreto_resol:
            '$terraza.fecha_confir_ult_decreto_resol',
          superficie: {
            $cond: [
              { $eq: ['$terraza.desc_periodo_terraza', 'ANUAL'] },
              '$terraza.superficie_ra',
              '$terraza.superficie_es',
            ],
          },
          mesas: {
            $cond: [
              { $eq: ['$terraza.desc_periodo_terraza', 'ANUAL'] },
              '$terraza.mesas_ra',
              '$terraza.mesas_es',
            ],
          },
          sillas: {
            $cond: [
              { $eq: ['$terraza.desc_periodo_terraza', 'ANUAL'] },
              '$terraza.sillas_ra',
              '$terraza.sillas_es',
            ],
          },
        },
      },
    },
    { $sort: { 'terraza.superficie': -1 } },
    { $limit: 3 },
  ])
  .forEach(printjson);

// Misma query sobre el modelo de datos embedidos.
// db.embedido.aggregate([
//   {
//     $match: {
//       desc_vial_acceso: 'LOPEZ DE HOYOS',
//       'actividades.desc_epigrafe': /\b(CAFETERIA|BAR|RESTAURANTE)\b/,
//     },
//   },
//   {
//     $project: {
//       _id: 0,
//       rotulo: 1,
//       desc_seccion: 1,
//       lon: 1,
//       lat: 1,
//       terraza: {
//         desc_situacion_terraza: '$terraza.desc_situacion_terraza',
//         desc_periodo_terraza: '$terraza.desc_periodo_terraza',
//         fecha_confir_ult_decreto_resol:
//           '$terraza.fecha_confir_ult_decreto_resol',
//         superficie: {
//           $cond: [
//             { $eq: ['$terraza.desc_periodo_terraza', 'ANUAL'] },
//             '$terraza.superficie_ra',
//             '$terraza.superficie_es',
//           ],
//         },
//         mesas: {
//           $cond: [
//             { $eq: ['$terraza.desc_periodo_terraza', 'ANUAL'] },
//             '$terraza.mesas_ra',
//             '$terraza.mesas_es',
//           ],
//         },
//         sillas: {
//           $cond: [
//             { $eq: ['$terraza.desc_periodo_terraza', 'ANUAL'] },
//             '$terraza.sillas_ra',
//             '$terraza.sillas_es',
//           ],
//         },
//       },
//     },
//   },
//   { $sort: { 'terraza.superficie': -1 } },
//   { $limit: 3 },
// ]);
