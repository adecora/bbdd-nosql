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

print(
  `\nListamos los índices de la colección "embedido", modelo de datos embedidos`
);
print('='.repeat(40));

// Empezamos limpiando todos los índices salvo el obligado _id
db.embedido.dropIndexes();

// Función auxiliar para imprimir los índices de una colección
const printindexes = (collection = 'embedido') =>
  print(
    `Indices disponibles:\n  - ${db[collection].getIndexes().map(JSON.stringify).join('\n  - ')}`
  );
printindexes();

print(
  '\n1) Rendimiento de la consulta sobre el distrito de "PUENTE DE VALLECAS" sin índice.'
);
print('='.repeat(80));

print(
  db.embedido
    .find({ desc_distrito_local: 'PUENTE DE VALLECAS' })
    .explain('executionStats')
);

print('\n1.2) Creación del índice compuesto "index_distrito_barrio"');
print('='.repeat(80));

// Creamos el índice compuesto distrito-barrio
db.embedido.createIndex(
  { desc_distrito_local: 1, desc_barrio_local: 1 },
  { name: 'index_distrito_barrio' }
);

printindexes();

print(
  '\n1.3) Rendimiento de la consulta sobre el distrito de "PUENTE DE VALLECAS" con índice compuesto distrito-barrio.'
);
print('='.repeat(80));

print(
  db.embedido
    .find({ desc_distrito_local: 'PUENTE DE VALLECAS' })
    .explain('executionStats')
);

print(
  '\n1.4) Rendimiento de la consulta sobre el distrito de "PUENTE DE VALLECAS" barrio "SAN DIEGO" con índice compuesto distrito-barrio.'
);
print('='.repeat(80));

print(
  db.embedido
    .find({
      desc_distrito_local: 'PUENTE DE VALLECAS',
      desc_barrio_local: 'SAN DIEGO',
    })
    .explain('executionStats')
);

print(
  '\n1.5) Rendimiento de la consulta sobre el barrio "SAN DIEGO" con índice compuesto distrito-barrio.'
);
print('='.repeat(80));

print(
  db.embedido.find({ desc_barrio_local: 'SAN DIEGO' }).explain('executionStats')
);

print('\n2)Creación del índice simple "index_barrio"');
print('='.repeat(80));

// Creamos el índice simple barrio
db.embedido.createIndex({ desc_barrio_local: 1 }, { name: 'index_barrio' });

printindexes();

print(
  '\n2.1) Rendimiento de la consulta sobre el barrio "SAN DIEGO" con índice simple barrio.'
);
print('='.repeat(80));

print(
  db.embedido.find({ desc_barrio_local: 'SAN DIEGO' }).explain('executionStats')
);

// Ver: https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/create-multikey-index-embedded/
print(
  '\n3)Rendimiento de la consulta sobre el actividad que contenga /^BAR/ sin índice.'
);
print('='.repeat(80));

print(
  db.embedido
    .find({ 'actividades.desc_epigrafe': /^BAR/ })
    .explain('executionStats')
);

print('\n3.1)Índice sobre un campo embedido en un array "index_actividades".');
print('='.repeat(80));

db.embedido.createIndex(
  { 'actividades.desc_epigrafe': 1 },
  { name: 'index_actividades' }
);

printindexes();

print(
  '\n3.2) Rendimiento de la consulta sobre el actividad que contenga /^BAR/ sobre índice de campo embedido en array.'
);
print('='.repeat(80));

print(
  db.embedido
    .find({ 'actividades.desc_epigrafe': /^BAR/ })
    .explain('executionStats')
);

print(
  '4) Creación del índice geospacial "index_geospatial" sobre el campo location con las coordenadas de longitud y latitud.'
);
print('='.repeat(80));

db.embedido.createIndex({ location: '2dsphere' }, { name: 'index_geospatial' });

printindexes();

print('4.1) Rendimiento de la consulta sobre el índice geospacial');
print('='.repeat(80));

print(
  db.embedido
    .find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [-3.669101623781085, 40.395691671374856],
          },
          $maxDistance: 1000,
        },
      },
    })
    .explain('executionStats')
);

print('4.2) Top3 de los bares más cercanos a mi casa.');
print('='.repeat(80));

// Ver: https://www.mongodb.com/docs/manual/reference/operator/aggregation/geoNear/
db.embedido
  .aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [-3.669101623781085, 40.395691671374856],
        },
        distanceField: 'distance',
        maxDistance: 200,
        spherical: true,
        key: 'location',
      },
    },
    { $match: { 'actividades.desc_epigrafe': /^BAR/ } },
    {
      $project: {
        _id: 0,

        desc_distrito_local: 1,
        desc_barrio_local: 1,

        direccion_acceso: {
          $concat: ['$clase_vial_acceso', ' ', '$desc_vial_acceso'],
        },
        rotulo: 1,
        total_licencias: {
          $size: {
            $ifNull: ['$licencias', []],
          },
        },

        ref_licencias: {
          $map: {
            input: { $ifNull: ['$licencias', []] },
            as: 'lic',
            in: '$$lic.ref_licencia',
          },
        },

        total_actividades: {
          $size: {
            $ifNull: ['$actividades', []],
          },
        },

        desc_epigrafes: {
          $map: {
            input: { $ifNull: ['$actividades', []] },
            as: 'act',
            in: '$$act.desc_epigrafe',
          },
        },

        tiene_terraza: {
          $and: [
            { $ne: [{ $type: '$terraza' }, 'missing'] },
            { $ne: ['$terraza', null] },
          ],
        },

        location: 1,
        distance: 1,
      },
    },
    { $sort: { distance: 1 } },
    { $limit: 3 },
  ])
  .forEach(printjson);
