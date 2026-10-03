const bookingForm = document.querySelector("#bookingForm");
const bookingDate = document.querySelector("#bookingDate");
const timeOptions = document.querySelector("#timeOptions");
const bookingSubmit = document.querySelector("#bookingSubmit");
const bookingMessage = document.querySelector("#bookingMessage");
const bookingGuests = document.querySelector("#bookingGuests");
const bookingNotes = document.querySelector("#bookingNotes");
const bookingName = document.querySelector("#bookingName");
const bookingPhone = document.querySelector("#bookingPhone");
const bookingWebsite = document.querySelector("#bookingWebsite");
const bookingNameError = document.querySelector("#bookingNameError");
const bookingPhoneError = document.querySelector("#bookingPhoneError");
const timeError = document.querySelector("#timeError");
const bookingSummaryText = document.querySelector("#bookingSummaryText");
const confirmationDialog = document.querySelector("#confirmationDialog");
const NAME_PATTERN = /^\p{L}[\p{L}\p{M} '’.\-]*$/u;
const PHONE_PATTERN = /^\+?\d{6,15}$/;
const bookingConfig = { maxGuests: 12 };
let availabilityRequest = 0;
let lastBookingPayload = null;
const languageOrder = ["en", "fr", "de", "es"];
const languageCodes = { it: "IT", en: "EN", fr: "FR", de: "DE", es: "ES" };
const languageLocales = { it: "it-IT", en: "en-GB", fr: "fr-FR", de: "de-DE", es: "es-ES" };
let activeLanguage = "it";

const languageCopy = {
  "Bagno Marè | Cesenatico": ["Bagno Marè | Cesenatico", "Bagno Marè | Cesenatico", "Bagno Marè | Cesenatico", "Bagno Marè | Cesenatico"],
  "Bagno Marè, Cesenatico. Una giornata al mare, una tavola da condividere, il piacere di fermarsi.": ["Bagno Marè, Cesenatico. A day by the sea, a table to share, the pleasure of slowing down.", "Bagno Marè, Cesenatico. Une journée au bord de la mer, une table à partager, le plaisir de prendre son temps.", "Bagno Marè, Cesenatico. Ein Tag am Meer, ein Tisch zum Teilen, die Freude am Innehalten.", "Bagno Marè, Cesenatico. Un día junto al mar, una mesa para compartir, el placer de hacer una pausa."],
  "Una giornata al mare, una tavola da condividere, il piacere di fermarsi.": ["A day by the sea, a table to share, the pleasure of slowing down.", "Une journée au bord de la mer, une table à partager, le plaisir de prendre son temps.", "Ein Tag am Meer, ein Tisch zum Teilen, die Freude am Innehalten.", "Un día junto al mar, una mesa para compartir, el placer de hacer una pausa."],
  "Salta al contenuto": ["Skip to content", "Aller au contenu", "Zum Inhalt springen", "Saltar al contenido"],
  "Bagno Marè, inizio pagina": ["Bagno Marè, top of page", "Bagno Marè, haut de page", "Bagno Marè, Seitenanfang", "Bagno Marè, inicio de página"],
  "Navigazione principale": ["Main navigation", "Navigation principale", "Hauptnavigation", "Navegación principal"],
  "Salta alla sezione del menu": ["Skip to a menu section", "Aller à une section de la carte", "Zu einem Menüabschnitt springen", "Ir a una sección del menú"],
  "Carta dei vini Marè, edizione 2026": ["Marè wine list, 2026 edition", "Carte des vins du Marè, édition 2026", "Weinkarte des Marè, Ausgabe 2026", "Carta de vinos de Marè, edición 2026"],
  "Il passaggio tra gli ombrelloni verso il mare": ["The path between the beach umbrellas leading to the sea", "Le passage entre les parasols vers la mer", "Der Weg zwischen den Sonnenschirmen zum Meer", "El paso entre las sombrillas hacia el mar"],
  "Le cabine del Bagno Marè sulla spiaggia": ["The Bagno Marè beach huts", "Les cabines du Bagno Marè sur la plage", "Die Strandkabinen des Bagno Marè", "Las casetas del Bagno Marè en la playa"],
  "Tavole SUP sulla spiaggia del Bagno Marè": ["SUP boards on the Bagno Marè beach", "Planches de SUP sur la plage du Bagno Marè", "SUP-Boards am Strand des Bagno Marè", "Tablas de SUP en la playa del Bagno Marè"],
  "Un piatto preparato nella cucina del Bagno Marè": ["A dish prepared in the Bagno Marè kitchen", "Un plat préparé dans la cuisine du Bagno Marè", "Ein Gericht aus der Küche des Bagno Marè", "Un plato preparado en la cocina del Bagno Marè"],
  "Un croissant appena preparato al Bagno Marè": ["A freshly baked croissant at Bagno Marè", "Un croissant tout juste préparé au Bagno Marè", "Ein frisch gebackenes Croissant im Bagno Marè", "Un croissant recién hecho en Bagno Marè"],
  "Pasta fresca della cucina del Bagno Marè": ["Fresh pasta from the Bagno Marè kitchen", "Pâtes fraîches de la cuisine du Bagno Marè", "Frische Pasta aus der Küche des Bagno Marè", "Pasta fresca de la cocina del Bagno Marè"],
  "Un calice versato al ristorante": ["A glass of wine poured at the restaurant", "Un verre servi au restaurant", "Ein eingeschenktes Glas im Restaurant", "Una copa servida en el restaurante"],
  "La sala del ristorante al tramonto, affacciata sul mare": ["The restaurant at sunset, overlooking the sea", "La salle du restaurant au coucher du soleil, face à la mer", "Der Gastraum bei Sonnenuntergang mit Blick aufs Meer", "El restaurante al atardecer, frente al mar"],
  "Una tavola illuminata dalle candele": ["A candlelit table", "Une table éclairée à la bougie", "Ein Tisch im Kerzenschein", "Una mesa iluminada por velas"],
  "Dettaglio degli interni del ristorante": ["A detail of the restaurant interior", "Détail de l’intérieur du restaurant", "Ein Detail des Restaurantinnenraums", "Detalle del interior del restaurante"],
  "La sala apparecchiata per la sera": ["The dining room set for the evening", "La salle dressée pour le soir", "Der für den Abend gedeckte Gastraum", "El comedor preparado para la noche"],
  "Una sala pronta per una cena speciale": ["A room ready for a special dinner", "Une salle prête pour un dîner spécial", "Ein Raum für ein besonderes Abendessen", "Una sala lista para una cena especial"],
  "Fiori e luci sulla tavola": ["Flowers and lights on the table", "Fleurs et lumières sur la table", "Blumen und Lichter auf dem Tisch", "Flores y luces sobre la mesa"],
  "Un aperitivo al Bagno Marè": ["An aperitif at Bagno Marè", "Un apéritif au Bagno Marè", "Ein Aperitif im Bagno Marè", "Un aperitivo en Bagno Marè"],
  "La sala del ristorante illuminata la sera": ["The restaurant dining room lit up at night", "La salle du restaurant éclairée le soir", "Der abends beleuchtete Gastraum", "El comedor iluminado por la noche"],
  "Menu": ["Menu", "Menu", "Menü", "Menú"],
  "Il luogo": ["The place", "Le lieu", "Der Ort", "El lugar"],
  "Spiaggia": ["Beach", "Plage", "Strand", "Playa"],
  "La spiaggia · Servizi": ["The beach · Services", "La plage · Services", "Der Strand · Services", "La playa · Servicios"],
  "Tutto quello che serve,": ["Everything you need,", "Tout ce qu’il faut,", "Alles, was Sie brauchen,", "Todo lo que necesitas,"],
  "con spazio intorno.": ["with room to breathe.", "avec de l’espace autour.", "mit viel Platz drumherum.", "con espacio alrededor."],
  "Ombrelloni ben distanziati, docce calde, campi in sabbia e un bar sempre aperto: la spiaggia del Marè è pensata per stare comodi dal mattino al tramonto.": ["Well-spaced umbrellas, hot showers, sand courts and a bar that’s always open: the beach at Marè is designed for comfort from morning to sunset.", "Des parasols bien espacés, des douches chaudes, des terrains de sable et un bar toujours ouvert : la plage du Marè est pensée pour votre confort du matin au coucher du soleil.", "Großzügig verteilte Sonnenschirme, warme Duschen, Sandplätze und eine Bar, die immer geöffnet ist: Der Strand des Marè ist auf Komfort vom Morgen bis zum Sonnenuntergang ausgelegt.", "Sombrillas bien separadas, duchas calientes, campos de arena y un bar siempre abierto: la playa de Marè está pensada para estar a gusto de la mañana al atardecer."],
  "4,5 m": ["4.5 m", "4,5 m", "4,5 m", "4,5 m"],
  "tra un ombrellone e l’altro": ["between umbrellas", "entre deux parasols", "zwischen den Sonnenschirmen", "entre sombrillas"],
  "8:00–18:00": ["8 am – 6 pm", "8 h – 18 h", "8:00–18:00 Uhr", "8:00–18:00"],
  "orario della spiaggia": ["beach hours", "horaires de la plage", "Strandöffnungszeiten", "horario de la playa"],
  "2 campi": ["2 courts", "2 terrains", "2 Spielfelder", "2 campos"],
  "beach volley e beach soccer": ["beach volleyball and beach soccer", "beach-volley et beach soccer", "Beachvolleyball und Beachsoccer", "vóley playa y fútbol playa"],
  "In spiaggia": ["On the beach", "Sur la plage", "Am Strand", "En la playa"],
  "Ombrelloni distanziati": ["Well-spaced umbrellas", "Parasols espacés", "Großzügig verteilte Sonnenschirme", "Sombrillas separadas"],
  "File parallele al mare, con oltre 4,5 metri tra una postazione e l’altra.": ["Rows parallel to the sea, with more than 4.5 metres between each spot.", "Des rangées parallèles à la mer, avec plus de 4,5 mètres entre chaque emplacement.", "Reihen parallel zum Meer, mit mehr als 4,5 Metern zwischen den Plätzen.", "Filas paralelas al mar, con más de 4,5 metros entre cada puesto."],
  "Lettini in prima fila": ["Front-row loungers", "Transats au premier rang", "Liegen in der ersten Reihe", "Tumbonas en primera fila"],
  "Sulla battigia, per chi vuole il mare a un passo. In bassa stagione sono gratuiti.": ["Right on the shoreline, with the sea just a step away. Free in the low season.", "Au bord de l’eau, la mer à deux pas. Gratuits en basse saison.", "Direkt an der Wasserlinie, das Meer nur einen Schritt entfernt. In der Nebensaison kostenlos.", "En la orilla, con el mar a un paso. Gratis en temporada baja."],
  "A pagamento": ["Extra charge", "Payant", "Kostenpflichtig", "De pago"],
  "Incluso": ["Included", "Inclus", "Inklusive", "Incluido"],
  "Tende Versilia": ["Versilia tents", "Tentes Versilia", "Versilia-Zelte", "Toldos Versilia"],
  "Un’ombra ampia e riparata, comoda per famiglie e gruppi.": ["Wide, sheltered shade, ideal for families and groups.", "Une ombre large et abritée, idéale pour les familles et les groupes.", "Großzügiger, geschützter Schatten – ideal für Familien und Gruppen.", "Una sombra amplia y resguardada, cómoda para familias y grupos."],
  "Cabine e spogliatoi": ["Beach huts and changing rooms", "Cabines et vestiaires", "Kabinen und Umkleiden", "Casetas y vestuarios"],
  "Attrezzati anche per persone con disabilità, su una spiaggia accessibile.": ["Also equipped for people with disabilities, on an accessible beach.", "Également équipés pour les personnes en situation de handicap, sur une plage accessible.", "Auch für Menschen mit Behinderung ausgestattet, an einem barrierefreien Strand.", "También adaptados para personas con discapacidad, en una playa accesible."],
  "Comfort": ["Comfort", "Confort", "Komfort", "Comodidades"],
  "Docce calde": ["Hot showers", "Douches chaudes", "Warme Duschen", "Duchas calientes"],
  "Acqua tiepida inclusa; docce calde con temperatura regolabile.": ["Lukewarm showers included; hot showers with adjustable temperature.", "Douches tièdes incluses ; douches chaudes à température réglable.", "Lauwarme Duschen inklusive; warme Duschen mit regulierbarer Temperatur.", "Agua templada incluida; duchas calientes con temperatura regulable."],
  "Wi-Fi gratuito": ["Free Wi-Fi", "Wi-Fi gratuit", "Kostenloses WLAN", "Wi-Fi gratuito"],
  "Connessione disponibile in spiaggia e al bar.": ["Available on the beach and at the bar.", "Connexion disponible sur la plage et au bar.", "Verfügbar am Strand und an der Bar.", "Conexión disponible en la playa y en el bar."],
  "Cassette di sicurezza": ["Safe-deposit lockers", "Casiers sécurisés", "Schließfächer", "Taquillas de seguridad"],
  "Per lasciare al sicuro i valori mentre sei in acqua.": ["Keep your valuables safe while you swim.", "Pour mettre vos objets de valeur à l’abri pendant la baignade.", "Damit Ihre Wertsachen sicher sind, während Sie schwimmen.", "Para dejar tus objetos de valor a salvo mientras te bañas."],
  "Materassini e kit bagno": ["Lounger cushions and bath kits", "Matelas et kits de bain", "Liegenauflagen und Badesets", "Colchonetas y kits de baño"],
  "Materassini per il lettino e prodotti da bagno su richiesta.": ["Lounger cushions and toiletries on request.", "Matelas pour transat et produits de toilette sur demande.", "Liegenauflagen und Pflegeprodukte auf Anfrage.", "Colchonetas para la tumbona y productos de baño bajo petición."],
  "Sport e gioco": ["Sport and play", "Sport et jeux", "Sport und Spiel", "Deporte y juego"],
  "Beach volley e beach soccer": ["Beach volleyball and beach soccer", "Beach-volley et beach soccer", "Beachvolleyball und Beachsoccer", "Vóley playa y fútbol playa"],
  "Campi in sabbia con palloni e racchette a disposizione.": ["Sand courts, with balls and rackets available.", "Terrains de sable, avec ballons et raquettes à disposition.", "Sandplätze mit Bällen und Schlägern zur Verfügung.", "Campos de arena con balones y palas a disposición."],
  "Noleggio SUP": ["SUP rental", "Location de SUP", "SUP-Verleih", "Alquiler de SUP"],
  "Tavole da stand up paddle per esplorare la costa con il mare calmo.": ["Stand-up paddleboards to explore the coast when the sea is calm.", "Des planches de stand up paddle pour explorer la côte par mer calme.", "Stand-up-Paddle-Boards, um bei ruhiger See die Küste zu erkunden.", "Tablas de stand up paddle para recorrer la costa con el mar en calma."],
  "Area giochi": ["Play area", "Aire de jeux", "Spielbereich", "Zona de juegos"],
  "Uno spazio per i più piccoli, con il calcio balilla per tutti.": ["A space for little ones, plus table football for everyone.", "Un espace pour les petits, et un baby-foot pour tous.", "Ein Bereich für die Kleinen und ein Tischkicker für alle.", "Un espacio para los más pequeños y futbolín para todos."],
  "Le partite e i grandi eventi sportivi in diretta.": ["Live matches and major sporting events.", "Les matchs et grands événements sportifs en direct.", "Spiele und große Sportereignisse live.", "Partidos y grandes eventos deportivos en directo."],
  "Pausa e benessere": ["Relax and wellbeing", "Pause et bien-être", "Pause und Wohlbefinden", "Pausa y bienestar"],
  "Trattamenti shiatsu": ["Shiatsu treatments", "Soins shiatsu", "Shiatsu-Behandlungen", "Tratamientos shiatsu"],
  "Un massaggio rilassante a pochi passi dall’ombrellone.": ["A relaxing massage just steps from your umbrella.", "Un massage relaxant à quelques pas de votre parasol.", "Eine entspannende Massage nur wenige Schritte vom Sonnenschirm entfernt.", "Un masaje relajante a pocos pasos de la sombrilla."],
  "Bar tutto il giorno": ["All-day bar", "Bar toute la journée", "Bar den ganzen Tag", "Bar todo el día"],
  "Caffè, drink e cocktail dal mattino al tramonto.": ["Coffee, drinks and cocktails from morning to sunset.", "Café, boissons et cocktails du matin au coucher du soleil.", "Kaffee, Drinks und Cocktails vom Morgen bis zum Sonnenuntergang.", "Café, bebidas y cócteles de la mañana al atardecer."],
  "Una spiaggia sostenibile": ["A sustainable beach", "Une plage durable", "Ein nachhaltiger Strand", "Una playa sostenible"],
  "Energia dal fotovoltaico, acqua piovana recuperata per l’irrigazione e materiali riciclati o biologici.": ["Solar power, rainwater collected for irrigation, and recycled or organic materials.", "Énergie photovoltaïque, eau de pluie récupérée pour l’arrosage et matériaux recyclés ou biologiques.", "Solarstrom, aufgefangenes Regenwasser zur Bewässerung und recycelte oder biologische Materialien.", "Energía fotovoltaica, agua de lluvia recuperada para el riego y materiales reciclados o ecológicos."],
  "Servizi e tariffe possono variare durante la stagione. Per ombrellone, lettini e tende rivolgiti direttamente alla spiaggia.": ["Services and prices may vary during the season. For umbrellas, loungers and tents, please ask at the beach directly.", "Les services et tarifs peuvent varier au cours de la saison. Pour les parasols, transats et tentes, adressez-vous directement à la plage.", "Leistungen und Preise können sich im Laufe der Saison ändern. Für Sonnenschirme, Liegen und Zelte wenden Sie sich bitte direkt an den Strand.", "Los servicios y las tarifas pueden variar durante la temporada. Para sombrillas, tumbonas y toldos, dirígete directamente a la playa."],
  "Immagini": ["Gallery", "Galerie", "Bilder", "Imágenes"],
  "Informazioni": ["Information", "Informations", "Informationen", "Información"],
  "Pranzo": ["Lunch", "Déjeuner", "Mittagessen", "Comida"],
  "Cena": ["Dinner", "Dîner", "Abendessen", "Cena"],
  "Prenota": ["Book", "Réserver", "Reservieren", "Reservar"],
  "Cerca": ["Search", "Rechercher", "Suchen", "Buscar"],
  "Attiva tema scuro": ["Switch to dark theme", "Activer le thème sombre", "Dunkles Design aktivieren", "Activar tema oscuro"],
  "Attiva tema chiaro": ["Switch to light theme", "Activer le thème clair", "Helles Design aktivieren", "Activar tema claro"],
  "Cerca lingua": ["Change language", "Changer de langue", "Sprache ändern", "Cambiar idioma"],
  "Cambia lingua": ["Change language", "Changer de langue", "Sprache ändern", "Cambiar idioma"],
  "Seleziona lingua": ["Choose a language", "Choisir une langue", "Sprache auswählen", "Elige un idioma"],
  "Cerca nel sito": ["Search the site", "Rechercher sur le site", "Website durchsuchen", "Buscar en el sitio"],
  "Es. prenotazioni, cucina…": ["E.g. bookings, food…", "Ex. réservations, cuisine…", "Z. B. Reservierungen, Küche…", "Ej. reservas, cocina…"],
  "Cesenatico · Riviera Adriatica": ["Cesenatico · Adriatic Riviera", "Cesenatico · Riviera adriatique", "Cesenatico · Adriatische Riviera", "Cesenatico · Riviera Adriática"],
  "Il mare,": ["The sea,", "La mer,", "Das Meer,", "El mar,"],
  "con il suo tempo.": ["at its own pace.", "à son rythme.", "in seinem eigenen Rhythmus.", "a su propio ritmo."],
  "Una giornata da vivere senza fretta.": ["A day to enjoy at an easy pace.", "Une journée à savourer sans se presser.", "Ein Tag zum Genießen, ganz ohne Eile.", "Un día para disfrutar sin prisas."],
  "Il resto lo fa il mare.": ["The sea takes care of the rest.", "La mer s’occupe du reste.", "Den Rest übernimmt das Meer.", "El mar se encarga del resto."],
  "Prenota un tavolo": ["Book a table", "Réserver une table", "Einen Tisch reservieren", "Reservar una mesa"],
  "Scopri Marè": ["Discover Marè", "Découvrir Marè", "Marè entdecken", "Descubre Marè"],
  "Bagno Marè": ["Bagno Marè", "Bagno Marè", "Bagno Marè", "Bagno Marè"],
  "Una pausa": ["A pause", "Une pause", "Eine Pause", "Una pausa"],
  "vista mare.": ["by the sea.", "face à la mer.", "mit Meerblick.", "junto al mar."],
  "Al Bagno Marè, a Cesenatico, la giornata prende il ritmo della spiaggia e si allunga volentieri fino a tavola.": ["At Bagno Marè in Cesenatico, the day follows the rhythm of the beach and often lingers over a meal.", "Au Bagno Marè, à Cesenatico, la journée suit le rythme de la plage et se prolonge volontiers à table.", "Im Bagno Marè in Cesenatico gibt der Strand den Tagesrhythmus vor, der gern bis an den Tisch reicht.", "En Bagno Marè, en Cesenatico, el día sigue el ritmo de la playa y se alarga a gusto alrededor de la mesa."],
  "Entra nell’atmosfera": ["Step into the atmosphere", "Entrez dans l’ambiance", "Die Atmosphäre entdecken", "Entra en ambiente"],
  "La spiaggia, ogni giorno": ["The beach, every day", "La plage, chaque jour", "Der Strand, jeden Tag", "La playa, cada día"],
  "La luce cambia.": ["The light changes.", "La lumière change.", "Das Licht verändert sich.", "La luz cambia."],
  "Il mare resta.": ["The sea remains.", "La mer demeure.", "Das Meer bleibt.", "El mar permanece."],
  "Il legno chiaro, l’aria salmastra, la linea dell’orizzonte. Un luogo semplice da abitare, dalla prima luce fino a sera.": ["Pale wood, salty air, the horizon. An easygoing place to settle into, from first light to evening.", "Le bois clair, l’air salin, la ligne d’horizon. Un lieu simple à vivre, des premières lueurs jusqu’au soir.", "Helles Holz, salzige Luft, der Horizont. Ein unkomplizierter Ort, vom ersten Licht bis zum Abend.", "Madera clara, aire salino y horizonte. Un lugar sencillo para disfrutar, desde la primera luz hasta la noche."],
  "Organizza la tua visita": ["Plan your visit", "Préparer votre visite", "Besuch planen", "Organiza tu visita"],
  "A tavola": ["At the table", "À table", "Zu Tisch", "A la mesa"],
  "Il piacere": ["The pleasure", "Le plaisir", "Die Freude", "El placer"],
  "di fermarsi.": ["of slowing down.", "de prendre son temps.", "des Innehaltens.", "de hacer una pausa."],
  "Un pranzo con il mare davanti. Una cena che si prende il suo tempo. Scegli il momento, al resto pensiamo insieme.": ["Lunch with the sea in view. Dinner at an unhurried pace. Choose your moment and we’ll take it from there.", "Un déjeuner face à la mer. Un dîner qui prend son temps. Choisissez votre moment, nous nous occupons du reste.", "Mittagessen mit Meerblick. Ein Abendessen ohne Eile. Wählen Sie den Moment, um den Rest kümmern wir uns gemeinsam.", "Un almuerzo frente al mar. Una cena sin prisa. Elige el momento y del resto nos ocupamos juntos."],
  "Scegli quando venire": ["Choose when to visit", "Choisir le moment de votre visite", "Besuchszeit wählen", "Elige cuándo venir"],
  "La carta · 2026": ["The menu · 2026", "La carte · 2026", "Die Karte · 2026", "La carta · 2026"],
  "Dal primo caffè": ["From the first coffee", "Du premier café", "Vom ersten Kaffee", "Del primer café"],
  "all’ultimo calice.": ["to the last glass.", "au dernier verre.", "bis zum letzten Glas.", "a la última copa."],
  "Ogni momento ha il suo ritmo. Una carta da leggere con calma, tra il forno del mattino, la cucina di mare e la sera.": ["Every moment has its own rhythm. Take your time with a menu that moves from the morning oven to seafood and evening drinks.", "Chaque moment a son rythme. Découvrez tranquillement une carte qui va du four du matin à la cuisine de la mer et aux soirées.", "Jeder Moment hat seinen eigenen Rhythmus. Eine Karte zum entspannten Entdecken: vom Morgen aus dem Ofen bis zur Küche des Meeres und zum Abend.", "Cada momento tiene su ritmo. Una carta para leer con calma, del horno de la mañana a la cocina de mar y la noche."],
  "La cucina del Marè": ["Marè’s kitchen", "La cuisine du Marè", "Die Küche des Marè", "La cocina de Marè"],
  "Il pescato e alcune proposte seguono il mercato; il pane e i lievitati nascono dal nostro forno. Qui trovi le carte 2026, raccolte in un unico percorso.": ["The catch and some dishes follow the market; our bread and pastries come from our own oven. Explore the 2026 menus in one place.", "La pêche du jour et certaines suggestions suivent le marché ; le pain et les viennoiseries sortent de notre four. Retrouvez ici les cartes 2026.", "Der Fang des Tages und manche Gerichte richten sich nach dem Markt; Brot und Gebäck kommen aus unserem Ofen. Hier finden Sie die Karten für 2026.", "La pesca del día y algunas propuestas siguen el mercado; el pan y la bollería salen de nuestro horno. Aquí puedes consultar las cartas de 2026."],
  "Colazione": ["Breakfast", "Petit-déjeuner", "Frühstück", "Desayuno"],
  "Pranzo e cena": ["Lunch and dinner", "Déjeuner et dîner", "Mittag- und Abendessen", "Comida y cena"],
  "Aperitivo": ["Aperitif", "Apéritif", "Aperitif", "Aperitivo"],
  "Vini": ["Wines", "Vins", "Weine", "Vinos"],
  "01 / Il mattino": ["01 / Morning", "01 / Le matin", "01 / Der Morgen", "01 / La mañana"],
  "Dalle 8:30 alle 12:00": ["8:30 am to 12:00 pm", "De 8 h 30 à 12 h", "Von 8:30 bis 12:00 Uhr", "De 8:30 a 12:00"],
  "Dal banco fresco": ["From the fresh counter", "Au comptoir frais", "Aus der Frischetheke", "Del mostrador fresco"],
  "Yogurt bio": ["Organic yoghurt", "Yaourt bio", "Bio-Joghurt", "Yogur ecológico"],
  "Latte bio da piccoli produttori custodi di sapienza ancestrale. A richiesta anche senza lattosio.": ["Organic milk from small producers preserving generations of know-how. Lactose-free on request.", "Lait bio de petits producteurs, gardiens d’un savoir-faire ancestral. Sans lactose sur demande.", "Bio-Milch von kleinen Erzeugern, die überliefertes Wissen bewahren. Auf Wunsch auch laktosefrei.", "Leche ecológica de pequeños productores que conservan saberes de siempre. También sin lactosa, bajo petición."],
  "Banana, mirtilli e Biscoff belga": ["Banana, blueberries and Belgian Biscoff", "Banane, myrtilles et Biscoff belge", "Banane, Blaubeeren und belgischer Biscoff", "Plátano, arándanos y Biscoff belga"],
  "Frutti rossi e granola": ["Red berries and granola", "Fruits rouges et granola", "Rote Beeren und Granola", "Frutos rojos y granola"],
  "Dubai Chocolate": ["Dubai chocolate", "Chocolat de Dubaï", "Dubai-Schokolade", "Chocolate de Dubái"],
  "Lievitazione naturale": ["Naturally leavened", "Levain naturel", "Natürliche Gärung", "Fermentación natural"],
  "Pane tostato": ["Toasted bread", "Pain grillé", "Getoastetes Brot", "Pan tostado"],
  "Farine bio macinate a pietra. A scelta: burro d’arachidi e ciliegia in confettura; pomodoro, sale Maldon e olio romagnolo; avocado, lime, semi tostati e amaranto soffiato.": ["Stone-ground organic flour. Choose from peanut butter and cherry preserve; tomato, Maldon salt and Romagna olive oil; or avocado, lime, toasted seeds and puffed amaranth.", "Farines bio moulues à la pierre. Au choix : beurre de cacahuète et confiture de cerises ; tomate, sel Maldon et huile de Romagne ; ou avocat, citron vert, graines grillées et amarante soufflée.", "Bio-Mehl aus Steinmühlen. Zur Wahl: Erdnussbutter und Kirschkonfitüre; Tomate, Maldon-Salz und Öl aus der Romagna; oder Avocado, Limette, geröstete Kerne und gepuffter Amarant.", "Harinas ecológicas molidas a la piedra. A elegir: crema de cacahuete y confitura de cereza; tomate, sal Maldon y aceite de Romaña; o aguacate, lima, semillas tostadas y amaranto inflado."],
  "La colazione salata": ["A savoury breakfast", "Le petit-déjeuner salé", "Herzhaftes Frühstück", "Desayuno salado"],
  "Salato": ["Savoury", "Salé", "Herzhaft", "Salado"],
  "Bagel al salmone affumicato": ["Smoked salmon bagel", "Bagel au saumon fumé", "Bagel mit Räucherlachs", "Bagel de salmón ahumado"],
  "Erba cipollina e robiola.": ["Chives and robiola cheese.", "Ciboulette et robiola.", "Schnittlauch und Robiola.", "Cebollino y robiola."],
  "Focaccia al rosmarino": ["Rosemary focaccia", "Focaccia au romarin", "Rosmarin-Focaccia", "Focaccia al romero"],
  "Mortadella artigianale e burrata.": ["Artisan mortadella and burrata.", "Mortadelle artisanale et burrata.", "Mortadella aus handwerklicher Herstellung und Burrata.", "Mortadela artesanal y burrata."],
  "Sfogliata tiepida": ["Warm savoury pastry", "Feuilleté tiède", "Warmer Blätterteig", "Hojaldre templado"],
  "Culatello e taleggio.": ["Culatello ham and Taleggio cheese.", "Culatello et taleggio.", "Culatello und Taleggio.", "Culatello y taleggio."],
  "Croque Madame": ["Croque Madame", "Croque Madame", "Croque Madame", "Croque Madame"],
  "Pan brioche, prosciutto cotto, fontina, caciotta e uova al burro.": ["Brioche, cooked ham, Fontina, Caciotta and butter-fried eggs.", "Brioche, jambon cuit, fontina, caciotta et œufs au beurre.", "Brioche, Kochschinken, Fontina, Caciotta und in Butter gebratene Eier.", "Pan brioche, jamón cocido, fontina, caciotta y huevos a la mantequilla."],
  "Ogni mattina": ["Every morning", "Chaque matin", "Jeden Morgen", "Cada mañana"],
  "Dal nostro forno": ["From our oven", "De notre four", "Aus unserem Ofen", "De nuestro horno"],
  "Torte, biscotti, pani e lievitati preparati ogni giorno. Al banco: cheesecake cocco e cioccolato, pastéis de nata, cioccolato, cookie, muffin e tenerina. Viennoiserie, bignè craquelin e sfogliate dolci e salate": ["Cakes, biscuits, breads and pastries made fresh every day. At the counter: coconut and chocolate cheesecake, pastéis de nata, chocolate, cookies, muffins and tenerina cake. Viennoiserie, craquelin choux buns and sweet or savoury pastries", "Gâteaux, biscuits, pains et pâtes levées préparés chaque jour. Au comptoir : cheesecake coco-chocolat, pastéis de nata, chocolat, cookies, muffins et tenerina. Viennoiseries, choux craquelin et feuilletés sucrés ou salés", "Täglich gebackene Kuchen, Kekse, Brote und Hefegebäck. An der Theke: Kokos-Schokoladen-Cheesecake, Pastéis de Nata, Schokolade, Cookies, Muffins und Tenerina. Viennoiserie, Craquelin-Windbeutel sowie süßes und herzhaftes Blätterteiggebäck", "Tartas, galletas, panes y masas fermentadas hechas a diario. En el mostrador: cheesecake de coco y chocolate, pastéis de nata, chocolate, cookies, muffins y tenerina. Bollería francesa, éclairs craquelin y hojaldres dulces y salados"],
  ", fino a esaurimento.": [", while stocks last.", ", jusqu’à épuisement.", ", solange der Vorrat reicht.", ", hasta agotar existencias."],
  "Il mattino, dal forno": ["Morning from the oven", "Le matin, au sortir du four", "Morgens frisch aus dem Ofen", "La mañana, recién salido del horno"],
  "Impasti e lievitati accompagnano la colazione, fino a esaurimento.": ["Our doughs and pastries make breakfast, while stocks last.", "Nos pâtes et viennoiseries accompagnent le petit-déjeuner, jusqu’à épuisement.", "Teige und Hefegebäck begleiten das Frühstück, solange der Vorrat reicht.", "Nuestras masas y bollería acompañan el desayuno, hasta agotar existencias."],
  "02 / A tavola": ["02 / At the table", "02 / À table", "02 / Zu Tisch", "02 / A la mesa"],
  "La cucina di mare": ["Seafood kitchen", "La cuisine de la mer", "Die Küche des Meeres", "Cocina de mar"],
  "Le carte 2026 fornite per pranzo e cena riportano la stessa selezione. Il pescato e alcune proposte seguono il mercato.": ["The supplied 2026 lunch and dinner menus feature the same selection. The catch and some dishes follow the market.", "Les cartes 2026 fournies pour le déjeuner et le dîner proposent la même sélection. La pêche du jour et certaines suggestions suivent le marché.", "Die bereitgestellten Mittags- und Abendkarten für 2026 enthalten dieselbe Auswahl. Der Fang des Tages und manche Gerichte richten sich nach dem Markt.", "Las cartas de comida y cena de 2026 incluyen la misma selección. La pesca del día y algunas propuestas siguen el mercado."],
  "01": ["01", "01", "01", "01"],
  "Il mare crudo": ["Raw seafood", "La mer crue", "Rohes aus dem Meer", "Mar crudo"],
  "Il Crudo": ["Raw seafood selection", "Sélection crue", "Rohkost aus dem Meer", "Selección de crudos"],
  "Selezione di pesci al taglio, crostacei, ostriche e conchiglie secondo mercato. Senza glutine su richiesta.": ["A market-led selection of cut fish, shellfish, oysters and clams. Gluten-free on request.", "Sélection du marché de poissons à la coupe, crustacés, huîtres et coquillages. Sans gluten sur demande.", "Marktfrische Auswahl an geschnittenem Fisch, Krustentieren, Austern und Muscheln. Auf Wunsch glutenfrei.", "Selección de pescado al corte, crustáceos, ostras y conchas según mercado. Sin gluten bajo petición."],
  "Marinato ma non troppo": ["Just lightly marinated", "Mariné juste ce qu’il faut", "Nur leicht mariniert", "Marinado en su punto"],
  "Pesci e crostacei, olio, agrumi, orto e soia. Senza glutine su richiesta.": ["Fish and shellfish with oil, citrus, garden vegetables and soy. Gluten-free on request.", "Poissons et crustacés, huile, agrumes, légumes du jardin et soja. Sans gluten sur demande.", "Fisch und Krustentiere mit Öl, Zitrusfrüchten, Gartengemüse und Soja. Auf Wunsch glutenfrei.", "Pescados y crustáceos con aceite, cítricos, verduras y soja. Sin gluten bajo petición."],
  "Ostriche": ["Oysters", "Huîtres", "Austern", "Ostras"],
  "Secondo mercato e stagionalità.": ["Depending on the market and season.", "Selon le marché et la saison.", "Je nach Markt und Saison.", "Según mercado y temporada."],
  "Tartare di gamberi rosa": ["Pink prawn tartare", "Tartare de crevettes roses", "Tatar von rosa Garnelen", "Tartar de gambas rosadas"],
  "Brioche tostata e robiola alle erbe.": ["Toasted brioche and herb robiola.", "Brioche toastée et robiola aux herbes.", "Geröstete Brioche und Robiola mit Kräutern.", "Brioche tostado y robiola a las hierbas."],
  "Cefalo nostrano affumicato": ["Local smoked grey mullet", "Mulet local fumé", "Geräucherte Meeräsche aus der Region", "Lisa local ahumada"],
  "Burrata e bottarga.": ["Burrata and bottarga.", "Burrata et poutargue.", "Burrata und Bottarga.", "Burrata y bottarga."],
  "02": ["02", "02", "02", "02"],
  "La pasta": ["Pasta", "Les pâtes", "Pasta", "Pasta"],
  "Pasta ripiena, fresca o trafilata, sempre fatta da noi. Il piatto POP del giorno.": ["Stuffed, fresh or bronze-drawn pasta, always made in-house. The daily POP dish.", "Pâtes farcies, fraîches ou tréfilées, toujours faites maison. Le plat POP du jour.", "Gefüllte, frische oder durch Bronzeformen gezogene Pasta, stets hausgemacht. Das tägliche POP-Gericht.", "Pasta rellena, fresca o extruida, siempre hecha en casa. El plato POP del día."],
  "Il piatto POP del giorno": ["Today’s POP dish", "Le plat POP du jour", "Das POP-Gericht des Tages", "El plato POP del día"],
  "Pappardelle": ["Pappardelle", "Pappardelles", "Pappardelle", "Pappardelle"],
  "Baccalà al rosmarino, cipolla dell’acqua e tartufo.": ["Salt cod with rosemary, cipolla dell’acqua and truffle.", "Morue au romarin, cipolla dell’acqua et truffe.", "Stockfisch mit Rosmarin, cipolla dell’acqua und Trüffel.", "Bacalao al romero, cipolla dell’acqua y trufa."],
  "Pasta e fagioli": ["Pasta and beans", "Pâtes et haricots", "Pasta e fagioli", "Pasta y alubias"],
  "Passatelli, frutti di mare, crostacei e lardo di seppia.": ["Passatelli, seafood, shellfish and cuttlefish lardo.", "Passatelli, fruits de mer, crustacés et lard de seiche.", "Passatelli, Meeresfrüchte, Krustentiere und Sepialardo.", "Passatelli, marisco, crustáceos y lardo de sepia."],
  "Spaghetti XXL": ["XXL spaghetti", "Spaghetti XXL", "XXL-Spaghetti", "Espaguetis XXL"],
  "Vongole sgusciate, olio selezione Alina e bruschetta tostata.": ["Shelled clams, Alina selection olive oil and toasted bruschetta.", "Palourdes décortiquées, huile sélection Alina et bruschetta grillée.", "Ausgelöste Venusmuscheln, Öl der Selektion Alina und geröstete Bruschetta.", "Almejas sin concha, aceite selección Alina y bruschetta tostada."],
  "Monfettini": ["Monfettini pasta", "Monfettini", "Monfettini", "Monfettini"],
  "Seppie, vongole e inchiostro.": ["Cuttlefish, clams and ink.", "Seiches, palourdes et encre.", "Tintenfisch, Venusmuscheln und Tinte.", "Sepia, almejas y tinta."],
  "03": ["03", "03", "03", "03"],
  "Gli antipasti": ["Starters", "Les entrées", "Vorspeisen", "Entrantes"],
  "Mazzancolle tiepide": ["Warm prawns", "Crevettes tigrées tièdes", "Warme Riesengarnelen", "Langostinos templados"],
  "Patate all’olio e verdure iodate.": ["Oil-dressed potatoes and sea-kissed vegetables.", "Pommes de terre à l’huile et légumes iodés.", "Kartoffeln mit Öl und Gemüse mit Meeresnoten.", "Patatas al aceite y verduras con notas marinas."],
  "Triglie spinate": ["Boned red mullet", "Rougets désarêtés", "Grätenfreie Meerbarbe", "Salmonetes sin espinas"],
  "Carpione alla salvia, squacquerone, orto e pepe rosa.": ["Sage carpione, squacquerone cheese, garden vegetables and pink pepper.", "Carpione à la sauge, squacquerone, légumes du jardin et poivre rose.", "Salbei-Carpione, Squacquerone, Gartengemüse und rosa Pfeffer.", "Carpione de salvia, squacquerone, verduras y pimienta rosa."],
  "Bianchetti": ["Whitebait", "Blanchaille", "Glasfisch", "Chanquetes"],
  "Uova al burro salato, caviale e bianchetti fritti.": ["Salted-butter eggs, caviar and fried whitebait.", "Œufs au beurre salé, caviar et blanchaille frite.", "Eier mit Salzbutter, Kaviar und frittiertem Glasfisch.", "Huevos con mantequilla salada, caviar y chanquetes fritos."],
  "04": ["04", "04", "04", "04"],
  "Il mare": ["From the sea", "La mer", "Aus dem Meer", "Del mar"],
  "Brodetto di pesci di riva": ["Shore-fish brodetto", "Brodetto de poissons de rive", "Brodetto aus Küstenfisch", "Brodetto de pescado de costa"],
  "All’aceto, con crostacei e scarpetta. Anche senza glutine.": ["With vinegar, shellfish and bread for dipping. Also available gluten-free.", "Au vinaigre, avec crustacés et pain pour saucer. Aussi sans gluten.", "Mit Essig, Krustentieren und Brot zum Auftunken. Auch glutenfrei erhältlich.", "Con vinagre, crustáceos y pan para mojar. También sin gluten."],
  "Rombo gratinato": ["Gratinated turbot", "Turbot gratiné", "Gratinierter Steinbutt", "Rodaballo gratinado"],
  "Carciofi ripieni, olive e limone.": ["Stuffed artichokes, olives and lemon.", "Artichauts farcis, olives et citron.", "Gefüllte Artischocken, Oliven und Zitrone.", "Alcachofas rellenas, aceitunas y limón."],
  "Spiedo di cefalo e mazzancolle": ["Grey mullet and prawn skewer", "Brochette de mulet et crevettes tigrées", "Spieß von Meeräsche und Riesengarnelen", "Brocheta de lisa y langostinos"],
  "Erbe di campo e piadina. Anche senza glutine.": ["Wild herbs and piadina. Also available gluten-free.", "Herbes des champs et piadina. Aussi sans gluten.", "Wildkräuter und Piadina. Auch glutenfrei erhältlich.", "Hierbas silvestres y piadina. También sin gluten."],
  "Fritto": ["Fried seafood", "Friture", "Frittiertes aus dem Meer", "Fritura"],
  "Calamari, crostacei e pesce azzurro.": ["Squid, shellfish and blue fish.", "Calamars, crustacés et poissons bleus.", "Tintenfisch, Krustentiere und Blaufisch.", "Calamares, crustáceos y pescado azul."],
  "05": ["05", "05", "05", "05"],
  "Oltre il mare": ["Beyond the sea", "Au-delà de la mer", "Jenseits des Meeres", "Más allá del mar"],
  "Cappelletti al prosciutto": ["Ham cappelletti", "Cappelletti au jambon", "Cappelletti mit Schinken", "Cappelletti de jamón"],
  "Panna, ponzu e parmigiano.": ["Cream, ponzu and Parmesan.", "Crème, ponzu et parmesan.", "Sahne, Ponzu und Parmesan.", "Nata, ponzu y parmesano."],
  "Selezione di formaggi": ["Cheese selection", "Sélection de fromages", "Käseauswahl", "Selección de quesos"],
  "Formaggi di affinatori locali e fichi caramellati.": ["Cheeses matured by local affineurs, with caramelised figs.", "Fromages affinés par des artisans locaux et figues caramélisées.", "Käse von lokalen Affineuren und karamellisierte Feigen.", "Quesos madurados por afinadores locales e higos caramelizados."],
  "Chianina brasata al Sangiovese": ["Chianina braised in Sangiovese", "Chianina braisée au Sangiovese", "In Sangiovese geschmortes Chianina-Rind", "Chianina estofada al Sangiovese"],
  "Cremoso di patate al tartufo e chutney di zucca.": ["Creamy truffled potatoes and pumpkin chutney.", "Crémeux de pommes de terre à la truffe et chutney de courge.", "Cremige Trüffelkartoffeln und Kürbis-Chutney.", "Crema de patata con trufa y chutney de calabaza."],
  "Pane e burro": ["Bread and butter", "Pain et beurre", "Brot und Butter", "Pan y mantequilla"],
  "Pani del nostro forno, olio romagnolo e burro salato.": ["Breads from our oven, Romagna olive oil and salted butter.", "Pains de notre four, huile de Romagne et beurre salé.", "Brot aus unserem Ofen, Öl aus der Romagna und Salzbutter.", "Panes de nuestro horno, aceite de Romaña y mantequilla salada."],
  "Sotto Costa: una sequenza di piatti dalle piccole imbarcazioni della nostra marineria, uguale per tutto il tavolo. 65 € a persona, coperto incluso.": ["Sotto Costa: a sequence of dishes from the small boats of our local fleet, served the same for the whole table. €65 per person, cover charge included.", "Sotto Costa : une succession de plats issus des petits bateaux de notre flottille, identique pour toute la table. 65 € par personne, couvert compris.", "Sotto Costa: eine Folge von Gerichten aus den kleinen Booten unserer Flotte, für den ganzen Tisch gleich. 65 € pro Person, Gedeck inbegriffen.", "Sotto Costa: una secuencia de platos de las pequeñas embarcaciones de nuestra flota, igual para toda la mesa. 65 € por persona, cubierto incluido."],
  "Coperto e servizio: 3,50 €. Le proposte possono variare secondo disponibilità e mercato.": ["Cover and service: €3.50. Dishes may vary with availability and the market.", "Couvert et service : 3,50 €. Les propositions peuvent varier selon les disponibilités et le marché.", "Gedeck und Service: 3,50 €. Das Angebot kann je nach Verfügbarkeit und Markt variieren.", "Cubierto y servicio: 3,50 €. Las propuestas pueden variar según disponibilidad y mercado."],
  "Una carta che segue il pescato, il mercato e la stagione.": ["A menu shaped by the catch, the market and the season.", "Une carte au rythme de la pêche, du marché et des saisons.", "Eine Karte im Rhythmus des Fangs, des Marktes und der Saison.", "Una carta que sigue la pesca, el mercado y la temporada."],
  "03 / L’ora blu": ["03 / Blue hour", "03 / L’heure bleue", "03 / Blaue Stunde", "03 / La hora azul"],
  "Dal forno e dalla pescheria": ["From the oven and the fish counter", "Du four et de la poissonnerie", "Aus Ofen und Fischtheke", "Del horno y la pescadería"],
  "Da condividere": ["For sharing", "À partager", "Zum Teilen", "Para compartir"],
  "Testo": ["Testo", "Testo", "Testo", "Testo"],
  "Testo · regular": ["Testo · regular", "Testo · regular", "Testo · regular", "Testo · regular"],
  "Salumi romagnoli, formaggi e giardiniera al pepe rosa, con la nostra focaccia.": ["Romagna cured meats, cheeses and pink-pepper giardiniera, with our focaccia.", "Charcuteries de Romagne, fromages et giardiniera au poivre rose, avec notre focaccia.", "Wurstwaren aus der Romagna, Käse und Giardiniera mit rosa Pfeffer, dazu unsere Focaccia.", "Embutidos de Romaña, quesos y giardiniera con pimienta rosa, con nuestra focaccia."],
  "Testo · XL": ["Testo · XL", "Testo · XL", "Testo · XL", "Testo · XL"],
  "Una pizza a scelta, salumi, formaggi e giardiniera al pepe rosa, hummus, erbe, olive e loomi, con la nostra focaccia.": ["A pizza of your choice, cured meats, cheeses and pink-pepper giardiniera, hummus, herbs, olives and loomi, with our focaccia.", "Une pizza au choix, charcuteries, fromages et giardiniera au poivre rose, houmous, herbes, olives et loomi, avec notre focaccia.", "Pizza nach Wahl, Wurstwaren, Käse und Giardiniera mit rosa Pfeffer, Hummus, Kräuter, Oliven und Loomi, dazu unsere Focaccia.", "Una pizza a elegir, embutidos, quesos y giardiniera con pimienta rosa, hummus, hierbas, aceitunas y loomi, con nuestra focaccia."],
  "Dal forno": ["From the oven", "Du four", "Aus dem Ofen", "Del horno"],
  "Pizza al padellino": ["Pan pizza", "Pizza à la poêle", "Pizza aus der Pfanne", "Pizza al padellino"],
  "Bianca": ["Plain", "Nature", "Bianca", "Blanca"],
  "Origano, rosmarino, sale Maldon e olio.": ["Oregano, rosemary, Maldon salt and olive oil.", "Origan, romarin, sel Maldon et huile d’olive.", "Oregano, Rosmarin, Maldon-Salz und Olivenöl.", "Orégano, romero, sal Maldon y aceite."],
  "Bologna–Putignano": ["Bologna–Putignano", "Bologna–Putignano", "Bologna–Putignano", "Bologna–Putignano"],
  "Mortadella, burrata e rosmarino.": ["Mortadella, burrata and rosemary.", "Mortadelle, burrata et romarin.", "Mortadella, Burrata und Rosmarin.", "Mortadela, burrata y romero."],
  "Marinara": ["Marinara", "Marinara", "Marinara", "Marinara"],
  "Salsa marinara, pomodori marinati e acciughe.": ["Marinara sauce, marinated tomatoes and anchovies.", "Sauce marinara, tomates marinées et anchois.", "Marinara-Sauce, marinierte Tomaten und Sardellen.", "Salsa marinara, tomates marinados y anchoas."],
  "Orto": ["Garden", "Potager", "Garten", "Huerta"],
  "Pomodori, pesto d’erbe e scaglie di parmigiano.": ["Tomatoes, herb pesto and Parmesan shavings.", "Tomates, pesto d’herbes et copeaux de parmesan.", "Tomaten, Kräuterpesto und Parmesanspäne.", "Tomates, pesto de hierbas y lascas de parmesano."],
  "Plateau e pescato": ["Seafood platters and the catch", "Plateaux et pêche du jour", "Meeresfrüchteplatten und Tagesfang", "Mariscadas y pesca del día"],
  "Plateau · regular": ["Seafood platter · regular", "Plateau · regular", "Meeresfrüchteplatte · regular", "Bandeja · regular"],
  "3 ostriche, 3 crostacei e 3 conchiglie.": ["3 oysters, 3 shellfish and 3 clams.", "3 huîtres, 3 crustacés et 3 coquillages.", "3 Austern, 3 Krustentiere und 3 Muscheln.", "3 ostras, 3 crustáceos y 3 conchas."],
  "Plateau · XL": ["Seafood platter · XL", "Plateau · XL", "Meeresfrüchteplatte · XL", "Bandeja · XL"],
  "Tartare di crostacei; ostriche con panna acida e caviale; affumicato di mare, burrata e bottarga.": ["Shellfish tartare; oysters with sour cream and caviar; smoked seafood, burrata and bottarga.", "Tartare de crustacés ; huîtres, crème aigre et caviar ; fumé de la mer, burrata et poutargue.", "Krustentier-Tatar; Austern mit Sauerrahm und Kaviar; geräuchertes Meeresaroma, Burrata und Bottarga.", "Tartar de crustáceos; ostras con crema agria y caviar; ahumado de mar, burrata y bottarga."],
  "Crostacei": ["Shellfish", "Crustacés", "Krustentiere", "Crustáceos"],
  "Tartare di crostacei": ["Shellfish tartare", "Tartare de crustacés", "Krustentier-Tatar", "Tartar de crustáceos"],
  "Brioche tostata e robiola.": ["Toasted brioche and robiola.", "Brioche toastée et robiola.", "Geröstete Brioche und Robiola.", "Brioche tostado y robiola."],
  "Burrata, bottarga e soia.": ["Burrata, bottarga and soy.", "Burrata, poutargue et soja.", "Burrata, Bottarga und Soja.", "Burrata, bottarga y soja."],
  "Caviale e burro salato": ["Caviar and salted butter", "Caviar et beurre salé", "Kaviar und Salzbutter", "Caviar y mantequilla salada"],
  "Per la sera": ["For the evening", "Pour la soirée", "Für den Abend", "Para la noche"],
  "Bollicine, bianchi e rossi: la carta accompagna la tavola fino all’ultimo calice.": ["Sparkling, white and red wines: a list to accompany the table through to the last glass.", "Bulles, blancs et rouges : une carte pour accompagner la table jusqu’au dernier verre.", "Schaumweine, Weiß- und Rotweine: eine Karte, die den Abend bis zum letzten Glas begleitet.", "Espumosos, blancos y tintos: una carta para acompañar la mesa hasta la última copa."],
  "04 / La cantina": ["04 / The wine cellar", "04 / La cave", "04 / Der Weinkeller", "04 / La bodega"],
  "Carta dei vini": ["Wine list", "Carte des vins", "Weinkarte", "Carta de vinos"],
  "Italia e dal mondo": ["Italy and beyond", "D’Italie et d’ailleurs", "Italien und die Welt", "Italia y el mundo"],
  "La carta completa comprende bollicine, bianchi e rossi. Apri il documento per consultare tutte le etichette.": ["The full list includes sparkling, white and red wines. Open the document to browse all labels.", "La carte complète comprend des bulles, des blancs et des rouges. Ouvrez le document pour consulter toutes les références.", "Die vollständige Karte umfasst Schaumweine, Weiß- und Rotweine. Öffnen Sie das Dokument, um alle Weine zu entdecken.", "La carta completa incluye espumosos, blancos y tintos. Abre el documento para consultar todas las referencias."],
  "Consulta la carta completa · 31 pagine": ["View the full wine list · 31 pages", "Consulter la carte complète · 31 pages", "Vollständige Weinkarte ansehen · 31 Seiten", "Consultar la carta completa · 31 páginas"],
  "Informazioni alimentari": ["Dietary information", "Informations alimentaires", "Informationen zu Lebensmitteln", "Información alimentaria"],
  "Allergeni": ["Allergens", "Allergènes", "Allergene", "Alérgenos"],
  "Consulta il documento dedicato per allergeni e intolleranze. Per qualsiasi dubbio, chiedi al personale prima di ordinare.": ["Consult the dedicated guide for allergens and intolerances. If you have any questions, ask our staff before ordering.", "Consultez le document dédié aux allergènes et intolérances. En cas de doute, adressez-vous à notre équipe avant de commander.", "Informationen zu Allergenen und Unverträglichkeiten finden Sie im Dokument. Bei Fragen wenden Sie sich bitte vor der Bestellung an unser Team.", "Consulta el documento sobre alérgenos e intolerancias. Si tienes dudas, pregunta al personal antes de pedir."],
  "Scarica il PDF allergeni": ["Download the allergens PDF", "Télécharger le PDF des allergènes", "Allergen-PDF herunterladen", "Descargar el PDF de alérgenos"],
  "I prezzi sono in euro. Le proposte possono variare secondo disponibilità e mercato. In caso di allergie o intolleranze, consulta il PDF dedicato e informa il personale.": ["Prices are in euros. Dishes may vary with availability and the market. If you have an allergy or intolerance, consult the dedicated PDF and tell our staff.", "Les prix sont en euros. Les propositions peuvent varier selon les disponibilités et le marché. En cas d’allergie ou d’intolérance, consultez le PDF dédié et prévenez notre équipe.", "Alle Preise in Euro. Das Angebot kann je nach Verfügbarkeit und Markt variieren. Bei Allergien oder Unverträglichkeiten lesen Sie bitte das PDF und informieren Sie unser Team.", "Los precios están en euros. Las propuestas pueden variar según disponibilidad y mercado. Si tienes alergias o intolerancias, consulta el PDF e informa al personal."],
  "Quando scende il sole": ["As the sun goes down", "Quand le soleil se couche", "Wenn die Sonne untergeht", "Cuando cae el sol"],
  "La sera": ["Evening", "Le soir", "Der Abend", "La noche"],
  "ha un’altra luce.": ["in a different light.", "s’illumine autrement.", "zeigt sich in einem anderen Licht.", "tiene otra luz."],
  "Una tavola apparecchiata, il rumore delle onde poco più in là. Marè si veste piano, senza perdere la sua naturalezza.": ["A laid table, the sound of waves nearby. Marè eases into the evening while keeping its natural charm.", "Une table dressée, le bruit des vagues tout près. Marè s’habille doucement pour le soir, sans perdre son naturel.", "Ein gedeckter Tisch, das Rauschen der Wellen ganz in der Nähe. Marè wird langsam zum Abendort und bleibt dabei ganz natürlich.", "Una mesa puesta y el sonido cercano de las olas. Marè se prepara para la noche sin perder su naturalidad."],
  "Prenota per cena": ["Book for dinner", "Réserver pour le dîner", "Zum Abendessen reservieren", "Reservar para cenar"],
  "Una sera al Marè": ["An evening at Marè", "Une soirée au Marè", "Ein Abend im Marè", "Una noche en Marè"],
  "Appunti di Marè": ["Notes from Marè", "Carnet du Marè", "Notizen aus dem Marè", "Apuntes de Marè"],
  "Un luogo da ricordare.": ["A place to remember.", "Un lieu dont on se souvient.", "Ein Ort, der in Erinnerung bleibt.", "Un lugar para recordar."],
  "La spiaggia, la cucina, le occasioni da condividere.": ["The beach, the kitchen and moments to share.", "La plage, la cuisine et les moments à partager.", "Der Strand, die Küche und gemeinsame Momente.", "La playa, la cocina y momentos para compartir."],
  "Il brindisi": ["The toast", "Le toast", "Der Toast", "El brindis"],
  "Gli spazi": ["The spaces", "Les espaces", "Die Räume", "Los espacios"],
  "Le occasioni speciali": ["Special occasions", "Les grandes occasions", "Besondere Anlässe", "Ocasiones especiales"],
  "La tavola": ["The table", "La table", "Der Tisch", "La mesa"],
  "L’aperitivo": ["Aperitif", "L’apéritif", "Der Aperitif", "El aperitivo"],
  "La tua tavola": ["Your table", "Votre table", "Ihr Tisch", "Tu mesa"],
  "Ci vediamo": ["See you", "À bientôt", "Wir sehen uns", "Nos vemos"],
  "al Marè.": ["at Marè.", "au Marè.", "im Marè.", "en Marè."],
  "Scegli pranzo o cena, poi la data e l’orario che preferisci. La disponibilità viene aggiornata in tempo reale.": ["Choose lunch or dinner, then select your preferred date and time. Availability is updated in real time.", "Choisissez le déjeuner ou le dîner, puis la date et l’heure souhaitées. Les disponibilités sont mises à jour en temps réel.", "Wählen Sie Mittag- oder Abendessen und anschließend Ihr Wunschdatum und Ihre Uhrzeit. Die Verfügbarkeit wird in Echtzeit aktualisiert.", "Elige comida o cena y después la fecha y hora que prefieras. La disponibilidad se actualiza en tiempo real."],
  "La richiesta viene registrata subito, ma non è una conferma definitiva. Se hai bisogno di conferma o di una modifica, contatta direttamente lo stabilimento.": ["Your request is recorded straight away, but this is not a confirmed booking. For confirmation or changes, contact the venue directly.", "Votre demande est enregistrée immédiatement, mais ne vaut pas confirmation définitive. Pour confirmer ou modifier, contactez directement l’établissement.", "Ihre Anfrage wird sofort aufgenommen, ist aber noch keine endgültige Bestätigung. Für eine Bestätigung oder Änderung wenden Sie sich bitte direkt an das Lokal.", "La solicitud se registra de inmediato, pero no es una confirmación definitiva. Para confirmar o modificar, contacta directamente con el establecimiento."],
  "Quando vuoi venire?": ["When would you like to visit?", "Quand souhaitez-vous venir ?", "Wann möchten Sie kommen?", "¿Cuándo quieres venir?"],
  "Giorno": ["Date", "Jour", "Tag", "Día"],
  "Persone": ["Guests", "Personnes", "Personen", "Personas"],
  "Orario": ["Time", "Horaire", "Uhrzeit", "Hora"],
  "Seleziona una data per vedere gli orari disponibili.": ["Select a date to see available times.", "Choisissez une date pour voir les horaires disponibles.", "Wählen Sie ein Datum, um verfügbare Zeiten zu sehen.", "Selecciona una fecha para ver los horarios disponibles."],
  "Carico le disponibilità…": ["Loading availability…", "Chargement des disponibilités…", "Verfügbarkeit wird geladen…", "Cargando disponibilidad…"],
  "Note": ["Notes", "Notes", "Notizen", "Notas"],
  "Facoltative": ["Optional", "Facultatives", "Optional", "Opcionales"],
  "Una richiesta per il tavolo? Scrivila qui.": ["A request for your table? Write it here.", "Une demande particulière ? Écrivez-la ici.", "Ein Wunsch für Ihren Tisch? Schreiben Sie ihn hier.", "¿Alguna petición para la mesa? Escríbela aquí."],
  "Invia richiesta": ["Send request", "Envoyer la demande", "Anfrage senden", "Enviar solicitud"],
  "A nome di": ["Booking name", "Au nom de", "Auf den Namen", "A nombre de"],
  "Il nome con cui ti accoglieremo al tavolo e un numero per contattarti se serve.": ["The name we’ll welcome you by, and a number to reach you if needed.", "Le nom sous lequel nous vous accueillerons et un numéro pour vous joindre si besoin.", "Der Name, unter dem wir Sie am Tisch empfangen, und eine Nummer, unter der wir Sie bei Bedarf erreichen.", "El nombre con el que te recibiremos en la mesa y un número para contactarte si hace falta."],
  "Nome e cognome": ["Full name", "Nom et prénom", "Vor- und Nachname", "Nombre y apellidos"],
  "Es. Giulia Rossi": ["E.g. Giulia Rossi", "Ex. Giulia Rossi", "Z. B. Giulia Rossi", "Ej. Giulia Rossi"],
  "Telefono": ["Phone", "Téléphone", "Telefon", "Teléfono"],
  "Sito web": ["Website", "Site web", "Website", "Sitio web"],
  "Per gruppi più numerosi contatta lo stabilimento.": ["For larger groups, please contact the venue.", "Pour les groupes plus nombreux, contactez l’établissement.", "Für größere Gruppen wenden Sie sich bitte an das Lokal.", "Para grupos más numerosos, contacta con el establecimiento."],
  "Il tuo tavolo": ["Your table", "Votre table", "Ihr Tisch", "Tu mesa"],
  "Scegli un orario per completare il riepilogo.": ["Choose a time to complete the summary.", "Choisissez un horaire pour compléter le récapitulatif.", "Wählen Sie eine Uhrzeit, um die Übersicht zu vervollständigen.", "Elige una hora para completar el resumen."],
  "La richiesta non è una conferma definitiva: il gestore la verifica e, se serve, ti contatta al numero indicato. Nome e telefono vengono usati solo per gestire la prenotazione.": ["Your request is not a final confirmation: the manager reviews it and, if needed, contacts you on the number provided. Your name and phone number are used only to manage the booking.", "La demande ne vaut pas confirmation définitive : le responsable la vérifie et, si nécessaire, vous contacte au numéro indiqué. Votre nom et votre téléphone servent uniquement à gérer la réservation.", "Die Anfrage ist noch keine endgültige Bestätigung: Die Leitung prüft sie und meldet sich bei Bedarf unter der angegebenen Nummer. Name und Telefonnummer werden nur zur Bearbeitung der Reservierung verwendet.", "La solicitud no es una confirmación definitiva: el responsable la revisa y, si hace falta, te contacta en el número indicado. El nombre y el teléfono solo se usan para gestionar la reserva."],
  "Indica quante persone sarete per vedere gli orari.": ["Enter the number of guests to see available times.", "Indiquez le nombre de personnes pour voir les horaires.", "Geben Sie die Personenzahl an, um die Uhrzeiten zu sehen.", "Indica cuántas personas seréis para ver los horarios."],
  "Questa data non è ancora prenotabile online. Scegli una data più vicina.": ["This date can’t be booked online yet. Choose an earlier date.", "Cette date n’est pas encore réservable en ligne. Choisissez une date plus proche.", "Dieses Datum ist online noch nicht buchbar. Wählen Sie ein früheres Datum.", "Esta fecha aún no se puede reservar en línea. Elige una fecha más próxima."],
  "Inserisci il nome a cui intestare il tavolo.": ["Enter the name for the booking.", "Indiquez le nom de la réservation.", "Geben Sie den Namen für die Reservierung ein.", "Introduce el nombre de la reserva."],
  "Usa solo lettere, spazi e apostrofi (almeno 2 caratteri).": ["Use letters, spaces and apostrophes only (at least 2 characters).", "Utilisez uniquement des lettres, des espaces et des apostrophes (2 caractères minimum).", "Bitte nur Buchstaben, Leerzeichen und Apostrophe verwenden (mindestens 2 Zeichen).", "Usa solo letras, espacios y apóstrofos (al menos 2 caracteres)."],
  "Inserisci un numero di telefono per eventuali comunicazioni.": ["Enter a phone number so we can reach you if needed.", "Indiquez un numéro de téléphone pour vous joindre si besoin.", "Geben Sie eine Telefonnummer an, damit wir Sie bei Bedarf erreichen.", "Introduce un número de teléfono para poder contactarte si hace falta."],
  "Controlla il numero: servono da 6 a 15 cifre, con prefisso facoltativo.": ["Check the number: it needs 6 to 15 digits, with an optional country code.", "Vérifiez le numéro : il faut entre 6 et 15 chiffres, indicatif facultatif.", "Bitte prüfen Sie die Nummer: 6 bis 15 Ziffern, Vorwahl optional.", "Revisa el número: debe tener entre 6 y 15 dígitos, con prefijo opcional."],
  "Controlla i campi evidenziati per continuare.": ["Please check the highlighted fields to continue.", "Vérifiez les champs signalés pour continuer.", "Bitte prüfen Sie die markierten Felder.", "Revisa los campos señalados para continuar."],
  "Inserisci il nome per la prenotazione: almeno 2 lettere.": ["Enter the booking name: at least 2 letters.", "Indiquez le nom de la réservation : au moins 2 lettres.", "Geben Sie den Namen für die Reservierung ein: mindestens 2 Buchstaben.", "Introduce el nombre de la reserva: al menos 2 letras."],
  "Inserisci un numero di telefono valido, con almeno 6 cifre.": ["Enter a valid phone number with at least 6 digits.", "Indiquez un numéro de téléphone valide d’au moins 6 chiffres.", "Geben Sie eine gültige Telefonnummer mit mindestens 6 Ziffern ein.", "Introduce un número de teléfono válido de al menos 6 dígitos."],
  "Scegli una data valida.": ["Choose a valid date.", "Choisissez une date valide.", "Wählen Sie ein gültiges Datum.", "Elige una fecha válida."],
  "Scegli pranzo o cena.": ["Choose lunch or dinner.", "Choisissez déjeuner ou dîner.", "Wählen Sie Mittag- oder Abendessen.", "Elige comida o cena."],
  "Scegli un orario valido.": ["Choose a valid time.", "Choisissez un horaire valide.", "Wählen Sie eine gültige Uhrzeit.", "Elige un horario válido."],
  "Questo orario non è prenotabile online. Scegli un’altra data o un altro orario.": ["This time can’t be booked online. Choose another date or time.", "Cet horaire n’est pas réservable en ligne. Choisissez une autre date ou un autre horaire.", "Diese Uhrzeit ist online nicht buchbar. Wählen Sie ein anderes Datum oder eine andere Uhrzeit.", "Este horario no se puede reservar en línea. Elige otra fecha u otra hora."],
  "Per i gruppi più numerosi contatta direttamente lo stabilimento.": ["For larger groups, please contact the venue directly.", "Pour les groupes plus nombreux, contactez directement l’établissement.", "Für größere Gruppen wenden Sie sich bitte direkt an das Lokal.", "Para grupos más numerosos, contacta directamente con el establecimiento."],
  "Hai inviato molte richieste in poco tempo. Riprova più tardi o contatta lo stabilimento.": ["You’ve sent several requests in a short time. Try again later or contact the venue.", "Vous avez envoyé plusieurs demandes en peu de temps. Réessayez plus tard ou contactez l’établissement.", "Sie haben in kurzer Zeit mehrere Anfragen gesendet. Bitte versuchen Sie es später erneut oder kontaktieren Sie das Lokal.", "Has enviado varias solicitudes en poco tiempo. Inténtalo más tarde o contacta con el establecimiento."],
  "Da sapere": ["Good to know", "À savoir", "Gut zu wissen", "A tener en cuenta"],
  "Qualche risposta,": ["A few answers,", "Quelques réponses,", "Ein paar Antworten,", "Algunas respuestas,"],
  "prima di venire.": ["before you visit.", "avant votre visite.", "bevor Sie kommen.", "antes de venir."],
  "Come funziona la prenotazione?": ["How does booking work?", "Comment fonctionne la réservation ?", "Wie funktioniert die Reservierung?", "¿Cómo funciona la reserva?"],
  "Scegli pranzo o cena, la data, il numero di persone e un orario disponibile, poi indica nome e telefono e invia la richiesta. La richiesta viene registrata subito, ma non equivale a una conferma definitiva: il gestore la verifica e può contattarti al numero indicato.": ["Choose lunch or dinner, the date, the number of guests and an available time, then enter your name and phone number and send the request. It is recorded straight away, but is not a final confirmation: the manager reviews it and may contact you on the number provided.", "Choisissez le déjeuner ou le dîner, la date, le nombre de personnes et un horaire disponible, puis indiquez votre nom et votre téléphone et envoyez la demande. Elle est enregistrée immédiatement, mais ne vaut pas confirmation : le responsable la vérifie et peut vous contacter au numéro indiqué.", "Wählen Sie Mittag- oder Abendessen, das Datum, die Personenzahl und eine verfügbare Uhrzeit, geben Sie dann Name und Telefonnummer an und senden Sie die Anfrage. Sie wird sofort aufgenommen, ist aber noch keine endgültige Bestätigung: Die Leitung prüft sie und kann Sie unter der angegebenen Nummer kontaktieren.", "Elige comida o cena, la fecha, el número de personas y un horario disponible; después indica tu nombre y teléfono y envía la solicitud. Se registra de inmediato, pero no es una confirmación definitiva: el responsable la revisa y puede contactarte en el número indicado."],
  "Siamo un gruppo numeroso: come facciamo?": ["We’re a large group: what should we do?", "Nous sommes un grand groupe : comment faire ?", "Wir sind eine große Gruppe: Was sollen wir tun?", "Somos un grupo grande: ¿cómo lo hacemos?"],
  "La prenotazione online è pensata per i tavoli più piccoli. Per gruppi numerosi, eventi privati o aziendali contatta direttamente lo stabilimento.": ["Online booking is designed for smaller tables. For large groups, private or corporate events, please contact the venue directly.", "La réservation en ligne est pensée pour les petites tables. Pour les grands groupes et les événements privés ou d’entreprise, contactez directement l’établissement.", "Die Online-Reservierung ist für kleinere Tische gedacht. Für große Gruppen sowie private oder Firmenveranstaltungen wenden Sie sich bitte direkt an das Lokal.", "La reserva en línea está pensada para mesas pequeñas. Para grupos numerosos y eventos privados o de empresa, contacta directamente con el establecimiento."],
  "Posso prenotare ombrellone e lettini da qui?": ["Can I book an umbrella and loungers here?", "Puis-je réserver parasol et transats ici ?", "Kann ich hier Sonnenschirm und Liegen buchen?", "¿Puedo reservar sombrilla y tumbonas aquí?"],
  "No: questo modulo riguarda il ristorante. Per ombrellone, lettini e tende rivolgiti direttamente alla spiaggia.": ["No: this form is for the restaurant. For umbrellas, loungers and tents, please ask at the beach directly.", "Non : ce formulaire concerne le restaurant. Pour les parasols, transats et tentes, adressez-vous directement à la plage.", "Nein: Dieses Formular gilt für das Restaurant. Für Sonnenschirme, Liegen und Zelte wenden Sie sich bitte direkt an den Strand.", "No: este formulario es para el restaurante. Para sombrillas, tumbonas y toldos, dirígete directamente a la playa."],
  "Non vedo orari disponibili. Cosa significa?": ["I can’t see any available times. What does that mean?", "Aucun horaire disponible ne s’affiche. Qu’est-ce que cela signifie ?", "Ich sehe keine verfügbaren Zeiten. Was bedeutet das?", "No veo horarios disponibles. ¿Qué significa?"],
  "Può significare che gli orari non sono stati configurati per la data, che il servizio è terminato oppure che i coperti sono esauriti. Orari e capienze sono definiti dallo stabilimento.": ["Times may not have been set for that date, service may have ended, or capacity may be full. The venue sets its times and capacity.", "Les horaires ne sont peut-être pas configurés pour cette date, le service est peut-être terminé ou la capacité est atteinte. Les horaires et capacités sont définis par l’établissement.", "Möglicherweise wurden für dieses Datum keine Zeiten eingerichtet, der Service ist beendet oder die Plätze sind ausgebucht. Zeiten und Kapazitäten legt das Lokal fest.", "Puede que no se hayan configurado horarios para esa fecha, que el servicio haya terminado o que se haya completado el aforo. El establecimiento define los horarios y la capacidad."],
  "Posso aggiungere una nota?": ["Can I add a note?", "Puis-je ajouter une note ?", "Kann ich eine Notiz hinzufügen?", "¿Puedo añadir una nota?"],
  "Sì. Puoi lasciare una richiesta utile per il tavolo, ad esempio un seggiolone o un’intolleranza da segnalare. Nome e telefono vanno indicati nei campi dedicati.": ["Yes. You can leave a request for your table, such as a high chair or an intolerance to flag. Please enter your name and phone number in their own fields.", "Oui. Vous pouvez laisser une demande pour votre table, par exemple une chaise haute ou une intolérance à signaler. Indiquez nom et téléphone dans les champs prévus.", "Ja. Sie können einen Wunsch für Ihren Tisch hinterlassen, etwa einen Kinderstuhl oder eine Unverträglichkeit. Name und Telefonnummer gehören in die eigenen Felder.", "Sí. Puedes dejar una petición para la mesa, por ejemplo una trona o una intolerancia que avisar. El nombre y el teléfono van en sus campos."],
  "Dove trovo il menù?": ["Where can I find the menu?", "Où trouver la carte ?", "Wo finde ich die Speisekarte?", "¿Dónde encuentro la carta?"],
  "La carta 2026 è consultabile nella sezione Menu. Per allergeni e intolleranze trovi il documento dedicato; se hai dubbi, chiedi al personale prima di ordinare.": ["The 2026 menu is in the Menu section. For allergens and intolerances, see the dedicated document; if you have questions, ask our staff before ordering.", "La carte 2026 se trouve dans la section Menu. Pour les allergènes et intolérances, consultez le document dédié ; en cas de doute, demandez à notre équipe avant de commander.", "Die Karte für 2026 finden Sie im Bereich Menü. Informationen zu Allergenen und Unverträglichkeiten stehen im entsprechenden Dokument. Bei Fragen wenden Sie sich bitte vor der Bestellung an unser Team.", "La carta de 2026 está en la sección Menú. Para alérgenos e intolerancias, consulta el documento específico; si tienes dudas, pregunta al personal antes de pedir."],
  "La prossima": ["Your next", "Votre prochaine", "Der nächste", "Tu próximo"],
  "bella giornata": ["beautiful day", "belle journée", "schöne Tag", "buen día"],
  "comincia qui.": ["starts here.", "commence ici.", "beginnt hier.", "empieza aquí."],
  "Prenota la tua tavola": ["Book your table", "Réservez votre table", "Tisch reservieren", "Reserva tu mesa"],
  "Emilia-Romagna, Italia": ["Emilia-Romagna, Italy", "Émilie-Romagne, Italie", "Emilia-Romagna, Italien", "Emilia-Romaña, Italia"],
  "Orari e disponibilità sono definiti dallo stabilimento.": ["Opening times and availability are set by the venue.", "Les horaires et disponibilités sont définis par l’établissement.", "Öffnungszeiten und Verfügbarkeit legt das Lokal fest.", "El establecimiento define los horarios y la disponibilidad."],
  "Area gestione": ["Management", "Gestion", "Verwaltung", "Gestión"],
  "Vai alle prenotazioni": ["Go to bookings", "Accéder aux réservations", "Zu den Reservierungen", "Ir a las reservas"],
  "Torna all’inizio": ["Back to top", "Retour en haut", "Zurück nach oben", "Volver arriba"],
  "Chiudi": ["Close", "Fermer", "Schließen", "Cerrar"],
  "Richiesta inviata": ["Request sent", "Demande envoyée", "Anfrage gesendet", "Solicitud enviada"],
  "Richiesta ricevuta.": ["Request received.", "Demande reçue.", "Anfrage erhalten.", "Solicitud recibida."],
  "Codice prenotazione": ["Booking reference", "Référence de réservation", "Reservierungscode", "Código de reserva"],
  "Copia": ["Copy", "Copier", "Kopieren", "Copiar"],
  "La richiesta è stata registrata. Per sapere se è confermata o chiedere una modifica, contatta direttamente lo stabilimento. Conserva il codice per i tuoi appunti.": ["Your request has been recorded. To check whether it is confirmed or request a change, contact the venue directly. Keep the reference for your records.", "Votre demande a été enregistrée. Pour savoir si elle est confirmée ou demander une modification, contactez directement l’établissement. Gardez la référence.", "Ihre Anfrage wurde aufgenommen. Ob sie bestätigt ist oder für eine Änderung wenden Sie sich bitte direkt an das Lokal. Notieren Sie sich den Code.", "Tu solicitud se ha registrado. Para saber si está confirmada o pedir un cambio, contacta directamente con el establecimiento. Guarda el código."],
  "Stampa riepilogo": ["Print summary", "Imprimer le récapitulatif", "Übersicht drucken", "Imprimir resumen"],
  "Fatto": ["Done", "Terminé", "Fertig", "Hecho"],
  "Nessun risultato trovato.": ["No results found.", "Aucun résultat trouvé.", "Keine Ergebnisse gefunden.", "No se han encontrado resultados."],
  "posti": ["seats", "places", "Plätze", "plazas"],
  "non disponibile": ["unavailable", "indisponible", "nicht verfügbar", "no disponible"],
  "Non riesco a caricare gli orari.": ["I can’t load the available times.", "Impossible de charger les horaires.", "Die verfügbaren Zeiten können nicht geladen werden.", "No se pueden cargar los horarios."],
  "Non sono ancora stati configurati orari per questo servizio.": ["Times have not been set for this service yet.", "Aucun horaire n’a encore été défini pour ce service.", "Für diesen Service wurden noch keine Zeiten eingerichtet.", "Aún no se han configurado horarios para este servicio."],
  "Non restano orari prenotabili in questa data.": ["No bookable times remain on this date.", "Il ne reste aucun horaire réservable à cette date.", "An diesem Datum sind keine buchbaren Zeiten mehr frei.", "No quedan horarios disponibles para esta fecha."],
  "Non ci sono orari prenotabili per questa data.": ["There are no bookable times on this date.", "Aucun horaire réservable à cette date.", "An diesem Datum gibt es keine buchbaren Zeiten.", "No hay horarios disponibles para esta fecha."],
  "Non ci sono fasce con posti sufficienti per il numero di persone scelto.": ["No time slot has enough seats for the number of guests selected.", "Aucun créneau ne dispose d’assez de places pour le nombre de personnes choisi.", "Kein Zeitfenster bietet genügend Plätze für die gewählte Personenzahl.", "Ningún horario tiene plazas suficientes para el número de personas seleccionado."],
  "Il servizio prenotazioni non è raggiungibile al momento. Riprova più tardi.": ["The booking service is currently unavailable. Please try again later.", "Le service de réservation est momentanément indisponible. Réessayez plus tard.", "Der Reservierungsservice ist derzeit nicht erreichbar. Bitte versuchen Sie es später erneut.", "El servicio de reservas no está disponible en este momento. Inténtalo más tarde."],
  "Scegli una data e un orario disponibile per continuare.": ["Choose a date and an available time to continue.", "Choisissez une date et un horaire disponible pour continuer.", "Wählen Sie ein Datum und eine verfügbare Uhrzeit, um fortzufahren.", "Elige una fecha y un horario disponible para continuar."],
  "Inserisci un numero di persone valido.": ["Enter a valid number of guests.", "Indiquez un nombre de personnes valide.", "Geben Sie eine gültige Personenzahl ein.", "Introduce un número válido de personas."],
  "Registro la prenotazione…": ["Recording your request…", "Enregistrement de votre demande…", "Ihre Anfrage wird erfasst…", "Registrando la solicitud…"],
  "La prenotazione non è stata registrata.": ["Your booking request could not be recorded.", "La demande de réservation n’a pas pu être enregistrée.", "Die Reservierungsanfrage konnte nicht gespeichert werden.", "No se ha podido registrar la solicitud de reserva."],
  "Richiesta inviata. È in attesa della verifica del gestore.": ["Request sent. It is awaiting review by the manager.", "Demande envoyée. Elle attend la vérification du responsable.", "Anfrage gesendet. Sie wartet auf die Prüfung durch die Leitung.", "Solicitud enviada. Está pendiente de revisión por parte del responsable."],
  "Codice copiato.": ["Reference copied.", "Référence copiée.", "Code kopiert.", "Código copiado."],
  "Seleziona e copia il codice: ": ["Select and copy the reference: ", "Sélectionnez et copiez la référence : ", "Code markieren und kopieren: ", "Selecciona y copia el código: "],
  "Accedi per continuare.": ["Sign in to continue.", "Connectez-vous pour continuer.", "Bitte melden Sie sich an, um fortzufahren.", "Inicia sesión para continuar."],
  "Risorsa non trovata.": ["Resource not found.", "Ressource introuvable.", "Ressource nicht gefunden.", "Recurso no encontrado."],
  "Seleziona una data e un servizio validi.": ["Select a valid date and service.", "Sélectionnez une date et un service valides.", "Wählen Sie ein gültiges Datum und einen gültigen Service.", "Selecciona una fecha y un servicio válidos."],
  "Il numero di persone non è valido.": ["The number of guests is invalid.", "Le nombre de personnes n’est pas valide.", "Die Personenzahl ist ungültig.", "El número de personas no es válido."],
  "Questo orario non è più disponibile.": ["This time is no longer available.", "Cet horaire n’est plus disponible.", "Diese Uhrzeit ist nicht mehr verfügbar.", "Este horario ya no está disponible."],
  "I posti per questo orario sono terminati. Scegli un altro orario.": ["There are no seats left at this time. Choose another time.", "Il n’y a plus de places à cet horaire. Choisissez-en un autre.", "Für diese Uhrzeit sind keine Plätze mehr frei. Bitte wählen Sie eine andere.", "No quedan plazas para esta hora. Elige otra."],
  "La capienza giornaliera è stata raggiunta.": ["The daily capacity has been reached.", "La capacité journalière est atteinte.", "Die Tageskapazität ist erreicht.", "Se ha alcanzado el aforo diario."],
  "Non è stato possibile salvare la prenotazione. Riprova.": ["The booking request could not be saved. Please try again.", "Impossible d’enregistrer la demande. Réessayez.", "Die Anfrage konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.", "No se ha podido guardar la solicitud. Inténtalo de nuevo."],
  "Troppi tentativi. Riprova tra qualche minuto.": ["Too many attempts. Try again in a few minutes.", "Trop de tentatives. Réessayez dans quelques minutes.", "Zu viele Versuche. Bitte versuchen Sie es in einigen Minuten erneut.", "Demasiados intentos. Vuelve a intentarlo dentro de unos minutos."],
  "Nome utente o password non corretti.": ["Incorrect username or password.", "Nom d’utilisateur ou mot de passe incorrect.", "Benutzername oder Passwort falsch.", "Nombre de usuario o contraseña incorrectos."],
};

function translatePhrase(italian) {
  if (!italian || activeLanguage === "it") return italian;
  const translations = languageCopy[italian];
  if (!translations) return italian;
  return translations[languageOrder.indexOf(activeLanguage)] || italian;
}

function setLocalizedText(element, italian) {
  element.dataset.localeSource = italian;
  element.textContent = translatePhrase(italian);
}

function formatBookingSummary(payload) {
  const date = new Intl.DateTimeFormat(languageLocales[activeLanguage], { weekday: "long", day: "numeric", month: "long" }).format(new Date(payload.date + "T12:00:00"));
  const guests = Number(payload.guests);
  const service = {
    it: payload.service === "pranzo" ? "pranzo" : "cena",
    en: payload.service === "pranzo" ? "lunch" : "dinner",
    fr: payload.service === "pranzo" ? "déjeuner" : "dîner",
    de: payload.service === "pranzo" ? "Mittagessen" : "Abendessen",
    es: payload.service === "pranzo" ? "comida" : "cena"
  }[activeLanguage];
  const people = {
    it: guests === 1 ? "persona" : "persone",
    en: guests === 1 ? "guest" : "guests",
    fr: guests === 1 ? "personne" : "personnes",
    de: guests === 1 ? "Gast" : "Gäste",
    es: guests === 1 ? "persona" : "personas"
  }[activeLanguage];
  const nameLabel = { it: "a nome di", en: "under the name", fr: "au nom de", de: "auf den Namen", es: "a nombre de" }[activeLanguage];
  const nameSuffix = payload.name ? ", " + nameLabel + " " + payload.name : "";
  let sentence = "Tavolo per " + guests + " " + people + ", " + service + " di " + date + " alle " + payload.time;
  if (activeLanguage === "en") sentence = "Table for " + guests + " " + people + ", " + service + " on " + date + " at " + payload.time;
  if (activeLanguage === "fr") sentence = "Réservation pour " + guests + " " + people + ", le " + date + " à " + payload.time + " pour le " + service;
  if (activeLanguage === "de") sentence = "Tisch für " + guests + " " + people + ", zum " + service + " am " + date + " um " + payload.time;
  if (activeLanguage === "es") sentence = "Mesa para " + guests + " " + people + ", " + service + " del " + date + " a las " + payload.time;
  return sentence + nameSuffix + ".";
}

function cleanName(value) {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

function updateBookingSummary() {
  const time = selectedTime();
  const guests = Number(bookingGuests.value);
  if (!bookingDate.value || !time || !Number.isInteger(guests) || guests < 1) {
    setLocalizedText(bookingSummaryText, "Scegli un orario per completare il riepilogo.");
    return;
  }
  delete bookingSummaryText.dataset.localeSource;
  bookingSummaryText.textContent = formatBookingSummary({ date: bookingDate.value, service: selectedService(), time: time, guests: guests, name: cleanName(bookingName.value) });
}

function setFieldError(input, errorElement, message) {
  setLocalizedText(errorElement, message || "");
  errorElement.hidden = !message;
  if (!input) return;
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

function validateName(showError) {
  const value = cleanName(bookingName.value);
  let message = "";
  if (!value) message = "Inserisci il nome a cui intestare il tavolo.";
  else if (value.length < 2 || value.length > 80 || !NAME_PATTERN.test(value)) message = "Usa solo lettere, spazi e apostrofi (almeno 2 caratteri).";
  if (showError || !message) setFieldError(bookingName, bookingNameError, message);
  return message ? "" : value;
}

function validatePhone(showError) {
  const value = bookingPhone.value.replace(/[\s().\-\/]/g, "");
  let message = "";
  if (!value) message = "Inserisci un numero di telefono per eventuali comunicazioni.";
  else if (!PHONE_PATTERN.test(value)) message = "Controlla il numero: servono da 6 a 15 cifre, con prefisso facoltativo.";
  if (showError || !message) setFieldError(bookingPhone, bookingPhoneError, message);
  return message ? "" : value;
}

function applyLanguage(language, refreshAvailability) {
  if (!languageCodes[language]) return;
  activeLanguage = language;
  document.documentElement.lang = language;
  try { localStorage.setItem("mareLanguage", language); } catch (_) {}

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let textNode;
  while ((textNode = walker.nextNode())) {
    if (!Object.prototype.hasOwnProperty.call(textNode, "_mareItalianText")) textNode._mareItalianText = textNode.nodeValue;
    const original = textNode._mareItalianText;
    const trimmed = original.trim();
    if (!trimmed) continue;
    const leading = original.slice(0, original.indexOf(trimmed));
    const trailing = original.slice(original.indexOf(trimmed) + trimmed.length);
    textNode.nodeValue = leading + translatePhrase(trimmed) + trailing;
  }

  document.querySelectorAll("[data-locale-source]").forEach(function (element) {
    element.textContent = translatePhrase(element.dataset.localeSource);
  });

  const attributes = ["aria-label", "alt", "title", "placeholder"];
  document.querySelectorAll("[aria-label], [alt], [title], [placeholder]").forEach(function (element) {
    if (!element._mareItalianAttributes) {
      element._mareItalianAttributes = {};
      attributes.forEach(function (attribute) {
        if (element.hasAttribute(attribute)) element._mareItalianAttributes[attribute] = element.getAttribute(attribute);
      });
    }
    attributes.forEach(function (attribute) {
      const original = element._mareItalianAttributes[attribute];
      if (original) element.setAttribute(attribute, translatePhrase(original));
    });
  });

  document.title = translatePhrase("Bagno Marè | Cesenatico");
  const description = "Bagno Marè, Cesenatico. Una giornata al mare, una tavola da condividere, il piacere di fermarsi.";
  const socialDescription = "Una giornata al mare, una tavola da condividere, il piacere di fermarsi.";
  const socialTitle = document.querySelector('meta[property="og:title"]');
  if (socialTitle) socialTitle.content = translatePhrase("Bagno Marè | Cesenatico");
  const metaDescription = document.querySelector('meta[name="description"]');
  const openGraphDescription = document.querySelector('meta[property="og:description"]');
  if (metaDescription) metaDescription.content = translatePhrase(description);
  if (openGraphDescription) openGraphDescription.content = translatePhrase(socialDescription);
  const openGraphLocale = document.querySelector('meta[property="og:locale"]');
  if (openGraphLocale) openGraphLocale.content = { it: "it_IT", en: "en_GB", fr: "fr_FR", de: "de_DE", es: "es_ES" }[language];

  document.querySelector("#languageCode").textContent = languageCodes[language];
  document.querySelector("#languageSummary").setAttribute("aria-label", translatePhrase("Cambia lingua"));
  document.querySelector(".language-options").setAttribute("aria-label", translatePhrase("Seleziona lingua"));
  document.querySelectorAll(".language-options button").forEach(function (button) {
    button.setAttribute("aria-pressed", String(button.dataset.language === language));
  });

  const themeIsDark = document.body.dataset.theme === "dark";
  document.querySelector("#themeToggle").setAttribute("aria-label", translatePhrase(themeIsDark ? "Attiva tema chiaro" : "Attiva tema scuro"));
  document.querySelector("#searchResults").replaceChildren();
  if (lastBookingPayload && confirmationDialog.open) document.querySelector("#confirmationSummary").textContent = formatBookingSummary(lastBookingPayload);
  updateBookingSummary();
  if (refreshAvailability && bookingDate.value) loadAvailability(selectedTime());
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function selectedService() {
  return document.querySelector('input[name="service"]:checked').value;
}

function setBookingMessage(message, kind) {
  if (message) setLocalizedText(bookingMessage, message);
  else setLocalizedText(bookingMessage, "");
  bookingMessage.classList.toggle("is-error", kind === "error");
  bookingMessage.classList.toggle("is-success", kind === "success");
}

function selectedTime() {
  const input = document.querySelector('input[name="time"]:checked');
  return input ? input.value : "";
}

function showTimeHint(message, isNotice) {
  const hint = document.createElement("p");
  hint.className = isNotice ? "form-hint is-notice" : "form-hint";
  setLocalizedText(hint, message);
  timeOptions.replaceChildren(hint);
}

async function loadAvailability(preferredTime) {
  // Usato anche come gestore di eventi: in quel caso il primo argomento è un Event.
  const selectedTimeToKeep = typeof preferredTime === "string" ? preferredTime : selectedTime();
  const requestId = ++availabilityRequest;
  setBookingMessage("", "");
  setFieldError(null, timeError, "");
  if (!bookingDate.value) {
    showTimeHint("Seleziona una data per vedere gli orari disponibili.", false);
    updateBookingSummary();
    return;
  }
  const guests = Number(bookingGuests.value);
  if (!Number.isInteger(guests) || guests < 1) {
    showTimeHint("Indica quante persone sarete per vedere gli orari.", false);
    updateBookingSummary();
    return;
  }
  if (guests > bookingConfig.maxGuests) {
    showTimeHint("Per gruppi più numerosi contatta lo stabilimento.", true);
    updateBookingSummary();
    return;
  }
  showTimeHint("Carico le disponibilità…", false);
  const query = new URLSearchParams({ date: bookingDate.value, service: selectedService(), guests: String(guests) });
  try {
    const response = await fetch("/api/availability?" + query.toString(), { headers: { Accept: "application/json" } });
    const result = await response.json();
    if (requestId !== availabilityRequest) return;
    if (!response.ok) throw new Error(result.error || "Non riesco a caricare gli orari.");
    if (!result.slots.length) {
      const emptyMessages = {
        not_configured: "Non sono ancora stati configurati orari per questo servizio.",
        no_future_slots: "Non restano orari prenotabili in questa data.",
        out_of_range: "Questa data non è ancora prenotabile online. Scegli una data più vicina."
      };
      showTimeHint(emptyMessages[result.state] || "Non ci sono orari prenotabili per questa data.", true);
      updateBookingSummary();
      return;
    }
    timeOptions.replaceChildren();
    result.slots.forEach(function (slot) {
      const label = document.createElement("label");
      label.className = "time-choice";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "time";
      input.value = slot.time;
      input.disabled = !slot.available;
      input.checked = slot.available && slot.time === selectedTimeToKeep;
      input.addEventListener("change", function () {
        setFieldError(null, timeError, "");
        updateBookingSummary();
      });
      const text = document.createElement("span");
      text.textContent = slot.available ? slot.time + " · " + slot.remaining + " " + translatePhrase("posti") : slot.time + " · " + translatePhrase("non disponibile");
      label.append(input, text);
      timeOptions.append(label);
    });
    if (!result.slots.some(function (slot) { return slot.available; })) {
      const hint = document.createElement("p");
      hint.className = "form-hint is-notice";
      setLocalizedText(hint, "Non ci sono fasce con posti sufficienti per il numero di persone scelto.");
      timeOptions.append(hint);
    }
    updateBookingSummary();
  } catch (error) {
    if (requestId !== availabilityRequest) return;
    showTimeHint("Il servizio prenotazioni non è raggiungibile al momento. Riprova più tardi.", true);
    setBookingMessage(error.message, "error");
    updateBookingSummary();
  }
}

async function loadBookingConfig() {
  try {
    const response = await fetch("/api/booking-config", { headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const config = await response.json();
    if (Number.isInteger(config.maxGuests) && config.maxGuests > 0) {
      bookingConfig.maxGuests = config.maxGuests;
      bookingGuests.max = String(config.maxGuests);
    }
    if (typeof config.lastDay === "string") bookingDate.max = config.lastDay;
  } catch (_) {}
}

function readUtmParameters() {
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  const current = new URLSearchParams(window.location.search);
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem("mareUtm") || "{}"); } catch (_) { saved = {}; }
  keys.forEach(function (key) {
    const value = current.get(key);
    if (value) saved[key] = value.slice(0, 150);
  });
  try { sessionStorage.setItem("mareUtm", JSON.stringify(saved)); } catch (_) {}
  return saved;
}

function resetBookingForm() {
  bookingForm.reset();
  bookingDate.value = localDateString(new Date());
  document.querySelector("#characterCount").textContent = "0 / 500";
  setFieldError(bookingName, bookingNameError, "");
  setFieldError(bookingPhone, bookingPhoneError, "");
  setFieldError(null, timeError, "");
}

bookingDate.min = localDateString(new Date());
bookingDate.value = localDateString(new Date());
bookingDate.addEventListener("change", loadAvailability);
bookingGuests.addEventListener("change", loadAvailability);
bookingGuests.addEventListener("input", loadAvailability);
document.querySelectorAll('input[name="service"]').forEach(function (input) {
  input.addEventListener("change", loadAvailability);
});

// Errori mostrati all'uscita dal campo; una volta segnalati, si aggiornano mentre si scrive.
bookingName.addEventListener("blur", function () { if (bookingName.value.trim()) validateName(true); });
bookingName.addEventListener("input", function () {
  if (bookingName.getAttribute("aria-invalid") === "true") validateName(true);
  updateBookingSummary();
});
bookingPhone.addEventListener("blur", function () { if (bookingPhone.value.trim()) validatePhone(true); });
bookingPhone.addEventListener("input", function () {
  if (bookingPhone.getAttribute("aria-invalid") === "true") validatePhone(true);
});

bookingNotes.addEventListener("input", function () {
  document.querySelector("#characterCount").textContent = bookingNotes.value.length + " / 500";
});

bookingForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  if (bookingSubmit.classList.contains("is-loading")) return;
  const invalidFields = [];
  const guestCount = Number(bookingGuests.value);
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > bookingConfig.maxGuests) {
    invalidFields.push(bookingGuests);
  }
  if (!bookingDate.value || !selectedTime()) {
    setFieldError(null, timeError, "Scegli una data e un orario disponibile per continuare.");
    invalidFields.push(timeOptions.querySelector("input:not(:disabled)") || bookingDate);
  }
  const name = validateName(true);
  if (!name) invalidFields.push(bookingName);
  const phone = validatePhone(true);
  if (!phone) invalidFields.push(bookingPhone);
  if (invalidFields.length) {
    setBookingMessage(invalidFields[0] === bookingGuests ? "Inserisci un numero di persone valido." : "Controlla i campi evidenziati per continuare.", "error");
    invalidFields[0].focus();
    return;
  }
  bookingSubmit.disabled = true;
  bookingSubmit.classList.add("is-loading");
  bookingSubmit.setAttribute("aria-busy", "true");
  setBookingMessage("Registro la prenotazione…", "");
  const payload = {
    date: bookingDate.value,
    service: selectedService(),
    time: selectedTime(),
    guests: guestCount,
    name: name,
    phone: phone,
    notes: bookingNotes.value.trim(),
    website: bookingWebsite.value,
    utm: readUtmParameters()
  };
  try {
    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "La prenotazione non è stata registrata.");
    lastBookingPayload = payload;
    document.querySelector("#confirmationSummary").textContent = formatBookingSummary(payload);
    document.querySelector("#bookingReference").textContent = result.reference;
    confirmationDialog.showModal();
    resetBookingForm();
    await loadAvailability();
    setBookingMessage("Richiesta inviata. È in attesa della verifica del gestore.", "success");
  } catch (error) {
    await loadAvailability(payload.time);
    setBookingMessage(error.message, "error");
  } finally {
    bookingSubmit.disabled = false;
    bookingSubmit.classList.remove("is-loading");
    bookingSubmit.removeAttribute("aria-busy");
  }
});

