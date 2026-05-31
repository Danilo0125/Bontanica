// data.jsx — Botánica Resto Bar · catálogo + datos del local
const CATEGORIES = [
  {
    id: "cocteles",
    name: "Cócteles & Sangrías",
    tag: "Refrescante",
    items: [
      { id: "sangria", name: "Sangría en vaso", desc: "Vino tinto, frutas de estación y un toque cítrico.", price: 25 },
      { id: "mojito-vaso", name: "Mojito en vaso", desc: "Ron, hierbabuena fresca, lima y soda.", price: 30 },
      { id: "mojito-jarra", name: "Mojito en jarra", desc: "Para compartir · rinde 4 vasos.", price: 80 },
    ],
  },
  {
    id: "vinos",
    name: "Vinos",
    tag: "De la casa",
    items: [
      { id: "copa-vino", name: "Copa de vino", desc: "Tinto o blanco de la casa.", price: 25 },
      { id: "botella-vino", name: "Vino en botella", desc: "Botella cerrada para la mesa.", price: 150 },
    ],
  },
  {
    id: "compartir",
    name: "Para compartir",
    tag: "Cocina",
    items: [
      { id: "pizza-tajada", name: "Pizza por tajada", desc: "Masa madre, horneada al momento.", price: 15 },
      { id: "pizza-entera", name: "Pizza entera", desc: "8 porciones · ideal para la mesa.", price: 90 },
      { id: "tablitas", name: "Tablitas", desc: "Selección de quesos, fiambres y encurtidos.", price: 65 },
    ],
  },
];

// Lista plana para el módulo de cobro
const ALL_PRODUCTS = CATEGORIES.flatMap((c) => c.items.map((i) => ({ ...i, cat: c.name })));

const VENUE = {
  name: "Botánica",
  tagline: "Resto Bar · Jardín nocturno",
  eventTitle: "Apertura bajo las luces",
  eventDate: "Sábado 6 de junio",
  eventTime: "Desde las 18:00",
  eventTargetISO: "2026-06-06T18:00:00",
  mapsUrl: "https://maps.app.goo.gl/zKEgtK7LZC8kyGgD7",
  whatsapp: "59170000000", // placeholder — reemplazar por número real
  ig: "https://instagram.com",
  fb: "https://facebook.com",
  about:
    "Un jardín secreto en la ciudad. Cócteles de autor, pizza artesanal y buena música entre plantas y luces cálidas. Botánica es el lugar para reunirse cuando cae la noche.",
};

Object.assign(window, { CATEGORIES, ALL_PRODUCTS, VENUE });
