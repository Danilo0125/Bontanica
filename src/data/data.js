// data.js — datos del local. La carta y mesas viven en Supabase.
export const VENUE = {
  name: 'Botánica',
  tagline: 'RestoBar · Jardín nocturno',
  eventTitle: 'Apertura bajo las luces',
  eventDate: 'Sábado 6 de junio',
  eventTime: 'Desde las 18:00',
  eventTargetISO: '2026-06-06T18:00:00',
  // URL canónica con el Place ID — abre el lugar exacto en Google Maps app/web.
  mapsUrl: 'https://www.google.com/maps/place/BOTANICA/@-17.4309801,-66.1539207,17z/data=!4m6!3m5!1s0x93e3730000b820f5:0x727f180f226e205e!8m2!3d-17.4309801!4d-66.1539207',
  // Embed iframe oficial (apunta a Botánica).
  mapsEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4031.952348104596!2d-66.15468917197968!3d-17.430885125312873!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x93e3730000b820f5%3A0x727f180f226e205e!2sBOTANICA!5e0!3m2!1sen!2sbo!4v1780343961976!5m2!1sen!2sbo',
  coords: { lat: -17.4309801, lng: -66.1539207, zoom: 17 },
  address: 'Cochabamba, Bolivia',
  whatsapp: '59164965211',
  // TODO: reemplazar por los perfiles reales cuando el cliente los entregue.
  ig: 'https://instagram.com',
  fb: 'https://facebook.com',
  about:
    'Un jardín secreto en la ciudad. Cócteles de autor, pizza artesanal y buena música entre plantas y luces cálidas. Botánica es el lugar para reunirse cuando cae la noche.',
};