document.querySelector("#closeConfirmation").addEventListener("click", function () { confirmationDialog.close(); });
document.querySelector("#finishConfirmation").addEventListener("click", function () { confirmationDialog.close(); });
document.querySelector("#printConfirmation").addEventListener("click", function () { window.print(); });
document.querySelector("#copyReference").addEventListener("click", async function () {
  const reference = document.querySelector("#bookingReference").textContent;
  try {
    await navigator.clipboard.writeText(reference);
    setLocalizedText(document.querySelector("#copyFeedback"), "Codice copiato.");
  } catch (_) {
    setLocalizedText(document.querySelector("#copyFeedback"), "Seleziona e copia il codice: " + reference);
  }
});
confirmationDialog.addEventListener("click", function (event) {
  if (event.target === confirmationDialog) confirmationDialog.close();
});

const mobileMenuToggle = document.querySelector("#mobileMenuToggle");
const primaryNav = document.querySelector("#primaryNav");
mobileMenuToggle.addEventListener("click", function () {
  const expanded = mobileMenuToggle.getAttribute("aria-expanded") === "true";
  mobileMenuToggle.setAttribute("aria-expanded", String(!expanded));
  primaryNav.classList.toggle("is-open", !expanded);
});
primaryNav.querySelectorAll("a").forEach(function (link) {
  link.addEventListener("click", function () {
    primaryNav.classList.remove("is-open");
    mobileMenuToggle.setAttribute("aria-expanded", "false");
  });
});

