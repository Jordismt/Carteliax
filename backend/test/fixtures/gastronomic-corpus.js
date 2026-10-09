// Synthetic regression corpus, not customer data or a translation dictionary.
const uuid = n => `90000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const examples = {
  es: [
    ['Carta de temporada', 'Entrantes, platos principales, bebidas y postres.', 'Bienvenidos. Consulta con nuestro equipo si tienes alguna alergia.'],
    ['Entrantes'], ['Platos principales'], ['Bebidas'], ['Postres'],
    ['Paella valenciana para 2 personas', 'Arroz cocinado con pollo, conejo, judías verdes y garrofón. Se prepara al momento y requiere 25 minutos.'],
    ['Fideuà de marisco', 'Fideos finos con gambas, sepia y caldo de pescado. Contiene pescado y crustáceos.'],
    ['Croquetas caseras de setas', 'Croquetas cremosas de setas con bechamel, rebozadas en pan rallado. Contienen leche, trigo y huevo.'],
    ['Ensalada de tomate y queso de cabra', 'Tomates frescos con queso de cabra, nueces y aceite de oliva. No lleva salsa.'],
    ['Coca-Cola 330 ml', 'Servida fría, con hielo y una rodaja de limón.'],
    ['Tiramisu casero', 'Postre con mascarpone, café y cacao. Contiene leche y huevo.'],
    ['Crema catalana', 'Crema suave con una capa de azúcar caramelizado. La preparamos cada mañana con leche, huevo y canela, y la servimos fría. Su textura es cremosa y la cobertura se carameliza justo antes de servir.'],
    ['Restaurant dels Sants', 'Cocina de temporada en un restaurante familiar.', 'Desde 1998 cocinamos con productos de temporada. Nuestro equipo te ayudará a elegir los platos y a consultar la información sobre alérgenos. No garantizamos la ausencia de trazas.'],
  ],
  val: [
    ['Carta de temporada', 'Entrants, plats principals, begudes i postres.', 'Benvinguts. Consulta amb el nostre equip si tens alguna al·lèrgia.'],
    ['Entrants'], ['Plats principals'], ['Begudes'], ['Postres'],
    ['Paella valenciana per a 2 persones', 'Arròs cuinat amb pollastre, conill, bajoqueta i garrofó. Es prepara al moment i necessita 25 minuts.'],
    ['Fideuà de marisc', 'Fideus fins amb gambes, sépia i caldo de peix. Conté peix i crustacis.'],
    ['Croquetes casolanes de bolets', 'Croquetes cremoses de bolets amb beixamel, arrebossades amb pa ratllat. Contenen llet, blat i ou.'],
    ['Ensalada de tomaca i formatge de cabra', 'Tomaques fresques amb formatge de cabra, anous i oli d’oliva. No porta salsa.'],
    ['Coca-Cola 330 ml', 'Servida freda, amb gel i una rodanxa de llima.'],
    ['Tiramisu casolà', 'Postres amb mascarpone, café i cacau. Conté llet i ou.'],
    ['Crema catalana', 'Crema suau amb una capa de sucre caramel·litzat. La preparem cada matí amb llet, ou i canella, i la servim freda. La textura és cremosa i la cobertura es caramel·litza just abans de servir.'],
    ['Restaurant dels Sants', 'Cuina de temporada en un restaurant familiar.', 'Des de 1998 cuinem amb productes de temporada. El nostre equip t’ajudarà a triar els plats i a consultar la informació sobre al·lèrgens. No garantim l’absència de traces.'],
  ],
  en: [
    ['Seasonal menu', 'Starters, main courses, drinks and desserts.', 'Welcome. Please speak to our team if you have any allergies.'],
    ['Starters'], ['Main courses'], ['Drinks'], ['Desserts'],
    ['Paella valenciana for 2 people', 'Rice cooked with chicken, rabbit, green beans and butter beans. Prepared to order; please allow 25 minutes.'],
    ['Seafood fideuà', 'Thin noodles with prawns, cuttlefish and fish stock. Contains fish and crustaceans.'],
    ['Homemade mushroom croquettes', 'Creamy mushroom croquettes with béchamel, coated in breadcrumbs. Contains milk, wheat and egg.'],
    ['Tomato and goat’s cheese salad', 'Fresh tomatoes with goat’s cheese, walnuts and olive oil. No dressing is added.'],
    ['Coca-Cola 330 ml', 'Served chilled, with ice and a slice of lemon.'],
    ['Homemade tiramisu', 'Dessert with mascarpone, coffee and cocoa. Contains milk and egg.'],
    ['Crema catalana', 'A smooth custard with a layer of caramelised sugar. We make it each morning with milk, egg and cinnamon, and serve it chilled. It has a creamy texture and the topping is caramelised just before serving.'],
    ['Restaurant dels Sants', 'Seasonal cooking in a family-run restaurant.', 'Since 1998 we have cooked with seasonal ingredients. Our team will help you choose dishes and check allergen information. We cannot guarantee the absence of traces.'],
  ],
  fr: [
    ['Carte de saison', 'Entrées, plats principaux, boissons et desserts.', 'Bienvenue. Adressez-vous à notre équipe si vous avez une allergie.'],
    ['Entrées'], ['Plats principaux'], ['Boissons'], ['Desserts'],
    ['Paella valenciana pour 2 personnes', 'Riz cuisiné avec du poulet, du lapin, des haricots verts et des haricots blancs. Préparé à la commande ; prévoir 25 minutes.'],
    ['Fideuà aux fruits de mer', 'Vermicelles fins avec des crevettes, de la seiche et du bouillon de poisson. Contient du poisson et des crustacés.'],
    ['Croquettes maison aux champignons', 'Croquettes crémeuses aux champignons et à la béchamel, panées à la chapelure. Contiennent du lait, du blé et de l’œuf.'],
    ['Salade de tomates et de fromage de chèvre', 'Tomates fraîches avec du fromage de chèvre, des noix et de l’huile d’olive. Sans sauce.'],
    ['Coca-Cola 330 ml', 'Servie fraîche, avec des glaçons et une rondelle de citron.'],
    ['Tiramisu maison', 'Dessert au mascarpone, au café et au cacao. Contient du lait et de l’œuf.'],
    ['Crema catalana', 'Crème onctueuse recouverte de sucre caramélisé. Nous la préparons chaque matin avec du lait, de l’œuf et de la cannelle, puis la servons froide. Sa texture est crémeuse et le dessus est caramélisé juste avant de servir.'],
    ['Restaurant dels Sants', 'Cuisine de saison dans un restaurant familial.', 'Depuis 1998, nous cuisinons avec des produits de saison. Notre équipe vous aide à choisir vos plats et à consulter les informations sur les allergènes. Nous ne garantissons pas l’absence de traces.'],
  ],
};
export function gastronomicCorpus(language) {
  return examples[language].map(([name, description = '', welcome_text = ''], index) => ({ type: index === 0 ? 'menu' : index <= 4 ? 'category' : index === 12 ? 'restaurant' : 'product', id: uuid(index+1), name, description, welcome_text, source_hash: 'a'.repeat(64), draft: null }));
}
