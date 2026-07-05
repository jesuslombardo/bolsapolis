// Datos de las pistas del juego. En el MVP solo está la Pista 1 (la cueva).

export const PISTA_1 = {
  id: 'cueva',
  // Texto que se descubre al inspeccionar la inscripción de la cueva.
  inscription:
    'Grabado en la pared de la cueva, con letras temblorosas:\n\n' +
    '  "Naufragó quien no supo leer el cielo.\n' +
    '   Donde la tierra escupe fuego y humo,\n' +
    '   duerme el segundo secreto de la isla."\n\n' +
    '(Buscá en el horizonte de la isla... algo humea a lo lejos.)',
  question:
    'El cofre pide una palabra clave. Según la inscripción, ' +
    '¿qué lugar de la isla "escupe fuego y humo"?',
  // Respuestas aceptadas (se normalizan: minúsculas, sin tildes, sin artículo).
  answers: ['volcan', 'volcano', 'monte', 'montana de fuego'],
  hints: [
    'Mirá a lo lejos en la isla: hay una montaña de la que sube humo.',
    'Es una montaña que puede entrar en erupción y largar lava.',
    'Empieza con "V". Es un volc____.',
  ],
  solvedText:
    '¡El cofre se abre con un crujido! Dentro hay un trozo de mapa mojado ' +
    'que marca con una X el VOLCÁN de la isla. La Pista 1 está resuelta.',
};

// Normaliza una respuesta del jugador para compararla con las aceptadas.
export function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes/diacríticos
    .replace(/^(el|la|los|las|un|una)\s+/, '') // quita artículo inicial
    .replace(/\s+/g, ' ');
}

export function isCorrect(pista, text) {
  const n = normalize(text);
  return pista.answers.some((a) => normalize(a) === n);
}
