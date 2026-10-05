// Seeds a large dummy network: 1000 musician accounts + 500 venue accounts,
// worldwide, each posting once (with a stock photo), then cross-liking and
// commenting on each other's posts.
//
// Usage: node --env-file=.env scripts/seed-network.mjs
//
// Writes directly to Supabase via the service-role key (bypasses RLS), same
// pattern as src/routes/api/admin/seed-venues/+server.ts. A manifest of
// created user ids/emails/kinds is written to scripts/.seed-manifest.json so
// scripts/remove-network.mjs can clean everything up later.
//
// Images: generic royalty-free stock photography served by Lorem Picsum
// (https://picsum.photos), a well-known free placeholder-image CDN backed by
// real (non-AI-generated) photos. No images are generated for this task.

import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(__dirname, '.seed-manifest.json');

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
	console.error('Missing PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
	console.error('Run with: node --env-file=.env scripts/seed-network.mjs');
	process.exit(1);
}

const TOTAL_MUSICIANS = 1000;
const TOTAL_VENUES = 500;
const EMAIL_DOMAIN = 'openmic-seed.test';
const LIKES_MIN = 20;
const LIKES_MAX = 450;
const COMMENTS_MIN = 4;
const COMMENTS_MAX = 7;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false }
});

// ---------------------------------------------------------------------------
// Diversity data: 53 regions spanning every inhabited continent, each with
// its own first/last name pools so generated names stay culturally coherent.
// ---------------------------------------------------------------------------

