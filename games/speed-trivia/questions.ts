export type RawQuestion = {
  id: string;
  category: string;
  question: string;
  correctAnswer: string;
  incorrectAnswers: [string, string, string];
};

export type ActiveQuestion = {
  id: string;
  category: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
};

export const QUESTION_POOL: RawQuestion[] = [
  // --- SCIENCE (1-15) ---
  { id: "q1", category: "SCIENCE", question: "What is the chemical symbol for Gold?", correctAnswer: "Au", incorrectAnswers: ["Ag", "Fe", "Cu"] },
  { id: "q2", category: "SCIENCE", question: "Which planet is known as the Red Planet?", correctAnswer: "Mars", incorrectAnswers: ["Venus", "Jupiter", "Saturn"] },
  { id: "q3", category: "SCIENCE", question: "What speed does light travel in a vacuum?", correctAnswer: "299,792,458 m/s", incorrectAnswers: ["150,000,000 m/s", "3,000,000 m/s", "1,080,000 km/h"] },
  { id: "q4", category: "SCIENCE", question: "How many bones are in the adult human body?", correctAnswer: "206", incorrectAnswers: ["180", "214", "300"] },
  { id: "q5", category: "SCIENCE", question: "What is the most abundant gas in Earth's atmosphere?", correctAnswer: "Nitrogen", incorrectAnswers: ["Oxygen", "Carbon Dioxide", "Argon"] },
  { id: "q6", category: "SCIENCE", question: "What is the chemical formula for table salt?", correctAnswer: "NaCl", incorrectAnswers: ["KCl", "NaOH", "CaCl2"] },
  { id: "q7", category: "SCIENCE", question: "Which organ in the human body consumes the most energy?", correctAnswer: "Brain", incorrectAnswers: ["Heart", "Liver", "Kidneys"] },
  { id: "q8", category: "SCIENCE", question: "What is the study of fungi called?", correctAnswer: "Mycology", incorrectAnswers: ["Phycology", "Cytology", "Histology"] },
  { id: "q9", category: "SCIENCE", question: "What is the charge of a neutron?", correctAnswer: "Zero", incorrectAnswers: ["Positive", "Negative", "Variable"] },
  { id: "q10", category: "SCIENCE", question: "Which subatomic particle was discovered by J.J. Thomson?", correctAnswer: "Electron", incorrectAnswers: ["Proton", "Neutron", "Positron"] },
  { id: "q11", category: "SCIENCE", question: "What element has the atomic number 1?", correctAnswer: "Hydrogen", incorrectAnswers: ["Helium", "Lithium", "Carbon"] },
  { id: "q12", category: "SCIENCE", question: "What type of wave is sound?", correctAnswer: "Longitudinal", incorrectAnswers: ["Transverse", "Electromagnetic", "Surface"] },
  { id: "q13", category: "SCIENCE", question: "What is the SI unit of electrical resistance?", correctAnswer: "Ohm", incorrectAnswers: ["Volt", "Ampere", "Watt"] },
  { id: "q14", category: "SCIENCE", question: "Which planet has the highest surface temperature?", correctAnswer: "Venus", incorrectAnswers: ["Mercury", "Mars", "Jupiter"] },
  { id: "q15", category: "SCIENCE", question: "What scale measures the hardness of minerals?", correctAnswer: "Mohs Scale", incorrectAnswers: ["Richter Scale", "Kelvin Scale", "Beaufort Scale"] },

  // --- GEOGRAPHY (16-30) ---
  { id: "q16", category: "GEOGRAPHY", question: "What is the capital of Japan?", correctAnswer: "Tokyo", incorrectAnswers: ["Kyoto", "Osaka", "Seoul"] },
  { id: "q17", category: "GEOGRAPHY", question: "Which is the longest river in the world?", correctAnswer: "Nile", incorrectAnswers: ["Amazon", "Mississippi", "Yangtze"] },
  { id: "q18", category: "GEOGRAPHY", question: "Which country has the largest land area in the world?", correctAnswer: "Russia", incorrectAnswers: ["Canada", "China", "United States"] },
  { id: "q19", category: "GEOGRAPHY", question: "What is the smallest continent by land area?", correctAnswer: "Australia", incorrectAnswers: ["Europe", "Antarctica", "South America"] },
  { id: "q20", category: "GEOGRAPHY", question: "Which mountain is the highest peak above sea level?", correctAnswer: "Mount Everest", incorrectAnswers: ["K2", "Kangchenjunga", "Kilimanjaro"] },
  { id: "q21", category: "GEOGRAPHY", question: "What is the capital of Australia?", correctAnswer: "Canberra", incorrectAnswers: ["Sydney", "Melbourne", "Brisbane"] },
  { id: "q22", category: "GEOGRAPHY", question: "Which desert is the largest hot desert in the world?", correctAnswer: "Sahara", incorrectAnswers: ["Gobi", "Kalahari", "Atacama"] },
  { id: "q23", category: "GEOGRAPHY", question: "What body of water separates Great Britain from France?", correctAnswer: "English Channel", incorrectAnswers: ["North Sea", "Bay of Biscay", "Baltic Sea"] },
  { id: "q24", category: "GEOGRAPHY", question: "Which landlocked country lies between China and Russia?", correctAnswer: "Mongolia", incorrectAnswers: ["Kazakhstan", "Nepal", "Bhutan"] },
  { id: "q25", category: "GEOGRAPHY", question: "What is the capital city of Canada?", correctAnswer: "Ottawa", incorrectAnswers: ["Toronto", "Vancouver", "Montreal"] },
  { id: "q26", category: "GEOGRAPHY", question: "Which ocean is the deepest in the world?", correctAnswer: "Pacific Ocean", incorrectAnswers: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean"] },
  { id: "q27", category: "GEOGRAPHY", question: "Which South American country has Portuguese as its official language?", correctAnswer: "Brazil", incorrectAnswers: ["Argentina", "Colombia", "Peru"] },
  { id: "q28", category: "GEOGRAPHY", question: "In which ocean is the island of Madagascar located?", correctAnswer: "Indian Ocean", incorrectAnswers: ["Atlantic Ocean", "Pacific Ocean", "Southern Ocean"] },
  { id: "q29", category: "GEOGRAPHY", question: "What is the largest lake in Africa by surface area?", correctAnswer: "Lake Victoria", incorrectAnswers: ["Lake Tanganyika", "Lake Malawi", "Lake Chad"] },
  { id: "q30", category: "GEOGRAPHY", question: "What city is built across two continents?", correctAnswer: "Istanbul", incorrectAnswers: ["Cairo", "Moscow", "Athens"] },

  // --- HISTORY (31-45) ---
  { id: "q31", category: "HISTORY", question: "In which year did World War II end?", correctAnswer: "1945", incorrectAnswers: ["1918", "1939", "1950"] },
  { id: "q32", category: "HISTORY", question: "Who was the first President of the United States?", correctAnswer: "George Washington", incorrectAnswers: ["Thomas Jefferson", "Abraham Lincoln", "John Adams"] },
  { id: "q33", category: "HISTORY", question: "Which empire built the Colosseum in Rome?", correctAnswer: "Roman Empire", incorrectAnswers: ["Greek Empire", "Ottoman Empire", "Byzantine Empire"] },
  { id: "q34", category: "HISTORY", question: "Who painted the Mona Lisa?", correctAnswer: "Leonardo da Vinci", incorrectAnswers: ["Michelangelo", "Vincent van Gogh", "Pablo Picasso"] },
  { id: "q35", category: "HISTORY", question: "In what year did the Titanic sink?", correctAnswer: "1912", incorrectAnswers: ["1905", "1920", "1898"] },
  { id: "q36", category: "HISTORY", question: "Who was the queen of ancient Egypt famous for her relationship with Julius Caesar?", correctAnswer: "Cleopatra", incorrectAnswers: ["Nefertiti", "Hatshepsut", "Arsinoe"] },
  { id: "q37", category: "HISTORY", question: "Which war was fought between the North and South regions of the US?", correctAnswer: "American Civil War", incorrectAnswers: ["Revolutionary War", "War of 1812", "Mexican War"] },
  { id: "q38", category: "HISTORY", question: "Who was the first human to travel into space?", correctAnswer: "Yuri Gagarin", incorrectAnswers: ["Neil Armstrong", "Buzz Aldrin", "John Glenn"] },
  { id: "q39", category: "HISTORY", question: "What wall divided a major European city from 1961 to 1989?", correctAnswer: "Berlin Wall", incorrectAnswers: ["Maginot Line", "Hadrian's Wall", "Great Wall"] },
  { id: "q40", category: "HISTORY", question: "Which French military commander crowned himself Emperor in 1804?", correctAnswer: "Napoleon Bonaparte", incorrectAnswers: ["Louis XIV", "Charles de Gaulle", "Charlemagne"] },
  { id: "q41", category: "HISTORY", question: "In which country did the Industrial Revolution begin?", correctAnswer: "Great Britain", incorrectAnswers: ["United States", "Germany", "France"] },
  { id: "q42", category: "HISTORY", question: "Who was the principal author of the US Declaration of Independence?", correctAnswer: "Thomas Jefferson", incorrectAnswers: ["Benjamin Franklin", "Alexander Hamilton", "James Madison"] },
  { id: "q43", category: "HISTORY", question: "Which ancient civilization constructed the pyramids at Giza?", correctAnswer: "Ancient Egyptians", incorrectAnswers: ["Babylonians", "Mayans", "Assyrians"] },
  { id: "q44", category: "HISTORY", question: "Who served as British Prime Minister during most of World War II?", correctAnswer: "Winston Churchill", incorrectAnswers: ["Neville Chamberlain", "Clement Attlee", "Anthony Eden"] },
  { id: "q45", category: "HISTORY", question: "What treaty officially ended World War I in 1919?", correctAnswer: "Treaty of Versailles", incorrectAnswers: ["Treaty of Ghent", "Treaty of Paris", "Treaty of Utrecht"] },

  // --- POP CULTURE (46-60) ---
  { id: "q46", category: "POP CULTURE", question: "Which British band released the famous album 'Abbey Road'?", correctAnswer: "The Beatles", incorrectAnswers: ["The Rolling Stones", "Pink Floyd", "The Who"] },
  { id: "q47", category: "POP CULTURE", question: "Who created the animated character Mickey Mouse?", correctAnswer: "Walt Disney", incorrectAnswers: ["Warner Bros", "Hanna-Barbera", "Max Fleischer"] },
  { id: "q48", category: "POP CULTURE", question: "What fictional wizarding school does Harry Potter attend?", correctAnswer: "Hogwarts", incorrectAnswers: ["Durmstrang", "Beauxbatons", "Ilvermorny"] },
  { id: "q49", category: "POP CULTURE", question: "Which singer is known as the 'King of Pop'?", correctAnswer: "Michael Jackson", incorrectAnswers: ["Elvis Presley", "Prince", "Freddie Mercury"] },
  { id: "q50", category: "POP CULTURE", question: "What pop star sang the hit song 'Toxic' in 2003?", correctAnswer: "Britney Spears", incorrectAnswers: ["Christina Aguilera", "Madonna", "Lady Gaga"] },
  { id: "q51", category: "POP CULTURE", question: "Which streaming service released the hit series 'Stranger Things'?", correctAnswer: "Netflix", incorrectAnswers: ["Hulu", "HBO Max", "Disney+"] },
  { id: "q52", category: "POP CULTURE", question: "Who played Jack Dawson in the 1997 film Titanic?", correctAnswer: "Leonardo DiCaprio", incorrectAnswers: ["Brad Pitt", "Matt Damon", "Tom Cruise"] },
  { id: "q53", category: "POP CULTURE", question: "Which superhero is also known as Bruce Wayne?", correctAnswer: "Batman", incorrectAnswers: ["Superman", "Iron Man", "Spider-Man"] },
  { id: "q54", category: "POP CULTURE", question: "What is the longest-running American animated sitcom?", correctAnswer: "The Simpsons", incorrectAnswers: ["Family Guy", "South Park", "Bob's Burgers"] },
  { id: "q55", category: "POP CULTURE", question: "Which artist released the album '21' in 2011?", correctAnswer: "Adele", incorrectAnswers: ["Taylor Swift", "Rihanna", "Beyoncé"] },
  { id: "q56", category: "POP CULTURE", question: "What fictional continent is the main setting of Game of Thrones?", correctAnswer: "Westeros", incorrectAnswers: ["Middle-earth", "Essos", "Narnia"] },
  { id: "q57", category: "POP CULTURE", question: "Who portrayed Iron Man in the Marvel Cinematic Universe?", correctAnswer: "Robert Downey Jr.", incorrectAnswers: ["Chris Evans", "Chris Hemsworth", "Mark Ruffalo"] },
  { id: "q58", category: "POP CULTURE", question: "Which K-pop group broke global records with 'Dynamite'?", correctAnswer: "BTS", incorrectAnswers: ["BLACKPINK", "EXO", "BIGBANG"] },
  { id: "q59", category: "POP CULTURE", question: "What game featured 'It's dangerous to go alone! Take this'?", correctAnswer: "The Legend of Zelda", incorrectAnswers: ["Super Mario Bros.", "Final Fantasy", "Metroid"] },
  { id: "q60", category: "POP CULTURE", question: "Who won the Best Actress Oscar for La La Land?", correctAnswer: "Emma Stone", incorrectAnswers: ["Meryl Streep", "Jennifer Lawrence", "Cate Blanchett"] },

  // --- LITERATURE (61-75) ---
  { id: "q61", category: "CLASSIC LITERATURE", question: "Who wrote the play 'Romeo and Juliet'?", correctAnswer: "William Shakespeare", incorrectAnswers: ["Charles Dickens", "Mark Twain", "Jane Austen"] },
  { id: "q62", category: "CLASSIC LITERATURE", question: "What is the title of Herman Melville's novel about a white whale?", correctAnswer: "Moby-Dick", incorrectAnswers: ["The Old Man and the Sea", "Twenty Thousand Leagues", "Robinson Crusoe"] },
  { id: "q63", category: "CLASSIC LITERATURE", question: "Which dystopian novel by George Orwell introduces Big Brother?", correctAnswer: "1984", incorrectAnswers: ["Brave New World", "Fahrenheit 451", "Animal Farm"] },
  { id: "q64", category: "CLASSIC LITERATURE", question: "Who wrote 'Pride and Prejudice'?", correctAnswer: "Jane Austen", incorrectAnswers: ["Charlotte Brontë", "Emily Brontë", "Mary Shelley"] },
  { id: "q65", category: "CLASSIC LITERATURE", question: "What fantasy trilogy features the One Ring and Mount Doom?", correctAnswer: "The Lord of the Rings", incorrectAnswers: ["The Chronicles of Narnia", "The Wheel of Time", "A Song of Ice and Fire"] },
  { id: "q66", category: "CLASSIC LITERATURE", question: "Who authored the Gothic novel 'Frankenstein'?", correctAnswer: "Mary Shelley", incorrectAnswers: ["Bram Stoker", "Edgar Allan Poe", "H.P. Lovecraft"] },
  { id: "q67", category: "CLASSIC LITERATURE", question: "Which epic poem details Odysseus' ten-year journey home?", correctAnswer: "The Odyssey", incorrectAnswers: ["The Iliad", "The Aeneid", "The Epic of Gilgamesh"] },
  { id: "q68", category: "CLASSIC LITERATURE", question: "Who wrote 'The Great Gatsby'?", correctAnswer: "F. Scott Fitzgerald", incorrectAnswers: ["Ernest Hemingway", "John Steinbeck", "William Faulkner"] },
  { id: "q69", category: "CLASSIC LITERATURE", question: "What is the name of the detective created by Sir Arthur Conan Doyle?", correctAnswer: "Sherlock Holmes", incorrectAnswers: ["Hercule Poirot", "Sam Spade", "Philip Marlowe"] },
  { id: "q70", category: "CLASSIC LITERATURE", question: "Who wrote 'Alice's Adventures in Wonderland'?", correctAnswer: "Lewis Carroll", incorrectAnswers: ["Roald Dahl", "C.S. Lewis", "J.M. Barrie"] },
  { id: "q71", category: "CLASSIC LITERATURE", question: "Who wrote the novella 'The Metamorphosis'?", correctAnswer: "Franz Kafka", incorrectAnswers: ["Leo Tolstoy", "Fyodor Dostoevsky", "Thomas Mann"] },
  { id: "q72", category: "CLASSIC LITERATURE", question: "Who wrote the novel 'To Kill a Mockingbird'?", correctAnswer: "Harper Lee", incorrectAnswers: ["Toni Morrison", "Maya Angelou", "Truman Capote"] },
  { id: "q73", category: "CLASSIC LITERATURE", question: "What poem begins with 'Once upon a midnight dreary'?", correctAnswer: "The Raven", incorrectAnswers: ["Annabel Lee", "Ozymandias", "The Road Not Taken"] },
  { id: "q74", category: "CLASSIC LITERATURE", question: "Who wrote 'Les Misérables'?", correctAnswer: "Victor Hugo", incorrectAnswers: ["Alexandre Dumas", "Gustave Flaubert", "Émile Zola"] },
  { id: "q75", category: "CLASSIC LITERATURE", question: "What classic Russian novel was written by Leo Tolstoy?", correctAnswer: "War and Peace", incorrectAnswers: ["Crime and Punishment", "The Master and Margarita", "Fathers and Sons"] },

  // --- CINEMA (76-90) ---
  { id: "q76", category: "GLOBAL CINEMA", question: "Which film won the first Academy Award for Best Picture in 1929?", correctAnswer: "Wings", incorrectAnswers: ["Sunrise", "Metropolis", "The Jazz Singer"] },
  { id: "q77", category: "GLOBAL CINEMA", question: "Who directed the sci-fi thriller 'Inception'?", correctAnswer: "Christopher Nolan", incorrectAnswers: ["Steven Spielberg", "James Cameron", "Denis Villeneuve"] },
  { id: "q78", category: "GLOBAL CINEMA", question: "What movie features the quote 'May the Force be with you'?", correctAnswer: "Star Wars", incorrectAnswers: ["Star Trek", "The Matrix", "Avatar"] },
  { id: "q79", category: "GLOBAL CINEMA", question: "Who played the Joker in 'The Dark Knight' (2008)?", correctAnswer: "Heath Ledger", incorrectAnswers: ["Joaquin Phoenix", "Jack Nicholson", "Jared Leto"] },
  { id: "q80", category: "GLOBAL CINEMA", question: "Which movie became the highest-grossing film of all time in 2009?", correctAnswer: "Avatar", incorrectAnswers: ["Titanic", "Avengers: Endgame", "Jurassic Park"] },
  { id: "q81", category: "GLOBAL CINEMA", question: "Who directed 'Jurassic Park' and 'E.T.'?", correctAnswer: "Steven Spielberg", incorrectAnswers: ["George Lucas", "Ridley Scott", "Martin Scorsese"] },
  { id: "q82", category: "GLOBAL CINEMA", question: "What movie was the first full-length animated feature film?", correctAnswer: "Snow White and the Seven Dwarfs", incorrectAnswers: ["Pinocchio", "Fantasia", "Bambi"] },
  { id: "q83", category: "GLOBAL CINEMA", question: "Which film won Best Picture at the 92nd Academy Awards (2020)?", correctAnswer: "Parasite", incorrectAnswers: ["1917", "Once Upon a Time in Hollywood", "Joker"] },
  { id: "q84", category: "GLOBAL CINEMA", question: "What classic 1972 movie starred Marlon Brando as Don Vito Corleone?", correctAnswer: "The Godfather", incorrectAnswers: ["Goodfellas", "Scarface", "Casino"] },
  { id: "q85", category: "GLOBAL CINEMA", question: "Who played Neo in 'The Matrix' trilogy?", correctAnswer: "Keanu Reeves", incorrectAnswers: ["Laurence Fishburne", "Tom Cruise", "Will Smith"] },
  { id: "q86", category: "GLOBAL CINEMA", question: "Which horror movie features a killer named Michael Myers?", correctAnswer: "Halloween", incorrectAnswers: ["Friday the 13th", "A Nightmare on Elm Street", "Scream"] },
  { id: "q87", category: "GLOBAL CINEMA", question: "Who directed the 1994 film 'Pulp Fiction'?", correctAnswer: "Quentin Tarantino", incorrectAnswers: ["Coen Brothers", "David Fincher", "Oliver Stone"] },
  { id: "q88", category: "GLOBAL CINEMA", question: "What animated movie features the song 'Let It Go'?", correctAnswer: "Frozen", incorrectAnswers: ["Moana", "Tangled", "Brave"] },
  { id: "q89", category: "GLOBAL CINEMA", question: "Which actor portrayed Forrest Gump in the 1994 film?", correctAnswer: "Tom Hanks", incorrectAnswers: ["Robin Williams", "Jim Carrey", "Harrison Ford"] },
  { id: "q90", category: "GLOBAL CINEMA", question: "What movie features a giant shark terrorizing Amity Island?", correctAnswer: "Jaws", incorrectAnswers: ["Deep Blue Sea", "The Meg", "Open Water"] },

  // --- ASTRONOMY (91-105) ---
  { id: "q91", category: "ASTRONOMY & SPACE", question: "What is the nearest star to Earth?", correctAnswer: "Sun", incorrectAnswers: ["Proxima Centauri", "Alpha Centauri", "Sirius"] },
  { id: "q92", category: "ASTRONOMY & SPACE", question: "Which planet in our solar system has the most extensive ring system?", correctAnswer: "Saturn", incorrectAnswers: ["Jupiter", "Uranus", "Neptune"] },
  { id: "q93", category: "ASTRONOMY & SPACE", question: "What type of celestial object is a pulsar?", correctAnswer: "Neutron Star", incorrectAnswers: ["White Dwarf", "Black Hole", "Red Giant"] },
  { id: "q94", category: "ASTRONOMY & SPACE", question: "What galaxy is the closest major spiral galaxy to the Milky Way?", correctAnswer: "Andromeda", incorrectAnswers: ["Triangulum", "Sombrero", "Whirlpool"] },
  { id: "q95", category: "ASTRONOMY & SPACE", question: "What is the boundary surrounding a black hole beyond which nothing escapes?", correctAnswer: "Event Horizon", incorrectAnswers: ["Singularity", "Photon Sphere", "Accretion Disk"] },
  { id: "q96", category: "ASTRONOMY & SPACE", question: "What spacecraft landed humans on the Moon for the first time in 1969?", correctAnswer: "Apollo 11", incorrectAnswers: ["Apollo 13", "Gemini 4", "Vostok 1"] },
  { id: "q97", category: "ASTRONOMY & SPACE", question: "Which dwarf planet was classified as the ninth planet until 2006?", correctAnswer: "Pluto", incorrectAnswers: ["Ceres", "Eris", "Makemake"] },
  { id: "q98", category: "ASTRONOMY & SPACE", question: "What is the largest planet in our solar system?", correctAnswer: "Jupiter", incorrectAnswers: ["Saturn", "Neptune", "Uranus"] },
  { id: "q99", category: "ASTRONOMY & SPACE", question: "What NASA space telescope was launched in 2021?", correctAnswer: "James Webb Space Telescope", incorrectAnswers: ["Hubble", "Spitzer", "Kepler"] },
  { id: "q100", category: "ASTRONOMY & SPACE", question: "What color are cool stars compared to hot blue stars?", correctAnswer: "Red", incorrectAnswers: ["Yellow", "White", "Green"] },
  { id: "q101", category: "ASTRONOMY & SPACE", question: "What phenomenon occurs when the Moon passes directly between Earth and Sun?", correctAnswer: "Solar Eclipse", incorrectAnswers: ["Lunar Eclipse", "Transit", "Equinox"] },
  { id: "q102", category: "ASTRONOMY & SPACE", question: "What gas makes Uranus and Neptune appear blue?", correctAnswer: "Methane", incorrectAnswers: ["Ammonia", "Hydrogen", "Helium"] },
  { id: "q103", category: "ASTRONOMY & SPACE", question: "Which moon of Jupiter is the largest moon in the solar system?", correctAnswer: "Ganymede", incorrectAnswers: ["Titan", "Callisto", "Io"] },
  { id: "q104", category: "ASTRONOMY & SPACE", question: "What is the name of the supermassive black hole at the center of the Milky Way?", correctAnswer: "Sagittarius A*", incorrectAnswers: ["Cygnus X-1", "M87*", "Centaurus A"] },
  { id: "q105", category: "ASTRONOMY & SPACE", question: "How long does it take for light from the Sun to reach Earth?", correctAnswer: "About 8 minutes", incorrectAnswers: ["About 8 seconds", "About 1 hour", "About 24 hours"] },

  // --- COMPUTER SCIENCE (106-120) ---
  { id: "q106", category: "COMPUTER SCIENCE", question: "Who is widely considered the father of modern computer science?", correctAnswer: "Alan Turing", incorrectAnswers: ["Charles Babbage", "Ada Lovelace", "John von Neumann"] },
  { id: "q107", category: "COMPUTER SCIENCE", question: "What programming language was created by Brendan Eich in 1995?", correctAnswer: "JavaScript", incorrectAnswers: ["Python", "Java", "C++"] },
  { id: "q108", category: "COMPUTER SCIENCE", question: "What does HTTP stand for?", correctAnswer: "Hypertext Transfer Protocol", incorrectAnswers: ["High Transfer Text Process", "Hyperlink Text Test Plan", "Hyper Transfer Terminal Protocol"] },
  { id: "q109", category: "COMPUTER SCIENCE", question: "What is the worst-case time complexity of quicksort?", correctAnswer: "O(n^2)", incorrectAnswers: ["O(n log n)", "O(n)", "O(1)"] },
  { id: "q110", category: "COMPUTER SCIENCE", question: "Which data structure operates on a Last-In, First-Out (LIFO) basis?", correctAnswer: "Stack", incorrectAnswers: ["Queue", "Heap", "Tree"] },
  { id: "q111", category: "COMPUTER SCIENCE", question: "What operating system kernel was created by Linus Torvalds in 1991?", correctAnswer: "Linux", incorrectAnswers: ["Unix", "BSD", "DOS"] },
  { id: "q112", category: "COMPUTER SCIENCE", question: "What binary digit represents a single unit of digital information?", correctAnswer: "Bit", incorrectAnswers: ["Byte", "Nibble", "Word"] },
  { id: "q113", category: "COMPUTER SCIENCE", question: "How many bits are in one standard byte?", correctAnswer: "8", incorrectAnswers: ["4", "16", "32"] },
  { id: "q114", category: "COMPUTER SCIENCE", question: "What data structure stores key-value pairs for O(1) average lookup?", correctAnswer: "Hash Table", incorrectAnswers: ["Linked List", "Binary Search Tree", "Array"] },
  { id: "q115", category: "COMPUTER SCIENCE", question: "What version control system was created by Linus Torvalds in 2005?", correctAnswer: "Git", incorrectAnswers: ["Subversion", "Mercurial", "CVS"] },
  { id: "q116", category: "COMPUTER SCIENCE", question: "What does SQL stand for?", correctAnswer: "Structured Query Language", incorrectAnswers: ["Standard Query List", "Sequential Query Logic", "System Query Link"] },
  { id: "q117", category: "COMPUTER SCIENCE", question: "Who created the Python programming language?", correctAnswer: "Guido van Rossum", incorrectAnswers: ["Dennis Ritchie", "Bjarne Stroustrup", "James Gosling"] },
  { id: "q118", category: "COMPUTER SCIENCE", question: "What architecture pattern separates Model, View, and Controller?", correctAnswer: "MVC Pattern", incorrectAnswers: ["Singleton Pattern", "Factory Pattern", "Observer Pattern"] },
  { id: "q119", category: "COMPUTER SCIENCE", question: "What is the default port for HTTP web traffic?", correctAnswer: "80", incorrectAnswers: ["443", "8080", "22"] },
  { id: "q120", category: "COMPUTER SCIENCE", question: "What algorithm finds the shortest path in a weighted graph?", correctAnswer: "Dijkstra's Algorithm", incorrectAnswers: ["Kruskal's Algorithm", "Binary Search", "Depth-First Search"] },

  // --- MATHEMATICS (121-135) ---
  { id: "q121", category: "MATHEMATICS", question: "What is the value of Pi rounded to two decimal places?", correctAnswer: "3.14", incorrectAnswers: ["3.16", "3.12", "3.18"] },
  { id: "q122", category: "MATHEMATICS", question: "What theorem states a^2 + b^2 = c^2 for right triangles?", correctAnswer: "Pythagorean Theorem", incorrectAnswers: ["Fermat's Last Theorem", "Euler's Formula", "Binomial Theorem"] },
  { id: "q123", category: "MATHEMATICS", question: "What is the square root of 144?", correctAnswer: "12", incorrectAnswers: ["14", "16", "10"] },
  { id: "q124", category: "MATHEMATICS", question: "What branch of mathematics studies rates of change and accumulation?", correctAnswer: "Calculus", incorrectAnswers: ["Algebra", "Geometry", "Statistics"] },
  { id: "q125", category: "MATHEMATICS", question: "What is the sum of angles in a flat Euclidean triangle?", correctAnswer: "180 degrees", incorrectAnswers: ["360 degrees", "90 degrees", "270 degrees"] },
  { id: "q126", category: "MATHEMATICS", question: "What is the smallest prime number?", correctAnswer: "2", incorrectAnswers: ["1", "3", "0"] },
  { id: "q127", category: "MATHEMATICS", question: "What mathematical constant is roughly equal to 2.718?", correctAnswer: "e (Euler's Number)", incorrectAnswers: ["Pi", "Phi", "Tau"] },
  { id: "q128", category: "MATHEMATICS", question: "What is 7 factorial (7!)?", correctAnswer: "5040", incorrectAnswers: ["720", "40320", "120"] },
  { id: "q129", category: "MATHEMATICS", question: "What polygon has ten sides?", correctAnswer: "Decagon", incorrectAnswers: ["Octagon", "Nonagon", "Dodecagon"] },
  { id: "q130", category: "MATHEMATICS", question: "What line segment passes through the center of a circle connecting two points?", correctAnswer: "Diameter", incorrectAnswers: ["Radius", "Chord", "Secant"] },
  { id: "q131", category: "MATHEMATICS", question: "What is the logarithm of 1000 in base 10?", correctAnswer: "3", incorrectAnswers: ["2", "4", "10"] },
  { id: "q132", category: "MATHEMATICS", question: "What ratio is known as the Golden Ratio?", correctAnswer: "1.618", incorrectAnswers: ["1.414", "2.718", "3.141"] },
  { id: "q133", category: "MATHEMATICS", question: "In probability, what is the chance of flipping heads on a fair coin?", correctAnswer: "50%", incorrectAnswers: ["25%", "75%", "33%"] },
  { id: "q134", category: "MATHEMATICS", question: "What shape has four equal sides and four right angles?", correctAnswer: "Square", incorrectAnswers: ["Rhombus", "Rectangle", "Trapezoid"] },
  { id: "q135", category: "MATHEMATICS", question: "Who formulated the laws of motion and universal gravitation?", correctAnswer: "Isaac Newton", incorrectAnswers: ["Gottfried Leibniz", "Carl Friedrich Gauss", "René Descartes"] },

  // --- SPORTS (136-150) ---
  { id: "q136", category: "SPORTS", question: "How many players are on the field for one team in a soccer match?", correctAnswer: "11", incorrectAnswers: ["10", "12", "9"] },
  { id: "q137", category: "SPORTS", question: "Which country won the FIFA World Cup in 2022?", correctAnswer: "Argentina", incorrectAnswers: ["France", "Brazil", "Croatia"] },
  { id: "q138", category: "SPORTS", question: "In golf, what is the term for scoring one under par on a hole?", correctAnswer: "Birdie", incorrectAnswers: ["Eagle", "Bogey", "Albatross"] },
  { id: "q139", category: "SPORTS", question: "How many points is a touchdown worth in American football?", correctAnswer: "6", incorrectAnswers: ["3", "7", "2"] },
  { id: "q140", category: "SPORTS", question: "Which sport is played at Wimbledon?", correctAnswer: "Tennis", incorrectAnswers: ["Golf", "Cricket", "Polo"] },
  { id: "q141", category: "SPORTS", question: "How many rings are in the official Olympic logo?", correctAnswer: "5", incorrectAnswers: ["6", "4", "7"] },
  { id: "q142", category: "SPORTS", question: "Which NBA player holds the record for the most total career points?", correctAnswer: "LeBron James", incorrectAnswers: ["Kareem Abdul-Jabbar", "Michael Jordan", "Kobe Bryant"] },
  { id: "q143", category: "SPORTS", question: "In bowling, what is the maximum possible score in a single game?", correctAnswer: "300", incorrectAnswers: ["200", "250", "350"] },
  { id: "q144", category: "SPORTS", question: "What distance is a standard marathon race?", correctAnswer: "26.2 miles / 42.195 km", incorrectAnswers: ["20 miles", "30 miles", "13.1 miles"] },
  { id: "q145", category: "SPORTS", question: "Which nation has won the most Summer Olympic gold medals?", correctAnswer: "United States", incorrectAnswers: ["Soviet Union", "China", "Great Britain"] },
  { id: "q146", category: "SPORTS", question: "In baseball, how many strikes result in a strikeout?", correctAnswer: "3", incorrectAnswers: ["4", "2", "5"] },
  { id: "q147", category: "SPORTS", question: "What sport uses terms like 'icing' and 'power play'?", correctAnswer: "Ice Hockey", incorrectAnswers: ["Field Hockey", "Lacrosse", "Curling"] },
  { id: "q148", category: "SPORTS", question: "Who is the fastest sprinter in history with a 100m world record of 9.58s?", correctAnswer: "Usain Bolt", incorrectAnswers: ["Tyson Gay", "Yohan Blake", "Justin Gatlin"] },
  { id: "q149", category: "SPORTS", question: "How many minutes are played in a regulation NBA basketball game?", correctAnswer: "48 minutes", incorrectAnswers: ["40 minutes", "60 minutes", "36 minutes"] },
  { id: "q150", category: "SPORTS", question: "Which country invented table tennis (ping pong)?", correctAnswer: "England", incorrectAnswers: ["China", "Japan", "South Korea"] },
];