const themeToggle = document.querySelector("#themeToggle");
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
  const dark = theme === "dark";
  document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#202331" : "#edf2f4");
  themeToggle.setAttribute("aria-pressed", String(dark));
  themeToggle.setAttribute("aria-label", translatePhrase(dark ? "Attiva tema chiaro" : "Attiva tema scuro"));
  try { localStorage.setItem("mareTheme", theme); } catch (_) {}
}
let savedTheme = "light";
try { savedTheme = localStorage.getItem("mareTheme") || "light"; } catch (_) {}
applyTheme(savedTheme);
themeToggle.addEventListener("click", function () { applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark"); });

const searchToggle = document.querySelector("#searchToggle");
const siteSearch = document.querySelector("#siteSearch");
const searchInput = document.querySelector("#searchInput");
const searchResults = document.querySelector("#searchResults");
searchToggle.addEventListener("click", function () {
  const opening = siteSearch.hidden;
  siteSearch.hidden = !opening;
  searchToggle.setAttribute("aria-expanded", String(opening));
  if (opening) searchInput.focus();
});
siteSearch.addEventListener("submit", function (event) {
  event.preventDefault();
  const locale = languageLocales[activeLanguage];
  const query = searchInput.value.trim().toLocaleLowerCase(locale);
  searchResults.replaceChildren();
  if (!query) return;
  const matches = Array.from(document.querySelectorAll("main section[id]")).filter(function (section) {
    return section.innerText.toLocaleLowerCase(locale).includes(query);
  });
  if (!matches.length) {
    const message = document.createElement("p");
    setLocalizedText(message, "Nessun risultato trovato.");
    searchResults.append(message);
    return;
  }
  matches.slice(0, 5).forEach(function (section) {
    const heading = section.querySelector("h1, h2");
    const link = document.createElement("a");
    link.href = "#" + section.id;
    link.textContent = heading ? heading.textContent.replace(/\s+/g, " ").trim() : section.id;
    link.addEventListener("click", function () { siteSearch.hidden = true; searchToggle.setAttribute("aria-expanded", "false"); });
    searchResults.append(link);
  });
});

const backToTop = document.querySelector("#backToTop");
const readingProgress = document.querySelector("#readingProgress");
function updateScrollControls() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? Math.min(100, window.scrollY / maxScroll * 100) : 0;
  readingProgress.style.width = progress + "%";
  backToTop.classList.toggle("is-visible", window.scrollY > 650);
}
window.addEventListener("scroll", updateScrollControls, { passive: true });
updateScrollControls();
backToTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
document.querySelector("#currentYear").textContent = String(new Date().getFullYear());

const languageMenu = document.querySelector("#languageMenu");
document.querySelectorAll(".language-options button").forEach(function (button) {
  button.addEventListener("click", function () {
    applyLanguage(button.dataset.language, true);
    languageMenu.open = false;
  });
});
document.addEventListener("click", function (event) {
  if (!languageMenu.contains(event.target)) languageMenu.open = false;
});
let savedLanguage = "it";
try { savedLanguage = localStorage.getItem("mareLanguage") || "it"; } catch (_) {}
applyLanguage(savedLanguage, false);
loadBookingConfig().then(function () { loadAvailability(); });

// Il pulsante "Prenota" e il ritorno in alto si nascondono sopra il modulo, per non coprirne i campi.
const floatingActions = document.querySelector("#floatingActions");
if ("IntersectionObserver" in window) {
  new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) { floatingActions.classList.toggle("is-hidden", entry.isIntersecting); });
  }, { threshold: 0 }).observe(document.querySelector("#prenota"));

  // Evidenzia nel menu la sezione che si sta leggendo.
  const menuNav = document.querySelector(".menu-nav");
  const menuLinks = Array.from(menuNav.querySelectorAll("a"));
  const chapterObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      menuLinks.forEach(function (link) {
        const isCurrent = link.hash === "#" + entry.target.id;
        if (isCurrent) {
          link.setAttribute("aria-current", "true");
          menuNav.scrollTo({ left: link.offsetLeft - 16, behavior: "smooth" });
        } else {
          link.removeAttribute("aria-current");
        }
      });
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  menuLinks.forEach(function (link) {
    const chapter = document.querySelector(link.hash);
    if (chapter) chapterObserver.observe(chapter);
  });
}