const REGIONS = [
	{ country: 'Nigeria', city: 'Lagos', lat: 6.5244, lng: 3.3792,
		first: ['Chidinma', 'Emeka', 'Ngozi', 'Tunde', 'Aisha', 'Femi', 'Chioma', 'Kunle'],
		last: ['Okafor', 'Adeyemi', 'Balogun', 'Eze', 'Okonkwo', 'Abiodun'] },
	{ country: 'Ghana', city: 'Accra', lat: 5.6037, lng: -0.187,
		first: ['Kwame', 'Ama', 'Kofi', 'Akosua', 'Yaw', 'Efua'],
		last: ['Mensah', 'Owusu', 'Asante', 'Boateng', 'Osei'] },
	{ country: 'Kenya', city: 'Nairobi', lat: -1.2921, lng: 36.8219,
		first: ['Wanjiru', 'Otieno', 'Achieng', 'Kamau', 'Amina', 'Njoroge'],
		last: ['Mwangi', 'Odhiambo', 'Kimani', 'Wafula', 'Kiptoo'] },
	{ country: 'South Africa', city: 'Johannesburg', lat: -26.2041, lng: 28.0473,
		first: ['Thandiwe', 'Sipho', 'Lindiwe', 'Bongani', 'Naledi', 'Mandla'],
		last: ['Dlamini', 'Nkosi', 'Van der Merwe', 'Khumalo', 'Botha'] },
	{ country: 'Egypt', city: 'Cairo', lat: 30.0444, lng: 31.2357,
		first: ['Youssef', 'Mariam', 'Omar', 'Layla', 'Karim', 'Nour'],
		last: ['Hassan', 'El-Sayed', 'Ibrahim', 'Mahmoud', 'Fathy'] },
	{ country: 'Ethiopia', city: 'Addis Ababa', lat: 9.03, lng: 38.74,
		first: ['Abebe', 'Kebede', 'Tigist', 'Selam', 'Dawit', 'Hana'],
		last: ['Bekele', 'Tesfaye', 'Alemu', 'Girma', 'Wolde'] },
	{ country: 'Senegal', city: 'Dakar', lat: 14.7167, lng: -17.4677,
		first: ['Moussa', 'Fatou', 'Ibrahima', 'Aissatou', 'Cheikh', 'Mariama'],
		last: ['Diop', 'Ndiaye', 'Fall', 'Sow', 'Ba'] },
	{ country: 'Morocco', city: 'Casablanca', lat: 33.5731, lng: -7.5898,
		first: ['Youssef', 'Fatima Zahra', 'Omar', 'Salma', 'Amine', 'Khadija'],
		last: ['El Amrani', 'Benali', 'Cherkaoui', 'Tazi', 'Idrissi'] },
	{ country: 'Tanzania', city: 'Dar es Salaam', lat: -6.7924, lng: 39.2083,
		first: ['Juma', 'Neema', 'Baraka', 'Zuhura', 'Emmanuel', 'Faraja'],
		last: ['Mushi', 'Kessy', 'Mwakalinga', 'Mrema', 'Kombe'] },
	{ country: 'India', city: 'Mumbai', lat: 19.076, lng: 72.8777,
		first: ['Ananya', 'Rohan', 'Priya', 'Arjun', 'Divya', 'Vikram'],
		last: ['Sharma', 'Patel', 'Iyer', 'Reddy', 'Nair', 'Khan'] },
	{ country: 'Pakistan', city: 'Lahore', lat: 31.5497, lng: 74.3436,
		first: ['Zainab', 'Bilal', 'Fatima', 'Hamza', 'Sana', 'Ahmed'],
		last: ['Khan', 'Malik', 'Siddiqui', 'Butt', 'Chaudhry'] },
	{ country: 'Bangladesh', city: 'Dhaka', lat: 23.8103, lng: 90.4125,
		first: ['Rafiq', 'Shirin', 'Kamal', 'Nasrin', 'Habib', 'Sultana'],
		last: ['Islam', 'Rahman', 'Hossain', 'Chowdhury', 'Ahmed'] },
	{ country: 'Sri Lanka', city: 'Colombo', lat: 6.9271, lng: 79.8612,
		first: ['Nuwan', 'Dilani', 'Kasun', 'Chamari', 'Ruwan', 'Ishara'],
		last: ['Perera', 'Fernando', 'Silva', 'Jayawardena', 'Rajapaksa'] },
	{ country: 'Nepal', city: 'Kathmandu', lat: 27.7172, lng: 85.324,
		first: ['Bikash', 'Sabina', 'Prakash', 'Sunita', 'Rajesh', 'Anita'],
		last: ['Shrestha', 'Gurung', 'Tamang', 'Rai', 'Thapa'] },
	{ country: 'China', city: 'Shanghai', lat: 31.2304, lng: 121.4737,
		first: ['Wei', 'Mei', 'Jun', 'Xiaoyan', 'Hao', 'Ying'],
		last: ['Wang', 'Li', 'Zhang', 'Chen', 'Liu'] },
	{ country: 'Japan', city: 'Tokyo', lat: 35.6762, lng: 139.6503,
		first: ['Haruto', 'Yui', 'Sota', 'Sakura', 'Ren', 'Akira'],
		last: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe'] },
	{ country: 'South Korea', city: 'Seoul', lat: 37.5665, lng: 126.978,
		first: ['Ji-hoon', 'Seo-yeon', 'Min-jun', 'Ha-eun', 'Do-yoon', 'Yuna'],
		last: ['Kim', 'Lee', 'Park', 'Choi', 'Jung'] },
	{ country: 'Philippines', city: 'Manila', lat: 14.5995, lng: 120.9842,
		first: ['Andres', 'Maria Clara', 'Josefa', 'Emilio', 'Liwayway', 'Rizal'],
		last: ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Garcia'] },
	{ country: 'Indonesia', city: 'Jakarta', lat: -6.2088, lng: 106.8456,
		first: ['Putri', 'Agus', 'Siti', 'Bayu', 'Dewi', 'Rizky'],
		last: ['Wijaya', 'Santoso', 'Hidayat', 'Kusuma', 'Pratama'] },
	{ country: 'Vietnam', city: 'Hanoi', lat: 21.0285, lng: 105.8542,
		first: ['Linh', 'Minh', 'Huong', 'Duc', 'Mai', 'Tuan'],
		last: ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang'] },
	{ country: 'Thailand', city: 'Bangkok', lat: 13.7563, lng: 100.5018,
		first: ['Somchai', 'Siriporn', 'Anan', 'Kanya', 'Chai', 'Malee'],
		last: ['Srisuk', 'Boonmee', 'Chaisurin', 'Rattanakorn', 'Suwannaphum'] },
	{ country: 'Malaysia', city: 'Kuala Lumpur', lat: 3.139, lng: 101.6869,
		first: ['Aiman', 'Nur', 'Farid', 'Aisyah', 'Hafiz', 'Siti'],
		last: ['Abdullah', 'Rahman', 'Ismail', 'Yusof', 'Hassan'] },
	{ country: 'Turkey', city: 'Istanbul', lat: 41.0082, lng: 28.9784,
		first: ['Elif', 'Mehmet', 'Zeynep', 'Emre', 'Ayse', 'Baris'],
		last: ['Yilmaz', 'Kaya', 'Demir', 'Sahin', 'Celik'] },
	{ country: 'Saudi Arabia', city: 'Riyadh', lat: 24.7136, lng: 46.6753,
		first: ['Abdullah', 'Noura', 'Faisal', 'Reem', 'Khalid', 'Sara'],
		last: ['Al-Otaibi', 'Al-Qahtani', 'Al-Harbi', 'Al-Ghamdi', 'Al-Zahrani'] },
	{ country: 'United Arab Emirates', city: 'Dubai', lat: 25.2048, lng: 55.2708,
		first: ['Rashid', 'Maitha', 'Hamdan', 'Shamma', 'Saeed', 'Alya'],
		last: ['Al Falasi', 'Al Suwaidi', 'Al Marzooqi', 'Al Shamsi', 'Al Neyadi'] },
	{ country: 'Israel', city: 'Tel Aviv', lat: 32.0853, lng: 34.7818,
		first: ['Noa', 'Itai', 'Maya', 'Yonatan', 'Shira', 'Omer'],
		last: ['Cohen', 'Levi', 'Mizrahi', 'Peretz', 'Biton'] },
	{ country: 'Iran', city: 'Tehran', lat: 35.6892, lng: 51.389,
		first: ['Reza', 'Sara', 'Amir', 'Niloofar', 'Kian', 'Yasaman'],
		last: ['Hosseini', 'Karimi', 'Moradi', 'Rostami', 'Ahmadi'] },
	{ country: 'Lebanon', city: 'Beirut', lat: 33.8938, lng: 35.5018,
		first: ['Elie', 'Layal', 'Karim', 'Nour', 'Georges', 'Maya'],
		last: ['Khoury', 'Haddad', 'Saad', 'Aoun', 'Fares'] },
	{ country: 'United Kingdom', city: 'London', lat: 51.5072, lng: -0.1276,
		first: ['Olivia', 'Jack', 'Amelia', 'Harry', 'Freya', 'George'],
		last: ['Smith', 'Taylor', 'Brown', 'Wilson', "O'Connor"] },
	{ country: 'Ireland', city: 'Dublin', lat: 53.3498, lng: -6.2603,
		first: ['Aoife', 'Cian', 'Saoirse', 'Sean', 'Niamh', 'Cormac'],
		last: ['Murphy', 'Kelly', "O'Brien", 'Byrne', 'Ryan'] },
	{ country: 'France', city: 'Paris', lat: 48.8566, lng: 2.3522,
		first: ['Camille', 'Lucas', 'Chloe', 'Hugo', 'Manon', 'Nathan'],
		last: ['Martin', 'Bernard', 'Dubois', 'Moreau', 'Lefevre'] },
	{ country: 'Germany', city: 'Berlin', lat: 52.52, lng: 13.405,
		first: ['Lena', 'Finn', 'Mia', 'Jonas', 'Emma', 'Elias'],
		last: ['Muller', 'Schmidt', 'Schneider', 'Fischer', 'Weber'] },
	{ country: 'Netherlands', city: 'Amsterdam', lat: 52.3676, lng: 4.9041,
		first: ['Daan', 'Sanne', 'Sem', 'Fleur', 'Lars', 'Eva'],
		last: ['de Jong', 'Jansen', 'de Vries', 'Bakker', 'Visser'] },
	{ country: 'Spain', city: 'Madrid', lat: 40.4168, lng: -3.7038,
		first: ['Lucia', 'Hugo', 'Martina', 'Pablo', 'Valeria', 'Diego'],
		last: ['Garcia', 'Fernandez', 'Lopez', 'Martinez', 'Sanchez'] },
	{ country: 'Portugal', city: 'Lisbon', lat: 38.7223, lng: -9.1393,
		first: ['Joao', 'Ines', 'Tiago', 'Beatriz', 'Rui', 'Catarina'],
		last: ['Silva', 'Santos', 'Ferreira', 'Costa', 'Oliveira'] },
	{ country: 'Italy', city: 'Rome', lat: 41.9028, lng: 12.4964,
		first: ['Giulia', 'Marco', 'Sofia', 'Luca', 'Chiara', 'Matteo'],
		last: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi'] },
	{ country: 'Greece', city: 'Athens', lat: 37.9838, lng: 23.7275,
		first: ['Nikos', 'Eleni', 'Giorgos', 'Maria', 'Dimitris', 'Sofia'],
		last: ['Papadopoulos', 'Nikolaou', 'Georgiou', 'Ioannou', 'Vasileiou'] },
	{ country: 'Sweden', city: 'Stockholm', lat: 59.3293, lng: 18.0686,
		first: ['Elsa', 'Oskar', 'Alma', 'Erik', 'Astrid', 'Viktor'],
		last: ['Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Lindqvist'] },
	{ country: 'Norway', city: 'Oslo', lat: 59.9139, lng: 10.7522,
		first: ['Emil', 'Nora', 'Jonas', 'Ingrid', 'Magnus', 'Sofie'],
		last: ['Hansen', 'Johansen', 'Olsen', 'Larsen', 'Andersen'] },
	{ country: 'Poland', city: 'Warsaw', lat: 52.2297, lng: 21.0122,
		first: ['Zofia', 'Jakub', 'Julia', 'Antoni', 'Maja', 'Filip'],
		last: ['Kowalski', 'Nowak', 'Wisniewski', 'Wojcik', 'Kaminski'] },
	{ country: 'Czech Republic', city: 'Prague', lat: 50.0755, lng: 14.4378,
		first: ['Jakub', 'Tereza', 'Jan', 'Katerina', 'Tomas', 'Eliska'],
		last: ['Novak', 'Svoboda', 'Novotny', 'Dvorak', 'Cerny'] },
	{ country: 'Romania', city: 'Bucharest', lat: 44.4268, lng: 26.1025,
		first: ['Andrei', 'Ioana', 'Mihai', 'Maria', 'Alexandru', 'Elena'],
		last: ['Popescu', 'Ionescu', 'Popa', 'Stan', 'Dumitru'] },
	{ country: 'Brazil', city: 'São Paulo', lat: -23.5505, lng: -46.6333,
		first: ['Beatriz', 'Joao', 'Larissa', 'Gabriel', 'Camila', 'Rafael'],
		last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira'] },
	{ country: 'Mexico', city: 'Mexico City', lat: 19.4326, lng: -99.1332,
		first: ['Ximena', 'Santiago', 'Valentina', 'Mateo', 'Fernanda', 'Emiliano'],
		last: ['Hernandez', 'Garcia', 'Martinez', 'Lopez', 'Gonzalez'] },
	{ country: 'Argentina', city: 'Buenos Aires', lat: -34.6037, lng: -58.3816,
		first: ['Martina', 'Benjamin', 'Catalina', 'Thiago', 'Julieta', 'Joaquin'],
		last: ['Gonzalez', 'Rodriguez', 'Fernandez', 'Romero', 'Diaz'] },
	{ country: 'Colombia', city: 'Bogota', lat: 4.711, lng: -74.0721,
		first: ['Isabella', 'Samuel', 'Sofia', 'Sebastian', 'Salome', 'Juan'],
		last: ['Ramirez', 'Torres', 'Rojas', 'Castro', 'Ortiz'] },
	{ country: 'Chile', city: 'Santiago', lat: -33.4489, lng: -70.6693,
		first: ['Matias', 'Camila', 'Diego', 'Javiera', 'Cristobal', 'Antonia'],
		last: ['Gonzalez', 'Munoz', 'Rojas', 'Diaz', 'Fuentes'] },
	{ country: 'Peru', city: 'Lima', lat: -12.0464, lng: -77.0428,
		first: ['Jose', 'Rosa', 'Luis', 'Carmen', 'Carlos', 'Flor'],
		last: ['Quispe', 'Mamani', 'Flores', 'Huaman', 'Condori'] },
	{ country: 'Cuba', city: 'Havana', lat: 23.1136, lng: -82.3666,
		first: ['Yasiel', 'Yaneisy', 'Leonel', 'Yumiley', 'Alejandro', 'Dayana'],
		last: ['Perez', 'Rodriguez', 'Gonzalez', 'Fernandez', 'Gomez'] },
	{ country: 'United States', city: 'Chicago', lat: 41.8781, lng: -87.6298,
		first: ['Marcus', 'Destiny', 'Jayden', 'Aaliyah', 'Ethan', 'Maya'],
		last: ['Johnson', 'Williams', 'Rodriguez', 'Nguyen', 'Cohen'] },
	{ country: 'United States', city: 'Nashville', lat: 36.1627, lng: -86.7816,
		first: ['Wyatt', 'Savannah', 'Colton', 'Kaylee', 'Hunter', 'Brooklyn'],
		last: ['Carter', 'Bennett', 'Reyes', 'Hughes', 'Ford'] },
	{ country: 'Canada', city: 'Toronto', lat: 43.6532, lng: -79.3832,
		first: ['Noah', 'Charlotte', 'Liam', 'Zoe', 'Aiden', 'Grace'],
		last: ['Tremblay', 'Roy', 'MacDonald', 'Singh', 'Wong'] },
	{ country: 'Jamaica', city: 'Kingston', lat: 17.9712, lng: -76.7936,
		first: ['Kemar', 'Shanice', 'Odane', 'Latoya', 'Rohan', 'Sherika'],
		last: ['Campbell', 'Brown', 'Clarke', 'Reid', 'Grant'] },
	{ country: 'Australia', city: 'Sydney', lat: -33.8688, lng: 151.2093,
		first: ['Isla', 'Jack', 'Ruby', 'Cooper', 'Willow', 'Lachlan'],
		last: ['Nguyen', 'Smith', 'Taylor', 'Kelly', 'Anderson'] },
	{ country: 'New Zealand', city: 'Auckland', lat: -36.8485, lng: 174.7633,
		first: ['Jack', 'Charlotte', 'Oliver', 'Amelia', 'Cooper', 'Aria'],
		last: ['Wilson', 'Ngata', 'Walker', 'Rangi', 'Thompson'] }
];

const GENRES = [
	'Afrobeats', 'Highlife', 'Amapiano', 'Jazz', 'Blues', 'Soul', 'R&B', 'Hip-Hop',
	'Reggaeton', 'Salsa', 'Bossa Nova', 'Samba', 'Tango', 'Flamenco', 'Fado',
	'Classical', 'Opera', 'K-Pop', 'J-Pop', 'Bollywood', 'Qawwali', 'Bhangra',
	'Gamelan', 'Dangdut', 'V-Pop', 'Anatolian Rock', 'Turkish Folk', 'Grime',
	'Drill', 'House', 'Techno', 'EDM', 'Folk', 'Country', 'Bluegrass', 'Metal',
	'Punk', 'Indie Rock', 'Gospel', 'Reggae', 'Dancehall', 'Klezmer', 'Celtic Folk'
];

const INSTRUMENTS = [
	'Guitar', 'Bass Guitar', 'Piano', 'Keyboard/Synth', 'Drums', 'Violin', 'Cello',
	'Double Bass', 'Saxophone', 'Trumpet', 'Trombone', 'Flute', 'Clarinet', 'Vocals',
	'Sitar', 'Tabla', 'Kora', 'Djembe', 'Talking Drum', 'Accordion', 'Banjo',
	'Ukulele', 'Mandolin', 'Harmonica', 'Bagpipes', 'Erhu', 'Guzheng', 'Shamisen',
	'Taiko Drums', 'Oud', 'Darbuka', 'Steel Pan', 'Marimba', 'DJ Controller / Turntables'
];

const ARTIST_ROLES = ['Instrumentalist', 'Producer', 'Composer', 'Sound Tech', 'Other'];
const PRONOUN_TAGS = ['she/her', 'he/him', 'they/them'];

const VENUE_TYPES = [
	'Jazz Club', 'Rock Venue', 'Concert Hall', 'Dive Bar', 'Music Cafe', 'Nightclub',
	'Amphitheater', 'Live Music Pub', 'Recording Studio & Venue', 'Small Arena',
	'Blues Bar', 'Cabaret', 'Listening Room', 'Beer Garden Stage'
];
const VENUE_ADJ = ['Blue', 'Golden', 'Velvet', 'Electric', 'Crimson', 'Copper', 'Midnight', 'Silver', 'Neon', 'Rustic', 'Wild', 'Iron', 'Amber', 'Hollow', 'Roaring'];
const VENUE_NOUN = ['Note', 'Room', 'Lounge', 'Hall', 'Stage', 'Tavern', 'Underground', 'Sound', 'Amp', 'Groove', 'Anchor', 'Owl', 'Fox', 'Barrel', 'Attic'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIMES = ['7 PM', '7:30 PM', '8 PM', '8:30 PM', '9 PM'];

const VENUE_NAME_TEMPLATES = [
	() => `The ${pick(VENUE_ADJ)} ${pick(VENUE_NOUN)}`,
	(city) => `${city} ${pick(['Music Hall', 'Live House', 'Sound Room', 'Jazz Club', 'Concert Hall'])}`,
	() => `${pick(VENUE_NOUN)} & ${pick(VENUE_NOUN)}`
];

const MUSICIAN_POST_TEMPLATES = [
	(p) => `Just wrapped tracking a new ${p.genre} idea on ${p.instrument} 🎶 Feeling inspired by the scene here in ${p.city}.`,
	(p) => `${p.years} years in and still chasing that perfect ${p.genre} tone on ${p.instrument}. Who else is working on something new this week?`,
	(p) => `Studio session tonight — layering ${p.instrument} over a ${p.genre} groove. This one's going to be special.`,
	(p) => `Grew up on ${p.genre} back home, and it still shapes everything I write on ${p.instrument}. New material dropping soon!`,
	(p) => `Rehearsal went long but worth it — the ${p.genre} arrangement finally clicked. ${p.instrument} never sounded better.`,
	(p) => `Open to collabs! I play ${p.instrument} and mostly work in ${p.genre}, based out of ${p.city}. DM me if you're in town.`,
	(p) => `Sketching out a ${p.genre} EP this month, all ${p.instrument} driven. Small previews coming soon.`,
	(p) => `Nothing beats a late-night ${p.genre} jam. Just me, my ${p.instrument}, and way too much coffee.`
];

const VENUE_POST_TEMPLATES = [
	(v) => `Hey! We're looking for a local band to play this ${pick(WEEKDAYS)} night at ${pick(TIMES)} — hit us up if you're interested 🎤`,
	() => `Last night's show was absolutely incredible — thank you to everyone who came out! 🙌`,
	(v) => `This ${pick(WEEKDAYS)}: doors at ${pick(TIMES)}, first act right after. Come support live music in ${v.city}!`,
	(v) => `Booking for next month — ${v.genre} acts especially welcome. Slide into our DMs.`,
	() => `Sound check chaos today but we're ready for tonight's lineup 🔊`,
	(v) => `Huge thanks to the artists who packed the house this weekend. ${v.city}, you never disappoint.`,
	() => `Open mic night every ${pick(WEEKDAYS)} — come through and share your sound.`,
	(v) => `Looking for a ${v.genre} act to headline next ${pick(WEEKDAYS)}, message us if you're interested!`,
	(v) => `Stage is set, lights are up — tonight's ${v.genre} lineup is going to be special.`,
	(v) => `Running shows in ${v.city} for years now. Thank you for keeping live music alive.`
];

const MUSICIAN_TO_MUSICIAN_COMMENTS = [
	(c) => `Love this! That ${c.genre} groove is infectious 🔥`,
	(c) => `The ${c.instrument} tone here is beautiful — what are you running it through?`,
	(c) => `This takes me right back. Real ${c.genre} spirit.`,
	(c) => `Following all the way from ${c.fromCity}! Would love to collab sometime.`,
	(c) => `Underrated ${c.instrument} player honestly. More people need to hear this.`,
	(c) => `This is the kind of ${c.genre} we need more of. Saved it.`,
	(c) => `Incredible feel on the ${c.instrument}. Inspired to go practice now.`,
	(c) => `Can't wait to hear the full track — that ${c.genre} energy is unmatched.`
];
const MUSICIAN_TO_VENUE_COMMENTS = [
	() => `Would love to play a set here sometime!`,
	() => `This place always has the best lineups.`,
	() => `Can't wait for the next show here — count me in.`,
	(c) => `Traveling all the way from ${c.fromCity} for a night here would be worth it.`,
	() => `One of the best rooms I've played. Hope to be back soon.`
];
const VENUE_TO_MUSICIAN_COMMENTS = [
	() => `We'd love to have you play a set sometime — reach out!`,
	() => `This is exactly the kind of act we're looking to book.`,
	() => `Amazing energy, hope to catch you live soon.`,
	() => `Send us a message, we've got a slot open next month.`,
	() => `This is going straight to our booking list.`
];
const VENUE_TO_VENUE_COMMENTS = [
	() => `Congrats on another great night!`,
	() => `Love seeing venues supporting local music like this.`,
	() => `Great lineup — inspiring stuff.`,
	(c) => `${c.fromCity} venues gotta stick together. Nicely done.`
];

const MUSICIAN_BIO_TEMPLATES = [
	(p) => `${p.genre} ${p.roleWord} based in ${p.city}, ${p.country}. ${p.years} years making music and always chasing new sounds.`,
	(p) => `${p.instrument} player rooted in ${p.genre}, currently based in ${p.city}. Open to collaborations across genres and borders.`,
	(p) => `Making ${p.genre} music out of ${p.city}, ${p.country}. ${p.instrument} is my main voice, but I'll try almost anything once.`,
	(p) => `${p.years}+ years playing ${p.instrument}. Blending ${p.genre} with whatever else is in the air around ${p.city}.`
];

const VENUE_BIO_TEMPLATES = [
	(v) => `${v.venueType} in ${v.city}, ${v.country}. Hosting live ${v.genre} several nights a week — always looking for new acts to book.`,
	(v) => `${v.city}'s home for live ${v.genre}. We're a ${v.venueType.toLowerCase()} that books local and touring artists year-round.`,
	(v) => `Independent ${v.venueType.toLowerCase()} in ${v.city}, ${v.country}. DM us if you play ${v.genre} and want a stage.`
];

// A curated set of Lorem Picsum (https://picsum.photos) image ids — real,
// non-AI stock photography served under Picsum's free-to-use license.
const IMAGE_IDS = Array.from({ length: 90 }, (_, i) => 1 + i * 12).filter((id) => id <= 1080);

function pick(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
	const copy = [...arr];
	const out = [];
	n = Math.min(n, copy.length);
	for (let i = 0; i < n; i++) {
		const idx = Math.floor(Math.random() * copy.length);
		out.push(copy.splice(idx, 1)[0]);
	}
	return out;
}

function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chunk(arr, size) {
	const out = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
}

function imageUrl() {
	return `https://picsum.photos/id/${pick(IMAGE_IDS)}/1200/800`;
}

function buildMusicians() {
	const people = [];
	const usedNames = new Set();
	for (let i = 0; i < TOTAL_MUSICIANS; i++) {
		const region = REGIONS[i % REGIONS.length];
		let fullName;
		let attempts = 0;
		do {
			fullName = `${pick(region.first)} ${pick(region.last)}`;
			attempts++;
		} while (usedNames.has(fullName) && attempts < 20);
		usedNames.add(fullName);

		const genre = pick(GENRES);
		const instrument = pick(INSTRUMENTS);
		const roles = pickN(ARTIST_ROLES, randomInt(1, 2));
		const years = randomInt(2, 25);
		const roleWord = roles.includes('Instrumentalist') ? 'musician' : roles[0].toLowerCase();
		const pronoun = Math.random() < 0.6 ? pick(PRONOUN_TAGS) : null;

		const bio = pick(MUSICIAN_BIO_TEMPLATES)({ genre, instrument, city: region.city, country: region.country, years, roleWord })
			+ (pronoun ? ` (${pronoun})` : '');

		const postBody = `<p>${pick(MUSICIAN_POST_TEMPLATES)({ genre, instrument, city: region.city, years })}</p>`;

		people.push({
			kind: 'musician',
			email: `seed.musician.${i + 1}@${EMAIL_DOMAIN}`,
			password: crypto.randomUUID(),
			fullName,
			country: region.country,
			city: region.city,
			lat: region.lat,
			lng: region.lng,
			genre,
			instrument,
			roles,
			bio,
			tags: [genre, instrument],
			postBody,
			postTags: [genre, instrument]
		});
	}
	return people;
}

function buildVenues() {
	const venues = [];
	const usedNames = new Set();
	for (let i = 0; i < TOTAL_VENUES; i++) {
		const region = REGIONS[i % REGIONS.length];
		const venueType = pick(VENUE_TYPES);
		const genre = pick(GENRES);
		let fullName;
		let attempts = 0;
		do {
			fullName = pick(VENUE_NAME_TEMPLATES)(region.city);
			attempts++;
		} while (usedNames.has(fullName) && attempts < 20);
		usedNames.add(fullName);

		const bio = pick(VENUE_BIO_TEMPLATES)({ venueType, genre, city: region.city, country: region.country });
		const postBody = `<p>${pick(VENUE_POST_TEMPLATES)({ city: region.city, genre })}</p>`;

		venues.push({
			kind: 'venue',
			email: `seed.venue.${i + 1}@${EMAIL_DOMAIN}`,
			password: crypto.randomUUID(),
			fullName,
			country: region.country,
			city: region.city,
			lat: region.lat,
			lng: region.lng,
			genre,
			venueType,
			roles: [],
			bio,
			tags: [venueType, genre],
			postBody,
			postTags: [venueType, genre]
		});
	}
	return venues;
}

async function createAuthUsers(people) {
	console.log(`Creating ${people.length} auth users...`);
	const created = [];
	const batches = chunk(people, 15);
	for (const [bi, batch] of batches.entries()) {
		const results = await Promise.all(
			batch.map(async (person) => {
				for (let attempt = 0; attempt < 2; attempt++) {
					const { data, error } = await supabase.auth.admin.createUser({
						email: person.email,
						password: person.password,
						email_confirm: true,
						user_metadata: { full_name: person.fullName }
					});
					if (!error) return { ...person, id: data.user.id };
					if (attempt === 0) {
						await new Promise((r) => setTimeout(r, 1000));
						continue;
					}
					console.error(`  ✗ ${person.email}: ${error.message}`);
				}
				return null;
			})
		);
		for (const r of results) if (r) created.push(r);
		if ((bi + 1) % 10 === 0 || bi === batches.length - 1) {
			console.log(`  batch ${bi + 1}/${batches.length} done (${created.length}/${people.length} total)`);
		}
	}
	return created;
}

async function upsertProfiles(users) {
	console.log(`Upserting ${users.length} profiles...`);
	const rows = users.map((u) => ({
		id: u.id,
		full_name: u.fullName,
		location: `${u.city}, ${u.country}`,
		location_lat: u.lat,
		location_lng: u.lng,
		bio: u.bio,
		tags: u.tags,
		profile_type: u.kind === 'venue' ? 'venue' : 'artist',
		artist_roles: u.roles,
		discoverable: true,
		updated_at: new Date().toISOString()
	}));
	for (const batch of chunk(rows, 200)) {
		const { error } = await supabase.from('profiles').upsert(batch, { onConflict: 'id' });
		if (error) console.error(`  ✗ profiles batch error: ${error.message}`);
	}
}

async function createPosts(users) {
	console.log(`Creating ${users.length} posts...`);
	const rows = users.map((u) => ({
		author_id: u.id,
		body: u.postBody,
		tags: u.postTags
	}));
	const postByAuthor = new Map();
	for (const batch of chunk(rows, 200)) {
		const { data, error } = await supabase.from('posts').insert(batch).select('id, author_id');
		if (error) {
			console.error(`  ✗ posts batch error: ${error.message}`);
			continue;
		}
		for (const row of data) postByAuthor.set(row.author_id, row.id);
	}

	console.log('Attaching one stock photo to each post...');
	const mediaRows = users
		.filter((u) => postByAuthor.has(u.id))
		.map((u) => ({ post_id: postByAuthor.get(u.id), url: imageUrl(), media_type: 'image', order_index: 0 }));
	for (const batch of chunk(mediaRows, 500)) {
		const { error } = await supabase.from('post_media').insert(batch);
		if (error) console.error(`  ✗ post_media batch error: ${error.message}`);
	}

	return postByAuthor;
}

async function createLikes(users, postByAuthor) {
	console.log('Creating cross-likes (this is the slow part — thousands of rows)...');
	const rows = [];
	const seen = new Set();
	for (const target of users) {
		const postId = postByAuthor.get(target.id);
		if (!postId) continue;
		const others = users.filter((u) => u.id !== target.id);
		const likeCount = randomInt(LIKES_MIN, LIKES_MAX);
		const likers = pickN(others, likeCount);
		for (const liker of likers) {
			const key = `${postId}:${liker.id}`;
			if (seen.has(key)) continue;
			seen.add(key);
			rows.push({ post_id: postId, user_id: liker.id });
		}
	}
	console.log(`  inserting ${rows.length} likes...`);
	let inserted = 0;
	for (const batch of chunk(rows, 1000)) {
		const { error } = await supabase.from('post_likes').insert(batch);
		if (error) console.error(`  ✗ likes batch error: ${error.message}`);
		else inserted += batch.length;
	}
	return inserted;
}

function commentFor(commenter, target) {
	const vars = { genre: target.genre, instrument: target.instrument, fromCity: commenter.city };
	if (commenter.kind === 'musician' && target.kind === 'musician') return pick(MUSICIAN_TO_MUSICIAN_COMMENTS)(vars);
	if (commenter.kind === 'musician' && target.kind === 'venue') return pick(MUSICIAN_TO_VENUE_COMMENTS)(vars);
	if (commenter.kind === 'venue' && target.kind === 'musician') return pick(VENUE_TO_MUSICIAN_COMMENTS)(vars);
	return pick(VENUE_TO_VENUE_COMMENTS)(vars);
}

async function createComments(users, postByAuthor) {
	console.log('Creating comments...');
	const rows = [];
	for (const target of users) {
		const postId = postByAuthor.get(target.id);
		if (!postId) continue;
		const others = users.filter((u) => u.id !== target.id);
		const commentCount = randomInt(COMMENTS_MIN, COMMENTS_MAX);
		const commenters = pickN(others, commentCount);
		for (const commenter of commenters) {
			rows.push({ post_id: postId, author_id: commenter.id, content: commentFor(commenter, target) });
		}
	}
	console.log(`  inserting ${rows.length} comments...`);
	let inserted = 0;
	for (const batch of chunk(rows, 500)) {
		const { error } = await supabase.from('post_comments').insert(batch);
		if (error) console.error(`  ✗ comments batch error: ${error.message}`);
		else inserted += batch.length;
	}
	return inserted;
}

async function main() {
	const musicians = buildMusicians();
	const venues = buildVenues();
	const people = [...musicians, ...venues];

	const users = await createAuthUsers(people);
	if (users.length === 0) {
		console.error('No users were created — aborting.');
		process.exit(1);
	}

	await writeFile(
		MANIFEST_PATH,
		JSON.stringify(
			{
				createdAt: new Date().toISOString(),
				users: users.map((u) => ({ id: u.id, email: u.email, fullName: u.fullName, kind: u.kind }))
			},
			null,
			2
		)
	);
	console.log(`Manifest written to ${MANIFEST_PATH}`);

	await upsertProfiles(users);
	const postByAuthor = await createPosts(users);
	const likeCount = await createLikes(users, postByAuthor);
	const commentCount = await createComments(users, postByAuthor);

	const musicianCount = users.filter((u) => u.kind === 'musician').length;
	const venueCount = users.filter((u) => u.kind === 'venue').length;

	console.log('\nDone.');
	console.log(`  Musicians: ${musicianCount}/${musicians.length}`);
	console.log(`  Venues:    ${venueCount}/${venues.length}`);
	console.log(`  Posts:     ${postByAuthor.size}`);
	console.log(`  Likes:     ${likeCount}`);
	console.log(`  Comments:  ${commentCount}`);
	console.log(`\nTo remove everything later: node --env-file=.env scripts/remove-network.mjs`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
